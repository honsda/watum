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
	startTime: Date;
	endTime: Date;
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
	};
	truncated: boolean;
	groups: ConflictAuditGroup[];
};

type AuditScanRow = {
	enrollment_id: string;
	schedule_audit_sk: number;
	resource_id: number;
	academic_year_start: number;
	semester_sort: number;
	day: ConflictAuditMember['day'];
	start_time: Date;
	end_time: Date;
};

type ConflictAuditGroupSeed = {
	conflictType: ConflictAuditType;
	resourceId: string;
	day: ConflictAuditMember['day'];
	memberRows: AuditScanRow[];
};

const DAY_RANK: Record<ConflictAuditMember['day'], number> = {
	SENIN: 1,
	SELASA: 2,
	RABU: 3,
	KAMIS: 4,
	JUMAT: 5,
	SABTU: 6
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
	start_time: Date;
	end_time: Date;
};

type CacheEntry = {
	version: number;
	storedAt: number;
	result: ConflictAuditResult;
};

const AUDIT_CACHE_TTL_MS = 60_000;
const auditCache = new Map<string, CacheEntry>();
const inFlightAudits = new Map<string, Promise<ConflictAuditResult>>();
let auditCacheVersion = 0;

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
		limitGroups: filters.limitGroups ?? 200
	});
}

export function invalidateConflictAuditCache() {
	auditCacheVersion += 1;
	auditCache.clear();
}

function toMillis(value: Date | string) {
	return value instanceof Date ? value.getTime() : new Date(value).getTime();
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

function buildWhere(filters: ConflictAuditFilters, resourceKind: ConflictAuditType) {
	const whereParts = ['1 = 1'];
	const values: unknown[] = [];

	if (filters.academicYear) {
		whereParts.push('e.academic_year = ?');
		values.push(filters.academicYear);
	}
	if (filters.semester) {
		whereParts.push('e.semester = ?');
		values.push(filters.semester);
	}
	if (filters.courseId) {
		whereParts.push('e.course_id = ?');
		values.push(filters.courseId);
	}
	if (filters.classRoomId) {
		whereParts.push('e.class_room_id = ?');
		values.push(filters.classRoomId);
	}
	if (filters.day) {
		whereParts.push('e.schedule_day = ?');
		values.push(filters.day);
	}
	if (filters.lecturerId) {
		if (resourceKind === 'lecturer') {
			whereParts.push('c.lecturer_id = ?');
			values.push(filters.lecturerId);
		} else {
			whereParts.push('e.course_id IN (SELECT id FROM courses WHERE lecturer_id = ?)');
			values.push(filters.lecturerId);
		}
	}

	return { whereSql: whereParts.join(' AND '), values };
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

function finalizePartition(
	rows: AuditScanRow[],
	conflictType: ConflictAuditType,
	seeds: ConflictAuditGroupSeed[]
) {
	if (rows.length < 2) return;
	const sortedRows = [...rows].sort((left, right) => {
		const dayDiff = DAY_RANK[left.day] - DAY_RANK[right.day];
		if (dayDiff !== 0) return dayDiff;
		const startDiff = toMillis(left.start_time) - toMillis(right.start_time);
		if (startDiff !== 0) return startDiff;
		const endDiff = toMillis(left.end_time) - toMillis(right.end_time);
		if (endDiff !== 0) return endDiff;
		return left.enrollment_id.localeCompare(right.enrollment_id);
	});

	const parents = sortedRows.map((_row, index) => index);
	const ranks = sortedRows.map(() => 0);

	const find = (index: number): number => {
		if (parents[index] === index) return index;
		parents[index] = find(parents[index]);
		return parents[index];
	};

	const unite = (leftIndex: number, rightIndex: number) => {
		const leftRoot = find(leftIndex);
		const rightRoot = find(rightIndex);
		if (leftRoot === rightRoot) return;
		if ((ranks[leftRoot] ?? 0) < (ranks[rightRoot] ?? 0)) {
			parents[leftRoot] = rightRoot;
			return;
		}
		if ((ranks[leftRoot] ?? 0) > (ranks[rightRoot] ?? 0)) {
			parents[rightRoot] = leftRoot;
			return;
		}
		parents[rightRoot] = leftRoot;
		ranks[leftRoot] = (ranks[leftRoot] ?? 0) + 1;
	};

	let active: number[] = [];
	let activeDay: ConflictAuditMember['day'] | null = null;

	for (let index = 0; index < sortedRows.length; index += 1) {
		const row = sortedRows[index];
		const currentStart = toMillis(row.start_time);
		const currentEnd = toMillis(row.end_time);

		if (row.day !== activeDay) {
			activeDay = row.day;
			active = [];
		}

		active = active.filter(
			(activeIndex) => toMillis(sortedRows[activeIndex].end_time) > currentStart
		);

		for (const activeIndex of active) {
			const activeRow = sortedRows[activeIndex];
			if (
				toMillis(activeRow.start_time) < currentEnd &&
				toMillis(activeRow.end_time) > currentStart
			) {
				unite(activeIndex, index);
			}
		}

		active.push(index);
	}

	const groupsByRoot = new Map<number, AuditScanRow[]>();
	for (let index = 0; index < sortedRows.length; index += 1) {
		const root = find(index);
		const group = groupsByRoot.get(root) ?? [];
		group.push(sortedRows[index]);
		groupsByRoot.set(root, group);
	}

	for (const memberRows of groupsByRoot.values()) {
		if (memberRows.length < 2) continue;
		const [firstRow] = memberRows;
		if (!firstRow) continue;
		seeds.push({
			conflictType,
			resourceId: String(firstRow.resource_id),
			day: firstRow.day,
			memberRows
		});
	}
}

async function collectConflictGroupSeeds(
	pool: Pool,
	conflictType: ConflictAuditType,
	filters: ConflictAuditFilters
) {
	const { whereSql, values } = buildEnrollmentOnlyWhere(filters);

	const resourceCol =
		conflictType === 'room'
			? 'e.class_room_audit_sk'
			: conflictType === 'student'
				? 'e.student_audit_sk'
				: 'e.lecturer_audit_sk';

	const forceIndex =
		conflictType === 'room'
			? 'idx_enrollments_room_conflict'
			: conflictType === 'student'
				? 'idx_enrollments_student_conflict'
				: 'idx_enrollments_lecturer_conflict';

	// Fast index-only aggregation using denormalized schedule columns.
	// The covering index (idx_enrollments_*_conflict) lets MySQL satisfy
	// this query without touching the schedules table at all.
	// FORCE INDEX is required because MariaDB's optimizer incorrectly
	// chooses a full table scan + temp table + filesort on 10M+ rows
	// when HAVING COUNT(*) > 1 is present, even though the index covers
	// all GROUP BY columns.
	const groupSql = [
		`SELECT ${resourceCol} AS resource_id, e.academic_year_start, e.semester_sort,`,
		`  e.schedule_day AS day, e.schedule_start_time AS start_time, e.schedule_end_time AS end_time,`,
		`  COUNT(*) AS member_count`,
		`FROM enrollments e FORCE INDEX (${forceIndex})`,
		`WHERE ${whereSql}`,
		`GROUP BY ${resourceCol}, e.academic_year_start, e.semester_sort,`,
		`  e.schedule_day, e.schedule_start_time, e.schedule_end_time`,
		`HAVING COUNT(*) > 1`
	].join(' ');

	const [groupRows] = await pool.query(groupSql, values);
	const groups = groupRows as Array<{
		resource_id: number;
		academic_year_start: number;
		semester_sort: number;
		day: ConflictAuditMember['day'];
		start_time: Date;
		end_time: Date;
		member_count: number;
	}>;

	if (!groups.length) {
		return [] as ConflictAuditGroupSeed[];
	}

	// Fetch member rows for all conflict groups in one batched query.
	// Batch into chunks to avoid excessively long OR chains.
	const BATCH_SIZE = 500;
	const allMemberRows: AuditScanRow[] = [];

	for (let i = 0; i < groups.length; i += BATCH_SIZE) {
		const batch = groups.slice(i, i + BATCH_SIZE);
		const conditions = batch
			.map(
				() =>
					`(${resourceCol} = ? AND e.academic_year_start = ? AND e.semester_sort = ? AND e.schedule_day = ? AND e.schedule_start_time = ? AND e.schedule_end_time = ?)`
			)
			.join(' OR ');
		const memberValues = batch.flatMap((g) => [
			g.resource_id,
			g.academic_year_start,
			g.semester_sort,
			g.day,
			g.start_time,
			g.end_time
		]);

		const memberSql = [
			`SELECT e.id AS enrollment_id, e.schedule_audit_sk, ${resourceCol} AS resource_id,`,
			`  e.academic_year_start, e.semester_sort, e.schedule_day AS day,`,
			`  e.schedule_start_time AS start_time, e.schedule_end_time AS end_time`,
			`FROM enrollments e FORCE INDEX (${forceIndex})`,
			`WHERE ${conditions}`
		].join(' ');

		const [memberRows] = await pool.query(memberSql, memberValues);
		allMemberRows.push(...(memberRows as AuditScanRow[]));
	}

	// Group by partition and run finalizePartition (handles exact-match & overlap)
	const rowsByPartition = new Map<string, AuditScanRow[]>();
	for (const row of allMemberRows) {
		const partitionKey = `${row.resource_id}:${row.academic_year_start}:${row.semester_sort}`;
		const arr = rowsByPartition.get(partitionKey) ?? [];
		arr.push(row);
		rowsByPartition.set(partitionKey, arr);
	}

	const seeds: ConflictAuditGroupSeed[] = [];
	for (const partitionRows of rowsByPartition.values()) {
		finalizePartition(partitionRows, conflictType, seeds);
	}

	return seeds;
}

async function hydrateConflictGroupSeeds(pool: Pool, groups: ConflictAuditGroupSeed[]) {
	if (!groups.length) return [] as ConflictAuditGroup[];

	const enrollmentIds = [
		...new Set(groups.flatMap((group) => group.memberRows.map((row) => row.enrollment_id)))
	];
	const [rows] = await pool.query(
		[
			'SELECT e.id AS enrollment_id, e.schedule_id, e.student_id, s.name AS student_name,',
			'e.course_id, c.name AS course_name, c.lecturer_id, l.name AS lecturer_name,',
			'e.class_room_id, cr.name AS class_room_name, e.semester, e.academic_year,',
			'e.schedule_day AS day, e.schedule_start_time AS start_time, e.schedule_end_time AS end_time',
			'FROM enrollments e',
			'INNER JOIN students s ON e.student_id = s.id',
			'INNER JOIN courses c ON e.course_id = c.id',
			'INNER JOIN lecturers l ON c.lecturer_id = l.id',
			'INNER JOIN class_rooms cr ON e.class_room_id = cr.id',
			'WHERE e.id IN (?)'
		].join(' '),
		[enrollmentIds]
	);

	const hydratedByEnrollmentId = new Map(
		(rows as HydratedMemberRow[]).map((row) => [row.enrollment_id, row])
	);

	return groups.map((group) => {
		const members = group.memberRows
			.map((row) => hydratedByEnrollmentId.get(row.enrollment_id))
			.filter((row): row is HydratedMemberRow => Boolean(row))
			.map(mapHydratedMember)
			.sort((left, right) => toMillis(left.startTime) - toMillis(right.startTime));
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
			memberCount: group.memberRows.length,
			members
		} satisfies ConflictAuditGroup;
	});
}

async function computeAudit(pool: Pool, filters: ConflictAuditFilters) {
	const selectedTypes = filters.conflictType
		? [filters.conflictType]
		: (['room', 'student', 'lecturer'] as ConflictAuditType[]);

	const seedResults = await Promise.all(
		selectedTypes.map(async (type) => ({
			type,
			seeds: await collectConflictGroupSeeds(pool, type, filters)
		}))
	);

	const roomSeeds = seedResults.find((entry) => entry.type === 'room')?.seeds ?? [];
	const studentSeeds = seedResults.find((entry) => entry.type === 'student')?.seeds ?? [];
	const lecturerSeeds = seedResults.find((entry) => entry.type === 'lecturer')?.seeds ?? [];

	const allSeeds = [...roomSeeds, ...studentSeeds, ...lecturerSeeds].sort((left, right) => {
		if (right.memberRows.length !== left.memberRows.length) {
			return right.memberRows.length - left.memberRows.length;
		}
		return `${left.conflictType}:${left.resourceId}`.localeCompare(
			`${right.conflictType}:${right.resourceId}`
		);
	});

	const focusEnrollmentIds = filters.focusEnrollmentIds?.filter(Boolean) ?? [];
	const focusSet = new Set(focusEnrollmentIds);
	const relevantSeeds = focusSet.size
		? allSeeds.filter((group) =>
				group.memberRows.some((member) => focusSet.has(member.enrollment_id))
			)
		: allSeeds;

	const limitGroups = filters.limitGroups ?? 200;
	const selectedSeeds = relevantSeeds.slice(0, limitGroups);
	const groups = await hydrateConflictGroupSeeds(pool, selectedSeeds);
	const conflictedEnrollments = new Set(
		relevantSeeds.flatMap((group) => group.memberRows.map((member) => member.enrollment_id))
	);

	return {
		filters: {
			academicYear: filters.academicYear ?? null,
			semester: filters.semester ?? null,
			lecturerScope: filters.lecturerId ?? null
		},
		summary: {
			totalGroups: relevantSeeds.length,
			roomGroups: roomSeeds.length,
			studentGroups: studentSeeds.length,
			lecturerGroups: lecturerSeeds.length,
			conflictedEnrollments: conflictedEnrollments.size
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
				auditCache.set(cacheKey, { version, storedAt: Date.now(), result });
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
				auditCache.set(cacheKey, { version: currentVersion, storedAt: Date.now(), result });
			}
			return result;
		})
		.finally(() => {
			inFlightAudits.delete(cacheKey);
		});

	inFlightAudits.set(cacheKey, promise);
	return promise;
}
