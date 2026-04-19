import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { getPool } from '$lib/server/db';
import { requireRole } from '$lib/server/auth';
import { insertWithGeneratedId } from '$lib/server/entity-id';
import {
	selectFaculties,
	insertFaculty,
	updateFaculty as updateFacultyDb,
	deleteFaculty as deleteFacultyDb
} from '$lib/server/sql';
import { type SelectFacultiesWhere } from '$lib/server/sql';
import { facultyCreateSchema, facultySchema } from '$lib/validations/faculty';

export const getFaculties = query(async () => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	return selectFaculties(getPool());
});

const searchFacultiesSchema = v.object({
	id: v.optional(v.string()),
	name: v.optional(v.string()),
	minStudyProgramCount: v.optional(v.number()),
	maxStudyProgramCount: v.optional(v.number())
});

export const searchFaculties = query(searchFacultiesSchema, async (filters) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const where: SelectFacultiesWhere[] = [];
	if (filters.id) where.push(['id', '=', filters.id]);
	if (filters.name) where.push(['name', 'LIKE', filters.name]);
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
	return selectFaculties(getPool(), { where });
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
