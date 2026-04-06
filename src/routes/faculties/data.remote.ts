import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { getPool } from '$lib/server/db';
import { requireRole } from '$lib/server/auth';
import {
	selectFaculties,
	insertFaculty,
	updateFaculty as updateFacultyDb,
	deleteFaculty as deleteFacultyDb
} from '$lib/server/sql';
import { facultySchema } from '$lib/validations/faculty';

export const getFaculties = query(async () => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	return selectFaculties(getPool());
});

export const getFaculty = query(v.string(), async (id) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const [faculty] = await selectFaculties(getPool(), { where: [['id', '=', id]] });
	if (!faculty) {
		throw error(404, 'fakultas tidak ditemukan');
	}
	return faculty;
});

export const createFaculty = form(facultySchema, async (data) => {
	await requireRole(['ADMIN']);
	const [existing] = await selectFaculties(getPool(), { where: [['id', '=', data.id]] });
	if (existing) {
		throw error(400, 'ID fakultas sudah digunakan');
	}
	await insertFaculty(getPool(), data);
	await getFaculties().refresh();
	return { success: true, id: data.id };
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
	if (faculty.study_program_count ?? 0 > 0) {
		throw error(400, 'fakultas masih memiliki program studi, hapus program studi terlebih dahulu');
	}
	await deleteFacultyDb(getPool(), { id });
	await getFaculties().refresh();
	return { success: true };
});
