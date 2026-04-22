import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mysql from 'mysql2/promise';

const MIGRATIONS_DIR = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../src/lib/server/migrations'
);
const MIGRATION_FILE_PATTERN = /^\d+_.+\.sql$/;
const MIGRATION_LOCK_NAME = 'watum:auto-apply-migrations';
const MIGRATION_LOCK_TIMEOUT_SECONDS = 60;
const IGNORABLE_SCHEMA_ERROR_CODES = new Set([
	'ER_TABLE_EXISTS_ERROR',
	'ER_DUP_KEYNAME',
	'ER_DUP_FIELDNAME',
	'ER_CANT_DROP_FIELD_OR_KEY'
]);

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

function splitSqlStatements(sql) {
	const statements = [];
	let current = '';
	let inSingleQuote = false;
	let inDoubleQuote = false;
	let inLineComment = false;
	let inBlockComment = false;

	for (let index = 0; index < sql.length; index += 1) {
		const character = sql[index];
		const nextCharacter = sql[index + 1] ?? '';

		if (inLineComment) {
			if (character === '\n') {
				inLineComment = false;
			}
			continue;
		}

		if (inBlockComment) {
			if (character === '*' && nextCharacter === '/') {
				inBlockComment = false;
				index += 1;
			}
			continue;
		}

		if (!inSingleQuote && !inDoubleQuote) {
			if (character === '-' && nextCharacter === '-') {
				inLineComment = true;
				index += 1;
				continue;
			}

			if (character === '/' && nextCharacter === '*') {
				inBlockComment = true;
				index += 1;
				continue;
			}
		}

		if (character === "'" && !inDoubleQuote) {
			const escaped = sql[index - 1] === '\\';
			if (!escaped) {
				inSingleQuote = !inSingleQuote;
			}
		}

		if (character === '"' && !inSingleQuote) {
			const escaped = sql[index - 1] === '\\';
			if (!escaped) {
				inDoubleQuote = !inDoubleQuote;
			}
		}

		if (character === ';' && !inSingleQuote && !inDoubleQuote) {
			const statement = current.trim();
			if (statement) {
				statements.push(statement);
			}
			current = '';
			continue;
		}

		current += character;
	}

	const trailingStatement = current.trim();
	if (trailingStatement) {
		statements.push(trailingStatement);
	}

	return statements;
}

function isIgnorableSchemaError(error) {
	if (!error || typeof error !== 'object') {
		return false;
	}

	const code = 'code' in error ? error.code : undefined;
	return typeof code === 'string' && IGNORABLE_SCHEMA_ERROR_CODES.has(code);
}

async function acquireMigrationLock(connection) {
	const [rows] = await connection.query('SELECT GET_LOCK(?, ?) AS acquired', [
		MIGRATION_LOCK_NAME,
		MIGRATION_LOCK_TIMEOUT_SECONDS
	]);

	if (!Array.isArray(rows) || rows.length === 0 || rows[0].acquired !== 1) {
		throw new Error('Timed out waiting for migration lock');
	}
}

async function releaseMigrationLock(connection) {
	try {
		await connection.query('SELECT RELEASE_LOCK(?)', [MIGRATION_LOCK_NAME]);
	} catch (error) {
		console.warn('Failed to release migration lock cleanly', error);
	}
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
	const statements = splitSqlStatements(sql);

	for (const statement of statements) {
		try {
			await connection.query(statement);
		} catch (error) {
			if (isIgnorableSchemaError(error)) {
				console.warn(`Skipping already-applied schema statement in ${fileName}: ${error.code}`);
				continue;
			}

			throw error;
		}
	}

	await connection.query(
		'INSERT INTO schema_migrations (id) VALUES (?) ON DUPLICATE KEY UPDATE id = id',
		[fileName]
	);
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
		await acquireMigrationLock(connection);
		await ensureMigrationTable(connection);
		const migrationFiles = await getMigrationFiles();

		for (const fileName of migrationFiles) {
			const appliedMigrations = await getAppliedMigrations(connection);
			if (appliedMigrations.has(fileName)) {
				continue;
			}

			console.log(`Applying migration ${fileName}`);
			await applyMigration(connection, fileName);
		}
	} finally {
		await releaseMigrationLock(connection);
		await connection.end();
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	runMigrations().catch((error) => {
		console.error('Failed to apply migrations', error);
		process.exit(1);
	});
}
