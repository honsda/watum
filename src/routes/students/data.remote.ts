import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { getPool } from '$lib/server/db';
import { generateNRP } from '$lib/server/NRP-generator';
import {
	selectStudents,
	selectStudyPrograms,
	selectGrades,
	insertStudent,
	updateStudent as updateStudentDb,
	deleteStudent as deleteStudentDb
} from '$lib/server/sql';
import { studentSchema } from '$lib/validations/student';
import { gradePoints } from '$lib/validations/grade';

export const getStudents = query(async () => {
	return await selectStudents(getPool());
});

export const getStudent = query(v.string(), async (id) => {
	const [student] = await selectStudents(getPool(), { where: [['id', '=', id]] });
	if (!student) error(404, 'Mahasiswa tidak ditemukan');
	return student;
});

export const getStudentGPA = query(v.string(), async (studentId) => {
	const grades = await selectGrades(getPool(), {
		select: { letter_grade: true, credits: true },
		where: [['student_id', '=', studentId]]
	});
	let totalCredits = 0,
		totalPoints = 0;
	for (const g of grades) {
		if (g.letter_grade && g.credits) {
			totalCredits += g.credits;
			totalPoints += g.credits * (gradePoints[g.letter_grade] ?? 0);
		}
	}
	return {
		gpa: (totalCredits > 0 ? totalPoints / totalCredits : 0).toFixed(2),
		totalCredits,
		totalCourses: grades.length
	};
});

export const createStudent = form(studentSchema, async (data) => {
	const [existingEmail] = await selectStudents(getPool(), { where: [['email', '=', data.email]] });
	if (existingEmail) throw error(400, 'Email sudah terdaftar');

	const [studyProgram] = await selectStudyPrograms(getPool(), {
		where: [['id', '=', data.studyProgramId]]
	});
	if (!studyProgram) throw error(400, 'Program studi tidak ditemukan');

	const nrp = await generateNRP(data.studyProgramId, data.yearAdmitted);

	await insertStudent(getPool(), {
		id: nrp,
		name: data.name,
		email: data.email,
		phone: data.phone ?? undefined,
		address: data.address ?? undefined,
		year_admitted: data.yearAdmitted,
		study_program_id: data.studyProgramId
	});
	await getStudents().refresh();
	return { success: true, nrp };
});

export const updateStudent = form(
	v.object({ id: v.string(), ...studentSchema.entries }),
	async (data) => {
		const { id, ...updateData } = data;
		const [existingEmail] = await selectStudents(getPool(), {
			where: [['email', '=', updateData.email]]
		});
		if (existingEmail && existingEmail.id !== id) throw error(400, 'Email sudah digunakan');

		await updateStudentDb(
			getPool(),
			{
				name: updateData.name,
				email: updateData.email,
				phone: updateData.phone ?? undefined,
				address: updateData.address ?? undefined,
				year_admitted: updateData.yearAdmitted,
				study_program_id: updateData.studyProgramId
			},
			{ id }
		);
		await getStudents().refresh();
		await getStudent(id).refresh();
		return { success: true };
	}
);

export const deleteStudent = command(v.string(), async (id) => {
	const [student] = await selectStudents(getPool(), { where: [['id', '=', id]] });
	if (!student) throw error(404, 'Mahasiswa tidak ditemukan');

	await deleteStudentDb(getPool(), { id });
	await getStudents().refresh();
});
