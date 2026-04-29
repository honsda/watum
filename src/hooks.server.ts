import { error, type Handle, type HandleServerError } from '@sveltejs/kit';
import { getUser } from '$lib/server/auth';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function getPublicOrigin(event: Parameters<Handle>[0]['event']): string {
	const trustedOrigin = process.env.ORIGIN?.trim();
	if (trustedOrigin) {
		return trustedOrigin;
	}
	if (process.env.NODE_ENV === 'production') {
		return event.url.origin;
	}
	const forwardedProto = event.request.headers.get('x-forwarded-proto');
	const forwardedHost =
		event.request.headers.get('x-forwarded-host') ?? event.request.headers.get('host');
	if (forwardedProto && forwardedHost) {
		return `${forwardedProto}://${forwardedHost}`;
	}
	return event.url.origin;
}

function hasTrustedCsrfOrigin(event: Parameters<Handle>[0]['event']) {
	const publicOrigin = getPublicOrigin(event);
	const origin = event.request.headers.get('origin');

	if (origin) {
		return origin === publicOrigin;
	}

	const referer = event.request.headers.get('referer');
	if (!referer) return false;

	try {
		return new URL(referer).origin === publicOrigin;
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
