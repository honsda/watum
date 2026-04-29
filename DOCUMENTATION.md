# Watum — Comprehensive Technical Documentation

> **Project**: Watum Academic Scheduling System  
> **Stack**: SvelteKit 2.x, MariaDB (MySQL), Bun, TypeScript  
> **Scale**: Stress-tested to 10,000,000 rows (enrollments)  
> **Last Updated**: 2026-04-29
> **Recent Changes**: Resolved entity-link accessibility warnings, hardened enrollment creation and term-scoped conflict checks, documented editor combobox search behavior and TanStack Query decision

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Database Architecture](#3-database-architecture)
4. [Application Architecture](#4-application-architecture)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [Conflict Audit System](#6-conflict-audit-system)
7. [Performance Optimizations](#7-performance-optimizations)
8. [Core Module API Reference](#8-core-module-api-reference)
9. [Stress Testing & Benchmarking](#9-stress-testing--benchmarking)
10. [Deployment & Operations](#10-deployment--operations)
11. [File Structure](#11-file-structure)
12. [UI Entity Links & Accessibility](#12-ui-entity-links--accessibility)

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

| File                                       | Purpose                                                  |
| ------------------------------------------ | -------------------------------------------------------- |
| `001_schema.sql`                           | Base schema + indexes                                    |
| `002_refresh_tokens.sql`                   | Session management                                       |
| `003-003`                                  | Refresh token indexes                                    |
| `004-009`                                  | Schedule overlap + large dataset indexes                 |
| `010-011`                                  | Conflict audit integer keys                              |
| `012`                                      | **Denormalized schedule columns + covering indexes**     |
| `013-016`                                  | Index cleanup + fulltext search                          |
| `017`                                      | Time column optimizations                                |
| `018_optimize_triggers.sql`                | Conditional trigger guards                               |
| `019_drop_courses_au_trigger.sql`          | Dropped cascade trigger (later restored)                 |
| `020_recreate_courses_au_trigger.sql`      | Restored trigger with optimized query                    |
| `021_grades_constraints.sql`               | Grade score CHECK constraints + total_score auto trigger |
| `022_enrollment_course_lecturer_index.sql` | Composite index for lecturer cascade trigger performance |

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

| Role       | Views                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN`    | All 12 views (dashboard, calendar, builder, classrooms, courses, students, lecturers, faculties, studyPrograms, enrollments, grades, users) |
| `LECTURER` | All except `users`; read-only on students, faculties, studyPrograms                                                                         |
| `STUDENT`  | dashboard, calendar, classrooms, courses, lecturers, enrollments, grades                                                                    |

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

| Conflict type | HAVING predicate                   | Rationale                                                                                                            |
| ------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Room          | `COUNT(*) > 1`                     | Any room double-booking is a real conflict — even two sections of the same course consuming the same physical space  |
| Student       | `MIN(course_id) != MAX(course_id)` | A student enrolled twice in the same course at the same slot is data corruption, not a real conflict                 |
| Lecturer      | `MIN(course_id) != MAX(course_id)` | A lecturer teaching one course with hundreds of students is normal; only multiple distinct courses indicate conflict |

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

### 6.12 Module API Reference (`src/lib/server/conflict-audit.ts`)

This section documents every type, constant, and function in the server conflict audit module. It is intended as a complete reference for developers who need to modify the audit pipeline, debug cache behavior, or extend conflict detection.

#### 6.12.1 Type Definitions

| Type                     | Purpose                                                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `ConflictAuditType`      | Union `'room' \| 'student' \| 'lecturer'`. Identifies which resource dimension is being audited.                                             |
| `ConflictAuditFilters`   | All optional filter fields accepted by the audit pipeline. See §6.3.1 for field descriptions.                                                |
| `ConflictAuditMember`    | A single hydrated enrollment row inside a conflict group, with all display names resolved (student, course, lecturer, room).                 |
| `ConflictAuditGroup`     | One conflict instance: a resource + time window + sampled members. This is what the UI renders.                                              |
| `ConflictAuditResult`    | Top-level return value containing applied filters, aggregate summary, truncation flag, and hydrated groups.                                  |
| `AuditScanRow`           | Raw database row shape returned by seed collection and hydration queries. Uses snake_case column names.                                      |
| `ConflictAuditGroupSeed` | Lightweight pre-hydration representation of a conflict group. Contains only audit keys, time window, and member count — no display names.    |
| `HydratedMemberRow`      | Subset of `AuditScanRow` after hydration, guaranteed to have student/course/lecturer/room display names.                                     |
| `CacheEntry`             | In-memory cache slot: `{ version, storedAt, result }`. The version is checked against the global `auditCacheVersion` to detect invalidation. |

#### 6.12.2 Constants

| Constant                             | Value                 | Purpose                                                                                    |
| ------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------ |
| `AUDIT_CACHE_TTL_MS`                 | `300_000` (5 minutes) | Stale cache entries are returned immediately while a background refresh is scheduled.      |
| `DEFAULT_HYDRATED_MEMBERS_PER_GROUP` | `40`                  | Default cap on hydrated members per group when no explicit `memberSampleSize` is provided. |
| `MAX_HYDRATED_MEMBERS_PER_GROUP`     | `40`                  | Hard ceiling. Requests above 40 are clamped to 40 to prevent unbounded hydration.          |
| `AUDIT_CACHE_MAX_SIZE`               | `200`                 | LRU bound. After 200 entries, oldest entries are evicted by insertion order.               |

#### 6.12.3 Cache State

The module maintains four module-level mutable structures:

| Symbol                     | Type                                        | Purpose                                                                                                                                                                        |
| -------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auditCache`               | `Map<string, CacheEntry>`                   | Completed audit results keyed by normalized filter JSON.                                                                                                                       |
| `auditCacheInsertionOrder` | `string[]`                                  | Tracks insertion order so `pruneAuditCache()` can evict oldest entries.                                                                                                        |
| `inFlightAudits`           | `Map<string, Promise<ConflictAuditResult>>` | Deduplicates concurrent requests for the same cache key. If two requests arrive with identical filters while the first is still computing, the second awaits the same promise. |
| `auditCacheVersion`        | `number`                                    | Monotonically incremented by `invalidateConflictAuditCache()`. Cached entries whose `version` does not match the current global version are treated as stale.                  |

#### 6.12.4 Cache Management Functions

**`pruneAuditCache()`**

Removes the oldest cache entries until `auditCache.size <= AUDIT_CACHE_MAX_SIZE`. Oldest is determined by `auditCacheInsertionOrder.shift()`. This is called automatically by `setAuditCache()` after every insertion.

**`setAuditCache(key, entry)`**

Inserts or updates a cache entry. If the key is new, it is appended to `auditCacheInsertionOrder`. Then `pruneAuditCache()` runs. This ensures the cache never grows beyond 200 entries even under high-cardinality filter permutations.

**`createAuditCacheKey(filters)`**

Builds a deterministic JSON string from all filter fields. Focus enrollment IDs are sorted before serialization so that `["A","B"]` and `["B","A"]` produce the same key. All missing fields are normalized to `null`.

**`getMemberSampleSize(filters)`**

Clamps the client-requested `memberSampleSize` to the range `[1, MAX_HYDRATED_MEMBERS_PER_GROUP]`. Returns `null` if the filter does not specify a sample size, which causes hydration to use `DEFAULT_HYDRATED_MEMBERS_PER_GROUP`.

**`invalidateConflictAuditCache()`** _(exported)_

Invalidates the entire cache in O(1):

1. Increments `auditCacheVersion`.
2. Clears `auditCache`.
3. Clears `auditCacheInsertionOrder`.

All existing `CacheEntry` objects immediately become stale because their stored `version` no longer matches the global version. This is called after any mutation that can affect scheduling conflicts (enrollment writes, course lecturer changes, classroom changes, student/lecturer changes).

#### 6.12.5 Utility Functions

**`timeToSeconds(value)`**

Converts a MariaDB `TIME` string (e.g. `'13:00:00.000'`) or a JavaScript `Date` into total seconds since midnight. Used for sorting hydrated members by start time.

**`mapHydratedMember(row)`**

Maps a `HydratedMemberRow` (snake_case database columns) into a `ConflictAuditMember` (camelCase display object). This is a pure transformation with no business logic.

**`buildEnrollmentOnlyWhere(filters)`**

Builds the `WHERE` clause and parameter list for seed collection. It converts user-facing IDs into audit-key predicates via subqueries:

```sql
-- classRoomId filter example
e.class_room_audit_sk = (SELECT audit_sk FROM class_rooms WHERE id = ? LIMIT 1)
```

Academic year is converted to a 4-digit numeric start year via `CAST(SUBSTRING(?, 1, 4) AS UNSIGNED)`. Semester is converted to a numeric sort key (`1` for Ganjil, `2` for Genap). The function always includes `'1 = 1'` as the first predicate so that subsequent `AND` concatenation is safe even when no filters are present.

**`getConflictResourceColumn(type)`**

Returns the denormalized audit column for a conflict type:

- `'room'` → `'e.class_room_audit_sk'`
- `'student'` → `'e.student_audit_sk'`
- `'lecturer'` → `'e.lecturer_audit_sk'`

**`getConflictForceIndex(type)`**

Returns the covering index name for a conflict type:

- `'room'` → `'idx_enrollments_room_conflict'`
- `'student'` → `'idx_enrollments_student_conflict'`
- `'lecturer'` → `'idx_enrollments_lecturer_conflict'`

**`seedKey(seed)`**

Creates a deterministic string key from a seed's resource ID, academic year, semester, day, start time, and end time. Used as a lookup key when grouping hydrated rows back into their parent seeds.

#### 6.12.6 Core Pipeline Functions

**`collectConflictGroupSeeds(pool, conflictType, filters)`**

_Phase 1 — Discovery._ Performs the expensive index-only aggregation that finds all conflict windows for a single conflict type.

1. Builds the `WHERE` clause via `buildEnrollmentOnlyWhere(filters)`.
2. Chooses the resource column and covering index via `getConflictResourceColumn()` and `getConflictForceIndex()`.
3. **Conditional `FORCE INDEX`**: If extra filters are present (anything beyond the base `1 = 1`), `FORCE INDEX` is omitted. This prevents the optimizer from being locked into an index that does not cover the filter columns, which would cause expensive row lookups.
4. Groups by the resource audit key + the 5 schedule window columns.
5. Applies the type-specific `HAVING` predicate (see §6.3.3).
6. Returns an array of `ConflictAuditGroupSeed` objects with empty `memberRows`.

This function is called once per conflict type. The three calls run in parallel inside `computeAudit()`.

**`loadMemberRowsForSeeds(pool, seeds, focusSet, memberSampleSize)`**

_Phase 2 — Hydration._ Fetches display-ready member rows for a list of seeds.

Key behaviors:

- **Batched by conflict type**: Seeds are grouped by `conflictType` because each type requires a different `FORCE INDEX` and resource column.
- **Batch size**: 80 seeds per query round-trip.
- **UNION ALL composition**: Each seed in a batch becomes a subquery wrapped in parentheses and joined with `UNION ALL`. This avoids a single enormous dynamic query while keeping round trips bounded.
- **Focus priority**: If `focusSet` contains enrollment IDs, those IDs are queried first in a separate `IN (?)` query. Any focus rows that match a seed are added to that seed's member list before the general sample query runs.
- **Deduplication**: The function tracks seen `enrollment_id`s per seed key using a `Set` to prevent the same enrollment from appearing twice when a focus row also appears in the general sample.
- **Member ordering and limit**: When `memberSampleSize` is not `null`, each subquery orders by `e.audit_sk` and applies a `LIMIT`. The ordering is stable, which makes sampling deterministic.

Returns the input seeds with `memberRows` populated.

**`filterSeedsByFocus(pool, seeds, focusSet)`**

_Phase 3 — Focus scoping._ When `focusEnrollmentIds` is provided, this function narrows the full seed list to only seeds that contain at least one focused enrollment.

Algorithm:

1. Load the schedule window and audit keys for all focused enrollment IDs in batches of 1000.
2. For each focused enrollment, compute three possible seed keys (room, student, lecturer) using the same `seedKey()` logic as seed collection.
3. Filter the seed list to keep only seeds whose `conflictType:seedKey` exists in the focused key set.

This is more efficient than hydrating all seeds and then filtering, because it avoids JOINs and display-name resolution for seeds that will be discarded.

**`sampleGroupMembers(group, focusSet, memberSampleSize)`**

_Phase 4 — Sampling._ Culls a group's `memberRows` down to the requested sample size while preserving focus rows.

1. If `memberSampleSize` is `null`, return all rows.
2. If the group has fewer rows than the sample size, return all rows.
3. First pass: add all focus rows (enrollment IDs in `focusSet`) to the selected map.
4. Second pass: fill remaining slots with non-focus rows in their original order until the cap is reached.
5. Return the selected rows as an array.

Because a `Map` is used with `enrollment_id` as the key, duplicates are impossible even if a row appears in both passes.

**`hydrateConflictGroupSeeds(groups, focusSet, memberSampleSize)`**

_Phase 5 — Group assembly._ Converts seeds + sampled rows into final `ConflictAuditGroup` objects.

Per group:

1. Sample members via `sampleGroupMembers()`.
2. Map each row to `ConflictAuditMember` via `mapHydratedMember()`.
3. Sort members by `timeToSeconds(startTime)` ascending.
4. Derive `resourceName` from the first member:
   - Room conflicts → `classRoomName`
   - Student conflicts → `studentName`
   - Lecturer conflicts → `lecturerName`
   - Fallback to `resourceId` if no members exist.

Returns an array of `ConflictAuditGroup` ready for the UI.

**`computeAudit(pool, filters)`**

_Orchestrator._ Runs the full six-phase pipeline:

1. **Select types**: If `filters.conflictType` is set, audit only that type; otherwise audit all three.
2. **Parallel seed collection**: `Promise.all` over `collectConflictGroupSeeds()` for each type.
3. **Merge and sort**: Concatenate seeds from all types, sort by descending `memberCount`, then by `conflictType:resourceId`.
4. **Focus filter**: If `focusEnrollmentIds` is non-empty, call `filterSeedsByFocus()`.
5. **Limit**: If `limitGroups` is set, slice the seed list.
6. **Hydrate**: Call `loadMemberRowsForSeeds()` on the selected seeds.
7. **Assemble**: Call `hydrateConflictGroupSeeds()` to build final groups.
8. **Summary**: Count distinct resources per type using `Set` deduplication over the **full** (pre-limit) seed list so that summary counts remain accurate even when groups are truncated.

Returns a `ConflictAuditResult`.

**`scheduleBackgroundRefresh(pool, filters, cacheKey, version)`**

Called when a cache entry exists but is past its TTL. It:

1. Checks `inFlightAudits` to avoid spawning duplicate background jobs for the same key.
2. Calls `computeAudit()` asynchronously.
3. If the global cache version has not changed by the time the computation finishes, writes the result into `auditCache`.
4. Removes the promise from `inFlightAudits` in a `.finally()` block.

The caller (`auditEnrollmentConflicts`) returns the stale cached result immediately, so the UI never waits for the refresh.

**`auditEnrollmentConflicts(pool, filters)`** _(exported)_

_Public entry point._ Implements the full cache-aware read path:

1. Build the cache key via `createAuditCacheKey(filters)`.
2. Check `auditCache` for a matching entry with the current `auditCacheVersion`.
3. **Cache hit + stale**: If the entry exists but is older than `AUDIT_CACHE_TTL_MS`, return it immediately and call `scheduleBackgroundRefresh()`.
4. **Cache hit + fresh**: Return the cached result directly.
5. **In-flight deduplication**: If another request is already computing the same key, await its promise via `inFlightAudits`.
6. **Cache miss**: Call `computeAudit()`, store the result in the cache, and return it.

This is the only function that remote queries (e.g. `getEnrollmentConflictAudit`) call directly.

#### 6.12.7 Data Flow Diagram (Textual)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  auditEnrollmentConflicts(pool, filters)                                │
│  ── cache lookup / stale-while-revalidate / in-flight dedup ──          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │ cache miss
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  computeAudit(pool, filters)                                            │
│  ── orchestrator ──                                                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ collectConflict │      │ collectConflict │      │ collectConflict │
│ GroupSeeds      │      │ GroupSeeds      │      │ GroupSeeds      │
│ (room)          │      │ (student)       │      │ (lecturer)      │
│ ── index-only ──│      │ ── index-only ──│      │ ── index-only ──│
└─────────────────┘      └─────────────────┘      └─────────────────┘
          │                         │                         │
          └─────────────────────────┼─────────────────────────┘
                                    ▼ merge + sort
                          ┌─────────────────┐
                          │ filterSeedsByFocus│  (optional)
                          │ ── scope to IDs ──│
                          └─────────────────┘
                                    ▼
                          ┌─────────────────┐
                          │ loadMemberRows  │
                          │ ForSeeds        │
                          │ ── batched ──   │
                          │ ── UNION ALL ── │
                          └─────────────────┘
                                    ▼
                          ┌─────────────────┐
                          │ hydrateConflict │
                          │ GroupSeeds      │
                          │ ── sort, name ──│
                          └─────────────────┘
                                    │
                                    ▼
                          ┌─────────────────┐
                          │ summary counts  │
                          │ (distinct Sets) │
                          └─────────────────┘
                                    │
                                    ▼
                          ConflictAuditResult
```

#### 6.12.8 Thread Safety and Concurrency Guarantees

The module uses module-level mutable state (Maps, arrays, counters). Under Bun's single-threaded event loop, this is safe without locks:

- `auditCache` mutations are atomic JavaScript operations.
- `inFlightAudits` deduplication is race-safe because the `has()` → `set()` sequence for a given key is always within the same tick for identical filter inputs.
- `auditCacheVersion` increments are atomic.

Background refresh promises are fire-and-forget. If the server restarts, the cache is empty and the next request triggers a fresh compute. There is no persistent cache storage.

#### 6.12.9 Memory Profile

Typical memory footprint per cached audit result:

| Filter set            | Groups hydrated | Members per group | Estimated cache entry size |
| --------------------- | --------------- | ----------------- | -------------------------- |
| Full audit (no limit) | 1,000           | 10                | ~2–4 MB                    |
| Lecturer-scoped       | 200             | 10                | ~400–800 KB                |
| Focused (10 IDs)      | 5               | 10                | ~20–40 KB                  |

At the LRU bound of 200 entries, worst-case cache memory is ~400–800 MB. In practice, most workloads hit far fewer distinct filter combinations because the UI scopes by academic year + semester, which dramatically reduces cardinality.

---

## 7. Performance Optimizations

### 7.1 Database Optimizations

| Optimization             | Impact                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **Covering indexes**     | Conflict scans are index-only, no row lookups                                                                                 |
| **Denormalized columns** | Eliminates JOINs in aggregation queries                                                                                       |
| **Conditional triggers** | Skips 552k unnecessary SELECTs per lecturer change                                                                            |
| **Keyset pagination**    | `cursor`-based pagination instead of OFFSET (avoids skipping)                                                                 |
| **Fulltext indexes**     | `MATCH ... AGAINST` for name search                                                                                           |
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
| **Conflict audit cache**  | 5-minute TTL avoids re-scanning; stale-while-revalidate                  |
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

---

## 8. Core Module API Reference

This section documents the important functions, types, and constants across Watum's core modules. It is intended as a comprehensive reference for developers who need to understand, modify, or extend the system's authentication, database, scheduling, and client infrastructure.

---

### 8.1 Authentication System (`src/lib/server/auth.ts`)

The server authentication module implements a dual-token architecture: short-lived JWT access tokens (5 minutes) and long-lived opaque refresh tokens (30 days) stored in `httpOnly` cookies. Key security features include automatic refresh token rotation on every use, context binding to prevent token theft replay, password versioning to invalidate tokens on password changes, and multi-name cookie handling for seamless migrations.

#### 8.1.1 Security Model and Threat Mitigations

| Threat                | Mitigation                                                      | Implementation                                               |
| --------------------- | --------------------------------------------------------------- | ------------------------------------------------------------ |
| Token theft (XSS)     | Access token stored only in memory; refresh token is `httpOnly` | Client `accessToken` variable; server sets `httpOnly` cookie |
| Token theft (network) | Context binding to User-Agent                                   | `ctx` JWT claim = SHA-256(User-Agent)                        |
| Replay attack         | Refresh token rotation + single-use                             | Old token deleted from DB on refresh; `FOR UPDATE` lock      |
| Session fixation      | Per-context refresh tokens                                      | `setSession()` deletes only same-context tokens              |
| Password change lag   | Password versioning in JWT                                      | `pwdv` claim invalidated when hash changes                   |
| CSRF                  | `sameSite: 'strict'` cookie                                     | Cookie only sent on same-site requests                       |
| Cookie name confusion | Multi-name read + cleanup                                       | Reads all known names; deletes stale names on set            |

#### 8.1.2 Type Definitions

**`User`**

```typescript
interface User {
	id: string; // UUID from users table
	email: string;
	role: 'ADMIN' | 'STUDENT' | 'LECTURER';
	studentId: string | null; // Nullable FK to students
	lecturerId: string | null; // Nullable FK to lecturers
	student: { id: string; name: string } | null;
	lecturer: { id: string; name: string } | null;
}
```

The `student` and `lecturer` objects are eagerly loaded by the SQL builder (`selectUsers`) using JOINs. This means `getUser()` resolves in a single query even when role-specific profile data is needed.

**`AccessTokenPayload`**

```typescript
interface AccessTokenPayload {
	userId: string; // JWT 'sub' claim
	contextBinding: string; // JWT 'ctx' claim (SHA-256 of UA)
	passwordVersion: string; // JWT 'pwdv' claim (SHA-256 of password hash)
}
```

**`RefreshTokenRow`**

```typescript
interface RefreshTokenRow extends RowDataPacket {
	id: string; // UUID primary key
	user_id: string;
	token_hash: string; // SHA-256 of "refresh:" + opaque token
	context_binding: string; // SHA-256 of UA at creation time
	expires_at: Date | string;
}
```

**`AuthenticatedLoginResult`**

```typescript
interface AuthenticatedLoginResult {
	user: User;
	passwordHash: string; // Raw hash from DB, needed for password versioning
}
```

#### 8.1.3 Constants and Environment

| Constant                                | Value                                                     | Purpose                                   | Mutable? |
| --------------------------------------- | --------------------------------------------------------- | ----------------------------------------- | -------- |
| `ACCESS_TOKEN_TTL_SECONDS`              | `300`                                                     | Access token lifetime in seconds          | No       |
| `REFRESH_TOKEN_TTL_SECONDS`             | `2_592_000`                                               | Refresh token lifetime (30 days)          | No       |
| `ACCESS_CONTEXT_BINDING_CLAIM`          | `'ctx'`                                                   | JWT custom claim key for context          | No       |
| `PASSWORD_VERSION_CLAIM`                | `'pwdv'`                                                  | JWT custom claim key for password version | No       |
| `REFRESH_TOKEN_COOKIE_NAME`             | `'refresh_token'`                                         | Base cookie name                          | No       |
| `SECURE_REFRESH_TOKEN_COOKIE_NAME`      | `'__Secure-refresh_token'`                                | Prefixed name for HTTPS                   | No       |
| `LEGACY_HOST_REFRESH_TOKEN_COOKIE_NAME` | `'__Host-refresh_token'`                                  | Legacy prefixed name                      | No       |
| `REFRESH_TOKEN_COOKIE_PATH`             | `'/auth'`                                                 | Cookie path scope                         | No       |
| `LEGACY_SESSION_COOKIE_NAMES`           | `['session_token', '__Host-session_token', 'session_id']` | Pre-migration cleanup targets             | No       |

**Environment Variables:**

| Variable     | Required | Default     | Used By                                            |
| ------------ | -------- | ----------- | -------------------------------------------------- |
| `JWT_SECRET` | Yes      | —           | `getJwtSecret()` — HS256 signing key               |
| `JWT_ISSUER` | No       | `undefined` | `getJwtIssuer()` — optional issuer validation      |
| `NODE_ENV`   | No       | —           | `useSecureCookies()` — forces secure in production |

#### 8.1.4 Cryptographic Primitives

**`hashValue(value: string): string`**

Creates a SHA-256 digest of the input, encoded as `base64url` (URL-safe Base64 without padding). This is the single hashing primitive used throughout the auth module.

**Properties:**

- Deterministic: same input always produces same output
- One-way: cannot be reversed to recover the original
- Collision-resistant: SHA-256 provides 256-bit security
- URL-safe: `base64url` encoding avoids `+`, `/`, and `=` characters

**Used for:**

- Refresh token hashing (with domain prefix)
- Context binding (User-Agent fingerprint)
- Password versioning (fingerprint of password hash)

**`hashRefreshToken(token: string): string`**

```typescript
return hashValue(`refresh:${token}`);
```

Domain-separated hashing prevents a refresh token hash from accidentally matching a password version hash or context binding, even if the underlying random bytes happen to collide. The `refresh:` prefix acts as a namespace.

**`createOpaqueToken(): string`**

```typescript
return randomBytes(48).toString('base64url');
```

Generates a 48-byte (384-bit) cryptographically secure random value using Node.js `crypto.randomBytes()`. Encoded as `base64url`, this produces a 64-character string.

**Entropy analysis:**

- 48 bytes = 384 bits
- Collision probability at 1 billion tokens: ≈ 2^-325 (negligible)
- Brute-force resistance: 2^384 operations (computationally infeasible)

**`getPasswordVersion(passwordHash: string): string`**

```typescript
return hashValue(passwordHash);
```

Creates a stable fingerprint of the user's current password hash. When a user changes their password, the stored hash changes, so this version changes. All previously issued access tokens contain the old `passwordVersion` in their `pwdv` claim, causing `getUser()` to reject them.

**Invalidation cascade:**

1. Admin resets user's password
2. Database password hash changes
3. `getUser()` computes `getPasswordVersion(newHash)` for future tokens
4. Existing tokens have `pwdv = getPasswordVersion(oldHash)`
5. Mismatch → `getUser()` returns `null` → 401

**`getRequestContextBinding(): string`**

```typescript
const userAgent = request.headers.get('user-agent') ?? '';
return hashValue(['access-context-v2', userAgent].join('\n'));
```

Binds tokens to the User-Agent string of the requesting browser/device. This prevents a stolen access token from being used on a different device, because the context binding in the JWT will not match the new device's User-Agent.

**Limitations:**

- User-Agent can be spoofed (but this requires active attacker control)
- Browser upgrades may change UA string (rare edge case, user re-logs in)
- Does not protect against same-browser attacks (e.g., malicious extensions)

**`useSecureCookies(url: URL): boolean`**

```typescript
return url.protocol === 'https:' || env.NODE_ENV === 'production';
```

Determines whether cookies should be marked `secure` and whether the `__Secure-` prefixed name should be used. In production behind a reverse proxy (Coolify/Traefik), requests arrive as HTTP internally, but `NODE_ENV === 'production'` forces secure cookie behavior.

**`getJwtSecret(): Uint8Array`**

Reads `JWT_SECRET` from environment and encodes it as UTF-8 bytes for the `jose` library. Throws at startup if missing — the server will not start without a configured secret.

**`getJwtIssuer(): string | undefined`**

Reads `JWT_ISSUER` from environment. Returns `undefined` if not set, which disables issuer validation. Logs a warning when unset to remind operators to configure it.

#### 8.1.5 Cookie Name Strategy

**`getRefreshTokenCookieNames(url: URL): string[]`**

Returns a deduplicated array of all cookie names that might contain a refresh token:

```
[
  '__Secure-refresh_token',   // Current HTTPS name
  'refresh_token',            // Current HTTP name
  '__Host-refresh_token'      // Legacy name
]
```

**Why multiple names?** Cookie names evolve with security requirements. The `__Secure-` prefix requires `secure` flag; `__Host-` additionally requires `path=/` and no `Domain` attribute. Rather than breaking existing sessions during a migration, the system reads all known names and cleans up stale ones.

**`getPreferredRefreshTokenCookieName(url: URL): string`**

Returns `__Secure-refresh_token` for HTTPS/production, `refresh_token` otherwise. This is the "canonical" name used when _writing_ cookies.

**`getRefreshTokenCookieOptions(url: URL): CookieOptions`**

```typescript
{
  path: '/auth',
  httpOnly: true,
  sameSite: 'strict',
  secure: useSecureCookies(url)
}
```

**Security properties:**

- `path: '/auth'`: Cookie is only sent to `/auth/*` endpoints, reducing attack surface
- `httpOnly: true`: JavaScript cannot read the cookie (XSS protection)
- `sameSite: 'strict'`: Cookie is not sent on cross-site requests (CSRF protection)
- `secure: true`: Cookie is only sent over HTTPS (network sniffing protection)

**`getLegacySessionCookieOptions(url: URL): CookieOptions`**

```typescript
{
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  secure: useSecureCookies(url)
}
```

Used for deleting legacy session cookies (`session_token`, etc.). The `path: '/'` and `sameSite: 'lax'` match the properties these cookies were originally set with, ensuring the browser accepts the deletion.

**`setRefreshTokenCookie(token: string)`**

Writes the refresh token cookie and performs cleanup:

1. Gets the preferred cookie name and base options
2. Adds `maxAge: REFRESH_TOKEN_TTL_SECONDS` (30 days)
3. Sets the cookie with the token value
4. For each other cookie name: deletes it with the base options
5. Calls `clearLegacySessionCookies()`

**Why delete other names?** Prevents stale cookies from accumulating. If a user was previously on HTTP (`refresh_token`) and is now on HTTPS (`__Secure-refresh_token`), the old cookie would still exist and be sent to `/auth` endpoints, potentially causing confusion.

**`clearRefreshTokenCookies()`**

Iterates all known refresh token names and legacy session names, deleting each one. Called on logout, refresh failure, and session invalidation.

#### 8.1.6 Token Operations

**`signAccessToken(userId: string, passwordHash: string): Promise<string>`**

Signs a JWT with the HS256 algorithm. The payload structure:

```json
{
	"sub": "<user-id>",
	"ctx": "<sha256-of-user-agent>",
	"pwdv": "<sha256-of-password-hash>",
	"iat": 1234567890,
	"exp": 1234568190,
	"iss": "<optional-issuer>"
}
```

**Header:** `{ "alg": "HS256", "typ": "JWT" }`

**Parameters:**
| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `userId` | `string` | User UUID for the `sub` claim |
| `passwordHash` | `string` | Current Argon2 hash from DB, used to compute `pwdv` |

**Returns:** Base64url-encoded JWT string (three dot-separated segments).

**Side effects:** None (pure function, does not touch database or cookies).

**`verifyAccessToken(token: string): Promise<AccessTokenPayload | null>`**

Verifies a JWT and extracts its claims. Uses `jwtVerify` from the `jose` library.

**Verification steps:**

1. Verify signature with `JWT_SECRET`
2. Verify `exp` (expiration) — 5 minutes from issuance
3. Verify `iss` (issuer) — only if `JWT_ISSUER` is configured
4. Extract and validate `sub` — must be non-empty string
5. Extract and validate `ctx` — must be non-empty string
6. Extract and validate `pwdv` — must be non-empty string

**Returns:** `AccessTokenPayload` on success, `null` on any failure.

**Error handling:** All failures are caught and return `null`. The function never throws. This allows `getUser()` to distinguish "no token" from "invalid token" without exposing internal errors.

**`insertRefreshToken(connection, userId, tokenHash, contextBinding, expiresAt)`**

Persists a refresh token to the database.

**Parameters:**
| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `connection` | `PoolConnection` | Active DB connection (must be inside transaction) |
| `userId` | `string` | User UUID |
| `tokenHash` | `string` | SHA-256 of prefixed token |
| `contextBinding` | `string` | SHA-256 of User-Agent at creation time |
| `expiresAt` | `Date` | Expiration timestamp (30 days from now) |

**SQL:**

```sql
INSERT INTO refresh_tokens (id, user_id, token_hash, context_binding, expires_at)
VALUES (?, ?, ?, ?, ?)
```

The `id` is generated with `randomUUID()` (UUID v4). No uniqueness constraints are needed on `token_hash` because rotation deletes old tokens before inserting new ones.

#### 8.1.7 User Resolution

**`selectUserById(connection, userId): Promise<SelectUserRow | null>`**

Wraps the typed SQL builder:

```typescript
const [user] = await selectUsers(connection, {
	where: [['id', '=', userId]]
});
return user ?? null;
```

Returns the raw row (with snake_case properties like `student_id`, `student_name`) or `null`.

**`mapUser(user: SelectUserRow): User`**

Transforms raw SQL row to `User` object:

```typescript
{
  id: user.id!,
  email: user.email!,
  role: user.role!,
  studentId: user.student_id ?? null,
  lecturerId: user.lecturer_id ?? null,
  student: user.student_id ? { id: user.student_id, name: user.student_name ?? '' } : null,
  lecturer: user.lecturer_id ? { id: user.lecturer_id, name: user.lecturer_name ?? '' } : null
}
```

**Null safety:** Uses non-null assertions (`!`) for `id`, `email`, `role` because the database schema guarantees these are non-nullable. Falls back to empty strings for optional name fields.

**`getUser(): Promise<User | null>`**

The primary session resolver. Called by `hooks.server.ts` on every request.

**Full execution path:**

```
Request arrives
  → hooks.server.ts calls getUser()
    → getAccessTokenFromRequest()
      → Reads "Authorization: Bearer <token>" header
      → Returns null if header missing or malformed
    → verifyAccessToken(token)
      → Decodes JWT, verifies signature + claims
      → Returns AccessTokenPayload or null
    → getRequestContextBinding()
      → Computes SHA-256 of current User-Agent
    → Compare ctx from JWT vs computed ctx
      → Mismatch → return null (token stolen/replayed)
    → retryRead(() => selectUsers(...))
      → Queries DB with automatic retry on timeout
    → mapUser(user)
      → Transforms raw row to User object
    → getPasswordVersion(user.password)
      → Computes current password version
    → Compare pwdv from JWT vs computed pwdv
      → Mismatch → return null (password changed)
    → Return User
```

**Failure points (all return null):**

1. No `Authorization` header
2. Header is not `Bearer <token>` format
3. JWT signature invalid
4. JWT expired
5. JWT issuer mismatch (if configured)
6. Missing `sub`, `ctx`, or `pwdv` claims
7. Context binding mismatch (different User-Agent)
8. Database timeout (after 3 retries)
9. User not found in database
10. User has no password (corrupted state)
11. Password version mismatch (password changed since token issuance)

**`requireUser(): Promise<User>`**

```typescript
const user = await getUser();
if (!user) {
	throw error(401, 'Unauthorized');
}
return user;
```

Throws SvelteKit `HttpError` with status 401. The error propagates to the client as a 401 response.

**`requireRole(roles: Array<User['role']>): Promise<User>`**

```typescript
const user = await requireUser();
if (!roles.includes(user.role)) {
	throw error(403, 'Forbidden');
}
return user;
```

**Usage pattern in remote functions:**

```typescript
export const getEnrollmentConflictAudit = query(conflictAuditSchema, async (filters) => {
	const user = await requireRole(['ADMIN', 'LECTURER']);
	// ... proceed with audit
});
```

#### 8.1.8 Session Lifecycle

**`setSession(userId, passwordHash): Promise<{ accessToken: string }>`**

Creates a new authenticated session. This is called after successful login.

**Execution flow:**

1. **Generate refresh token:**

   ```typescript
   const refreshToken = createOpaqueToken(); // 48 random bytes
   const refreshTokenHash = hashRefreshToken(refreshToken);
   const contextBinding = getRequestContextBinding();
   const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
   ```

2. **Database transaction:**

   ```sql
   -- Delete existing tokens for this user + context (other devices unaffected)
   DELETE FROM refresh_tokens WHERE user_id = ? AND context_binding = ?

   -- Insert new token
   INSERT INTO refresh_tokens (id, user_id, token_hash, context_binding, expires_at)
   VALUES (?, ?, ?, ?, ?)
   ```

3. **Set cookie:** `setRefreshTokenCookie(refreshToken)`

4. **Sign access token:** `signAccessToken(userId, passwordHash)`

5. **Return:** `{ accessToken }`

**Why context-scoped deletion?** If a user logs in on their laptop, we delete only the laptop's previous tokens (same context binding). Their phone session (different context binding) remains valid. This prevents session fixation while supporting multi-device usage.

**`refreshSession(): Promise<{ accessToken: string; user: User } | null>`**

Rotates the refresh token and issues a new access token. Called by `POST /auth/refresh`.

**Execution flow:**

1. **Read cookie:** `getRefreshTokenFromCookies()`
   - Iterates all known cookie names
   - Returns the first non-empty value
   - If none found → clear cookies → return null

2. **Hash token:** `hashRefreshToken(refreshToken)`

3. **Database transaction with `FOR UPDATE`:**

   ```sql
   SELECT id, user_id, token_hash, context_binding, expires_at
   FROM refresh_tokens
   WHERE token_hash = ?
   LIMIT 1
   FOR UPDATE
   ```

   The `FOR UPDATE` lock prevents race conditions where two concurrent refresh requests for the same token both succeed.

4. **Validate token row:**
   - Exists? → continue
   - Expired? → `DELETE` → return null
   - Context mismatch? → return null

5. **Load user:** `selectUserById(connection, userId)`
   - Exists? → continue
   - Has password? → continue
   - No password? → `DELETE` token → return null

6. **Rotate (delete old, insert new):**

   ```sql
   DELETE FROM refresh_tokens WHERE id = <old-id>;
   INSERT INTO refresh_tokens (...) VALUES (...);  -- new token
   ```

7. **Sign new access token:** `signAccessToken(userId, user.password)`

8. **Set new cookie:** `setRefreshTokenCookie(newRefreshToken)`

9. **Return:** `{ accessToken, user }`

**Failure handling:** Any failure calls `clearRefreshTokenCookies()` and returns `null`. This forces the client to re-authenticate with username/password.

**Race condition safety:** The `FOR UPDATE` lock ensures that even if two tabs simultaneously refresh with the same token, only one succeeds. The second tab's `SELECT ... FOR UPDATE` waits for the first transaction to complete, then finds no matching row (deleted by first tab), and returns null. The second tab then triggers a login redirect.

**`clearSession(): Promise<void>`**

Logs out the current user:

1. Read refresh token from cookies
2. If found: `DELETE FROM refresh_tokens WHERE token_hash = ?`
3. Clear all refresh token and legacy session cookies

**Note:** Does not invalidate access tokens (they're stateless JWTs). The access token will expire naturally within 5 minutes. For immediate revocation, use `revokeRefreshTokensForUser()`.

**`revokeRefreshTokensForUser(userId: string): Promise<void>`**

```sql
DELETE FROM refresh_tokens WHERE user_id = ?
```

Deletes all refresh tokens for a user. Used when:

- Admin resets a user's password
- Admin deletes a user account
- Security incident response

**Effect:** All devices for this user are logged out immediately. The next refresh attempt on any device will fail, and the user must re-authenticate.

#### 8.1.9 Authentication Flow

**`login(email, password): Promise<AuthenticatedLoginResult | null>`**

Verifies user credentials using Argon2.

**Execution flow:**

1. Query user by email using `selectUsers` with `where: [['email', '=', email]]`
2. If no user found → return `null`
3. If user found but no password → return `null`
4. Call `verify(password, user.password)` from `@node-rs/argon2`
5. If verification fails → return `null`
6. Return `{ user: mapUser(user), passwordHash: user.password }`

**Timing attacks:** The function is not constant-time. However:

- Argon2 verification is inherently slow (~50-100ms)
- Network latency dominates (>20ms for most connections)
- The `find()` query time is not correlated with password correctness
- A timing attack would require thousands of measurements, which is impractical over a network

**`loginAndSetSession(email, password): Promise<{ success: true; user: User; accessToken: string } | null>`**

Orchestrates the complete login flow:

```typescript
const result = await login(email, password);
if (!result) return null;

const { accessToken } = await setSession(result.user.id, result.passwordHash);
return { success: true, user: result.user, accessToken };
```

**Side effects:**

- Writes to `refresh_tokens` table (transaction)
- Sets `refresh_token` cookie
- Does NOT set the access token cookie (sent in JSON response body)

#### 8.1.10 Internal Helpers

**`getAccessTokenFromRequest(): string | null`**

Parses the `Authorization` header:

```typescript
const authorization = request.headers.get('authorization');
if (!authorization) return null;

const [scheme, token] = authorization.split(' ');
if (scheme !== 'Bearer' || !token) return null;

return token;
```

**Limitations:** Does not handle multiple spaces, leading/trailing whitespace, or multiple authorization values. The client sends exactly `Authorization: Bearer <token>`.

**`getRefreshTokenFromCookies(): string | null`**

```typescript
const { cookies, url } = getRequestEvent();
for (const cookieName of getRefreshTokenCookieNames(url)) {
	const token = cookies.get(cookieName);
	if (token) return token;
}
return null;
```

Iterates all known refresh token cookie names in priority order. Returns the first non-empty value. This handles cookie name migrations gracefully.

---

### 8.2 Client Authentication (`src/lib/client/auth.ts`)

The client auth module manages the in-memory access token lifecycle and transparently injects it into all same-origin `fetch` requests. It operates as a self-contained state machine with proactive refresh, automatic retry on 401, deduplicated concurrent refreshes, and tab visibility recovery.

#### 8.2.1 Module State

| Symbol                  | Type                                    | Initial | Purpose                                                                                                                                                                 |
| ----------------------- | --------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accessToken`           | `string \| null`                        | `null`  | Current in-memory access token. **Never persisted** to localStorage, cookies, or sessionStorage. Lost on page reload.                                                   |
| `refreshPromise`        | `Promise<string \| null> \| null`       | `null`  | Deduplicates concurrent refresh requests. Multiple simultaneous calls to `ensureAccessToken()` all await the same promise.                                              |
| `fetchInstalled`        | `boolean`                               | `false` | Prevents double-intercepting `window.fetch` if the module is hot-reloaded or imported multiple times.                                                                   |
| `refreshUnavailable`    | `boolean`                               | `false` | Circuit-breaker flag. Set to `true` when the refresh endpoint returns a definitive rejection (401/403/204). Prevents hammering the server with doomed refresh requests. |
| `refreshUnavailableAt`  | `number`                                | `0`     | Timestamp (ms since epoch) when `refreshUnavailable` was set. Used with the 30-second cooldown to allow occasional retry.                                               |
| `proactiveRefreshTimer` | `ReturnType<typeof setTimeout> \| null` | `null`  | Timer handle for the next proactive refresh. Cleared and reset on every successful token acquisition.                                                                   |

**State persistence:** None. All state is held in module-level variables. A full page reload resets everything. The user must re-authenticate (or the refresh cookie must re-establish the session) after reload.

#### 8.2.2 State Machine

The client auth module can be modeled as a state machine with four states:

```
┌─────────────┐     login success      ┌──────────────┐
│   NO_TOKEN  │ ─────────────────────→ │    HAS_TOKEN │
└─────────────┘                        └──────────────┘
       ↑                                    │
       │                                    │ token expires
       │                            ┌───────▼────────┐
       │                            │ REFRESH_FAILED │
       └────────────────────────────│  (cooldown)    │
            cooldown expires         └────────────────┘
```

| State            | `accessToken` | `refreshUnavailable` | Behavior                                       |
| ---------------- | ------------- | -------------------- | ---------------------------------------------- |
| `NO_TOKEN`       | `null`        | `false`              | Will attempt refresh on next request           |
| `HAS_TOKEN`      | `<string>`    | `false`              | Uses cached token; proactive refresh scheduled |
| `REFRESH_FAILED` | `null`        | `true`               | Blocked for 30s; returns null to callers       |
| `RECOVERING`     | `null`        | `false`              | Cooldown expired; will attempt refresh again   |

State transitions are triggered by:

- **Login success** → `setAccessToken()` → `HAS_TOKEN`
- **Token expiry** → `verifyAccessToken()` rejects → automatic refresh attempt
- **Refresh rejects** (401/403/204) → `REFRESH_FAILED`
- **Cooldown expires** → `handleVisibilityChange()` or next `ensureAccessToken()` → `RECOVERING`
- **Logout** → `clearAccessToken()` → `NO_TOKEN`

#### 8.2.3 Exported Functions

**`setAccessToken(token: string | null): void`**

```typescript
export function setAccessToken(token: string | null) {
	accessToken = token;
	refreshUnavailable = token == null;
}
```

**Parameters:**
| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `token` | `string \| null` | The access token from the server login response, or `null` to clear |

**Side effects:**

- Sets `accessToken`
- Clears `refreshUnavailable` flag (if token is non-null)
- Does NOT schedule proactive refresh (login flow handles this separately)

**Called by:** Login form success handler (`+page.svelte` after `loginUser` returns).

**`clearAccessToken(): void`**

```typescript
export function clearAccessToken() {
	accessToken = null;
	refreshUnavailable = true;
}
```

**Side effects:**

- Clears `accessToken`
- Sets `refreshUnavailable = true` (prevents automatic refresh attempts)
- Does NOT clear the refresh cookie (that's the server's responsibility via `clearSession()`)

**Called by:** Logout form success handler.

**`ensureAccessToken(force = false): Promise<string | null>`**

The primary token acquisition function. All application code that needs a token (including the fetch interceptor) calls this.

**Parameters:**
| Parameter | Type | Default | Description |
| --------- | ---- | ------- | ----------- |
| `force` | `boolean` | `false` | If true, bypasses the cached token and forces a refresh |

**Returns:** The current access token string, or `null` if no session exists.

**Execution logic:**

```
if (!browser) return null;
if (!force && accessToken) return accessToken;
if (refreshUnavailable && Date.now() - refreshUnavailableAt < 30000) return null;
if (refreshPromise) return refreshPromise;
refreshUnavailable = false;
refreshPromise = requestNewAccessToken().finally(() => { refreshPromise = null; });
return refreshPromise;
```

**Deduplication guarantee:** If two components simultaneously call `ensureAccessToken()` while no token exists, both receive the same `refreshPromise`. The refresh endpoint is called exactly once.

**Server-side safety:** Returns `null` immediately when `!browser`. This prevents server-side rendering from attempting to call the refresh endpoint.

#### 8.2.4 Internal Functions

**`requestNewAccessToken(): Promise<string | null>`**

Calls the refresh endpoint and handles all response codes.

**Request:**

```typescript
POST / auth / refresh;
Credentials: same - origin;
Accept: application / json;
```

**Response handling:**

| Status             | Meaning                               | Action                                                                         |
| ------------------ | ------------------------------------- | ------------------------------------------------------------------------------ |
| `200 OK`           | Session valid, new token issued       | Parse `accessToken` from JSON, store it, schedule proactive refresh, return it |
| `204 No Content`   | No active session (no refresh cookie) | Set `refreshUnavailable = true`, record timestamp, return `null`               |
| `401 Unauthorized` | Invalid/expired refresh token         | Set `refreshUnavailable = true`, record timestamp, return `null`               |
| `403 Forbidden`    | Context mismatch or revoked           | Set `refreshUnavailable = true`, record timestamp, return `null`               |
| Other 4xx/5xx      | Transient error                       | Do NOT set `refreshUnavailable` (allows retry), return `null`                  |

**Why distinguish 401/403/204 from other errors?** These status codes indicate definitive session rejection. Other errors (500, 502, 503, network timeout) might be transient, so we allow immediate retry.

**`scheduleProactiveRefresh(): void`**

```typescript
function scheduleProactiveRefresh() {
	if (!browser) return;
	if (proactiveRefreshTimer) clearTimeout(proactiveRefreshTimer);
	proactiveRefreshTimer = setTimeout(
		() => {
			void ensureAccessToken(true); // force refresh
		},
		4 * 60 * 1000
	); // 4 minutes
}
```

**Rationale:** The access token expires in 5 minutes. By refreshing at 4 minutes, we keep a 1-minute safety margin for clock skew, network latency, and server processing time.

**Idempotency:** Called on every successful token acquisition. The timer is always cleared before being reset, so multiple overlapping calls do not create multiple timers.

**`handleVisibilityChange(): void`**

```typescript
function handleVisibilityChange() {
	if (!browser || document.hidden) return;

	// Cooldown expired → allow retry
	if (refreshUnavailable && Date.now() - refreshUnavailableAt >= 30000) {
		refreshUnavailable = false;
	}

	// No token and refresh available → try to get one
	if (!accessToken && !refreshUnavailable) {
		void ensureAccessToken();
	}
}
```

**Event listener:** Registered on `document.visibilitychange` by `installAuthFetch()`.

**Use cases:**

1. User switches away for >30 minutes → token expires → returns to tab → `handleVisibilityChange()` triggers refresh
2. User switches away during network outage → refresh fails → `refreshUnavailable` set → returns after 30s → cooldown expired → retry allowed
3. User has multiple tabs → one tab refreshes successfully → other tabs still have old token in memory → but the fetch interceptor handles 401 retry, so this is fine

#### 8.2.5 Fetch Interceptor

**`installAuthFetch(): void`**

Replaces `window.fetch` with an intercepting wrapper. Called automatically when the module loads (at the bottom: `installAuthFetch()`).

**Idempotency:**

```typescript
if (!browser || fetchInstalled) return;
fetchInstalled = true;
```

**Interceptor flow:**

```
window.fetch(input, init)
  → resolveUrl(input) → URL object
    → isRefreshRequest(url)?
      → YES → skip auth (pass through to nativeFetch)
      → NO → continue
    → shouldAttachAccessToken(url)?
      → NO (cross-origin) → pass through
      → YES → continue
  → baseRequest = new Request(input, init)
  → existingAuthorization = headers.has('authorization')
    → YES → pass through (custom auth header present)
    → NO → continue
  → token = accessToken || await ensureAccessToken()
    → token is null → send without auth
    → token exists → buildAuthorizedRequest(baseRequest, token)
  → response = await nativeFetch(authorizedRequest)
  → response.status === 401?
    → YES → attempt ONE retry:
      → refreshedToken = await ensureAccessToken(true)
      → refreshedToken === token → return original 401
      → refreshedToken is new → retry request
    → NO → return response
```

**Request classification:**

| URL Pattern                 | Classification     | Auth Attached?               | 401 Retry? |
| --------------------------- | ------------------ | ---------------------------- | ---------- |
| `/_app/remote/*`            | Same-origin remote | Yes                          | Yes        |
| `/auth/*`                   | Auth endpoint      | Yes (except `/auth/refresh`) | Yes        |
| `/api/*`                    | API endpoint       | Yes                          | Yes        |
| Cross-origin                | External           | No                           | No         |
| Already has `Authorization` | Custom auth        | No                           | No         |

**`buildAuthorizedRequest(baseRequest: Request, token: string): Request`**

```typescript
const headers = new Headers(baseRequest.headers);
headers.set('authorization', `Bearer ${token}`);
return new Request(baseRequest, { headers });
```

Clones the request to avoid mutating the original. The `Request` constructor copies all properties (method, body, mode, credentials, etc.) and overrides only the headers.

**`resolveUrl(input: RequestInfo | URL): URL`**

Normalizes inputs:

- `URL` → returned as-is
- `Request` → `new URL(input.url, window.location.origin)`
- `string` → `new URL(input, window.location.origin)`

All relative URLs are resolved against `window.location.origin`.

**`isRefreshRequest(url: URL): boolean`**

```typescript
return url.origin === window.location.origin && url.pathname === '/auth/refresh';
```

The refresh endpoint must not have an access token attached, because the server extracts the refresh token from the cookie, not the `Authorization` header. Attaching an expired access token could cause the server to reject the request before checking the cookie.

**`shouldAttachAccessToken(url: URL): boolean`**

```typescript
return url.origin === window.location.origin && !isRefreshRequest(url);
```

Only attaches tokens to same-origin requests. Cross-origin requests (e.g., external APIs, CDN assets) never receive the access token.

#### 8.2.6 401 Retry Behavior

The interceptor implements **exactly one** automatic retry on 401:

```typescript
if (existingAuthorization || response.status !== 401) {
	return response;
}

const refreshedToken = await ensureAccessToken(true);
if (!refreshedToken || refreshedToken === token) {
	return response; // Can't help; return original 401
}

response = await nativeFetch(buildAuthorizedRequest(baseRequest.clone(), refreshedToken));
return response;
```

**Why only one retry?** Prevents infinite loops. If the server consistently returns 401 even with a fresh token, something is fundamentally wrong (e.g., user deleted, role changed, server clock skew). The client should not keep retrying indefinitely.

**Why check `refreshedToken === token`?** If `ensureAccessToken(true)` returns the same token we just used, the token itself is valid but the server rejected it for some other reason. Retrying with the same token would fail again.

**What happens after a failed retry?** The 401 response is returned to the caller. For SvelteKit remote functions, this propagates as an error that the UI can catch and display (e.g., redirect to login).

#### 8.2.7 Error Recovery Matrix

| Scenario         | Client State             | Server Response | Client Action             | Result            |
| ---------------- | ------------------------ | --------------- | ------------------------- | ----------------- |
| Normal operation | `HAS_TOKEN`              | `200`           | Use token                 | Success           |
| Token expired    | `HAS_TOKEN`              | `401`           | Refresh, retry            | Success           |
| Refresh valid    | `HAS_TOKEN`              | `200` (refresh) | New token, retry          | Success           |
| Refresh expired  | `HAS_TOKEN`              | `204`           | Set unavailable           | Redirect to login |
| Session revoked  | `HAS_TOKEN`              | `401` (refresh) | Set unavailable           | Redirect to login |
| Server error     | `HAS_TOKEN`              | `500`           | Return error to caller    | Error UI          |
| Tab backgrounded | `HAS_TOKEN` → `NO_TOKEN` | —               | Visibility change handler | Refresh or login  |
| Logout clicked   | `HAS_TOKEN`              | `200` (logout)  | Clear token               | Login page        |
| Password changed | `HAS_TOKEN`              | `401` (refresh) | Set unavailable           | Redirect to login |

---

### 8.3 Database Layer (`src/lib/server/db.ts`)

The database module wraps `mysql2/promise` with connection pooling, automatic retry with exponential backoff, graceful pool recycling without dropping in-flight queries, cursor pagination helpers, and query limit enforcement. It is designed to survive transient MariaDB outages, connection pool exhaustion, and network partitions.

#### 8.3.1 Design Goals

| Goal                    | Implementation                                            |
| ----------------------- | --------------------------------------------------------- |
| Transparent failover    | Proxy pattern allows pool swap without restarting the app |
| No query loss           | Retired pools get a 5-second grace period before closing  |
| Bounded retry           | Max 3 retries with linear backoff (300ms, 600ms, 900ms)   |
| Prevent runaway queries | Hard limit of 5000 rows per list query                    |
| Transaction safety      | `withTransaction()` handles commit/rollback/release       |

#### 8.3.2 Type Definitions

**`LimitedListResult<T>`**

```typescript
export type LimitedListResult<T> = {
	items: T[]; // Visible items (at most `limit`)
	limit: number; // The applied limit
	hasMore: boolean; // True if more items exist beyond `items`
	nextCursor: string | null; // Cursor for the next page, or null
};
```

**`RowDataPacket` / `ResultSetHeader`**

Re-exported from `mysql2/promise` for convenience. `RowDataPacket` is the base interface for SELECT results; `ResultSetHeader` is returned for INSERT/UPDATE/DELETE.

#### 8.3.3 Constants

| Constant                   | Value   | Source                        | Purpose                                      |
| -------------------------- | ------- | ----------------------------- | -------------------------------------------- |
| `MAX_RETRIES`              | `3`     | Hardcoded                     | Maximum retry attempts for timeout errors    |
| `RETRY_DELAY_MS`           | `300`   | Hardcoded                     | Base delay; actual delay = `delay * attempt` |
| `RETIRED_POOL_GRACE_MS`    | `5000`  | Hardcoded                     | Grace period before closing a recycled pool  |
| `DEFAULT_LIST_QUERY_LIMIT` | `120`   | `env.DB_LIST_QUERY_LIMIT`     | Default page size                            |
| `MAX_LIST_QUERY_LIMIT`     | `5000`  | `env.DB_MAX_LIST_QUERY_LIMIT` | Hard ceiling on page size                    |
| `CONNECT_TIMEOUT_MS`       | `10000` | `env.DB_CONNECT_TIMEOUT`      | Connection timeout in ms                     |

#### 8.3.4 Connection Pool Architecture

**Pool lifecycle:**

```
App starts
  → ensurePool() called lazily
    → createBasePool() creates mysql2 Pool
      → pool stored in module-level `pool` variable
  → getPool() returns Proxy
    → Proxy.get() delegates to current `pool`

Network error / timeout
  → retryRead() catches error
    → recyclePool() called
      → createBasePool() creates NEW Pool
      → old pool moved to `retiredPools` Set
      → 5s timer starts
        → old pool.end() called
        → old pool removed from Set
```

**`getPool(): Pool`**

Returns a `Proxy` object that dynamically delegates to the current active pool. This is the primary interface used by all database code.

**Why a Proxy?** Direct pool references would become stale after `recyclePool()` creates a new pool. The Proxy ensures all callers automatically use the newest pool without code changes.

**Proxy behavior by method:**

| Property        | Behavior                                                 |
| --------------- | -------------------------------------------------------- |
| `query`         | Directly calls `ensurePool().query(...)`                 |
| `execute`       | Directly calls `ensurePool().execute(...)`               |
| `getConnection` | Wraps with `withRetry()`, recycles pool on timeout       |
| `end`           | Clears current pool, closes all retired pools            |
| _(other)_       | Dynamically bound to current pool via `bindPoolMethod()` |

**`ensurePool(): Pool`**

```typescript
function ensurePool(): Pool {
	if (!pool) {
		pool = createBasePool();
	}
	return pool;
}
```

Lazy initialization. The pool is not created until the first database access. This avoids unnecessary connections during server startup or static page generation.

**`createBasePool(): Pool`**

Creates a `mysql2/promise` pool with these options:

```typescript
{
  host: env.DB_HOST || 'localhost',
  user: env.DB_USER || 'root',
  password: env.DB_PASSWORD || '',
  database: env.DB_NAME || 'akademik_db',
  port: parseInt(env.DB_PORT || '3306'),
  timezone: '+00:00',           // All dates in UTC; app handles conversion
  waitForConnections: true,     // Queue requests when pool is exhausted
  connectionLimit: 200,         // Max simultaneous connections
  maxIdle: 200,                 // Max idle connections to keep
  idleTimeout: 60000,           // Close idle connections after 60s
  queueLimit: 0,                // 0 = unlimited queue (use with caution)
  enableKeepAlive: true,        // TCP keepalive
  keepAliveInitialDelay: 10000, // 10s before first keepalive probe
  connectTimeout: 10000         // 10s connection timeout
}
```

**`recyclePool(): Promise<void>`**

Gracefully replaces the current pool without dropping in-flight queries.

**Execution:**

1. If already recycling (`recyclePromise` exists), await it and return
2. Create a new pool and assign to `pool`
3. Add the old pool to `retiredPools` Set
4. Schedule a 5-second timer
5. When timer fires: `stalePool.end()` and remove from Set

**Why 5 seconds?** Gives in-flight queries on the old pool time to complete. `mysql2/promise` pool `.end()` waits for all queued queries to finish before closing connections. The grace period is a safety buffer.

**Thread safety:** Under Bun's single-threaded event loop, `recyclePool()` is naturally atomic. No locks are needed.

#### 8.3.5 Retry Logic

**`withRetry<T>(fn, onRetry?): Promise<T>`**

Generic retry wrapper with linear backoff.

**Parameters:**
| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `fn` | `() => Promise<T>` | The operation to retry |
| `onRetry` | `(err, attempt) => void` | Optional callback before each retry |

**Retry schedule:**

| Attempt     | Delay | Total elapsed (worst case) |
| ----------- | ----- | -------------------------- |
| 1 (initial) | 0ms   | 0ms                        |
| 2           | 300ms | 300ms                      |
| 3           | 600ms | 900ms                      |
| 4 (final)   | 900ms | 1800ms                     |

**Delay formula:** `RETRY_DELAY_MS * attempt`

**Why linear, not exponential?** At 3 retries max, the difference is negligible. Linear backoff is simpler and more predictable for debugging.

**`retryRead<T>(fn): Promise<T>`**

Convenience wrapper: `withRetry(fn, () => recyclePool())`.

Used for all read operations. If a timeout occurs, the pool is recycled before the retry attempt. This handles scenarios where the pool's connections have all become stale (e.g., MariaDB restarted, network partition healed).

**`isTimeoutError(err): boolean`**

Detects retryable errors:

| Error                              | Code                                   | Retryable? |
| ---------------------------------- | -------------------------------------- | ---------- |
| Pool is closed                     | Message match                          | Yes        |
| ETIMEDOUT                          | `'ETIMEDOUT'`                          | Yes        |
| ECONNRESET                         | `'ECONNRESET'`                         | Yes        |
| ECONNREFUSED                       | `'ECONNREFUSED'`                       | Yes        |
| EPIPE                              | `'EPIPE'`                              | Yes        |
| PROTOCOL_CONNECTION_LOST           | `'PROTOCOL_CONNECTION_LOST'`           | Yes        |
| PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR | `'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR'` | Yes        |
| SyntaxError                        | —                                      | No         |
| Foreign key violation              | —                                      | No         |
| Unique constraint violation        | —                                      | No         |

#### 8.3.6 Transactions

**`withTransaction<T>(fn): Promise<T>`**

Executes a function inside a database transaction.

**Parameters:**
| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `fn` | `(conn: PoolConnection) => Promise<T>` | The transaction body |

**Execution flow:**

1. `const conn = await getConnection()` — gets a connection from the pool
2. `await conn.beginTransaction()` — starts transaction
3. `const result = await fn(conn)` — executes user code
4. `await conn.commit()` — commits if no error
5. `conn.release()` — releases connection back to pool

**Error handling:**

- If `fn()` throws: `await conn.rollback()` then re-throw
- In `finally`: always `conn.release()` (even if commit/rollback failed)

**Usage example:**

```typescript
await withTransaction(async (connection) => {
  await connection.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  await connection.query('INSERT INTO refresh_tokens (...) VALUES (...)', [...]);
});
```

**Isolation level:** Uses MariaDB default (`REPEATABLE READ`). For operations that need stricter isolation, set it inside `fn`:

```typescript
await conn.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
```

#### 8.3.7 Pagination Helpers

**`getListQueryLimit(requestedLimit?): number`**

Clamps requested limits to a safe range.

```typescript
export function getListQueryLimit(requestedLimit?: number): number {
	if (requestedLimit == null || !Number.isFinite(requestedLimit) || requestedLimit <= 0) {
		return DEFAULT_LIST_QUERY_LIMIT; // 120
	}
	return Math.min(MAX_LIST_QUERY_LIMIT, Math.trunc(requestedLimit));
}
```

**Examples:**
| Input | Output | Reason |
| ----- | ------ | ------ |
| `undefined` | `120` | Default |
| `50` | `50` | Within bounds |
| `5000` | `5000` | At ceiling |
| `10000` | `5000` | Clamped to ceiling |
| `0` | `120` | Invalid, use default |
| `-5` | `120` | Invalid, use default |
| `NaN` | `120` | Invalid, use default |
| `3.7` | `3` | Truncated |

**`getListQueryCursor(requestedCursor?): string | undefined`**

Normalizes cursor input:

```typescript
export function getListQueryCursor(requestedCursor?: string | null): string | undefined {
	const trimmed = requestedCursor?.trim();
	return trimmed ? trimmed : undefined;
}
```

Converts empty strings, whitespace-only strings, and `null` to `undefined`.

**`toLimitedListResult<T>(items, limit, getCursor): LimitedListResult<T>`**

Converts a raw item array into a paginated result.

**Parameters:**
| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `items` | `T[]` | Raw query results (may contain `limit + 1` items) |
| `limit` | `number` | Maximum items to show |
| `getCursor` | `(item: T) => string \| null \| undefined` | Extracts cursor from an item |

**Logic:**

1. `visibleItems = items.slice(0, limit)`
2. `hasMore = items.length > limit` (the `+1` item indicates more exist)
3. `nextCursor = hasMore ? getCursor(lastVisibleItem) : null`

**Why `limit + 1` query pattern?** The query requests `limit + 1` rows. If `limit + 1` rows are returned, we know there's a next page. We slice to `limit` for display and use the last row as the cursor.

**`mergeLimitedListResult<T>(resultSets, limit, getKey): LimitedListResult<T>`**

Merges multiple sorted result arrays, deduplicates, re-sorts, and paginates.

**Use case:** When a single query cannot serve a list efficiently. For example, combining results from multiple filtered subqueries.

**Algorithm:**

1. Merge all arrays into a single list
2. Deduplicate using `getKey(item)` and a `Set`
3. Sort by `getKey` using `localeCompare`
4. Slice to `limit + 1`
5. Apply `toLimitedListResult()`

**Complexity:** O(n log n) where n is total items across all result sets. Acceptable for small-to-medium result sets.

#### 8.3.8 Connection Lifecycle

**`getConnection(): Promise<PoolConnection>`**

Gets a connection from the pool via the proxy. The proxy wraps `getConnection()` with `withRetry()` and `recyclePool()`:

```typescript
getConnection: () =>
	withRetry(
		() => ensurePool().getConnection(),
		() => recyclePool()
	);
```

**`closePool(): Promise<void>`**

Closes all pools:

1. If `poolProxy` exists, call `poolProxy.end()`
2. The proxy's `end()` handler clears `pool`, collects all retired pools, and calls `end()` on each

**Called by:** Graceful shutdown hooks (if configured). Currently not explicitly called in the app; Bun process exit closes connections forcefully.

#### 8.3.9 Module-Level State

| Symbol           | Type                    | Purpose                                        |
| ---------------- | ----------------------- | ---------------------------------------------- |
| `pool`           | `Pool \| null`          | Current active pool                            |
| `poolProxy`      | `Pool \| null`          | The Proxy object returned by `getPool()`       |
| `retiredPools`   | `Set<Pool>`             | Pools scheduled for closure after grace period |
| `recyclePromise` | `Promise<void> \| null` | Deduplicates concurrent recycle operations     |

- `end()` → closes the current pool and all retired pools.
- All other methods → dynamically bound to the current pool.

The proxy pattern means application code never holds a stale pool reference. When `recyclePool()` creates a new pool, the proxy automatically delegates to it.

**`ensurePool()`**

Lazily creates the pool on first access.

**`createBasePool()`**

Creates a `mysql2/promise` pool with these options:

- `connectionLimit`: 200 (configurable via `DB_CONNECTION_LIMIT`)
- `maxIdle`: 200
- `idleTimeout`: 60,000ms
- `queueLimit`: 0 (unbounded queue)
- `enableKeepAlive: true`
- `keepAliveInitialDelay`: 10,000ms
- `connectTimeout`: 10,000ms
- `timezone: '+00:00'` (all dates handled in UTC; application converts to local time)

**`recyclePool()`**

Gracefully replaces the current pool:

1. If already recycling, await the existing promise.
2. Create a new pool and assign it to `pool`.
3. Add the old pool to `retiredPools`.
4. After a 5-second grace period, close the old pool and remove it from `retiredPools`.

This is called automatically by `retryRead()` when a timeout error occurs. The grace period allows in-flight queries on the old pool to complete before connections are forcibly closed.

**`getConnection()`**

Gets a connection from the pool via `getPool().getConnection()`. The proxy wraps this with retry logic.

**`withTransaction(fn)`**

Executes a function inside a database transaction:

1. Gets a connection.
2. Begins transaction.
3. Executes `fn(connection)`.
4. On success: commits and returns result.
5. On failure: rolls back and re-throws.
6. In `finally`: releases the connection.

Used by `setSession()`, `refreshSession()`, and any multi-step write that must be atomic.

**`closePool()`**

Closes the current pool and all retired pools. Used in graceful shutdown hooks.

#### 8.3.4 Retry Logic

**`withRetry(fn, onRetry?)`** _(exported)_

Generic retry wrapper with exponential-ish backoff:

- Retries up to 3 times.
- Only retries `isTimeoutError()` conditions.
- Delay = `RETRY_DELAY_MS * attempt` (300ms, 600ms, 900ms).
- Calls optional `onRetry` callback before each retry.

**`retryRead(fn)`** _(exported)_

Convenience wrapper: `withRetry(fn, () => recyclePool())`. Used for read operations that should recycle the pool on timeout.

**`isTimeoutError(err)`**

Detects retryable database errors:

- `Pool is closed.`
- `ETIMEDOUT`, `ECONNRESET`, `ECONNREFUSED`, `EPIPE`
- `PROTOCOL_CONNECTION_LOST`, `PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR`

#### 8.3.5 Pagination Helpers

**`getListQueryLimit(requestedLimit?)`** _(exported)_

Clamps requested limits to `[1, MAX_LIST_QUERY_LIMIT]`. Returns `DEFAULT_LIST_QUERY_LIMIT` for invalid inputs. This prevents unbounded queries that could crash the server.

**`getListQueryCursor(requestedCursor?)`** _(exported)_

Normalizes cursor input: trims whitespace, returns `undefined` for empty strings.

**`toLimitedListResult(items, limit, getCursor)`** _(exported)_

Converts a raw item array into `LimitedListResult<T>`:

1. Slice to `limit` items.
2. Set `hasMore = items.length > limit`.
3. Compute `nextCursor` from the last visible item via `getCursor()`.

This is the standard pagination wrapper used by all list endpoints.

**`mergeLimitedListResult(resultSets, limit, getKey)`** _(exported)_

Merges multiple sorted result arrays (e.g. from parallel queries), deduplicates by key, re-sorts, and applies pagination.

Used when a single query cannot efficiently serve a list and multiple filtered queries must be combined (e.g. union-like operations).

---

### 8.4 Academic Utilities (`src/lib/app/academic.ts`)

Shared domain logic for scheduling, conflict detection, room availability, and formatting. This module contains no server-side code and no Svelte dependencies — it is pure TypeScript that can be unit tested independently.

#### 8.4.1 Type Definitions

**`AppRole`**

```typescript
export type AppRole = 'ADMIN' | 'LECTURER' | 'STUDENT';
```

**`ScheduleCard`**

```typescript
export type ScheduleCard = {
	id: string;
	day: 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU';
	course: string; // Course name
	lecturer: string; // Lecturer name
	room: string; // Room name
	student: string; // Student name
	semester: string;
	academicYear: string;
	startLabel: string; // Formatted time, e.g. "08:00"
	endLabel: string; // Formatted time, e.g. "10:00"
	startMinutes: number; // Minutes since midnight
	endMinutes: number;
	durationMinutes: number; // endMinutes - startMinutes
	hasConflict: boolean; // Set by buildScheduleCards()
	conflictGroupId: string | null;
	conflictTone: number | null; // Index into CONFLICT_TONES
	original: SelectEnrollmentsResult; // Raw database row
};
```

**`RoomMetric`**

```typescript
export type RoomMetric = {
	id: string;
	name: string;
	type: string;
	capacity: number;
	hasProjector: boolean;
	hasAC: boolean;
	utilizationPercent: number; // 0-100
	scheduledBlocks: number;
	occupiedMinutes: number;
	nextUse: string; // Human-readable "Day, HH:mm"
	isAvailableNow: boolean;
	conflictCount: number;
	currentCourse: string;
	nextUseDay?: Day | null;
	nextUseStartTime?: string | null;
	nextUseCourse?: string | null;
};
```

#### 8.4.2 Constants

| Constant              | Value                                                    | Purpose                                                 |
| --------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| `DAY_ORDER`           | `['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU']` | Canonical day ordering for schedules and calendar grids |
| `DAY_LABELS`          | `{ SENIN: 'Senin', SELASA: 'Selasa', ... }`              | Display labels for days                                 |
| `CONFLICT_TONES`      | Array of 8 OKLCH color objects                           | Visual color palette for conflict groups                |
| `DAY_WINDOW_MINUTES`  | `780` (13 hours: 7:00–20:00)                             | Operating hours per day                                 |
| `WEEK_WINDOW_MINUTES` | `4680` (6 × 780)                                         | Total operating minutes per week                        |

**Conflict Tone Palette:**

Each tone is an object with OKLCH colors:

```typescript
{ surface: 'oklch(0.95 0.032 18)', border: 'oklch(0.8 0.092 18)', ink: 'oklch(0.53 0.168 18)' }
```

The 8 tones use hues spaced around the color wheel (18°, 72°, 145°, 205°, 255°, 300°, 340°, 32°) to maximize visual distinction. The low chroma (~0.03) and high lightness (~0.95) for surfaces ensures the colors are subtle and do not compete with the app's primary accent color.

#### 8.4.3 Time Conversion

**`toMinutes(value: Date | string | null | undefined, timezone: string): number`**

Converts a time value to minutes since midnight.

**Input handling:**

- `Date` object → formatted to `"HH:mm"` in target timezone, then parsed
- `string` (TIME or datetime) → formatted to `"HH:mm"`, then parsed
- `null` / `undefined` → returns `0`

**Implementation:**

```typescript
const formatted = formatDateTime(value, 'time', timezone);
const [hours, minutes] = formatted.split(':').map(Number);
return hours * 60 + minutes;
```

**Edge cases:**

- MariaDB TIME strings like `'13:00:00.000'` are handled by `formatDateTime()`
- Dates before/after midnight are not clamped (not needed for schedule data)

**`formatTimeRange(start, end, timezone): string`**

```typescript
if (!start || !end) return 'Belum dijadwalkan';
return `${formatDateTime(start, 'time', timezone)} - ${formatDateTime(end, 'time', timezone)}`;
```

Returns `"Belum dijadwalkan"` (Not yet scheduled) if either value is missing.

#### 8.4.4 Schedule Card Building

**`buildScheduleCards(enrollments, timezone): ScheduleCard[]`**

Transforms raw enrollment rows into display-ready cards and detects visual conflicts using the union-find (disjoint set) algorithm.

**Phase 1: Card creation**

Filters out rows missing required fields, then maps each row:

```typescript
{
  id: item.id,
  day: item.schedule_day,
  course: item.course_name ?? 'Mata kuliah tanpa nama',
  lecturer: item.lecturer_name ?? 'Dosen belum diisi',
  room: item.class_room_name ?? 'Ruang belum diisi',
  student: item.student_name ?? 'Mahasiswa belum diisi',
  semester: item.semester ?? '-',
  academicYear: item.academic_year ?? '-',
  startLabel: formatDateTime(item.schedule_start_time, 'time', timezone),
  endLabel: formatDateTime(item.schedule_end_time, 'time', timezone),
  startMinutes: toMinutes(item.schedule_start_time, timezone),
  endMinutes: toMinutes(item.schedule_end_time, timezone),
  durationMinutes: Math.max(endMinutes - startMinutes, 0),
  hasConflict: false,
  conflictGroupId: null,
  conflictTone: null,
  original: item
}
```

**Phase 2: Union-Find initialization**

```typescript
const cardIndexById = new Map(cards.map((card, index) => [card.id, index]));
const parents = cards.map((_card, index) => index);
const ranks = cards.map(() => 0);
```

**Phase 3: Union-Find operations**

```typescript
const find = (index: number): number => {
	if (parents[index] === index) return index;
	parents[index] = find(parents[index]); // Path compression
	return parents[index];
};

const unite = (leftIndex: number, rightIndex: number) => {
	const leftRoot = find(leftIndex);
	const rightRoot = find(rightIndex);
	if (leftRoot === rightRoot) return;
	if (ranks[leftRoot] < ranks[rightRoot]) {
		parents[leftRoot] = rightRoot;
	} else if (ranks[leftRoot] > ranks[rightRoot]) {
		parents[rightRoot] = leftRoot;
	} else {
		parents[rightRoot] = leftRoot;
		ranks[leftRoot] += 1;
	}
};
```

**Phase 4: Conflict detection**

For each day, bucket cards by resource key (room, student, lecturer). For each bucket, sort by `startMinutes` and connect overlapping intervals:

```typescript
let componentRepresentative = sortedIndexes[0];
let componentEnd = cards[componentRepresentative].endMinutes;

for (let position = 1; position < sortedIndexes.length; position++) {
	const currentIndex = sortedIndexes[position];
	const currentCard = cards[currentIndex];

	if (currentCard.startMinutes < componentEnd) {
		// Overlap detected
		unite(componentRepresentative, currentIndex);
		componentEnd = Math.max(componentEnd, currentCard.endMinutes);
	} else {
		// No overlap, start new component
		componentRepresentative = currentIndex;
		componentEnd = currentCard.endMinutes;
	}
}
```

**Phase 5: Group coloring**

After union-find, group cards by root:

```typescript
const groupsByRoot = new Map<number, ScheduleCard[]>();
for (let index = 0; index < cards.length; index++) {
	const root = find(index);
	const group = groupsByRoot.get(root) ?? [];
	group.push(cards[index]);
	groupsByRoot.set(root, group);
}

let conflictIndex = 0;
for (const group of groupsByRoot.values()) {
	if (group.length < 2) continue;
	const tone = conflictIndex;
	const groupId = `conflict-${conflictIndex + 1}`;
	for (const card of group) {
		card.hasConflict = true;
		card.conflictGroupId = groupId;
		card.conflictTone = tone;
	}
	conflictIndex++;
}
```

**Complexity analysis:**

| Phase              | Time             | Space      |
| ------------------ | ---------------- | ---------- |
| Card creation      | O(n)             | O(n)       |
| Union-Find init    | O(n)             | O(n)       |
| Per-day bucketing  | O(n)             | O(n)       |
| Per-bucket sorting | O(n log n) total | O(n)       |
| Union operations   | O(n α(n)) ≈ O(n) | O(1) extra |
| Group coloring     | O(n α(n)) ≈ O(n) | O(n)       |
| **Total**          | **O(n log n)**   | **O(n)**   |

Where α(n) is the inverse Ackermann function, effectively a small constant (< 5) for all practical n.

**Important distinction from server audit:**

| Aspect            | Client (`buildScheduleCards`)                 | Server (`auditEnrollmentConflicts`) |
| ----------------- | --------------------------------------------- | ----------------------------------- |
| Scope             | Only loaded cards                             | All enrollments in database         |
| Overlap detection | Interval overlap (08:00-10:00 vs 09:00-11:00) | Exact window match (same start+end) |
| Algorithm         | Union-Find with interval sweep                | SQL GROUP BY with covering index    |
| Data volume       | Hundreds of cards                             | Millions of rows                    |
| Purpose           | Visual highlighting                           | Authoritative correctness           |

**`schedulesOverlap(left, right): boolean`**

Pure interval overlap predicate:

```typescript
return (
	left.id !== right.id &&
	left.day === right.day &&
	left.startMinutes < right.endMinutes &&
	right.startMinutes < left.endMinutes
);
```

The `id !==` check prevents a card from overlapping with itself. This is used by the schedule builder to validate form input before submission.

#### 8.4.5 Conflict Styling

**`conflictToneVariables(conflictTone: number | null): string`**

```typescript
if (conflictTone == null) return '';
const tone = CONFLICT_TONES[conflictTone % CONFLICT_TONES.length];
return `--conflict-surface: ${tone.surface}; --conflict-border: ${tone.border}; --conflict-ink: ${tone.ink};`;
```

Returns a CSS custom property string. Applied to card elements via inline `style` attribute. The modulo ensures tone indices cycle through the 8-color palette indefinitely, even with more than 8 conflict groups.

#### 8.4.6 Room Utilities

**`groupCardsByDay(cards): { day, label, items }[]`**

Groups cards by `DAY_ORDER` and sorts each group by `startMinutes`:

```typescript
return DAY_ORDER.map((day) => ({
	day,
	label: DAY_LABELS[day],
	items: cards
		.filter((card) => card.day === day)
		.sort((left, right) => left.startMinutes - right.startMinutes)
}));
```

Returns exactly 6 entries (one per day), even if some days have no cards. This makes calendar grid rendering deterministic.

**`buildRoomMetrics(classrooms, cards, timezone, now): RoomMetric[]`**

Computes real-time metrics for each classroom.

**Per-room calculations:**

1. **Filter cards:** `roomCards = cards.filter(card => card.original.class_room_id === room.id)`
2. **Current block:** Find card where `card.day === currentDay && currentMinutes >= card.startMinutes && currentMinutes < card.endMinutes`
3. **Next use:** Find earliest future card (by day order, then start time)
4. **Occupied minutes:** `roomCards.reduce((sum, card) => sum + card.durationMinutes, 0)`
5. **Utilization:** `Math.min(100, Math.round((occupiedMinutes / WEEK_WINDOW_MINUTES) * 100))`
6. **Conflicts:** `roomCards.filter(card => card.hasConflict).length`

**`sortRoomsForRole(metrics, role): RoomMetric[]`**

Role-specific sorting:

| Role     | Primary sort                    | Secondary sort         | Rationale                                                         |
| -------- | ------------------------------- | ---------------------- | ----------------------------------------------------------------- |
| ADMIN    | `utilizationPercent` ↓          | `conflictCount` ↓      | Admins care about overused, conflicted rooms                      |
| LECTURER | `isAvailableNow` ↓ (true first) | `utilizationPercent` ↑ | Lecturers want available rooms; low utilization = more free slots |
| STUDENT  | `capacity` ↓                    | —                      | Students want the biggest room                                    |

**`occupancyCopy(role): { title: string }`**

Returns localized titles:

- ADMIN → `"Utilisasi ruang minggu ini"`
- LECTURER → `"Ruang kosong yang siap dipakai"`
- STUDENT → `"Ketersediaan ruang"`

**`availableRoomsForSlot(classrooms, cards, day, startMinutes, endMinutes, excludedCardId?): SelectClassRoomsResult[]`**

Filters rooms available during a specific time slot.

```typescript
const occupiedRoomIds = new Set<string>();
for (const card of cards) {
	if (excludedCardId && card.id === excludedCardId) continue;
	if (card.day !== day) continue;
	if (!(card.startMinutes < endMinutes && startMinutes < card.endMinutes)) continue;
	const roomId = card.original.class_room_id;
	if (roomId) occupiedRoomIds.add(roomId);
}
return classrooms.filter((room) => !room.id || !occupiedRoomIds.has(room.id));
```

**The `excludedCardId` parameter:** When editing an existing enrollment, the card representing the current assignment is excluded from the occupancy check. This allows the user to keep the current room if it's still valid.

#### 8.4.7 Formatting Helpers

**`beautifyRoomType(value: string | null | undefined): string`**

```typescript
if (!value) return 'Tidak diketahui';
return value
	.replaceAll('_', ' ')
	.toLowerCase()
	.replace(/(^|\s)\S/g, (part) => part.toUpperCase());
```

Examples:
| Input | Output |
| ----- | ------ |
| `REGULER` | `Reguler` |
| `LAB_KOMPUTER` | `Lab Komputer` |
| `LAB_BAHASA` | `Lab Bahasa` |
| `AUDITORIUM` | `Auditorium` |
| `null` | `Tidak diketahui` |

**`matchesText(value, query): boolean`**

Case-insensitive substring search. Empty queries match everything:

```typescript
if (!query.trim()) return true;
return (value ?? '').toLowerCase().includes(query.trim().toLowerCase());
```

**`formatMinutes(minutes: number): string`**

Formats minutes into Indonesian duration text:

```typescript
const hours = Math.floor(minutes / 60);
const remainder = minutes % 60;
if (!hours) return `${remainder} menit`;
if (!remainder) return `${hours} jam`;
return `${hours} jam ${remainder} menit`;
```

Examples:
| Input | Output |
| ----- | ------ |
| `45` | `45 menit` |
| `60` | `1 jam` |
| `90` | `1 jam 30 menit` |
| `150` | `2 jam 30 menit` |

---

### 8.5 Time Helpers (`src/lib/time-helpers.ts`)

Wrapper around `dayjs` with Indonesian locale, timezone support, and consistent formatting rules for database storage and UI display. All database timestamps are stored in UTC; all UI display is in `Asia/Jakarta` (WIB, UTC+7).

#### 8.5.1 Dayjs Configuration

```typescript
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(localeData);
dayjs.extend(duration);
import 'dayjs/locale/id';
```

| Plugin              | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `utc`               | Convert dates to UTC for storage             |
| `timezone`          | Parse and format in `Asia/Jakarta`           |
| `customParseFormat` | Parse `<input type="datetime-local">` values |
| `localeData`        | Indonesian month/day names                   |
| `duration`          | Duration calculations for time ranges        |

**Locale:** `id` (Indonesian) — month names like "Januari", "Februari", etc.

**Timezone:** `Asia/Jakarta` (UTC+7). Indonesia does not observe daylight saving time, so this offset is constant year-round.

#### 8.5.2 UTC Creation Functions

**`toUTCDate(date: Date | dayjs.Dayjs): Date`**

```typescript
return dayjs(date).utc().toDate();
```

Converts any date to UTC. Used before storing dates in MariaDB.

**`createUTCDate(year, month, day, hour, minute, second = 0): Date`**

```typescript
return new Date(Date.UTC(year, month, day, hour, minute, second, 0));
```

Creates a UTC Date from components. **Month is 0-indexed** (0 = January).

**`createUTCDateFromString(dateStr: string, timeStr: string): Date`**

```typescript
const [year, month, day] = dateStr.split('-').map(Number);
const [hour, minute] = timeStr.split(':').map(Number);
return createUTCDate(year, month - 1, day, hour, minute);
```

Parses `"YYYY-MM-DD"` and `"HH:mm"` strings. Used for schedule form inputs.

#### 8.5.3 Parsing Functions

**`hasExplicitTimezone(value: string): boolean`**

```typescript
return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
```

Detects whether a string contains an explicit timezone offset (e.g. `+07:00`, `Z`).

**`isTimeOnly(value: string): boolean`**

```typescript
return /^\d{1,2}:\d{2}(?::\d{2})?$/.test(value);
```

Detects MariaDB TIME strings like `"13:00:00"` or simple `"13:00"`.

**`parseISO(isoStr: string, sourceTimezone?: string): Date`**

Parses ISO datetime strings with timezone-aware handling.

**Logic:**

```typescript
if (!hasExplicitTimezone(isoStr) && sourceTimezone) {
	// datetime-local input: parse in source timezone, convert to UTC
	const parsed = dayjs.tz(isoStr, 'YYYY-MM-DDTHH:mm', sourceTimezone);
	if (parsed.isValid()) {
		return parsed.utc().toDate();
	}
}
// Has explicit timezone or no sourceTimezone: parse directly
return dayjs(isoStr).utc().toDate();
```

**Why special handling for datetime-local?** HTML `<input type="datetime-local">` returns strings like `"2025-08-15T08:00"` with no timezone offset. If we parse this directly with `dayjs()`, it uses the browser's local timezone, which might differ from `Asia/Jakarta`. By using `dayjs.tz()` with the explicit source timezone, we correctly interpret the user's intent and convert to UTC.

**Example:**
| Input | `sourceTimezone` | Result (UTC) |
| ----- | ---------------- | ------------ |
| `"2025-08-15T08:00"` | `"Asia/Jakarta"` | `2025-08-15T01:00:00.000Z` |
| `"2025-08-15T08:00+07:00"` | `"Asia/Jakarta"` | `2025-08-15T01:00:00.000Z` |
| `"2025-08-15T08:00Z"` | `"Asia/Jakarta"` | `2025-08-15T08:00:00.000Z` |

#### 8.5.4 Formatting Functions

**`formatDateTime(value, format = 'full', timezone = 'Asia/Jakarta'): string`**

The primary display formatting function.

**Input type detection:**

1. **TIME strings** (`isTimeOnly(value)`):

   ```typescript
   const [hours = '00', minutes = '00'] = value.split(':');
   const time = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
   const dayjsDate = dayjs.tz(`2000-01-01T${time}`, timezone);
   ```

   Uses a reference date (2000-01-01) because TIME values have no date component.

2. **Strings with explicit timezone**:

   ```typescript
   dayjs(value).tz(timezone);
   ```

3. **Strings without timezone**:

   ```typescript
   dayjs.tz(value, timezone);
   ```

4. **Date / Dayjs objects**:
   ```typescript
   dayjs(value).tz(timezone);
   ```

**Format modes:**

| Mode     | Output example            | Use case                      |
| -------- | ------------------------- | ----------------------------- |
| `'time'` | `"08:00"`                 | Schedule labels, time pickers |
| `'date'` | `"15 Agustus 2025"`       | Date displays                 |
| `'full'` | `"15 Agustus 2025 08:00"` | Full datetime displays        |

**MariaDB TIME handling edge case:**

MariaDB stores TIME as `"HH:MM:SS"` (or `"HH:MM:SS.000"`). When formatting for display:

- We only need hours and minutes
- Seconds are truncated (schedules use minute granularity)
- The reference date `2000-01-01` is arbitrary but ensures timezone conversion works correctly

**`formatDateTimeInput(value, timezone = 'Asia/Jakarta'): string`**

Formats a value for `<input type="datetime-local">`.

**TIME strings:**

```typescript
const [hours = '00', minutes = '00'] = value.split(':');
return `2000-01-01T${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
```

Returns `"2000-01-01THH:mm"` for TIME inputs. The reference date is required because `datetime-local` inputs need a date component.

**Other values:**

```typescript
return dayjs(value).tz(timezone).format('YYYY-MM-DDTHH:mm');
```

**`getDuration(startDate, endDate, format = 'full'): string`**

```typescript
const duration = dayjs.duration(dayjs(endDate).diff(dayjs(startDate)));
```

Returns formatted duration:

- `'short'` → `"HH:mm"` (e.g., `"02:30"`)
- `'full'` → `"DD HH:mm"` (e.g., `"01 02:30"`)
- `'simple'` → `"HH"` (e.g., `"2"`)

**`getTimeComponents(date, timezone): object`**

```typescript
{
	hours: number; // 0-23
	minutes: number; // 0-59
	day: number; // 1-31
	month: number; // 1-12
	year: number;
	dayOfWeek: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
}
```

**`dayOfWeek` mapping:**

| JavaScript `dayOfWeek` | Day       | `DAY_ORDER` index    |
| ---------------------- | --------- | -------------------- |
| 0                      | Sunday    | — (not in DAY_ORDER) |
| 1                      | Monday    | 0 (`SENIN`)          |
| 2                      | Tuesday   | 1 (`SELASA`)         |
| 3                      | Wednesday | 2 (`RABU`)           |
| 4                      | Thursday  | 3 (`KAMIS`)          |
| 5                      | Friday    | 4 (`JUMAT`)          |
| 6                      | Saturday  | 5 (`SABTU`)          |

Since `DAY_ORDER` starts with `SENIN` (Monday), the conversion is:

```typescript
const currentDay =
	dayOfWeek >= 1 && dayOfWeek <= DAY_ORDER.length ? DAY_ORDER[dayOfWeek - 1] : null;
```

Sunday has no schedule (universities are closed), so it maps to `null`.

---

### 8.6 Loading Interceptor (`src/lib/client/loading.svelte.ts`)

A lightweight global loading state tracker that intercepts `fetch` to show/hide a loading spinner during remote and API requests. It uses Svelte 5 runes (`$state`) for reactivity.

#### 8.6.1 Module State

| Symbol                 | Type      | Initial | Purpose                                                      |
| ---------------------- | --------- | ------- | ------------------------------------------------------------ |
| `pendingCount`         | `number`  | `0`     | Number of in-flight tracked requests. Reactive via `$state`. |
| `interceptorInstalled` | `boolean` | `false` | Prevents double installation on hot reload.                  |

#### 8.6.2 Exported Functions

**`getLoadingState(): { isLoading: boolean; count: number }`**

Returns a reactive object with getters:

```typescript
return {
	get isLoading() {
		return pendingCount > 0;
	},
	get count() {
		return pendingCount;
	}
};
```

**Usage in Svelte components:**

```svelte
<script>
	import { getLoadingState } from '$lib/client/loading.svelte';
	const loading = getLoadingState();
</script>

{#if loading.isLoading}
	<div class="spinner">Loading...</div>
{/if}
```

**`incrementLoading(): void`**

```typescript
pendingCount++;
```

**`decrementLoading(): void`**

```typescript
pendingCount = Math.max(0, pendingCount - 1);
```

The `Math.max(0, ...)` clamp prevents negative counts from race conditions (e.g., if a request completes after the interceptor was already uninstalled).

**`installLoadingInterceptor(): void`**

Replaces `window.fetch` with an intercepting wrapper.

**Idempotency:**

```typescript
if (!browser || interceptorInstalled) return;
interceptorInstalled = true;
```

**Request classification logic:**

```typescript
const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

const isRemote = url.includes('/_app/remote/');
const isApi =
	url.startsWith(window.location.origin) && (url.includes('/auth/') || url.includes('/api/'));
```

**Tracked requests:**

- SvelteKit remote function calls (`/_app/remote/*`)
- Auth endpoints (`/auth/*`)
- API endpoints (`/api/*`)

**Untracked requests:**

- Static assets (`/_app/immutable/*`)
- External APIs
- Same-origin non-API requests

**Interceptor behavior:**

```typescript
if (isRemote || isApi) {
	incrementLoading();
	try {
		return await nativeFetch(input, init);
	} finally {
		decrementLoading();
	}
}
return nativeFetch(input, init);
```

**Race condition safety:** Uses `try/finally` to ensure `decrementLoading()` is called even if the request throws. This prevents the spinner from getting stuck.

**Integration:** Called once in `+layout.svelte`:

```svelte
<script>
	import { installLoadingInterceptor } from '$lib/client/loading.svelte';
	installLoadingInterceptor();
</script>
```

---

## 9. Stress Testing & Benchmarking

### 9.1 Stress Seed (`stress-seed.ts`)

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

### 9.2 Benchmark Suite (`scripts/benchmark-suite.mjs`)

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

### 9.3 JMeter Plan (`performance/watum-benchmark.jmx`)

Alternative JMeter test plan with the same transaction mix.

---

## 10. Deployment & Operations

### 10.1 Runtime

### 10.2 Environment Variables

### 10.3 Coolify Deployment

### 10.4 Build & Preview

### 10.5 Database Maintenance

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

## 11. File Structure

```
watum/
├── src/
│   ├── routes/                          # SvelteKit routes (all views in +page.svelte)
│   │   ├── +page.svelte                 # Main dashboard (~12800 lines)
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

## 12. UI Entity Links & Accessibility

### 12.1 Clickable Entity Links

The application implements clickable entity links across all views to enable rapid navigation between related records. Any mention of a lecturer, student, course, room, grade, enrollment, faculty, or study program can be clicked to jump to that entity's list view.

#### Implementation Pattern

- **Navigation mechanism**: `activateView('viewId')` — switches the SPA to the target entity's tab
- **Element type**: `<span role="button" tabindex="0" class="entity-link">` with an `onclick` handler
- **Keyboard support**: `handleEntityLinkKeydown()` activates links on `Enter` or `Space`
- **Event handling**: Nested links call `e.stopPropagation()` to prevent triggering parent row-selection handlers
- **Styling**: `.entity-link` and `.editor-entity-link` use subtle underline affordances plus visible `:focus-visible` outlines

#### Coverage

Entity links are present in:

- **Dashboard** (`+page.svelte`): next schedule course → courses, room → classrooms
- **Calendar detail panel**: course → courses, room → classrooms, lecturer → lecturers; conflict peer cards link to all related entities
- **Builder enrollments list**: course → courses, student → students, room → classrooms
- **Collection list rows**: courses (study program → studyPrograms, lecturer → lecturers), students (study program → studyPrograms), study programs (faculty → faculties), enrollments (student → students, course → courses, room → classrooms), grades (student → students, course → courses), users (student → students, lecturer → lecturers)
- **Detail panels**: enrollment (student, course, room), grade (implicit via list), course (study program, lecturer), student (study program, faculty), study program (faculty), user (student, lecturer)

#### Why `<span role="button">` instead of `<button>` or `<a>`

Entity links are frequently nested inside clickable list-row `<button>` elements. HTML does not allow nested buttons, and browsers can repair invalid nested-button markup in surprising ways. `<a>` would require real `href` values, but the app currently uses SPA view switching rather than route navigation for these entity jumps.

The current compromise keeps the DOM structure stable while addressing accessibility requirements:

- `role="button"` exposes the element as interactive to assistive technology.
- `tabindex="0"` makes the link keyboard-focusable.
- `handleEntityLinkKeydown()` supports `Enter` and `Space` activation.
- `:focus-visible` styling makes keyboard focus visible.
- `e.stopPropagation()` preserves the parent row's “click anywhere to select” behavior.

`bun run check` currently reports **0 accessibility warnings** for this pattern.

### 12.2 Editor Search Combobox Behavior

The enrollment editor uses searchable comboboxes for student, course, and room selection. These inputs have two separate responsibilities:

- Store the selected entity ID in the hidden form field / draft state (`studentId`, `courseId`, `classRoomId`).
- Keep a human-readable search string in the visible input (`studentPickerSearch`, `coursePickerSearch`, `roomPickerSearch`).

Important behavior:

- Autopopulated search values use plain searchable names, not display-only strings such as `Name • ID` or `Course • Lecturer`.
- Selecting a combobox option no longer clears the visible search text; it keeps the selected entity name.
- When editing an existing enrollment, `pickEnrollment()` populates the picker searches from the known student, course, and room names.
- If the user types into a populated picker, the selected ID is cleared so the new search can resolve to a different entity.

This avoids a common failure mode where display strings containing separators and metadata are sent back as search queries and return “not found”.

### 12.3 Data Fetching and TanStack Query Decision

Watum currently uses SvelteKit remote queries and forms (`query`, `.run()`, `.refresh()`, `form`, `command`) as the primary data layer. The app also maintains local UI state for pagination, filters, combobox options, loading flags, and conflict-audit cache behavior.

TanStack Query is not currently part of the stack. It is not worth adding unless client-side cache orchestration becomes a dominant problem.

Current recommendation:

- Keep SvelteKit remote queries as the source of truth for server data access.
- Prefer extracting repeated picker/list state into reusable helpers or components before adding another data-fetching library.
- Reconsider TanStack Query only if the app needs richer client-side invalidation, optimistic updates, stale-time control, offline-friendly retries, or shared query state across many independently mounted components.

Adding TanStack Query now would duplicate concerns already handled by SvelteKit remote queries and the existing server-side conflict-audit cache.

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

### Issue: `svelte-check` a11y warnings for `.entity-link` spans

**Cause**: Entity links originally used `<span onclick={...}>` inside clickable list rows. Svelte's a11y linter flagged `a11y_click_events_have_key_events` and `a11y_no_static_element_interactions` because plain spans were not keyboard-operable or semantically interactive.

**Fix**: Entity spans now use `role="button"`, `tabindex="0"`, and `onkeydown={handleEntityLinkKeydown}`. The shared handler activates links on `Enter` and `Space`, and CSS adds visible focus styling. `bun run check` reports `0 errors and 0 warnings`.

### Issue: Autopopulated editor searches return “not found”

**Cause**: Enrollment editor pickers populated visible search fields with display labels containing metadata separators, such as `Student Name • student-id` or `Course Name • Lecturer Name`. Those labels were later reused as raw search queries and did not match prefix-search behavior.

**Fix**: Picker search fields now store plain entity names. Selecting an option keeps the visible name instead of clearing the search text.

### Issue: Students could create schedules directly through remote forms

**Cause**: The builder UI was hidden from students, but `createEnrollment` still accepted the `STUDENT` role server-side. A crafted remote request could create a schedule with arbitrary room/day/time data.

**Fix**: `createEnrollment` is now restricted to `ADMIN` and `LECTURER` roles. The server no longer trusts students to create scheduling records directly.

### Issue: Enrollment conflict validation rejected schedules across different terms

**Cause**: Runtime room/student/lecturer conflict queries only checked day/time overlap and resource identity. They did not scope checks by `semester` and `academic_year`, even though the conflict-audit pipeline already used term-aware denormalized fields.

**Fix**: Runtime conflict queries now include `semester` and `academic_year`, so only conflicts within the same academic term are rejected.

### Issue: Duplicate enrollment uniqueness ignored academic year

**Cause**: The original unique key used `(student_id, course_id, semester)` and the application duplicate check matched the same fields, which blocked retaking the same course in the same semester label across a different academic year.

**Fix**: A migration now changes enrollment uniqueness to `(student_id, course_id, semester, academic_year)`, and application duplicate checks use the same four fields.

### Issue: Internal `/test` route exposed manual remote-function tooling in production

**Cause**: The `/test` route shipped a large manual testing page that imported many remote functions and auth helpers.

**Fix**: The route is now dev-only via `src/routes/test/+page.server.ts` and returns `404` outside development mode.

### Issue: Benchmark/audit scripts contained committed secrets or hardcoded admin passwords

**Cause**: Several scripts embedded credentials directly in source.

**Fix**: Scripts now read credentials from environment variables. `.env.example` documents `DB_CONNECTION_LIMIT`, `DB_QUEUE_LIMIT`, `WATUM_ADMIN_EMAIL`, and `WATUM_ADMIN_PASSWORD` for local benchmarking and audit tooling.

---

_End of Documentation_
