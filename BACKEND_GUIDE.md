# Backend Guide: Sistem Informasi Akademik "Universitas Merdeka Digital"

Panduan lengkap untuk membuat backend menggunakan SvelteKit Remote Functions dengan TypeSQL.

## Daftar Isi

1. [Setup](#1-setup)
2. [Database Schema](#2-database-schema)
3. [Database Client Setup](#3-database-client-setup)
4. [Remote Functions Architecture](#4-remote-functions-architecture)
5. [CRUD Operations](#5-crud-operations) — 5.1 Classrooms (full example) · 5.2–5.8 follow same pattern
6. [Validation](#6-validation)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Error Handling](#8-error-handling)
9. [NRP Generation](#9-nrp-generation)
10. [Time Handling](#10-time-handling-lib-time-helpers)
11. [Best Practices](#11-best-practices)
12. [TypeSQL Quick Reference](#12-typesql-quick-reference)

---

## 1. Setup

```bash
npm install mysql2 valibot argon2 dayjs
npm install -g typesql-cli   # or: npm install -D typesql-cli
```

```env
# .env
DATABASE_URL="mysql://root:password@localhost:3306/akademik_db"
DB_HOST=localhost  DB_USER=root  DB_PASSWORD=password  DB_NAME=akademik_db  DB_PORT=3306
```

```js
// svelte.config.js — enable remote functions + async components
const config = {
	kit: { experimental: { remoteFunctions: true } },
	compilerOptions: { experimental: { async: true } }
};
```

```json
// typesql.json
{
	"databaseUri": "${DATABASE_URL}",
	"sqlDir": "./src/lib/server/sql",
	"client": "mysql2",
	"includeCrudTables": [
		"faculties",
		"study_programs",
		"class_rooms",
		"students",
		"lecturers",
		"courses",
		"schedules",
		"enrollments",
		"grades",
		"users"
	]
}
```

```json
// package.json scripts
{ "typesql": "typesql compile", "typesql:watch": "typesql compile --watch" }
```

---

## 2. Database Schema

Schema menggunakan **MySQL** dengan raw SQL migrations:

**Enums:**

- `ClassRoomType`: REGULER, LAB_KOMPUTER, LAB_BAHASA, AUDITORIUM
- `Day`: SENIN, SELASA, RABU, KAMIS, JUMAT, SABTU
- `Role`: ADMIN, STUDENT, LECTURER

**Models:**

- `Faculty` - Fakultas (manual ID)
- `StudyProgram` - Program Studi (manual ID)
- `ClassRoom` - Ruang Kelas
- `Student` - Mahasiswa (manual ID)
- `Lecturer` - Dosen (manual ID)
- `Course` - Mata Kuliah (manual ID)
- `Schedule` - Jadwal Kuliah
- `Enrollment` - KRS
- `Grade` - Nilai
- `User` - Autentikasi

**Key Points:**

- Faculty, StudyProgram, Student, Lecturer, Course menggunakan **manual ID** (tidak auto-generate)
- Schedule menggunakan **DateTime (UTC)** untuk waktu dengan Day.js
- Enrollment memiliki relasi ke Schedule (one-to-one)
- Semua tabel menggunakan **utf8mb4** charset untuk mendukung emoji dan karakter khusus

---

## 3. Database Client Setup

### 3.1 Database Connection

```ts
// src/lib/server/db.ts
import {
	createPool,
	type Pool,
	type PoolConnection,
	type RowDataPacket,
	type ResultSetHeader
} from 'mysql2/promise';

export type { RowDataPacket, ResultSetHeader, PoolConnection };

let pool: Pool | null = null;

// Lazy singleton — pool is created on first use.
// Pass getPool() as the `connection` argument to every TypeSQL-generated function.
export function getPool(): Pool {
	if (!pool) {
		pool = createPool({
			host: process.env.DB_HOST || 'localhost',
			user: process.env.DB_USER || 'root',
			password: process.env.DB_PASSWORD || '',
			database: process.env.DB_NAME || 'akademik_db',
			port: parseInt(process.env.DB_PORT || '3306'),
			timezone: '+00:00',
			waitForConnections: true,
			connectionLimit: 10,
			queueLimit: 0
		});
	}
	return pool;
}

// Returns a dedicated connection from the pool (used by transaction()).
export async function getConnection(): Promise<PoolConnection> {
	return getPool().getConnection();
}

// Runs multiple statements atomically. Pass the PoolConnection to TypeSQL
// functions inside the callback to enlist them in the transaction.
export async function transaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
	const conn = await getConnection();
	await conn.beginTransaction();
	try {
		const result = await fn(conn);
		await conn.commit();
		return result;
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

export async function closePool(): Promise<void> {
	if (pool) {
		await pool.end();
		pool = null;
	}
}
```

> **Why no `query` / `execute` / `insert` helpers?**
> TypeSQL-generated functions each receive a `connection: Connection` argument and handle their own SQL execution via mysql2 directly. There is no need for generic wrapper functions — TypeSQL replaces them entirely.

### 3.2 TypeSQL Generated Files

Each `.sql` file in `src/lib/server/sql/` generates a `.ts` file. Run `npm run typesql:watch` during development. Example output for `select-users.sql`:

```ts
// src/lib/server/sql/select-users.ts  (auto-generated)
import type { Connection } from 'mysql2/promise';

export type SelectUsersResult = {
    id: string;
    email: string;
    role: 'ADMIN' | 'STUDENT' | 'LECTURER';
    password: string;
    student_id?: string;
    student_name?: string;
    lecturer_id?: string;
    lecturer_name?: string;
}

export async function selectUsers(connection: Connection, params?: { where?: ... }): Promise<SelectUsersResult[]> { ... }
```

Pass `getPool()` for regular calls, or `conn` from inside a `transaction()` callback:

```ts
const [user] = await selectUsers(getPool(), { where: [['id', '=', id]] });
const [user] = await selectUsers(getPool(), { where: [['email', '=', email]] });

await transaction(async (conn) => {
	const [user] = await selectUsers(conn, { where: [['id', '=', id]] });
});
```

### 3.3 Server-Only Module Guard

```ts
// src/lib/server/index.ts
export { getPool, getConnection, transaction, closePool } from './db';
export type { RowDataPacket, ResultSetHeader, PoolConnection } from './db';
```

---

## 4. Remote Functions Architecture

Struktur folder:

```
src/
├── lib/
│   ├── server/
│   │   ├── db.ts                  # Pool, transaction, getPool
│   │   ├── sql/                   # TypeSQL SQL files
│   │   │   ├── select-class-rooms.sql
│   │   │   ├── select-class-rooms.ts  (generated)
│   │   │   ├── insert-class-room.sql
│   │   │   ├── insert-class-room.ts   (generated)
│   │   │   └── ...
│   │   ├── auth.ts               # Authentication helpers
│   │   └── index.ts
│   └── validations/              # Schema validasi
│       ├── classroom.ts
│       ├── student.ts
│       ├── grade.ts
│       └── enrollment.ts
├── routes/
│   ├── (app)/
│   │   ├── classrooms/
│   │   │   ├── data.remote.ts
│   │   │   └── +page.svelte
│   │   ├── students/
│   │   │   ├── data.remote.ts
│   │   │   └── +page.svelte
│   │   ├── grades/
│   │   │   ├── data.remote.ts
│   │   │   └── +page.svelte
│   │   └── enrollments/
│   │       ├── data.remote.ts
│   │       └── +page.svelte
```

---

## 5. CRUD Operations

### 5.1 Classroom Management

**SQL Files:**

```sql
-- src/lib/server/sql/select-class-rooms.sql  (@dynamicQuery — replaces separate by-id / by-name files)
-- @dynamicQuery
SELECT
    c.id, c.name, c.class_room_type, c.capacity, c.has_projector, c.has_ac,
    c.created_at, c.updated_at,
    (SELECT COUNT(*) FROM enrollments e WHERE e.class_room_id = c.id) as enrollment_count,
    (SELECT COUNT(*) FROM schedules s WHERE s.class_room_id = c.id) as schedule_count
FROM class_rooms c
ORDER BY c.name ASC
```

```sql
-- src/lib/server/sql/select-schedules.sql  (@dynamicQuery — filter by room or lecturer)
-- @dynamicQuery
SELECT s.id, s.class_room_id, s.day, s.start_time, s.end_time, s.lecturer_id,
    c.name as course_name
FROM schedules s
LEFT JOIN enrollments e ON s.id = e.schedule_id
LEFT JOIN courses c ON e.course_id = c.id
ORDER BY s.day, s.start_time
```

```sql
-- src/lib/server/sql/insert-class-room.sql
INSERT INTO class_rooms (id, name, class_room_type, capacity, has_projector, has_ac)
VALUES (:id, :name, :class_room_type, :capacity, :has_projector, :has_ac)
```

```sql
-- src/lib/server/sql/update-class-room.sql
UPDATE class_rooms
SET name = :name, class_room_type = :class_room_type,
    capacity = :capacity, has_projector = :has_projector, has_ac = :has_ac
WHERE id = :id
```

```sql
-- src/lib/server/sql/delete-class-room.sql
DELETE FROM class_rooms WHERE id = :id
```

**Remote Functions:**

```ts
// src/routes/(app)/classrooms/data.remote.ts
import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { formatDateTime } from '$lib/time-helpers';
import { getPool } from '$lib/server/db';
import { requireRole } from '$lib/server/auth';
import {
	selectClassRooms,
	selectSchedules,
	insertClassRoom,
	updateClassRoom as updateClassRoomDb,
	deleteClassRoom as deleteClassRoomDb
} from '$lib/server/sql';
import { classRoomSchema } from '$lib/validations/classroom';

export const getClassRooms = query(async () => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	return await selectClassRooms(getPool());
});

export const getClassRoom = query(v.string(), async (id) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const [classRoom] = await selectClassRooms(getPool(), { where: [['id', '=', id]] });
	if (!classRoom) {
		error(404, 'Ruang kelas tidak ditemukan');
		return classRoom;
	}
});

export const getClassRoomUtilization = query(
	v.object({ classRoomId: v.string(), timezone: v.string() }),
	async ({ classRoomId, timezone }) => {
		await requireRole(['ADMIN', 'LECTURER']);
		const schedules = await selectSchedules(getPool(), {
			where: [['class_room_id', '=', classRoomId]]
		});
		const utilization: Record<string, Array<{ start: string; end: string; course: string }>> = {};
		for (const schedule of schedules) {
			if (!schedule.start_time || !schedule.end_time) continue;
			const day = schedule.day ?? '';
			if (!utilization[day]) utilization[day] = [];
			utilization[day].push({
				start: formatDateTime(schedule.start_time, 'time', timezone),
				end: formatDateTime(schedule.end_time, 'time', timezone),
				course: schedule.course_name ?? ''
			});
		}
		return utilization;
	}
);

export const createClassRoom = form(classRoomSchema, async (data) => {
	await requireRole(['ADMIN']);
	const [existing] = await selectClassRooms(getPool(), { where: [['name', '=', data.name]] });
	if (existing) throw error(400, 'Ruang kelas dengan nama tersebut sudah ada');

	const id = randomUUID();
	await insertClassRoom(getPool(), {
		id,
		name: data.name,
		class_room_type: data.classRoomType,
		capacity: data.capacity,
		has_projector: +data.hasProjector,
		has_ac: +data.hasAC
	});
	await getClassRooms().refresh();
	return { success: true, id };
});

export const updateClassRoom = form(
	v.object({ id: v.string(), ...classRoomSchema.entries }),
	async (data) => {
		await requireRole(['ADMIN']);
		const { id, ...updateData } = data;
		const [existing] = await selectClassRooms(getPool(), {
			where: [['name', '=', updateData.name]]
		});
		if (existing && existing.id !== id)
			throw error(400, 'Ruang kelas dengan nama tersebut sudah ada');

		await updateClassRoomDb(
			getPool(),
			{
				name: updateData.name,
				class_room_type: updateData.classRoomType,
				capacity: updateData.capacity,
				has_projector: +updateData.hasProjector,
				has_ac: +updateData.hasAC
			},
			{ id }
		);
		await getClassRooms().refresh();
		await getClassRoom(id).refresh();
		return { success: true };
	}
);

export const deleteClassRoom = command(v.string(), async (id) => {
	await requireRole(['ADMIN']);
	const [classRoom] = await selectClassRooms(getPool(), { where: [['id', '=', id]] });
	if (!classRoom) throw error(404, 'Ruang kelas tidak ditemukan');
	if ((classRoom.schedule_count ?? 0) > 0)
		throw error(400, 'Tidak dapat menghapus ruangan yang masih memiliki jadwal');

	await deleteClassRoomDb(getPool(), { id });
	await getClassRooms().refresh();
});
```

### 5.2 Student Management

**SQL Files:**

```sql
-- src/lib/server/sql/select-students.sql  (@dynamicQuery — replaces by-id / by-email files)
-- @dynamicQuery
SELECT
    s.id, s.name, s.email, s.phone, s.address, s.year_admitted, s.study_program_id,
    s.created_at, s.updated_at,
    sp.name AS study_program_name, f.id AS faculty_id, f.name AS faculty_name,
    (SELECT COUNT(*) FROM enrollments e WHERE e.student_id = s.id) AS enrollment_count
FROM students s
INNER JOIN study_programs sp ON s.study_program_id = sp.id
INNER JOIN faculties f ON sp.faculty_id = f.id
ORDER BY s.name ASC
```

```sql
-- src/lib/server/sql/insert-student.sql
INSERT INTO students (id, name, email, phone, address, year_admitted, study_program_id)
VALUES (:id, :name, :email, :phone, :address, :year_admitted, :study_program_id)
```

```sql
-- src/lib/server/sql/update-student.sql
UPDATE students
SET name = :name, email = :email, phone = :phone, address = :address,
    year_admitted = :year_admitted, study_program_id = :study_program_id
WHERE id = :id
```

```sql
-- src/lib/server/sql/delete-student.sql
DELETE FROM students WHERE id = :id
```

**Remote Functions:**

```ts
// src/routes/(app)/students/data.remote.ts
import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { hash } from 'argon2';
import { randomUUID } from 'crypto';
import { getPool } from '$lib/server/db';
import { requireRole, requireUser } from '$lib/server/auth';
import { generateNRP } from '$lib/server/NRP-generator';
import {
	selectStudents,
	selectStudyPrograms,
	selectGrades,
	selectUsers,
	insertStudent,
	insertUser,
	deleteUser,
	updateStudent as updateStudentDb,
	deleteStudent as deleteStudentDb
} from '$lib/server/sql';
import { studentSchema } from '$lib/validations/student';
import { gradePoints } from '$lib/validations/grade';

export const getStudents = query(async () => {
	await requireRole(['ADMIN', 'LECTURER']);
	return await selectStudents(getPool());
});

export const getStudent = query(v.string(), async (id) => {
	const user = await requireUser();
	// Students can only view their own data
	if (user.role === 'STUDENT' && user.studentId !== id) {
		throw error(403, 'Anda tidak berhak melihat data mahasiswa lain');
	}
	const [student] = await selectStudents(getPool(), { where: [['id', '=', id]] });
	if (!student) error(404, 'Mahasiswa tidak ditemukan');
	return student;
});

export const getStudentGPA = query(v.string(), async (studentId) => {
	const user = await requireUser();
	// Students can only view their own GPA
	if (user.role === 'STUDENT' && user.studentId !== studentId) {
		throw error(403, 'Anda tidak berhak melihat IPK mahasiswa lain');
	}
	const grades = await selectGrades(getPool(), {
		select: { letter_grade: true, credits: true },
		where: [['student_id', '=', studentId]]
	});
	let totalCredits = 0,
		totalPoints = 0;
	for (const g of grades) {
		if (g.letter_grade && g.credits) {
			totalCredits += g.credits;
			totalPoints += g.credits * (gradePoints[g.letter_grade] ?? 0);
		}
	}
	return {
		gpa: (totalCredits > 0 ? totalPoints / totalCredits : 0).toFixed(2),
		totalCredits,
		totalCourses: grades.length
	};
});

export const createStudent = form(studentSchema, async (data) => {
	await requireRole(['ADMIN']);
	const [existingEmail] = await selectStudents(getPool(), { where: [['email', '=', data.email]] });
	if (existingEmail) throw error(400, 'Email sudah terdaftar');

	const [studyProgram] = await selectStudyPrograms(getPool(), {
		where: [['id', '=', data.studyProgramId]]
	});
	if (!studyProgram) throw error(400, 'Program studi tidak ditemukan');

	const nrp = await generateNRP(data.studyProgramId, data.yearAdmitted);

	await insertStudent(getPool(), {
		id: nrp,
		name: data.name,
		email: data.email,
		phone: data.phone ?? undefined,
		address: data.address ?? undefined,
		year_admitted: data.yearAdmitted,
		study_program_id: data.studyProgramId
	});

	// Create user account with NRP as default password
	const hashedPassword = await hash(nrp);
	await insertUser(getPool(), {
		id: randomUUID(),
		email: data.email,
		password: hashedPassword,
		role: 'STUDENT',
		student_id: nrp,
		lecturer_id: null
	});

	await getStudents().refresh();
	return { success: true, nrp };
});

export const updateStudent = form(
	v.object({ id: v.string(), ...studentSchema.entries }),
	async (data) => {
		await requireRole(['ADMIN']);
		const { id, ...updateData } = data;
		const [existingEmail] = await selectStudents(getPool(), {
			where: [['email', '=', updateData.email]]
		});
		if (existingEmail && existingEmail.id !== id) throw error(400, 'Email sudah digunakan');

		await updateStudentDb(
			getPool(),
			{
				name: updateData.name,
				email: updateData.email,
				phone: updateData.phone ?? undefined,
				address: updateData.address ?? undefined,
				year_admitted: updateData.yearAdmitted,
				study_program_id: updateData.studyProgramId
			},
			{ id }
		);
		await getStudents().refresh();
		await getStudent(id).refresh();
		return { success: true };
	}
);

export const deleteStudent = command(v.string(), async (id) => {
	await requireRole(['ADMIN']);
	const [student] = await selectStudents(getPool(), { where: [['id', '=', id]] });
	if (!student) throw error(404, 'Mahasiswa tidak ditemukan');
	if ((student.enrollment_count ?? 0) > 0)
		throw error(400, 'Tidak dapat menghapus mahasiswa yang memiliki data KRS');

	await deleteStudentDb(getPool(), { id });

	// Delete associated user account
	const [user] = await selectUsers(getPool(), { where: [['student_id', '=', id]] });
	if (user?.id) {
		await deleteUser(getPool(), { id: user.id });
	}

	await getStudents().refresh();
	return { success: true };
});
```

### 5.3 Grade Management

**SQL Files:**

```sql
-- src/lib/server/sql/select-grades.sql  (@dynamicQuery — replaces by-id / by-enrollment / by-course / by-student)
-- @dynamicQuery
SELECT
    g.id, g.enrollment_id, g.assignment_score, g.midterm_score, g.final_score,
    g.total_score, g.letter_grade, g.created_at, g.updated_at,
    s.id as student_id, s.name as student_name, s.email as student_email,
    sp.name as study_program_name,
    c.id as course_id, c.name as course_name, c.credits
FROM grades g
INNER JOIN enrollments e ON g.enrollment_id = e.id
INNER JOIN students s ON e.student_id = s.id
INNER JOIN courses c ON e.course_id = c.id
INNER JOIN study_programs sp ON s.study_program_id = sp.id
ORDER BY s.name ASC
```

```sql
-- src/lib/server/sql/insert-grade.sql
INSERT INTO grades (id, enrollment_id, assignment_score, midterm_score, final_score, total_score, letter_grade)
VALUES (:id, :enrollment_id, :assignment_score, :midterm_score, :final_score, :total_score, :letter_grade)
```

```sql
-- src/lib/server/sql/update-grade.sql
UPDATE grades
SET assignment_score = :assignment_score, midterm_score = :midterm_score,
    final_score = :final_score, total_score = :total_score, letter_grade = :letter_grade
WHERE id = :id
```

```sql
-- src/lib/server/sql/delete-grade.sql
DELETE FROM grades WHERE id = :id
```

**Remote Functions:**

```ts
// src/routes/(app)/grades/data.remote.ts
import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error, invalid } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { calculateGrade, gradeSchema } from '$lib/validations/grade';
import { getPool } from '$lib/server/db';
import { requireRole, requireUser } from '$lib/server/auth';
import {
	selectGrades,
	selectEnrollments,
	insertGrade,
	updateGrade as updateGradeDb,
	deleteGrade as deleteGradeDb
} from '$lib/server/sql';

export const getGrades = query(async () => {
	const user = await requireUser();
	// Lecturers see grades for their courses, students see their own
	if (user.role === 'LECTURER') {
		return await selectGrades(getPool(), {
			where: [['lecturer_id', '=', user.lecturerId!]]
		});
	}
	if (user.role === 'STUDENT') {
		return await selectGrades(getPool(), {
			where: [['student_id', '=', user.studentId!]]
		});
	}
	return await selectGrades(getPool());
});

export const getGrade = query(v.string(), async (id) => {
	const user = await requireUser();
	const [grade] = await selectGrades(getPool(), { where: [['id', '=', id]] });
	if (!grade) error(404, 'Nilai tidak ditemukan');
	// Students can only view their own grades
	if (user.role === 'STUDENT' && grade.student_id !== user.studentId) {
		throw error(403, 'Anda tidak berhak melihat nilai ini');
	}
	// Lecturers can only view grades for their courses
	if (user.role === 'LECTURER') {
		const [enrollment] = await selectEnrollments(getPool(), {
			where: [['id', '=', grade.enrollment_id]]
		});
		if (enrollment?.lecturer_id !== user.lecturerId) {
			throw error(403, 'Anda tidak berhak melihat nilai ini');
		}
	}
	return grade;
});

export const getGradesByCourse = query(v.string(), async (courseId) => {
	await requireRole(['ADMIN', 'LECTURER']);
	return selectGrades(getPool(), { where: [['course_id', '=', courseId]] });
});

export const getGradesByStudent = query(v.string(), async (studentId) => {
	const user = await requireUser();
	// Students can only view their own grades
	if (user.role === 'STUDENT' && user.studentId !== studentId) {
		throw error(403, 'Anda tidak berhak melihat nilai mahasiswa lain');
	}
	return selectGrades(getPool(), { where: [['student_id', '=', studentId]] });
});

export const createGrade = form(gradeSchema, async (data, issue) => {
	const user = await requireRole(['LECTURER', 'ADMIN']);

	const [enrollment] = await selectEnrollments(getPool(), {
		where: [['id', '=', data.enrollmentId]]
	});
	if (!enrollment) {
		throw error(404, 'Data KRS tidak ditemukan');
	}

	// Lecturers can only grade their own courses
	if (user.role === 'LECTURER' && enrollment.lecturer_id !== user.lecturerId) {
		throw error(403, 'Anda tidak berhak menginput nilai untuk mata kuliah ini');
	}

	const [existing] = await selectGrades(getPool(), {
		where: [['enrollment_id', '=', data.enrollmentId]]
	});
	if (existing) invalid(issue.enrollmentId('Nilai untuk enrollment ini sudah ada'));

	const { total, letter } = calculateGrade(
		data.assignmentScore,
		data.midtermScore,
		data.finalScore
	);
	const id = randomUUID();
	await insertGrade(getPool(), {
		id,
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
	v.object({ id: v.string(), ...gradeSchema.entries }),
	async (data) => {
		const user = await requireRole(['LECTURER', 'ADMIN']);

		const [existingGrade] = await selectGrades(getPool(), {
			where: [['id', '=', data.id]]
		});
		if (!existingGrade) {
			throw error(404, 'Nilai tidak ditemukan');
		}

		const [enrollment] = await selectEnrollments(getPool(), {
			where: [['id', '=', existingGrade.enrollment_id]]
		});

		// Lecturers can only update grades for their own courses
		if (user.role === 'LECTURER' && enrollment?.lecturer_id !== user.lecturerId) {
			throw error(403, 'Anda tidak berhak mengubah nilai ini');
		}

		const { id, ...scores } = data;
		const { total, letter } = calculateGrade(
			scores.assignmentScore,
			scores.midtermScore,
			scores.finalScore
		);
		await updateGradeDb(
			getPool(),
			{
				assignment_score: scores.assignmentScore,
				midterm_score: scores.midtermScore,
				final_score: scores.finalScore,
				total_score: total,
				letter_grade: letter
			},
			{ id }
		);
		await getGrades().refresh();
		await getGrade(id).refresh();
		return { success: true, id };
	}
);

// Batch upsert: insert or update each grade by enrollmentId
export const batchInputGrades = form(
	v.object({
		grades: v.array(v.object(gradeSchema.entries))
	}),
	async (data) => {
		const user = await requireRole(['LECTURER', 'ADMIN']);

		for (const g of data.grades) {
			const [enrollment] = await selectEnrollments(getPool(), {
				where: [['id', '=', g.enrollmentId]]
			});

			// Lecturers can only grade their own courses
			if (user.role === 'LECTURER' && enrollment?.lecturer_id !== user.lecturerId) {
				throw error(403, `Anda tidak berhak menginput nilai untuk enrollment ${g.enrollmentId}`);
			}

			const { total, letter } = calculateGrade(g.assignmentScore, g.midtermScore, g.finalScore);
			const [existing] = await selectGrades(getPool(), {
				where: [['enrollment_id', '=', g.enrollmentId]]
			});
			if (existing && existing.id) {
				await updateGradeDb(
					getPool(),
					{
						assignment_score: g.assignmentScore,
						midterm_score: g.midtermScore,
						final_score: g.finalScore,
						total_score: total,
						letter_grade: letter
					},
					{ id: existing.id }
				);
			} else {
				await insertGrade(getPool(), {
					id: randomUUID(),
					enrollment_id: g.enrollmentId,
					assignment_score: g.assignmentScore,
					midterm_score: g.midtermScore,
					final_score: g.finalScore,
					total_score: total,
					letter_grade: letter
				});
			}
		}
		await getGrades().refresh();
		return { success: true, count: data.grades.length };
	}
);

export const deleteGrade = command(v.string(), async (id) => {
	const user = await requireRole(['LECTURER', 'ADMIN']);

	const [existingGrade] = await selectGrades(getPool(), {
		where: [['id', '=', id]]
	});
	if (!existingGrade || !existingGrade.enrollment_id) {
		throw error(404, 'Nilai tidak ditemukan');
	}

	const [enrollment] = await selectEnrollments(getPool(), {
		where: [['id', '=', existingGrade.enrollment_id]]
	});

	if (user.role === 'LECTURER' && enrollment?.lecturer_id !== user.lecturerId) {
		throw error(403, 'Anda tidak berhak menghapus nilai ini');
	}

	await deleteGradeDb(getPool(), { id });
	await getGrades().refresh();
	return { success: true };
});
```

### 5.4 Enrollment (KRS) Management

**SQL Files:**

```sql
-- src/lib/server/sql/select-enrollments.sql  (@dynamicQuery)
-- @dynamicQuery
SELECT
    e.id, e.student_id, e.course_id, e.lecturer_id, e.class_room_id, e.schedule_id,
    e.semester, e.academic_year,
    s.name as student_name, sp.name as study_program_name,
    c.name as course_name, c.credits as course_credits,
    l.name as lecturer_name, cr.name as class_room_name,
    sch.day as schedule_day, sch.start_time as schedule_start_time,
    sch.end_time as schedule_end_time,
    g.id as grade_id, g.letter_grade as letter_grade
FROM enrollments e
INNER JOIN students s ON e.student_id = s.id
INNER JOIN study_programs sp ON s.study_program_id = sp.id
INNER JOIN courses c ON e.course_id = c.id
INNER JOIN lecturers l ON e.lecturer_id = l.id
INNER JOIN class_rooms cr ON e.class_room_id = cr.id
INNER JOIN schedules sch ON e.schedule_id = sch.id
LEFT JOIN grades g ON e.id = g.enrollment_id
ORDER BY e.academic_year DESC, s.name ASC
```

```sql
-- src/lib/server/sql/insert-schedule.sql
INSERT INTO schedules (id, class_room_id, day, start_time, end_time, lecturer_id)
VALUES (:id, :class_room_id, :day, :start_time, :end_time, :lecturer_id)
```

```sql
-- src/lib/server/sql/update-schedule.sql
UPDATE schedules
SET class_room_id = :class_room_id, day = :day, start_time = :start_time,
    end_time = :end_time, lecturer_id = :lecturer_id
WHERE id = :id
```

```sql
-- src/lib/server/sql/insert-enrollment.sql
INSERT INTO enrollments (id, student_id, course_id, lecturer_id, class_room_id, schedule_id, semester, academic_year)
VALUES (:id, :student_id, :course_id, :lecturer_id, :class_room_id, :schedule_id, :semester, :academic_year)
```

```sql
-- src/lib/server/sql/update-enrollment.sql
UPDATE enrollments
SET student_id = :student_id, course_id = :course_id, lecturer_id = :lecturer_id,
    class_room_id = :class_room_id, semester = :semester, academic_year = :academic_year
WHERE id = :id
```

```sql
-- src/lib/server/sql/delete-enrollment.sql
DELETE FROM enrollments WHERE id = :id
```

```sql
-- src/lib/server/sql/delete-schedule.sql
DELETE FROM schedules WHERE id = :id
```

**Remote Functions:**

```ts
// src/routes/(app)/enrollments/data.remote.ts
import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error, invalid } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { getPool } from '$lib/server/db';
import { requireRole, requireUser } from '$lib/server/auth';
import { parseISO, formatDateTime, getDuration } from '$lib/time-helpers';
import {
	selectEnrollments,
	selectSchedules,
	insertSchedule,
	updateSchedule as updateScheduleDb,
	insertEnrollment,
	updateEnrollment as updateEnrollmentDb,
	deleteSchedule,
	deleteEnrollment as deleteEnrollmentDb
} from '$lib/server/sql';
import { enrollmentSchema } from '$lib/validations/enrollment';

export const getEnrollments = query(async () => {
	const user = await requireUser();
	// Students see only their own enrollments
	if (user.role === 'STUDENT') {
		return await selectEnrollments(getPool(), {
			where: [['student_id', '=', user.studentId!]]
		});
	}
	// Lecturers see enrollments for their courses
	if (user.role === 'LECTURER') {
		return await selectEnrollments(getPool(), {
			where: [['lecturer_id', '=', user.lecturerId!]]
		});
	}
	return await selectEnrollments(getPool());
});

export const getEnrollment = query(v.string(), async (id) => {
	const user = await requireUser();
	const [enrollment] = await selectEnrollments(getPool(), { where: [['id', '=', id]] });
	if (!enrollment) error(404, 'Data KRS tidak ditemukan');

	// Students can only view their own enrollments
	if (user.role === 'STUDENT' && enrollment.student_id !== user.studentId) {
		throw error(403, 'Anda tidak berhak melihat data KRS ini');
	}
	// Lecturers can only view enrollments for their courses
	if (user.role === 'LECTURER' && enrollment.lecturer_id !== user.lecturerId) {
		throw error(403, 'Anda tidak berhak melihat data KRS ini');
	}
	return enrollment;
});

export const createEnrollment = form(enrollmentSchema, async (data, issue) => {
	const user = await requireRole(['ADMIN', 'STUDENT']);
	// Students can only create enrollments for themselves
	if (user.role === 'STUDENT' && data.studentId !== user.studentId) {
		throw error(403, 'Anda tidak berhak membuat KRS untuk mahasiswa lain');
	}

	const startDate = parseISO(data.startTime);
	const endDate = parseISO(data.endTime);

	if (endDate <= startDate)
		invalid(issue.endTime('Waktu selesai harus lebih lambat dari waktu mulai'));

	const durationStr = getDuration(startDate, endDate, 'simple');
	const durationHours = parseFloat(durationStr);
	if (durationHours < 1) invalid(issue.startTime('Durasi kuliah minimal 1 jam'));
	if (durationHours > 4) invalid(issue.endTime('Durasi kuliah maksimal 4 jam'));

	const existingSchedules = await selectSchedules(getPool(), {
		where: [
			['class_room_id', '=', data.classRoomId],
			['day', '=', data.day]
		]
	});
	const conflict = existingSchedules.find((s) => {
		if (!s.start_time || !s.end_time) return false;
		const s1 = new Date(s.start_time).getTime();
		const e1 = new Date(s.end_time).getTime();
		const s2 = startDate.getTime();
		const e2 = endDate.getTime();
		return s1 < e2 && s2 < e1;
	});
	if (conflict) {
		invalid(
			issue.classRoomId(
				`Jadwal bentrok (${formatDateTime(conflict.start_time, 'time')}-${formatDateTime(conflict.end_time, 'time')})`
			)
		);
	}

	const [existing] = await selectEnrollments(getPool(), {
		where: [
			['student_id', '=', data.studentId],
			['course_id', '=', data.courseId],
			['semester', '=', data.semester]
		]
	});
	if (existing)
		invalid(issue.courseId('Mahasiswa sudah mengambil mata kuliah ini pada semester ini'));

	const scheduleId = randomUUID();
	await insertSchedule(getPool(), {
		id: scheduleId,
		class_room_id: data.classRoomId,
		day: data.day,
		start_time: startDate,
		end_time: endDate,
		lecturer_id: data.lecturerId
	});
	await insertEnrollment(getPool(), {
		id: randomUUID(),
		student_id: data.studentId,
		course_id: data.courseId,
		class_room_id: data.classRoomId,
		lecturer_id: data.lecturerId,
		schedule_id: scheduleId,
		semester: data.semester,
		academic_year: data.academicYear
	});

	await getEnrollments().refresh();
	return { success: true };
});

export const updateEnrollment = form(
	v.object({ id: v.string(), ...enrollmentSchema.entries }),
	async (data, issue) => {
		await requireRole(['ADMIN']);
		const [enrollment] = await selectEnrollments(getPool(), { where: [['id', '=', data.id]] });
		if (!enrollment) throw error(404, 'Data KRS tidak ditemukan');
		if (enrollment.grade_id) throw error(400, 'Tidak dapat mengubah KRS yang sudah memiliki nilai');

		const startDate = parseISO(data.startTime);
		const endDate = parseISO(data.endTime);

		if (endDate <= startDate)
			invalid(issue.endTime('Waktu selesai harus lebih lambat dari waktu mulai'));

		const durationStr = getDuration(startDate, endDate, 'simple');
		const durationHours = parseFloat(durationStr);
		if (durationHours < 1) invalid(issue.startTime('Durasi kuliah minimal 1 jam'));
		if (durationHours > 4) invalid(issue.endTime('Durasi kuliah maksimal 4 jam'));

		const existingSchedules = await selectSchedules(getPool(), {
			where: [
				['class_room_id', '=', data.classRoomId],
				['day', '=', data.day]
			]
		});
		const conflict = existingSchedules.find((s) => {
			if (!s.start_time || !s.end_time) return false;
			if (s.id === enrollment.schedule_id) return false;
			const s1 = new Date(s.start_time).getTime();
			const e1 = new Date(s.end_time).getTime();
			const s2 = startDate.getTime();
			const e2 = endDate.getTime();
			return s1 < e2 && s2 < e1;
		});
		if (conflict) {
			invalid(
				issue.classRoomId(
					`Jadwal bentrok (${formatDateTime(conflict.start_time, 'time')}-${formatDateTime(conflict.end_time, 'time')})`
				)
			);
		}

		const [existing] = await selectEnrollments(getPool(), {
			where: [
				['student_id', '=', data.studentId],
				['course_id', '=', data.courseId],
				['semester', '=', data.semester]
			]
		});
		if (existing && existing.id !== data.id)
			invalid(issue.courseId('Mahasiswa sudah mengambil mata kuliah ini pada semester ini'));

		await updateScheduleDb(
			getPool(),
			{
				class_room_id: data.classRoomId,
				day: data.day,
				start_time: startDate,
				end_time: endDate,
				lecturer_id: data.lecturerId
			},
			{ id: enrollment.schedule_id! }
		);
		await updateEnrollmentDb(
			getPool(),
			{
				student_id: data.studentId,
				course_id: data.courseId,
				class_room_id: data.classRoomId,
				lecturer_id: data.lecturerId,
				semester: data.semester,
				academic_year: data.academicYear
			},
			{ id: data.id }
		);

		await getEnrollments().refresh();
		await getEnrollment(data.id).refresh();
		return { success: true };
	}
);

export const deleteEnrollment = command(v.string(), async (id) => {
	await requireRole(['ADMIN']);
	const [enrollment] = await selectEnrollments(getPool(), { where: [['id', '=', id]] });
	if (!enrollment) throw error(404, 'Data KRS tidak ditemukan');
	if (enrollment.grade_id) throw error(400, 'Tidak dapat menghapus KRS yang sudah memiliki nilai');

	await deleteEnrollmentDb(getPool(), { id });
	await deleteSchedule(getPool(), { id: enrollment.schedule_id! });

	await getEnrollments().refresh();
	return { success: true };
});
```

### 5.5 Faculty Management

**SQL Files:**

```sql
-- src/lib/server/sql/select-faculties.sql  (@dynamicQuery)
-- @dynamicQuery
SELECT id, name, created_at, updated_at,
    (SELECT COUNT(*) FROM study_programs sp WHERE sp.faculty_id = faculties.id) as study_program_count
FROM faculties
ORDER BY name ASC
```

```sql
-- src/lib/server/sql/insert-faculty.sql
INSERT INTO faculties (id, name) VALUES (:id, :name)
```

```sql
-- src/lib/server/sql/update-faculty.sql
UPDATE faculties SET name = :name WHERE id = :id
```

```sql
-- src/lib/server/sql/delete-faculty.sql
DELETE FROM faculties WHERE id = :id
```

**Remote Functions:**

```ts
// src/routes/(app)/faculties/data.remote.ts
import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { getPool } from '$lib/server/db';
import { requireRole } from '$lib/server/auth';
import {
	selectFaculties,
	insertFaculty,
	updateFaculty as updateFacultyDb,
	deleteFaculty as deleteFacultyDb
} from '$lib/server/sql';
import { facultySchema } from '$lib/validations/faculty';

export const getFaculties = query(async () => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	return selectFaculties(getPool());
});

export const getFaculty = query(v.string(), async (id) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const [faculty] = await selectFaculties(getPool(), { where: [['id', '=', id]] });
	if (!faculty) error(404, 'Fakultas tidak ditemukan');
	return faculty;
});

export const createFaculty = form(facultySchema, async (data) => {
	await requireRole(['ADMIN']);
	const [existing] = await selectFaculties(getPool(), { where: [['id', '=', data.id]] });
	if (existing) throw error(400, 'ID fakultas sudah digunakan');

	await insertFaculty(getPool(), { id: data.id, name: data.name });
	await getFaculties().refresh();
	return { success: true };
});

export const updateFaculty = form(facultySchema, async (data) => {
	await requireRole(['ADMIN']);
	await updateFacultyDb(getPool(), { name: data.name }, { id: data.id });
	await getFaculties().refresh();
	await getFaculty(data.id).refresh();
	return { success: true };
});

export const deleteFaculty = command(v.string(), async (id) => {
	await requireRole(['ADMIN']);
	const [faculty] = await selectFaculties(getPool(), { where: [['id', '=', id]] });
	if (!faculty) throw error(404, 'Fakultas tidak ditemukan');
	if ((faculty.study_program_count ?? 0) > 0)
		throw error(400, 'Tidak dapat menghapus fakultas yang masih memiliki program studi');

	await deleteFacultyDb(getPool(), { id });
	await getFaculties().refresh();
});
```

### 5.6 Study Program Management

**SQL Files:**

```sql
-- src/lib/server/sql/select-study-programs.sql  (@dynamicQuery)
-- @dynamicQuery
SELECT sp.id, sp.name, sp.head, sp.faculty_id, f.name as faculty_name, sp.created_at, sp.updated_at,
    (SELECT COUNT(*) FROM students s WHERE s.study_program_id = sp.id) as student_count
FROM study_programs sp
INNER JOIN faculties f ON sp.faculty_id = f.id
ORDER BY sp.name ASC
```

```sql
-- src/lib/server/sql/insert-study-program.sql
INSERT INTO study_programs (id, name, head, faculty_id)
VALUES (:id, :name, :head, :faculty_id)
```

```sql
-- src/lib/server/sql/update-study-program.sql
UPDATE study_programs
SET name = :name, head = :head, faculty_id = :faculty_id
WHERE id = :id
```

```sql
-- src/lib/server/sql/delete-study-program.sql
DELETE FROM study_programs WHERE id = :id
```

**Remote Functions:**

```ts
// src/routes/(app)/study-programs/data.remote.ts
import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { getPool } from '$lib/server/db';
import { requireRole } from '$lib/server/auth';
import {
	selectStudyPrograms,
	selectFaculties,
	insertStudyProgram,
	updateStudyProgram as updateStudyProgramDb,
	deleteStudyProgram as deleteStudyProgramDb
} from '$lib/server/sql';
import { studyProgramSchema } from '$lib/validations/study-program';

export const getStudyPrograms = query(async () => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	return selectStudyPrograms(getPool());
});

export const getStudyProgram = query(v.string(), async (id) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const [sp] = await selectStudyPrograms(getPool(), { where: [['id', '=', id]] });
	if (!sp) error(404, 'Program studi tidak ditemukan');
	return sp;
});

export const createStudyProgram = form(studyProgramSchema, async (data) => {
	await requireRole(['ADMIN']);
	const [existing] = await selectStudyPrograms(getPool(), { where: [['id', '=', data.id]] });
	if (existing) throw error(400, 'ID program studi sudah digunakan');

	const [faculty] = await selectFaculties(getPool(), { where: [['id', '=', data.facultyId]] });
	if (!faculty) throw error(400, 'Fakultas tidak ditemukan');

	await insertStudyProgram(getPool(), {
		id: data.id,
		name: data.name,
		head: data.head,
		faculty_id: data.facultyId
	});
	await getStudyPrograms().refresh();
	return { success: true };
});

export const updateStudyProgram = form(studyProgramSchema, async (data) => {
	await requireRole(['ADMIN']);
	await updateStudyProgramDb(
		getPool(),
		{ name: data.name, head: data.head, faculty_id: data.facultyId },
		{ id: data.id }
	);
	await getStudyPrograms().refresh();
	await getStudyProgram(data.id).refresh();
	return { success: true };
});

export const deleteStudyProgram = command(v.string(), async (id) => {
	await requireRole(['ADMIN']);
	const [sp] = await selectStudyPrograms(getPool(), { where: [['id', '=', id]] });
	if (!sp) throw error(404, 'Program studi tidak ditemukan');
	if ((sp.student_count ?? 0) > 0)
		throw error(400, 'Tidak dapat menghapus program studi yang masih memiliki mahasiswa');

	await deleteStudyProgramDb(getPool(), { id });
	await getStudyPrograms().refresh();
});
```

### 5.7 Lecturer Management

**SQL Files:**

```sql
-- src/lib/server/sql/select-lecturers.sql  (@dynamicQuery — replaces by-id / by-email)
-- @dynamicQuery
SELECT id, name, email, phone, address, created_at, updated_at,
    (SELECT COUNT(*) FROM schedules s WHERE s.lecturer_id = lecturers.id) as schedule_count
FROM lecturers
ORDER BY name ASC
```

```sql
-- src/lib/server/sql/insert-lecturer.sql
INSERT INTO lecturers (id, name, email, phone, address)
VALUES (:id, :name, :email, :phone, :address)
```

```sql
-- src/lib/server/sql/update-lecturer.sql
UPDATE lecturers
SET name = :name, email = :email, phone = :phone, address = :address
WHERE id = :id
```

```sql
-- src/lib/server/sql/delete-lectuer.sql
DELETE FROM lecturers WHERE id = :id
```

**Remote Functions:**

```ts
// src/routes/(app)/lecturers/data.remote.ts
import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { hash } from 'argon2';
import { randomUUID } from 'crypto';
import { getPool } from '$lib/server/db';
import { requireRole } from '$lib/server/auth';
import {
	selectLecturers,
	selectUsers,
	insertLecturer,
	insertUser,
	deleteUser,
	updateLecturer as updateLecturerDb,
	deleteLectuer as deleteLecturerDb
} from '$lib/server/sql';
import { lecturerSchema } from '$lib/validations/lecturer';

export const getLecturers = query(async () => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	return selectLecturers(getPool());
});

export const getLecturer = query(v.string(), async (id) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const [lecturer] = await selectLecturers(getPool(), { where: [['id', '=', id]] });
	if (!lecturer) error(404, 'Dosen tidak ditemukan');
	return lecturer;
});

export const createLecturer = form(lecturerSchema, async (data) => {
	await requireRole(['ADMIN']);
	const [existingId] = await selectLecturers(getPool(), { where: [['id', '=', data.id]] });
	if (existingId) throw error(400, 'ID dosen sudah digunakan');

	const [existingEmail] = await selectLecturers(getPool(), { where: [['email', '=', data.email]] });
	if (existingEmail) throw error(400, 'Email sudah terdaftar');

	await insertLecturer(getPool(), {
		id: data.id,
		name: data.name,
		email: data.email,
		phone: data.phone ?? null,
		address: data.address ?? null
	});

	// Create user account with lecturer ID as default password
	const hashedPassword = await hash(data.id);
	await insertUser(getPool(), {
		id: randomUUID(),
		email: data.email,
		password: hashedPassword,
		role: 'LECTURER',
		student_id: null,
		lecturer_id: data.id
	});

	await getLecturers().refresh();
	return { success: true };
});

export const updateLecturer = form(lecturerSchema, async (data) => {
	await requireRole(['ADMIN']);
	const [existingEmail] = await selectLecturers(getPool(), {
		where: [['email', '=', data.email]]
	});
	if (existingEmail && existingEmail.id !== data.id) throw error(400, 'Email sudah digunakan');

	await updateLecturerDb(
		getPool(),
		{
			name: data.name,
			email: data.email,
			phone: data.phone ?? null,
			address: data.address ?? null
		},
		{ id: data.id }
	);
	await getLecturers().refresh();
	await getLecturer(data.id).refresh();
	return { success: true };
});

export const deleteLecturer = command(v.string(), async (id) => {
	await requireRole(['ADMIN']);
	const [lecturer] = await selectLecturers(getPool(), { where: [['id', '=', id]] });
	if (!lecturer) throw error(404, 'Dosen tidak ditemukan');
	if ((lecturer.schedule_count ?? 0) > 0)
		throw error(400, 'Tidak dapat menghapus dosen yang masih memiliki jadwal');

	await deleteLecturerDb(getPool(), { id });

	// Delete associated user account
	const [user] = await selectUsers(getPool(), { where: [['lecturer_id', '=', id]] });
	if (user?.id) {
		await deleteUser(getPool(), { id: user.id });
	}

	await getLecturers().refresh();
	return { success: true };
});
```

### 5.8 Course Management

**SQL Files:**

```sql
-- src/lib/server/sql/select-courses.sql  (@dynamicQuery)
-- @dynamicQuery
SELECT c.id, c.name, c.credits, c.study_program_id, sp.name as study_program_name, c.created_at, c.updated_at,
    (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) as enrollment_count
FROM courses c
INNER JOIN study_programs sp ON c.study_program_id = sp.id
ORDER BY c.name ASC
```

```sql
-- src/lib/server/sql/insert-course.sql
INSERT INTO courses (id, name, credits, study_program_id)
VALUES (:id, :name, :credits, :study_program_id)
```

```sql
-- src/lib/server/sql/update-course.sql
UPDATE courses
SET name = :name, credits = :credits, study_program_id = :study_program_id
WHERE id = :id
```

```sql
-- src/lib/server/sql/delete-course.sql
DELETE FROM courses WHERE id = :id
```

**Remote Functions:**

```ts
// src/routes/(app)/courses/data.remote.ts
import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { getPool } from '$lib/server/db';
import { requireRole } from '$lib/server/auth';
import {
	selectCourses,
	selectStudyPrograms,
	insertCourse,
	updateCourse as updateCourseDb,
	deleteCourse as deleteCourseDb
} from '$lib/server/sql';
import { courseSchema } from '$lib/validations/course';

export const getCourses = query(async () => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	return selectCourses(getPool());
});

export const getCourse = query(v.string(), async (id) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const [course] = await selectCourses(getPool(), { where: [['id', '=', id]] });
	if (!course) error(404, 'Mata kuliah tidak ditemukan');
	return course;
});

export const createCourse = form(courseSchema, async (data) => {
	await requireRole(['ADMIN']);
	const [existing] = await selectCourses(getPool(), { where: [['id', '=', data.id]] });
	if (existing) throw error(400, 'ID mata kuliah sudah digunakan');

	const [sp] = await selectStudyPrograms(getPool(), { where: [['id', '=', data.studyProgramId]] });
	if (!sp) throw error(400, 'Program studi tidak ditemukan');

	await insertCourse(getPool(), {
		id: data.id,
		name: data.name,
		credits: data.credits,
		study_program_id: data.studyProgramId
	});
	await getCourses().refresh();
	return { success: true };
});

export const updateCourse = form(courseSchema, async (data) => {
	await requireRole(['ADMIN']);
	await updateCourseDb(
		getPool(),
		{ name: data.name, credits: data.credits, study_program_id: data.studyProgramId },
		{ id: data.id }
	);
	await getCourses().refresh();
	await getCourse(data.id).refresh();
	return { success: true };
});

export const deleteCourse = command(v.string(), async (id) => {
	await requireRole(['ADMIN']);
	const [course] = await selectCourses(getPool(), { where: [['id', '=', id]] });
	if (!course) throw error(404, 'Mata kuliah tidak ditemukan');
	if ((course.enrollment_count ?? 0) > 0)
		throw error(400, 'Tidak dapat menghapus mata kuliah yang masih memiliki data KRS');

	await deleteCourseDb(getPool(), { id });
	await getCourses().refresh();
});
```

### 5.9 User Management

**SQL Files:**

```sql
-- src/lib/server/sql/select-users.sql  (@dynamicQuery)
-- @dynamicQuery
SELECT
    u.id, u.email, u.role, u.password, u.student_id, u.lecturer_id,
    s.name as student_name, l.name as lecturer_name
FROM users u
LEFT JOIN students s ON u.student_id = s.id
LEFT JOIN lecturers l ON u.lecturer_id = l.id
```

```sql
-- src/lib/server/sql/insert-user.sql
INSERT INTO users (id, email, password, role, student_id, lecturer_id)
VALUES (:id, :email, :password, :role, :student_id, :lecturer_id)
```

```sql
-- src/lib/server/sql/update-user.sql
UPDATE users
SET email = :email, role = :role, student_id = :student_id, lecturer_id = :lecturer_id
WHERE id = :id
```

```sql
-- src/lib/server/sql/delete-user.sql
DELETE FROM users WHERE id = :id
```

**Validation Schema:**

```ts
// src/lib/validations/user.ts
import * as v from 'valibot';

export const userRoleSchema = v.picklist(['ADMIN', 'STUDENT', 'LECTURER']);

export const userSchema = v.object({
	email: v.pipe(v.string(), v.email('Email tidak valid')),
	password: v.pipe(v.string(), v.minLength(6, 'Password minimal 6 karakter')),
	role: userRoleSchema,
	studentId: v.optional(v.string()),
	lecturerId: v.optional(v.string())
});
```

**Remote Functions:**

```ts
// src/routes/(app)/users/data.remote.ts
import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { hash } from 'argon2';
import { randomUUID } from 'crypto';
import { getPool } from '$lib/server/db';
import { requireRole } from '$lib/server/auth';
import {
	selectUsers,
	insertUser,
	updateUser as updateUserDb,
	deleteUser as deleteUserDb
} from '$lib/server/sql';
import { userSchema } from '$lib/validations/user';

export const getUsers = query(async () => {
	await requireRole(['ADMIN']);
	return await selectUsers(getPool());
});

export const getUser = query(v.string(), async (id) => {
	await requireRole(['ADMIN']);
	const [user] = await selectUsers(getPool(), { where: [['id', '=', id]] });
	if (!user) throw error(404, 'User tidak ditemukan');
	return user;
});

export const createUser = form(userSchema, async (data) => {
	await requireRole(['ADMIN']);

	// Check email uniqueness
	const [existing] = await selectUsers(getPool(), { where: [['email', '=', data.email]] });
	if (existing) throw error(400, 'Email sudah terdaftar');

	// Validate role-specific IDs
	if (data.role === 'STUDENT' && !data.studentId) {
		throw error(400, 'Student ID wajib diisi untuk role STUDENT');
	}
	if (data.role === 'LECTURER' && !data.lecturerId) {
		throw error(400, 'Lecturer ID wajib diisi untuk role LECTURER');
	}

	const hashedPassword = await hash(data.password);
	const id = randomUUID();

	await insertUser(getPool(), {
		id,
		email: data.email,
		password: hashedPassword,
		role: data.role,
		student_id: data.studentId ?? null,
		lecturer_id: data.lecturerId ?? null
	});

	await getUsers().refresh();
	return { success: true, id };
});

export const updateUser = form(
	v.object({ id: v.string(), ...userSchema.entries }),
	async (data) => {
		await requireRole(['ADMIN']);
		const { id, password, ...updateData } = data;

		// Check email uniqueness (excluding current user)
		const [existing] = await selectUsers(getPool(), {
			where: [['email', '=', updateData.email]]
		});
		if (existing && existing.id !== id) {
			throw error(400, 'Email sudah digunakan');
		}

		await updateUserDb(
			getPool(),
			{
				email: updateData.email,
				role: updateData.role,
				student_id: updateData.studentId ?? null,
				lecturer_id: updateData.lecturerId ?? null
			},
			{ id }
		);

		await getUsers().refresh();
		await getUser(id).refresh();
		return { success: true };
	}
);

export const deleteUser = command(v.string(), async (id) => {
	await requireRole(['ADMIN']);
	const [user] = await selectUsers(getPool(), { where: [['id', '=', id]] });
	if (!user) throw error(404, 'User tidak ditemukan');

	await deleteUserDb(getPool(), { id });
	await getUsers().refresh();
	return { success: true };
});
```

## 6. Validation

### 6.1 Shared Validation Schemas

```ts
// src/lib/validations/classroom.ts
import * as v from 'valibot';

export const classRoomTypes = ['REGULER', 'LAB_KOMPUTER', 'LAB_BAHASA', 'AUDITORIUM'] as const;

export const classRoomSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Nama ruangan wajib diisi'), v.maxLength(100)),
	classRoomType: v.picklist(classRoomTypes),
	capacity: v.pipe(v.number(), v.minValue(1, 'Kapasitas minimal 1'), v.maxValue(1000)),
	hasProjector: v.optional(v.boolean(), false),
	hasAC: v.optional(v.boolean(), false)
});
```

```ts
// src/lib/validations/student.ts
import * as v from 'valibot';

// No `id` field — student ID is the NRP, auto-generated by generateNRP()
export const studentSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1, 'Nama wajib diisi')),
	email: v.pipe(v.string(), v.email('Email tidak valid')),
	phone: v.optional(v.string()),
	address: v.optional(v.string()),
	yearAdmitted: v.pipe(v.number(), v.minValue(2000), v.maxValue(2100)),
	studyProgramId: v.string()
});
```

```ts
// src/lib/validations/lecturer.ts
import * as v from 'valibot';

export const lecturerSchema = v.object({
	id: v.pipe(v.string(), v.minLength(1, 'ID wajib diisi')),
	name: v.pipe(v.string(), v.minLength(1, 'Nama wajib diisi')),
	email: v.pipe(v.string(), v.email('Email tidak valid')),
	phone: v.optional(v.string()),
	address: v.optional(v.string())
});
```

```ts
// src/lib/validations/faculty.ts
import * as v from 'valibot';

export const facultySchema = v.object({
	id: v.pipe(v.string(), v.minLength(1, 'ID wajib diisi')),
	name: v.pipe(v.string(), v.minLength(1, 'Nama fakultas wajib diisi'))
});
```

```ts
// src/lib/validations/study-program.ts
import * as v from 'valibot';

export const studyProgramSchema = v.object({
	id: v.pipe(v.string(), v.minLength(1, 'ID wajib diisi')),
	name: v.pipe(v.string(), v.minLength(1, 'Nama wajib diisi')),
	head: v.pipe(v.string(), v.minLength(1, 'Nama ketua wajib diisi')),
	facultyId: v.string()
});
```

```ts
// src/lib/validations/course.ts
import * as v from 'valibot';

export const courseSchema = v.object({
	id: v.pipe(v.string(), v.minLength(1, 'ID wajib diisi')),
	name: v.pipe(v.string(), v.minLength(1, 'Nama mata kuliah wajib diisi')),
	credits: v.pipe(v.number(), v.minValue(1), v.maxValue(6)),
	studyProgramId: v.string()
});
```

```ts
// src/lib/validations/enrollment.ts
import * as v from 'valibot';

export const days = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'] as const;

export const enrollmentSchema = v.object({
	studentId: v.string(),
	courseId: v.string(),
	classRoomId: v.string(),
	lecturerId: v.string(),
	day: v.picklist(days),
	startTime: v.string(),
	endTime: v.string(),
	semester: v.string(),
	academicYear: v.string()
});
```

```ts
// src/lib/validations/grade.ts
import * as v from 'valibot';

export const gradeSchema = v.object({
	enrollmentId: v.string(),
	assignmentScore: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
	midtermScore: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
	finalScore: v.pipe(v.number(), v.minValue(0), v.maxValue(100))
});

export function calculateGrade(
	assignment: number,
	midterm: number,
	final: number
): { total: number; letter: string } {
	const total = assignment * 0.3 + midterm * 0.3 + final * 0.4;

	let letter: string;
	if (total >= 85) letter = 'A';
	else if (total >= 70) letter = 'B';
	else if (total >= 55) letter = 'C';
	else if (total >= 40) letter = 'D';
	else letter = 'E';

	return { total, letter };
}

export const gradePoints: Record<string, number> = {
	A: 4.0,
	B: 3.0,
	C: 2.0,
	D: 1.0,
	E: 0.0
};
```

> Time utilities (`parseISO`, `formatDateTime`, `getDuration`, `getDurationHours`, etc.) live in `$lib/time-helpers`. See **Section 10** for the full reference.

---

## 7. Authentication, Authorization & User Settings

### 7.1 Auth Helper

```sql
-- src/lib/server/sql/select-users.sql  (@dynamicQuery — filter by id or email)
-- @dynamicQuery
SELECT
  u.id,
  u.email,
  u.role,
  u.password,
  u.student_id,
  s.name as student_name,
  u.lecturer_id,
  l.name as lecturer_name
FROM users u
LEFT JOIN students s ON u.student_id = s.id
LEFT JOIN lecturers l ON u.lecturer_id = l.id
```

> **Note:** This SQL file must be created manually. It is not auto-generated by the CRUD `includeCrudTables` config (which only produces basic per-table CRUD). After creating the file, run `npm run typesql` to generate the TypeScript function.

```ts
// src/lib/server/auth.ts
import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { verify } from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import { getPool } from '$lib/server/db';
import { selectUsers } from '$lib/server/sql';

const SESSION_COOKIE_NAME = 'session_token';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

interface User {
	id: string;
	email: string;
	role: 'ADMIN' | 'STUDENT' | 'LECTURER';
	studentId: string | null;
	lecturerId: string | null;
	student: { id: string; name: string } | null;
	lecturer: { id: string; name: string } | null;
}

// SelectUsersResult has all fields optional — use ! for required columns
// (safe because no `select` restriction is applied in these calls)
type SelectUserRow = Awaited<ReturnType<typeof selectUsers>>[number];

function mapUser(user: SelectUserRow): User {
	return {
		id: user.id!,
		email: user.email!,
		role: user.role!,
		studentId: user.student_id ?? null,
		lecturerId: user.lecturer_id ?? null,
		student:
			user.student_id && user.student_name
				? { id: user.student_id, name: user.student_name }
				: null,
		lecturer:
			user.lecturer_id && user.lecturer_name
				? { id: user.lecturer_id, name: user.lecturer_name }
				: null
	};
}

export async function getUser(): Promise<User | null> {
	const { cookies } = getRequestEvent();
	const sessionToken = cookies.get(SESSION_COOKIE_NAME);
	if (!sessionToken) return null;

	const { payload } = await jwtVerify(sessionToken, new TextEncoder().encode(env.JWT_SECRET));
	if (typeof payload.sub !== 'string') return null;

	const [user] = await selectUsers(getPool(), { where: [['id', '=', payload.sub]] });
	if (!user) return null;

	return mapUser(user);
}

export async function requireUser(): Promise<User> {
	const user = await getUser();
	if (!user) throw error(401, 'Unauthorized');
	return user;
}

export async function requireRole(roles: Array<'ADMIN' | 'STUDENT' | 'LECTURER'>): Promise<User> {
	const user = await requireUser();
	if (!roles.includes(user.role)) throw error(403, 'Forbidden');
	return user;
}

export async function login(email: string, password: string): Promise<User> {
	const [user] = await selectUsers(getPool(), { where: [['email', '=', email]] });
	if (!user) throw error(401, 'Email atau password salah');

	const valid = await verify(user.password!, password);
	if (!valid) throw error(401, 'Email atau password salah');

	return mapUser(user);
}

export async function setSession(userId: string) {
	const { cookies, url } = getRequestEvent();
	const token = await new SignJWT({})
		.setProtectedHeader({ alg: 'HS256' })
		.setSubject(userId)
		.setIssuedAt()
		.setExpirationTime(`${SESSION_MAX_AGE}s`)
		.sign(new TextEncoder().encode(env.JWT_SECRET));

	cookies.set(SESSION_COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: SESSION_MAX_AGE
	});
}
```

### 7.2 Using Auth in Remote Functions

```ts
export const createGrade = form(gradeSchema, async (data) => {
	const user = await requireRole(['LECTURER', 'ADMIN']);

	if (user.role === 'LECTURER' && user.lecturerId) {
		const [enrollment] = await selectEnrollments(getPool(), {
			where: [['id', '=', data.enrollmentId]]
		});

		if (enrollment && enrollment.lecturer_id !== user.lecturerId) {
			throw error(403, 'Anda tidak berhak menginput nilai untuk mata kuliah ini');
		}
	}
});
```

### 7.3 User Settings

Store user preferences (theme, language, notifications) in the database for persistence across devices.

**SQL (add to users table or create separate settings table):**

```sql
-- Option A: Add columns to existing users table
ALTER TABLE users ADD COLUMN theme_preference VARCHAR(20) DEFAULT 'light';
ALTER TABLE users ADD COLUMN language VARCHAR(10) DEFAULT 'id';
ALTER TABLE users ADD COLUMN notifications_enabled BOOLEAN DEFAULT true;

-- Option B: Separate settings table (if many settings)
CREATE TABLE user_settings (
    user_id VARCHAR(36) PRIMARY KEY,
    theme_preference VARCHAR(20) DEFAULT 'light',
    language VARCHAR(10) DEFAULT 'id',
    notifications_enabled BOOLEAN DEFAULT true,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**SQL File for Settings:**

```sql
-- src/lib/server/sql/select-user-settings.sql
-- @dynamicQuery
SELECT user_id, theme_preference, language, notifications_enabled, updated_at
FROM user_settings
```

```sql
-- src/lib/server/sql/insert-user-settings.sql
INSERT INTO user_settings (user_id, theme_preference, language, notifications_enabled)
VALUES (:user_id, :theme_preference, :language, :notifications_enabled)
ON DUPLICATE KEY UPDATE
    theme_preference = VALUES(theme_preference),
    language = VALUES(language),
    notifications_enabled = VALUES(notifications_enabled)
```

**Remote Functions:**

```ts
// src/routes/settings/data.remote.ts
import * as v from 'valibot';
import { query, form } from '$app/server';
import { error } from '@sveltejs/kit';
import { getPool } from '$lib/server/db';
import { selectUserSettings, insertUserSettings } from '$lib/server/sql';
import { requireUser } from '$lib/server/auth';

const settingsSchema = v.object({
	theme: v.optional(v.picklist(['light', 'dark', 'system'])),
	language: v.optional(v.picklist(['id', 'en'])),
	notifications: v.optional(v.boolean())
});

export const getUserSettings = query(async () => {
	const user = await requireUser();
	const [settings] = await selectUserSettings(getPool(), {
		where: [['user_id', '=', user.id]]
	});

	return {
		theme: settings?.theme_preference ?? 'light',
		language: settings?.language ?? 'id',
		notifications: settings?.notifications_enabled ?? true
	};
});

export const updateSettings = form(settingsSchema, async (data) => {
	const user = await requireUser();

	await insertUserSettings(getPool(), {
		user_id: user.id,
		theme_preference: data.theme ?? 'light',
		language: data.language ?? 'id',
		notifications_enabled: data.notifications ?? true
	});

	await getUserSettings().refresh();
	return { success: true };
});
```

**Frontend Usage:**

```svelte
<script lang="ts">
	import { getUserSettings, updateSettings } from './data.remote';

	const settings = getUserSettings();

	async function toggleTheme() {
		const newTheme = $settings.theme === 'dark' ? 'light' : 'dark';
		await updateSettings({ theme: newTheme });
	}
</script>

<button onclick={toggleTheme}>
	Theme: {$settings?.theme}
</button>
```

---

## 8. Error Handling

### 8.1 Global Error Handler

SvelteKit exposes three server hooks in `src/hooks.server.ts`: `handle`, `handleError`, and `handleFetch`.

```ts
// src/hooks.server.ts
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { getUser } from '$lib/server/auth';

// Runs on every request — attach the current user to locals
// so any route can access it via event.locals.user
export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = await getUser();
	return resolve(event);
};

// Runs when an unexpected error is thrown (not HttpError / Redirect)
export const handleError: HandleServerError = ({ error, status, message }) => {
	console.error('Server error:', error);

	return {
		message: status === 500 ? 'Terjadi kesalahan pada server' : message
	};
};
```

`handleValidationError` is **not** a SvelteKit hook — validation errors from `invalid()` are handled inside the `form()` callback itself and returned to the client automatically by `$app/server`.

---

## 9. NRP Generation

### 9.1 NRP Generator

```ts
// src/lib/server/NRP-generator.ts
import { getPool } from '$lib/server/db';
import { selectStudyPrograms, selectStudents } from '$lib/server/sql';

export async function generateNRP(studyProgramId: string, yearAdmitted: number): Promise<string> {
	const [studyProgram] = await selectStudyPrograms(getPool(), {
		where: [['id', '=', studyProgramId]]
	});

	if (!studyProgram) {
		throw new Error('Program studi tidak ditemukan');
	}

	const yearCode = yearAdmitted.toString().slice(-2);
	const facultyCode = (studyProgram.faculty_name ?? '').padStart(2, '0');
	const studyProgramCode = studyProgramId.padStart(2, '0');

	const students = await selectStudents(getPool(), {
		select: { id: true },
		where: [
			['study_program_id', '=', studyProgramId],
			['year_admitted', '=', yearAdmitted]
		]
	});

	const count = students.length;
	const sequence = (count + 1).toString().padStart(3, '0');

	return `${yearCode}${facultyCode}${studyProgramCode}${sequence}`;
}
```

### 9.2 Usage Example

> `generateNRP` is called inside `createStudent` in `src/routes/(app)/students/data.remote.ts`. See §5.2 for the full remote function — the NRP replaces `data.id` as the student's primary key, so `studentSchema` does not include an `id` field.

---

## 10. Time Handling (`$lib/time-helpers`)

### 10.1 UTC Storage Strategy

**Database:**

- All dates stored as **DateTime** in **UTC** format
- MySQL `DATETIME(3)` provides millisecond precision
- Example: `2024-04-15 01:00:00.000` (UTC)

**Application:**

- Display in **Asia/Jakarta** timezone (UTC+7)
- Input in **Asia/Jakarta** timezone
- Convert to/from UTC for database operations

**Example:**

```
User Input: 15 April 2024 08:00 WIB
     ↓ (Convert to UTC)
DB Storage: 2024-04-15 01:00:00.000 UTC
     ↓ (Convert to Asia/Jakarta)
Display: 15 April 2024 08.00 WIB
```

### 10.2 Helper Functions

```ts
// src/lib/time-helpers.ts
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import localeData from 'dayjs/plugin/localeData';
import duration from 'dayjs/plugin/duration';
import 'dayjs/locale/id';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(localeData);
dayjs.extend(duration);

export function toUTCDate(date: Date | dayjs.Dayjs): Date {
	return dayjs(date).utc().toDate();
}

export function createUTCDate(
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number,
	second: number = 0
): Date {
	const date = dayjs()
		.year(year)
		.month(month)
		.date(day)
		.hour(hour)
		.minute(minute)
		.second(second)
		.millisecond(0)
		.utc()
		.toDate();

	return date;
}

export function createUTCDateFromString(dateStr: string, timeStr: string): Date {
	const [year, month, day] = dateStr.split('-').map(Number);
	const [hour, minute] = timeStr.split(':').map(Number);

	return createUTCDate(year, month - 1, day, hour, minute);
}

export function parseISO(isoStr: string): Date {
	if (isoStr.includes('Z') || isoStr.includes('+') || isoStr.includes('T')) {
		return dayjs(isoStr).utc().toDate();
	}
	return dayjs(isoStr, 'Asia/Jakarta').utc().toDate();
}

export function formatDateTime(
	date: Date | dayjs.Dayjs,
	format: 'full' | 'date' | 'time' = 'full',
	timezone: string = 'Asia/Jakarta'
): string {
	const dayjsDate = dayjs(date).tz(timezone);

	switch (format) {
		case 'time':
			return dayjsDate.format('HH:mm');
		case 'date':
			return dayjsDate.format('DD MMMM YYYY');
		case 'full':
		default:
			return dayjsDate.format('DD MMMM YYYY HH:mm');
	}
}

export function getDuration(
	startDate: Date | dayjs.Dayjs,
	endDate: Date | dayjs.Dayjs,
	format: 'full' | 'short' | 'simple' = 'full'
): string {
	const dur = dayjs.duration(dayjs(endDate).diff(dayjs(startDate)));
	switch (format) {
		case 'short':
			return dur.format('HH:mm');
		case 'full':
			return dur.format('DD HH:mm');
		case 'simple':
			return dur.format('HH');
	}
}

export function getTimeComponents(
	date: Date | dayjs.Dayjs,
	timezone: string
): {
	hours: number;
	minutes: number;
	day: number;
	month: number;
	year: number;
	dayOfWeek: number;
} {
	const dayjsDate = dayjs(date).tz(timezone);

	return {
		hours: dayjsDate.hour(),
		minutes: dayjsDate.minute(),
		day: dayjsDate.date(),
		month: dayjsDate.month() + 1,
		year: dayjsDate.year(),
		dayOfWeek: dayjsDate.day()
	};
}
```

### 10.3 Key Rules

- Store all datetimes as **UTC** (`DATETIME(3)`) in the database
- Use `parseISO(isoString)` to convert frontend input → UTC `Date` before saving
- Use `formatDateTime(date, 'full'|'time'|'date')` to display in Asia/Jakarta (UTC+7)
- Use `getDuration(start, end, 'simple')` for duration validation in forms (returns hours as string)
- Avoid `GROUP BY` with `-- @dynamicQuery`; use correlated subqueries for counts instead
- Roll count subqueries into `SELECT` columns (e.g. `study_program_count`, `student_count`) instead of separate count SQL files — this lets `deleteXxx` remote functions fetch the row and check the count in one call
- For multi-filter counts (e.g. NRP generation needing `study_program_id` + `year_admitted`), use the dynamic query with multiple `where` clauses and count `.length` on the result instead of creating a separate count SQL file

---

## 11. Best Practices

1. **Server-only**: Keep db, auth, and SQL helpers in `src/lib/server/`
2. **Validation**: Use Valibot in all `form()` and `command()` callbacks; prefer `invalid()` for field errors, `error()` for HTTP errors
3. **Manual IDs**: `faculties`, `study_programs`, `students`, `lecturers`, `courses` use caller-assigned IDs; auto-UUID tables (`class_rooms`, `schedules`, `enrollments`, `grades`, `users`) set `DEFAULT (UUID())` in the schema
4. **TypeSQL imports**: Rename generated functions that conflict with remote function names — `import { deleteLectuer as deleteLecturerDb, updateStudent as updateStudentDb } from '$lib/server/sql'`
5. **Dynamic queries**: Use `-- @dynamicQuery` on a bare `SELECT` (no WHERE in SQL); pass filters at call time via `where: [['column', 'op', value]]`
6. **Transactions**: Use `transaction(async conn => { ... })` from `$lib/server/db`; pass `conn` (not `getPool()`) to TypeSQL functions inside the callback
7. **Refresh**: Call `getXxx().refresh()` after every mutation
8. **Auth**: Call `requireRole(['ADMIN', ...])` at the top of any remote function that requires authorization

---

## 12. TypeSQL Quick Reference

### Dynamic WHERE (`-- @dynamicQuery`)

Add `-- @dynamicQuery` to any `SELECT` (no WHERE clause in the SQL). TypeSQL generates a function that accepts an optional `where` array at call time — all filters are applied as `WHERE 1=1 AND ...` at runtime.

```sql
-- @dynamicQuery
SELECT s.id, s.name, s.email, s.study_program_id
FROM students s
ORDER BY s.name ASC
```

```ts
await selectStudents(getPool()); // all rows
await selectStudents(getPool(), { where: [['id', '=', id]] }); // by id
await selectStudents(getPool(), { where: [['email', '=', email]] }); // by email
await selectStudents(getPool(), {
	// multiple filters
	where: [
		['study_program_id', '=', studyProgramId],
		['year_admitted', '=', 2024]
	]
});
await selectStudents(getPool(), {
	// LIKE search
	where: [['name', 'LIKE', 'Ahmad']] // auto-wraps as LIKE '%Ahmad%'
});
await selectStudents(getPool(), {
	// select specific columns
	select: { id: true, name: true, email: true },
	where: [['study_program_id', '=', studyProgramId]]
});
```

Available operators: `'='` `'<>'` `'>'` `'<'` `'>='` `'<='` `'LIKE'` `'IN'` `'NOT IN'` `'BETWEEN'` `'EXISTS'` `'NOT EXISTS'`

The `where` column names correspond to the **result column aliases** from the SELECT (e.g. `'course_id'` from `c.id as course_id`).

### Common SQL Patterns

- **Correlated subquery for counts**: See `select-class-rooms.sql` in §5.1 — roll counts into `SELECT` columns so delete functions can check them in one call. Prefer this over separate count SQL files.
- **Multi-filter count (no separate SQL file needed)**: Use `-- @dynamicQuery` with multiple `where` clauses and count `.length` on the result — see NRP generator in §9.1 for an example using `selectStudents` with `study_program_id` + `year_admitted` filters.
- **User lookup with JOINs**: See `select-users.sql` in §7.1 — a dynamic query over `users` with `LEFT JOIN` to `students` and `lecturers` for name resolution. Filter by `id` (session lookup) or `email` (login).
- **Upsert**: `INSERT INTO grades (...) VALUES (...) ON DUPLICATE KEY UPDATE assignment_score = VALUES(assignment_score), ...`
- **Range query (regular parameterised query, not `@dynamicQuery`)**: `SELECT * FROM schedules WHERE start_time >= :startDate AND start_time <= :endDate`
