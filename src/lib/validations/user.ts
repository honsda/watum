import * as v from 'valibot';

export const userRoleSchema = v.picklist(['ADMIN', 'STUDENT', 'LECTURER']);

export const userPasswordSchema = v.pipe(
	v.string(),
	v.minLength(8, 'Password minimal 8 karakter'),
	v.maxLength(128, 'Password maksimal 128 karakter')
);

export const userUpdatePasswordSchema = v.union([v.literal(''), userPasswordSchema]);

export const userSchema = v.object({
	email: v.pipe(v.string(), v.email('Email tidak valid')),
	password: userPasswordSchema,
	role: userRoleSchema,
	studentId: v.optional(v.pipe(v.string(), v.minLength(1))),
	lecturerId: v.optional(v.pipe(v.string(), v.minLength(1)))
});

export const userUpdateSchema = v.object({
	email: v.pipe(v.string(), v.email('Email tidak valid')),
	password: userUpdatePasswordSchema,
	role: userRoleSchema,
	studentId: v.optional(v.pipe(v.string(), v.minLength(1))),
	lecturerId: v.optional(v.pipe(v.string(), v.minLength(1)))
});
