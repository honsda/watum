# Database Migrations

This directory contains SQL migration files for the academic system database.

## Files

- `001_schema.sql` - Initial schema based on Prisma schema
- `002_refresh_tokens.sql` - Adds stateful refresh token storage

## How to Run Migrations

### Option 1: Using MySQL CLI

```bash
# Connect to MySQL
mysql -u root -p

# Create database if not exists
CREATE DATABASE akademik_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Exit MySQL
exit

# Run migrations in order
mysql -u root -p akademik_db < src/lib/server/migrations/001_schema.sql
mysql -u root -p akademik_db < src/lib/server/migrations/002_refresh_tokens.sql
```

### Option 2: Using Environment Variables

```bash
# Set environment variables
export DB_HOST=localhost
export DB_USER=root
export DB_PASSWORD=your_password
export DB_NAME=akademik_db
export DB_PORT=3306

# Run migrations in order
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < src/lib/server/migrations/001_schema.sql
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < src/lib/server/migrations/002_refresh_tokens.sql
```

### Option 3: Using Node.js Script

Create a migration runner script:

```javascript
// run-migration.js
import fs from 'fs';
import mysql from 'mysql2/promise';

async function runMigration() {
	const connection = await mysql.createConnection({
		host: process.env.DB_HOST || 'localhost',
		user: process.env.DB_USER || 'root',
		password: process.env.DB_PASSWORD || '',
		multipleStatements: true
	});

	// Create database if not exists
	await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'akademik_db'}`);
	await connection.changeUser({ database: process.env.DB_NAME || 'akademik_db' });

	for (const file of [
		'./src/lib/server/migrations/001_schema.sql',
		'./src/lib/server/migrations/002_refresh_tokens.sql'
	]) {
		const sql = fs.readFileSync(file, 'utf8');
		await connection.query(sql);
	}

	console.log('Migration completed successfully');
	await connection.end();
}

runMigration().catch(console.error);
```

Run with:

```bash
node run-migration.js
```

## Schema Overview

### Tables (Auto-generated ID with CUID/UUID)

- `class_rooms` - Ruang kelas
- `schedules` - Jadwal kuliah
- `enrollments` - KRS
- `grades` - Nilai
- `users` - Autentikasi

### Tables (Manual ID)

- `faculties` - Fakultas
- `study_programs` - Program studi
- `students` - Mahasiswa
- `lecturers` - Dosen
- `courses` - Mata kuliah, termasuk dosen pengampu

### Key Features

- **UTC Storage**: All DateTime fields stored in UTC with millisecond precision (`DATETIME(3)`)
- **UTF8MB4**: Full Unicode support including emojis
- **Foreign Keys**: Proper referential integrity with CASCADE/RESTRICT rules
- **Indexes**: Optimized indexes for common queries

### Enum Types

- `class_room_type`: REGULER, LAB_KOMPUTER, LAB_BAHASA, AUDITORIUM
- `day`: SENIN, SELASA, RABU, KAMIS, JUMAT, SABTU
- `role`: ADMIN, STUDENT, LECTURER

## Reset Database

```sql
DROP DATABASE IF EXISTS akademik_db;
CREATE DATABASE akademik_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Then run migration again.

## Default Dummy Admin

Migration `001_schema.sql` seeds a default admin account (idempotent):

- Email: `admin@watum.local`
- Password: `admin123`
- Role: `ADMIN`

You should change this password immediately in non-local environments.

## Notes

1. **Timestamps**: All tables use `TIMESTAMP(3)` for millisecond precision
2. **Timezone**: MySQL connection configured for UTC (`+00:00`)
3. **ID Generation**: Auto-generated IDs use `DEFAULT (UUID())` for CUID-like behavior
4. **Constraints**: Foreign keys use `ON DELETE RESTRICT` by default to prevent accidental deletions
