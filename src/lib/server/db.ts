import { env } from '$env/dynamic/private';
import {
	createPool,
	type Pool,
	type PoolConnection,
	type PoolOptions,
	type RowDataPacket,
	type ResultSetHeader
} from 'mysql2/promise';

export type { RowDataPacket, ResultSetHeader, PoolConnection };

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 150;
const CONNECT_TIMEOUT_MS = 500;
const RETIRED_POOL_GRACE_MS = 5000;

type RetryableDbOperation<T> = () => Promise<T>;

function isTimeoutError(err: unknown): boolean {
	if (err instanceof Error && err.message === 'Pool is closed.') {
		return true;
	}

	if (err && typeof err === 'object' && 'code' in err) {
		const code = (err as { code?: string }).code;
		return (
			code === 'ETIMEDOUT' ||
			code === 'ECONNRESET' ||
			code === 'ECONNREFUSED' ||
			code === 'EPIPE' ||
			code === 'PROTOCOL_CONNECTION_LOST' ||
			code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR'
		);
	}
	return false;
}

export async function withRetry<T>(
	fn: RetryableDbOperation<T>,
	onRetry?: (err: unknown, attempt: number) => Promise<void> | void
): Promise<T> {
	let lastErr: unknown;
	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		try {
			return await fn();
		} catch (err) {
			lastErr = err;
			if (!isTimeoutError(err) || attempt === MAX_RETRIES) throw err;
			await onRetry?.(err, attempt);
			console.warn(
				`DB timeout (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS}ms...`
			);
			await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
		}
	}
	throw lastErr;
}

export async function retryRead<T>(fn: RetryableDbOperation<T>): Promise<T> {
	return withRetry(fn, () => recyclePool());
}

let pool: Pool | null = null;
let poolProxy: Pool | null = null;
const retiredPools = new Set<Pool>();
let recyclePromise: Promise<void> | null = null;

function poolOptions(): PoolOptions {
	return {
		host: env.DB_HOST || 'localhost',
		user: env.DB_USER || 'root',
		password: env.DB_PASSWORD || '',
		database: env.DB_NAME || 'akademik_db',
		port: parseInt(env.DB_PORT || '3306'),
		timezone: '+00:00',
		waitForConnections: true,
		connectionLimit: 10,
		maxIdle: 10,
		idleTimeout: 60000,
		queueLimit: 0,
		enableKeepAlive: true,
		keepAliveInitialDelay: 10000,
		connectTimeout: CONNECT_TIMEOUT_MS
	};
}

function createBasePool(): Pool {
	return createPool(poolOptions());
}

function ensurePool(): Pool {
	if (!pool) {
		pool = createBasePool();
	}
	return pool;
}

async function recyclePool(): Promise<void> {
	if (recyclePromise) {
		await recyclePromise;
		return;
	}

	recyclePromise = (async () => {
		const stalePool = pool;
		pool = createBasePool();

		if (stalePool && stalePool !== pool && !retiredPools.has(stalePool)) {
			retiredPools.add(stalePool);
			setTimeout(() => {
				void stalePool
					.end()
					.catch((err) => {
						console.warn('Failed to close retired DB pool after retryable error.', err);
					})
					.finally(() => {
						retiredPools.delete(stalePool);
					});
			}, RETIRED_POOL_GRACE_MS);
		}
	})();

	try {
		await recyclePromise;
	} finally {
		recyclePromise = null;
	}
}

function bindPoolMethod(method: keyof Pool) {
	const currentPool = ensurePool();
	const value = currentPool[method];
	return typeof value === 'function' ? value.bind(currentPool) : value;
}

export function getPool(): Pool {
	if (!poolProxy) {
		poolProxy = new Proxy({} as Pool, {
			get(_target, property) {
				if (property === 'query') {
					return (...args: Parameters<Pool['query']>) => ensurePool().query(...args);
				}

				if (property === 'execute') {
					return (...args: Parameters<Pool['execute']>) => ensurePool().execute(...args);
				}

				if (property === 'getConnection') {
					return () =>
						withRetry(
							() => ensurePool().getConnection(),
							() => recyclePool()
						);
				}

				if (property === 'end') {
					return async () => {
						const currentPool = pool;
						pool = null;
						const poolsToClose = [currentPool, ...retiredPools].filter((item): item is Pool =>
							Boolean(item)
						);
						retiredPools.clear();
						await Promise.allSettled(poolsToClose.map((item) => item.end()));
					};
				}

				return bindPoolMethod(property as keyof Pool);
			}
		});
	}

	ensurePool();
	return poolProxy;
}

export async function getConnection(): Promise<PoolConnection> {
	return getPool().getConnection();
}

export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
	const conn = await getConnection();
	await conn.beginTransaction();
	try {
		const result = await fn(conn);
		await conn.commit();
		return result;
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

export async function closePool(): Promise<void> {
	if (poolProxy) {
		await poolProxy.end();
	}
}
