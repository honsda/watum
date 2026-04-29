import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import {
	getListQueryLimit,
	getListQueryCursor,
	getPool,
	toLimitedListResult
} from '$lib/server/db';
import { requireRole } from '$lib/server/auth';
import { invalidateConflictAuditCache } from '$lib/server/conflict-audit';
import { insertWithGeneratedId } from '$lib/server/entity-id';
import {
	containsSearchPattern,
	fulltextSearchPattern,
	decodeKeysetCursor,
	encodeKeysetCursor,
	prefixSearchPattern,
	wordPrefixSearchPattern
} from '$lib/server/search';
import {
	selectCourses,
	selectLecturers,
	selectStudyPrograms,
	insertCourse,
	updateCourse as updateCourseDb,
	deleteCourse as deleteCourseDb
} from '$lib/server/sql';
import { type SelectCoursesResult, type SelectCoursesWhere } from '$lib/server/sql';
import { courseCreateSchema, courseSchema } from '$lib/validations/course';
import { listPageEntries, listPageSchema } from '$lib/validations/pagination';

const courseListSelect = {
	id: true,
	name: true,
	credits: true,
	study_program_id: true,
	study_program_name: true,
	lecturer_id: true,
	lecturer_name: true
} as const;

export const getCourses = query(listPageSchema, async (page) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const limit = getListQueryLimit();
	const afterId = getListQueryCursor(page?.cursor);
	return toLimitedListResult(
		await selectCourses(getPool(), {
			select: courseListSelect,
			params: { afterId, limit: limit + 1 }
		}),
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
		where.push(['lecturer_name', 'FULLTEXT', fulltextSearchPattern(filters.lecturerName)!]);
	if (filters.studyProgramName)
		where.push([
			'study_program_name',
			'FULLTEXT',
			fulltextSearchPattern(filters.studyProgramName)!
		]);
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
		const qWordPrefix = wordPrefixSearchPattern(q)!;
		const cursor = decodeKeysetCursor(filters.cursor, 'courses:name');
		const sqlParts = [
			'SELECT c.id, c.name, c.credits, c.study_program_id, sp.name AS study_program_name, c.lecturer_id, l.name AS lecturer_name',
			'FROM courses c',
			'INNER JOIN study_programs sp ON c.study_program_id = sp.id',
			'INNER JOIN lecturers l ON c.lecturer_id = l.id',
			'WHERE (c.name LIKE ? OR c.name LIKE ?)'
		];
		const values: unknown[] = [qPrefix, qWordPrefix];

		if (cursor) {
			sqlParts.push('AND (c.name > ? OR (c.name = ? AND c.id > ?))');
			values.push(cursor.value, cursor.value, cursor.id);
		}
		if (filters.studyProgramId) {
			sqlParts.push('AND c.study_program_id = ?');
			values.push(filters.studyProgramId);
		}
		if (filters.lecturerId) {
			sqlParts.push('AND c.lecturer_id = ?');
			values.push(filters.lecturerId);
		}
		if (filters.lecturerName) {
			sqlParts.push('AND l.name LIKE ?');
			values.push(containsSearchPattern(filters.lecturerName));
		}
		if (filters.studyProgramName) {
			sqlParts.push('AND sp.name LIKE ?');
			values.push(containsSearchPattern(filters.studyProgramName));
		}
		if (filters.minCredits != null) {
			sqlParts.push('AND c.credits >= ?');
			values.push(filters.minCredits);
		}
		if (filters.maxCredits != null) {
			sqlParts.push('AND c.credits <= ?');
			values.push(filters.maxCredits);
		}
		sqlParts.push('ORDER BY c.name ASC, c.id ASC');
		sqlParts.push('LIMIT ?');
		values.push(limit + 1);

		const [rows] = await getPool().query(sqlParts.join(' '), values);
		return toLimitedListResult(rows as SelectCoursesResult[], limit, (item) =>
			encodeKeysetCursor('courses:name', item.name ?? null, item.id ?? null)
		);
	}
	return toLimitedListResult(
		await selectCourses(getPool(), {
			select: courseListSelect,
			where,
			params: { afterId, limit: limit + 1 }
		}),
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
	if (!data.studyProgramId || !data.lecturerId) {
		throw error(400, 'Program studi dan dosen wajib dipilih');
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
	invalidateConflictAuditCache();
	await getCourses().refresh();
	return { success: true, id };
});

export const updateCourse = form(courseSchema, async (data) => {
	await requireRole(['ADMIN']);
	if (!data.studyProgramId || !data.lecturerId) {
		throw error(400, 'Program studi dan dosen wajib dipilih');
	}
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
	const nameChanged = existing.name !== data.name;
	const creditsChanged = existing.credits !== data.credits;
	const studyProgramChanged = existing.study_program_id !== data.studyProgramId;
	const lecturerChanged = existing.lecturer_id !== data.lecturerId;

	if (!nameChanged && !creditsChanged && !studyProgramChanged && !lecturerChanged) {
		return {
			success: true,
			id: data.id,
			nameChanged,
			creditsChanged,
			studyProgramChanged,
			lecturerChanged
		};
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

	if (nameChanged || lecturerChanged) {
		invalidateConflictAuditCache();
	}
	return {
		success: true,
		id: data.id,
		nameChanged,
		creditsChanged,
		studyProgramChanged,
		lecturerChanged
	};
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
	invalidateConflictAuditCache();
	await getCourses().refresh();
	return { success: true };
});

export const bulkDeleteCourses = command(v.pipe(v.string(), v.minLength(1)), async (idsParam) => {
	await requireRole(['ADMIN']);
	const ids = idsParam.split(',').filter(Boolean);
	if (!ids.length) throw error(400, 'Tidak ada mata kuliah dipilih');
	if (ids.length > 200) throw error(400, 'Maksimal 200 mata kuliah sekaligus');
	const results: Array<{ id: string; ok: boolean; message?: string }> = [];
	for (const id of ids) {
		const [course] = await selectCourses(getPool(), { where: [['id', '=', id]] });
		if (!course) {
			results.push({ id, ok: false, message: 'Mata kuliah tidak ditemukan' });
			continue;
		}
		if ((course.enrollment_count ?? 0) > 0) {
			results.push({ id, ok: false, message: 'Masih memiliki KRS' });
			continue;
		}
		await deleteCourseDb(getPool(), { id });
		results.push({ id, ok: true });
	}
	if (results.some((r) => r.ok)) {
		invalidateConflictAuditCache();
		await getCourses().refresh();
	}
	return { success: true, results };
});

export const bulkUpdateCourses = form(
	v.object({
		ids: v.pipe(v.string(), v.minLength(1)),
		credits: v.optional(v.string()),
		studyProgramId: v.optional(v.string()),
		lecturerId: v.optional(v.string())
	}),
	async (data) => {
		await requireRole(['ADMIN']);
		const ids = data.ids.split(',').filter(Boolean);
		if (!ids.length) throw error(400, 'Tidak ada mata kuliah dipilih');
		if (ids.length > 200) throw error(400, 'Maksimal 200 mata kuliah sekaligus');
		const results: Array<{ id: string; ok: boolean; message?: string }> = [];
		for (const id of ids) {
			const [course] = await selectCourses(getPool(), { where: [['id', '=', id]] });
			if (!course) {
				results.push({ id, ok: false, message: 'Mata kuliah tidak ditemukan' });
				continue;
			}
			await updateCourseDb(
				getPool(),
				{
					name: course.name ?? '',
					credits: data.credits ? Number(data.credits) : (course.credits ?? 2),
					study_program_id: data.studyProgramId || course.study_program_id || '',
					lecturer_id: data.lecturerId || course.lecturer_id || ''
				},
				{ id }
			);
			results.push({ id, ok: true });
		}
		if (results.some((r) => r.ok)) {
			invalidateConflictAuditCache();
			await getCourses().refresh();
		}
		return { success: true, results };
	}
);
