import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { hash } from '@node-rs/argon2';
import { randomUUID } from 'crypto';
import {
	getListQueryLimit,
	getListQueryCursor,
	getPool,
	toLimitedListResult,
	withTransaction
} from '$lib/server/db';
import { requireRole, requireUser } from '$lib/server/auth';
import { invalidateConflictAuditCache } from '$lib/server/conflict-audit';
import { generateNRP } from '$lib/server/NRP-generator';
import {
	containsSearchPattern,
	fulltextSearchPattern,
	decodeKeysetCursor,
	encodeKeysetCursor,
	prefixSearchPattern
} from '$lib/server/search';
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
import { type SelectStudentsResult, type SelectStudentsWhere } from '$lib/server/sql';
import { studentSchema } from '$lib/validations/student';
import { listPageEntries, listPageSchema } from '$lib/validations/pagination';
import { gradePoints } from '$lib/validations/grade';

const studentListSelect = {
	id: true,
	name: true,
	email: true,
	study_program_id: true,
	study_program_name: true,
	faculty_name: true,
	year_admitted: true
} as const;

export const getStudents = query(listPageSchema, async (page) => {
	await requireRole(['ADMIN', 'LECTURER']);
	const limit = getListQueryLimit();
	const afterId = getListQueryCursor(page?.cursor);
	return toLimitedListResult(
		await selectStudents(getPool(), {
			select: studentListSelect,
			params: { afterId, limit: limit + 1 }
		}),
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
		where.push([
			'study_program_name',
			'FULLTEXT',
			fulltextSearchPattern(filters.studyProgramName)!
		]);
	if (filters.facultyId) where.push(['faculty_id', '=', filters.facultyId]);
	if (filters.facultyName)
		where.push(['faculty_name', 'FULLTEXT', fulltextSearchPattern(filters.facultyName)!]);
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
		const qWordPrefix = `% ${q}%`;
		const cursor = decodeKeysetCursor(filters.cursor, 'students:name');
		const sqlParts = [
			'SELECT s.id, s.name, s.email, s.study_program_id, sp.name AS study_program_name, f.name AS faculty_name, s.year_admitted',
			'FROM students s',
			'INNER JOIN study_programs sp ON s.study_program_id = sp.id',
			'INNER JOIN faculties f ON sp.faculty_id = f.id',
			'WHERE (s.name LIKE ? OR s.name LIKE ?)'
		];
		const values: unknown[] = [qPrefix, qWordPrefix];

		if (cursor) {
			sqlParts.push('AND (s.name > ? OR (s.name = ? AND s.id > ?))');
			values.push(cursor.value, cursor.value, cursor.id);
		}
		if (filters.studyProgramId) {
			sqlParts.push('AND s.study_program_id = ?');
			values.push(filters.studyProgramId);
		}
		if (filters.facultyId) {
			sqlParts.push('AND f.id = ?');
			values.push(filters.facultyId);
		}
		if (filters.minYearAdmitted != null) {
			sqlParts.push('AND s.year_admitted >= ?');
			values.push(filters.minYearAdmitted);
		}
		if (filters.maxYearAdmitted != null) {
			sqlParts.push('AND s.year_admitted <= ?');
			values.push(filters.maxYearAdmitted);
		}
		sqlParts.push('ORDER BY s.name ASC, s.id ASC');
		sqlParts.push('LIMIT ?');
		values.push(limit + 1);

		const [rows] = await getPool().query(sqlParts.join(' '), values);
		return toLimitedListResult(rows as SelectStudentsResult[], limit, (item) =>
			encodeKeysetCursor('students:name', item.name ?? null, item.id ?? null)
		);
	}
	return toLimitedListResult(
		await selectStudents(getPool(), {
			select: studentListSelect,
			where,
			params: { afterId, limit: limit + 1 }
		}),
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
	if (!data.studyProgramId) throw error(400, 'Program studi wajib dipilih');
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
	invalidateConflictAuditCache();

	await getStudents().refresh();
	return { success: true, nrp };
});

export const updateStudent = form(
	v.object({ id: v.string(), ...studentSchema.entries }),
	async (data) => {
		await requireRole(['ADMIN']);
		const { id, ...updateData } = data;
		if (!updateData.studyProgramId) throw error(400, 'Program studi wajib dipilih');
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
		invalidateConflictAuditCache();
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
	invalidateConflictAuditCache();

	await getStudents().refresh();
	return { success: true };
});

export const bulkDeleteStudents = command(v.pipe(v.string(), v.minLength(1)), async (idsParam) => {
	await requireRole(['ADMIN']);
	const ids = idsParam.split(',').filter(Boolean);
	if (!ids.length) throw error(400, 'Tidak ada mahasiswa dipilih');
	if (ids.length > 200) throw error(400, 'Maksimal 200 mahasiswa sekaligus');
	const results: Array<{ id: string; ok: boolean; message?: string }> = [];
	await withTransaction(async (conn) => {
		for (const id of ids) {
			const [student] = await selectStudents(conn, {
				where: [['id', '=', id]]
			});
			if (!student) {
				results.push({ id, ok: false, message: 'Mahasiswa tidak ditemukan' });
				continue;
			}
			if ((student.enrollment_count ?? 0) > 0) {
				results.push({ id, ok: false, message: 'Masih memiliki KRS' });
				continue;
			}
			const [user] = await selectUsers(conn, { where: [['student_id', '=', id]] });
			await deleteStudentDb(conn, { id });
			if (user?.id) await deleteUser(conn, { id: user.id });
			results.push({ id, ok: true });
		}
	});
	if (results.some((r) => r.ok)) {
		invalidateConflictAuditCache();
		await getStudents().refresh();
	}
	return { success: true, results };
});

export const bulkUpdateStudents = form(
	v.object({
		ids: v.pipe(v.string(), v.minLength(1)),
		studyProgramId: v.optional(v.string()),
		yearAdmitted: v.optional(v.string())
	}),
	async (data) => {
		await requireRole(['ADMIN']);
		const ids = data.ids.split(',').filter(Boolean);
		if (!ids.length) throw error(400, 'Tidak ada mahasiswa dipilih');
		if (ids.length > 200) throw error(400, 'Maksimal 200 mahasiswa sekaligus');
		const results: Array<{ id: string; ok: boolean; message?: string }> = [];
		await withTransaction(async (conn) => {
			for (const id of ids) {
				const [student] = await selectStudents(conn, { where: [['id', '=', id]] });
				if (!student) {
					results.push({ id, ok: false, message: 'Mahasiswa tidak ditemukan' });
					continue;
				}
				await updateStudentDb(
					conn,
					{
						name: student.name ?? '',
						email: student.email ?? '',
						phone: student.phone ?? undefined,
						address: student.address ?? undefined,
						year_admitted: data.yearAdmitted
							? Number(data.yearAdmitted)
							: (student.year_admitted ?? new Date().getFullYear()),
						study_program_id: data.studyProgramId || student.study_program_id || ''
					},
					{ id }
				);
				results.push({ id, ok: true });
			}
		});
		if (results.some((r) => r.ok)) {
			invalidateConflictAuditCache();
			await getStudents().refresh();
		}
		return { success: true, results };
	}
);
