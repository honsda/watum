export function createSimpleSearchRequester<TQuery>(options: {
	getSearchTerm: () => string;
	normalizeSearchValue: (value: string) => string | undefined;
	getAll: (params: { cursor?: string }) => TQuery;
	search: (params: { cursor?: string; q: string }) => TQuery;
}) {
	return (cursor: string | null) => {
		const q = options.normalizeSearchValue(options.getSearchTerm());
		return q
			? options.search({ cursor: cursor ?? undefined, q })
			: options.getAll({ cursor: cursor ?? undefined });
	};
}
