import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { hash } from 'argon2';
import { randomUUID } from 'crypto';
import { getPool, withTransaction } from '$lib/server/db';
import { requireRole, requireUser } from '$lib/server/auth';
import { generateNRP } from '$lib/server/NRP-generator';
import {
	selectStudents,
	selectStudyPrograms,
	selectGrades,
	selectUsers,
	insertStudent,
	insertUser,
	deleteUser,
	updateStudent as updateStudentDb,
	deleteStudent as deleteStudentDb
} from '$lib/server/sql';
import { studentSchema } from '$lib/validations/student';
import { gradePoints } from '$lib/validations/grade';

export const getStudents = query(async () => {
	await requireRole(['ADMIN', 'LECTURER']);
	return await selectStudents(getPool());
});

export const getStudent = query(v.string(), async (id) => {
	const user = await requireUser();
	if (user.role === 'STUDENT' && user.studentId !== id) {
		throw error(403, 'Anda tidak berhak melihat data mahasiswa lain');
	}
	const [student] = await selectStudents(getPool(), { where: [['id', '=', id]] });
	if (!student) throw error(404, 'Mahasiswa tidak ditemukan');
	return student;
});

export const getStudentGPA = query(v.string(), async (studentId) => {
	const user = await requireUser();
	if (user.role === 'STUDENT' && user.studentId !== studentId) {
		throw error(403, 'Anda tidak berhak melihat IPK mahasiswa lain');
	}
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
	await requireRole(['ADMIN']);
	const [existingEmail] = await selectStudents(getPool(), { where: [['email', '=', data.email]] });
	if (existingEmail) throw error(400, 'Email sudah terdaftar');

	const [studyProgram] = await selectStudyPrograms(getPool(), {
		where: [['id', '=', data.studyProgramId]]
	});
	if (!studyProgram) throw error(400, 'Program studi tidak ditemukan');

	const nrp = await generateNRP(data.studyProgramId, data.yearAdmitted);
	const hashedPassword = await hash(nrp);
	await withTransaction(async (conn) => {
		await insertStudent(conn, {
			id: nrp,
			name: data.name,
			email: data.email,
			phone: data.phone ?? undefined,
			address: data.address ?? undefined,
			year_admitted: data.yearAdmitted,
			study_program_id: data.studyProgramId
		});

		await insertUser(conn, {
			id: randomUUID(),
			email: data.email,
			password: hashedPassword,
			role: 'STUDENT',
			student_id: nrp,
			lecturer_id: undefined
		});
	});

	await getStudents().refresh();
	return { success: true, nrp };
});

export const updateStudent = form(
	v.object({ id: v.string(), ...studentSchema.entries }),
	async (data) => {
		await requireRole(['ADMIN']);
		const { id, ...updateData } = data;
		const [student] = await selectStudents(getPool(), { where: [['id', '=', id]] });
		if (!student) throw error(404, 'Mahasiswa tidak ditemukan');
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
	await requireRole(['ADMIN']);
	const [student] = await selectStudents(getPool(), { where: [['id', '=', id]] });
	if (!student) throw error(404, 'Mahasiswa tidak ditemukan');
	if ((student.enrollment_count ?? 0) > 0)
		throw error(400, 'Tidak dapat menghapus mahasiswa yang memiliki data KRS');

	await withTransaction(async (conn) => {
		await deleteStudentDb(conn, { id });

		const [user] = await selectUsers(conn, { where: [['student_id', '=', id]] });
		if (user?.id) {
			await deleteUser(conn, { id: user.id });
		}
	});

	await getStudents().refresh();
	return { success: true };
});
