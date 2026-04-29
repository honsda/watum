export function prefixSearchPattern(value: string | null | undefined): string | undefined {
	const trimmed = value?.trim();
	if (!trimmed) return undefined;
	return `${trimmed}%`;
}

export function wordPrefixSearchPattern(value: string | null | undefined): string | undefined {
	const trimmed = value?.trim();
	if (!trimmed) return undefined;
	return `% ${trimmed}%`;
}

export function containsSearchPattern(value: string | null | undefined): string | undefined {
	const trimmed = value?.trim();
	if (!trimmed) return undefined;
	return `%${trimmed}%`;
}

/**
 * Build a MariaDB FULLTEXT boolean-mode search string.
 * Splits on whitespace and appends * to each word for prefix matching.
 * Example: "John Doe" -> "John* Doe*"
 */
export function fulltextSearchPattern(value: string | null | undefined): string | undefined {
	const trimmed = value?.trim();
	if (!trimmed) return undefined;
	return trimmed
		.split(/\s+/)
		.map((w) => w.replace(/[+\-<>()~*"@]/g, ' ').trim())
		.filter(Boolean)
		.map((w) => w + '*')
		.join(' ');
}

type KeysetCursorPayload = {
	kind: string;
	value: string;
	id: string;
};

export function encodeKeysetCursor(
	kind: string,
	value: string | null | undefined,
	id: string | null | undefined
) {
	if (!value || !id) return null;
	return Buffer.from(
		JSON.stringify({ kind, value, id } satisfies KeysetCursorPayload),
		'utf8'
	).toString('base64url');
}

export function decodeKeysetCursor(
	cursor: string | null | undefined,
	expectedKind: string
): KeysetCursorPayload | null {
	if (!cursor) return null;
	try {
		const parsed = JSON.parse(
			Buffer.from(cursor, 'base64url').toString('utf8')
		) as Partial<KeysetCursorPayload>;
		if (parsed.kind !== expectedKind || !parsed.value || !parsed.id) return null;
		return {
			kind: parsed.kind,
			value: parsed.value,
			id: parsed.id
		};
	} catch {
		return null;
	}
}
