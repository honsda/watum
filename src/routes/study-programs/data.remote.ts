import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { getPool } from '$lib/server/db';
import { requireRole } from '$lib/server/auth';
import { insertWithGeneratedId } from '$lib/server/entity-id';
import {
	selectStudyPrograms,
	selectFaculties,
	insertStudyProgram,
	updateStudyProgram as updateStudyProgramDb,
	deleteStudyProgram as deleteStudyProgramDb
} from '$lib/server/sql';
import { type SelectStudyProgramsWhere } from '$lib/server/sql';
import { studyProgramCreateSchema, studyProgramSchema } from '$lib/validations/study-program';

export const getStudyPrograms = query(async () => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	return selectStudyPrograms(getPool());
});

const searchStudyProgramsSchema = v.object({
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
	if (filters.name) where.push(['name', 'LIKE', filters.name]);
	if (filters.head) where.push(['head', 'LIKE', filters.head]);
	if (filters.facultyId) where.push(['faculty_id', '=', filters.facultyId]);
	if (filters.facultyName) where.push(['faculty_name', 'LIKE', filters.facultyName]);
	if (filters.minStudentCount != null && filters.maxStudentCount != null) {
		where.push(['student_count', 'BETWEEN', filters.minStudentCount, filters.maxStudentCount]);
	} else if (filters.minStudentCount != null) {
		where.push(['student_count', '>=', filters.minStudentCount]);
	} else if (filters.maxStudentCount != null) {
		where.push(['student_count', '<=', filters.maxStudentCount]);
	}
	return selectStudyPrograms(getPool(), { where });
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
