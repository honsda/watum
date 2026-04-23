import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { hash } from 'argon2';
import { randomUUID } from 'crypto';
import {
	getListQueryLimit,
	getListQueryOffset,
	mergeLimitedListResult,
	getPool,
	toLimitedListResult,
	withTransaction
} from '$lib/server/db';
import { requireRole, revokeRefreshTokensForUser } from '$lib/server/auth';
import { insertWithGeneratedId } from '$lib/server/entity-id';
import {
	selectUsers,
	selectStudents,
	selectLecturers,
	selectStudyPrograms,
	insertUser,
	insertStudent,
	insertLecturer,
	deleteUser as deleteUserDb
} from '$lib/server/sql';
import { type SelectUsersWhere } from '$lib/server/sql';
import { updateUser as updateUserDb } from '$lib/server/sql';
import { userSchema, userUpdateSchema } from '$lib/validations/user';
import { studentSchema } from '$lib/validations/student';
import { lecturerCreateSchema } from '$lib/validations/lecturer';
import { generateNRP } from '$lib/server/NRP-generator';
import { listPageEntries, listPageSchema } from '$lib/validations/pagination';

export const getUsers = query(listPageSchema, async (page) => {
	await requireRole(['ADMIN']);
	const limit = getListQueryLimit();
	const offset = getListQueryOffset(page?.offset);
	return toLimitedListResult(
		await selectUsers(getPool(), { params: { offset, limit: limit + 1 } }),
		limit
	);
});

const searchUsersSchema = v.object({
	...listPageEntries,
	q: v.optional(v.string()),
	id: v.optional(v.string()),
	email: v.optional(v.string()),
	role: v.optional(v.picklist(['ADMIN', 'STUDENT', 'LECTURER'])),
	studentId: v.optional(v.string()),
	studentName: v.optional(v.string()),
	lecturerId: v.optional(v.string()),
	lecturerName: v.optional(v.string())
});

export const searchUsers = query(searchUsersSchema, async (filters) => {
	await requireRole(['ADMIN']);
	const where: SelectUsersWhere[] = [];
	if (filters.id) where.push(['id', '=', filters.id]);
	if (filters.email) where.push(['email', 'LIKE', filters.email]);
	if (filters.role) where.push(['role', '=', filters.role]);
	if (filters.studentId) where.push(['student_id', '=', filters.studentId]);
	if (filters.studentName) where.push(['student_name', 'LIKE', filters.studentName]);
	if (filters.lecturerId) where.push(['lecturer_id', '=', filters.lecturerId]);
	if (filters.lecturerName) where.push(['lecturer_name', 'LIKE', filters.lecturerName]);
	const limit = getListQueryLimit();
	const offset = getListQueryOffset(filters.offset);
	const q = filters.q?.trim();
	if (q) {
		const queryLimit = offset + limit + 1;
		const resultSets = await Promise.all([
			selectUsers(getPool(), {
				where: [...where, ['id', '=', q]],
				params: { offset: 0, limit: queryLimit }
			}),
			selectUsers(getPool(), {
				where: [...where, ['email', 'LIKE', q]],
				params: { offset: 0, limit: queryLimit }
			}),
			selectUsers(getPool(), {
				where: [...where, ['student_name', 'LIKE', q]],
				params: { offset: 0, limit: queryLimit }
			}),
			selectUsers(getPool(), {
				where: [...where, ['lecturer_name', 'LIKE', q]],
				params: { offset: 0, limit: queryLimit }
			})
		]);
		return mergeLimitedListResult(resultSets, offset, limit, (item) => item.id ?? null);
	}
	return toLimitedListResult(
		await selectUsers(getPool(), { where, params: { offset, limit: limit + 1 } }),
		limit
	);
});

export const getUser = query(v.string(), async (id) => {
	await requireRole(['ADMIN']);
	const [user] = await selectUsers(getPool(), { where: [['id', '=', id]] });
	if (!user) throw error(404, 'User tidak ditemukan');
	return user;
});

const userInputSchema = v.union([userSchema, studentSchema, lecturerCreateSchema]);

export const createUser = form(userInputSchema, async (data) => {
	await requireRole(['ADMIN']);

	const [existingEmail] = await selectUsers(getPool(), { where: [['email', '=', data.email]] });
	if (existingEmail) {
		throw error(400, 'Email sudah digunakan');
	}

	if ('role' in data) {
		if (data.role === 'STUDENT') {
			if (!data.studentId) {
				throw error(400, 'studentId wajib diisi untuk role STUDENT');
			}
			const [student] = await selectStudents(getPool(), { where: [['id', '=', data.studentId]] });
			if (!student) {
				throw error(400, 'Mahasiswa dengan NRP tersebut tidak ditemukan');
			}

			const [existingStudentUser] = await selectUsers(getPool(), {
				where: [['student_id', '=', data.studentId]]
			});
			if (existingStudentUser) {
				throw error(400, 'Mahasiswa tersebut sudah memiliki akun user');
			}
		}

		if (data.role === 'LECTURER') {
			if (!data.lecturerId) {
				throw error(400, 'lecturerId wajib diisi untuk role LECTURER');
			}
			const [lecturer] = await selectLecturers(getPool(), {
				where: [['id', '=', data.lecturerId]]
			});
			if (!lecturer) {
				throw error(400, 'Dosen dengan NIM tersebut tidak ditemukan');
			}

			const [existingLecturerUser] = await selectUsers(getPool(), {
				where: [['lecturer_id', '=', data.lecturerId]]
			});
			if (existingLecturerUser) {
				throw error(400, 'Dosen tersebut sudah memiliki akun user');
			}
		}

		const hashedPassword = await hash(data.password);
		const id = randomUUID();
		await insertUser(getPool(), {
			id,
			email: data.email,
			password: hashedPassword,
			role: data.role,
			student_id: data.studentId ?? undefined,
			lecturer_id: data.lecturerId ?? undefined
		});
		await getUsers().refresh();
		return { success: true, id };
	}

	if ('yearAdmitted' in data) {
		const [studyProgram] = await selectStudyPrograms(getPool(), {
			where: [['id', '=', data.studyProgramId]]
		});
		if (!studyProgram) {
			throw error(400, 'Program studi tidak ditemukan');
		}

		const nrp = await generateNRP(data.studyProgramId, data.yearAdmitted);
		const id = randomUUID();
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
				id,
				email: data.email,
				password: hashedPassword,
				role: 'STUDENT',
				student_id: nrp,
				lecturer_id: undefined
			});
		});
		await getUsers().refresh();
		return { success: true, id, studentId: nrp };
	}

	const [existingLecturerEmail] = await selectLecturers(getPool(), {
		where: [['email', '=', data.email]]
	});
	if (existingLecturerEmail && existingLecturerEmail.email === data.email) {
		throw error(400, 'Email sudah digunakan oleh dosen');
	}

	const id = randomUUID();
	const { id: lecturerId } = await insertWithGeneratedId({
		prefix: 'DSN',
		width: 3,
		readIds: async (connection) =>
			(await selectLecturers(connection)).map((lecturer) => lecturer.id),
		insert: async (connection, lecturerId) => {
			const hashedPassword = await hash(lecturerId);
			await insertLecturer(connection, {
				id: lecturerId,
				name: data.name,
				email: data.email,
				phone: data.phone ?? undefined,
				address: data.address ?? undefined
			});

			return insertUser(connection, {
				id,
				email: data.email,
				password: hashedPassword,
				role: 'LECTURER',
				student_id: undefined,
				lecturer_id: lecturerId
			});
		}
	});

	await getUsers().refresh();
	return { success: true, id, lecturerId };
});

export const updateUser = form(
	v.object({ id: v.string(), ...userUpdateSchema.entries }),
	async (data) => {
		await requireRole(['ADMIN']);

		const [user] = await selectUsers(getPool(), { where: [['id', '=', data.id]] });
		if (!user) {
			throw error(404, 'User tidak ditemukan');
		}

		const [existingEmail] = await selectUsers(getPool(), { where: [['email', '=', data.email]] });
		if (existingEmail && existingEmail.id !== data.id) {
			throw error(400, 'Email sudah digunakan');
		}

		if (data.role === 'STUDENT') {
			if (!data.studentId) {
				throw error(400, 'NRP wajib diisi untuk Mahasiswa');
			}
			const [student] = await selectStudents(getPool(), { where: [['id', '=', data.studentId]] });
			if (!student) {
				throw error(400, 'Mahasiswa tidak ditemukan');
			}
			const [existingStudentUser] = await selectUsers(getPool(), {
				where: [['student_id', '=', data.studentId]]
			});
			if (existingStudentUser && existingStudentUser.id !== data.id) {
				throw error(400, 'Mahasiswa tersebut sudah memiliki akun user');
			}
		}

		if (data.role === 'LECTURER') {
			if (!data.lecturerId) {
				throw error(400, 'NIM wajib diisi untuk Dosen');
			}
			const [lecturer] = await selectLecturers(getPool(), {
				where: [['id', '=', data.lecturerId]]
			});
			if (!lecturer) {
				throw error(400, 'Dosen tidak ditemukan');
			}
			const [existingLecturerUser] = await selectUsers(getPool(), {
				where: [['lecturer_id', '=', data.lecturerId]]
			});
			if (existingLecturerUser && existingLecturerUser.id !== data.id) {
				throw error(400, 'Dosen tersebut sudah memiliki akun user');
			}
		}

		// if (user.role !== data.role) {
		//     if (user.role === 'STUDENT' && user.student_id) {
		//         await deleteStudent(getPool(), { id: user.student_id });
		// }
		//     if (user.role === 'LECTURER' && user.lecturer_id) {
		//         await deleteLectuer(getPool(), { id: user.lecturer_id });
		//     }
		// }
		await updateUserDb(
			getPool(),
			{
				email: data.email,
				password: data.password ? await hash(data.password) : (user.password ?? ''),
				role: data.role,
				student_id: data.role === 'STUDENT' ? (data.studentId ?? undefined) : undefined,
				lecturer_id: data.role === 'LECTURER' ? (data.lecturerId ?? undefined) : undefined
			},
			{ id: data.id }
		);

		if (data.password) {
			await revokeRefreshTokensForUser(data.id);
		}

		await getUsers().refresh();
		return { success: true, id: data.id };
	}
);

export const deleteUser = command(v.string(), async (id) => {
	await requireRole(['ADMIN']);
	const [user] = await selectUsers(getPool(), { where: [['id', '=', id]] });
	if (!user) {
		throw error(404, 'User tidak ditemukan');
	}
	await deleteUserDb(getPool(), { id });
	await getUsers().refresh();
	return { success: true };
});
