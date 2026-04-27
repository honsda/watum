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
	selectStudyPrograms,
	selectFaculties,
	insertStudyProgram,
	updateStudyProgram as updateStudyProgramDb,
	deleteStudyProgram as deleteStudyProgramDb
} from '$lib/server/sql';
import { type SelectStudyProgramsWhere } from '$lib/server/sql';
import { studyProgramCreateSchema, studyProgramSchema } from '$lib/validations/study-program';
import { listPageEntries, listPageSchema } from '$lib/validations/pagination';

const studyProgramListSelect = {
	id: true,
	name: true,
	head: true,
	faculty_id: true,
	faculty_name: true
} as const;

export const getStudyPrograms = query(listPageSchema, async (page) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const limit = getListQueryLimit();
	const afterId = getListQueryCursor(page?.cursor);
	return toLimitedListResult(
		await selectStudyPrograms(getPool(), {
			select: studyProgramListSelect,
			params: { afterId, limit: limit + 1 }
		}),
		limit,
		(item) => item.id ?? null
	);
});

const searchStudyProgramsSchema = v.object({
	...listPageEntries,
	q: v.optional(v.string()),
	id: v.optional(v.string()),
	name: v.optional(v.string()),
	head: v.optional(v.string()),
	facultyId: v.optional(v.string()),
	facultyName: v.optional(v.string()),
	minStudentCount: v.optional(v.number()),
	maxStudentCount: v.optional(v.number())
});

export const searchStudyPrograms = query(searchStudyProgramsSchema, async (filters) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const where: SelectStudyProgramsWhere[] = [];
	if (filters.id) where.push(['id', '=', filters.id]);
	if (filters.name) where.push(['name', 'LIKE', containsSearchPattern(filters.name)!]);
	if (filters.head) where.push(['head', 'LIKE', containsSearchPattern(filters.head)!]);
	if (filters.facultyId) where.push(['faculty_id', '=', filters.facultyId]);
	if (filters.facultyName)
		where.push(['faculty_name', 'FULLTEXT', fulltextSearchPattern(filters.facultyName)!]);
	if (filters.minStudentCount != null && filters.maxStudentCount != null) {
		where.push(['student_count', 'BETWEEN', filters.minStudentCount, filters.maxStudentCount]);
	} else if (filters.minStudentCount != null) {
		where.push(['student_count', '>=', filters.minStudentCount]);
	} else if (filters.maxStudentCount != null) {
		where.push(['student_count', '<=', filters.maxStudentCount]);
	}
	const limit = getListQueryLimit();
	const afterId = getListQueryCursor(filters.cursor);
	const q = filters.q?.trim();
	if (q) {
		const qPrefix = prefixSearchPattern(q)!;
		const qWordPrefix = wordPrefixSearchPattern(q)!;
		const queryLimit = limit + 1;
		const resultSets = await Promise.all([
			selectStudyPrograms(getPool(), {
				select: studyProgramListSelect,
				where: [...where, ['id', '=', q]],
				params: { afterId, limit: queryLimit }
			}),
			selectStudyPrograms(getPool(), {
				select: studyProgramListSelect,
				where: [...where, ['name', 'LIKE', qPrefix]],
				params: { afterId, limit: queryLimit }
			}),
			selectStudyPrograms(getPool(), {
				select: studyProgramListSelect,
				where: [...where, ['name', 'LIKE', qWordPrefix]],
				params: { afterId, limit: queryLimit }
			}),
			selectStudyPrograms(getPool(), {
				select: studyProgramListSelect,
				where: [...where, ['faculty_name', 'LIKE', qPrefix]],
				params: { afterId, limit: queryLimit }
			}),
			selectStudyPrograms(getPool(), {
				select: studyProgramListSelect,
				where: [...where, ['faculty_name', 'LIKE', qWordPrefix]],
				params: { afterId, limit: queryLimit }
			}),
			selectStudyPrograms(getPool(), {
				select: studyProgramListSelect,
				where: [...where, ['head', 'LIKE', qPrefix]],
				params: { afterId, limit: queryLimit }
			}),
			selectStudyPrograms(getPool(), {
				select: studyProgramListSelect,
				where: [...where, ['head', 'LIKE', qWordPrefix]],
				params: { afterId, limit: queryLimit }
			})
		]);
		return mergeLimitedListResult(resultSets, limit, (item) => item.id ?? null);
	}
	return toLimitedListResult(
		await selectStudyPrograms(getPool(), {
			select: studyProgramListSelect,
			where,
			params: { afterId, limit: limit + 1 }
		}),
		limit,
		(item) => item.id ?? null
	);
});

export const getStudyProgram = query(v.string(), async (id) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const [sp] = await selectStudyPrograms(getPool(), { where: [['id', '=', id]] });
	if (!sp) {
		throw error(404, 'program studi tidak ditemukan');
	}
	return sp;
});

export const createStudyProgram = form(studyProgramCreateSchema, async (data) => {
	await requireRole(['ADMIN']);
	if (!data.facultyId) throw error(400, 'Fakultas wajib dipilih');
	const [existingName] = await selectStudyPrograms(getPool(), {
		where: [['name', '=', data.name]]
	});
	if (existingName) {
		throw error(400, 'Nama program studi sudah digunakan');
	}
	const [faculty] = await selectFaculties(getPool(), { where: [['id', '=', data.facultyId]] });
	if (!faculty) {
		throw error(400, 'fakultas tidak ditemukan');
	}
	const { id } = await insertWithGeneratedId({
		prefix: 'PR',
		width: 2,
		readIds: async (connection) =>
			(await selectStudyPrograms(connection)).map((studyProgram) => studyProgram.id),
		insert: async (connection, id) =>
			insertStudyProgram(connection, {
				id,
				name: data.name,
				head: data.head,
				faculty_id: data.facultyId
			})
	});
	await getStudyPrograms().refresh();
	return { success: true, id };
});

export const updateStudyProgram = form(studyProgramSchema, async (data) => {
	await requireRole(['ADMIN']);
	if (!data.facultyId) throw error(400, 'Fakultas wajib dipilih');
	const [existing] = await selectStudyPrograms(getPool(), { where: [['id', '=', data.id]] });
	if (!existing) {
		throw error(404, 'program studi tidak ditemukan');
	}
	await updateStudyProgramDb(
		getPool(),
		{
			name: data.name,
			head: data.head,
			faculty_id: data.facultyId
		},
		{ id: data.id }
	);
	await getStudyPrograms().refresh();
	return { success: true, id: data.id };
});

export const deleteStudyProgram = command(v.string(), async (id) => {
	await requireRole(['ADMIN']);
	const [sp] = await selectStudyPrograms(getPool(), { where: [['id', '=', id]] });
	if (!sp) {
		throw error(404, 'program studi tidak ditemukan');
	}
	if ((sp.student_count ?? 0) > 0) {
		throw error(400, 'Program studi masih memiliki mahasiswa, hapus mahasiswa terlebih dahulu');
	}
	await deleteStudyProgramDb(getPool(), { id: id });
	await getStudyPrograms().refresh();
	return { success: true, id };
});

export const bulkDeleteStudyPrograms = command(
	v.pipe(v.string(), v.minLength(1)),
	async (idsParam) => {
		await requireRole(['ADMIN']);
		const ids = idsParam.split(',').filter(Boolean);
		const results: Array<{ id: string; ok: boolean; message?: string }> = [];
		for (const id of ids) {
			const [sp] = await selectStudyPrograms(getPool(), {
				where: [['id', '=', id]]
			});
			if (!sp) {
				results.push({ id, ok: false, message: 'Prodi tidak ditemukan' });
				continue;
			}
			if ((sp.student_count ?? 0) > 0) {
				results.push({ id, ok: false, message: 'Masih memiliki mahasiswa' });
				continue;
			}
			await deleteStudyProgramDb(getPool(), { id });
			results.push({ id, ok: true });
		}
		if (results.some((r) => r.ok)) {
			await getStudyPrograms().refresh();
		}
		return { success: true, results };
	}
);

export const bulkUpdateStudyPrograms = form(
	v.object({
		ids: v.pipe(v.string(), v.minLength(1)),
		facultyId: v.optional(v.string()),
		head: v.optional(v.string())
	}),
	async (data) => {
		await requireRole(['ADMIN']);
		const ids = data.ids.split(',').filter(Boolean);
		if (!ids.length) throw error(400, 'Tidak ada prodi dipilih');
		const results: Array<{ id: string; ok: boolean; message?: string }> = [];
		for (const id of ids) {
			const [sp] = await selectStudyPrograms(getPool(), { where: [['id', '=', id]] });
			if (!sp) {
				results.push({ id, ok: false, message: 'Prodi tidak ditemukan' });
				continue;
			}
			await updateStudyProgramDb(
				getPool(),
				{
					name: sp.name ?? '',
					faculty_id: data.facultyId || sp.faculty_id || '',
					head: data.head || sp.head || ''
				},
				{ id }
			);
			results.push({ id, ok: true });
		}
		if (results.some((r) => r.ok)) {
			await getStudyPrograms().refresh();
		}
		return { success: true, results };
	}
);
