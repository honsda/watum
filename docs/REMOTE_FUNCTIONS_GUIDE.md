# Remote Functions - Frontend Guide

## Quick Start

Remote functions are your API. Import and use them directly in your Svelte components.

```svelte
<script lang="ts">
	import { getCourses, createCourse, deleteCourse } from './data.remote';

	// Queries return reactive stores
	const courses = getCourses();
</script>

{#each $courses as course}
	<div>{course.name}</div>
{/each}
```

## Function Types

| Type      | Purpose        | Returns                  |
| --------- | -------------- | ------------------------ |
| `query`   | Fetch data     | Reactive store (`$data`) |
| `form`    | Submit forms   | Promise with result      |
| `command` | Simple actions | Promise with result      |

## Reading Data

### Fetch a List

```svelte
<script lang="ts">
	import { getCourses } from './data.remote';

	const courses = getCourses(); // Returns a store
</script>

{#if $courses}
	<ul>
		{#each $courses as course}
			<li>{course.name} ({course.credits} credits)</li>
		{/each}
	</ul>
{/if}
```

### Fetch Single Item

```svelte
<script lang="ts">
	import { getCourse } from './data.remote';

	let { id } = $props();
	const course = getCourse(id); // Pass ID as parameter
</script>

{#if $course}
	<h1>{$course.name}</h1>
{/if}
```

## Writing Data

### Create (Form Submission)

```svelte
<script lang="ts">
	import { createCourse, getCourses } from './data.remote';

	let formData = $state({
		id: '',
		name: '',
		credits: 3,
		studyProgramId: ''
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();

		const result = await createCourse(formData);

		if (result.success) {
			// Cache auto-refreshes! No manual refetch needed.
			formData = { id: '', name: '', credits: 3, studyProgramId: '' };
		}
	}
</script>

<form onsubmit={handleSubmit}>
	<input bind:value={formData.id} placeholder="Course ID" required />
	<input bind:value={formData.name} placeholder="Name" required />
	<input type="number" bind:value={formData.credits} min="1" max="6" />
	<button type="submit">Create</button>
</form>
```

### Update

```svelte
<script lang="ts">
	import { updateCourse, getCourse } from './data.remote';

	let { id } = $props();
	const course = getCourse(id);

	async function saveChanges() {
		await updateCourse({
			id,
			...$course
		});
		// UI updates automatically after cache refresh
	}
</script>
```

### Delete

```svelte
<script lang="ts">
	import { deleteCourse, getCourses } from './data.remote';

	async function remove(id: string) {
		if (confirm('Delete this course?')) {
			await deleteCourse(id);
			// List auto-refreshes
		}
	}
</script>

<button onclick={() => remove(course.id)}>Delete</button>
```

## Error Handling

```svelte
<script lang="ts">
	import { getCourse, createCourse } from './data.remote';

	let error = $state<string | null>(null);

	async function handleSubmit(data: CourseData) {
		error = null;
		try {
			await createCourse(data);
		} catch (e: any) {
			// Backend throws error(404) or error(400)
			error = e.body?.message || 'Something went wrong';
		}
	}
</script>

{#if error}
	<div class="error">{error}</div>
{/if}
```

## Working with Related Data

Sometimes you need data from multiple sources:

```svelte
<script lang="ts">
	import { getStudents, getStudyPrograms } from './data.remote';

	const students = getStudents();
	const programs = getStudyPrograms();

	// Combine when both loaded
	let studentsWithPrograms = $derived(
		$students && $programs
			? $students.map((s) => ({
					...s,
					programName: $programs.find((p) => p.id === s.studyProgramId)?.name
				}))
			: []
	);
</script>
```

## Common Patterns

### Loading States

```svelte
<script lang="ts">
	import { getCourses } from './data.remote';

	const courses = getCourses();
	let isCreating = $state(false);
</script>

{#if !$courses}
	<p>Loading...</p>
{:else}
	{#each $courses as course}
		<div>{course.name}</div>
	{/each}
{/if}

<button
	disabled={isCreating}
	onclick={async () => {
		isCreating = true;
		await createCourse(newCourse);
		isCreating = false;
	}}
>
	{isCreating ? 'Creating...' : 'Create'}
</button>
```

### Optimistic Updates

```svelte
<script lang="ts">
	import { getCourses, deleteCourse } from './data.remote';

	const courses = getCourses();
	let localCourses = $state<Course[]>([]);

	// Sync with remote
	$effect(() => {
		if ($courses) localCourses = $courses;
	});

	async function remove(id: string) {
		// Remove immediately (optimistic)
		localCourses = localCourses.filter((c) => c.id !== id);

		try {
			await deleteCourse(id);
		} catch {
			// Revert on error
			localCourses = $courses || [];
		}
	}
</script>

{#each localCourses as course}
	<div>{course.name} <button onclick={() => remove(course.id)}>×</button></div>
{/each}
```

## Available Functions by Module

| Module             | Queries                                                | Forms                                                  | Commands                 |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------ | ------------------------ |
| **courses**        | `getCourses()`, `getCourse(id)`                        | `createCourse(data)`, `updateCourse(data)`             | `deleteCourse(id)`       |
| **students**       | `getStudents()`, `getStudent(id)`, `getStudentGPA(id)` | `createStudent(data)`, `updateStudent(data)`           | `deleteStudent(id)`      |
| **enrollments**    | `getEnrollments()`, `getEnrollment(id)`                | `createEnrollment(data)`, `updateEnrollment(data)`     | `deleteEnrollment(id)`   |
| **grades**         | `getGrades()`                                          | `createGrade(data)`, `updateGrade(data)`               | `deleteGrade(id)`        |
| **lecturers**      | `getLecturers()`, `getLecturer(id)`                    | `createLecturer(data)`, `updateLecturer(data)`         | `deleteLecturer(id)`     |
| **classrooms**     | `getClassRooms()`, `getClassRoom(id)`                  | `createClassRoom(data)`, `updateClassRoom(data)`       | `deleteClassRoom(id)`    |
| **study-programs** | `getStudyPrograms()`, `getStudyProgram(id)`            | `createStudyProgram(data)`, `updateStudyProgram(data)` | `deleteStudyProgram(id)` |
| **faculties**      | `getFaculties()`, `getFaculty(id)`                     | `createFaculty(data)`, `updateFaculty(data)`           | `deleteFaculty(id)`      |

## TypeScript Types

Types are auto-generated from schemas:

```typescript
import type { CourseSchema } from '$lib/validations/course';
import type { StudentSchema } from '$lib/validations/student';

let course: CourseSchema = { ... };
let student: StudentSchema = { ... };
```

## Key Points

1. **Always use `$` prefix** for query stores: `$courses`, not `courses`
2. **Cache auto-refreshes** after form/command calls - no manual refetch needed
3. **Errors throw exceptions** - wrap in try/catch
4. **Check for null** - queries start as `undefined` before loading
