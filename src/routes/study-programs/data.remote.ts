import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { getPool } from '$lib/server/db';
import { requireRole } from '$lib/server/auth';
import {
	selectStudyPrograms,
	selectFaculties,
	insertStudyProgram,
	updateStudyProgram as updateStudyProgramDb,
	deleteStudyProgram as deleteStudyProgramDb
} from '$lib/server/sql';
import { studyProgramSchema } from '$lib/validations/study-program';

export const getStudyPrograms = query(async () => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	return selectStudyPrograms(getPool());
});

export const getStudyProgram = query(v.string(), async (id) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const [sp] = await selectStudyPrograms(getPool(), { where: [['id', '=', id]] });
	if (!sp) {
		throw error(404, 'program studi tidak ditemukan');
	}
	return sp;
});

export const createStudyProgram = form(studyProgramSchema, async (data) => {
	await requireRole(['ADMIN']);
	const [existing] = await selectStudyPrograms(getPool(), { where: [['id', '=', data.id]] });
	if (existing) {
		throw error(400, 'ID program studi sudah digunakan');
	}
	const [faculty] = await selectFaculties(getPool(), { where: [['id', '=', data.facultyId]] });
	if (!faculty) {
		throw error(400, 'fakultas tidak ditemukan');
	}

	await insertStudyProgram(getPool(), {
		id: data.id,
		name: data.name,
		head: data.head,
		faculty_id: data.facultyId
	});
	await getStudyPrograms().refresh();
	return { success: true, id: data.id };
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
	await getStudyProgram(data.id).refresh();
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
