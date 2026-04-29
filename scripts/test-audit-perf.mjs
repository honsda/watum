import mysql from 'mysql2/promise';

function getRequiredEnv(name) {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`${name} is required`);
	}
	return value;
}

async function test() {
	const pool = mysql.createPool({
		host: getRequiredEnv('DB_HOST'),
		user: getRequiredEnv('DB_USER'),
		password: process.env.DB_PASSWORD || '',
		database: getRequiredEnv('DB_NAME'),
		port: parseInt(process.env.DB_PORT || '3306', 10),
		connectionLimit: 2
	});

	console.log('Testing optimized GROUP BY with LIMIT...\n');

	const start = performance.now();

	// Add LIMIT to the GROUP BY query
	const [groupRows] = await pool.query(
		`SELECT e.class_room_audit_sk AS resource_id, e.academic_year_start, e.semester_sort,
            e.schedule_day AS day, MIN(e.schedule_start_time) AS start_time, MIN(e.schedule_end_time) AS end_time,
            COUNT(DISTINCT e.course_id) AS distinct_courses, COUNT(*) AS member_count
     FROM enrollments e
     GROUP BY e.class_room_audit_sk, e.academic_year_start, e.semester_sort,
              e.schedule_day, TIME(e.schedule_start_time), TIME(e.schedule_end_time)
     HAVING COUNT(DISTINCT e.course_id) > 1
     ORDER BY member_count DESC
     LIMIT 20`
	);
	const groupTime = performance.now() - start;
	console.log(`GROUP BY found ${groupRows.length} groups in ${groupTime.toFixed(0)}ms`);

	if (!groupRows.length) {
		await pool.end();
		return;
	}

	// Fetch members for just these 20 groups
	const allMemberRows = [];
	const BATCH_SIZE = 20;
	for (let i = 0; i < groupRows.length; i += BATCH_SIZE) {
		const batch = groupRows.slice(i, i + BATCH_SIZE);
		const conditions = batch
			.map(
				() =>
					`(e.class_room_audit_sk = ? AND e.academic_year_start = ? AND e.semester_sort = ? AND e.schedule_day = ? AND TIME(e.schedule_start_time) = TIME(?) AND TIME(e.schedule_end_time) = TIME(?))`
			)
			.join(' OR ');
		const memberValues = batch.flatMap((g) => [
			g.resource_id,
			g.academic_year_start,
			g.semester_sort,
			g.day,
			g.start_time,
			g.end_time
		]);

		const memberSql =
			`SELECT e.id AS enrollment_id, e.schedule_audit_sk, e.class_room_audit_sk AS resource_id,` +
			`  e.academic_year_start, e.semester_sort, e.schedule_day AS day,` +
			`  e.schedule_start_time AS start_time, e.schedule_end_time AS end_time` +
			`  FROM enrollments e` +
			`  WHERE ${conditions}`;

		const memberStart = performance.now();
		const [memberRows] = await pool.query(memberSql, memberValues);
		const memberTime = performance.now() - memberStart;
		console.log(
			`  Batch ${i / BATCH_SIZE + 1}: ${memberRows.length} rows in ${memberTime.toFixed(0)}ms`
		);
		for (const row of memberRows) {
			allMemberRows.push(row);
		}
	}

	console.log(`\nTotal members: ${allMemberRows.length}`);
	console.log(`Total time: ${(performance.now() - start).toFixed(0)}ms`);

	await pool.end();
}

test().catch(console.error);
