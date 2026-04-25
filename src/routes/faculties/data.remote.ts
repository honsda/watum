import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import {
	getListQueryLimit,
	getListQueryCursor,
	mergeLimitedListResult,
	getPool,
	toLimitedListResult
} from '$lib/server/db';
import { requireRole } from '$lib/server/auth';
import { insertWithGeneratedId } from '$lib/server/entity-id';
import {
	containsSearchPattern,
	fulltextSearchPattern,
	prefixSearchPattern,
	wordPrefixSearchPattern
} from '$lib/server/search';
import {
	selectFaculties,
	insertFaculty,
	updateFaculty as updateFacultyDb,
	deleteFaculty as deleteFacultyDb
} from '$lib/server/sql';
import { type SelectFacultiesWhere } from '$lib/server/sql';
import { facultyCreateSchema, facultySchema } from '$lib/validations/faculty';
import { listPageEntries, listPageSchema } from '$lib/validations/pagination';

const facultyListSelect = {
	id: true,
	name: true
} as const;

export const getFaculties = query(listPageSchema, async (page) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const limit = getListQueryLimit();
	const afterId = getListQueryCursor(page?.cursor);
	return toLimitedListResult(
		await selectFaculties(getPool(), {
			select: facultyListSelect,
			params: { afterId, limit: limit + 1 }
		}),
		limit,
		(item) => item.id ?? null
	);
});

const searchFacultiesSchema = v.object({
	...listPageEntries,
	q: v.optional(v.string()),
	id: v.optional(v.string()),
	name: v.optional(v.string()),
	minStudyProgramCount: v.optional(v.number()),
	maxStudyProgramCount: v.optional(v.number())
});

export const searchFaculties = query(searchFacultiesSchema, async (filters) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const where: SelectFacultiesWhere[] = [];
	if (filters.id) where.push(['id', '=', filters.id]);
	if (filters.name) where.push(['name', 'LIKE', containsSearchPattern(filters.name)!]);
	if (filters.minStudyProgramCount != null && filters.maxStudyProgramCount != null) {
		where.push([
			'study_program_count',
			'BETWEEN',
			filters.minStudyProgramCount,
			filters.maxStudyProgramCount
		]);
	} else if (filters.minStudyProgramCount != null) {
		where.push(['study_program_count', '>=', filters.minStudyProgramCount]);
	} else if (filters.maxStudyProgramCount != null) {
		where.push(['study_program_count', '<=', filters.maxStudyProgramCount]);
	}
	const limit = getListQueryLimit();
	const afterId = getListQueryCursor(filters.cursor);
	const q = filters.q?.trim();
	if (q) {
		const qPrefix = prefixSearchPattern(q)!;
		const qWordPrefix = wordPrefixSearchPattern(q)!;
		const queryLimit = limit + 1;
		const resultSets = await Promise.all([
			selectFaculties(getPool(), {
				select: facultyListSelect,
				where: [...where, ['id', '=', q]],
				params: { afterId, limit: queryLimit }
			}),
			selectFaculties(getPool(), {
				select: facultyListSelect,
				where: [...where, ['name', 'LIKE', qPrefix]],
				params: { afterId, limit: queryLimit }
			}),
			selectFaculties(getPool(), {
				select: facultyListSelect,
				where: [...where, ['name', 'LIKE', qWordPrefix]],
				params: { afterId, limit: queryLimit }
			})
		]);
		return mergeLimitedListResult(resultSets, limit, (item) => item.id ?? null);
	}
	return toLimitedListResult(
		await selectFaculties(getPool(), {
			select: facultyListSelect,
			where,
			params: { afterId, limit: limit + 1 }
		}),
		limit,
		(item) => item.id ?? null
	);
});

export const getFaculty = query(v.string(), async (id) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const [faculty] = await selectFaculties(getPool(), { where: [['id', '=', id]] });
	if (!faculty) {
		throw error(404, 'fakultas tidak ditemukan');
	}
	return faculty;
});

export const createFaculty = form(facultyCreateSchema, async (data) => {
	await requireRole(['ADMIN']);
	const [existingName] = await selectFaculties(getPool(), { where: [['name', '=', data.name]] });
	if (existingName) {
		throw error(400, 'Nama fakultas sudah digunakan');
	}
	const { id } = await insertWithGeneratedId({
		prefix: 'FK',
		width: 2,
		readIds: async (connection) => (await selectFaculties(connection)).map((faculty) => faculty.id),
		insert: async (connection, id) => insertFaculty(connection, { id, name: data.name })
	});
	await getFaculties().refresh();
	return { success: true, id };
});

export const updateFaculty = form(facultySchema, async (data) => {
	await requireRole(['ADMIN']);
	const [existing] = await selectFaculties(getPool(), { where: [['id', '=', data.id]] });
	if (!existing) {
		throw error(404, 'fakultas tidak ditemukan');
	}
	await updateFacultyDb(getPool(), data, { id: data.id });
	await getFaculties().refresh();
	return { success: true, id: data.id };
});

export const deleteFaculty = command(v.string(), async (id) => {
	await requireRole(['ADMIN']);
	const [faculty] = await selectFaculties(getPool(), { where: [['id', '=', id]] });
	if (!faculty) {
		throw error(404, 'fakultas tidak ditemukan');
	}
	if ((faculty.study_program_count ?? 0) > 0) {
		throw error(400, 'fakultas masih memiliki program studi, hapus program studi terlebih dahulu');
	}
	await deleteFacultyDb(getPool(), { id });
	await getFaculties().refresh();
	return { success: true };
});
