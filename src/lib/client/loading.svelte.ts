import { browser } from '$app/environment';

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

	const nativeFetch = window.fetch.bind(window);

	window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

		// Only track same-origin requests to remote endpoints and API calls
		if (typeof url === 'string') {
			const isRemote = url.includes('/_app/remote/');
			const isApi =
				url.startsWith(window.location.origin) && (url.includes('/auth/') || url.includes('/api/'));
			if (isRemote || isApi) {
				incrementLoading();
				try {
					return await nativeFetch(input, init);
				} finally {
					decrementLoading();
				}
			}
		}

		return nativeFetch(input, init);
	};
}
