# Frontend Guide: Sistem Informasi Akademik "Universitas Merdeka Digital"

This guide explains the current frontend state of the `watum` project and how the data layer works using SvelteKit Remote Functions.

## 1. Current Frontend Status

The project currently has:

- Root layout: `src/routes/+layout.svelte`
- Global styling: `src/routes/layout.css` (Tailwind CSS v4 + shadcn-svelte tokens)
- Main authenticated route controller: `src/routes/+page.svelte`
- In-app mdsvex docs routes:
  - `src/routes/docs/+page.md`
  - `src/routes/docs/frontend/+page.md`
  - `src/routes/docs/backend/+page.md`
- Demo routes:
  - `src/routes/demo/+page.svelte`
  - `src/routes/demo/playwright/+page.svelte`
- Comprehensive test harness: `src/routes/test/+page.svelte` — tab-based UI that exercises every remote function (queries, search, forms, commands, auth)

For business modules, the app now renders extracted CRUD and scheduling views from `src/lib/components/app/` while keeping shared orchestration and remote-function ownership in the root `+page.svelte` controller.

## 2. Stack & UI Foundation

- Framework: SvelteKit (`@sveltejs/kit ^2.50`)
- Runtime syntax: Svelte 5 (runes mode, enforced via `compilerOptions.runes`)
- Styling: Tailwind CSS v4 (`tailwindcss ^4.1`)
- Component baseline: shadcn-svelte (`shadcn-svelte ^1.2`) plus extracted app views under `src/lib/components/app/`
- Icons: `@lucide/svelte`
- Utility helper: `cn()` in `src/lib/utils.ts` (uses `clsx` + `tailwind-merge`)
- Validation: Valibot (`valibot ^1.3`)
- Auth: `argon2` for password hashing, cookie-based sessions
- Documentation rendering: `mdsvex` + `remark-gfm`

### Svelte Config

```js
// svelte.config.js
{
  compilerOptions: {
    runes: ({ filename }) => /* true except node_modules */,
    experimental: { async: true }
  },
  kit: {
    adapter: adapter-bun,
    experimental: { remoteFunctions: true }
  }
}
```

## 3. Data Access Pattern (Remote Functions)

Frontend reads/writes data through module-level `data.remote.ts` files co-located with each route.

The three function types are:

| Type      | Import        | Purpose                                            | Client Usage                                                                  |
| --------- | ------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `query`   | `$app/server` | Read data (reactive)                               | Returns object with `.run()`, auto-cached                                     |
| `form`    | `$app/server` | Submit validated payloads                          | Returns object with `.action`, `.fields`, `.enhance()`, `.pending`, `.result` |
| `command` | `$app/server` | Simple argument-based actions (e.g., delete by id) | Call directly: `await deleteCourse(id)`                                       |

### 3.1 Query Usage

```ts
// Zero-arg query — auto-fetches, reactive
const courses = getCourses();
// Access current data: courses.current
// Force refetch: courses.refresh()
// Or imperatively: getCourses().run()
```

```ts
// Parameterized query — call with args, then .run()
const course = getCourse('CS101');
const result = await getCourse('CS101').run();
```

### 3.2 Form Usage

Forms use the `.enhance()` pattern with field bindings:

```svelte
<script lang="ts">
	import { createCourse } from './data.remote';
</script>

<form
	{...createCourse.enhance(async ({ submit }) => {
		await submit();
	})}
>
	<input {...createCourse.fields.id.as('text')} required />
	<input {...createCourse.fields.name.as('text')} required />
	<input {...createCourse.fields.credits.as('number')} min="1" max="6" required />
	<input {...createCourse.fields.studyProgramId.as('text')} required />
	<button type="submit" disabled={createCourse.pending > 0}>Create</button>
</form>

<!-- Validation issues -->
{#if createCourse.fields.allIssues()?.length}
	<p>{createCourse.fields.allIssues()[0]?.message}</p>
{/if}

<!-- Success -->
{#if createCourse.result}
	<p>Created: {createCourse.result.id}</p>
{/if}
```

### 3.3 Command Usage

```ts
await deleteCourse(courseId);
```

Commands throw on error — wrap in try/catch.

### 3.4 Search Queries (Dynamic Filtering)

Every module now exposes a `search*` function that accepts a filter object. These use `@dynamicQuery` TypeSQL select functions with dynamic `where` clauses:

```ts
const results = await searchCourses({
	name: 'Algoritma',
	minCredits: 2,
	maxCredits: 4
}).run();
```

Filter fields use `LIKE` for string matching and `BETWEEN` / `>=` / `<=` for numeric ranges.

## 4. Authentication

Auth is handled via `src/routes/auth/data.remote.ts`:

| Function         | Type  | Description                                          |
| ---------------- | ----- | ---------------------------------------------------- |
| `getCurrentUser` | query | Returns current session user (null if not logged in) |
| `loginUser`      | form  | Validates email/password, sets session cookie        |
| `logoutUser`     | form  | Clears session, refreshes `getCurrentUser`           |

All business remote functions call `requireRole()` or `requireUser()` which check the session cookie. Without a valid session, calls return Unauthorized.

## 5. Current Module Function Map

### `auth`

| Function         | Type  | Description                 |
| ---------------- | ----- | --------------------------- |
| `getCurrentUser` | query | Get current logged-in user  |
| `loginUser`      | form  | Login with email + password |
| `logoutUser`     | form  | Clear session               |

### `classrooms`

| Function                  | Type    | Description                                             |
| ------------------------- | ------- | ------------------------------------------------------- |
| `getClassRooms`           | query   | List all classrooms                                     |
| `searchClassRooms`        | query   | Filter by id, name, type, capacity range                |
| `getClassRoom`            | query   | Get single classroom by id                              |
| `getClassRoomUtilization` | query   | Get schedule utilization for a room (requires timezone) |
| `createClassRoom`         | form    | Create new classroom                                    |
| `updateClassRoom`         | form    | Update classroom (includes id)                          |
| `deleteClassRoom`         | command | Delete classroom by id                                  |

### `courses`

| Function        | Type    | Description                                                         |
| --------------- | ------- | ------------------------------------------------------------------- |
| `getCourses`    | query   | List all courses                                                    |
| `searchCourses` | query   | Filter by id, name, studyProgramId, studyProgramName, credits range |
| `getCourse`     | query   | Get single course by id                                             |
| `createCourse`  | form    | Create new course                                                   |
| `updateCourse`  | form    | Update course (schema includes id)                                  |
| `deleteCourse`  | command | Delete course by id                                                 |

### `enrollments`

| Function            | Type    | Description                                                                  |
| ------------------- | ------- | ---------------------------------------------------------------------------- |
| `getEnrollments`    | query   | List enrollments (filtered by role)                                          |
| `searchEnrollments` | query   | Filter by student/course/lecturer/classroom ids, names, semester, day, grade |
| `getEnrollment`     | query   | Get single enrollment by id                                                  |
| `createEnrollment`  | form    | Create enrollment + schedule (transactional via `withTransaction`)           |
| `updateEnrollment`  | form    | Update enrollment + schedule (transactional)                                 |
| `deleteEnrollment`  | command | Delete enrollment + schedule (transactional)                                 |

### `faculties`

| Function          | Type    | Description                                   |
| ----------------- | ------- | --------------------------------------------- |
| `getFaculties`    | query   | List all faculties                            |
| `searchFaculties` | query   | Filter by id, name, study program count range |
| `getFaculty`      | query   | Get single faculty by id                      |
| `createFaculty`   | form    | Create new faculty                            |
| `updateFaculty`   | form    | Update faculty (schema includes id)           |
| `deleteFaculty`   | command | Delete faculty by id                          |

### `grades`

| Function             | Type    | Description                                                                    |
| -------------------- | ------- | ------------------------------------------------------------------------------ |
| `getGrades`          | query   | List grades (filtered by role)                                                 |
| `searchGrades`       | query   | Filter by id, enrollment, student, course, lecturer, letter grade, score range |
| `getGrade`           | query   | Get single grade by id                                                         |
| `getGradesByCourse`  | query   | Grades for a specific course                                                   |
| `getGradesByStudent` | query   | Grades for a specific student                                                  |
| `createGrade`        | form    | Create single grade                                                            |
| `updateGrade`        | form    | Update grade (includes id)                                                     |
| `batchInputGrades`   | form    | Upsert multiple grades (transactional via `withTransaction`)                   |
| `deleteGrade`        | command | Delete grade by id                                                             |

### `lecturers`

| Function          | Type    | Description                                                     |
| ----------------- | ------- | --------------------------------------------------------------- |
| `getLecturers`    | query   | List all lecturers                                              |
| `searchLecturers` | query   | Filter by id, name, email, phone, address, schedule count range |
| `getLecturer`     | query   | Get single lecturer by id                                       |
| `createLecturer`  | form    | Create lecturer + user account (transactional)                  |
| `updateLecturer`  | form    | Update lecturer (schema includes id)                            |
| `deleteLecturer`  | command | Delete lecturer + user account (transactional)                  |

### `students`

| Function         | Type    | Description                                                       |
| ---------------- | ------- | ----------------------------------------------------------------- |
| `getStudents`    | query   | List all students                                                 |
| `searchStudents` | query   | Filter by id, name, email, studyProgramId, facultyId, year range  |
| `getStudent`     | query   | Get single student by id (NRP)                                    |
| `getStudentGPA`  | query   | Calculate GPA for a student                                       |
| `createStudent`  | form    | Create student + user account (transactional, auto-generates NRP) |
| `updateStudent`  | form    | Update student (includes id)                                      |
| `deleteStudent`  | command | Delete student + user account (transactional)                     |

### `study-programs`

| Function              | Type    | Description                                                           |
| --------------------- | ------- | --------------------------------------------------------------------- |
| `getStudyPrograms`    | query   | List all study programs                                               |
| `searchStudyPrograms` | query   | Filter by id, name, head, facultyId, facultyName, student count range |
| `getStudyProgram`     | query   | Get single study program by id                                        |
| `createStudyProgram`  | form    | Create new study program                                              |
| `updateStudyProgram`  | form    | Update study program (schema includes id)                             |
| `deleteStudyProgram`  | command | Delete study program by id                                            |

### `users`

| Function      | Type    | Description                                                                      |
| ------------- | ------- | -------------------------------------------------------------------------------- |
| `getUsers`    | query   | List all users                                                                   |
| `searchUsers` | query   | Filter by id, email, role, studentId/Name, lecturerId/Name                       |
| `getUser`     | query   | Get single user by id                                                            |
| `createUser`  | form    | Create user (supports standalone user, or creating student+user / lecturer+user) |
| `updateUser`  | form    | Update user (includes id, re-hashes password)                                    |
| `deleteUser`  | command | Delete user by id                                                                |

## 6. Transaction Pattern

Operations that touch multiple tables use `withTransaction` from `$lib/server/db`:

```ts
import { withTransaction } from '$lib/server/db';

await withTransaction(async (conn) => {
  await insertStudent(conn, { ... });
  await insertUser(conn, { ... });
});
```

This wraps the callback in `begin/commit/rollback` using a dedicated pool connection. Used in:

- `createStudent`, `deleteStudent`
- `createLecturer`, `deleteLecturer`
- `createEnrollment`, `updateEnrollment`, `deleteEnrollment`
- `batchInputGrades`
- `createUser` (student+user and lecturer+user paths)

## 7. Authorization Behavior in the UI

Backend handlers enforce authorization via `requireRole` or `requireUser`:

| Role       | Access                                                           |
| ---------- | ---------------------------------------------------------------- |
| `ADMIN`    | Full CRUD on all modules                                         |
| `LECTURER` | Read most data; create/update/delete grades for own courses only |
| `STUDENT`  | Read own data; create enrollments for self only                  |

In the frontend:

- Do not render write-action controls (create/update/delete) for unauthorized roles.
- Handle `403` (forbidden) and `404` (not found) clearly in UI states.
- Use `getCurrentUser` to check the session and conditionally show/hide UI.

## 8. Error Handling Pattern

### For `form` functions

Use `.enhance()` to catch errors and validation issues:

```ts
createCourse.enhance(async ({ submit }) => {
	try {
		await submit();
		// Success — createCourse.result is now populated
	} catch (e: any) {
		const message = e?.body?.message ?? e?.message ?? 'Something went wrong';
		// Show error in UI
	}
});
```

Validation issues are available via `formRef.fields.allIssues()`.

### For `command` functions

```ts
try {
	await deleteCourse(courseId);
} catch (e: any) {
	const message = e?.body?.message ?? 'Something went wrong';
	// show toast/alert
}
```

### For `query` functions

Queries auto-handle loading states. Access data reactively. For imperative calls with `.run()`, wrap in try/catch.

## 9. Frontend Development Checklist

When adding a new module page:

1. Keep reads and mutations in route-local `data.remote.ts` files.
2. Keep shared orchestration in `src/routes/+page.svelte` when state spans multiple views.
3. Render feature markup in extracted view components under `src/lib/components/app/`.
4. Use `getCurrentUser` and role guards to conditionally expose controls.
5. Connect forms using `.enhance()` and shared helpers from `src/lib/client/form-enhancers.ts`.
6. For search/filter, use the `search*` query functions.
7. Confirm destructive actions (`command`) before execution.
8. Re-run `bun run check` and `bun run build` after structural changes because mdsvex docs pages now compile as part of the app.

## 10. Project Directory Structure

```
src/
├── lib/
│   ├── assets/
│   │   └── favicon.svg
│   ├── app/
│   │   └── navigation.ts        # role-based view catalog and shell metadata
│   ├── client/
│   │   ├── auth.ts              # access token management and refresh flow
│   │   └── form-enhancers.ts    # shared remote-form helpers
│   ├── components/
│   │   ├── app/                 # extracted dashboard/calendar/builder/CRUD views
│   │   └── ui/                  # shadcn-svelte components and wrappers
│   ├── server/
│   │   ├── db.ts                # Pool, transaction, closePool
│   │   ├── auth.ts              # auth and token helpers
│   │   ├── conflict-audit.ts    # conflict detection engine
│   │   ├── sql/                 # TypeSQL SQL + generated .ts files
│   │   └── migrations/
│   ├── validations/             # Valibot schemas
│   ├── time-helpers.ts          # parseISO, formatDateTime, duration helpers
│   └── utils.ts                 # cn() helper
├── routes/
│   ├── +layout.svelte           # Root layout (imports layout.css)
│   ├── +page.svelte             # Main authenticated route controller
│   ├── layout.css               # Tailwind v4 + token layer
│   ├── docs/
│   │   ├── +layout.svelte       # mdsvex docs shell
│   │   ├── +page.md             # docs overview
│   │   ├── frontend/+page.md
│   │   └── backend/+page.md
│   ├── auth/
│   │   └── data.remote.ts       # getCurrentUser, loginUser, logoutUser
│   ├── classrooms/              # data.remote.ts per business module
│   ├── courses/
│   ├── enrollments/
│   ├── faculties/
│   ├── grades/
│   ├── lecturers/
│   ├── students/
│   ├── study-programs/
│   ├── users/
│   ├── test/
│   │   └── +page.svelte         # remote-function playground / regression harness
│   └── demo/
│       ├── +page.svelte
│       └── playwright/
│           └── +page.svelte
```

## 11. Current Notes

- `src/routes/+page.svelte` is still the main controller, but the large app views have been extracted to `src/lib/components/app/`.
- The test page at `src/routes/test/+page.svelte` still serves as a remote-function playground and regression harness.
- The app now ships with mdsvex-powered documentation routes under `/docs`.
- Shared app styling is split across `crud-view.css` and `page-shell.css` so extracted child views keep consistent presentation without route-scoped style warnings.
