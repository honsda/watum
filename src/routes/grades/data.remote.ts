import * as v from 'valibot';
import { query, form} from '$app/server';
import { error, invalid } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { calculateGrade } from '$lib/validations/grade';
import { getPool } from '$lib/server/db';
import { selectGrades, insertGrade, updateGrade as updateGradeDb } from '$lib/server/sql';
import { gradeSchema } from '$lib/validations/grade';

export const getGrades = query(async () => {
	return await selectGrades(getPool());
});

export const getGrade = query(v.string(), async (id) => {
	const [grade] = await selectGrades(getPool(), { where: [['id', '=', id]] });
	if (!grade) error(404, 'Nilai tidak ditemukan');
	return grade;
});

export const getGradesByCourse = query(v.string(), async (courseId) => {
	return await selectGrades(getPool(), { where: [['course_id', '=', courseId]] });
});

export const getGradesByStudent = query(v.string(), async (studentId) => {
	return await selectGrades(getPool(), { where: [['student_id', '=', studentId]] });
});

export const createGrade = form(gradeSchema, async (data, issue) => {
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
		await getGrade(id).refresh();
		return { success: true };
	}
);

export const batchInputGrades = form(
	v.object({
		grades: v.array(v.object(gradeSchema.entries))
	}),
	async (data) => {
		for (const g of data.grades) {
			const { total, letter } = calculateGrade(g.assignmentScore, g.midtermScore, g.finalScore);
			const [existing] = await selectGrades(getPool(), {
				where: [['enrollment_id', '=', g.enrollmentId]]
			});
			if (existing && existing.id) {
				await updateGradeDb(
					getPool(),
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
				await insertGrade(getPool(), {
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
		await getGrades().refresh();
		return { success: true, count: data.grades.length };
	}
);
