import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error, invalid } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import {
	getListQueryLimit,
	getListQueryCursor,
	mergeLimitedListResult,
	getPool,
	toLimitedListResult,
	withTransaction
} from '$lib/server';
import { auditEnrollmentConflicts, invalidateConflictAuditCache } from '$lib/server/conflict-audit';
import { requireRole, requireUser } from '$lib/server/auth';
import {
	containsSearchPattern,
	prefixSearchPattern,
	wordPrefixSearchPattern
} from '$lib/server/search';
import { getTimeComponents, parseISO, formatDateTime } from '$lib/time-helpers';
import {
	selectClassRooms,
	selectCourses,
	selectEnrollments,
	selectLecturerScheduleConflict,
	selectSchedulesConflict,
	selectStudentScheduleConflict,
	selectStudents,
	insertSchedule,
	insertEnrollment,
	deleteSchedule,
	updateSchedule,
	updateEnrollment as updateEnrollmentDb,
	deleteEnrollment as deleteEnrollmentDb
} from '$lib/server/sql';
import { type SelectEnrollmentsResult, type SelectEnrollmentsWhere } from '$lib/server/sql';
import type { SelectSchedulesConflictResult } from '$lib/server/sql/select-schedules-conflict';
import type { SelectStudentScheduleConflictResult } from '$lib/server/sql/select-student-schedule-conflict';
import type { SelectLecturerScheduleConflictResult } from '$lib/server/sql/select-lecturer-schedule-conflict';
import { days, enrollmentSchema } from '$lib/validations/enrollment';
import { listPageEntries, listPageSchema } from '$lib/validations/pagination';

type ConflictNamedResult =
	| SelectStudentScheduleConflictResult
	| SelectLecturerScheduleConflictResult;

const enrollmentListSelect = {
	id: true,
	student_id: true,
	course_id: true,
	lecturer_id: true,
	class_room_id: true,
	semester: true,
	academic_year: true,
	student_name: true,
	course_name: true,
	lecturer_name: true,
	class_room_name: true,
	schedule_day: true,
	schedule_start_time: true,
	schedule_end_time: true
} as const;

const weekdayFromIndex = ['MINGGU', ...days] as const;

function scheduleWindowLabel(
	start: Date | null | undefined,
	end: Date | null | undefined,
	timezone: string
) {
	if (!start || !end) return 'jadwal lain di hari yang sama';
	return `${formatDateTime(start, 'time', timezone)} - ${formatDateTime(end, 'time', timezone)}`;
}

function summarizeConflictWindows(
	items: Array<{ start_time: Date | null | undefined; end_time: Date | null | undefined }>,
	timezone: string,
	limit = 3
) {
	const labels = items
		.slice(0, limit)
		.map((item) => scheduleWindowLabel(item.start_time, item.end_time, timezone));
	if (items.length <= limit) {
		return labels.join(', ');
	}
	return `${labels.join(', ')}, dan ${items.length - limit} jadwal lain`;
}

function summarizeNamedConflicts(items: ConflictNamedResult[], timezone: string, limit = 3) {
	const labels = items.slice(0, limit).map((item) => {
		const name = item.course_name ?? 'kelas lain';
		return `${name} (${scheduleWindowLabel(item.start_time, item.end_time, timezone)})`;
	});
	if (items.length <= limit) {
		return labels.join(', ');
	}
	return `${labels.join(', ')}, dan ${items.length - limit} jadwal lain`;
}

function validateScheduleWindow(
	data: { day: string; startTime: string; endTime: string; timezone?: string },
	issue: {
		day: (message: string) => Parameters<typeof invalid>[0];
		endTime: (message: string) => Parameters<typeof invalid>[0];
	}
) {
	const clientTimezone = data.timezone ?? 'UTC';
	const startDate = parseISO(data.startTime, clientTimezone);
	const endDate = parseISO(data.endTime, clientTimezone);
	const startDay =
		weekdayFromIndex[getTimeComponents(startDate, clientTimezone).dayOfWeek] ?? 'MINGGU';
	const endDay = weekdayFromIndex[getTimeComponents(endDate, clientTimezone).dayOfWeek] ?? 'MINGGU';

	if (startDay !== endDay) {
		invalid(issue.endTime('Waktu mulai dan selesai harus berada pada hari yang sama'));
	}

	if (data.day !== startDay) {
		invalid(issue.day(`Hari jadwal harus sesuai dengan tanggal yang dipilih (${startDay})`));
	}

	return { clientTimezone, startDate, endDate };
}

export const getEnrollments = query(listPageSchema, async (page) => {
	const user = await requireUser();
	const limit = getListQueryLimit(40);
	const afterId = getListQueryCursor(page?.cursor);
	return toLimitedListResult(
		await selectSchedulePreviewRows(user, afterId, limit),
		limit,
		(item) => item.id ?? null
	);
});

async function selectSchedulePreviewRows(
	user: Awaited<ReturnType<typeof requireUser>>,
	afterId: string | undefined,
	limit: number
) {
	const selectSql = [
		'SELECT e.id, e.student_id, e.course_id, c.lecturer_id, e.class_room_id, e.schedule_id,',
		'e.semester, e.academic_year, s.name AS student_name, c.name AS course_name,',
		'l.name AS lecturer_name, cr.name AS class_room_name,',
		'e.schedule_day, e.schedule_start_time, e.schedule_end_time'
	].join(' ');

	if (user.role === 'STUDENT') {
		const sql = [
			selectSql,
			'FROM enrollments e FORCE INDEX (idx_enrollments_student_id_id)',
			'INNER JOIN students s ON e.student_id = s.id',
			'INNER JOIN courses c ON e.course_id = c.id',
			'INNER JOIN lecturers l ON c.lecturer_id = l.id',
			'INNER JOIN class_rooms cr ON e.class_room_id = cr.id',
			`WHERE e.student_id = ?${afterId ? ' AND e.id > ?' : ''}`,
			'ORDER BY e.id ASC',
			'LIMIT ?'
		].join(' ');
		const values = afterId ? [user.studentId!, afterId, limit + 1] : [user.studentId!, limit + 1];
		const [rows] = await getPool().query(sql, values);
		return rows as SelectEnrollmentsResult[];
	}

	if (user.role === 'LECTURER') {
		const [courseRows] = await getPool().query('SELECT id FROM courses WHERE lecturer_id = ?', [
			user.lecturerId!
		]);
		const courseIds = (courseRows as Array<{ id: string }>).map((row) => row.id).filter(Boolean);
		if (!courseIds.length) return [];
		const sql = [
			selectSql,
			'FROM courses c',
			'INNER JOIN enrollments e FORCE INDEX (PRIMARY) ON e.course_id = c.id',
			'INNER JOIN students s ON e.student_id = s.id',
			'INNER JOIN lecturers l ON c.lecturer_id = l.id',
			'INNER JOIN class_rooms cr ON e.class_room_id = cr.id',
			`WHERE e.course_id IN (?)${afterId ? ' AND e.id > ?' : ''}`,
			'ORDER BY e.id ASC',
			'LIMIT ?'
		].join(' ');
		const values = afterId ? [courseIds, afterId, limit + 1] : [courseIds, limit + 1];
		const [rows] = await getPool().query(sql, values);
		return rows as SelectEnrollmentsResult[];
	}

	const sql = [
		selectSql,
		'FROM enrollments e FORCE INDEX (PRIMARY)',
		'INNER JOIN students s ON e.student_id = s.id',
		'INNER JOIN courses c ON e.course_id = c.id',
		'INNER JOIN lecturers l ON c.lecturer_id = l.id',
		'INNER JOIN class_rooms cr ON e.class_room_id = cr.id',
		afterId ? 'WHERE e.id > ?' : '',
		'ORDER BY e.id ASC',
		'LIMIT ?'
	]
		.filter(Boolean)
		.join(' ');
	const values = afterId ? [afterId, limit + 1] : [limit + 1];
	const [rows] = await getPool().query(sql, values);
	return rows as SelectEnrollmentsResult[];
}

export const getSchedulePreview = query(listPageSchema, async (page) => {
	const user = await requireUser();
	const limit = getListQueryLimit(120);
	const afterId = getListQueryCursor(page?.cursor);
	return toLimitedListResult(
		await selectSchedulePreviewRows(user, afterId, limit),
		limit,
		(item) => item.id ?? null
	);
});

const searchEnrollmentsSchema = v.object({
	...listPageEntries,
	preview: v.optional(v.boolean()),
	q: v.optional(v.string()),
	id: v.optional(v.string()),
	studentId: v.optional(v.string()),
	courseId: v.optional(v.string()),
	lecturerId: v.optional(v.string()),
	classRoomId: v.optional(v.string()),
	semester: v.optional(v.string()),
	academicYear: v.optional(v.string()),
	studentName: v.optional(v.string()),
	studyProgramName: v.optional(v.string()),
	courseName: v.optional(v.string()),
	lecturerName: v.optional(v.string()),
	classRoomName: v.optional(v.string()),
	scheduleDay: v.optional(v.picklist(['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'])),
	letterGrade: v.optional(v.string())
});

type EnrollmentSearchFilters = v.InferOutput<typeof searchEnrollmentsSchema>;
type EnrollmentPrefetchBase =
	| 'students'
	| 'courses'
	| 'lecturers'
	| 'classRooms'
	| 'enrollments'
	| 'schedules';
type EnrollmentPrefetchJoin =
	| 'students'
	| 'studyPrograms'
	| 'courses'
	| 'lecturers'
	| 'classRooms'
	| 'schedules'
	| 'grades';

async function hydrateEnrollmentsByIds(ids: string[]) {
	if (!ids.length) {
		return [];
	}

	const fullRows = await selectEnrollments(getPool(), {
		select: enrollmentListSelect,
		where: [['id', 'IN', ids]]
	});
	const rowsById = new Map(fullRows.map((row) => [row.id, row]));
	return ids
		.map((id) => rowsById.get(id))
		.filter((row): row is SelectEnrollmentsResult => Boolean(row));
}

async function prefetchEnrollmentSearchResults(
	base: EnrollmentPrefetchBase,
	predicateSql: string,
	predicateValues: unknown[],
	filters: EnrollmentSearchFilters,
	user: Awaited<ReturnType<typeof requireUser>>,
	limit: number,
	afterId?: string,
	options?: { forcePrimary?: boolean; requiredJoins?: EnrollmentPrefetchJoin[] }
) {
	const joinParts: string[] = [];
	const joined = {
		s: false,
		sp: false,
		c: false,
		l: false,
		cr: false,
		sch: false,
		g: false
	};

	if (base === 'students') {
		joinParts.push('FROM students s', 'INNER JOIN enrollments e ON e.student_id = s.id');
		joined.s = true;
	} else if (base === 'courses') {
		joinParts.push('FROM courses c', 'INNER JOIN enrollments e ON e.course_id = c.id');
		joined.c = true;
	} else if (base === 'lecturers') {
		joinParts.push(
			'FROM lecturers l',
			'INNER JOIN courses c ON c.lecturer_id = l.id',
			'INNER JOIN enrollments e ON e.course_id = c.id'
		);
		joined.l = true;
		joined.c = true;
	} else if (base === 'classRooms') {
		joinParts.push('FROM class_rooms cr', 'INNER JOIN enrollments e ON e.class_room_id = cr.id');
		joined.cr = true;
	} else if (base === 'schedules') {
		joinParts.push('FROM schedules sch', 'INNER JOIN enrollments e ON e.schedule_id = sch.id');
		joined.sch = true;
	} else {
		joinParts.push(
			options?.forcePrimary ? 'FROM enrollments e FORCE INDEX (PRIMARY)' : 'FROM enrollments e'
		);
	}

	const ensureStudents = () => {
		if (joined.s) return;
		joinParts.push('INNER JOIN students s ON e.student_id = s.id');
		joined.s = true;
	};
	const ensureStudyPrograms = () => {
		ensureStudents();
		if (joined.sp) return;
		joinParts.push('INNER JOIN study_programs sp ON s.study_program_id = sp.id');
		joined.sp = true;
	};
	const ensureCourses = () => {
		if (joined.c) return;
		joinParts.push('INNER JOIN courses c ON e.course_id = c.id');
		joined.c = true;
	};
	const ensureLecturers = () => {
		ensureCourses();
		if (joined.l) return;
		joinParts.push('INNER JOIN lecturers l ON c.lecturer_id = l.id');
		joined.l = true;
	};
	const ensureClassRooms = () => {
		if (joined.cr) return;
		joinParts.push('INNER JOIN class_rooms cr ON e.class_room_id = cr.id');
		joined.cr = true;
	};
	const ensureSchedules = () => {
		if (joined.sch) return;
		joinParts.push('INNER JOIN schedules sch ON e.schedule_id = sch.id');
		joined.sch = true;
	};
	const ensureGrades = () => {
		if (joined.g) return;
		joinParts.push('LEFT JOIN grades g ON e.id = g.enrollment_id');
		joined.g = true;
	};

	for (const join of options?.requiredJoins ?? []) {
		if (join === 'students') ensureStudents();
		if (join === 'studyPrograms') ensureStudyPrograms();
		if (join === 'courses') ensureCourses();
		if (join === 'lecturers') ensureLecturers();
		if (join === 'classRooms') ensureClassRooms();
		if (join === 'schedules') ensureSchedules();
		if (join === 'grades') ensureGrades();
	}

	const whereParts = [predicateSql];
	const values: unknown[] = [...predicateValues];

	if (user.role === 'STUDENT' && user.studentId) {
		whereParts.push('e.student_id = ?');
		values.push(user.studentId);
	} else if (user.role === 'LECTURER' && user.lecturerId) {
		ensureCourses();
		whereParts.push('c.lecturer_id = ?');
		values.push(user.lecturerId);
	}

	if (filters.id) {
		whereParts.push('e.id = ?');
		values.push(filters.id);
	}
	if (filters.studentId) {
		whereParts.push('e.student_id = ?');
		values.push(filters.studentId);
	}
	if (filters.courseId) {
		whereParts.push('e.course_id = ?');
		values.push(filters.courseId);
	}
	if (filters.lecturerId) {
		ensureCourses();
		whereParts.push('c.lecturer_id = ?');
		values.push(filters.lecturerId);
	}
	if (filters.classRoomId) {
		whereParts.push('e.class_room_id = ?');
		values.push(filters.classRoomId);
	}
	if (filters.semester) {
		whereParts.push('e.semester LIKE ?');
		values.push(containsSearchPattern(filters.semester)!);
	}
	if (filters.academicYear) {
		whereParts.push('e.academic_year LIKE ?');
		values.push(containsSearchPattern(filters.academicYear)!);
	}
	if (filters.studentName) {
		ensureStudents();
		whereParts.push('s.name LIKE ?');
		values.push(containsSearchPattern(filters.studentName)!);
	}
	if (filters.studyProgramName) {
		ensureStudyPrograms();
		whereParts.push('sp.name LIKE ?');
		values.push(containsSearchPattern(filters.studyProgramName)!);
	}
	if (filters.courseName) {
		ensureCourses();
		whereParts.push('c.name LIKE ?');
		values.push(containsSearchPattern(filters.courseName)!);
	}
	if (filters.lecturerName) {
		ensureLecturers();
		whereParts.push('l.name LIKE ?');
		values.push(containsSearchPattern(filters.lecturerName)!);
	}
	if (filters.classRoomName) {
		ensureClassRooms();
		whereParts.push('cr.name LIKE ?');
		values.push(containsSearchPattern(filters.classRoomName)!);
	}
	if (filters.scheduleDay) {
		whereParts.push('e.schedule_day = ?');
		values.push(filters.scheduleDay);
	}
	if (filters.letterGrade) {
		ensureGrades();
		whereParts.push('g.letter_grade = ?');
		values.push(filters.letterGrade);
	}
	if (afterId) {
		whereParts.push('e.id > ?');
		values.push(afterId);
	}

	const sqlParts = [
		'SELECT STRAIGHT_JOIN e.id',
		...joinParts,
		`WHERE ${whereParts.join(' AND ')}`,
		'ORDER BY e.id ASC',
		'LIMIT ?'
	];
	values.push(limit + 1);

	const [rows] = await getPool().query(sqlParts.join(' '), values);
	const ids = (rows as Array<{ id: string }>).map((row) => row.id).filter(Boolean);
	return hydrateEnrollmentsByIds(ids);
}

export const searchEnrollments = query(searchEnrollmentsSchema, async (filters) => {
	const user = await requireUser();
	const where: SelectEnrollmentsWhere[] = [];
	if (user.role === 'STUDENT') {
		where.push(['student_id', '=', user.studentId!]);
	} else if (user.role === 'LECTURER') {
		where.push(['lecturer_id', '=', user.lecturerId!]);
	}
	if (filters.id) where.push(['id', '=', filters.id]);
	if (filters.studentId) where.push(['student_id', '=', filters.studentId]);
	if (filters.courseId) where.push(['course_id', '=', filters.courseId]);
	if (filters.lecturerId) where.push(['lecturer_id', '=', filters.lecturerId]);
	if (filters.classRoomId) where.push(['class_room_id', '=', filters.classRoomId]);
	if (filters.semester) where.push(['semester', 'LIKE', containsSearchPattern(filters.semester)!]);
	if (filters.academicYear)
		where.push(['academic_year', 'LIKE', containsSearchPattern(filters.academicYear)!]);
	if (filters.studentName)
		where.push(['student_name', 'LIKE', containsSearchPattern(filters.studentName)!]);
	if (filters.studyProgramName)
		where.push(['study_program_name', 'LIKE', containsSearchPattern(filters.studyProgramName)!]);
	if (filters.courseName)
		where.push(['course_name', 'LIKE', containsSearchPattern(filters.courseName)!]);
	if (filters.lecturerName)
		where.push(['lecturer_name', 'LIKE', containsSearchPattern(filters.lecturerName)!]);
	if (filters.classRoomName)
		where.push(['class_room_name', 'LIKE', containsSearchPattern(filters.classRoomName)!]);
	if (filters.scheduleDay) where.push(['schedule_day', '=', filters.scheduleDay]);
	if (filters.letterGrade) where.push(['letter_grade', '=', filters.letterGrade]);
	const limit = getListQueryLimit(filters.preview ? 60 : 40);
	const afterId = getListQueryCursor(filters.cursor);
	const q = filters.q?.trim();
	if (q) {
		const qPrefix = prefixSearchPattern(q)!;
		const qWordPrefix = wordPrefixSearchPattern(q)!;
		const queryLimit = limit + 1;
		const resultSets = await Promise.all([
			selectEnrollments(getPool(), {
				select: enrollmentListSelect,
				where: [...where, ['id', '=', q]],
				params: { afterId, limit: queryLimit }
			}),
			prefetchEnrollmentSearchResults(
				'students',
				'(s.name LIKE ? OR s.name LIKE ?)',
				[qPrefix, qWordPrefix],
				filters,
				user,
				limit,
				afterId
			),
			prefetchEnrollmentSearchResults(
				'courses',
				'(c.name LIKE ? OR c.name LIKE ?)',
				[qPrefix, qWordPrefix],
				filters,
				user,
				limit,
				afterId
			),
			prefetchEnrollmentSearchResults(
				'lecturers',
				'(l.name LIKE ? OR l.name LIKE ?)',
				[qPrefix, qWordPrefix],
				filters,
				user,
				limit,
				afterId
			),
			prefetchEnrollmentSearchResults(
				'enrollments',
				'(cr.name LIKE ? OR cr.name LIKE ?)',
				[qPrefix, qWordPrefix],
				filters,
				user,
				limit,
				afterId,
				{ forcePrimary: true, requiredJoins: ['classRooms'] }
			),
			prefetchEnrollmentSearchResults(
				'enrollments',
				'e.semester LIKE ?',
				[qPrefix],
				filters,
				user,
				limit,
				afterId
			),
			prefetchEnrollmentSearchResults(
				'enrollments',
				'e.academic_year LIKE ?',
				[qPrefix],
				filters,
				user,
				limit,
				afterId
			)
		]);
		const normalizedDay = q.toUpperCase();
		if (['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'].includes(normalizedDay)) {
			resultSets.push(
				await prefetchEnrollmentSearchResults(
					'enrollments',
					'e.schedule_day = ?',
					[normalizedDay as (typeof days)[number]],
					filters,
					user,
					limit,
					afterId,
					{ forcePrimary: true }
				)
			);
		}
		return mergeLimitedListResult(resultSets, limit, (item) => item.id ?? null);
	}
	if (filters.studentName) {
		return toLimitedListResult(
			await prefetchEnrollmentSearchResults(
				'enrollments',
				's.name LIKE ?',
				[containsSearchPattern(filters.studentName)!],
				filters,
				user,
				limit,
				afterId,
				{ forcePrimary: true, requiredJoins: ['students'] }
			),
			limit,
			(item) => item.id ?? null
		);
	}
	if (filters.studyProgramName) {
		return toLimitedListResult(
			await prefetchEnrollmentSearchResults(
				'enrollments',
				'sp.name LIKE ?',
				[containsSearchPattern(filters.studyProgramName)!],
				filters,
				user,
				limit,
				afterId,
				{ forcePrimary: true, requiredJoins: ['studyPrograms'] }
			),
			limit,
			(item) => item.id ?? null
		);
	}
	if (filters.courseName) {
		return toLimitedListResult(
			await prefetchEnrollmentSearchResults(
				'courses',
				'c.name LIKE ?',
				[containsSearchPattern(filters.courseName)!],
				filters,
				user,
				limit,
				afterId
			),
			limit,
			(item) => item.id ?? null
		);
	}
	if (filters.lecturerName) {
		return toLimitedListResult(
			await prefetchEnrollmentSearchResults(
				'lecturers',
				'l.name LIKE ?',
				[containsSearchPattern(filters.lecturerName)!],
				filters,
				user,
				limit,
				afterId
			),
			limit,
			(item) => item.id ?? null
		);
	}
	if (filters.classRoomName) {
		return toLimitedListResult(
			await prefetchEnrollmentSearchResults(
				'enrollments',
				'cr.name LIKE ?',
				[containsSearchPattern(filters.classRoomName)!],
				filters,
				user,
				limit,
				afterId,
				{ forcePrimary: true, requiredJoins: ['classRooms'] }
			),
			limit,
			(item) => item.id ?? null
		);
	}
	if (filters.scheduleDay) {
		return toLimitedListResult(
			await prefetchEnrollmentSearchResults(
				'enrollments',
				'e.schedule_day = ?',
				[filters.scheduleDay],
				filters,
				user,
				limit,
				afterId,
				{ forcePrimary: true }
			),
			limit,
			(item) => item.id ?? null
		);
	}
	if (filters.semester) {
		return toLimitedListResult(
			await prefetchEnrollmentSearchResults(
				'enrollments',
				'e.semester LIKE ?',
				[containsSearchPattern(filters.semester)!],
				filters,
				user,
				limit,
				afterId
			),
			limit,
			(item) => item.id ?? null
		);
	}
	if (filters.academicYear) {
		return toLimitedListResult(
			await prefetchEnrollmentSearchResults(
				'enrollments',
				'e.academic_year LIKE ?',
				[containsSearchPattern(filters.academicYear)!],
				filters,
				user,
				limit,
				afterId
			),
			limit,
			(item) => item.id ?? null
		);
	}
	return toLimitedListResult(
		await selectEnrollments(getPool(), {
			select: enrollmentListSelect,
			where,
			params: { afterId, limit: limit + 1 }
		}),
		limit,
		(item) => item.id ?? null
	);
});

export const getEnrollment = query(v.string(), async (id) => {
	const user = await requireUser();
	const [enrollment] = await selectEnrollments(getPool(), { where: [['id', '=', id]] });
	if (!enrollment) {
		throw error(404, 'Data KRS tidak ditemukan');
	}
	if (user.role === 'STUDENT' && enrollment.student_id !== user.studentId) {
		throw error(403, 'Anda tidak berhak melihat data KRS ini');
	}
	if (user.role === 'LECTURER' && enrollment.lecturer_id !== user.lecturerId) {
		throw error(403, 'Anda tidak berhak melihat data KRS ini');
	}
	return enrollment;
});

const conflictAuditSchema = v.object({
	conflictType: v.optional(v.picklist(['room', 'student', 'lecturer'])),
	academicYear: v.optional(v.string()),
	semester: v.optional(v.string()),
	day: v.optional(v.picklist(['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'])),
	courseId: v.optional(v.string()),
	classRoomId: v.optional(v.string()),
	lecturerId: v.optional(v.string()),
	enrollmentIds: v.optional(v.pipe(v.array(v.string()), v.maxLength(500))),
	limitGroups: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(1000)))
});

export const getEnrollmentConflictAudit = query(conflictAuditSchema, async (filters) => {
	const user = await requireRole(['ADMIN', 'LECTURER']);
	return auditEnrollmentConflicts(getPool(), {
		conflictType: filters.conflictType,
		academicYear: filters.academicYear,
		semester: filters.semester,
		day: filters.day,
		courseId: filters.courseId,
		classRoomId: filters.classRoomId,
		focusEnrollmentIds: filters.enrollmentIds,
		limitGroups: filters.limitGroups,
		lecturerId: user.role === 'LECTURER' ? (user.lecturerId ?? undefined) : filters.lecturerId
	});
});

export const createEnrollment = form(enrollmentSchema, async (data, issue) => {
	const user = await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	if (user.role === 'STUDENT' && data.studentId !== user.studentId) {
		throw error(403, 'Anda tidak berhak membuat KRS untuk mahasiswa lain');
	}

	const [[student], [course], [classRoom]] = await Promise.all([
		selectStudents(getPool(), { where: [['id', '=', data.studentId]] }),
		selectCourses(getPool(), { where: [['id', '=', data.courseId]] }),
		selectClassRooms(getPool(), { where: [['id', '=', data.classRoomId]] })
	]);

	if (!student) {
		invalid(issue.studentId('Mahasiswa tidak ditemukan'));
	}

	if (!course) {
		invalid(issue.courseId('Mata kuliah tidak ditemukan'));
	}
	if (!course.lecturer_id) {
		invalid(issue.courseId('Mata kuliah belum memiliki dosen pengampu'));
	}
	if (user.role === 'LECTURER' && course.lecturer_id !== user.lecturerId) {
		throw error(403, 'Anda hanya dapat mengelola jadwal untuk mata kuliah yang Anda ampu');
	}

	if (!classRoom) {
		invalid(issue.classRoomId('Ruang kelas tidak ditemukan'));
	}
	const { clientTimezone, startDate, endDate } = validateScheduleWindow(data, issue);

	if (endDate <= startDate) {
		invalid(issue.endTime('Waktu selesai harus lebih besar dari waktu mulai'));
	}

	const [roomConflicts, existingRows, studentConflicts, lecturerConflicts]: [
		SelectSchedulesConflictResult[],
		SelectEnrollmentsResult[],
		SelectStudentScheduleConflictResult[],
		SelectLecturerScheduleConflictResult[]
	] = await Promise.all([
		selectSchedulesConflict(getPool(), {
			classRoomId: data.classRoomId,
			day: data.day,
			startTime: startDate,
			endTime: endDate
		}),
		selectEnrollments(getPool(), {
			select: { id: true },
			where: [
				['student_id', '=', data.studentId],
				['course_id', '=', data.courseId],
				['semester', '=', data.semester]
			]
		}),
		selectStudentScheduleConflict(getPool(), {
			studentId: data.studentId,
			day: data.day,
			startTime: startDate,
			endTime: endDate
		}),
		selectLecturerScheduleConflict(getPool(), {
			lecturerId: course.lecturer_id,
			day: data.day,
			startTime: startDate,
			endTime: endDate
		})
	]);
	const [existing] = existingRows;

	if (roomConflicts.length) {
		invalid(
			issue.classRoomId(
				`Ruang kelas bentrok dengan ${roomConflicts.length} jadwal lain: ${summarizeConflictWindows(roomConflicts, clientTimezone)}`
			)
		);
	}

	if (studentConflicts.length) {
		invalid(
			issue.studentId(
				`Mahasiswa memiliki ${studentConflicts.length} jadwal bentrok: ${summarizeNamedConflicts(studentConflicts, clientTimezone)}`
			)
		);
	}

	if (lecturerConflicts.length) {
		invalid(
			issue.courseId(
				`Dosen memiliki ${lecturerConflicts.length} jadwal bentrok: ${summarizeNamedConflicts(lecturerConflicts, clientTimezone)}`
			)
		);
	}

	if (existing) {
		invalid(issue.courseId('Mahasiswa sudah terdaftar di mata kuliah ini pada semester yang sama'));
	}

	const scheduleId = randomUUID();
	const enrollmentId = randomUUID();
	await withTransaction(async (conn) => {
		await insertSchedule(conn, {
			id: scheduleId,
			class_room_id: data.classRoomId,
			day: data.day,
			start_time: startDate,
			end_time: endDate,
			lecturer_id: course.lecturer_id
		});

		await insertEnrollment(conn, {
			id: enrollmentId,
			student_id: data.studentId,
			course_id: data.courseId,
			class_room_id: data.classRoomId,
			schedule_id: scheduleId,
			semester: data.semester,
			academic_year: data.academicYear
		});
	});
	invalidateConflictAuditCache();

	await getEnrollments().refresh();
	return { success: true, enrollmentId: enrollmentId, scheduleId: scheduleId };
});

export const updateEnrollment = form(
	v.object({ id: v.string(), ...enrollmentSchema.entries }),
	async (data, issue) => {
		const user = await requireRole(['ADMIN', 'LECTURER']);
		const [enrollment] = await selectEnrollments(getPool(), { where: [['id', '=', data.id]] });
		if (!enrollment) {
			throw error(404, 'Data KRS tidak ditemukan');
		}
		if (user.role === 'LECTURER' && enrollment.lecturer_id !== user.lecturerId) {
			throw error(403, 'Anda hanya dapat mengubah jadwal untuk mata kuliah yang Anda ampu');
		}
		if (enrollment.grade_id) {
			throw error(400, 'Data KRS sudah memiliki nilai, tidak dapat diubah');
		}

		const [student] = await selectStudents(getPool(), { where: [['id', '=', data.studentId]] });
		if (!student) {
			invalid(issue.studentId('Mahasiswa tidak ditemukan'));
		}

		const [course] = await selectCourses(getPool(), { where: [['id', '=', data.courseId]] });
		if (!course) {
			invalid(issue.courseId('Mata kuliah tidak ditemukan'));
		}
		if (!course.lecturer_id) {
			invalid(issue.courseId('Mata kuliah belum memiliki dosen pengampu'));
		}
		if (user.role === 'LECTURER' && course.lecturer_id !== user.lecturerId) {
			throw error(403, 'Anda hanya dapat memindahkan jadwal dalam mata kuliah yang Anda ampu');
		}

		const [classRoom] = await selectClassRooms(getPool(), {
			where: [['id', '=', data.classRoomId]]
		});
		if (!classRoom) {
			invalid(issue.classRoomId('Ruang kelas tidak ditemukan'));
		}
		const { clientTimezone, startDate, endDate } = validateScheduleWindow(data, issue);

		if (endDate <= startDate) {
			invalid(issue.endTime('Waktu selesai harus lebih besar dari waktu mulai'));
		}

		const [roomConflicts, studentConflicts, lecturerConflicts, existingRows]: [
			SelectSchedulesConflictResult[],
			SelectStudentScheduleConflictResult[],
			SelectLecturerScheduleConflictResult[],
			SelectEnrollmentsResult[]
		] = await Promise.all([
			selectSchedulesConflict(getPool(), {
				classRoomId: data.classRoomId,
				day: data.day,
				startTime: startDate,
				endTime: endDate,
				excludeScheduleId: enrollment.schedule_id ?? undefined
			}),
			selectStudentScheduleConflict(getPool(), {
				studentId: data.studentId,
				day: data.day,
				startTime: startDate,
				endTime: endDate,
				excludeEnrollmentId: data.id
			}),
			selectLecturerScheduleConflict(getPool(), {
				lecturerId: course.lecturer_id,
				day: data.day,
				startTime: startDate,
				endTime: endDate,
				excludeScheduleId: enrollment.schedule_id ?? undefined
			}),
			selectEnrollments(getPool(), {
				select: { id: true },
				where: [
					['student_id', '=', data.studentId],
					['course_id', '=', data.courseId],
					['semester', '=', data.semester]
				]
			})
		]);
		const [existing] = existingRows;
		if (roomConflicts.length) {
			invalid(
				issue.classRoomId(
					`Ruang kelas bentrok dengan ${roomConflicts.length} jadwal lain: ${summarizeConflictWindows(roomConflicts, clientTimezone)}`
				)
			);
		}

		if (studentConflicts.length) {
			invalid(
				issue.studentId(
					`Mahasiswa memiliki ${studentConflicts.length} jadwal bentrok: ${summarizeNamedConflicts(studentConflicts, clientTimezone)}`
				)
			);
		}

		if (lecturerConflicts.length) {
			invalid(
				issue.courseId(
					`Dosen memiliki ${lecturerConflicts.length} jadwal bentrok: ${summarizeNamedConflicts(lecturerConflicts, clientTimezone)}`
				)
			);
		}

		if (existing && existing.id !== data.id) {
			invalid(
				issue.courseId('Mahasiswa sudah terdaftar di mata kuliah ini pada semester yang sama')
			);
		}
		await withTransaction(async (conn) => {
			await updateSchedule(
				conn,
				{
					class_room_id: data.classRoomId,
					day: data.day,
					start_time: startDate,
					end_time: endDate,
					lecturer_id: course.lecturer_id
				},
				{ id: enrollment.schedule_id! }
			);
			await updateEnrollmentDb(
				conn,
				{
					student_id: data.studentId,
					course_id: data.courseId,
					class_room_id: data.classRoomId,
					schedule_day: data.day,
					schedule_start_time: startDate,
					schedule_end_time: endDate,
					semester: data.semester,
					academic_year: data.academicYear
				},
				{ id: data.id }
			);
		});
		invalidateConflictAuditCache();
		await getEnrollments().refresh();
		return { success: true };
	}
);

export const deleteEnrollment = command(v.string(), async (id) => {
	const user = await requireRole(['ADMIN', 'LECTURER']);
	const [enrollment] = await selectEnrollments(getPool(), { where: [['id', '=', id]] });
	if (!enrollment) {
		throw error(404, 'Data KRS tidak ditemukan');
	}
	if (user.role === 'LECTURER' && enrollment.lecturer_id !== user.lecturerId) {
		throw error(403, 'Anda hanya dapat menghapus jadwal untuk mata kuliah yang Anda ampu');
	}
	await withTransaction(async (conn) => {
		await deleteEnrollmentDb(conn, { id });
		await deleteSchedule(conn, { id: enrollment.schedule_id! });
	});
	invalidateConflictAuditCache();
	await getEnrollments().refresh();
	return { success: true };
});
