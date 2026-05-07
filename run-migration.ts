import { createPool } from 'mysql2/promise';
import { readFileSync } from 'fs';

const pool = createPool({
  host: '129.150.54.149',
  port: 5432,
  user: 'mariadb',
  password: 'dharon1234',
  database: 'projectbasdat2',
  timezone: '+00:00',
  multipleStatements: true,
  connectTimeout: 10000
});

async function run() {
  console.log('Reading migration file...');
  const sql = readFileSync('./src/lib/server/migrations/024_enrollment_status.sql', 'utf8');
  console.log('Getting connection...');
  const conn = await pool.getConnection();
  console.log('Connection acquired, running migration...');
  try {
    await conn.query(sql);
    console.log('Migration applied successfully');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
    console.log('Pool closed');
  }
}

run();
