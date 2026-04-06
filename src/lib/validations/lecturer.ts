import * as v from 'valibot';

export const lecturerSchema = v.object({
	id: v.pipe(v.string(), v.minLength(1, 'ID wajib diisi')),
	name: v.pipe(v.string(), v.minLength(1, 'Nama wajib diisi')),
	email: v.pipe(v.string(), v.email('Email tidak valid')),
	phone: v.optional(v.string()),
	address: v.optional(v.string())
});