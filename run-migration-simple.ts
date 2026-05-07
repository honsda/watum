import { createPool } from 'mysql2/promise';

const pool = createPool({
  host: '129.150.54.149',
  port: 5432,
  user: 'mariadb',
  password: 'dharon1234',
  database: 'projectbasdat2',
  timezone: '+00:00',
  multipleStatements: true,
  connectTimeout: 10000,
  queryTimeout: 300000
});

async function run() {
  const conn = await pool.getConnection();
  try {
    console.log('Adding status column...');
    await conn.query(`ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS status ENUM('PENDING', 'APPROVED') NOT NULL DEFAULT 'APPROVED'`);
    console.log('Status column added');

    console.log('Making class_room_id nullable...');
    await conn.query(`ALTER TABLE enrollments MODIFY COLUMN class_room_id VARCHAR(64) NULL`);
    console.log('class_room_id nullable');

    console.log('Making schedule_id nullable...');
    await conn.query(`ALTER TABLE enrollments MODIFY COLUMN schedule_id VARCHAR(64) UNIQUE NULL`);
    console.log('schedule_id nullable');

    console.log('Done');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

run();
