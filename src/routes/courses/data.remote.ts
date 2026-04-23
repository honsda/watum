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
import { containsSearchPattern, prefixSearchPattern } from '$lib/server/search';
import {
	selectCourses,
	selectLecturers,
	selectStudyPrograms,
	insertCourse,
	updateCourse as updateCourseDb,
	deleteCourse as deleteCourseDb
} from '$lib/server/sql';
import { type SelectCoursesWhere } from '$lib/server/sql';
import { courseCreateSchema, courseSchema } from '$lib/validations/course';
import { listPageEntries, listPageSchema } from '$lib/validations/pagination';

export const getCourses = query(listPageSchema, async (page) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const limit = getListQueryLimit();
	const afterId = getListQueryCursor(page?.cursor);
	return toLimitedListResult(
		await selectCourses(getPool(), { params: { afterId, limit: limit + 1 } }),
		limit,
		(item) => item.id ?? null
	);
});

const searchCoursesSchema = v.object({
	...listPageEntries,
	q: v.optional(v.string()),
	id: v.optional(v.string()),
	name: v.optional(v.string()),
	studyProgramId: v.optional(v.string()),
	lecturerId: v.optional(v.string()),
	lecturerName: v.optional(v.string()),
	studyProgramName: v.optional(v.string()),
	minCredits: v.optional(v.number()),
	maxCredits: v.optional(v.number())
});

export const searchCourses = query(searchCoursesSchema, async (filters) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const where: SelectCoursesWhere[] = [];
	if (filters.id) where.push(['id', '=', filters.id]);
	if (filters.name) where.push(['name', 'LIKE', containsSearchPattern(filters.name)!]);
	if (filters.studyProgramId) where.push(['study_program_id', '=', filters.studyProgramId]);
	if (filters.lecturerId) where.push(['lecturer_id', '=', filters.lecturerId]);
	if (filters.lecturerName)
		where.push(['lecturer_name', 'LIKE', containsSearchPattern(filters.lecturerName)!]);
	if (filters.studyProgramName)
		where.push(['study_program_name', 'LIKE', containsSearchPattern(filters.studyProgramName)!]);
	if (filters.minCredits != null && filters.maxCredits != null) {
		where.push(['credits', 'BETWEEN', filters.minCredits, filters.maxCredits]);
	} else if (filters.minCredits != null) {
		where.push(['credits', '>=', filters.minCredits]);
	} else if (filters.maxCredits != null) {
		where.push(['credits', '<=', filters.maxCredits]);
	}
	const limit = getListQueryLimit();
	const afterId = getListQueryCursor(filters.cursor);
	const q = filters.q?.trim();
	if (q) {
		const qPrefix = prefixSearchPattern(q)!;
		const queryLimit = limit + 1;
		const resultSets = await Promise.all([
			selectCourses(getPool(), {
				where: [...where, ['id', '=', q]],
				params: { afterId, limit: queryLimit }
			}),
			selectCourses(getPool(), {
				where: [...where, ['name', 'LIKE', qPrefix]],
				params: { afterId, limit: queryLimit }
			}),
			selectCourses(getPool(), {
				where: [...where, ['lecturer_name', 'LIKE', qPrefix]],
				params: { afterId, limit: queryLimit }
			}),
			selectCourses(getPool(), {
				where: [...where, ['study_program_name', 'LIKE', qPrefix]],
				params: { afterId, limit: queryLimit }
			})
		]);
		return mergeLimitedListResult(resultSets, limit, (item) => item.id ?? null);
	}
	return toLimitedListResult(
		await selectCourses(getPool(), { where, params: { afterId, limit: limit + 1 } }),
		limit,
		(item) => item.id ?? null
	);
});

export const getCourse = query(v.string(), async (id) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const [course] = await selectCourses(getPool(), { where: [['id', '=', id]] });
	if (!course) {
		throw error(404, 'mata kuliah tidak ditemukan');
	}
	return course;
});

export const createCourse = form(courseCreateSchema, async (data) => {
	await requireRole(['ADMIN']);

	const [[sp], [lecturer]] = await Promise.all([
		selectStudyPrograms(getPool(), { where: [['id', '=', data.studyProgramId]] }),
		selectLecturers(getPool(), { where: [['id', '=', data.lecturerId]] })
	]);

	if (!sp) {
		throw error(400, 'program studi tidak ditemukan');
	}
	if (!lecturer) {
		throw error(400, 'dosen tidak ditemukan');
	}
	const { id } = await insertWithGeneratedId({
		prefix: 'MK',
		width: 3,
		readIds: async (connection) => (await selectCourses(connection)).map((course) => course.id),
		insert: async (connection, id) =>
			insertCourse(connection, {
				id,
				name: data.name,
				credits: data.credits,
				study_program_id: data.studyProgramId,
				lecturer_id: data.lecturerId
			})
	});
	await getCourses().refresh();
	return { success: true, id };
});

export const updateCourse = form(courseSchema, async (data) => {
	await requireRole(['ADMIN']);
	const [existing] = await selectCourses(getPool(), { where: [['id', '=', data.id]] });
	if (!existing) {
		throw error(404, 'mata kuliah tidak ditemukan');
	}
	const [[sp], [lecturer]] = await Promise.all([
		selectStudyPrograms(getPool(), { where: [['id', '=', data.studyProgramId]] }),
		selectLecturers(getPool(), { where: [['id', '=', data.lecturerId]] })
	]);
	if (!sp) {
		throw error(400, 'program studi tidak ditemukan');
	}

	if (!lecturer) {
		throw error(400, 'dosen tidak ditemukan');
	}
	await updateCourseDb(
		getPool(),
		{
			name: data.name,
			credits: data.credits,
			study_program_id: data.studyProgramId,
			lecturer_id: data.lecturerId
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
