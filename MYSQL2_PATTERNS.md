# MySQL2 Patterns for Backend Guide

## Complete CRUD Examples with MySQL2

### Grade Management (Complete)

```ts
// src/routes/(app)/grades/data.remote.ts
import * as v from 'valibot';
import { query, form, invalid } from '$app/server';
import { query as dbQuery, queryOne, insert, update } from '$lib/server/db';
import type { RowDataPacket } from 'mysql2/promise';
import { error } from '@sveltejs/kit';
import { calculateGrade } from '$lib/validations/grade';

interface Grade extends RowDataPacket {
	id: string;
	enrollment_id: string;
	assignment_score: number | null;
	midterm_score: number | null;
	final_score: number | null;
	total_score: number | null;
	letter_grade: string | null;
}

const gradeSchema = v.object({
	enrollmentId: v.string(),
	assignmentScore: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
	midtermScore: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
	finalScore: v.pipe(v.number(), v.minValue(0), v.maxValue(100))
});

export const createGrade = form(gradeSchema, async (data, issue) => {
	const existing = await queryOne<RowDataPacket>('SELECT id FROM grades WHERE enrollment_id = ?', [
		data.enrollmentId
	]);

	if (existing) {
		invalid(issue.enrollmentId('Nilai untuk enrollment ini sudah ada'));
	}

	const { total, letter } = calculateGrade(
		data.assignmentScore,
		data.midtermScore,
		data.finalScore
	);

	const id = await insert('grades', {
		enrollment_id: data.enrollmentId,
		assignment_score: data.assignmentScore,
		midterm_score: data.midtermScore,
		final_score: data.finalScore,
		total_score: total,
		letter_grade: letter
	});

	await getGrades().refresh();
	return { success: true, id };
});

export const updateGrade = form(
	v.object({
		id: v.string(),
		...gradeSchema.entries
	}),
	async (data) => {
		const { id, enrollmentId, ...scores } = data;

		const { total, letter } = calculateGrade(
			scores.assignmentScore,
			scores.midtermScore,
			scores.finalScore
		);

		await update(
			'grades',
			{
				assignment_score: scores.assignmentScore,
				midterm_score: scores.midtermScore,
				final_score: scores.finalScore,
				total_score: total,
				letter_grade: letter
			},
			'id = ?',
			[id]
		);

		await getGrades().refresh();
		return { success: true };
	}
);
```

### Enrollment Management (Complete)

```ts
// src/routes/(app)/enrollments/data.remote.ts
import * as v from 'valibot';
import { query, form, invalid } from '$app/server';
import { query as dbQuery, queryOne, insert, update, deleteRow, transaction } from '$lib/server/db';
import type { RowDataPacket, PoolConnection } from 'mysql2/promise';
import { error } from '@sveltejs/kit';
import { parseISO, formatTime, getDurationHours, getDuration } from '$lib/time-helpers';

interface Enrollment extends RowDataPacket {
	id: string;
	student_id: string;
	course_id: string;
	class_room_id: string;
	lecturer_id: string;
	schedule_id: string;
	semester: string;
	academic_year: string;
}

const enrollmentSchema = v.object({
	studentId: v.string(),
	courseId: v.string(),
	classRoomId: v.string(),
	lecturerId: v.string(),
	day: v.picklist(['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU']),
	startTime: v.string(),
	endTime: v.string(),
	semester: v.string(),
	academicYear: v.string()
});

export const createEnrollment = form(enrollmentSchema, async (data, issue) => {
	const startDate = parseISO(data.startTime);
	const endDate = parseISO(data.endTime);

	// Validate duration
	const durationHours = getDurationHours(startDate, endDate);
	if (durationHours < 1) {
		invalid(issue.startTime('Durasi kuliah minimal 1 jam'));
	}
	if (durationHours > 4) {
		invalid(issue.endTime('Durasi kuliah maksimal 4 jam'));
	}

	// Check for schedule conflicts
	const conflictSql = `
		SELECT id, start_time, end_time 
		FROM schedules 
		WHERE class_room_id = ? 
		  AND day = ?
		  AND (
			(start_time <= ? AND end_time > ?) OR
			(start_time < ? AND end_time >= ?)
		  )
	`;

	const conflict = await queryOne<RowDataPacket>(conflictSql, [
		data.classRoomId,
		data.day,
		startDate,
		startDate,
		endDate,
		endDate
	]);

	if (conflict) {
		invalid(
			issue.classRoomId(
				`Jadwal bentrok dengan jadwal lain di ruangan ini (${formatTime(conflict.start_time, 'time')}-${formatTime(conflict.end_time, 'time')})`
			)
		);
	}

	// Check if student already enrolled in this course for this semester
	const existingEnrollment = await queryOne<RowDataPacket>(
		'SELECT id FROM enrollments WHERE student_id = ? AND course_id = ? AND semester = ?',
		[data.studentId, data.courseId, data.semester]
	);

	if (existingEnrollment) {
		invalid(issue.courseId('Mahasiswa sudah mengambil mata kuliah ini pada semester ini'));
	}

	// Create schedule and enrollment in transaction
	const enrollment = await transaction(async (conn: PoolConnection) => {
		// Create schedule
		const scheduleSql = `
			INSERT INTO schedules (class_room_id, day, start_time, end_time, lecturer_id)
			VALUES (?, ?, ?, ?, ?)
		`;
		const [scheduleResult] = await conn.execute<ResultSetHeader>(scheduleSql, [
			data.classRoomId,
			data.day,
			startDate,
			endDate,
			data.lecturerId
		]);
		const scheduleId = scheduleResult.insertId.toString();

		// Create enrollment
		const enrollmentSql = `
			INSERT INTO enrollments (student_id, course_id, class_room_id, lecturer_id, schedule_id, semester, academic_year)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`;
		await conn.execute<ResultSetHeader>(enrollmentSql, [
			data.studentId,
			data.courseId,
			data.classRoomId,
			data.lecturerId,
			scheduleId,
			data.semester,
			data.academicYear
		]);

		return { scheduleId };
	});

	await getEnrollments().refresh();
	return { success: true, enrollment };
});

export const deleteEnrollment = command(v.string(), async (id) => {
	const enrollment = await queryOne<RowDataPacket>(
		'SELECT id, schedule_id FROM enrollments WHERE id = ?',
		[id]
	);

	if (!enrollment) {
		throw error(404, 'Data KRS tidak ditemukan');
	}

	// Check if enrollment has grade
	const grade = await queryOne<RowDataPacket>('SELECT id FROM grades WHERE enrollment_id = ?', [
		id
	]);

	if (grade) {
		throw error(400, 'Tidak dapat menghapus KRS yang sudah memiliki nilai');
	}

	await transaction(async (conn: PoolConnection) => {
		await conn.execute('DELETE FROM enrollments WHERE id = ?', [id]);
		await conn.execute('DELETE FROM schedules WHERE id = ?', [enrollment.schedule_id]);
	});

	await getEnrollments().refresh();
});
```

## Key Patterns

### 1. Type-safe Queries

```ts
interface User extends RowDataPacket {
	id: string;
	name: string;
	email: string;
}

const users = await query<User[]>('SELECT * FROM users');
```

### 2. Parameterized Queries (Prevents SQL Injection)

```ts
const user = await queryOne<User>('SELECT * FROM users WHERE email = ? AND status = ?', [
	email,
	'active'
]);
```

### 3. Insert with Auto-generated ID

```ts
const id = await insert('users', {
	name: 'John',
	email: 'john@example.com'
});
```

### 4. Update with WHERE clause

```ts
await update('users', { name: 'Jane', email: 'jane@example.com' }, 'id = ? AND status = ?', [
	id,
	'active'
]);
```

### 5. Delete

```ts
await deleteRow('users', 'id = ?', [id]);
```

### 6. Transactions

```ts
await transaction(async (conn) => {
	await conn.execute('INSERT INTO orders ...');
	await conn.execute('INSERT INTO order_items ...');
});
```

### 7. Complex Queries with Joins

```ts
const sql = `
	SELECT 
		u.*,
		COUNT(o.id) as order_count
	FROM users u
	LEFT JOIN orders o ON u.id = o.user_id
	GROUP BY u.id
	HAVING order_count > 0
	ORDER BY u.name ASC
`;
const results = await query<UserWithOrderCount[]>(sql);
```
