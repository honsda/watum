import * as v from 'valibot';

export const studyProgramSchema = v.object({
	id: v.pipe(v.string(), v.minLength(1, 'ID wajib diisi')),
	name: v.pipe(v.string(), v.minLength(1, 'Nama wajib diisi')),
	head: v.pipe(v.string(), v.minLength(1, 'Nama ketua wajib diisi')),
	facultyId: v.string()
});