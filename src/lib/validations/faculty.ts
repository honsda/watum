import * as v from 'valibot';

export const facultyCreateSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Nama fakultas wajib diisi'))
});

export const facultySchema = v.object({
	id: v.pipe(v.string(), v.minLength(1, 'ID wajib diisi')),
	...facultyCreateSchema.entries
});
