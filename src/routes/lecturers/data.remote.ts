// src/routes/(app)/lecturers/data.remote.ts
import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { hash } from 'argon2';
import { randomUUID } from 'crypto';
import { getPool, withTransaction } from '$lib/server/db';
import { requireRole } from '$lib/server/auth';
import {
	selectLecturers,
	selectUsers,
	insertLecturer,
	insertUser,
	deleteUser,
	updateLecturer as updateLecturerDb,
	deleteLectuer as deleteLecturerDb
} from '$lib/server/sql';
import { type SelectLecturersWhere } from '$lib/server/sql';
import { lecturerSchema } from '$lib/validations/lecturer';

export const getLecturers = query(async () => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	return selectLecturers(getPool());
});

const searchLecturersSchema = v.object({
	id: v.optional(v.string()),
	name: v.optional(v.string()),
	email: v.optional(v.string()),
	phone: v.optional(v.string()),
	address: v.optional(v.string()),
	minScheduleCount: v.optional(v.number()),
	maxScheduleCount: v.optional(v.number())
});

export const searchLecturers = query(searchLecturersSchema, async (filters) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const where: SelectLecturersWhere[] = [];
	if (filters.id) where.push(['id', '=', filters.id]);
	if (filters.name) where.push(['name', 'LIKE', filters.name]);
	if (filters.email) where.push(['email', 'LIKE', filters.email]);
	if (filters.phone) where.push(['phone', 'LIKE', filters.phone]);
	if (filters.address) where.push(['address', 'LIKE', filters.address]);
	if (filters.minScheduleCount != null && filters.maxScheduleCount != null) {
		where.push(['schedule_count', 'BETWEEN', filters.minScheduleCount, filters.maxScheduleCount]);
	} else if (filters.minScheduleCount != null) {
		where.push(['schedule_count', '>=', filters.minScheduleCount]);
	} else if (filters.maxScheduleCount != null) {
		where.push(['schedule_count', '<=', filters.maxScheduleCount]);
	}
	return selectLecturers(getPool(), { where });
});

export const getLecturer = query(v.string(), async (id) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const [lecturer] = await selectLecturers(getPool(), { where: [['id', '=', id]] });
	if (!lecturer) {
		throw error(404, 'Dosen tidak ditemukan');
	}
	return lecturer;
});

export const createLecturer = form(lecturerSchema, async (data) => {
	await requireRole(['ADMIN']);
	const [existing] = await selectLecturers(getPool(), { where: [['id', '=', data.id]] });
	if (existing) {
		throw error(400, 'ID dosen sudah digunakan');
	}
	const [existingEmail] = await selectLecturers(getPool(), { where: [['email', '=', data.email]] });
	if (existingEmail) {
		throw error(400, 'Email sudah digunakan');
	}
	const hashedPassword = await hash(data.id);
	await withTransaction(async (conn) => {
		await insertLecturer(conn, {
			id: data.id,
			name: data.name,
			email: data.email,
			phone: data.phone!,
			address: data.address!
		});

		await insertUser(conn, {
			id: randomUUID(),
			email: data.email,
			password: hashedPassword,
			role: 'LECTURER',
			student_id: undefined,
			lecturer_id: data.id
		});
	});

	await getLecturers().refresh();
	return { success: true, id: data.id };
});

export const updateLecturer = form(lecturerSchema, async (data) => {
	await requireRole(['ADMIN']);
	const [existingEmail] = await selectLecturers(getPool(), {
		where: [
			['email', '=', data.email],
			['id', '<>', data.id]
		]
	});
	if (existingEmail) {
		throw error(400, 'Email sudah digunakan');
	}
	const [existing] = await selectLecturers(getPool(), { where: [['id', '=', data.id]] });
	if (!existing) {
		throw error(404, 'Dosen tidak ditemukan');
	}
	await updateLecturerDb(
		getPool(),
		{
			name: data.name,
			email: data.email,
			phone: data.phone!,
			address: data.address!
		},
		{ id: data.id }
	);
	await getLecturers().refresh();
	await getLecturer(data.id).refresh();
	return { success: true, id: data.id };
});

export const deleteLecturer = command(v.string(), async (id) => {
	await requireRole(['ADMIN']);
	const [lecturer] = await selectLecturers(getPool(), { where: [['id', '=', id]] });
	if (!lecturer) {
		throw error(404, 'Dosen tidak ditemukan');
	}
	if ((lecturer.schedule_count ?? 0) > 0) {
		throw error(400, 'Dosen masih memiliki jadwal mengajar, hapus jadwal terlebih dahulu');
	}

	await withTransaction(async (conn) => {
		await deleteLecturerDb(conn, { id });

		const [user] = await selectUsers(conn, { where: [['lecturer_id', '=', id]] });
		if (user?.id) {
			await deleteUser(conn, { id: user.id });
		}
	});

	await getLecturers().refresh();
	return { success: true };
});
