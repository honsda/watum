export function prefixSearchPattern(value: string | null | undefined): string | undefined {
	const trimmed = value?.trim();
	if (!trimmed) return undefined;
	return `${trimmed}%`;
}

export function containsSearchPattern(value: string | null | undefined): string | undefined {
	const trimmed = value?.trim();
	if (!trimmed) return undefined;
	return `%${trimmed}%`;
}
