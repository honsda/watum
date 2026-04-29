import { browser } from '$app/environment';

const LOADING_FETCH_PATCH = Symbol.for('watum.loadingFetchPatch');

let pendingCount = $state(0);

export function getLoadingState() {
	return {
		get isLoading() {
			return pendingCount > 0;
		},
		get count() {
			return pendingCount;
		}
	};
}

export function incrementLoading() {
	pendingCount++;
}

export function decrementLoading() {
	pendingCount = Math.max(0, pendingCount - 1);
}

let interceptorInstalled = false;

export function installLoadingInterceptor() {
	if (!browser || interceptorInstalled) return;
	interceptorInstalled = true;

	const currentFetch = window.fetch as typeof window.fetch & { [LOADING_FETCH_PATCH]?: boolean };
	if (currentFetch[LOADING_FETCH_PATCH]) return;
	const wrappedBaseFetch = currentFetch.bind(window);

	const wrappedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

		// Only track same-origin requests to remote endpoints and API calls
		if (typeof url === 'string') {
			const isRemote = url.includes('/_app/remote/');
			const isApi =
				url.startsWith(window.location.origin) && (url.includes('/auth/') || url.includes('/api/'));
			if (isRemote || isApi) {
				incrementLoading();
				try {
					return await wrappedBaseFetch(input, init);
				} finally {
					decrementLoading();
				}
			}
		}

		return wrappedBaseFetch(input, init);
	};

	wrappedFetch[LOADING_FETCH_PATCH] = true;
	window.fetch = wrappedFetch;
}
