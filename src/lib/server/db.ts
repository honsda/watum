import {
	createPool,
	type Pool,
	type PoolConnection,
	type RowDataPacket,
	type ResultSetHeader
} from 'mysql2/promise';

export type { RowDataPacket, ResultSetHeader, PoolConnection };

let pool: Pool | null = null;

export function getPool(): Pool {
	if (!pool) {
		pool = createPool({
			host: process.env.DB_HOST || 'localhost',
			user: process.env.DB_USER || 'root',
			password: process.env.DB_PASSWORD || '',
			database: process.env.DB_NAME || 'akademik_db',
			port: parseInt(process.env.DB_PORT || '3306'),
			timezone: '+00:00',
			waitForConnections: true,
			connectionLimit: 10,
			queueLimit: 0
		});
	}
	return pool;
}

export async function getConnection(): Promise<PoolConnection> {
	return getPool().getConnection();
}

export async function transaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
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
	if (pool) {
		await pool.end();
		pool = null;
	}
}
