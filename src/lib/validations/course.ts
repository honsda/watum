import * as v from 'valibot';

export const courseCreateSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Nama mata kuliah wajib diisi')),
	credits: v.pipe(v.number(), v.minValue(1), v.maxValue(6)),
	studyProgramId: v.pipe(v.string(), v.minLength(1, 'Program studi wajib dipilih')),
	lecturerId: v.pipe(v.string(), v.minLength(1, 'Dosen wajib dipilih'))
});

export const courseSchema = v.object({
	id: v.pipe(v.string(), v.minLength(1, 'ID wajib diisi')),
	...courseCreateSchema.entries
});
