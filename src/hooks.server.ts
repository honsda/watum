import { error, type Handle, type HandleServerError } from '@sveltejs/kit';
import { getUser } from '$lib/server/auth';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function fixEventUrlForProxy(event: Parameters<Handle>[0]['event']) {
	const forwardedProto = event.request.headers.get('x-forwarded-proto');
	const forwardedHost = event.request.headers.get('x-forwarded-host') ?? event.request.headers.get('host');
	if (forwardedProto && forwardedHost) {
		// Mutate the URL object in place so every reader (including SvelteKit's
		// internal remote function origin check) sees the public origin.
		event.url.protocol = forwardedProto + ':';
		event.url.host = forwardedHost;
	}
}

function getPublicOrigin(event: Parameters<Handle>[0]['event']): string {
	const trustedOrigin = process.env.ORIGIN?.trim() ?? '';
	if (trustedOrigin) {
		return trustedOrigin;
	}
	const forwardedProto = event.request.headers.get('x-forwarded-proto');
	const forwardedHost = event.request.headers.get('x-forwarded-host') ?? event.request.headers.get('host');
	if (forwardedProto && forwardedHost) {
		return `${forwardedProto}://${forwardedHost}`;
	}
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
	// CRITICAL: rewrite event.url before resolve() so SvelteKit's remote
	// function origin check sees the public origin, not the internal one.
	fixEventUrlForProxy(event);

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
