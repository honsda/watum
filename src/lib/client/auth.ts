import { browser } from '$app/environment';

const REFRESH_ENDPOINT_PATH = '/auth/refresh';
const PROACTIVE_REFRESH_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes
const REFRESH_UNAVAILABLE_COOLDOWN_MS = 30 * 1000; // 30 seconds

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let fetchInstalled = false;
let refreshUnavailable = false;
let refreshUnavailableAt = 0;
let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;

const nativeFetch = browser ? window.fetch.bind(window) : fetch;

function resolveUrl(input: RequestInfo | URL) {
	if (input instanceof URL) {
		return input;
	}

	if (input instanceof Request) {
		return new URL(input.url, window.location.origin);
	}

	return new URL(input, window.location.origin);
}

function isRefreshRequest(url: URL) {
	return url.origin === window.location.origin && url.pathname === REFRESH_ENDPOINT_PATH;
}

function shouldAttachAccessToken(url: URL) {
	return url.origin === window.location.origin && !isRefreshRequest(url);
}

function buildAuthorizedRequest(baseRequest: Request, token: string) {
	const headers = new Headers(baseRequest.headers);
	headers.set('authorization', `Bearer ${token}`);

	return new Request(baseRequest, { headers });
}

async function requestNewAccessToken() {
	const response = await nativeFetch(REFRESH_ENDPOINT_PATH, {
		method: 'POST',
		credentials: 'same-origin',
		headers: {
			accept: 'application/json'
		}
	});

	if (response.status === 204) {
		accessToken = null;
		refreshUnavailable = true;
		refreshUnavailableAt = Date.now();
		return null;
	}

	if (!response.ok) {
		accessToken = null;
		refreshUnavailable = response.status === 401 || response.status === 403;
		refreshUnavailableAt = Date.now();
		return null;
	}

	const payload = (await response.json()) as { accessToken?: string };
	accessToken = typeof payload.accessToken === 'string' ? payload.accessToken : null;
	refreshUnavailable = accessToken == null;
	if (refreshUnavailable) {
		refreshUnavailableAt = Date.now();
	}
	scheduleProactiveRefresh();
	return accessToken;
}

export function setAccessToken(token: string | null) {
	accessToken = token;
	refreshUnavailable = token == null;
}

export function clearAccessToken() {
	accessToken = null;
	refreshUnavailable = true;
}

export async function ensureAccessToken(force = false) {
	if (!browser) {
		return null;
	}

	if (!force && accessToken) {
		return accessToken;
	}

	if (refreshUnavailable && Date.now() - refreshUnavailableAt < REFRESH_UNAVAILABLE_COOLDOWN_MS) {
		return null;
	}

	if (refreshPromise) {
		return refreshPromise;
	}

	refreshUnavailable = false;
	refreshPromise = requestNewAccessToken().finally(() => {
		refreshPromise = null;
	});

	return refreshPromise;
}

function scheduleProactiveRefresh() {
	if (!browser) return;
	if (proactiveRefreshTimer) {
		clearTimeout(proactiveRefreshTimer);
	}
	proactiveRefreshTimer = setTimeout(() => {
		void ensureAccessToken(true);
	}, PROACTIVE_REFRESH_INTERVAL_MS);
}

function handleVisibilityChange() {
	if (!browser || document.hidden) return;
	// When user returns to the tab, allow one retry if refresh was previously unavailable
	if (refreshUnavailable && Date.now() - refreshUnavailableAt >= REFRESH_UNAVAILABLE_COOLDOWN_MS) {
		refreshUnavailable = false;
	}
	// Proactively refresh if we don't have a token
	if (!accessToken && !refreshUnavailable) {
		void ensureAccessToken();
	}
}

function installAuthFetch() {
	if (!browser || fetchInstalled) {
		return;
	}

	fetchInstalled = true;

	document.addEventListener('visibilitychange', handleVisibilityChange);

	window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = resolveUrl(input);
		if (!shouldAttachAccessToken(url)) {
			return nativeFetch(input, init);
		}

		const baseRequest = input instanceof Request ? input : new Request(input, init);
		const existingAuthorization = new Headers(baseRequest.headers).has('authorization');

		let token = existingAuthorization ? null : accessToken;
		if (!existingAuthorization && !token) {
			token = await ensureAccessToken();
		}

		const initialRequest = token
			? buildAuthorizedRequest(baseRequest.clone(), token)
			: baseRequest.clone();
		let response = await nativeFetch(initialRequest);

		if (existingAuthorization || response.status !== 401) {
			return response;
		}

		const refreshedToken = await ensureAccessToken(true);
		if (!refreshedToken || refreshedToken === token) {
			return response;
		}

		response = await nativeFetch(buildAuthorizedRequest(baseRequest.clone(), refreshedToken));
		return response;
	};
}

installAuthFetch();
