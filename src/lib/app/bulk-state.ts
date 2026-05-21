export type BulkSelectionState = Record<string, Set<string>>;

export function toggleBulkId(state: BulkSelectionState, kind: string, id: string) {
	const next = new Set(state[kind] ?? []);
	if (next.has(id)) {
		next.delete(id);
	} else {
		next.add(id);
	}
	return { ...state, [kind]: next };
}

export function toggleAllBulkIds(state: BulkSelectionState, kind: string, ids: string[]) {
	const current = state[kind] ?? new Set();
	const next = current.size === ids.length && ids.length > 0 ? new Set<string>() : new Set(ids);
	return { ...state, [kind]: next };
}

export function clearBulkIds(state: BulkSelectionState, kind: string) {
	return { ...state, [kind]: new Set<string>() };
}

export function getBulkIds(state: BulkSelectionState, kind: string): string[] {
	return [...(state[kind] ?? [])];
}

export function countBulkIds(state: BulkSelectionState, kind: string): number {
	return state[kind]?.size ?? 0;
}
