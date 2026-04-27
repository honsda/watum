import { error, type Handle, type HandleServerError } from '@sveltejs/kit';
import { getUser } from '$lib/server/auth';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TRUSTED_ORIGIN = process.env.ORIGIN?.trim();

function getPublicOrigin(event: Parameters<Handle>[0]['event']): string {
	// 1. Explicit ORIGIN env var (set in docker-entrypoint.sh from COOLIFY_FQDN)
	if (TRUSTED_ORIGIN) {
		return TRUSTED_ORIGIN;
	}

	// 2. Derive from X-Forwarded-* headers (most reverse proxies set these)
	const forwardedProto = event.request.headers.get('x-forwarded-proto');
	const forwardedHost = event.request.headers.get('x-forwarded-host') ?? event.request.headers.get('host');
	if (forwardedProto && forwardedHost) {
		return `${forwardedProto}://${forwardedHost}`;
	}

	// 3. Fall back to the URL the server sees (works for direct access, breaks behind proxy)
	return event.url.origin;
}

function hasTrustedCsrfOrigin(event: Parameters<Handle>[0]['event']) {
	const publicOrigin = getPublicOrigin(event);
	const origin = event.request.headers.get('origin');

	if (origin) {
		const trusted = origin === publicOrigin;
		if (!trusted) {
			console.log('[CSRF] Rejected origin:', origin, '!== publicOrigin:', publicOrigin);
		}
		return trusted;
	}

	const referer = event.request.headers.get('referer');
	if (!referer) {
		console.log('[CSRF] No origin or referer header');
		return false;
	}

	try {
		const trusted = new URL(referer).origin === publicOrigin;
		if (!trusted) {
			console.log('[CSRF] Rejected referer:', new URL(referer).origin, '!== publicOrigin:', publicOrigin);
		}
		return trusted;
	} catch {
		console.log('[CSRF] Invalid referer URL:', referer);
		return false;
	}
}

const AUTH_ENDPOINTS = new Set(['/auth/login', '/auth/refresh', '/_app/remote/4igj21/loginUser']);

export const handle: Handle = async ({ event, resolve }) => {
	const isAuthEndpoint = AUTH_ENDPOINTS.has(event.url.pathname) || event.url.pathname.endsWith('/loginUser');
	if (!isAuthEndpoint && !SAFE_METHODS.has(event.request.method) && !hasTrustedCsrfOrigin(event)) {
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
