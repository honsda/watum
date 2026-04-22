import * as v from 'valibot';
import { query, form } from '$app/server';
import { clearSession, getUser, loginAndSetSession } from '$lib/server/auth';

const loginSchema = v.object({
	email: v.pipe(v.string(), v.email('Email tidak valid')),
	password: v.string()
});

export const getCurrentUser = query(async () => {
	const user = await getUser();
	return user;
});

export const loginUser = form(loginSchema, async (data) => {
	const session = await loginAndSetSession(data.email, data.password);
	return {
		success: true,
		user: session.user,
		accessToken: session.accessToken
	};
});

export const logoutUser = form(v.object({}), async () => {
	await clearSession();
	return { success: true };
});
