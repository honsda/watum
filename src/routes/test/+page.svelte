<script lang="ts">
	import { getCourses, getCourse, createCourse, deleteCourse } from '../courses/data.remote';
	import { getClassRooms, createClassRoom } from '../classrooms/data.remote';
	import { getStudents, getStudent, createStudent, deleteStudent } from '../students/data.remote';
	import { getLecturers, createLecturer } from '../lecturers/data.remote';
	import { getFaculties, createFaculty } from '../faculties/data.remote';
	import { getStudyPrograms, createStudyProgram } from '../study-programs/data.remote';
	import { getEnrollments } from '../enrollments/data.remote';
	import { getGrades } from '../grades/data.remote';
	import { getUsers } from '../users/data.remote';

	const modules = ['courses', 'classrooms', 'students', 'lecturers', 'faculties', 'study-programs', 'enrollments', 'grades', 'users'] as const;
	let activeModule = $state<typeof modules[number]>('courses');

	let results = $state<Record<string, { success: boolean; data?: unknown; error?: string }>>({});
	let loading = $state<Record<string, boolean>>({});
	let courseId = $state('CS101');
	let studentId = $state('');

	async function test(name: string, fn: () => Promise<unknown>) {
		loading[name] = true;
		try {
			const data = await fn();
			results[name] = { success: true, data };
		} catch (e: any) {
			results[name] = { success: false, error: e?.body?.message || e?.message || String(e) };
		}
		loading[name] = false;
	}
</script>

<div class="container mx-auto p-4 max-w-4xl">
	<h1 class="text-2xl font-bold mb-4">Remote Functions Test</h1>

	<div class="flex gap-2 mb-6 flex-wrap">
		{#each modules as mod}
			<button
				class="px-3 py-1 rounded text-sm {activeModule === mod ? 'bg-blue-500 text-white' : 'bg-gray-200'}"
				onclick={() => activeModule = mod}
			>
				{mod}
			</button>
		{/each}
	</div>

	{#if activeModule === 'courses'}
		<div class="space-y-3">
			<div class="border p-3 rounded">
				<h3 class="font-semibold">getCourses</h3>
				<button class="px-3 py-1 bg-green-500 text-white rounded text-sm mt-2" onclick={() => test('getCourses', () => getCourses())} disabled={loading['getCourses']}>Test</button>
			</div>
			<div class="border p-3 rounded">
				<h3 class="font-semibold">getCourse</h3>
				<input type="text" bind:value={courseId} placeholder="Course ID" class="border px-2 py-1 rounded text-sm mt-2 mr-2" />
				<button class="px-3 py-1 bg-green-500 text-white rounded text-sm" onclick={() => test('getCourse', () => getCourse(courseId))} disabled={loading['getCourse']}>Test</button>
			</div>
			<div class="border p-3 rounded">
				<h3 class="font-semibold">createCourse</h3>
				<button class="px-3 py-1 bg-blue-500 text-white rounded text-sm mt-2" onclick={() => test('createCourse', () => createCourse({ id: `TEST${Date.now()}`, name: 'Test Course', credits: 3, studyProgramId: 'TI' }))} disabled={loading['createCourse']}>Test</button>
			</div>
			<div class="border p-3 rounded">
				<h3 class="font-semibold">deleteCourse</h3>
				<input type="text" bind:value={courseId} placeholder="Course ID to delete" class="border px-2 py-1 rounded text-sm mt-2 mr-2" />
				<button class="px-3 py-1 bg-red-500 text-white rounded text-sm" onclick={() => test('deleteCourse', () => deleteCourse(courseId))} disabled={loading['deleteCourse']}>Test</button>
			</div>
		</div>
	{/if}

	{#if activeModule === 'classrooms'}
		<div class="space-y-3">
			<div class="border p-3 rounded">
				<h3 class="font-semibold">getClassRooms</h3>
				<button class="px-3 py-1 bg-green-500 text-white rounded text-sm mt-2" onclick={() => test('getClassRooms', () => getClassRooms())} disabled={loading['getClassRooms']}>Test</button>
			</div>
			<div class="border p-3 rounded">
				<h3 class="font-semibold">createClassRoom</h3>
				<button class="px-3 py-1 bg-blue-500 text-white rounded text-sm mt-2" onclick={() => test('createClassRoom', () => createClassRoom({ name: `Room ${Date.now()}`, classRoomType: 'REGULER', capacity: 30, hasProjector: true, hasAC: false }))} disabled={loading['createClassRoom']}>Test</button>
			</div>
		</div>
	{/if}

	{#if activeModule === 'students'}
		<div class="space-y-3">
			<div class="border p-3 rounded">
				<h3 class="font-semibold">getStudents</h3>
				<button class="px-3 py-1 bg-green-500 text-white rounded text-sm mt-2" onclick={() => test('getStudents', () => getStudents())} disabled={loading['getStudents']}>Test</button>
			</div>
			<div class="border p-3 rounded">
				<h3 class="font-semibold">getStudent</h3>
				<input type="text" bind:value={studentId} placeholder="Student ID (NRP)" class="border px-2 py-1 rounded text-sm mt-2 mr-2" />
				<button class="px-3 py-1 bg-green-500 text-white rounded text-sm" onclick={() => test('getStudent', () => getStudent(studentId))} disabled={loading['getStudent']}>Test</button>
			</div>
			<div class="border p-3 rounded">
				<h3 class="font-semibold">createStudent</h3>
				<button class="px-3 py-1 bg-blue-500 text-white rounded text-sm mt-2" onclick={() => test('createStudent', () => createStudent({ name: 'Test Student', email: `test${Date.now()}@student.ac.id`, phone: '08123456789', address: 'Test Address', yearAdmitted: 2024, studyProgramId: 'TI' }))} disabled={loading['createStudent']}>Test</button>
			</div>
		</div>
	{/if}

	{#if activeModule === 'lecturers'}
		<div class="space-y-3">
			<div class="border p-3 rounded">
				<h3 class="font-semibold">getLecturers</h3>
				<button class="px-3 py-1 bg-green-500 text-white rounded text-sm mt-2" onclick={() => test('getLecturers', () => getLecturers())} disabled={loading['getLecturers']}>Test</button>
			</div>
			<div class="border p-3 rounded">
				<h3 class="font-semibold">createLecturer</h3>
				<button class="px-3 py-1 bg-blue-500 text-white rounded text-sm mt-2" onclick={() => test('createLecturer', () => createLecturer({ id: `D${Date.now()}`, name: 'Test Lecturer', email: `test${Date.now()}@lecturer.ac.id`, phone: '08123456789', address: 'Test Address' }))} disabled={loading['createLecturer']}>Test</button>
			</div>
		</div>
	{/if}

	{#if activeModule === 'faculties'}
		<div class="space-y-3">
			<div class="border p-3 rounded">
				<h3 class="font-semibold">getFaculties</h3>
				<button class="px-3 py-1 bg-green-500 text-white rounded text-sm mt-2" onclick={() => test('getFaculties', () => getFaculties())} disabled={loading['getFaculties']}>Test</button>
			</div>
			<div class="border p-3 rounded">
				<h3 class="font-semibold">createFaculty</h3>
				<button class="px-3 py-1 bg-blue-500 text-white rounded text-sm mt-2" onclick={() => test('createFaculty', () => createFaculty({ id: `F${Date.now()}`, name: 'Test Faculty' }))} disabled={loading['createFaculty']}>Test</button>
			</div>
		</div>
	{/if}

	{#if activeModule === 'study-programs'}
		<div class="space-y-3">
			<div class="border p-3 rounded">
				<h3 class="font-semibold">getStudyPrograms</h3>
				<button class="px-3 py-1 bg-green-500 text-white rounded text-sm mt-2" onclick={() => test('getStudyPrograms', () => getStudyPrograms())} disabled={loading['getStudyPrograms']}>Test</button>
			</div>
			<div class="border p-3 rounded">
				<h3 class="font-semibold">createStudyProgram</h3>
				<button class="px-3 py-1 bg-blue-500 text-white rounded text-sm mt-2" onclick={() => test('createStudyProgram', () => createStudyProgram({ id: `SP${Date.now()}`, name: 'Test Program', head: 'Test Head', facultyId: 'FTI' }))} disabled={loading['createStudyProgram']}>Test</button>
			</div>
		</div>
	{/if}

	{#if activeModule === 'enrollments'}
		<div class="space-y-3">
			<div class="border p-3 rounded">
				<h3 class="font-semibold">getEnrollments</h3>
				<button class="px-3 py-1 bg-green-500 text-white rounded text-sm mt-2" onclick={() => test('getEnrollments', () => getEnrollments())} disabled={loading['getEnrollments']}>Test</button>
			</div>
		</div>
	{/if}

	{#if activeModule === 'grades'}
		<div class="space-y-3">
			<div class="border p-3 rounded">
				<h3 class="font-semibold">getGrades</h3>
				<button class="px-3 py-1 bg-green-500 text-white rounded text-sm mt-2" onclick={() => test('getGrades', () => getGrades())} disabled={loading['getGrades']}>Test</button>
			</div>
		</div>
	{/if}

	{#if activeModule === 'users'}
		<div class="space-y-3">
			<div class="border p-3 rounded">
				<h3 class="font-semibold">getUsers</h3>
				<button class="px-3 py-1 bg-green-500 text-white rounded text-sm mt-2" onclick={() => test('getUsers', () => getUsers())} disabled={loading['getUsers']}>Test</button>
			</div>
		</div>
	{/if}

	{#if Object.keys(results).length > 0}
		<div class="mt-6 space-y-2">
			<h2 class="font-semibold text-lg">Results</h2>
			{#each Object.entries(results) as [name, result]}
				<div class="border p-3 rounded {result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}">
					<div class="font-medium">{name}</div>
					{#if result.success}
						<pre class="text-xs overflow-auto max-h-40 mt-1 bg-white p-2 rounded">{JSON.stringify(result.data, null, 2)}</pre>
					{:else}
						<p class="text-red-700 text-sm mt-1">{result.error}</p>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
