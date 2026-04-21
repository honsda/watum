import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error, invalid } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { calculateGrade } from '$lib/validations/grade';
import { getPool, withTransaction } from '$lib/server/db';
import { requireRole, requireUser } from '$lib/server/auth';
import {
	selectGrades,
	selectEnrollments,
	insertGrade,
	updateGrade as updateGradeDb,
	deleteGrade as deleteGradeDb
} from '$lib/server/sql';
import { type SelectGradesWhere } from '$lib/server/sql';
import { gradeSchema } from '$lib/validations/grade';

export const getGrades = query(async () => {
	const user = await requireUser();
	const allGrades = await selectGrades(getPool());
	if (user.role === 'LECTURER') {
		return allGrades.filter((g) => g.lecturer_id === user.lecturerId);
	}
	if (user.role === 'STUDENT') {
		return allGrades.filter((g) => g.student_id === user.studentId);
	}
	return allGrades;
});

const searchGradesSchema = v.object({
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
	if (filters.studentName) where.push(['student_name', 'LIKE', filters.studentName]);
	if (filters.studentEmail) where.push(['student_email', 'LIKE', filters.studentEmail]);
	if (filters.studyProgramName)
		where.push(['study_program_name', 'LIKE', filters.studyProgramName]);
	if (filters.courseId) where.push(['course_id', '=', filters.courseId]);
	if (filters.courseName) where.push(['course_name', 'LIKE', filters.courseName]);
	if (filters.lecturerId) where.push(['lecturer_id', '=', filters.lecturerId]);
	if (filters.letterGrade) where.push(['letter_grade', '=', filters.letterGrade]);
	if (filters.minTotalScore != null && filters.maxTotalScore != null) {
		where.push(['total_score', 'BETWEEN', filters.minTotalScore, filters.maxTotalScore]);
	} else if (filters.minTotalScore != null) {
		where.push(['total_score', '>=', filters.minTotalScore]);
	} else if (filters.maxTotalScore != null) {
		where.push(['total_score', '<=', filters.maxTotalScore]);
	}
	return selectGrades(getPool(), { where });
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
	return await selectGrades(getPool(), { where: [['course_id', '=', courseId]] });
});

export const getGradesByStudent = query(v.string(), async (studentId) => {
	const user = await requireUser();
	if (user.role === 'STUDENT' && user.studentId !== studentId) {
		throw error(403, 'Anda tidak berhak melihat nilai mahasiswa lain');
	}
	return await selectGrades(getPool(), { where: [['student_id', '=', studentId]] });
});

export const createGrade = form(gradeSchema, async (data, issue) => {
	const user = await requireRole(['LECTURER', 'ADMIN']);

	const [enrollment] = await selectEnrollments(getPool(), {
		where: [['id', '=', data.enrollmentId]]
	});
	if (!enrollment) {
		throw error(404, 'Data KRS tidak ditemukan');
	}

	if (user.role === 'LECTURER' && enrollment.lecturer_id !== user.lecturerId) {
		throw error(403, 'Anda tidak berhak menginput nilai untuk mata kuliah ini');
	}

	const [existing] = await selectGrades(getPool(), {
		where: [['enrollment_id', '=', data.enrollmentId]]
	});
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
