import 'dotenv/config';
import { performance } from 'node:perf_hooks';
import { createPool, type Pool } from 'mysql2/promise';
import { auditEnrollmentConflicts, invalidateConflictAuditCache } from '../src/lib/server/conflict-audit.js';

const pool: Pool = createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'akademik_db',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  timezone: '+00:00',
  connectionLimit: 16,
  queueLimit: 0,
  connectTimeout: 30000
});

async function run(label: string, filters: Parameters<typeof auditEnrollmentConflicts>[1]) {
  invalidateConflictAuditCache();
  const start = performance.now();
  const result = await auditEnrollmentConflicts(pool, filters);
  const ms = performance.now() - start;
  console.log(`${label}: ${Math.round(ms * 100) / 100}ms | groups=${result.groups.length}/${result.summary.totalGroups} | conflicted=${result.summary.conflictedEnrollments} | truncated=${result.truncated}`);
}

async function main() {
  console.log('Conflict Detection Benchmark');
  console.log('============================');
  await run('room-cold', { conflictType: 'room' });
  await run('room-warm', { conflictType: 'room' });
  await run('student-cold', { conflictType: 'student' });
  await run('student-warm', { conflictType: 'student' });
  await run('lecturer-cold', { conflictType: 'lecturer' });
  await run('lecturer-warm', { conflictType: 'lecturer' });
  await run('all-cold', {});
  await run('all-warm', {});
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
