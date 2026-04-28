# Watum — Comprehensive Technical Documentation

> **Project**: Watum Academic Scheduling System  
> **Stack**: SvelteKit 2.x, MariaDB (MySQL), Bun, TypeScript  
> **Scale**: Stress-tested to 10,000,000 rows (enrollments)  
> **Last Updated**: 2026-04-28

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Database Architecture](#3-database-architecture)
4. [Application Architecture](#4-application-architecture)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Conflict Audit System](#6-conflict-audit-system)
7. [Performance Optimizations](#7-performance-optimizations)
8. [Stress Testing & Benchmarking](#8-stress-testing--benchmarking)
9. [Deployment & Operations](#9-deployment--operations)
10. [File Structure](#10-file-structure)

---

## 1. Project Overview

Watum is a full-stack academic scheduling and management system designed for Indonesian universities. It handles:

- **Faculty, Study Program, Student, and Lecturer management**
- **Course catalog with credits and lecturers**
- **Classroom scheduling with conflict detection**
- **Student enrollment (KRS) with schedule assignment**
- **Grade management (Nilai)**
- **Role-based access control** (Admin, Lecturer, Student)

The system is architected to scale to **10 million enrollment rows** while maintaining sub-second query performance for the primary dashboard and scheduling workflows.

---

## 2. Technology Stack

### Frontend

| Technology    | Version | Purpose                                       |
| ------------- | ------- | --------------------------------------------- |
| SvelteKit     | 2.57.1  | Full-stack framework with SSR/SPA hybrid      |
| Svelte        | 5.x     | Reactive UI with runes (`$state`, `$derived`) |
| Tailwind CSS  | 4.2.3   | Utility-first CSS                             |
| Lucide Svelte | 1.8.0   | Icon library                                  |
| Bits UI       | 2.18.0  | Headless UI primitives (select, dialog, etc.) |

### Backend

| Technology      | Version | Purpose                                 |
| --------------- | ------- | --------------------------------------- |
| Bun             | 1.3+    | Runtime (replaced Node.js 22.x)         |
| MariaDB (MySQL) | 10.11+  | Primary database                        |
| mysql2          | 3.22.2  | Database driver (Promise API + pooling) |
| @node-rs/argon2 | 2.0.2   | Password hashing (prebuilt Rust binary) |
| jose            | 6.2.2   | JWT signing/verification                |
| Valibot         | 1.3.1   | Schema validation                       |
| dayjs           | 1.11.20 | Date/time manipulation                  |

### Build & Tooling

- **Vite** 8.x — Build tool
- **svelte-adapter-bun** — Bun server adapter (replaced @sveltejs/adapter-node)
- **TypeScript** — Type safety
- **ESLint + Prettier** — Code quality

---

## 3. Database Architecture

### 3.1 Schema Overview

The database uses **InnoDB** with **utf8mb4** collation. There are 10 core tables:

| Table            | Rows (stress) | Purpose                 |
| ---------------- | ------------- | ----------------------- |
| `faculties`      | 3             | Faculty/Fakultas        |
| `study_programs` | 6             | Study programs/Prodi    |
| `students`       | 1,500,000     | Students                |
| `lecturers`      | 250           | Lecturers               |
| `courses`        | 48            | Courses/Mata Kuliah     |
| `class_rooms`    | 71,636        | Classrooms              |
| `schedules`      | 48            | Schedule slots          |
| `enrollments`    | 2,750,779     | KRS enrollments         |
| `grades`         | 2,750,779     | Grades/Nilai            |
| `users`          | 1,250,606     | Authentication accounts |
| `refresh_tokens` | ~200          | Active sessions         |

### 3.2 ID Strategy

- **Manual IDs**: `faculties`, `study_programs`, `students`, `lecturers`, `courses` — use human-readable IDs (e.g., `FTI`, `TI`, `stress-mhs-0000001`)
- **UUID IDs**: `class_rooms`, `schedules`, `enrollments`, `grades`, `users` — use `DEFAULT (UUID())`

### 3.3 Denormalization Strategy

The `enrollments` table contains **9 denormalized audit columns** to enable fast conflict detection without JOINs:

```
enrollments
├── student_audit_sk      (→ students.audit_sk)
├── course_audit_sk       (→ courses.audit_sk)
├── lecturer_audit_sk     (→ courses.lecturer_audit_sk)
├── class_room_audit_sk   (→ class_rooms.audit_sk)
├── schedule_audit_sk     (→ schedules.audit_sk)
├── academic_year_start   (derived from academic_year)
├── semester_sort         (1=Ganjil, 2=Genap)
├── schedule_day          (→ schedules.day)
├── schedule_start_time   (→ schedules.start_time)
└── schedule_end_time     (→ schedules.end_time)
```

**Why**: Conflict queries need to `GROUP BY` resource + time slot. Without denormalization, every aggregation would require JOINing `schedules` (2.7M times). With it, MariaDB performs **index-only scans** on covering indexes.

#### 3.3.1 Why Denormalization Is Required

The conflict audit workload is very different from normal CRUD screens. CRUD screens typically load one page of rows and can afford a small number of joins. Conflict detection, however, asks questions over millions of rows:

- “Which rooms have two or more different courses at the same academic year, semester, day, and time?”
- “Which students are enrolled in overlapping classes?”
- “Which lecturers are assigned to overlapping teaching slots?”

The normalized schema stores those facts across multiple tables:

- `enrollments.student_id`, `course_id`, `class_room_id`, `schedule_id`
- `courses.lecturer_id`
- `schedules.day`, `start_time`, `end_time`
- display names in `students`, `courses`, `lecturers`, `class_rooms`

If conflict scans used the fully normalized model directly, every scan would need to join `enrollments → schedules → courses` before it could group by time/resource. At stress scale this forces the optimizer to repeatedly fetch rows from large tables, materialize intermediate results, and perform grouping over values that are not co-located in one index.

Watum therefore uses **read-optimized denormalization** for the conflict path. The normalized foreign keys remain the source of truth, but `enrollments` stores immutable or derived audit values required for fast grouping. The audit columns are maintained synchronously by database triggers so application queries can treat them as ready-to-scan facts.

#### 3.3.2 Audit Surrogate Keys

Several entities have an integer `audit_sk` used only for large analytical/conflict indexes. These keys are separate from user-facing string IDs and UUIDs.

Reasons for using audit surrogate keys:

- Smaller index entries than UUID/string foreign keys
- Faster comparisons during `GROUP BY`
- Lower memory pressure in temporary aggregation structures
- Stable conflict grouping even when display fields change
- Reduced size of the three large covering conflict indexes

The important distinction is:

| Field type                  | Purpose                                                                  |
| --------------------------- | ------------------------------------------------------------------------ |
| `id`                        | Public/business identity used by UI, forms, URLs, and CRUD               |
| `audit_sk`                  | Compact internal integer key used by conflict scans and covering indexes |
| `*_audit_sk` on enrollments | Snapshot of the related entity audit key at write time                   |

`courses.lecturer_audit_sk` is also denormalized because lecturer conflicts are logically attached to the lecturer assigned to a course. Enrollment rows copy `courses.lecturer_audit_sk` so lecturer conflict scans do not need to join from enrollments into courses.

#### 3.3.3 Derived Time Columns

`academic_year`, `semester`, and `schedule_id` are human/application-friendly fields, but they are not ideal as leading parts of a large analytical index. The following derived values are persisted on `enrollments`:

| Column                | Source                                             | Reason                                              |
| --------------------- | -------------------------------------------------- | --------------------------------------------------- |
| `academic_year_start` | `CAST(SUBSTRING(academic_year, 1, 4) AS UNSIGNED)` | Numeric sort/filter key for values like `2025/2026` |
| `semester_sort`       | `GANJIL → 1`, `GENAP → 2`                          | Compact numeric semester ordering                   |
| `schedule_day`        | `schedules.day`                                    | Avoids joining `schedules` for conflict grouping    |
| `schedule_start_time` | `schedules.start_time`                             | Enables time grouping directly from `enrollments`   |
| `schedule_end_time`   | `schedules.end_time`                               | Enables time grouping directly from `enrollments`   |

These fields let the conflict engine group rows directly by `(resource_audit_sk, academic_year_start, semester_sort, schedule_day, schedule_start_time, schedule_end_time)`.

#### 3.3.4 Source of Truth and Drift Handling

The normalized foreign keys remain authoritative:

- `enrollments.student_id`
- `enrollments.course_id`
- `enrollments.class_room_id`
- `enrollments.schedule_id`
- `courses.lecturer_id`
- `schedules.day/start_time/end_time`

The denormalized columns are derived cache columns. They must never be edited directly by application code during normal writes. All normal create/update paths write the normalized fields, then triggers populate derived fields.

If triggers are disabled or changed incorrectly, drift can happen. The most important drift case is `enrollments.lecturer_audit_sk` becoming different from `courses.lecturer_audit_sk`. That causes false lecturer conflicts or missed lecturer conflicts. The operational repair query is:

```sql
UPDATE enrollments e
JOIN courses c ON c.id = e.course_id
SET e.lecturer_audit_sk = c.lecturer_audit_sk
WHERE e.lecturer_audit_sk <> c.lecturer_audit_sk;
```

After mass correcting millions of rows, rebuild or optimize affected indexes if query plans/latency regress, because large updates can fragment the covering indexes.

### 3.4 Covering Conflict Indexes

Three covering indexes support the conflict audit system:

```sql
-- Room conflicts
idx_enrollments_room_conflict
(class_room_audit_sk, academic_year_start, semester_sort,
 schedule_day, schedule_start_time, schedule_end_time,
 course_id, audit_sk, schedule_audit_sk)

-- Student conflicts
idx_enrollments_student_conflict
(student_audit_sk, academic_year_start, semester_sort,
 schedule_day, schedule_start_time, schedule_end_time,
 course_id, audit_sk, schedule_audit_sk)

-- Lecturer conflicts
idx_enrollments_lecturer_conflict
(lecturer_audit_sk, academic_year_start, semester_sort,
 schedule_day, schedule_start_time, schedule_end_time,
 course_id, audit_sk, schedule_audit_sk)
```

Each is ~266 MB and allows the conflict scanner to run in **~250ms** for a full scan.

#### 3.4.1 Covering Index Design

The conflict indexes are intentionally wide. They are not generic “foreign key indexes”; they are specialized read models for one query family. The column order is deliberate:

1. **Resource key first**: `class_room_audit_sk`, `student_audit_sk`, or `lecturer_audit_sk`
2. **Academic partition keys**: `academic_year_start`, `semester_sort`
3. **Time keys**: `schedule_day`, `schedule_start_time`, `schedule_end_time`
4. **Distinctness/display support**: `course_id`, `audit_sk`, `schedule_audit_sk`

This order supports the main conflict grouping pattern:

```sql
SELECT
  <resource_audit_sk>,
  academic_year_start,
  semester_sort,
  schedule_day,
  schedule_start_time,
  schedule_end_time,
  COUNT(*) AS enrollment_count
FROM enrollments FORCE INDEX (idx_enrollments_<resource>_conflict)
WHERE <optional filters>
GROUP BY
  <resource_audit_sk>,
  academic_year_start,
  semester_sort,
  schedule_day,
  schedule_start_time,
  schedule_end_time
HAVING MIN(course_id) != MAX(course_id);  -- student/lecturer: distinct courses
-- or HAVING COUNT(*) > 1;                -- room: any double-booking
```

The scan can be index-only because all columns required for filtering, grouping, and conflict seed construction are inside the secondary index. MariaDB does not need to repeatedly visit the clustered primary row for each enrollment.

#### 3.4.2 Why `course_id`, `audit_sk`, and `schedule_audit_sk` Are Included

These trailing columns make the index larger, but they remove expensive follow-up lookups during seed collection:

- `course_id` supports `COUNT(DISTINCT course_id)`, preventing multiple students in the same course from being incorrectly treated as a conflict by themselves.
- `audit_sk` gives each enrollment a compact unique identifier inside the index.
- `schedule_audit_sk` lets the audit engine relate conflict seeds back to schedule identity without immediately joining `schedules`.

Earlier versions of the conflict indexes omitted some trailing columns. That made the indexes smaller, but the engine had to visit table rows or perform additional lookups, which was slower at 2.7M+ enrollment rows.

#### 3.4.3 Trade-Offs

The denormalized covering indexes intentionally trade write cost and storage for read speed:

| Cost                                   | Benefit                                                           |
| -------------------------------------- | ----------------------------------------------------------------- |
| Larger `enrollments` table             | Conflict scan avoids joins                                        |
| Three large secondary indexes          | Room/student/lecturer conflict scans each get optimal leading key |
| Slower writes when audited keys change | Dashboard and scheduler conflict checks stay fast                 |
| Trigger complexity                     | Application code stays simpler and consistent                     |

This trade-off is appropriate because conflict reads are frequent and user-facing, while audited-key changes are rare. Student/course/room/schedule assignments are updated by admins, but users continuously view schedules, dashboards, and conflict warnings.

### 3.5 Triggers

Five triggers maintain denormalized data:

| Trigger                     | Table       | Event         | Purpose                                                             |
| --------------------------- | ----------- | ------------- | ------------------------------------------------------------------- |
| `courses_bi_audit_keys`     | courses     | BEFORE INSERT | Set `lecturer_audit_sk` from lecturers table                        |
| `courses_bu_audit_keys`     | courses     | BEFORE UPDATE | Conditionally update `lecturer_audit_sk` when `lecturer_id` changes |
| `courses_au_audit_keys`     | courses     | AFTER UPDATE  | Cascade `lecturer_audit_sk` to enrollments when it changes          |
| `enrollments_bi_audit_keys` | enrollments | BEFORE INSERT | Populate all 9 denormalized columns                                 |
| `enrollments_bu_audit_keys` | enrollments | BEFORE UPDATE | Conditionally update denormalized columns only when FKs change      |

**Trigger optimization history**:

- Original: Unconditional `SELECT` subqueries on every enrollment update (~8 queries × 69k rows = 552k queries per course lecturer change)
- Optimized: `IF NOT (OLD.x <=> NEW.x)` guards skip subqueries when FKs haven't changed
- `courses_au_audit_keys`: Uses `WHERE lecturer_audit_sk <> NEW.lecturer_audit_sk` to skip already-correct rows

#### 3.5.1 Trigger Responsibilities

Triggers maintain the invariant that every enrollment row has conflict-ready audit columns. Application code should not try to duplicate this logic.

The trigger responsibilities are split by table:

| Trigger                     | Responsibility                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `courses_bi_audit_keys`     | On course insert, copy the lecturer's `audit_sk` into `courses.lecturer_audit_sk`                                |
| `courses_bu_audit_keys`     | On course update, refresh `courses.lecturer_audit_sk` only if `lecturer_id` changed                              |
| `courses_au_audit_keys`     | After a course lecturer audit key changes, cascade the new `lecturer_audit_sk` to affected enrollments           |
| `enrollments_bi_audit_keys` | On enrollment insert, populate student/course/lecturer/classroom/schedule audit keys and derived schedule fields |
| `enrollments_bu_audit_keys` | On enrollment update, update only the audit/derived fields whose source foreign key or source value changed      |

The important rule is **source-column conditionality**. Updating an enrollment's grade-related or unrelated fields should not execute subqueries against students, courses, classrooms, and schedules. Only changes to `student_id`, `course_id`, `class_room_id`, `schedule_id`, `academic_year`, or `semester` should recalculate matching denormalized columns.

#### 3.5.2 Null-Safe Change Checks

Triggers use MySQL/MariaDB's null-safe equality operator `<=>`:

```sql
IF NOT (OLD.course_id <=> NEW.course_id) THEN
  -- recompute course_audit_sk and lecturer_audit_sk
END IF;
```

`<=>` is used instead of `=` because `NULL = NULL` is not true in SQL. Although most core foreign keys are expected to be non-null in valid application writes, null-safe checks make migrations, partial test rows, and repair operations safer.

#### 3.5.3 Optimized Enrollment Update Trigger

The optimized `enrollments_bu_audit_keys` trigger avoids the original O(number of columns × number of touched rows) behavior. Conceptually it behaves like this:

```sql
IF NOT (OLD.student_id <=> NEW.student_id) THEN
  SET NEW.student_audit_sk = (
    SELECT s.audit_sk FROM students s WHERE s.id = NEW.student_id LIMIT 1
  );
END IF;

IF NOT (OLD.course_id <=> NEW.course_id) THEN
  SET NEW.course_audit_sk = (
    SELECT c.audit_sk FROM courses c WHERE c.id = NEW.course_id LIMIT 1
  );
  SET NEW.lecturer_audit_sk = (
    SELECT c.lecturer_audit_sk FROM courses c WHERE c.id = NEW.course_id LIMIT 1
  );
END IF;

IF NOT (OLD.schedule_id <=> NEW.schedule_id) THEN
  SET NEW.schedule_audit_sk = (...);
  SET NEW.schedule_day = (...);
  SET NEW.schedule_start_time = (...);
  SET NEW.schedule_end_time = (...);
END IF;
```

This matters most when a bulk operation touches many enrollment rows but does not change their scheduling foreign keys. The old trigger performed all lookup subqueries for every row. The optimized trigger performs zero lookup subqueries for unchanged dependencies.

#### 3.5.4 Course Lecturer Cascade Trigger

When a course changes lecturer, existing enrollments for that course must inherit the new lecturer audit key. Otherwise lecturer conflict detection uses stale data.

The optimized cascade trigger uses two guards:

```sql
IF NOT (OLD.lecturer_audit_sk <=> NEW.lecturer_audit_sk) THEN
  UPDATE enrollments
  SET lecturer_audit_sk = NEW.lecturer_audit_sk,
      course_audit_sk = NEW.audit_sk
  WHERE course_id = NEW.id
    AND lecturer_audit_sk <> NEW.lecturer_audit_sk;
END IF;
```

The outer `IF` prevents any enrollment update when the lecturer audit key did not change. The `WHERE lecturer_audit_sk <> NEW.lecturer_audit_sk` predicate prevents rewriting rows that are already correct.

This is critical because changing a lecturer for a heavily enrolled course can touch more than 100k enrollment rows. Every rewritten enrollment row also updates the three conflict indexes. Skipping already-correct rows directly reduces redo log writes, index maintenance, lock duration, and replication/binlog volume.

#### 3.5.5 Why the Cascade Is in the Database

The cascade was briefly moved toward application-level handling, but that creates a consistency risk: any SQL client, seed script, migration, or admin repair that updates `courses.lecturer_id` must remember to update enrollments too.

Keeping the cascade in a database trigger guarantees consistency regardless of the writer:

- SvelteKit remote form
- seed script
- benchmark script
- migration
- manual SQL maintenance
- future import job

The application may still avoid changing course lecturers unnecessarily for performance reasons, but the database remains the final consistency boundary.

#### 3.5.6 Operational Trigger Configuration

Operational expectations:

- Do not disable these triggers during normal writes.
- If bulk loading data with triggers disabled, run a post-load synchronization query for all audit columns before enabling user traffic.
- If changing trigger definitions, run a sample consistency check before and after deployment.
- If mass-updating `courses.lecturer_id`, expect write amplification from `enrollments` plus all secondary indexes.
- Run trigger migrations in a controlled window because `DROP TRIGGER`/`CREATE TRIGGER` changes write behavior immediately.

Useful consistency checks:

```sql
-- Lecturer audit drift
SELECT COUNT(*) AS mismatched_lecturer_keys
FROM enrollments e
JOIN courses c ON c.id = e.course_id
WHERE e.lecturer_audit_sk <> c.lecturer_audit_sk;

-- Schedule denormalization drift
SELECT COUNT(*) AS mismatched_schedule_fields
FROM enrollments e
JOIN schedules s ON s.id = e.schedule_id
WHERE e.schedule_day <> s.day
   OR e.schedule_start_time <> s.start_time
   OR e.schedule_end_time <> s.end_time;
```

### 3.6 Migrations

22 migration files in `src/lib/server/migrations/`:

| File                                            | Purpose                                                  |
| ----------------------------------------------- | -------------------------------------------------------- |
| `001_schema.sql`                                | Base schema + indexes                                    |
| `002_refresh_tokens.sql`                        | Session management                                       |
| `003-003`                                       | Refresh token indexes                                    |
| `004-009`                                       | Schedule overlap + large dataset indexes                 |
| `010-011`                                       | Conflict audit integer keys                              |
| `012`                                           | **Denormalized schedule columns + covering indexes**     |
| `013-016`                                       | Index cleanup + fulltext search                          |
| `017`                                           | Time column optimizations                                |
| `018_optimize_triggers.sql`                     | Conditional trigger guards                               |
| `019_drop_courses_au_trigger.sql`               | Dropped cascade trigger (later restored)                 |
| `020_recreate_courses_au_trigger.sql`           | Restored trigger with optimized query                    |
| `021_grades_constraints.sql`                    | Grade score CHECK constraints + total_score auto trigger |
| `022_enrollment_course_lecturer_index.sql`      | Composite index for lecturer cascade trigger performance |

---

## 4. Application Architecture

### 4.1 SvelteKit Remote Functions

Watum uses SvelteKit's **remote functions** (`$app/server`) instead of traditional REST APIs. Remote functions are defined in `data.remote.ts` files and auto-generated into client-callable proxies.

Three function types:

```typescript
// Query — reactive, cached, batched
export const getCourses = query(listPageSchema, async (page) => { ... });

// Form — handles validation, issues, optimistic updates
export const updateCourse = form(courseSchema, async (data) => { ... });

// Command — one-shot action, no caching
export const deleteCourse = command(v.string(), async (id) => { ... });
```

**Client usage**:

```svelte
<script>
	import { getCourses, updateCourse } from './courses/data.remote';

	// Reactive query — auto-fetches and caches
	const courses = getCourses();

	// Form — handles submit, validation, pending state
	const form = updateCourse;
</script>

<!-- Query reactive access -->
{#each courses.current?.items ?? [] as course}
	<p>{course.name}</p>
{/each}

<!-- Form usage -->
<form use:form.enhance>
	<input {...form.fields.name.as('text')} />
	<button type="submit" disabled={form.pending}>Save</button>
</form>
```

**Serialization**: Uses `devalue` for structured clone serialization (handles Dates, Maps, Sets, etc.).

### 4.2 Auth Flow

```
1. Login → POST /auth/login
   - Verifies password with Argon2
   - Creates refresh token (SHA-256 hashed in DB, cookie sent to client)
   - Returns access token (JWT, 5-minute expiry)

2. API Calls → All /_app/remote/* requests
   - Client attaches access token via `Authorization: Bearer <token>`
   - Server verifies JWT with jose

3. Token Refresh → Automatic on 401
   - Client calls /auth/refresh with cookie
   - Server verifies refresh token hash against DB
   - Issues new access token + rotates refresh token
   - Retries original request

4. Logout → POST /auth/logout
   - Deletes refresh token from DB
   - Clears cookies
```

**Password security**:

- Argon2id (m=65536, t=3, p=4)
- Password version claim in JWT — if admin resets password, old tokens invalidate

### 4.3 Single-Page Dashboard Architecture

The entire application is a **single page** (`src/routes/+page.svelte`, ~11700 lines) with view switching:

```
+page.svelte
├── Ringkasan (Dashboard)
│   ├── Admin totals (rooms, students, lecturers, users)
│   ├── Classroom utilization summary
│   └── Weekly room utilization list (paginated)
├── Kalender Mingguan (Weekly Calendar)
├── Pengelolaan (Management)
│   ├── Students, Lecturers, Faculties, Study Programs
│   ├── Courses, Classrooms
│   └── Users
├── Penjadwalan (Scheduling)
│   ├── Schedule builder with conflict audit
│   └── Enrollment form with conflict preview
├── Perkuliahan (Lectures)
├── KRS (Enrollments)
├── Nilai (Grades)
└── Akun (Account)
```

**State management**: Uses Svelte 5 runes (`$state`, `$derived`) locally within the page component. No external state library.

### 4.4 Role-Scoped View Access

Views are scoped by user role at three layers:

1. **Navigation**: `navigationForRole()` returns only views appropriate for the role. Sidebar groups are filtered by `navigationGroupsForRole()`.
2. **Activation guard**: `activateView()` returns early if the target view is not in `allowedViews` (a `$derived` reactive value). This prevents programmatic navigation to disallowed views.
3. **Template guards**: Each view section in the template checks the role conditionally:
   - `students`, `builder`, `faculties`, `studyPrograms`: `role !== 'STUDENT'`
   - `users`: `role === 'ADMIN'`
   - An `$effect` corrects `activeView` if the URL restores a disallowed view after user loads.

Role access matrix:

| Role       | Views                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------- |
| `ADMIN`    | All 12 views (dashboard, calendar, builder, classrooms, courses, students, lecturers, faculties, studyPrograms, enrollments, grades, users) |
| `LECTURER` | All except `users`; read-only on students, faculties, studyPrograms                                 |
| `STUDENT`  | dashboard, calendar, classrooms, courses, lecturers, enrollments, grades                            |

### 4.5 Non-Blocking UI Refreshes

Form submissions use **optimistic UI updates** followed by fire-and-forget background refreshes. The enhance handler returns immediately after `submit()` resolves, closing the editor and showing success feedback. Collection refreshes (`refreshDependencies`) run in the background via `void` (unawaited). This keeps the loading spinner from blocking the UI while data reloads over the network.

### 4.4 Global Loading Spinner

A `fetch` interceptor tracks all remote requests:

```typescript
// src/lib/client/loading.svelte.ts
installLoadingInterceptor(); // In +layout.svelte

// Intercepts window.fetch for /_app/remote/* and /auth/*
// Increments counter on request start, decrements on completion
// GlobalSpinner.svelte shows overlay when counter > 0
```

---

## 5. Authentication & Authorization

### 5.1 Roles

| Role       | Permissions                                                        |
| ---------- | ------------------------------------------------------------------ |
| `ADMIN`    | Full CRUD on all entities, view all dashboards                     |
| `LECTURER` | View own courses, students, schedule; input grades for own courses |
| `STUDENT`  | View own schedule, grades, enrollments                             |

### 5.2 Row-Level Filtering

Lecturers and students can only see their own data. The backend applies filters automatically:

```typescript
// For lecturers: filter by courses they teach
const [courseRows] = await getPool().query('SELECT id FROM courses WHERE lecturer_id = ?', [
	currentUser.lecturerId
]);

// For students: filter by own enrollments
// Applied in WHERE clauses across getEnrollments, getGrades, etc.
```

### 5.3 Route Guards

Server-side role checking via `requireRole(['ADMIN'])` in remote functions. Returns 403 if unauthorized.

---

## 6. Conflict Audit System

### 6.1 What It Detects

Watum has two related conflict-detection layers:

| Layer                                     | Location                                                            | Purpose                                                                     | Scope                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Server conflict audit**                 | `src/lib/server/conflict-audit.ts` via `getEnrollmentConflictAudit` | Authoritative scalable audit over persisted enrollments                     | Millions of rows, backed by denormalized columns and covering indexes |
| **Client schedule-card conflict marking** | `buildScheduleCards()` in `src/lib/app/academic.ts`                 | Visual conflict highlighting for the currently loaded calendar/builder data | Only rows currently loaded into the page                              |

The server audit is the primary system for large-scale correctness. The client layer is used to make visible schedule cards immediately understandable and to connect currently loaded cards into visual conflict groups.

Three resource conflict types are tracked:

| Type         | Condition                                                                             |
| ------------ | ------------------------------------------------------------------------------------- |
| **Room**     | More than one distinct course uses the same room in the same schedule window          |
| **Student**  | One student is enrolled in more than one distinct course in the same schedule window  |
| **Lecturer** | One lecturer is assigned to more than one distinct course in the same schedule window |

The server audit groups by the denormalized schedule window stored on `enrollments`: `academic_year_start`, `semester_sort`, `schedule_day`, `schedule_start_time`, and `schedule_end_time`. The client visual layer additionally checks interval overlap among loaded schedule cards using `startMinutes < existingEnd` logic, which is useful for screen-level highlighting when visible records have overlapping but non-identical time ranges.

### 6.2 Data Model Used by Conflict Detection

Conflict detection intentionally reads from the `enrollments` table instead of joining every normalized table during the scan. Each enrollment row carries conflict-ready fields maintained by triggers:

| Field                                       | Used for                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| `student_audit_sk`                          | Student conflict grouping                                                       |
| `class_room_audit_sk`                       | Room conflict grouping                                                          |
| `lecturer_audit_sk`                         | Lecturer conflict grouping, copied from the course's current lecturer audit key |
| `course_audit_sk`                           | Course filtering and denormalized consistency                                   |
| `schedule_audit_sk`                         | Schedule identity for hydrated display rows                                     |
| `academic_year_start`                       | Numeric academic-year filtering and grouping                                    |
| `semester_sort`                             | Compact semester filtering and grouping                                         |
| `schedule_day`                              | Day grouping without joining `schedules`                                        |
| `schedule_start_time` / `schedule_end_time` | Schedule-window grouping without joining `schedules`                            |

This design turns conflict detection into an index scan over one table. Display names are fetched later only for the limited set of conflict groups that need rendering.

### 6.3 Server Conflict Audit Pipeline

The server audit entry point is:

```typescript
export async function auditEnrollmentConflicts(pool: Pool, filters: ConflictAuditFilters = {});
```

The SvelteKit remote query wrapper is:

```typescript
export const getEnrollmentConflictAudit = query(conflictAuditSchema, async (filters) => {
	const user = await requireRole(['ADMIN', 'LECTURER']);
	return auditEnrollmentConflicts(getPool(), { ...filters, lecturerId: scopedLecturerId });
});
```

The pipeline has six phases.

#### 6.3.1 Filter Normalization

The remote query accepts:

| Filter             | Purpose                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `conflictType`     | Run only room, student, or lecturer audit instead of all three                                |
| `academicYear`     | Limit to an academic year such as `2025/2026`                                                 |
| `semester`         | Limit to `GANJIL` or `GENAP`                                                                  |
| `day`              | Limit to a schedule day                                                                       |
| `courseId`         | Limit to conflicts involving one course audit key                                             |
| `classRoomId`      | Limit to conflicts involving one classroom audit key                                          |
| `lecturerId`       | Admin-only lecturer filter; lecturer users are automatically scoped to their own `lecturerId` |
| `enrollmentIds`    | Focus mode; return only groups connected to specific enrollment IDs                           |
| `limitGroups`      | Cap number of hydrated groups returned to the UI                                              |
| `memberSampleSize` | Cap number of hydrated members per group, max 40                                              |

The server converts user-facing filters to audit-key predicates where possible. Example:

```sql
e.class_room_audit_sk = (SELECT audit_sk FROM class_rooms WHERE id = ? LIMIT 1)
```

Academic year and semester are matched against denormalized numeric columns:

```sql
e.academic_year_start = CAST(SUBSTRING(?, 1, 4) AS UNSIGNED)
e.semester_sort = CASE
  WHEN UPPER(?) LIKE 'GAN%' THEN 1
  WHEN UPPER(?) LIKE 'GEN%' THEN 2
  ELSE 9
END
```

#### 6.3.2 Seed Collection

`collectConflictGroupSeeds()` performs the heavy scan. It runs once per selected conflict type: room, student, lecturer, or all three **in parallel** (each query hits a different covering index, so they don't contend for the same index pages).

The core query shape is:

```sql
SELECT
  <resource_audit_sk> AS resource_id,
  e.academic_year_start,
  e.semester_sort,
  e.schedule_day AS day,
  e.schedule_start_time AS start_time,
  e.schedule_end_time AS end_time,
  COUNT(*) AS member_count
FROM enrollments e FORCE INDEX (idx_enrollments_<resource>_conflict)
WHERE <filters>
GROUP BY
  <resource_audit_sk>,
  e.academic_year_start,
  e.semester_sort,
  e.schedule_day,
  e.schedule_start_time,
  e.schedule_end_time
HAVING MIN(e.course_id) != MAX(e.course_id);  -- for student/lecturer
-- or HAVING COUNT(*) > 1;                     -- for room
```

The result is a list of compact conflict seeds. A seed contains only:

- conflict type
- resource audit key
- academic year start
- semester sort
- day
- start/end time
- member count

It does not yet contain names or full enrollment rows. This keeps the expensive first phase index-only and avoids joining millions of rows just to discover which groups exist.

#### 6.3.3 HAVING Predicate (Per-Type)

The `HAVING` predicate differs by conflict type because the semantics of "double-booking" depend on the resource:

| Conflict type | HAVING predicate                        | Rationale                                                                                                            |
| ------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Room          | `COUNT(*) > 1`                          | Any room double-booking is a real conflict — even two sections of the same course consuming the same physical space  |
| Student       | `MIN(course_id) != MAX(course_id)`      | A student enrolled twice in the same course at the same slot is data corruption, not a real conflict                 |
| Lecturer      | `MIN(course_id) != MAX(course_id)`      | A lecturer teaching one course with hundreds of students is normal; only multiple distinct courses indicate conflict |

Student and lecturer conflicts previously used `COUNT(DISTINCT course_id) > 1`, which builds a hash table to track distinct values per group. The `MIN/MAX` approach avoids this overhead — for non-NULL values it is semantically equivalent but significantly faster on large groups because it only tracks two values instead of all distinct values.

Without this split, lecturer audit would report thousands of false-positive "conflicts" per lecturer, because each course has hundreds of student enrollments, and `COUNT(*) > 1` would trigger for every populated time slot.

Examples:

| Scenario                                                       | Room | Student | Lecturer | Reason                                              |
| -------------------------------------------------------------- | ---- | ------- | -------- | --------------------------------------------------- |
| 40 students in one course in room A at 08:00                   | No¹  | No      | No       | Single course; not a conflict for any resource      |
| Course A and Course B both use room A at 08:00                 | Yes  | —       | —        | Two distinct courses competing for one room         |
| Student S enrolled in Course A and Course B at 08:00           | —    | Yes     | —        | Same student has two distinct courses in same slot  |
| Lecturer L teaches Course A and Course B at 08:00 in two rooms | —    | —       | Yes      | Same lecturer has two distinct teaching assignments |

¹ Room would only flag if the same room has 2+ separate enrollment rows pointing to the same time slot, which would mean two schedule rows competing for one room.

#### 6.3.4 Parallel Audit Execution

The three conflict-type seed queries run **in parallel** using `Promise.all`:

```typescript
const seedResults = await Promise.all(
	selectedTypes.map(async (type) => ({
		type,
		seeds: await collectConflictGroupSeeds(pool, type, filters)
	}))
);
```

Each query hits a different covering index (room, student, lecturer), so they don't contend for the same index pages. On a well-provisioned database this is ~3× faster than sequential execution. Earlier versions ran sequentially to avoid overwhelming a resource-constrained database, but the covering-index separation makes parallel safe on standard deployments.

#### 6.3.5 Audit Filter Scoping

The client `buildConflictAuditFilters()` always sends scope filters to limit the audit's working set:

```typescript
function buildConflictAuditFilters() {
	return {
		academicYear: scheduleAcademicYearFilter || scheduleAcademicYearOptions[0] || undefined,
		semester: scheduleSemesterFilter || scheduleSemesterOptions[0] || undefined,
		day: scheduleDayFilter || undefined,
		courseId: scheduleCourseFilter || undefined,
		classRoomId: scheduleRoomFilter || undefined,
		lecturerId: scheduleLecturerFilter || undefined,
		limitGroups: 1000,
		memberSampleSize: 10
	};
}
```

If the user has not picked an academic year or semester, the client falls back to the first available value derived from the loaded schedule preview. This guarantees the audit always has at least one filter that the database can use to short-circuit the index scan.

Without scoping, the audit would scan the entire `enrollments` table across all academic years and semesters every time the dashboard loaded, holding millions of rows in the temporary aggregation buffer.

`memberSampleSize: 10` caps hydrated members per group at 10 rather than the default 40, which dramatically reduces hydration cost when there are many seed candidates (one lecturer with 1,728 conflict groups × 40 members = 69,120 hydrated rows; with 10 it becomes 17,280 rows; in practice `limitGroups: 1000` further bounds this).

#### 6.3.6 Index Choice and `FORCE INDEX`

Unfiltered full audits use `FORCE INDEX` because MariaDB can otherwise choose a full table scan plus temporary grouping on the 2M+ row `enrollments` table. The intended indexes are:

| Conflict type | Forced index                        |
| ------------- | ----------------------------------- |
| Room          | `idx_enrollments_room_conflict`     |
| Student       | `idx_enrollments_student_conflict`  |
| Lecturer      | `idx_enrollments_lecturer_conflict` |

There is an important exception: when extra filters are present, `FORCE INDEX` is not always used. Some filters target columns that are not present in the chosen conflict index. For those filtered queries, forcing the conflict index may cause many row lookups and can be slower than allowing the optimizer to choose another plan. The implementation checks whether extra filters exist and only forces the conflict index for the unfiltered hot path.

#### 6.3.7 Focus Filtering

Focus mode is used when the UI wants conflicts connected to specific enrollment IDs. The filter is named `focusEnrollmentIds` internally and `enrollmentIds` at the remote boundary.

The algorithm:

1. Build all conflict seeds for the requested filters.
2. Load the audit keys/time windows for focused enrollment IDs in batches of 1000.
3. Convert each focused enrollment into possible seed keys for room, student, and lecturer conflicts.
4. Keep only seeds whose conflict key matches one of those focused keys.

This is faster than hydrating every conflict group and then filtering in application memory.

#### 6.3.8 Member Hydration

After the seed list is selected and optionally focused/limited, `loadMemberRowsForSeeds()` fetches display-ready members for those groups.

Hydration joins only the selected groups:

```sql
SELECT
  e.id AS enrollment_id,
  e.schedule_id,
  e.student_id,
  s.name AS student_name,
  e.course_id,
  c.name AS course_name,
  c.lecturer_id,
  l.name AS lecturer_name,
  e.class_room_id,
  cr.name AS class_room_name,
  e.semester,
  e.academic_year,
  e.schedule_day AS day,
  e.schedule_start_time AS start_time,
  e.schedule_end_time AS end_time
FROM enrollments e FORCE INDEX (idx_enrollments_<resource>_conflict)
INNER JOIN students s ON e.student_id = s.id
INNER JOIN courses c ON e.course_id = c.id
INNER JOIN lecturers l ON c.lecturer_id = l.id
INNER JOIN class_rooms cr ON e.class_room_id = cr.id
WHERE <seed key predicate>;
```

Hydration is batched in groups of 80 seeds. Each seed's member query is unioned with `UNION ALL`, which keeps round trips bounded while avoiding a single enormous dynamic query.

#### 6.3.9 Member Sampling

The audit summary counts all conflicted rows in matching seeds, but the UI does not need thousands of member rows per group. The member list is capped:

- client-requested hydrated member sample: **10 members per group** (set via `buildConflictAuditFilters` as `memberSampleSize: 10`)
- hard maximum: 40 members per group
- focused enrollment IDs are always prioritized in the sample

The reduced sample size (down from the previous default of 40) was necessary because some lecturer conflict groups have 1,500+ members per group. Even 40 members × 1,000 groups = 40,000 hydrated rows × 4-table UNION ALL batches overwhelmed the database. With 10 members × 1,000 groups = 10,000 rows, the hydration cost drops by 75%.

This preserves accurate counts while keeping remote payloads and UI rendering small.

#### 6.3.10 Group Hydration and Sorting

`hydrateConflictGroupSeeds()` converts low-level rows into `ConflictAuditGroup` objects:

```typescript
type ConflictAuditGroup = {
	conflictType: 'room' | 'student' | 'lecturer';
	resourceId: string;
	resourceName: string;
	day: Day;
	memberCount: number;
	members: ConflictAuditMember[];
};
```

Members are sorted by start time using `timeToSeconds()`, which handles MariaDB `TIME` strings such as `13:00:00.000`.

Group ordering is deterministic:

1. Higher `memberCount` first
2. Then by `conflictType:resourceId`

This makes dashboard and builder output stable between refreshes.

#### 6.3.11 Summary Construction

The audit result includes both groups and aggregate counts:

```typescript
type ConflictAuditResult = {
	filters: {
		academicYear: string | null;
		semester: string | null;
		lecturerScope: string | null;
	};
	summary: {
		totalGroups: number;
		roomGroups: number;
		studentGroups: number;
		lecturerGroups: number;
		conflictedEnrollments: number;
		/** Distinct rooms involved in at least one conflict (not the count of conflict instances). */
		conflictedRooms: number;
		/** Distinct students involved in at least one conflict. */
		conflictedStudents: number;
		/** Distinct lecturers involved in at least one conflict. */
		conflictedLecturers: number;
	};
	truncated: boolean;
	groups: ConflictAuditGroup[];
};
```

The distinct-resource counts are computed from the full seed list **before** truncation, so they remain accurate even when the hydrated `groups` array is capped by `limitGroups`. The dashboard's "ruang bentrok" metric uses `conflictedRooms` (rooms in conflict) rather than `roomGroups` (instances of conflict), which is what users actually want to see.

`truncated` is true when more groups matched than were hydrated due to `limitGroups`.

### 6.4 Client-Side Visual Conflict Marking

`buildScheduleCards()` creates schedule cards for the currently loaded enrollments. This is separate from the server audit.

The client algorithm:

1. Convert each loaded enrollment into a `ScheduleCard` with day, start/end labels, resource IDs, and minute offsets.
2. For each day, bucket card indexes by room, student, and lecturer resource keys.
3. Sort each resource bucket by start time.
4. Use interval overlap logic to connect cards whose time ranges overlap.
5. Use union-find to merge overlapping chains into conflict components.
6. Mark cards in conflict components with `hasConflict`, `conflictGroupId`, and `conflictTone`.

The overlap condition is:

```typescript
currentCard.startMinutes < componentEnd;
```

This means the client can visually mark intervals like `08:00-10:00` and `09:00-11:00` as overlapping among loaded rows.

The client layer is intentionally bounded by the loaded dataset. If the current calendar page is filtered or truncated, it cannot know about rows that were not loaded. That is why the server audit remains the authoritative full-data conflict detector.

### 6.5 UI Integration

Conflict audit data is consumed in multiple places:

| UI area          | How conflicts are used                                                         |
| ---------------- | ------------------------------------------------------------------------------ |
| Dashboard        | Shows conflict summary and primary conflict warning                            |
| Weekly calendar  | Highlights schedule cards and exposes peer conflict details                    |
| Schedule builder | Shows selected enrollment conflict copy and an expandable conflict-group panel |
| Enrollment list  | Marks conflicting rows and shows a compact conflict summary                    |

The page maps server audit groups to visual cards using helper functions in `src/routes/+page.svelte`:

- `scheduleCardFromConflictMember()` converts hydrated audit members into card-like display objects.
- `auditConflictGroups` maps server groups into UI-friendly groups.
- `auditConflictCardMap` allows lookup by enrollment ID.
- `conflictPeersByCardId` provides peer cards for calendar/builder conflict details.
- `conflictSummaryByCardId` builds concise row-level text such as “Bentrok dengan ...”.

The builder conflict panel is collapsed by default so many conflict groups do not push the schedule form below the fold.

### 6.6 Caching and Invalidation

Conflict audits are cached in memory inside `src/lib/server/conflict-audit.ts`.

| Mechanism                  | Behavior                                                |
| -------------------------- | ------------------------------------------------------- |
| `auditCache`               | Stores completed audit results by normalized filter key |
| `AUDIT_CACHE_TTL_MS`       | 300 seconds (5 minutes)                                 |
| `AUDIT_CACHE_MAX_SIZE`     | 200 entries (LRU eviction by insertion order)           |
| `auditCacheInsertionOrder` | Tracks insertion order for LRU eviction                 |
| `inFlightAudits`           | Deduplicates concurrent requests for the same cache key |
| `auditCacheVersion`        | Invalidates all old cache entries after mutations       |

The cache key includes conflict type, academic year, semester, lecturer, course, room, day, focus enrollment IDs, group limit, and member sample size. Focus IDs are sorted before building the cache key so equivalent requests share a cache entry.

When a cached entry is older than the TTL, the function returns the cached result immediately and schedules a background refresh. This keeps the UI responsive while refreshing expensive audit data.

LRU eviction prevents unbounded cache growth: under high-cardinality filter inputs (many distinct combinations of academic year, semester, lecturer, room), the cache caps at 200 entries and evicts the oldest. Without this bound, the cache could leak memory until the next mutation triggered `invalidateConflictAuditCache()`.

`invalidateConflictAuditCache()` clears both the cache map and the insertion-order tracker, then increments the cache version. It is called after mutations that can affect conflicts, including enrollment writes, course lecturer changes, classroom changes, student changes, and lecturer changes.

### 6.7 Authorization and Role Scoping

Only `ADMIN` and `LECTURER` can call `getEnrollmentConflictAudit`.

Role behavior:

| Role       | Behavior                                                                              |
| ---------- | ------------------------------------------------------------------------------------- |
| `ADMIN`    | Can audit all data and pass `lecturerId` filters                                      |
| `LECTURER` | Automatically scoped to their own `lecturerId`; supplied lecturer filters are ignored |
| `STUDENT`  | Cannot call the audit endpoint                                                        |

The lecturer scope is included in the returned filter metadata as `lecturerScope` so the UI can reason about scoped results.

### 6.8 Performance Characteristics

The conflict engine is fast because it separates discovery from hydration:

| Phase            | Data volume                                     | Query style                                            |
| ---------------- | ----------------------------------------------- | ------------------------------------------------------ |
| Seed collection  | Millions of enrollment rows (scoped by filters) | Parallel index-only aggregation per conflict type      |
| Focus filtering  | Only focus enrollment IDs                       | Batched primary lookups                                |
| Member hydration | Only selected conflict seeds (max 1000 groups)  | Bounded batched UNION ALL joins (max 10 members/group) |
| UI rendering     | Only hydrated groups and loaded schedule cards  | Local maps/sets and derived state                      |

Seed collection runs in parallel: each conflict type query hits a different covering index, so they don't contend for the same index pages. On a well-provisioned database this is ~3× faster than the earlier sequential approach.

Expected stress-data performance:

| Dataset Size         | Full Scan Time      |
| -------------------- | ------------------- |
| 2.7M enrollments     | ~250ms (index-only) |
| Filtered by lecturer | ~240ms              |
| Filtered by room     | ~200ms              |

Actual latency depends on cache state, filter selectivity, buffer pool warmth, concurrent writes, and whether the query plan remains index-only.

### 6.9 Correctness Assumptions and Limitations

Important assumptions:

- Denormalized audit fields on `enrollments` are correct.
- Triggers are enabled and current.
- `courses.lecturer_audit_sk` is synchronized with `courses.lecturer_id`.
- `enrollments.lecturer_audit_sk` is synchronized with the course's lecturer audit key.
- `schedule_day`, `schedule_start_time`, and `schedule_end_time` match the referenced schedule.

Current server audit semantics:

- The server groups by **identical** denormalized schedule windows (same `start_time` + `end_time`).
- Room conflicts use `HAVING COUNT(*) > 1` — any room double-booking is flagged.
- Student/lecturer conflicts use `HAVING MIN(course_id) != MAX(course_id)` — multiple students in the same course at the same time slot is not flagged.
- The audit runs **in parallel** per conflict type, with each query hitting a different covering index.
- The audit cache TTL is 5 minutes; stale data is returned immediately while a background refresh runs.
- The client visual layer (`buildScheduleCards`) detects interval overlaps only among loaded cards using `startMinutes < componentEnd`.
- The server does NOT currently detect arbitrary interval overlaps (e.g., 08:00–10:00 vs 09:00–11:00) because that would require fetching all enrollment rows for each resource into application memory, which is too expensive at 2.7M+ rows.

### 6.10 Operational Debugging

Use these checks when conflict counts look wrong.

Check lecturer audit drift:

```sql
SELECT COUNT(*) AS mismatched_lecturer_keys
FROM enrollments e
JOIN courses c ON c.id = e.course_id
WHERE e.lecturer_audit_sk <> c.lecturer_audit_sk;
```

Check schedule denormalization drift:

```sql
SELECT COUNT(*) AS mismatched_schedule_fields
FROM enrollments e
JOIN schedules s ON s.id = e.schedule_id
WHERE e.schedule_day <> s.day
   OR e.schedule_start_time <> s.start_time
   OR e.schedule_end_time <> s.end_time;
```

Check whether a room conflict exists in raw denormalized form:

```sql
SELECT
  class_room_audit_sk,
  academic_year_start,
  semester_sort,
  schedule_day,
  schedule_start_time,
  schedule_end_time,
  COUNT(*) AS members,
  COUNT(DISTINCT course_id) AS distinct_courses
FROM enrollments FORCE INDEX (idx_enrollments_room_conflict)
GROUP BY
  class_room_audit_sk,
  academic_year_start,
  semester_sort,
  schedule_day,
  schedule_start_time,
  schedule_end_time
HAVING COUNT(*) > 1
ORDER BY members DESC
LIMIT 20;
```

Check whether a lecturer has real conflicts (distinct courses, not just many students in one course):

```sql
SELECT
  l.name AS lecturer,
  COUNT(*) AS conflict_groups,
  SUM(member_count) AS total_members
FROM (
  SELECT lecturer_audit_sk, COUNT(*) AS member_count
  FROM enrollments
  GROUP BY lecturer_audit_sk, academic_year_start, semester_sort,
    schedule_day, schedule_start_time, schedule_end_time
  HAVING MIN(course_id) != MAX(course_id)
) t
JOIN lecturers l ON l.audit_sk = t.lecturer_audit_sk
GROUP BY l.name
ORDER BY conflict_groups DESC
LIMIT 20;
```

If the raw query shows conflicts but the UI does not, inspect the remote filters, role scoping, `limitGroups`, and cache invalidation. If the UI shows conflicts but raw audit does not, the visible conflict may be from client-side interval overlap among loaded cards rather than a server audit group.

### 6.11 Intentional Conflicts (Stress Data)

The stress seed script creates deterministic intentional conflict groups to verify the scanner at scale. These groups are intentionally small and predictable so benchmark output can distinguish real regressions from random scheduling collisions.

The seed data is useful for validating:

- conflict group counts after migrations
- trigger correctness after bulk writes
- benchmark latency before and after index changes
- cache invalidation after enrollment/course/classroom mutations

---

## 7. Performance Optimizations

### 7.1 Database Optimizations

| Optimization             | Impact                                                        |
| ------------------------ | ------------------------------------------------------------- |
| **Covering indexes**     | Conflict scans are index-only, no row lookups                 |
| **Denormalized columns** | Eliminates JOINs in aggregation queries                       |
| **Conditional triggers** | Skips 552k unnecessary SELECTs per lecturer change            |
| **Keyset pagination**    | `cursor`-based pagination instead of OFFSET (avoids skipping) |
| **Fulltext indexes**     | `MATCH ... AGAINST` for name search                           |
| **Composite indexes**    | `idx_schedules_room_day_time` for room availability checks; `idx_enrollments_course_lecturer` for trigger cascade performance |

#### 7.1.1 Index Families

Watum uses different index families for different access patterns. The goal is not “index everything”; the goal is to keep the most frequent high-cardinality lookups predictable.

| Index family                  | Examples                                                                                                      | Query shape served                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Foreign-key lookup indexes    | `idx_enrollments_student`, `idx_enrollments_course`, `idx_enrollments_class_room`, `idx_enrollments_schedule` | Detail screens, joins, deletes, referential checks |
| Schedule availability indexes | `idx_schedules_room_day_time`, lecturer/day/time variants                                                     | “Is this room/lecturer busy at this day/time?”     |
| Conflict covering indexes     | `idx_enrollments_room_conflict`, `idx_enrollments_student_conflict`, `idx_enrollments_lecturer_conflict`      | Full/filtered conflict audits                      |
| Search indexes                | `FULLTEXT(name)` on major dimension tables                                                                    | Name search and picker search                      |
| Cursor pagination indexes     | Primary keys (`id`) and selected ordered keys                                                                 | Page-by-page list navigation                       |

Indexes are kept aligned with actual query shapes. For example, conflict indexes lead with the conflict resource key, while schedule availability indexes lead with the schedule resource and time dimensions.

#### 7.1.2 Index-Only Scans

The conflict scanner is designed so MariaDB can satisfy the first phase from only the secondary index. That is why trailing columns are included even if they are not selective. A smaller non-covering index can look attractive, but at millions of rows it causes repeated table lookups and worse tail latency.

`EXPLAIN` should show the intended conflict index and ideally avoid large temporary table work. If MariaDB chooses a less appropriate index, the conflict-audit SQL uses `FORCE INDEX` in critical paths to keep the optimizer from selecting a generic foreign-key index.

#### 7.1.3 Write Amplification Awareness

Every additional secondary index speeds up some reads and slows down writes. This is especially visible on `enrollments`, where one logical update may update:

- the clustered row
- normal foreign-key indexes
- room conflict covering index
- student conflict covering index
- lecturer conflict covering index

For this reason, the schema avoids adding broad “just in case” indexes to `enrollments`. New indexes should be justified by a measured query plan and a known user-facing workflow.

#### 7.1.4 Fulltext vs Prefix Search

Search endpoints use a layered strategy:

- Exact ID match first when applicable
- Prefix search (`LIKE 'term%'`) for indexed or short-name fields
- Word-prefix search (`LIKE '% term%'`) when users type a word inside a multi-word name
- Fulltext indexes where they produce better plans for name-heavy searches

The UI uses debounced remote search for large entities instead of loading all options into memory. This is especially important for classrooms and students.

#### 7.1.5 Schedule Query Indexing

Room utilization, availability checks, and conflict details rely on schedule indexes shaped around resource + day + time. The common predicate is:

```sql
WHERE class_room_id = ?
  AND day = ?
  AND start_time < ?
  AND end_time > ?
```

That is why composite indexes such as `idx_schedules_room_day_time` matter. They allow the database to narrow to a resource and day before evaluating time overlap.

### 7.2 Application Optimizations

| Optimization              | Impact                                                                   |
| ------------------------- | ------------------------------------------------------------------------ |
| **Query batching**        | SvelteKit batches identical queries in the same tick                     |
| **Conflict audit cache**  | 5-minute TTL avoids re-scanning; stale-while-revalidate     |
| **Content-visibility**    | `content-visibility: auto` on list rows                                  |
| **Enrollment lookup Map** | O(1) instead of O(n) `.find()`                                           |
| **Available rooms Set**   | O(n) instead of O(n²) room filtering                                     |
| **$derived guard**        | Removed `selected` from derived objects to prevent cascade recomputation |

### 7.3 Stress Seed Optimizations

| Optimization                | Impact                                                           |
| --------------------------- | ---------------------------------------------------------------- |
| **In-memory LOAD DATA**     | PassThrough streams instead of disk temp files                   |
| **Serialized batches**      | Single connection to avoid `ER_LOCK_WAIT_TIMEOUT`                |
| **Parallel argon2 hashing** | Hash passwords while connection initializes                      |
| **Fast formatting**         | Removed per-value string escaping (generated data is known-safe) |

### 7.4 Pagination Strategy

Pagination is a core scalability feature in Watum. Any table that can grow beyond a few hundred rows must be paginated on the server.

#### 7.4.1 Why Offset Pagination Is Avoided

Offset pagination looks simple:

```sql
SELECT ...
FROM students
ORDER BY id
LIMIT 120 OFFSET 1200000;
```

But the database still has to walk or count past the skipped rows before returning the requested page. At high offsets, latency grows with page number. This is why offset pagination is not used for primary entity lists.

#### 7.4.2 Cursor/Keyset Pagination

Most Watum lists use cursor pagination:

```sql
SELECT ...
FROM students
WHERE id > ?
ORDER BY id ASC
LIMIT ?;
```

The cursor is the last row's ordered key from the previous page. In the server helper this is exposed as:

```typescript
type LimitedListResult<T> = {
	items: T[];
	limit: number;
	hasMore: boolean;
	nextCursor: string | null;
};
```

The query fetches `limit + 1` rows. If the extra row exists, the server sets `hasMore = true` and returns the last visible row's ID as `nextCursor`.

Benefits:

- Page-switch latency stays stable even on deep pages
- No large skipped-row scans
- Works well with primary-key indexes
- Avoids expensive `COUNT(*)` for every page interaction
- Fits remote picker/search APIs naturally

#### 7.4.3 Client Cursor History

Cursor pagination does not automatically support “previous page” because the cursor only points forward. Watum solves this in the client with cursor history:

```typescript
type CollectionPaginationState = {
	currentCursor: string | null;
	nextCursor: string | null;
	history: Array<string | null>;
	pageNumber: number;
	limit: number;
	hasMore: boolean;
	loading: boolean;
	itemCount: number;
};
```

When moving forward, the current cursor is pushed into `history`. When moving backward, the last cursor is popped and reused. This gives users normal previous/next controls while keeping the database on keyset pagination.

#### 7.4.4 Entity List Pagination

Collection screens such as classrooms, courses, students, lecturers, faculties, study programs, enrollments, grades, and users use the shared `CollectionPagination` component.

The flow is:

```text
User clicks Next
→ changeCollectionPage(key, 'next')
→ requestCollectionPage(key, nextCursor)
→ remote query fetches LIMIT + 1 rows
→ applyLimitedCollection(result)
→ update CollectionPaginationState
```

For searches, the first page uses the search endpoint with `cursor = undefined`; subsequent pages reuse the returned cursor with the same search filters.

#### 7.4.5 Classroom Picker Pagination and Search

Classroom selectors originally loaded all classrooms with `getAllClassRooms()`. At 71,636 rooms, this created unnecessary network payload, memory usage, and UI filtering cost.

The current selector architecture uses `searchClassRooms({ q, cursor })`:

- Typing in the picker debounces a server search
- The server returns one limited page
- “Muat lebih banyak” fetches the next cursor
- Results are merged by ID on the client
- Existing selected room labels are resolved through local lookup maps

This makes room filters and enrollment room pickers scale independently of total classroom count.

#### 7.4.6 Classroom Dashboard Pagination

The classroom dashboard uses a heavier query than the basic classroom list because each room row includes weekly utilization, current occupancy, and next-use information.

Earlier dashboard pagination used:

```sql
ORDER BY name
LIMIT ? OFFSET ?
```

That became slower than other pagination because every next page required offset scanning plus several per-page aggregate queries.

The dashboard now uses cursor pagination by `class_rooms.id`:

```sql
SELECT id, name, class_room_type, capacity, has_projector, has_ac
FROM class_rooms
WHERE id > ?
ORDER BY id ASC
LIMIT ?;
```

The dashboard summary owns the total room count, so `getClassRoomDashboardMetrics()` no longer runs `COUNT(*)` on every page switch. Page navigation maintains its own cursor history, just like collection lists.

#### 7.4.7 Pagination Limits

List limits are controlled by environment variables:

```bash
DB_LIST_QUERY_LIMIT=120
DB_MAX_LIST_QUERY_LIMIT=5000
```

`DB_LIST_QUERY_LIMIT` is the default visible page size. `DB_MAX_LIST_QUERY_LIMIT` caps any requested limit so a client cannot accidentally request an unbounded result set.

### 7.5 Query Optimization Patterns

#### 7.5.1 Split Heavy Queries Into Seed and Detail Phases

The conflict audit engine does not immediately join all display tables. It first scans for compact conflict seeds using covering indexes, then fetches display details for only the limited set of conflict groups that need rendering.

This two-phase approach avoids joining millions of rows just to discover that only a few conflict groups need to be shown.

#### 7.5.2 Prefer Narrow First-Page Queries

List endpoints select only columns needed by list rows. Detail views fetch the full row only after selection. Example: classroom list pages select ID, name, room type, and capacity, while detailed room utilization is fetched separately.

This reduces:

- network payload
- serialization cost
- server memory use
- Svelte reactive invalidation cost

#### 7.5.3 Avoid Client-Side Filtering of Large Collections

Client-side filtering is acceptable for tiny static lists, but not for stress-scale entities. The app avoids loading all students/classrooms/enrollments into browser memory. Search inputs call remote search functions and return limited server-filtered pages.

#### 7.5.4 Use Maps/Sets for UI Joins

For data already loaded in the browser, UI joins use `Map` and `Set` lookups instead of repeated `.find()` calls. This matters when rendering calendar cards and schedule conflict details.

Examples:

- Enrollment lookup by ID
- Conflict group lookup by ID
- Available room ID set
- Picker label lookup maps

The effect is usually small for one row but large when repeated across hundreds or thousands of rendered items.

#### 7.5.5 Avoid Reactive Cascade Recomputations

Svelte `$derived` values are kept focused on data transformations. Volatile UI state such as “selected row” is not embedded into every derived item object. Selection is computed in the template (`class:selected={selectedId === item.id}`) so selecting one row does not rebuild every schedule card object.

#### 7.5.6 Cache High-Cost Audit Results

Conflict audit results are cached with a short TTL and invalidated on relevant mutations. This avoids rescanning millions of rows repeatedly while still keeping conflict information fresh after schedule/enrollment/course changes.

#### 7.5.7 Use `FORCE INDEX` Carefully

Some high-cost queries explicitly use `FORCE INDEX` when MariaDB's optimizer may otherwise choose a generic index. This is used only for known hot paths where the intended access pattern is stable, such as schedule room/day/time scans and conflict audit scans.

`FORCE INDEX` should not be added casually. Before adding it, verify:

- the index matches the query predicate order
- the data distribution is stable
- `EXPLAIN` shows the optimizer choosing the wrong plan without it
- benchmarks improve under realistic data volume

#### 7.5.8 Measure Write and Read Paths Separately

Some optimizations improve read latency but slow writes. Watum explicitly accepts this for conflict indexes because conflict detection is user-facing and frequent. Admin writes that change lecturer assignments may be slower because they correctly maintain denormalized audit keys and indexes.

Benchmarks therefore separate:

- read-heavy user flows
- admin write cycles
- conflict audit latency
- schedule/calendar rendering latency

---

## 8. Stress Testing & Benchmarking

### 8.1 Stress Seed (`stress-seed.ts`)

Generates deterministic fake data:

```bash
bun seed:stress
```

**Default targets**:

- 10,000,000 total rows
- 1,500,000 students
- 250 lecturers
- 48 courses (8 per study program)
- ~69,000 enrollments per course
- ~2,750,000 grades

**Tunable via env**:

```bash
STRESS_SEED_TARGET_ROWS=5000000 bun seed:stress
```

### 8.2 Benchmark Suite (`scripts/benchmark-suite.mjs`)

A custom Node.js HTTP load tester (JMeter replacement):

```bash
# Full benchmark (200 users, 3 loops, 300s ramp-up)
node scripts/benchmark-suite.mjs

# Quick smoke test
node scripts/benchmark-suite.mjs --threads 10 --loops 1 --ramp-up 0

# Custom host
BENCHMARK_HOST=http://localhost:4173 node scripts/benchmark-suite.mjs
```

**Transactions tested**:

- Login User / Login Admin
- Refresh Access Token
- Get Current User
- Get Courses / Students / Enrollments / Grades
- User Operation Flow (login → refresh → get user → get courses → get students → get enrollments → get grades)
- Admin Write Cycle (update course → verify → restore) × 3 courses

**Output**:

- Console: samples, errors, mean latency, p95, throughput
- HTML report: `performance/benchmark-report/index.html`
- JSON stats: `performance/benchmark-report/statistics.json`

### 8.3 JMeter Plan (`performance/watum-benchmark.jmx`)

Alternative JMeter test plan with the same transaction mix.

---

## 9. Deployment & Operations

### 9.1 Runtime

Watum runs on **Bun** (replaced Node.js in April 2026). The migration involved:

| Change                           | From                       | To                                     |
| -------------------------------- | -------------------------- | -------------------------------------- |
| Runtime                          | Node.js 22.x               | Bun 1.3+                               |
| Server adapter                   | @sveltejs/adapter-node     | svelte-adapter-bun                     |
| Password hashing                 | argon2 (native C++ addon)  | @node-rs/argon2 (prebuilt Rust binary) |
| Lockfile                         | package-lock.json          | bun.lock                               |
| Docker base image                | node:22-bookworm-slim      | oven/bun:1-debian                      |

`svelte-adapter-bun` uses `Bun.serve` instead of Node's `http` module. The `dynamic_origin: true` adapter option is enabled to support reverse proxy deployments (reads `X-Forwarded-Proto` and `X-Forwarded-Host` headers).

### 9.2 Environment Variables

```bash
# Database
DB_HOST=129.150.54.149
DB_PORT=5432
DB_USER=mariadb
DB_PASSWORD=...
DB_NAME=projectbasdat2

# List query limits
DB_LIST_QUERY_LIMIT=120
DB_MAX_LIST_QUERY_LIMIT=5000

# Auth
JWT_SECRET=...

# Proxy / deployment (set automatically by docker-entrypoint.sh on Coolify)
ORIGIN=https://projectbasdat.bumimas12.web.id
```

### 9.3 Coolify Deployment

The `docker-entrypoint.sh` handles Coolify-specific setup:

1. **`ORIGIN` derivation**: If not set, auto-derived from `COOLIFY_FQDN` env var.
2. **`HOST_HEADER` override**: Unconditionally set to `x-no-such-header` to force the adapter to rewrite request URLs to the public origin. Without this, Bun receives plain HTTP from Traefik and constructs `http://` URLs, which fail SvelteKit's remote-functions CSRF check (`http` vs `https`).
3. **Auto-migrations**: Runs `scripts/run-migrations.mjs` before starting the server (controlled by `AUTO_APPLY_MIGRATIONS`).

### 9.4 Build & Preview

```bash
bun run build      # Production build
bun run preview    # Preview via Vite (dev middleware)

# True production preview (uses svelte-adapter-bun output)
bun ./build/index.js
```

### 9.5 Database Maintenance

```bash
# Run migrations
mysql -h <host> -u root -p < src/lib/server/migrations/001_schema.sql

# Fix lecturer_audit_sk drift (if trigger was disabled)
mysql -h <host> -u root -p -e "
  UPDATE enrollments e
  JOIN courses c ON c.id = e.course_id
  SET e.lecturer_audit_sk = c.lecturer_audit_sk
  WHERE e.lecturer_audit_sk <> c.lecturer_audit_sk;
"

# Rebuild conflict indexes (after mass updates)
ALTER TABLE enrollments DROP INDEX idx_enrollments_lecturer_conflict;
ALTER TABLE enrollments ADD INDEX idx_enrollments_lecturer_conflict (...);
```

---

## 10. File Structure

```
watum/
├── src/
│   ├── routes/                          # SvelteKit routes (all views in +page.svelte)
│   │   ├── +page.svelte                 # Main dashboard (~11700 lines)
│   │   ├── +layout.svelte               # Root layout (fonts, auth, loading spinner)
│   │   ├── auth/
│   │   │   ├── data.remote.ts           # loginUser, logoutUser, getCurrentUser
│   │   │   └── ...
│   │   ├── courses/
│   │   │   ├── data.remote.ts           # getCourses, createCourse, updateCourse, deleteCourse
│   │   │   └── ...
│   │   ├── students/
│   │   │   ├── data.remote.ts           # getStudents, createStudent, updateStudent, deleteStudent
│   │   │   └── ...
│   │   ├── lecturers/
│   │   ├── enrollments/
│   │   ├── grades/
│   │   ├── classrooms/
│   │   ├── faculties/
│   │   ├── study-programs/
│   │   ├── users/
│   │   └── test/
│   │       └── +page.svelte             # API testing playground
│   ├── lib/
│   │   ├── client/
│   │   │   ├── auth.ts                  # Access token management, fetch interceptor
│   │   │   └── loading.svelte.ts        # Global loading state
│   │   ├── server/
│   │   │   ├── db.ts                    # Connection pool, transaction helper
│   │   │   ├── auth.ts                  # JWT, refresh tokens, password hashing
│   │   │   ├── conflict-audit.ts        # Conflict detection engine
│   │   │   ├── entity-id.ts             # ID generation utilities
│   │   │   ├── search.ts                # Fulltext, prefix, cursor helpers
│   │   │   ├── time-helpers.ts          # Timezone-aware time formatting
│   │   │   ├── migrations/              # 22 SQL migration files
│   │   │   └── sql/                     # Generated + handwritten SQL queries
│   │   │       ├── select-*.ts          # Dynamic SELECT builders
│   │   │       ├── insert-*.ts          # INSERT queries
│   │   │       ├── update-*.ts          # UPDATE queries
│   │   │       ├── delete-*.ts          # DELETE queries
│   │   │       └── crud/                # Low-level CRUD operations
│   │   ├── components/
│   │   │   ├── app/
│   │   │   │   ├── ClassroomDashboard.svelte
│   │   │   │   ├── CollectionPagination.svelte
│   │   │   │   └── GlobalSpinner.svelte
│   │   │   └── ui/                      # shadcn/ui components
│   │   ├── validations/                 # Valibot schemas
│   │   │   ├── course.ts
│   │   │   ├── enrollment.ts
│   │   │   ├── student.ts
│   │   │   └── ...
│   │   └── app/
│   │       └── academic.ts              # Academic utilities (schedules, conflicts, room metrics)
│   └── app.html                         # HTML template
├── scripts/
│   ├── benchmark-suite.mjs              # HTTP load tester
│   ├── benchmark-loader.mjs             # ESM loader for benchmark
│   └── benchmark-env.mjs                # Environment defaults
├── stress-seed.ts                       # 10M-row stress data generator
├── Dockerfile                           # Multi-stage Bun build
├── docker-entrypoint.sh                 # Coolify startup (ORIGIN, HOST_HEADER, migrations)
├── bun.lock                             # Bun lockfile (replaced package-lock.json)
├── .env.example                         # Environment template
├── performance/
│   ├── benchmark-report/                # Generated reports
│   └── watum-benchmark.jmx              # JMeter test plan
├── package.json
├── svelte.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## Appendix: Common Issues & Fixes

### Issue: Lecturer select not updating

**Cause**: `<select value={...}>` instead of `bind:value`  
**Fix**: Changed to `bind:value={courseDraft.lecturerId}`

### Issue: Conflict count changed unexpectedly

**Cause**: Dropped `courses_au_audit_keys` trigger left enrollments out of sync  
**Fix**: Recreated trigger + re-synced data + rebuilt index

### Issue: Update course extremely slow (~20s)

**Cause**: Trigger updating 104k enrollment rows × 3 indexes  
**Fix**: Optimized trigger with `WHERE lecturer_audit_sk <> NEW.lecturer_audit_sk` to skip already-correct rows

### Issue: UI lag when selecting schedule rows

**Cause**: `selected` property embedded in `$derived` objects caused full recompute  
**Fix**: Computed `selected` inline in template instead of derived object

### Issue: `ER_LOCK_DEADLOCK` during benchmark

**Cause**: 200 concurrent users hitting refresh_tokens with `SELECT ... FOR UPDATE`  
**Mitigation**: Reduced concurrent threads in benchmark; transactions are short-lived

### Issue: Login 403 "Cross-site remote requests are forbidden" behind Coolify proxy

**Cause**: Bun receives plain HTTP from Traefik and constructs `request.url = "http://hostname/..."`. SvelteKit's remote-functions CSRF check (in `respond.js:79`) compares `new URL(request.url).origin` (`http`) against the browser's `Origin` header (`https`). They don't match.  
**Fix**: Set `HOST_HEADER=x-no-such-header` in `docker-entrypoint.sh` to force the adapter's URL rewrite. The adapter only rewrites when `origin !== requestOrigin`; pointing `HOST_HEADER` at a non-existent header makes them differ, triggering the rewrite to the correct `https://` origin.  
**Also**: Enabled `dynamic_origin: true` in the svelte-adapter-bun config and ensured `ORIGIN` is set (auto-derived from `COOLIFY_FQDN`).

### Issue: Dashboard content cut off on mobile

**Cause**: Grid children (`.student-hero`, `.student-summary-row`, `.ClassroomDashboard`) could expand past the viewport because parent grids lacked `min-width: 0`.  
**Fix**: Added `min-width: 0` to `.dashboard-stack`, `.student-dashboard`, `.student-summary-row`, `.student-grade-items`. Added `overflow: hidden` to `.student-hero`. Collapsed `.student-actions` to `1fr` at 720px.

### Issue: Search bar squished in list view topbar on medium screens

**Cause**: `.pane-head` used `grid-template-columns: 1fr auto` at all viewports above 720px, and `.topbar` used `minmax(0, 1fr) minmax(0, 20rem)`, causing search/actions to be squeezed.  
**Fix**: Both `.topbar` and `.pane-head` now collapse to `grid-template-columns: 1fr` at the 1080px breakpoint (where `workspace-shell` already goes single-column).

---

_End of Documentation_
