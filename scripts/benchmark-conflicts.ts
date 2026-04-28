import 'dotenv/config';
import { performance } from 'node:perf_hooks';
import { createPool, type Pool } from 'mysql2/promise';
import {
	auditEnrollmentConflicts,
	invalidateConflictAuditCache
} from '../src/lib/server/conflict-audit.js';

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
	console.log(`Starting ${label}...`);
	const start = performance.now();
	const result = await auditEnrollmentConflicts(pool, filters);
	const ms = performance.now() - start;
	console.log(
		`  ${label}: ${Math.round(ms * 100) / 100}ms | groups=${result.groups.length}/${result.summary.totalGroups} conflicts=${result.summary.conflictedEnrollments} truncated=${result.truncated}`
	);
	return { label, ms, result };
}

async function benchmark() {
	console.log('Conflict Detection Benchmark (quick)');
	console.log('=====================================\n');
	const quickLimit = 200;
	const quickSampleSize = 8;
	const quickFilters = { limitGroups: quickLimit, memberSampleSize: quickSampleSize };

	// Test only one cold + warm run for each type to keep total time reasonable
	await run('all-cold', quickFilters);
	await run('all-warm', quickFilters);
	await run('room-cold', { conflictType: 'room', ...quickFilters });
	await run('room-warm', { conflictType: 'room', ...quickFilters });
	await run('student-cold', { conflictType: 'student', ...quickFilters });
	await run('student-warm', { conflictType: 'student', ...quickFilters });
	await run('lecturer-cold', { conflictType: 'lecturer', ...quickFilters });
	await run('lecturer-warm', { conflictType: 'lecturer', ...quickFilters });

	await pool.end();
}

benchmark().catch((err) => {
	console.error('Benchmark failed:', err);
	process.exit(1);
});
