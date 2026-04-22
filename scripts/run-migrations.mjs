import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mysql from 'mysql2/promise';

const MIGRATIONS_DIR = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../src/lib/server/migrations'
);
const MIGRATION_FILE_PATTERN = /^\d+_.+\.sql$/;

function getRequiredEnv(name) {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is required to run migrations`);
	}
	return value;
}

async function ensureMigrationTable(connection) {
	await connection.query(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			id VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
	`);
}

async function getMigrationFiles() {
	const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });
	return entries
		.filter((entry) => entry.isFile() && MIGRATION_FILE_PATTERN.test(entry.name))
		.map((entry) => entry.name)
		.sort((left, right) => left.localeCompare(right));
}

async function getAppliedMigrations(connection) {
	const [rows] = await connection.query('SELECT id FROM schema_migrations');
	return new Set(rows.map((row) => row.id));
}

async function applyMigration(connection, fileName) {
	const filePath = path.join(MIGRATIONS_DIR, fileName);
	const sql = await fs.readFile(filePath, 'utf8');

	await connection.beginTransaction();
	try {
		await connection.query(sql);
		await connection.query('INSERT INTO schema_migrations (id) VALUES (?)', [fileName]);
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	}
}

export async function runMigrations() {
	const connection = await mysql.createConnection({
		host: getRequiredEnv('DB_HOST'),
		port: parseInt(process.env.DB_PORT || '3306', 10),
		user: getRequiredEnv('DB_USER'),
		password: process.env.DB_PASSWORD || '',
		database: getRequiredEnv('DB_NAME'),
		multipleStatements: true
	});

	try {
		await ensureMigrationTable(connection);
		const appliedMigrations = await getAppliedMigrations(connection);
		const migrationFiles = await getMigrationFiles();

		for (const fileName of migrationFiles) {
			if (appliedMigrations.has(fileName)) {
				continue;
			}

			console.log(`Applying migration ${fileName}`);
			await applyMigration(connection, fileName);
		}
	} finally {
		await connection.end();
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	runMigrations().catch((error) => {
		console.error('Failed to apply migrations', error);
		process.exit(1);
	});
}
