import { resolveRemoteQuery } from '$lib/app/remote-utils';

type LimitedCollectionResponse<T> = {
	items: T[];
	limit: number;
	hasMore: boolean;
	nextCursor: string | null;
};

export async function loadCollection<K extends string>(options: {
	key: K;
	loader: () => Promise<void>;
	fallback: string;
	clearIssue: (key: K) => void;
	setIssue: (key: K, message: string) => void;
	errorMessage: (error: unknown, fallback: string) => string;
}) {
	try {
		await options.loader();
		options.clearIssue(options.key);
	} catch (error) {
		options.setIssue(options.key, options.errorMessage(error, options.fallback));
	}
}

export async function loadCollectionPage<T, K extends string>(options: {
	key: K;
	cursor: string | null;
	request: (
		cursor: string | null
	) => Promise<LimitedCollectionResponse<T>> | { run: () => Promise<LimitedCollectionResponse<T>> };
	assign: (items: T[]) => void;
	meta?: { history?: Array<string | null>; pageNumber?: number };
	setPagination: (key: K, patch: Record<string, unknown>) => void;
	getPagination: (key: K) => {
		history: Array<string | null>;
		pageNumber: number;
	};
	markLoaded: (key: K) => void;
}) {
	options.setPagination(options.key, { loading: true });
	try {
		const result = await resolveRemoteQuery(options.request(options.cursor));
		options.assign(result.items);
		const pageState = options.getPagination(options.key);
		const nextHistory = options.meta?.history ?? (options.cursor == null ? [] : pageState.history);
		const nextPageNumber =
			options.meta?.pageNumber ?? (options.cursor == null ? 1 : pageState.pageNumber);
		options.setPagination(options.key, {
			currentCursor: options.cursor,
			nextCursor: result.nextCursor,
			history: nextHistory,
			pageNumber: nextPageNumber,
			limit: result.limit,
			hasMore: result.hasMore,
			loading: false,
			itemCount: result.items.length
		});
		options.markLoaded(options.key);
	} catch (error) {
		options.setPagination(options.key, { loading: false });
		throw error;
	}
}
