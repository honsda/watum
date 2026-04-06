import * as v from 'valibot';

export const userRoleSchema = v.picklist(['ADMIN', 'STUDENT', 'LECTURER']);

export const userSchema = v.object({
	email: v.pipe(v.string(), v.email('Email tidak valid')),
	password: v.pipe(v.string(), v.minLength(6, 'Password minimal 6 karakter')),
	role: userRoleSchema,
	studentId: v.optional(v.string()),
	lecturerId: v.optional(v.string())
});