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
import { type SelectCoursesWhere } from '$lib/server/sql';
import { courseSchema } from '$lib/validations/course';

export const getCourses = query(async () => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	return selectCourses(getPool());
});

const searchCoursesSchema = v.object({
	id: v.optional(v.string()),
	name: v.optional(v.string()),
	studyProgramId: v.optional(v.string()),
	studyProgramName: v.optional(v.string()),
	minCredits: v.optional(v.number()),
	maxCredits: v.optional(v.number())
});

export const searchCourses = query(searchCoursesSchema, async (filters) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const where: SelectCoursesWhere[] = [];
	if (filters.id) where.push(['id', '=', filters.id]);
	if (filters.name) where.push(['name', 'LIKE', filters.name]);
	if (filters.studyProgramId) where.push(['study_program_id', '=', filters.studyProgramId]);
	if (filters.studyProgramName) where.push(['study_program_name', 'LIKE', filters.studyProgramName]);
	if (filters.minCredits != null && filters.maxCredits != null) {
		where.push(['credits', 'BETWEEN', filters.minCredits, filters.maxCredits]);
	} else if (filters.minCredits != null) {
		where.push(['credits', '>=', filters.minCredits]);
	} else if (filters.maxCredits != null) {
		where.push(['credits', '<=', filters.maxCredits]);
	}
	return selectCourses(getPool(), { where });
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
	if ((course.enrollment_count ?? 0) > 0) {
		throw error(
			400,
			'mata kuliah masih memiliki mahasiswa yang terdaftar, hapus data KRS terlebih dahulu'
		);
	}
	await deleteCourseDb(getPool(), { id });
	await getCourses().refresh();
	return { success: true };
});
