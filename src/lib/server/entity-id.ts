import type { Connection } from 'mysql2/promise';
import { withTransaction } from '$lib/server/db';

export function generateSequentialId(
	existingIds: Array<string | null | undefined>,
	prefix: string,
	width = 3
): string {
	const taken = new Set(existingIds.filter((value): value is string => Boolean(value)));
	const matcher = new RegExp(`^${prefix}(\\d+)$`);
	let nextNumber = 1;

	for (const id of taken) {
		const match = matcher.exec(id);
		if (!match) continue;
		nextNumber = Math.max(nextNumber, Number(match[1]) + 1);
	}

	let candidate = `${prefix}${String(nextNumber).padStart(width, '0')}`;
	while (taken.has(candidate)) {
		nextNumber += 1;
		candidate = `${prefix}${String(nextNumber).padStart(width, '0')}`;
	}

	return candidate;
}

function isPrimaryKeyDuplicate(err: unknown): boolean {
	if (!err || typeof err !== 'object' || !('code' in err)) return false;
	const code = (err as { code?: string }).code;
	const message = String(
		(err as { sqlMessage?: string; message?: string }).sqlMessage ??
			(err as { message?: string }).message ??
			''
	);
	return code === 'ER_DUP_ENTRY' && message.includes('PRIMARY');
}

export async function insertWithGeneratedId<T>(options: {
	prefix: string;
	width?: number;
	readIds: (connection: Connection) => Promise<Array<string | null | undefined>>;
	insert: (connection: Connection, id: string) => Promise<T>;
	maxRetries?: number;
}): Promise<{ id: string; result: T }> {
	const { prefix, width = 3, readIds, insert, maxRetries = 3 } = options;
	let lastErr: unknown;

	for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
		try {
			return await withTransaction(async (connection) => {
				const id = generateSequentialId(await readIds(connection), prefix, width);
				const result = await insert(connection, id);
				return { id, result };
			});
		} catch (err) {
			lastErr = err;
			if (!isPrimaryKeyDuplicate(err) || attempt === maxRetries) throw err;
		}
	}

	throw lastErr;
}
