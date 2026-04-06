import type { Handle, HandleServerError } from '@sveltejs/kit';
import { getUser } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = await getUser();
	return resolve(event);
};

export const handleError: HandleServerError = async ({ error, status, message }) => {
	console.error('Error Occurred:', error);
	return {
		message: status === 500 ? 'Terjadi kesalahan pada server' : message
	};
};
