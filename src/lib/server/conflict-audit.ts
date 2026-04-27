import type { Pool } from 'mysql2/promise';

export type ConflictAuditType = 'room' | 'student' | 'lecturer';

export type ConflictAuditFilters = {
	conflictType?: ConflictAuditType;
	academicYear?: string;
	semester?: string;
	lecturerId?: string;
	courseId?: string;
	classRoomId?: string;
	day?: ConflictAuditMember['day'];
	focusEnrollmentIds?: string[];
	limitGroups?: number;
	memberSampleSize?: number;
};

export type ConflictAuditMember = {
	enrollmentId: string;
	scheduleId: string;
	studentId: string;
	studentName: string;
	courseId: string;
	courseName: string;
	lecturerId: string;
	lecturerName: string;
	classRoomId: string;
	classRoomName: string;
	semester: string;
	academicYear: string;
	day: 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU';
	startTime: string;
	endTime: string;
};

export type ConflictAuditGroup = {
	conflictType: ConflictAuditType;
	resourceId: string;
	resourceName: string;
	day: ConflictAuditMember['day'];
	memberCount: number;
	members: ConflictAuditMember[];
};

export type ConflictAuditResult = {
	filters: { academicYear: string | null; semester: string | null; lecturerScope: string | null };
	summary: {
		totalGroups: number;
		roomGroups: number;
		studentGroups: number;
		lecturerGroups: number;
		conflictedEnrollments: number;
		/** Distinct rooms involved in at least one conflict (not the number of conflict instances). */
		conflictedRooms: number;
		/** Distinct students involved in at least one conflict. */
		conflictedStudents: number;
		/** Distinct lecturers involved in at least one conflict. */
		conflictedLecturers: number;
	};
	truncated: boolean;
	groups: ConflictAuditGroup[];
};

type AuditScanRow = {
	enrollment_id: string;
	schedule_id: string;
	student_id: string;
	student_name: string;
	course_id: string;
	course_name: string;
	lecturer_id: string;
	lecturer_name: string;
	class_room_id: string;
	class_room_name: string;
	semester: string;
	academic_year: string;
	schedule_audit_sk: number;
	resource_id: number;
	academic_year_start: number;
	semester_sort: number;
	day: ConflictAuditMember['day'];
	start_time: string;
	end_time: string;
};

type ConflictAuditGroupSeed = {
	conflictType: ConflictAuditType;
	resourceId: string;
	academicYearStart: number;
	semesterSort: number;
	day: ConflictAuditMember['day'];
	startTime: string;
	endTime: string;
	memberCount: number;
	memberRows: AuditScanRow[];
};

type HydratedMemberRow = {
	enrollment_id: string;
	schedule_id: string;
	student_id: string;
	student_name: string;
	course_id: string;
	course_name: string;
	lecturer_id: string;
	lecturer_name: string;
	class_room_id: string;
	class_room_name: string;
	semester: string;
	academic_year: string;
	day: ConflictAuditMember['day'];
	start_time: string;
	end_time: string;
};

type CacheEntry = {
	version: number;
	storedAt: number;
	result: ConflictAuditResult;
};

const AUDIT_CACHE_TTL_MS = 60_000;
const DEFAULT_HYDRATED_MEMBERS_PER_GROUP = 40;
const MAX_HYDRATED_MEMBERS_PER_GROUP = 40;
const AUDIT_CACHE_MAX_SIZE = 200;
const auditCache = new Map<string, CacheEntry>();
const auditCacheInsertionOrder: string[] = [];
const inFlightAudits = new Map<string, Promise<ConflictAuditResult>>();
let auditCacheVersion = 0;

function pruneAuditCache() {
	while (auditCache.size > AUDIT_CACHE_MAX_SIZE) {
		const oldest = auditCacheInsertionOrder.shift();
		if (oldest) auditCache.delete(oldest);
	}
}

function setAuditCache(key: string, entry: CacheEntry) {
	const existing = auditCache.has(key);
	if (!existing) {
		auditCacheInsertionOrder.push(key);
	}
	auditCache.set(key, entry);
	pruneAuditCache();
}

function createAuditCacheKey(filters: ConflictAuditFilters) {
	return JSON.stringify({
		conflictType: filters.conflictType ?? null,
		academicYear: filters.academicYear ?? null,
		semester: filters.semester ?? null,
		lecturerId: filters.lecturerId ?? null,
		courseId: filters.courseId ?? null,
		classRoomId: filters.classRoomId ?? null,
		day: filters.day ?? null,
		focusEnrollmentIds: [...(filters.focusEnrollmentIds ?? [])].sort(),
		limitGroups: filters.limitGroups ?? null,
		memberSampleSize: filters.memberSampleSize ?? null
	});
}

function getMemberSampleSize(filters: ConflictAuditFilters) {
	if (filters.memberSampleSize == null) return null;
	const requested = filters.memberSampleSize;
	return Math.min(Math.max(Math.floor(requested), 1), MAX_HYDRATED_MEMBERS_PER_GROUP);
}

export function invalidateConflictAuditCache() {
	auditCacheVersion += 1;
	auditCache.clear();
	auditCacheInsertionOrder.length = 0;
}

function timeToSeconds(value: Date | string) {
	if (typeof value === 'string') {
		// Handle TIME strings like '13:00:00.000' from MariaDB
		const parts = value.split(':').map(Number);
		return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
	}
	return value.getHours() * 3600 + value.getMinutes() * 60 + value.getSeconds();
}

function mapHydratedMember(row: HydratedMemberRow): ConflictAuditMember {
	return {
		enrollmentId: row.enrollment_id,
		scheduleId: row.schedule_id,
		studentId: row.student_id,
		studentName: row.student_name,
		courseId: row.course_id,
		courseName: row.course_name,
		lecturerId: row.lecturer_id,
		lecturerName: row.lecturer_name,
		classRoomId: row.class_room_id,
		classRoomName: row.class_room_name,
		semester: row.semester,
		academicYear: row.academic_year,
		day: row.day,
		startTime: row.start_time,
		endTime: row.end_time
	};
}

function buildEnrollmentOnlyWhere(filters: ConflictAuditFilters) {
	const whereParts = ['1 = 1'];
	const values: unknown[] = [];

	if (filters.academicYear) {
		whereParts.push('e.academic_year_start = CAST(SUBSTRING(?, 1, 4) AS UNSIGNED)');
		values.push(filters.academicYear);
	}
	if (filters.semester) {
		whereParts.push(
			"e.semester_sort = CASE WHEN UPPER(?) LIKE 'GAN%' THEN 1 WHEN UPPER(?) LIKE 'GEN%' THEN 2 ELSE 9 END"
		);
		values.push(filters.semester, filters.semester);
	}
	if (filters.classRoomId) {
		whereParts.push(
			'e.class_room_audit_sk = (SELECT audit_sk FROM class_rooms WHERE id = ? LIMIT 1)'
		);
		values.push(filters.classRoomId);
	}
	if (filters.courseId) {
		whereParts.push('e.course_audit_sk = (SELECT audit_sk FROM courses WHERE id = ? LIMIT 1)');
		values.push(filters.courseId);
	}
	if (filters.lecturerId) {
		whereParts.push('e.lecturer_audit_sk = (SELECT audit_sk FROM lecturers WHERE id = ? LIMIT 1)');
		values.push(filters.lecturerId);
	}

	if (filters.day) {
		whereParts.push('e.schedule_day = ?');
		values.push(filters.day);
	}

	return { whereSql: whereParts.join(' AND '), values };
}

function getConflictResourceColumn(conflictType: ConflictAuditType) {
	return conflictType === 'room'
		? 'e.class_room_audit_sk'
		: conflictType === 'student'
			? 'e.student_audit_sk'
			: 'e.lecturer_audit_sk';
}

function getConflictForceIndex(conflictType: ConflictAuditType) {
	return conflictType === 'room'
		? 'idx_enrollments_room_conflict'
		: conflictType === 'student'
			? 'idx_enrollments_student_conflict'
			: 'idx_enrollments_lecturer_conflict';
}

function seedKey(
	seed: Pick<
		ConflictAuditGroupSeed,
		'resourceId' | 'academicYearStart' | 'semesterSort' | 'day' | 'startTime' | 'endTime'
	>
) {
	return [
		seed.resourceId,
		seed.academicYearStart,
		seed.semesterSort,
		seed.day,
		seed.startTime,
		seed.endTime
	].join(':');
}

async function collectConflictGroupSeeds(
	pool: Pool,
	conflictType: ConflictAuditType,
	filters: ConflictAuditFilters
) {
	const { whereSql, values } = buildEnrollmentOnlyWhere(filters);
	const resourceCol = getConflictResourceColumn(conflictType);
	const forceIndex = getConflictForceIndex(conflictType);

	// Group at database level using covering index.
	// Different HAVING predicates for different conflict types:
	// - Room: COUNT(*) > 1 — any room double-booking is a conflict
	// - Student/Lecturer: COUNT(DISTINCT course_id) > 1 — multiple students
	//   in the same course at the same time is NOT a conflict
	const havingPredicate =
		conflictType === 'room' ? 'COUNT(*) > 1' : 'COUNT(DISTINCT e.course_id) > 1';
	const hasExtraFilters = whereSql !== '1 = 1';
	const groupSql = [
		`SELECT ${resourceCol} AS resource_id, e.academic_year_start, e.semester_sort,`,
		`  e.schedule_day AS day, e.schedule_start_time AS start_time, e.schedule_end_time AS end_time,`,
		`  COUNT(DISTINCT e.course_id) AS distinct_courses, COUNT(*) AS member_count`,
		`FROM enrollments e${hasExtraFilters ? '' : ` FORCE INDEX (${forceIndex})`}`,
		`WHERE ${whereSql}`,
		`GROUP BY ${resourceCol}, e.academic_year_start, e.semester_sort,`,
		`  e.schedule_day, e.schedule_start_time, e.schedule_end_time`,
		`HAVING ${havingPredicate}`
	].join(' ');

	const [groupRows] = await pool.query(groupSql, values);
	const groups = groupRows as Array<{
		resource_id: number;
		academic_year_start: number;
		semester_sort: number;
		day: ConflictAuditMember['day'];
		start_time: string;
		end_time: string;
		member_count: number;
	}>;

	if (!groups.length) {
		return [] as ConflictAuditGroupSeed[];
	}

	return groups.map((group) => ({
		conflictType,
		resourceId: String(group.resource_id),
		academicYearStart: group.academic_year_start,
		semesterSort: group.semester_sort,
		day: group.day,
		startTime: group.start_time,
		endTime: group.end_time,
		memberCount: group.member_count,
		memberRows: []
	}));
}

async function loadMemberRowsForSeeds(
	pool: Pool,
	seeds: ConflictAuditGroupSeed[],
	focusSet = new Set<string>(),
	memberSampleSize: number | null = DEFAULT_HYDRATED_MEMBERS_PER_GROUP
) {
	if (!seeds.length) return seeds;

	const BATCH_SIZE = 40;
	const rowsBySeedKey = new Map<string, AuditScanRow[]>();
	const enrollmentIdsBySeedKey = new Map<string, Set<string>>();
	const focusIds = [...focusSet];
	const addRows = (memberRows: AuditScanRow[]) => {
		for (const row of memberRows) {
			const key = seedKey({
				resourceId: String(row.resource_id),
				academicYearStart: row.academic_year_start,
				semesterSort: row.semester_sort,
				day: row.day,
				startTime: row.start_time,
				endTime: row.end_time
			});
			const rows = rowsBySeedKey.get(key) ?? [];
			let ids = enrollmentIdsBySeedKey.get(key);
			if (!ids) {
				ids = new Set(rows.map((r) => r.enrollment_id));
				enrollmentIdsBySeedKey.set(key, ids);
			}
			if (!ids.has(row.enrollment_id)) {
				ids.add(row.enrollment_id);
				rows.push(row);
			}
			rowsBySeedKey.set(key, rows);
		}
	};

	for (const conflictType of ['room', 'student', 'lecturer'] as ConflictAuditType[]) {
		const typedSeeds = seeds.filter((seed) => seed.conflictType === conflictType);
		if (!typedSeeds.length) continue;

		const resourceCol = getConflictResourceColumn(conflictType);
		const forceIndex = getConflictForceIndex(conflictType);

		for (let i = 0; i < typedSeeds.length; i += BATCH_SIZE) {
			const batch = typedSeeds.slice(i, i + BATCH_SIZE);
			const conditions = batch
				.map(
					() =>
						`(${resourceCol} = ? AND e.academic_year_start = ? AND e.semester_sort = ? AND e.schedule_day = ? AND e.schedule_start_time = ? AND e.schedule_end_time = ?)`
				)
				.join(' OR ');
			const seedValues = batch.flatMap((seed) => [
				seed.resourceId,
				seed.academicYearStart,
				seed.semesterSort,
				seed.day,
				seed.startTime,
				seed.endTime
			]);

			if (focusIds.length) {
				const focusSql = [
					`SELECT e.id AS enrollment_id, e.schedule_id, e.student_id, s.name AS student_name,`,
					`  e.course_id, c.name AS course_name, c.lecturer_id, l.name AS lecturer_name,`,
					`  e.class_room_id, cr.name AS class_room_name, e.semester, e.academic_year,`,
					`  e.schedule_audit_sk, ${resourceCol} AS resource_id,`,
					`  e.academic_year_start, e.semester_sort, e.schedule_day AS day,`,
					`  e.schedule_start_time AS start_time, e.schedule_end_time AS end_time`,
					`FROM enrollments e FORCE INDEX (${forceIndex})`,
					'INNER JOIN students s ON e.student_id = s.id',
					'INNER JOIN courses c ON e.course_id = c.id',
					'INNER JOIN lecturers l ON c.lecturer_id = l.id',
					'INNER JOIN class_rooms cr ON e.class_room_id = cr.id',
					`WHERE e.id IN (?) AND (${conditions})`
				].join(' ');

				const [focusRows] = await pool.query(focusSql, [focusIds, ...seedValues]);
				addRows(focusRows as AuditScanRow[]);
			}

			const memberOrderSql = memberSampleSize == null ? '' : 'ORDER BY e.audit_sk';
			const memberLimitSql = memberSampleSize == null ? '' : `LIMIT ${memberSampleSize}`;
			const memberSql = batch
				.map(() =>
					[
						`(SELECT e.id AS enrollment_id, e.schedule_id, e.student_id, s.name AS student_name,`,
						`  e.course_id, c.name AS course_name, c.lecturer_id, l.name AS lecturer_name,`,
						`  e.class_room_id, cr.name AS class_room_name, e.semester, e.academic_year,`,
						`  e.schedule_audit_sk, ${resourceCol} AS resource_id,`,
						`  e.academic_year_start, e.semester_sort, e.schedule_day AS day,`,
						`  e.schedule_start_time AS start_time, e.schedule_end_time AS end_time`,
						`FROM enrollments e FORCE INDEX (${forceIndex})`,
						'INNER JOIN students s ON e.student_id = s.id',
						'INNER JOIN courses c ON e.course_id = c.id',
						'INNER JOIN lecturers l ON c.lecturer_id = l.id',
						'INNER JOIN class_rooms cr ON e.class_room_id = cr.id',
						`WHERE ${resourceCol} = ?`,
						'  AND e.academic_year_start = ?',
						'  AND e.semester_sort = ?',
						'  AND e.schedule_day = ?',
						'  AND e.schedule_start_time = ?',
						'  AND e.schedule_end_time = ?',
						memberOrderSql,
						`${memberLimitSql})`
					].join(' ')
				)
				.join(' UNION ALL ');

			const [memberRows] = await pool.query(memberSql, seedValues);
			addRows(memberRows as AuditScanRow[]);
		}
	}

	return seeds.map((seed) => ({
		...seed,
		memberRows: rowsBySeedKey.get(seedKey(seed)) ?? []
	}));
}

async function filterSeedsByFocus(
	pool: Pool,
	seeds: ConflictAuditGroupSeed[],
	focusSet: Set<string>
) {
	if (!focusSet.size || !seeds.length) return seeds;

	const focusIds = [...focusSet];
	const FOCUS_BATCH = 1000;
	const focusedSeedKeys = new Set<string>();

	for (let i = 0; i < focusIds.length; i += FOCUS_BATCH) {
		const batch = focusIds.slice(i, i + FOCUS_BATCH);
		const [rows] = await pool.query(
			[
				'SELECT e.class_room_audit_sk, e.student_audit_sk, e.lecturer_audit_sk,',
				'e.academic_year_start, e.semester_sort, e.schedule_day AS day,',
				'e.schedule_start_time AS start_time, e.schedule_end_time AS end_time',
				'FROM enrollments e',
				'WHERE e.id IN (?)'
			].join(' '),
			[batch]
		);

		for (const row of rows as Array<{
			class_room_audit_sk: number;
			student_audit_sk: number;
			lecturer_audit_sk: number;
			academic_year_start: number;
			semester_sort: number;
			day: ConflictAuditMember['day'];
			start_time: string;
			end_time: string;
		}>) {
			const base = {
				academicYearStart: row.academic_year_start,
				semesterSort: row.semester_sort,
				day: row.day,
				startTime: row.start_time,
				endTime: row.end_time
			};
			focusedSeedKeys.add(
				`room:${seedKey({ ...base, resourceId: String(row.class_room_audit_sk) })}`
			);
			focusedSeedKeys.add(
				`student:${seedKey({ ...base, resourceId: String(row.student_audit_sk) })}`
			);
			focusedSeedKeys.add(
				`lecturer:${seedKey({ ...base, resourceId: String(row.lecturer_audit_sk) })}`
			);
		}
	}

	return seeds.filter((seed) => focusedSeedKeys.has(`${seed.conflictType}:${seedKey(seed)}`));
}

function sampleGroupMembers(
	group: ConflictAuditGroupSeed,
	focusSet: Set<string>,
	memberSampleSize: number | null = DEFAULT_HYDRATED_MEMBERS_PER_GROUP
) {
	if (memberSampleSize == null) return group.memberRows;
	if (group.memberRows.length <= memberSampleSize) return group.memberRows;

	const selected = new Map<string, AuditScanRow>();
	for (const row of group.memberRows) {
		if (focusSet.has(row.enrollment_id)) {
			selected.set(row.enrollment_id, row);
		}
	}

	for (const row of group.memberRows) {
		if (selected.size >= memberSampleSize) break;
		selected.set(row.enrollment_id, row);
	}

	return [...selected.values()];
}

function hydrateConflictGroupSeeds(
	groups: ConflictAuditGroupSeed[],
	focusSet = new Set<string>(),
	memberSampleSize: number | null = DEFAULT_HYDRATED_MEMBERS_PER_GROUP
) {
	if (!groups.length) return [] as ConflictAuditGroup[];

	const sampledRowsByGroup = groups.map((group) =>
		sampleGroupMembers(group, focusSet, memberSampleSize)
	);

	return groups.map((group, index) => {
		const members = sampledRowsByGroup[index]
			.filter((row): row is AuditScanRow & HydratedMemberRow => Boolean(row.student_id))
			.map(mapHydratedMember)
			.sort((left, right) => timeToSeconds(left.startTime) - timeToSeconds(right.startTime));
		const firstMember = members[0];
		const resourceName =
			group.conflictType === 'room'
				? (firstMember?.classRoomName ?? group.resourceId)
				: group.conflictType === 'student'
					? (firstMember?.studentName ?? group.resourceId)
					: (firstMember?.lecturerName ?? group.resourceId);

		return {
			conflictType: group.conflictType,
			resourceId: group.resourceId,
			resourceName,
			day: group.day,
			memberCount: group.memberCount,
			members
		} satisfies ConflictAuditGroup;
	});
}

async function computeAudit(pool: Pool, filters: ConflictAuditFilters) {
	const selectedTypes = filters.conflictType
		? [filters.conflictType]
		: (['room', 'student', 'lecturer'] as ConflictAuditType[]);

	// Run seed collection sequentially, not in parallel.
	// Three concurrent full-table GROUP BY queries with FORCE INDEX on 2.7M rows
	// will overwhelm the database. Sequential execution keeps only one heavy
	// index scan active at a time.
	const seedResults: Array<{ type: ConflictAuditType; seeds: ConflictAuditGroupSeed[] }> = [];
	for (const type of selectedTypes) {
		seedResults.push({ type, seeds: await collectConflictGroupSeeds(pool, type, filters) });
	}

	const roomSeeds = seedResults.find((entry) => entry.type === 'room')?.seeds ?? [];
	const studentSeeds = seedResults.find((entry) => entry.type === 'student')?.seeds ?? [];
	const lecturerSeeds = seedResults.find((entry) => entry.type === 'lecturer')?.seeds ?? [];

	const allSeeds = [...roomSeeds, ...studentSeeds, ...lecturerSeeds].sort((left, right) => {
		if (right.memberCount !== left.memberCount) {
			return right.memberCount - left.memberCount;
		}
		return `${left.conflictType}:${left.resourceId}`.localeCompare(
			`${right.conflictType}:${right.resourceId}`
		);
	});

	const focusEnrollmentIds = filters.focusEnrollmentIds?.filter(Boolean) ?? [];
	const focusSet = new Set(focusEnrollmentIds);
	const memberSampleSize = getMemberSampleSize(filters);
	const relevantSeeds = focusSet.size
		? await filterSeedsByFocus(pool, allSeeds, focusSet)
		: allSeeds;

	const selectedSeedInputs = filters.limitGroups
		? relevantSeeds.slice(0, filters.limitGroups)
		: relevantSeeds;
	const selectedSeeds = await loadMemberRowsForSeeds(
		pool,
		selectedSeedInputs,
		focusSet,
		memberSampleSize
	);
	const groups = hydrateConflictGroupSeeds(selectedSeeds, focusSet, memberSampleSize);
	const conflictedEnrollments = relevantSeeds.reduce(
		(total, group) => total + group.memberCount,
		0
	);
	const roomGroupCount = relevantSeeds.filter((group) => group.conflictType === 'room').length;
	const studentGroupCount = relevantSeeds.filter(
		(group) => group.conflictType === 'student'
	).length;
	const lecturerGroupCount = relevantSeeds.filter(
		(group) => group.conflictType === 'lecturer'
	).length;

	// Count distinct resources with at least one conflict using the full seed list
	// (before hydration truncation), so these totals are always accurate.
	const conflictedRooms = new Set(
		relevantSeeds.filter((s) => s.conflictType === 'room').map((s) => s.resourceId)
	).size;
	const conflictedStudents = new Set(
		relevantSeeds.filter((s) => s.conflictType === 'student').map((s) => s.resourceId)
	).size;
	const conflictedLecturers = new Set(
		relevantSeeds.filter((s) => s.conflictType === 'lecturer').map((s) => s.resourceId)
	).size;

	// console.log(`relevantSeedsobj: ${JSON.stringify(relevantSeeds)}`);
	// console.log(`conflictedrooms: ${conflictedRooms}, conflictedStudents: ${conflictedStudents}, conflictedLecturers: ${conflictedLecturers}`);

	return {
		filters: {
			academicYear: filters.academicYear ?? null,
			semester: filters.semester ?? null,
			lecturerScope: filters.lecturerId ?? null
		},
		summary: {
			totalGroups: relevantSeeds.length,
			roomGroups: roomGroupCount,
			studentGroups: studentGroupCount,
			lecturerGroups: lecturerGroupCount,
			conflictedEnrollments,
			conflictedRooms,
			conflictedStudents,
			conflictedLecturers
		},
		truncated: relevantSeeds.length > selectedSeeds.length,
		groups
	} satisfies ConflictAuditResult;
}

function scheduleBackgroundRefresh(
	pool: Pool,
	filters: ConflictAuditFilters,
	cacheKey: string,
	version: number
) {
	if (inFlightAudits.has(cacheKey)) return;
	const promise = computeAudit(pool, filters)
		.then((result) => {
			if (version === auditCacheVersion) {
				setAuditCache(cacheKey, { version, storedAt: Date.now(), result });
			}
			return result;
		})
		.finally(() => {
			inFlightAudits.delete(cacheKey);
		});
	inFlightAudits.set(cacheKey, promise);
}

export async function auditEnrollmentConflicts(pool: Pool, filters: ConflictAuditFilters = {}) {
	const cacheKey = createAuditCacheKey(filters);
	const currentVersion = auditCacheVersion;
	const cached = auditCache.get(cacheKey);
	if (cached && cached.version === currentVersion) {
		if (Date.now() - cached.storedAt >= AUDIT_CACHE_TTL_MS) {
			scheduleBackgroundRefresh(pool, filters, cacheKey, currentVersion);
		}
		return cached.result;
	}

	const inFlight = inFlightAudits.get(cacheKey);
	if (inFlight) {
		return inFlight;
	}

	const promise = computeAudit(pool, filters)
		.then((result) => {
			if (currentVersion === auditCacheVersion) {
				setAuditCache(cacheKey, { version: currentVersion, storedAt: Date.now(), result });
			}
			return result;
		})
		.finally(() => {
			inFlightAudits.delete(cacheKey);
		});

	inFlightAudits.set(cacheKey, promise);
	return promise;
}
