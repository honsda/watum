import * as v from 'valibot';
import { query, form } from '$app/server';
import { login, getUser, setSession, clearSession } from '$lib/server/auth';

const loginSchema = v.object({
	email: v.pipe(v.string(), v.email('Email tidak valid')),
	password: v.string()
});

export const getCurrentUser = query(async () => {
	const user = await getUser();
	return user;
});

export const loginUser = form(loginSchema, async (data) => {
	const user = await login(data.email, data.password);
	setSession(user.id);
	return {
		success: true,
		user
	};
});

export const logoutUser = form(v.object({}), async () => {
	clearSession();
	await getCurrentUser().refresh();
	return { success: true };
});
