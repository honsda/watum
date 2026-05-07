export function syncSelectedDetail<T>(options: {
	id: string | null | undefined;
	load: (id: string) => Promise<T>;
	isCurrent: () => boolean;
	apply: (full: T) => void;
}) {
	if (!options.id) return;

	void options.load(options.id).then((full) => {
		if (!options.isCurrent()) return;
		options.apply(full);
	});
}

export function selectEntityRecord<Item extends { id?: string | null }, Full = Item>(options: {
	item: Item;
	beforeSelect?: () => void;
	setSelectedId: (id: string | null) => void;
	setSelectedRecord: (value: Item | Full) => void;
	applyInitial?: (item: Item) => void;
	loadFull?: (id: string) => Promise<Full>;
	isCurrent?: () => boolean;
	applyLoaded?: (full: Full) => void;
}) {
	options.beforeSelect?.();
	const id = options.item.id ?? null;
	options.setSelectedId(id);
	options.setSelectedRecord(options.item);
	options.applyInitial?.(options.item);

	if (!options.loadFull || !id || !options.isCurrent) return;

	syncSelectedDetail({
		id,
		load: options.loadFull,
		isCurrent: options.isCurrent,
		apply: (full) => {
			options.setSelectedRecord(full);
			options.applyLoaded?.(full);
		}
	});
}
