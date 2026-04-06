import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { getPool } from '$lib/server/db';
import { requireRole } from '$lib/server/auth';
import {
	selectCourses,
	selectStudyPrograms,
	insertCourse,
	updateCourse as updateCourseDb,
	deleteCourse as deleteCourseDb
} from '$lib/server/sql';
import { courseSchema } from '$lib/validations/course';

export const getCourses = query(async () => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	return selectCourses(getPool());
});

export const getCourse = query(v.string(), async (id) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const [course] = await selectCourses(getPool(), { where: [['id', '=', id]] });
	if (!course) {
		throw error(404, 'mata kuliah tidak ditemukan');
	}
	return course;
});

export const createCourse = form(courseSchema, async (data) => {
	await requireRole(['ADMIN']);
	const [existing] = await selectCourses(getPool(), { where: [['id', '=', data.id]] });
	if (existing) {
		throw error(400, 'ID mata kuliah sudah digunakan');
	}
	const [sp] = await selectStudyPrograms(getPool(), { where: [['id', '=', data.studyProgramId]] });
	if (!sp) {
		throw error(400, 'program studi tidak ditemukan');
	}
	await insertCourse(getPool(), {
		id: data.id,
		name: data.name,
		credits: data.credits,
		study_program_id: data.studyProgramId
	});
	await getCourses().refresh();
	return { success: true, id: data.id };
});

export const updateCourse = form(courseSchema, async (data) => {
	await requireRole(['ADMIN']);
	const [existing] = await selectCourses(getPool(), { where: [['id', '=', data.id]] });
	if (!existing) {
		throw error(404, 'mata kuliah tidak ditemukan');
	}
	const [sp] = await selectStudyPrograms(getPool(), { where: [['id', '=', data.studyProgramId]] });
	if (!sp) {
		throw error(400, 'program studi tidak ditemukan');
	}
	await updateCourseDb(
		getPool(),
		{
			name: data.name,
			credits: data.credits,
			study_program_id: data.studyProgramId
		},
		{ id: data.id }
	);
	await getCourses().refresh();
	return { success: true, id: data.id };
});

export const deleteCourse = command(v.string(), async (id) => {
	await requireRole(['ADMIN']);
	const [course] = await selectCourses(getPool(), { where: [['id', '=', id]] });
	if (!course) {
		throw error(404, 'mata kuliah tidak ditemukan');
	}
	if (course.enrollment_count ?? 0 > 0) {
		throw error(
			400,
			'mata kuliah masih memiliki mahasiswa yang terdaftar, hapus data KRS terlebih dahulu'
		);
	}
	await deleteCourseDb(getPool(), { id });
	await getCourses().refresh();
	return { success: true };
});
