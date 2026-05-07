type OptionListResult<T> = {
	items: T[];
	hasMore: boolean;
	nextCursor: string | null;
};

export async function refreshOptionList<T>(options: {
	cursor: string | null;
	nextToken: () => number;
	isCurrent: (token: number) => boolean;
	setLoading: (value: boolean) => void;
	setIssue: (value: string | null) => void;
	fetch: (cursor: string | null) => Promise<OptionListResult<T>>;
	assignItems: (items: T[], append: boolean) => void;
	setHasMore: (value: boolean) => void;
	setNextCursor: (value: string | null) => void;
	errorMessage: (error: unknown, fallback: string) => string;
	issueFallback: string;
}) {
	const token = options.nextToken();
	const append = options.cursor != null;
	options.setLoading(true);
	options.setIssue(null);
	try {
		const result = await options.fetch(options.cursor);
		if (!options.isCurrent(token)) return;
		options.assignItems(result.items, append);
		options.setHasMore(result.hasMore);
		options.setNextCursor(result.nextCursor);
	} catch (error) {
		if (!options.isCurrent(token)) return;
		options.setIssue(options.errorMessage(error, options.issueFallback));
	} finally {
		if (options.isCurrent(token)) {
			options.setLoading(false);
		}
	}
}

export function queueOptionRefresh(options: {
	browser: boolean;
	currentTimer: number | null;
	setTimer: (value: number | null) => void;
	run: () => void;
	delay: number;
	clearTimer: (value: number) => void;
	setTimeoutFn: (callback: () => void, delay: number) => number;
}) {
	if (!options.browser) {
		options.run();
		return;
	}
	if (options.currentTimer != null) {
		options.clearTimer(options.currentTimer);
	}
	options.setTimer(
		options.setTimeoutFn(() => {
			options.setTimer(null);
			options.run();
		}, options.delay)
	);
}

export function canLoadMoreOptionList(options: {
	loading: boolean;
	hasMore: boolean;
	nextCursor: string | null;
}) {
	return !options.loading && options.hasMore && Boolean(options.nextCursor);
}
