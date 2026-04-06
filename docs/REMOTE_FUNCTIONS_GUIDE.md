# Frontend Guide (Current Project)

This guide explains the current frontend state of the `watum` project, and how the data layer works using SvelteKit Remote Functions.

## 1. Current Frontend Status

The project currently has:

- Root layout: `src/routes/+layout.svelte`
- Global styling: `src/routes/layout.css` (Tailwind v4 + shadcn-svelte tokens)
- Basic landing placeholder: `src/routes/+page.svelte`
- Demo routes:
  - `src/routes/demo/+page.svelte`
  - `src/routes/demo/playwright/+page.svelte`

For business modules (classrooms, courses, students, etc.), each route folder currently contains `data.remote.ts`, but full CRUD UI pages have not been implemented yet.

## 2. Stack & UI Foundation

- Framework: SvelteKit (`@sveltejs/kit`)
- Runtime syntax: Svelte 5 (runes)
- Styling: Tailwind CSS v4
- Component baseline: shadcn-svelte (`src/lib/components/ui`)
- Utility helper: `cn()` in `src/lib/utils.ts`

## 3. Data Access Pattern (Remote Functions)

In this project, the frontend reads/writes data through module-level `data.remote.ts` files.

The three function types are:

- `query` -> read data (reactive store)
- `form` -> submit validated payloads
- `command` -> simple argument-based actions (for example, delete by id)

Example module-page pattern (for example, `src/routes/courses/+page.svelte`):

```svelte
<script lang="ts">
	import { getCourses, createCourse, deleteCourse } from './data.remote';

	const courses = getCourses();

	let newCourse = $state({
		id: '',
		name: '',
		credits: 3,
		studyProgramId: ''
	});

	async function onCreate() {
		await createCourse(newCourse);
	}

	async function onDelete(id: string) {
		await deleteCourse(id);
	}
</script>

{#if !$courses}
	<p>Loading...</p>
{:else}
	{#each $courses as c}
		<div>
			{c.name}
			<button onclick={() => onDelete(c.id!)}>Delete</button>
		</div>
	{/each}
{/if}
```

## 4. Current Module Function Map

### `classrooms`

- query: `getClassRooms`, `getClassRoom`, `getClassRoomUtilization`
- form: `createClassRoom`, `updateClassRoom`
- command: `deleteClassRoom`

### `courses`

- query: `getCourses`, `getCourse`
- form: `createCourse`, `updateCourse`
- command: `deleteCourse`

### `enrollments`

- query: `getEnrollments`, `getEnrollment`
- form: `createEnrollment`, `updateEnrollment`
- command: `deleteEnrollment`

Note: enrollment create/update/delete already uses backend transactions (`withTransaction`) to prevent partial writes.

### `faculties`

- query: `getFaculties`, `getFaculty`
- form: `createFaculty`, `updateFaculty`
- command: `deleteFaculty`

### `grades`

- query: `getGrades`, `getGrade`, `getGradesByCourse`, `getGradesByStudent`
- form: `createGrade`, `updateGrade`, `batchInputGrades`
- command: none

`batchInputGrades` is transactional (all-or-nothing).

### `lecturers`

- query: `getLecturers`, `getLecturer`
- form: `createLecturer`, `updateLecturer`
- command: `deleteLecturer`

### `students`

- query: `getStudents`, `getStudent`, `getStudentGPA`
- form: `createStudent`, `updateStudent`
- command: `deleteStudent`

### `study-programs`

- query: `getStudyPrograms`, `getStudyProgram`
- form: `createStudyProgram`, `updateStudyProgram`
- command: `deleteStudyProgram`

### `users`

- query: `getUsers`, `getUser`
- form: `createUser`, `updateUser`
- command: `deleteUser`

## 5. Authorization Behavior in the UI

Many backend handlers enforce authorization using `requireRole` or `requireUser`. In the frontend:

- Do not assume every role can access every dataset.
- Handle `403` (forbidden) and `404` (not found) clearly in UI states.
- Avoid rendering write-action controls (create/update/delete) for unauthorized roles.

## 6. Error Handling Pattern

Use `try/catch` when calling `form`/`command`:

```ts
try {
	await updateCourse(payload);
} catch (e: any) {
	const message = e?.body?.message ?? 'Something went wrong';
	// show toast/alert
}
```

## 7. Frontend Development Checklist

When adding a new module page:

1. Create `+page.svelte` in the module route folder.
2. Import functions from `./data.remote` (co-located).
3. Render query stores (`$queryStore`) with loading/empty/error states.
4. Connect forms to `form` functions and show success/failure feedback.
5. Confirm destructive actions (`command`) before execution.

## 8. Notes for Next Iteration

- Root page (`src/routes/+page.svelte`) is still the default SvelteKit placeholder.
- CRUD module pages are not implemented yet (data layer is already available).
- Recommended next step: implement module UIs incrementally, starting with `courses`, `students`, and `enrollments`.
