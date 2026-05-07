export async function resolveRemoteQuery<T>(
	query: Promise<T> | { run: () => Promise<T> }
): Promise<T> {
	try {
		return await (query as Promise<T>);
	} catch (error) {
		if (
			typeof query === 'object' &&
			query != null &&
			'run' in query &&
			typeof query.run === 'function' &&
			(error as Error)?.message?.includes(
				'This query was not created in a reactive context and is limited to calling `.run`, `.refresh`, and `.set`.'
			)
		) {
			return await query.run();
		}

		throw error;
	}
}

export function errorMessage(error: unknown, fallback: string) {
	return (
		(error as { body?: { message?: string }; message?: string })?.body?.message ||
		(error as Error)?.message ||
		fallback
	);
}

export function normalizedSearchValue(value: string) {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

export function mergeItemsById<T extends { id?: string }>(current: T[], next: T[]) {
	const itemsById = new Map<string, T>();
	const anonymousItems: T[] = [];
	for (const item of [...current, ...next]) {
		if (!item.id) {
			anonymousItems.push(item);
			continue;
		}
		itemsById.set(item.id, item);
	}
	return [...itemsById.values(), ...anonymousItems];
}
