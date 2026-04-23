import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { hash } from 'argon2';
import { randomUUID } from 'crypto';
import {
	getListQueryLimit,
	getListQueryCursor,
	mergeLimitedListResult,
	getPool,
	toLimitedListResult,
	withTransaction
} from '$lib/server/db';
import { requireRole, requireUser } from '$lib/server/auth';
import { generateNRP } from '$lib/server/NRP-generator';
import { containsSearchPattern, prefixSearchPattern } from '$lib/server/search';
import {
	selectStudents,
	selectStudyPrograms,
	selectGrades,
	selectUsers,
	insertStudent,
	insertUser,
	updateUser,
	deleteUser,
	updateStudent as updateStudentDb,
	deleteStudent as deleteStudentDb
} from '$lib/server/sql';
import { type SelectStudentsWhere } from '$lib/server/sql';
import { studentSchema } from '$lib/validations/student';
import { listPageEntries, listPageSchema } from '$lib/validations/pagination';
import { gradePoints } from '$lib/validations/grade';

export const getStudents = query(listPageSchema, async (page) => {
	await requireRole(['ADMIN', 'LECTURER']);
	const limit = getListQueryLimit();
	const afterId = getListQueryCursor(page?.cursor);
	return toLimitedListResult(
		await selectStudents(getPool(), { params: { afterId, limit: limit + 1 } }),
		limit,
		(item) => item.id ?? null
	);
});

const searchStudentsSchema = v.object({
	...listPageEntries,
	q: v.optional(v.string()),
	id: v.optional(v.string()),
	name: v.optional(v.string()),
	email: v.optional(v.string()),
	studyProgramId: v.optional(v.string()),
	studyProgramName: v.optional(v.string()),
	facultyId: v.optional(v.string()),
	facultyName: v.optional(v.string()),
	minYearAdmitted: v.optional(v.number()),
	maxYearAdmitted: v.optional(v.number())
});

export const searchStudents = query(searchStudentsSchema, async (filters) => {
	await requireRole(['ADMIN', 'LECTURER']);
	const where: SelectStudentsWhere[] = [];
	if (filters.id) where.push(['id', '=', filters.id]);
	if (filters.name) where.push(['name', 'LIKE', containsSearchPattern(filters.name)!]);
	if (filters.email) where.push(['email', 'LIKE', containsSearchPattern(filters.email)!]);
	if (filters.studyProgramId) where.push(['study_program_id', '=', filters.studyProgramId]);
	if (filters.studyProgramName)
		where.push(['study_program_name', 'LIKE', containsSearchPattern(filters.studyProgramName)!]);
	if (filters.facultyId) where.push(['faculty_id', '=', filters.facultyId]);
	if (filters.facultyName)
		where.push(['faculty_name', 'LIKE', containsSearchPattern(filters.facultyName)!]);
	if (filters.minYearAdmitted != null && filters.maxYearAdmitted != null) {
		where.push(['year_admitted', 'BETWEEN', filters.minYearAdmitted, filters.maxYearAdmitted]);
	} else if (filters.minYearAdmitted != null) {
		where.push(['year_admitted', '>=', filters.minYearAdmitted]);
	} else if (filters.maxYearAdmitted != null) {
		where.push(['year_admitted', '<=', filters.maxYearAdmitted]);
	}
	const limit = getListQueryLimit();
	const afterId = getListQueryCursor(filters.cursor);
	const q = filters.q?.trim();
	if (q) {
		const qPrefix = prefixSearchPattern(q)!;
		const queryLimit = limit + 1;
		const resultSets = await Promise.all([
			selectStudents(getPool(), {
				where: [...where, ['id', '=', q]],
				params: { afterId, limit: queryLimit }
			}),
			selectStudents(getPool(), {
				where: [...where, ['name', 'LIKE', qPrefix]],
				params: { afterId, limit: queryLimit }
			}),
			selectStudents(getPool(), {
				where: [...where, ['email', 'LIKE', qPrefix]],
				params: { afterId, limit: queryLimit }
			}),
			selectStudents(getPool(), {
				where: [...where, ['study_program_name', 'LIKE', qPrefix]],
				params: { afterId, limit: queryLimit }
			}),
			selectStudents(getPool(), {
				where: [...where, ['faculty_name', 'LIKE', qPrefix]],
				params: { afterId, limit: queryLimit }
			})
		]);
		return mergeLimitedListResult(resultSets, limit, (item) => item.id ?? null);
	}
	return toLimitedListResult(
		await selectStudents(getPool(), { where, params: { afterId, limit: limit + 1 } }),
		limit,
		(item) => item.id ?? null
	);
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
	const [existingUserEmail] = await selectUsers(getPool(), { where: [['email', '=', data.email]] });
	if (existingUserEmail) throw error(400, 'Email akun sudah digunakan');

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
		const [existingUserEmail] = await selectUsers(getPool(), {
			where: [['email', '=', updateData.email]]
		});
		if (existingUserEmail && existingUserEmail.student_id !== id)
			throw error(400, 'Email akun sudah digunakan');

		await withTransaction(async (conn) => {
			await updateStudentDb(
				conn,
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

			const [linkedUser] = await selectUsers(conn, { where: [['student_id', '=', id]] });
			if (linkedUser?.id) {
				await updateUser(
					conn,
					{
						email: updateData.email,
						password: linkedUser.password ?? '',
						role: 'STUDENT',
						student_id: id,
						lecturer_id: undefined
					},
					{ id: linkedUser.id }
				);
			}
		});
		await getStudents().refresh();
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
		const [user] = await selectUsers(conn, { where: [['student_id', '=', id]] });
		await deleteStudentDb(conn, { id });
		if (user?.id) {
			await deleteUser(conn, { id: user.id });
		}
	});

	await getStudents().refresh();
	return { success: true };
});
