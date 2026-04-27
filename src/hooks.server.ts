import { error, type Handle, type HandleServerError } from '@sveltejs/kit';
import { getUser } from '$lib/server/auth';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function getPublicOrigin(event: Parameters<Handle>[0]['event']): string {
	// Read env at request time (not module load) — Bun may load env differently
	const trustedOrigin = process.env.ORIGIN?.trim() ?? '';
	if (trustedOrigin) {
		return trustedOrigin;
	}

	// Derive from X-Forwarded-* headers (most reverse proxies set these)
	const forwardedProto = event.request.headers.get('x-forwarded-proto');
	const forwardedHost = event.request.headers.get('x-forwarded-host') ?? event.request.headers.get('host');
	if (forwardedProto && forwardedHost) {
		return `${forwardedProto}://${forwardedHost}`;
	}

	// Fall back to the URL the server sees
	return event.url.origin;
}

function hasTrustedCsrfOrigin(event: Parameters<Handle>[0]['event']): { trusted: boolean; debug: Record<string, string> } {
	const publicOrigin = getPublicOrigin(event);
	const origin = event.request.headers.get('origin');
	const referer = event.request.headers.get('referer');
	const forwardedProto = event.request.headers.get('x-forwarded-proto') ?? '';
	const forwardedHost = event.request.headers.get('x-forwarded-host') ?? event.request.headers.get('host') ?? '';

	const debug = {
		publicOrigin,
		origin: origin ?? '',
		referer: referer ?? '',
		forwardedProto,
		forwardedHost,
		eventUrlOrigin: event.url.origin,
		envOrigin: process.env.ORIGIN?.trim() ?? ''
	};

	if (origin) {
		return { trusted: origin === publicOrigin, debug };
	}

	if (!referer) {
		return { trusted: false, debug };
	}

	try {
		return { trusted: new URL(referer).origin === publicOrigin, debug };
	} catch {
		return { trusted: false, debug };
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	if (!SAFE_METHODS.has(event.request.method)) {
		const { trusted, debug } = hasTrustedCsrfOrigin(event);
		if (!trusted) {
			return new Response(
				JSON.stringify({ message: 'Invalid CSRF origin', debug }),
				{ status: 403, headers: { 'content-type': 'application/json' } }
			);
		}
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
