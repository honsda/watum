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
import { requireRole } from '$lib/server/auth';
import { invalidateConflictAuditCache } from '$lib/server/conflict-audit';
import { insertWithGeneratedId } from '$lib/server/entity-id';
import {
	containsSearchPattern,
	prefixSearchPattern,
	wordPrefixSearchPattern
} from '$lib/server/search';
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
import { lecturerCreateSchema, lecturerSchema } from '$lib/validations/lecturer';
import { listPageEntries, listPageSchema } from '$lib/validations/pagination';

const lecturerListSelect = {
	id: true,
	name: true,
	email: true,
	phone: true,
	address: true
} as const;

export const getLecturers = query(listPageSchema, async (page) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const limit = getListQueryLimit();
	const afterId = getListQueryCursor(page?.cursor);
	return toLimitedListResult(
		await selectLecturers(getPool(), {
			select: lecturerListSelect,
			params: { afterId, limit: limit + 1 }
		}),
		limit,
		(item) => item.id ?? null
	);
});

const searchLecturersSchema = v.object({
	...listPageEntries,
	q: v.optional(v.string()),
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
	if (filters.name) where.push(['name', 'LIKE', containsSearchPattern(filters.name)!]);
	if (filters.email) where.push(['email', 'LIKE', containsSearchPattern(filters.email)!]);
	if (filters.phone) where.push(['phone', 'LIKE', containsSearchPattern(filters.phone)!]);
	if (filters.address) where.push(['address', 'LIKE', containsSearchPattern(filters.address)!]);
	if (filters.minScheduleCount != null && filters.maxScheduleCount != null) {
		where.push(['schedule_count', 'BETWEEN', filters.minScheduleCount, filters.maxScheduleCount]);
	} else if (filters.minScheduleCount != null) {
		where.push(['schedule_count', '>=', filters.minScheduleCount]);
	} else if (filters.maxScheduleCount != null) {
		where.push(['schedule_count', '<=', filters.maxScheduleCount]);
	}
	const limit = getListQueryLimit();
	const afterId = getListQueryCursor(filters.cursor);
	const q = filters.q?.trim();
	if (q) {
		const qPrefix = prefixSearchPattern(q)!;
		const qWordPrefix = wordPrefixSearchPattern(q)!;
		const queryLimit = limit + 1;
		const resultSets = await Promise.all([
			selectLecturers(getPool(), {
				select: lecturerListSelect,
				where: [...where, ['id', '=', q]],
				params: { afterId, limit: queryLimit }
			}),
			selectLecturers(getPool(), {
				select: lecturerListSelect,
				where: [...where, ['name', 'LIKE', qPrefix]],
				params: { afterId, limit: queryLimit }
			}),
			selectLecturers(getPool(), {
				select: lecturerListSelect,
				where: [...where, ['name', 'LIKE', qWordPrefix]],
				params: { afterId, limit: queryLimit }
			}),
			selectLecturers(getPool(), {
				select: lecturerListSelect,
				where: [...where, ['email', 'LIKE', qPrefix]],
				params: { afterId, limit: queryLimit }
			})
		]);
		return mergeLimitedListResult(resultSets, limit, (item) => item.id ?? null);
	}
	return toLimitedListResult(
		await selectLecturers(getPool(), {
			select: lecturerListSelect,
			where,
			params: { afterId, limit: limit + 1 }
		}),
		limit,
		(item) => item.id ?? null
	);
});

export const getLecturer = query(v.string(), async (id) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const [lecturer] = await selectLecturers(getPool(), { where: [['id', '=', id]] });
	if (!lecturer) {
		throw error(404, 'Dosen tidak ditemukan');
	}
	return lecturer;
});

export const createLecturer = form(lecturerCreateSchema, async (data) => {
	await requireRole(['ADMIN']);
	const [existingEmail] = await selectLecturers(getPool(), { where: [['email', '=', data.email]] });
	if (existingEmail) {
		throw error(400, 'Email sudah digunakan');
	}
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
				phone: data.phone!,
				address: data.address!
			});

			return insertUser(connection, {
				id: randomUUID(),
				email: data.email,
				password: hashedPassword,
				role: 'LECTURER',
				student_id: undefined,
				lecturer_id: lecturerId
			});
		}
	});
	invalidateConflictAuditCache();

	await getLecturers().refresh();
	return { success: true, id: lecturerId };
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
	invalidateConflictAuditCache();
	await getLecturers().refresh();
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
	invalidateConflictAuditCache();

	await getLecturers().refresh();
	return { success: true };
});
