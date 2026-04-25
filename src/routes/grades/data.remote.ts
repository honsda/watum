import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error, invalid } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { calculateGrade } from '$lib/validations/grade';
import {
	getListQueryLimit,
	getListQueryCursor,
	mergeLimitedListResult,
	getPool,
	toLimitedListResult,
	withTransaction
} from '$lib/server/db';
import { requireRole, requireUser } from '$lib/server/auth';
import {
	containsSearchPattern,
	fulltextSearchPattern,
	prefixSearchPattern,
	wordPrefixSearchPattern
} from '$lib/server/search';
import {
	selectGrades,
	selectEnrollments,
	insertGrade,
	updateGrade as updateGradeDb,
	deleteGrade as deleteGradeDb
} from '$lib/server/sql';
import { type SelectGradesResult, type SelectGradesWhere } from '$lib/server/sql';
import { gradeSchema } from '$lib/validations/grade';
import { listPageEntries, listPageSchema } from '$lib/validations/pagination';

const gradeListSelect = {
	id: true,
	enrollment_id: true,
	assignment_score: true,
	midterm_score: true,
	final_score: true,
	total_score: true,
	letter_grade: true,
	student_name: true,
	course_name: true
} as const;

async function selectGradeListRows(
	user: Awaited<ReturnType<typeof requireUser>>,
	afterId: string | undefined,
	limit: number
) {
	const selectSql = [
		'SELECT g.id, g.enrollment_id, g.assignment_score, g.midterm_score, g.final_score,',
		'g.total_score, g.letter_grade, s.name AS student_name, c.name AS course_name'
	].join(' ');

	if (user.role === 'STUDENT') {
		// Pre-query enrollment IDs to avoid scanning all 1.9M grades rows
		// and joining enrollments for every row.
		const [enrollmentRows] = await getPool().query(
			'SELECT id FROM enrollments WHERE student_id = ? ORDER BY id ASC',
			[user.studentId!]
		);
		const enrollmentIds = (enrollmentRows as Array<{ id: string }>).map((row) => row.id);
		if (!enrollmentIds.length) return [];
		const sql = [
			selectSql,
			'FROM grades g',
			'INNER JOIN enrollments e ON g.enrollment_id = e.id',
			'INNER JOIN students s ON e.student_id = s.id',
			'INNER JOIN courses c ON e.course_id = c.id',
			`WHERE g.enrollment_id IN (?)${afterId ? ' AND g.id > ?' : ''}`,
			'ORDER BY g.id ASC',
			'LIMIT ?'
		].join(' ');
		const values = afterId
			? [enrollmentIds, afterId, limit + 1]
			: [enrollmentIds, limit + 1];
		const [rows] = await getPool().query(sql, values);
		return rows as SelectGradesResult[];
	}

	if (user.role === 'LECTURER') {
		const [courseRows] = await getPool().query('SELECT id FROM courses WHERE lecturer_id = ?', [
			user.lecturerId!
		]);
		const courseIds = (courseRows as Array<{ id: string }>).map((row) => row.id).filter(Boolean);
		if (!courseIds.length) return [];
		const sql = [
			selectSql,
			'FROM grades g FORCE INDEX (PRIMARY)',
			'INNER JOIN enrollments e ON g.enrollment_id = e.id',
			'INNER JOIN students s ON e.student_id = s.id',
			'INNER JOIN courses c ON e.course_id = c.id',
			`WHERE e.course_id IN (?)${afterId ? ' AND g.id > ?' : ''}`,
			'ORDER BY g.id ASC',
			'LIMIT ?'
		].join(' ');
		const values = afterId ? [courseIds, afterId, limit + 1] : [courseIds, limit + 1];
		const [rows] = await getPool().query(sql, values);
		return rows as SelectGradesResult[];
	}

	const sql = [
		selectSql,
		'FROM grades g FORCE INDEX (PRIMARY)',
		'INNER JOIN enrollments e ON g.enrollment_id = e.id',
		'INNER JOIN students s ON e.student_id = s.id',
		'INNER JOIN courses c ON e.course_id = c.id',
		afterId ? 'WHERE g.id > ?' : '',
		'ORDER BY g.id ASC',
		'LIMIT ?'
	]
		.filter(Boolean)
		.join(' ');
	const values = afterId ? [afterId, limit + 1] : [limit + 1];
	const [rows] = await getPool().query(sql, values);
	return rows as SelectGradesResult[];
}

export const getGrades = query(listPageSchema, async (page) => {
	const user = await requireUser();
	const limit = getListQueryLimit(40);
	const afterId = getListQueryCursor(page?.cursor);
	return toLimitedListResult(
		await selectGradeListRows(user, afterId, limit),
		limit,
		(item) => item.id ?? null
	);
});

const searchGradesSchema = v.object({
	...listPageEntries,
	q: v.optional(v.string()),
	id: v.optional(v.string()),
	enrollmentId: v.optional(v.string()),
	studentId: v.optional(v.string()),
	studentName: v.optional(v.string()),
	studentEmail: v.optional(v.string()),
	studyProgramName: v.optional(v.string()),
	courseId: v.optional(v.string()),
	courseName: v.optional(v.string()),
	lecturerId: v.optional(v.string()),
	letterGrade: v.optional(v.string()),
	minTotalScore: v.optional(v.number()),
	maxTotalScore: v.optional(v.number())
});

type GradeSearchFilters = v.InferOutput<typeof searchGradesSchema>;
type GradePrefetchBase = 'grades' | 'students' | 'studyPrograms' | 'courses';
type GradePrefetchJoin = 'enrollments' | 'students' | 'studyPrograms' | 'courses';

function resolveOptimalGradeBase(filters: GradeSearchFilters): GradePrefetchBase {
	if (filters.studentId) return 'students';
	if (filters.courseId) return 'courses';
	if (filters.studentName) return 'students';
	if (filters.studyProgramName) return 'studyPrograms';
	if (filters.courseName) return 'courses';
	return 'grades';
}

async function prefetchGradeSearchResults(
	base: GradePrefetchBase,
	predicateSql: string,
	predicateValues: unknown[],
	filters: GradeSearchFilters,
	user: Awaited<ReturnType<typeof requireUser>>,
	limit: number,
	afterId?: string,
	forcePrimary = false,
	requiredJoins: GradePrefetchJoin[] = []
) {
	const joinParts: string[] = [];
	const whereParts = [predicateSql];
	const values: unknown[] = [...predicateValues];
	const joined = { e: false, s: false, sp: false, c: false };

	if (base === 'students') {
		joinParts.push('FROM students s', 'INNER JOIN enrollments e ON e.student_id = s.id');
		joined.s = true;
		joined.e = true;
	} else if (base === 'studyPrograms') {
		joinParts.push(
			'FROM study_programs sp',
			'INNER JOIN students s ON s.study_program_id = sp.id',
			'INNER JOIN enrollments e ON e.student_id = s.id'
		);
		joined.sp = true;
		joined.s = true;
		joined.e = true;
	} else if (base === 'courses') {
		joinParts.push('FROM courses c', 'INNER JOIN enrollments e ON e.course_id = c.id');
		joined.c = true;
		joined.e = true;
	} else {
		joinParts.push(forcePrimary ? 'FROM grades g FORCE INDEX (PRIMARY)' : 'FROM grades g');
	}

	const ensureEnrollments = () => {
		if (joined.e) return;
		joinParts.push('INNER JOIN enrollments e ON g.enrollment_id = e.id');
		joined.e = true;
	};
	const ensureStudents = () => {
		ensureEnrollments();
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
		ensureEnrollments();
		if (joined.c) return;
		joinParts.push('INNER JOIN courses c ON e.course_id = c.id');
		joined.c = true;
	};
	const ensureGrades = () => {
		if (base === 'grades') return;
		joinParts.push('INNER JOIN grades g ON g.enrollment_id = e.id');
	};

	for (const join of requiredJoins) {
		if (join === 'enrollments') ensureEnrollments();
		if (join === 'students') ensureStudents();
		if (join === 'studyPrograms') ensureStudyPrograms();
		if (join === 'courses') ensureCourses();
	}

	if (base !== 'grades') {
		ensureGrades();
	}

	if (user.role === 'LECTURER' && user.lecturerId) {
		const [courseRows] = await getPool().query('SELECT id FROM courses WHERE lecturer_id = ?', [
			user.lecturerId
		]);
		const courseIds = (courseRows as Array<{ id: string }>).map((row) => row.id);
		if (!courseIds.length) return [];
		ensureEnrollments();
		whereParts.push('e.course_id IN (?)');
		values.push(courseIds);
	} else if (user.role === 'STUDENT' && user.studentId) {
		ensureEnrollments();
		whereParts.push('e.student_id = ?');
		values.push(user.studentId);
	}

	if (filters.id) {
		whereParts.push('g.id = ?');
		values.push(filters.id);
	}
	if (filters.enrollmentId) {
		whereParts.push('g.enrollment_id = ?');
		values.push(filters.enrollmentId);
	}
	if (filters.studentId) {
		ensureEnrollments();
		whereParts.push('e.student_id = ?');
		values.push(filters.studentId);
	}
	if (filters.studentName) {
		ensureStudents();
		whereParts.push('MATCH(s.name) AGAINST(? IN BOOLEAN MODE)');
		values.push(fulltextSearchPattern(filters.studentName)!);
	}
	if (filters.studentEmail) {
		ensureStudents();
		whereParts.push('s.email LIKE ?');
		values.push(containsSearchPattern(filters.studentEmail)!);
	}
	if (filters.studyProgramName) {
		ensureStudyPrograms();
		whereParts.push('MATCH(sp.name) AGAINST(? IN BOOLEAN MODE)');
		values.push(fulltextSearchPattern(filters.studyProgramName)!);
	}
	if (filters.courseId) {
		ensureEnrollments();
		whereParts.push('e.course_id = ?');
		values.push(filters.courseId);
	}
	if (filters.courseName) {
		ensureCourses();
		whereParts.push('MATCH(c.name) AGAINST(? IN BOOLEAN MODE)');
		values.push(fulltextSearchPattern(filters.courseName)!);
	}
	if (filters.lecturerId) {
		const [courseRows] = await getPool().query('SELECT id FROM courses WHERE lecturer_id = ?', [
			filters.lecturerId
		]);
		const courseIds = (courseRows as Array<{ id: string }>).map((row) => row.id);
		if (!courseIds.length) return [];
		ensureEnrollments();
		whereParts.push('e.course_id IN (?)');
		values.push(courseIds);
	}
	if (filters.letterGrade) {
		whereParts.push('g.letter_grade = ?');
		values.push(filters.letterGrade);
	}
	if (filters.minTotalScore != null) {
		whereParts.push('g.total_score >= ?');
		values.push(filters.minTotalScore);
	}
	if (filters.maxTotalScore != null) {
		whereParts.push('g.total_score <= ?');
		values.push(filters.maxTotalScore);
	}
	if (afterId) {
		whereParts.push('g.id > ?');
		values.push(afterId);
	}

	const sqlParts = [
		'SELECT STRAIGHT_JOIN g.id',
		...joinParts,
		`WHERE ${whereParts.join(' AND ')}`,
		'ORDER BY g.id ASC',
		'LIMIT ?'
	];
	values.push(limit + 1);

	const [rows] = await getPool().query(sqlParts.join(' '), values);
	const ids = (rows as Array<{ id: string }>).map((row) => row.id).filter(Boolean);
	return hydrateGradesByIds(ids);
}

export const searchGrades = query(searchGradesSchema, async (filters) => {
	const user = await requireUser();
	const where: SelectGradesWhere[] = [];
	if (user.role === 'LECTURER') {
		where.push(['lecturer_id', '=', user.lecturerId!]);
	} else if (user.role === 'STUDENT') {
		where.push(['student_id', '=', user.studentId!]);
	}
	if (filters.id) where.push(['id', '=', filters.id]);
	if (filters.enrollmentId) where.push(['enrollment_id', '=', filters.enrollmentId]);
	if (filters.studentId) where.push(['student_id', '=', filters.studentId]);
	if (filters.studentName)
		where.push(['student_name', 'FULLTEXT', fulltextSearchPattern(filters.studentName)!]);
	if (filters.studentEmail)
		where.push(['student_email', 'LIKE', containsSearchPattern(filters.studentEmail)!]);
	if (filters.studyProgramName)
		where.push(['study_program_name', 'FULLTEXT', fulltextSearchPattern(filters.studyProgramName)!]);
	if (filters.courseId) where.push(['course_id', '=', filters.courseId]);
	if (filters.courseName)
		where.push(['course_name', 'FULLTEXT', fulltextSearchPattern(filters.courseName)!]);
	const limit = getListQueryLimit(40);
	if (filters.lecturerId) {
		const [courseRows] = await getPool().query('SELECT id FROM courses WHERE lecturer_id = ?', [
			filters.lecturerId
		]);
		const courseIds = (courseRows as Array<{ id: string }>).map((row) => row.id);
		if (!courseIds.length) {
			return toLimitedListResult([], limit, (item) => item.id ?? null);
		}
		if (courseIds.length === 1) {
			where.push(['course_id', '=', courseIds[0]!]);
		} else {
			where.push(['course_id', 'IN', courseIds]);
		}
	}
	if (filters.letterGrade) where.push(['letter_grade', '=', filters.letterGrade]);
	if (filters.minTotalScore != null && filters.maxTotalScore != null) {
		where.push(['total_score', 'BETWEEN', filters.minTotalScore, filters.maxTotalScore]);
	} else if (filters.minTotalScore != null) {
		where.push(['total_score', '>=', filters.minTotalScore]);
	} else if (filters.maxTotalScore != null) {
		where.push(['total_score', '<=', filters.maxTotalScore]);
	}
	const afterId = getListQueryCursor(filters.cursor);
	const q = filters.q?.trim();
	if (q) {
		const qPrefix = prefixSearchPattern(q)!;
		const qWordPrefix = wordPrefixSearchPattern(q)!;
		const queryLimit = limit + 1;
		const resultSets = await Promise.all([
			selectGrades(getPool(), {
				select: gradeListSelect,
				where: [...where, ['id', '=', q]],
				params: { afterId, limit: queryLimit }
			}),
			prefetchGradeSearchResults(
				'grades',
				'(MATCH(s.name) AGAINST(? IN BOOLEAN MODE) OR MATCH(s.name) AGAINST(? IN BOOLEAN MODE))',
				[qPrefix, qWordPrefix],
				filters,
				user,
				limit,
				afterId,
				true,
				['students']
			),
			prefetchGradeSearchResults(
				'courses',
				'(MATCH(c.name) AGAINST(? IN BOOLEAN MODE) OR MATCH(c.name) AGAINST(? IN BOOLEAN MODE))',
				[qPrefix, qWordPrefix],
				filters,
				user,
				limit,
				afterId
			),
			prefetchGradeSearchResults(
				'students',
				's.email LIKE ?',
				[qPrefix],
				filters,
				user,
				limit,
				afterId
			),
			selectGrades(getPool(), {
				select: gradeListSelect,
				where: [...where, ['letter_grade', '=', q]],
				params: { afterId, limit: queryLimit }
			})
		]);
		return mergeLimitedListResult(resultSets, limit, (item) => item.id ?? null);
	}
	if (filters.studentEmail) {
		return toLimitedListResult(
			await prefetchGradeSearchResults(
				'grades',
				's.email LIKE ?',
				[containsSearchPattern(filters.studentEmail)!],
				filters,
				user,
				limit,
				afterId,
				true,
				['students']
			),
			limit,
			(item) => item.id ?? null
		);
	}
	// Multi-filter search: pick the most selective dimension as the driving table.
	const base = resolveOptimalGradeBase(filters);

	let predicateSql = '1 = 1';
	const predicateValues: unknown[] = [];

	if (base === 'students' && filters.studentName) {
		predicateSql = 'MATCH(s.name) AGAINST(? IN BOOLEAN MODE)';
		predicateValues.push(fulltextSearchPattern(filters.studentName)!);
	} else if (base === 'studyPrograms' && filters.studyProgramName) {
		predicateSql = 'MATCH(sp.name) AGAINST(? IN BOOLEAN MODE)';
		predicateValues.push(fulltextSearchPattern(filters.studyProgramName)!);
	} else if (base === 'courses' && filters.courseName) {
		predicateSql = 'MATCH(c.name) AGAINST(? IN BOOLEAN MODE)';
		predicateValues.push(fulltextSearchPattern(filters.courseName)!);
	}

	return toLimitedListResult(
		await prefetchGradeSearchResults(
			base,
			predicateSql,
			predicateValues,
			filters,
			user,
			limit,
			afterId,
			base === 'grades'
		),
		limit,
		(item) => item.id ?? null
	);
});

export const getGrade = query(v.string(), async (id) => {
	const user = await requireUser();
	const [grade] = await selectGrades(getPool(), { where: [['id', '=', id]] });
	if (!grade) throw error(404, 'Nilai tidak ditemukan');
	if (user.role === 'STUDENT' && grade.student_id !== user.studentId) {
		throw error(403, 'Anda tidak berhak melihat nilai ini');
	}
	if (user.role === 'LECTURER' && grade.lecturer_id !== user.lecturerId) {
		throw error(403, 'Anda tidak berhak melihat nilai ini');
	}
	return grade;
});

export const getGradesByCourse = query(v.string(), async (courseId) => {
	await requireRole(['ADMIN', 'LECTURER']);
	const limit = getListQueryLimit();
	return toLimitedListResult(
		await selectGrades(getPool(), {
			where: [['course_id', '=', courseId]],
			params: { limit: limit + 1 }
		}),
		limit,
		(item) => item.id ?? null
	);
});

export const getGradesByStudent = query(v.string(), async (studentId) => {
	const user = await requireUser();
	if (user.role === 'STUDENT' && user.studentId !== studentId) {
		throw error(403, 'Anda tidak berhak melihat nilai mahasiswa lain');
	}
	const limit = getListQueryLimit();
	return toLimitedListResult(
		await selectGrades(getPool(), {
			where: [['student_id', '=', studentId]],
			params: { limit: limit + 1 }
		}),
		limit,
		(item) => item.id ?? null
	);
});

export const createGrade = form(gradeSchema, async (data, issue) => {
	const user = await requireRole(['LECTURER', 'ADMIN']);

	const [[enrollment], [existing]] = await Promise.all([
		selectEnrollments(getPool(), {
			where: [['id', '=', data.enrollmentId]]
		}),
		selectGrades(getPool(), {
			where: [['enrollment_id', '=', data.enrollmentId]]
		})
	]);

	if (!enrollment) {
		throw error(404, 'Data KRS tidak ditemukan');
	}

	if (user.role === 'LECTURER' && enrollment.lecturer_id !== user.lecturerId) {
		throw error(403, 'Anda tidak berhak menginput nilai untuk mata kuliah ini');
	}

	if (existing) invalid(issue.enrollmentId('Nilai untuk KRS ini sudah ada'));

	const { total, letter } = calculateGrade(
		data.assignmentScore,
		data.midtermScore,
		data.finalScore
	);
	const id = randomUUID();
	await insertGrade(getPool(), {
		id,
		enrollment_id: data.enrollmentId,
		assignment_score: data.assignmentScore,
		midterm_score: data.midtermScore,
		final_score: data.finalScore,
		total_score: total,
		letter_grade: letter
	});
	await getGrades().refresh();
	return { success: true, id };
});

export const updateGrade = form(
	v.object({ id: v.string(), ...gradeSchema.entries }),
	async (data) => {
		const user = await requireRole(['LECTURER', 'ADMIN']);

		const [existingGrade] = await selectGrades(getPool(), {
			where: [['id', '=', data.id]]
		});
		if (!existingGrade || !existingGrade.enrollment_id) {
			throw error(404, 'Nilai tidak ditemukan');
		}

		const [enrollment] = await selectEnrollments(getPool(), {
			where: [['id', '=', existingGrade.enrollment_id]]
		});

		if (user.role === 'LECTURER' && enrollment?.lecturer_id !== user.lecturerId) {
			throw error(403, 'Anda tidak berhak mengubah nilai ini');
		}

		const { id, ...scores } = data;
		const { total, letter } = calculateGrade(
			scores.assignmentScore,
			scores.midtermScore,
			scores.finalScore
		);
		await updateGradeDb(
			getPool(),
			{
				assignment_score: scores.assignmentScore,
				midterm_score: scores.midtermScore,
				final_score: scores.finalScore,
				total_score: total,
				letter_grade: letter
			},
			{ id }
		);
		await getGrades().refresh();
		return { success: true };
	}
);

export const batchInputGrades = form(
	v.object({
		grades: v.array(v.object(gradeSchema.entries))
	}),
	async (data) => {
		const user = await requireRole(['LECTURER', 'ADMIN']);

		await withTransaction(async (conn) => {
			for (const g of data.grades) {
				const [enrollment] = await selectEnrollments(conn, {
					where: [['id', '=', g.enrollmentId]]
				});

				if (!enrollment) {
					throw error(404, `Data KRS dengan ID ${g.enrollmentId} tidak ditemukan`);
				}
				if (user.role === 'LECTURER' && enrollment.lecturer_id !== user.lecturerId) {
					throw error(403, `Anda tidak berhak menginput nilai untuk enrollment ${g.enrollmentId}`);
				}

				const { total, letter } = calculateGrade(g.assignmentScore, g.midtermScore, g.finalScore);
				const [existing] = await selectGrades(conn, {
					where: [['enrollment_id', '=', g.enrollmentId]]
				});
				if (existing && existing.id) {
					await updateGradeDb(
						conn,
						{
							assignment_score: g.assignmentScore,
							midterm_score: g.midtermScore,
							final_score: g.finalScore,
							total_score: total,
							letter_grade: letter
						},
						{ id: existing.id }
					);
				} else {
					await insertGrade(conn, {
						id: randomUUID(),
						enrollment_id: g.enrollmentId,
						assignment_score: g.assignmentScore,
						midterm_score: g.midtermScore,
						final_score: g.finalScore,
						total_score: total,
						letter_grade: letter
					});
				}
			}
		});
		await getGrades().refresh();
		return { success: true, count: data.grades.length };
	}
);

export const deleteGrade = command(v.string(), async (id) => {
	const user = await requireRole(['LECTURER', 'ADMIN']);

	const [existingGrade] = await selectGrades(getPool(), {
		where: [['id', '=', id]]
	});
	if (!existingGrade || !existingGrade.enrollment_id) {
		throw error(404, 'Nilai tidak ditemukan');
	}

	const [enrollment] = await selectEnrollments(getPool(), {
		where: [['id', '=', existingGrade.enrollment_id]]
	});

	if (user.role === 'LECTURER' && enrollment?.lecturer_id !== user.lecturerId) {
		throw error(403, 'Anda tidak berhak menghapus nilai ini');
	}

	await deleteGradeDb(getPool(), { id });
	await getGrades().refresh();
	return { success: true };
});
