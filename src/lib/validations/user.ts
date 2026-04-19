import * as v from 'valibot';

export const userRoleSchema = v.picklist(['ADMIN', 'STUDENT', 'LECTURER']);

export const userPasswordSchema = v.pipe(v.string(), v.minLength(6, 'Password minimal 6 karakter'));

export const userUpdatePasswordSchema = v.union([v.literal(''), userPasswordSchema]);

export const userSchema = v.object({
	email: v.pipe(v.string(), v.email('Email tidak valid')),
	password: userPasswordSchema,
	role: userRoleSchema,
	studentId: v.optional(v.string()),
	lecturerId: v.optional(v.string())
});

export const userUpdateSchema = v.object({
	email: v.pipe(v.string(), v.email('Email tidak valid')),
	password: userUpdatePasswordSchema,
	role: userRoleSchema,
	studentId: v.optional(v.string()),
	lecturerId: v.optional(v.string())
});
