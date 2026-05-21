import type { ViewId } from '$lib/app/navigation';

export function readViewFromSearch(
	search: string,
	viewCatalog: Record<string, unknown>
): ViewId | null {
	const rawView = new URLSearchParams(search).get('view');
	if (!rawView) return null;
	return rawView in viewCatalog ? (rawView as ViewId) : null;
}

export function buildViewUrl(href: string, view: ViewId) {
	const url = new URL(href);
	if (view === 'dashboard') {
		url.searchParams.delete('view');
	} else {
		url.searchParams.set('view', view);
	}
	return `${url.pathname}${url.search}${url.hash}`;
}
