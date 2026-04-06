import * as v from 'valibot';

export const studentSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Nama wajib diisi')),
	email: v.pipe(v.string(), v.email('Email tidak valid')),
	phone: v.optional(v.string()),
	address: v.optional(v.string()),
	yearAdmitted: v.pipe(v.number(), v.minValue(2000), v.maxValue(2100)),
	studyProgramId: v.string()
});
