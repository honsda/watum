import { error, type Handle, type HandleServerError } from '@sveltejs/kit';
import { getUser } from '$lib/server/auth';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function hasTrustedCsrfOrigin(event: Parameters<Handle>[0]['event']) {
	const origin = event.request.headers.get('origin');
	if (origin) {
		return origin === event.url.origin;
	}

	const referer = event.request.headers.get('referer');
	if (!referer) {
		return false;
	}

	try {
		return new URL(referer).origin === event.url.origin;
	} catch {
		return false;
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	if (!SAFE_METHODS.has(event.request.method) && !hasTrustedCsrfOrigin(event)) {
		throw error(403, 'Invalid CSRF origin');
	}

	event.locals.user = await getUser();
	return resolve(event);
};

export const handleError: HandleServerError = async ({ error, status, message }) => {
	console.error('Error Occurred:', error);
	return {
		message: status === 500 ? 'Terjadi kesalahan pada server' : message
	};
};
