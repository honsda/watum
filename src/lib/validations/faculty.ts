import * as v from 'valibot';

export const facultySchema = v.object({
	id: v.pipe(v.string(), v.minLength(1, 'ID wajib diisi')),
	name: v.pipe(v.string(), v.minLength(1, 'Nama fakultas wajib diisi'))
});