import { createPool } from 'mysql2/promise';

const pool = createPool({
  host: '129.150.54.149',
  port: 5432,
  user: 'mariadb',
  password: 'dharon1234',
  database: 'projectbasdat2',
  timezone: '+00:00',
  connectTimeout: 10000
});

async function run() {
  const conn = await pool.getConnection();
  try {
    console.log('Setting timeouts...');
    await conn.query(`SET SESSION lock_wait_timeout = 600`);
    await conn.query(`SET SESSION innodb_lock_wait_timeout = 600`);
    await conn.query(`SET SESSION net_read_timeout = 600`);
    await conn.query(`SET SESSION net_write_timeout = 600`);

    console.log('Making schedule_id nullable with NOCOPY...');
    await conn.query(`ALTER TABLE enrollments MODIFY COLUMN schedule_id VARCHAR(64) UNIQUE NULL, ALGORITHM=NOCOPY`);
    console.log('schedule_id nullable');

    console.log('All done');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

run();
