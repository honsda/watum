<script lang="ts">
	import { getCourses, getCourse, searchCourses, createCourse, updateCourse, deleteCourse } from '../courses/data.remote';
	import {
		getClassRooms,
		getClassRoom,
		getClassRoomUtilization,
		searchClassRooms,
		createClassRoom,
		updateClassRoom,
		deleteClassRoom
	} from '../classrooms/data.remote';
	import {
		getStudents,
		getStudent,
		getStudentGPA,
		searchStudents,
		createStudent,
		updateStudent,
		deleteStudent
	} from '../students/data.remote';
	import { getLecturers, getLecturer, searchLecturers, createLecturer, updateLecturer, deleteLecturer } from '../lecturers/data.remote';
	import { getFaculties, getFaculty, searchFaculties, createFaculty, updateFaculty, deleteFaculty } from '../faculties/data.remote';
	import {
		getStudyPrograms,
		getStudyProgram,
		searchStudyPrograms,
		createStudyProgram,
		updateStudyProgram,
		deleteStudyProgram
	} from '../study-programs/data.remote';
	import {
		getEnrollments,
		getEnrollment,
		searchEnrollments,
		createEnrollment,
		updateEnrollment,
		deleteEnrollment
	} from '../enrollments/data.remote';
	import {
		getGrades,
		getGrade,
		getGradesByCourse,
		getGradesByStudent,
		searchGrades,
		createGrade,
		updateGrade,
		batchInputGrades,
		deleteGrade
	} from '../grades/data.remote';
	import { getUsers, getUser, searchUsers, createUser, updateUser, deleteUser } from '../users/data.remote';
	import { getCurrentUser, loginUser, logoutUser } from '../auth/data.remote';

	const modules = ['courses', 'classrooms', 'students', 'lecturers', 'faculties', 'study-programs', 'enrollments', 'grades', 'users'] as const;
	let activeModule = $state<typeof modules[number]>('courses');

	let results = $state<Record<string, { success: boolean; data?: unknown; error?: string }>>({});
	let loading = $state<Record<string, boolean>>({});
	const resultCleanupTimers: Record<string, ReturnType<typeof setTimeout>> = {};
	const RESULT_TTL_MS = 10000;
	let courseId = $state('CS101');
	let studentId = $state('');
	let classRoomId = $state('');
	let enrollmentId = $state('');
	let facultyId = $state('');
	let lecturerId = $state('');
	let studyProgramId = $state('');
	let gradeId = $state('');
	let userId = $state('');
	let timezone = $state('Asia/Jakarta');

	let searchCourseData = $state({ id: '', name: '', studyProgramId: '', studyProgramName: '', minCredits: '', maxCredits: '' });
	let searchClassRoomData = $state({ id: '', name: '', classRoomType: 'REGULER', minCapacity: '', maxCapacity: '' });
	let searchStudentData = $state({ id: '', name: '', email: '', studyProgramId: '', facultyId: '', minYearAdmitted: '', maxYearAdmitted: '' });
	let searchLecturerData = $state({ id: '', name: '', email: '', phone: '', address: '', minScheduleCount: '', maxScheduleCount: '' });
	let searchFacultyData = $state({ id: '', name: '', minStudyProgramCount: '', maxStudyProgramCount: '' });
	let searchStudyProgramData = $state({ id: '', name: '', head: '', facultyId: '', facultyName: '', minStudentCount: '', maxStudentCount: '' });
	let searchEnrollmentData = $state({ id: '', studentId: '', courseId: '', lecturerId: '', classRoomId: '', semester: '', academicYear: '', studentName: '', studyProgramName: '', courseName: '', lecturerName: '', classRoomName: '', scheduleDay: 'SENIN', letterGrade: '' });
	let searchGradeData = $state({ id: '', enrollmentId: '', studentId: '', studentName: '', studentEmail: '', studyProgramName: '', courseId: '', courseName: '', lecturerId: '', letterGrade: '', minTotalScore: '', maxTotalScore: '' });
	let searchUserData = $state({ id: '', email: '', role: 'ADMIN', studentId: '', studentName: '', lecturerId: '', lecturerName: '' });

	let createCourseData = $state({ id: '', name: '', credits: 3, studyProgramId: '' });
	let updateCourseData = $state({ id: '', name: '', credits: 3, studyProgramId: '' });

	const classRoomTypeOptions = ['REGULER', 'LAB_KOMPUTER', 'LAB_BAHASA', 'AUDITORIUM'] as const;

	let createClassRoomData = $state({
		name: '',
		classRoomType: 'REGULER',
		capacity: 30,
		hasProjector: true,
		hasAC: false
	});
	let updateClassRoomData = $state({
		id: '',
		name: '',
		classRoomType: 'REGULER',
		capacity: 30,
		hasProjector: true,
		hasAC: false
	});

	let createStudentData = $state({
		name: '',
		email: '',
		phone: '',
		address: '',
		yearAdmitted: 2024,
		studyProgramId: 'TI'
	});
	let updateStudentData = $state({
		id: '',
		name: '',
		email: '',
		phone: '',
		address: '',
		yearAdmitted: 2024,
		studyProgramId: 'TI'
	});

	let createLecturerData = $state({ id: '', name: '', email: '', phone: '', address: '' });
	let updateLecturerData = $state({ id: '', name: '', email: '', phone: '', address: '' });

	let createFacultyData = $state({ id: '', name: '' });
	let updateFacultyData = $state({ id: '', name: '' });

	let createStudyProgramData = $state({ id: '', name: '', head: '', facultyId: 'FTI' });
	let updateStudyProgramData = $state({ id: '', name: '', head: '', facultyId: 'FTI' });

	let createEnrollmentData = $state({
		studentId: '',
		courseId: '',
		classRoomId: '',
		lecturerId: '',
		day: 'SENIN',
		startTime: '2026-01-01T07:00',
		endTime: '2026-01-01T09:00',
		semester: 'GANJIL',
		academicYear: '2026/2027'
	});
	let updateEnrollmentData = $state({
		id: '',
		studentId: '',
		courseId: '',
		classRoomId: '',
		lecturerId: '',
		day: 'SENIN',
		startTime: '2026-01-01T07:00',
		endTime: '2026-01-01T09:00',
		semester: 'GANJIL',
		academicYear: '2026/2027'
	});

	let createGradeData = $state({
		enrollmentId: '',
		assignmentScore: 80,
		midtermScore: 80,
		finalScore: 80
	});
	let updateGradeData = $state({
		id: '',
		enrollmentId: '',
		assignmentScore: 80,
		midtermScore: 80,
		finalScore: 80
	});
	let batchGradeData = $state({
		enrollmentId: '',
		assignmentScore: 80,
		midtermScore: 80,
		finalScore: 80
	});

	let createUserData = $state({
		email: '',
		password: '',
		role: 'ADMIN',
		studentId: '',
		lecturerId: ''
	});
	let updateUserData = $state({
		id: '',
		email: '',
		password: '',
		role: 'ADMIN',
		studentId: '',
		lecturerId: ''
	});

	const boxedFormCache: Record<
		string,
		{ action: string; method: 'POST'; [key: symbol]: (node: HTMLFormElement) => void }
	> = {};

	function setResult(name: string, result: { success: boolean; data?: unknown; error?: string }) {
		results[name] = result;
		const existingTimer = resultCleanupTimers[name];
		if (existingTimer) clearTimeout(existingTimer);
		resultCleanupTimers[name] = setTimeout(() => {
			delete results[name];
			delete resultCleanupTimers[name];
		}, RESULT_TTL_MS);
	}

	function formBox(
		name: string,
		remoteForm: {
			action: string;
			method: 'POST';
			result?: unknown;
			fields?: {
				allIssues?: () => Array<{ message?: string }> | undefined;
			};
			enhance: (callback: (opts: { submit: () => Promise<void> }) => void | Promise<void>) => {
				action: string;
				method: 'POST';
				[key: symbol]: (node: HTMLFormElement) => void;
			};
		}
	) {
		const cached = boxedFormCache[name];
		if (cached) return cached;

		const enhanced = remoteForm.enhance(async ({ submit }) => {
			loading[name] = true;
			try {
				await submit();
				const issues = remoteForm.fields?.allIssues?.() ?? [];
				if (issues.length > 0) {
					setResult(name, {
						success: false,
						error: issues
							.map((i) => i.message)
							.filter(Boolean)
							.join(' | ')
					});
					return;
				}
				setResult(name, { success: true, data: remoteForm.result });
			} catch (e: unknown) {
				const err = e as { body?: { message?: string }; message?: string };
				setResult(name, {
					success: false,
					error: err?.body?.message || err?.message || String(e)
				});
			} finally {
				loading[name] = false;
			}
		});

		boxedFormCache[name] = enhanced;
		return enhanced;
	}

	async function test(name: string, fn: () => unknown | Promise<unknown>) {
		loading[name] = true;
		try {
			const result = await fn();
			const data =
				result && typeof result === 'object' && 'run' in result && typeof result.run === 'function'
					? await result.run()
					: result;
			setResult(name, { success: true, data });
		} catch (e: unknown) {
			const err = e as { body?: { message?: string }; message?: string };
			setResult(name, {
				success: false,
				error: err?.body?.message || err?.message || String(e)
			});
		}
		loading[name] = false;
	}

	async function submitBatchInputGrades() {
		const formData = new FormData();
		formData.set('grades[0].enrollmentId', batchGradeData.enrollmentId);
		formData.set('grades[0].assignmentScore', String(batchGradeData.assignmentScore));
		formData.set('grades[0].midtermScore', String(batchGradeData.midtermScore));
		formData.set('grades[0].finalScore', String(batchGradeData.finalScore));

		const response = await fetch(batchInputGrades.action, {
			method: 'POST',
			body: formData
		});
		const text = await response.text();
		let payload: unknown = text;
		try {
			payload = JSON.parse(text);
		} catch {
			// Keep plain text when response is not JSON.
		}
		if (!response.ok) {
			throw new Error(typeof payload === 'string' ? payload : JSON.stringify(payload));
		}
		return payload;
	}
</script>

<style>
	button,
	select,
	input[type='checkbox'],
	label {
		cursor: pointer;
	}
</style>


<div class="min-h-screen bg-gray-950 text-gray-100 p-4">
	<div class="container mx-auto p-6 max-w-4xl bg-gray-900 rounded-xl shadow-2xl border border-gray-800">
		<h1 class="text-3xl font-bold mb-6 text-white">Remote Functions Test</h1>

		<div class="border border-gray-700 p-4 rounded-lg mb-6 bg-gray-800/50">
			<h3 class="font-semibold text-lg text-gray-200">Auth Session</h3>
			<p class="text-sm text-gray-400 mt-1">Most remote functions require a valid session. Login first to avoid Unauthorized.</p>
			<div class="mt-4 flex flex-wrap gap-2">
				<button class="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors" onclick={() => test('getCurrentUser', () => getCurrentUser().run())} disabled={loading['getCurrentUser']}>Check Session</button>
				<form class="flex flex-wrap gap-2" {...formBox('loginUser', loginUser)}>
					<input class="bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" {...loginUser.fields.email.as('email')} placeholder="Email" required />
					<input class="bg-gray-900 border border-gray-700 text-white px-3 py-2 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" type="password" {...loginUser.fields.password.as('text')} placeholder="Password" required />
					<button class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition-colors" disabled={loginUser.pending > 0}>Login</button>
				</form>
				<form {...formBox('logoutUser', logoutUser)}>
					<button class="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-md text-sm transition-colors" disabled={logoutUser.pending > 0}>Logout</button>
				</form>
			</div>
			{#if loginUser.result}
				<p class="text-sm text-green-400 mt-2 font-medium">Login success.</p>
			{/if}
			{#if loginUser.fields.allIssues()?.length}
				<p class="text-sm text-red-400 mt-2 font-medium">{loginUser.fields.allIssues()?.[0]?.message}</p>
			{/if}
		</div>


	<div class="flex gap-2 mb-8 flex-wrap">
		{#each modules as mod (mod)}
			<button
				class="px-4 py-1.5 rounded-lg text-sm font-medium transition-all {activeModule === mod ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'}"
				onclick={() => activeModule = mod}
			>
				{mod}
			</button>
		{/each}
	</div>


	{#if activeModule === 'courses'}
		<div class="space-y-3">
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getCourses</h3>
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm mt-2" onclick={() => test('getCourses', () => getCourses().run())} disabled={loading['getCourses']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">searchCourses</h3>
				<div class="mt-2 flex flex-wrap gap-2">
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchCourseData.id} placeholder="ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchCourseData.name} placeholder="Name" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchCourseData.studyProgramId} placeholder="Study Program ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchCourseData.studyProgramName} placeholder="Study Program Name" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" type="number" bind:value={searchCourseData.minCredits} placeholder="Min" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" type="number" bind:value={searchCourseData.maxCredits} placeholder="Max" />
					<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('searchCourses', () => searchCourses({ id: searchCourseData.id || undefined, name: searchCourseData.name || undefined, studyProgramId: searchCourseData.studyProgramId || undefined, studyProgramName: searchCourseData.studyProgramName || undefined, minCredits: searchCourseData.minCredits === '' ? undefined : Number(searchCourseData.minCredits), maxCredits: searchCourseData.maxCredits === '' ? undefined : Number(searchCourseData.maxCredits) }).run())} disabled={loading['searchCourses']}>Test</button>
				</div>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getCourse</h3>
				<input type="text" bind:value={courseId} placeholder="Course ID" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('getCourse', () => getCourse(courseId).run())} disabled={loading['getCourse']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">createCourse</h3>
							<form class="mt-2 flex flex-wrap gap-2" {...formBox('createCourse', createCourse)}>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createCourse.fields.id.as('text')} bind:value={createCourseData.id} placeholder="ID" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createCourse.fields.name.as('text')} bind:value={createCourseData.name} placeholder="Name" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" {...createCourse.fields.credits.as('number')} bind:value={createCourseData.credits} min="1" max="6" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createCourse.fields.studyProgramId.as('text')} bind:value={createCourseData.studyProgramId} placeholder="Study Program ID" required />
								<button class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition-colors shadow-sm" disabled={createCourse.pending > 0}>Submit</button>
				</form>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">updateCourse</h3>
							<form class="mt-2 flex flex-wrap gap-2" {...formBox('updateCourse', updateCourse)}>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateCourse.fields.id.as('text')} bind:value={updateCourseData.id} placeholder="ID" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateCourse.fields.name.as('text')} bind:value={updateCourseData.name} placeholder="Name" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" {...updateCourse.fields.credits.as('number')} bind:value={updateCourseData.credits} min="1" max="6" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateCourse.fields.studyProgramId.as('text')} bind:value={updateCourseData.studyProgramId} placeholder="Study Program ID" required />
								<button class="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-md text-sm transition-colors shadow-sm" disabled={updateCourse.pending > 0}>Submit</button>
				</form>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">deleteCourse</h3>
				<input type="text" bind:value={courseId} placeholder="Course ID to delete" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
				<button class="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('deleteCourse', () => deleteCourse(courseId))} disabled={loading['deleteCourse']}>Test</button>
			</div>
		</div>
	{/if}

	{#if activeModule === 'classrooms'}
		<div class="space-y-3">
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getClassRooms</h3>
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm mt-2" onclick={() => test('getClassRooms', () => getClassRooms().run())} disabled={loading['getClassRooms']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">searchClassRooms</h3>
				<div class="mt-2 flex flex-wrap gap-2">
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchClassRoomData.id} placeholder="ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchClassRoomData.name} placeholder="Name" />
					<select class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchClassRoomData.classRoomType}>
						{#each classRoomTypeOptions as type (type)}
							<option value={type}>{type}</option>
						{/each}
					</select>
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" type="number" bind:value={searchClassRoomData.minCapacity} placeholder="Min" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" type="number" bind:value={searchClassRoomData.maxCapacity} placeholder="Max" />
					<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('searchClassRooms', () => searchClassRooms({ id: searchClassRoomData.id || undefined, name: searchClassRoomData.name || undefined, classRoomType: searchClassRoomData.classRoomType as 'REGULER' | 'LAB_KOMPUTER' | 'LAB_BAHASA' | 'AUDITORIUM', minCapacity: searchClassRoomData.minCapacity === '' ? undefined : Number(searchClassRoomData.minCapacity), maxCapacity: searchClassRoomData.maxCapacity === '' ? undefined : Number(searchClassRoomData.maxCapacity) }).run())} disabled={loading['searchClassRooms']}>Test</button>
				</div>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getClassRoom</h3>
				<input type="text" bind:value={classRoomId} placeholder="ClassRoom ID" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('getClassRoom', () => getClassRoom(classRoomId).run())} disabled={loading['getClassRoom']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getClassRoomUtilization</h3>
				<input type="text" bind:value={classRoomId} placeholder="ClassRoom ID" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
				<input type="text" bind:value={timezone} placeholder="Timezone (e.g. Asia/Jakarta)" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('getClassRoomUtilization', () => getClassRoomUtilization({ classRoomId, timezone }).run())} disabled={loading['getClassRoomUtilization']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">createClassRoom</h3>
							<form class="mt-2 flex flex-wrap gap-2" {...formBox('createClassRoom', createClassRoom)}>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createClassRoom.fields.name.as('text')} bind:value={createClassRoomData.name} placeholder="Name" required />
								<select class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createClassRoom.fields.classRoomType.as('select')} bind:value={createClassRoomData.classRoomType}>
									{#each classRoomTypeOptions as type (type)}
										<option value={type}>{type}</option>
									{/each}
								</select>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" {...createClassRoom.fields.capacity.as('number')} bind:value={createClassRoomData.capacity} min="1" required />
					<label class="text-sm flex items-center gap-1"><input {...createClassRoom.fields.hasProjector.as('checkbox')} /> Projector</label>
					<label class="text-sm flex items-center gap-1"><input {...createClassRoom.fields.hasAC.as('checkbox')} /> AC</label>
								<button class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition-colors shadow-sm" disabled={createClassRoom.pending > 0}>Submit</button>
				</form>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">updateClassRoom</h3>
							<form class="mt-2 flex flex-wrap gap-2" {...formBox('updateClassRoom', updateClassRoom)}>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateClassRoom.fields.id.as('text')} bind:value={updateClassRoomData.id} placeholder="ID" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateClassRoom.fields.name.as('text')} bind:value={updateClassRoomData.name} placeholder="Name" required />
								<select class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateClassRoom.fields.classRoomType.as('select')} bind:value={updateClassRoomData.classRoomType}>
									{#each classRoomTypeOptions as type (type)}
										<option value={type}>{type}</option>
									{/each}
								</select>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" {...updateClassRoom.fields.capacity.as('number')} bind:value={updateClassRoomData.capacity} min="1" required />
					<label class="text-sm flex items-center gap-1"><input {...updateClassRoom.fields.hasProjector.as('checkbox')} /> Projector</label>
					<label class="text-sm flex items-center gap-1"><input {...updateClassRoom.fields.hasAC.as('checkbox')} /> AC</label>
								<button class="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-md text-sm transition-colors shadow-sm" disabled={updateClassRoom.pending > 0}>Submit</button>
				</form>
			</div>
				<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
					<h3 class="font-semibold">deleteClassRoom</h3>
					<input type="text" bind:value={classRoomId} placeholder="ClassRoom ID to delete" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
					<button class="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('deleteClassRoom', () => deleteClassRoom(classRoomId))} disabled={loading['deleteClassRoom']}>Test</button>
				</div>
		</div>
	{/if}

	{#if activeModule === 'students'}
		<div class="space-y-3">
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getStudents</h3>
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm mt-2" onclick={() => test('getStudents', () => getStudents().run())} disabled={loading['getStudents']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">searchStudents</h3>
				<div class="mt-2 flex flex-wrap gap-2">
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchStudentData.id} placeholder="ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchStudentData.name} placeholder="Name" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchStudentData.email} placeholder="Email" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchStudentData.studyProgramId} placeholder="Study Program ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchStudentData.facultyId} placeholder="Faculty ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" type="number" bind:value={searchStudentData.minYearAdmitted} placeholder="Min" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" type="number" bind:value={searchStudentData.maxYearAdmitted} placeholder="Max" />
					<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('searchStudents', () => searchStudents({ id: searchStudentData.id || undefined, name: searchStudentData.name || undefined, email: searchStudentData.email || undefined, studyProgramId: searchStudentData.studyProgramId || undefined, facultyId: searchStudentData.facultyId || undefined, minYearAdmitted: searchStudentData.minYearAdmitted === '' ? undefined : Number(searchStudentData.minYearAdmitted), maxYearAdmitted: searchStudentData.maxYearAdmitted === '' ? undefined : Number(searchStudentData.maxYearAdmitted) }).run())} disabled={loading['searchStudents']}>Test</button>
				</div>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getStudent</h3>
				<input type="text" bind:value={studentId} placeholder="Student ID (NRP)" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('getStudent', () => getStudent(studentId).run())} disabled={loading['getStudent']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getStudentGPA</h3>
				<input type="text" bind:value={studentId} placeholder="Student ID (NRP)" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('getStudentGPA', () => getStudentGPA(studentId).run())} disabled={loading['getStudentGPA']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">createStudent</h3>
							<form class="mt-2 flex flex-wrap gap-2" {...formBox('createStudent', createStudent)}>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createStudent.fields.name.as('text')} bind:value={createStudentData.name} placeholder="Name" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createStudent.fields.email.as('email')} bind:value={createStudentData.email} placeholder="Email" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createStudent.fields.phone.as('text')} bind:value={createStudentData.phone} placeholder="Phone" />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createStudent.fields.address.as('text')} bind:value={createStudentData.address} placeholder="Address" />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" {...createStudent.fields.yearAdmitted.as('number')} bind:value={createStudentData.yearAdmitted} required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createStudent.fields.studyProgramId.as('text')} bind:value={createStudentData.studyProgramId} placeholder="Study Program ID" required />
								<button class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition-colors shadow-sm" disabled={createStudent.pending > 0}>Submit</button>
				</form>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">updateStudent</h3>
							<form class="mt-2 flex flex-wrap gap-2" {...formBox('updateStudent', updateStudent)}>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateStudent.fields.id.as('text')} bind:value={updateStudentData.id} placeholder="NRP" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateStudent.fields.name.as('text')} bind:value={updateStudentData.name} placeholder="Name" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateStudent.fields.email.as('email')} bind:value={updateStudentData.email} placeholder="Email" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateStudent.fields.phone.as('text')} bind:value={updateStudentData.phone} placeholder="Phone" />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateStudent.fields.address.as('text')} bind:value={updateStudentData.address} placeholder="Address" />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" {...updateStudent.fields.yearAdmitted.as('number')} bind:value={updateStudentData.yearAdmitted} required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateStudent.fields.studyProgramId.as('text')} bind:value={updateStudentData.studyProgramId} placeholder="Study Program ID" required />
								<button class="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-md text-sm transition-colors shadow-sm" disabled={updateStudent.pending > 0}>Submit</button>
				</form>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">deleteStudent</h3>
				<input type="text" bind:value={studentId} placeholder="Student ID (NRP) to delete" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
				<button class="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('deleteStudent', () => deleteStudent(studentId))} disabled={loading['deleteStudent']}>Test</button>
			</div>
		</div>
	{/if}

	{#if activeModule === 'lecturers'}
		<div class="space-y-3">
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getLecturers</h3>
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm mt-2" onclick={() => test('getLecturers', () => getLecturers().run())} disabled={loading['getLecturers']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">searchLecturers</h3>
				<div class="mt-2 flex flex-wrap gap-2">
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchLecturerData.id} placeholder="ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchLecturerData.name} placeholder="Name" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchLecturerData.email} placeholder="Email" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchLecturerData.phone} placeholder="Phone" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchLecturerData.address} placeholder="Address" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" type="number" bind:value={searchLecturerData.minScheduleCount} placeholder="Min" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" type="number" bind:value={searchLecturerData.maxScheduleCount} placeholder="Max" />
					<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('searchLecturers', () => searchLecturers({ id: searchLecturerData.id || undefined, name: searchLecturerData.name || undefined, email: searchLecturerData.email || undefined, phone: searchLecturerData.phone || undefined, address: searchLecturerData.address || undefined, minScheduleCount: searchLecturerData.minScheduleCount === '' ? undefined : Number(searchLecturerData.minScheduleCount), maxScheduleCount: searchLecturerData.maxScheduleCount === '' ? undefined : Number(searchLecturerData.maxScheduleCount) }).run())} disabled={loading['searchLecturers']}>Test</button>
				</div>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getLecturer</h3>
				<input type="text" bind:value={lecturerId} placeholder="Lecturer ID (NIM)" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('getLecturer', () => getLecturer(lecturerId).run())} disabled={loading['getLecturer']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">createLecturer</h3>
							<form class="mt-2 flex flex-wrap gap-2" {...formBox('createLecturer', createLecturer)}>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createLecturer.fields.id.as('text')} bind:value={createLecturerData.id} placeholder="NIM" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createLecturer.fields.name.as('text')} bind:value={createLecturerData.name} placeholder="Name" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createLecturer.fields.email.as('email')} bind:value={createLecturerData.email} placeholder="Email" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createLecturer.fields.phone.as('text')} bind:value={createLecturerData.phone} placeholder="Phone" />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createLecturer.fields.address.as('text')} bind:value={createLecturerData.address} placeholder="Address" />
								<button class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition-colors shadow-sm" disabled={createLecturer.pending > 0}>Submit</button>
				</form>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">updateLecturer</h3>
							<form class="mt-2 flex flex-wrap gap-2" {...formBox('updateLecturer', updateLecturer)}>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateLecturer.fields.id.as('text')} bind:value={updateLecturerData.id} placeholder="NIM" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateLecturer.fields.name.as('text')} bind:value={updateLecturerData.name} placeholder="Name" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateLecturer.fields.email.as('email')} bind:value={updateLecturerData.email} placeholder="Email" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateLecturer.fields.phone.as('text')} bind:value={updateLecturerData.phone} placeholder="Phone" />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateLecturer.fields.address.as('text')} bind:value={updateLecturerData.address} placeholder="Address" />
								<button class="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-md text-sm transition-colors shadow-sm" disabled={updateLecturer.pending > 0}>Submit</button>
				</form>
			</div>
				<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
					<h3 class="font-semibold">deleteLecturer</h3>
					<input type="text" bind:value={lecturerId} placeholder="Lecturer ID (NIM) to delete" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
					<button class="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('deleteLecturer', () => deleteLecturer(lecturerId))} disabled={loading['deleteLecturer']}>Test</button>
				</div>
		</div>
	{/if}

	{#if activeModule === 'faculties'}
		<div class="space-y-3">
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getFaculties</h3>
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm mt-2" onclick={() => test('getFaculties', () => getFaculties().run())} disabled={loading['getFaculties']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">searchFaculties</h3>
				<div class="mt-2 flex flex-wrap gap-2">
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchFacultyData.id} placeholder="ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchFacultyData.name} placeholder="Name" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" type="number" bind:value={searchFacultyData.minStudyProgramCount} placeholder="Min" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" type="number" bind:value={searchFacultyData.maxStudyProgramCount} placeholder="Max" />
					<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('searchFaculties', () => searchFaculties({ id: searchFacultyData.id || undefined, name: searchFacultyData.name || undefined, minStudyProgramCount: searchFacultyData.minStudyProgramCount === '' ? undefined : Number(searchFacultyData.minStudyProgramCount), maxStudyProgramCount: searchFacultyData.maxStudyProgramCount === '' ? undefined : Number(searchFacultyData.maxStudyProgramCount) }).run())} disabled={loading['searchFaculties']}>Test</button>
				</div>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getFaculty</h3>
				<input type="text" bind:value={facultyId} placeholder="Faculty ID" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('getFaculty', () => getFaculty(facultyId).run())} disabled={loading['getFaculty']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">createFaculty</h3>
							<form class="mt-2 flex flex-wrap gap-2" {...formBox('createFaculty', createFaculty)}>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createFaculty.fields.id.as('text')} bind:value={createFacultyData.id} placeholder="ID" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createFaculty.fields.name.as('text')} bind:value={createFacultyData.name} placeholder="Name" required />
								<button class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition-colors shadow-sm" disabled={createFaculty.pending > 0}>Submit</button>
				</form>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">updateFaculty</h3>
							<form class="mt-2 flex flex-wrap gap-2" {...formBox('updateFaculty', updateFaculty)}>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateFaculty.fields.id.as('text')} bind:value={updateFacultyData.id} placeholder="ID" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateFaculty.fields.name.as('text')} bind:value={updateFacultyData.name} placeholder="Name" required />
								<button class="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-md text-sm transition-colors shadow-sm" disabled={updateFaculty.pending > 0}>Submit</button>
				</form>
			</div>
				<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
					<h3 class="font-semibold">deleteFaculty</h3>
					<input type="text" bind:value={facultyId} placeholder="Faculty ID to delete" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
					<button class="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('deleteFaculty', () => deleteFaculty(facultyId))} disabled={loading['deleteFaculty']}>Test</button>
				</div>
		</div>
	{/if}

	{#if activeModule === 'study-programs'}
		<div class="space-y-3">
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getStudyPrograms</h3>
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm mt-2" onclick={() => test('getStudyPrograms', () => getStudyPrograms().run())} disabled={loading['getStudyPrograms']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">searchStudyPrograms</h3>
				<div class="mt-2 flex flex-wrap gap-2">
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchStudyProgramData.id} placeholder="ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchStudyProgramData.name} placeholder="Name" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchStudyProgramData.head} placeholder="Head" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchStudyProgramData.facultyId} placeholder="Faculty ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchStudyProgramData.facultyName} placeholder="Faculty Name" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" type="number" bind:value={searchStudyProgramData.minStudentCount} placeholder="Min" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" type="number" bind:value={searchStudyProgramData.maxStudentCount} placeholder="Max" />
					<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('searchStudyPrograms', () => searchStudyPrograms({ id: searchStudyProgramData.id || undefined, name: searchStudyProgramData.name || undefined, head: searchStudyProgramData.head || undefined, facultyId: searchStudyProgramData.facultyId || undefined, facultyName: searchStudyProgramData.facultyName || undefined, minStudentCount: searchStudyProgramData.minStudentCount === '' ? undefined : Number(searchStudyProgramData.minStudentCount), maxStudentCount: searchStudyProgramData.maxStudentCount === '' ? undefined : Number(searchStudyProgramData.maxStudentCount) }).run())} disabled={loading['searchStudyPrograms']}>Test</button>
				</div>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getStudyProgram</h3>
				<input type="text" bind:value={studyProgramId} placeholder="Study Program ID" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('getStudyProgram', () => getStudyProgram(studyProgramId).run())} disabled={loading['getStudyProgram']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">createStudyProgram</h3>
							<form class="mt-2 flex flex-wrap gap-2" {...formBox('createStudyProgram', createStudyProgram)}>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createStudyProgram.fields.id.as('text')} bind:value={createStudyProgramData.id} placeholder="ID" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createStudyProgram.fields.name.as('text')} bind:value={createStudyProgramData.name} placeholder="Name" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createStudyProgram.fields.head.as('text')} bind:value={createStudyProgramData.head} placeholder="Head" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createStudyProgram.fields.facultyId.as('text')} bind:value={createStudyProgramData.facultyId} placeholder="Faculty ID" required />
								<button class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition-colors shadow-sm" disabled={createStudyProgram.pending > 0}>Submit</button>
				</form>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">updateStudyProgram</h3>
							<form class="mt-2 flex flex-wrap gap-2" {...formBox('updateStudyProgram', updateStudyProgram)}>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateStudyProgram.fields.id.as('text')} bind:value={updateStudyProgramData.id} placeholder="ID" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateStudyProgram.fields.name.as('text')} bind:value={updateStudyProgramData.name} placeholder="Name" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateStudyProgram.fields.head.as('text')} bind:value={updateStudyProgramData.head} placeholder="Head" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateStudyProgram.fields.facultyId.as('text')} bind:value={updateStudyProgramData.facultyId} placeholder="Faculty ID" required />
								<button class="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-md text-sm transition-colors shadow-sm" disabled={updateStudyProgram.pending > 0}>Submit</button>
				</form>
			</div>
				<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
					<h3 class="font-semibold">deleteStudyProgram</h3>
					<input type="text" bind:value={studyProgramId} placeholder="Study Program ID to delete" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
					<button class="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('deleteStudyProgram', () => deleteStudyProgram(studyProgramId))} disabled={loading['deleteStudyProgram']}>Test</button>
				</div>
		</div>
	{/if}

	{#if activeModule === 'enrollments'}
		<div class="space-y-3">
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getEnrollments</h3>
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm mt-2" onclick={() => test('getEnrollments', () => getEnrollments().run())} disabled={loading['getEnrollments']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">searchEnrollments</h3>
				<div class="mt-2 flex flex-wrap gap-2">
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchEnrollmentData.id} placeholder="ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchEnrollmentData.studentId} placeholder="Student ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchEnrollmentData.courseId} placeholder="Course ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchEnrollmentData.lecturerId} placeholder="Lecturer ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchEnrollmentData.classRoomId} placeholder="ClassRoom ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchEnrollmentData.semester} placeholder="Semester" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchEnrollmentData.academicYear} placeholder="Academic Year" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchEnrollmentData.studentName} placeholder="Student Name" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchEnrollmentData.studyProgramName} placeholder="Study Program Name" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchEnrollmentData.courseName} placeholder="Course Name" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchEnrollmentData.lecturerName} placeholder="Lecturer Name" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchEnrollmentData.classRoomName} placeholder="ClassRoom Name" />
					<select class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchEnrollmentData.scheduleDay}>
						<option value="SENIN">SENIN</option>
						<option value="SELASA">SELASA</option>
						<option value="RABU">RABU</option>
						<option value="KAMIS">KAMIS</option>
						<option value="JUMAT">JUMAT</option>
						<option value="SABTU">SABTU</option>
					</select>
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchEnrollmentData.letterGrade} placeholder="Letter Grade" />
					<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('searchEnrollments', () => searchEnrollments({ id: searchEnrollmentData.id || undefined, studentId: searchEnrollmentData.studentId || undefined, courseId: searchEnrollmentData.courseId || undefined, lecturerId: searchEnrollmentData.lecturerId || undefined, classRoomId: searchEnrollmentData.classRoomId || undefined, semester: searchEnrollmentData.semester || undefined, academicYear: searchEnrollmentData.academicYear || undefined, studentName: searchEnrollmentData.studentName || undefined, studyProgramName: searchEnrollmentData.studyProgramName || undefined, courseName: searchEnrollmentData.courseName || undefined, lecturerName: searchEnrollmentData.lecturerName || undefined, classRoomName: searchEnrollmentData.classRoomName || undefined, scheduleDay: searchEnrollmentData.scheduleDay as 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU' | undefined, letterGrade: searchEnrollmentData.letterGrade || undefined }).run())} disabled={loading['searchEnrollments']}>Test</button>
				</div>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getEnrollment</h3>
				<input type="text" bind:value={enrollmentId} placeholder="Enrollment ID" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('getEnrollment', () => getEnrollment(enrollmentId).run())} disabled={loading['getEnrollment']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">createEnrollment</h3>
							<form class="mt-2 flex flex-wrap gap-2" {...formBox('createEnrollment', createEnrollment)}>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createEnrollment.fields.studentId.as('text')} bind:value={createEnrollmentData.studentId} placeholder="Student ID" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createEnrollment.fields.courseId.as('text')} bind:value={createEnrollmentData.courseId} placeholder="Course ID" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createEnrollment.fields.classRoomId.as('text')} bind:value={createEnrollmentData.classRoomId} placeholder="ClassRoom ID" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createEnrollment.fields.lecturerId.as('text')} bind:value={createEnrollmentData.lecturerId} placeholder="Lecturer ID" required />
								<select class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createEnrollment.fields.day.as('select')} bind:value={createEnrollmentData.day}>
						<option value="SENIN">SENIN</option>
						<option value="SELASA">SELASA</option>
						<option value="RABU">RABU</option>
						<option value="KAMIS">KAMIS</option>
						<option value="JUMAT">JUMAT</option>
						<option value="SABTU">SABTU</option>
					</select>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" type="datetime-local" {...createEnrollment.fields.startTime.as('text')} bind:value={createEnrollmentData.startTime} required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" type="datetime-local" {...createEnrollment.fields.endTime.as('text')} bind:value={createEnrollmentData.endTime} required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createEnrollment.fields.semester.as('text')} bind:value={createEnrollmentData.semester} placeholder="Semester" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createEnrollment.fields.academicYear.as('text')} bind:value={createEnrollmentData.academicYear} placeholder="Academic Year" required />
								<button class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition-colors shadow-sm" disabled={createEnrollment.pending > 0}>Submit</button>
				</form>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">updateEnrollment</h3>
							<form class="mt-2 flex flex-wrap gap-2" {...formBox('updateEnrollment', updateEnrollment)}>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateEnrollment.fields.id.as('text')} bind:value={updateEnrollmentData.id} placeholder="Enrollment ID" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateEnrollment.fields.studentId.as('text')} bind:value={updateEnrollmentData.studentId} placeholder="Student ID" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateEnrollment.fields.courseId.as('text')} bind:value={updateEnrollmentData.courseId} placeholder="Course ID" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateEnrollment.fields.classRoomId.as('text')} bind:value={updateEnrollmentData.classRoomId} placeholder="ClassRoom ID" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateEnrollment.fields.lecturerId.as('text')} bind:value={updateEnrollmentData.lecturerId} placeholder="Lecturer ID" required />
								<select class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateEnrollment.fields.day.as('select')} bind:value={updateEnrollmentData.day}>
						<option value="SENIN">SENIN</option>
						<option value="SELASA">SELASA</option>
						<option value="RABU">RABU</option>
						<option value="KAMIS">KAMIS</option>
						<option value="JUMAT">JUMAT</option>
						<option value="SABTU">SABTU</option>
					</select>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" type="datetime-local" {...updateEnrollment.fields.startTime.as('text')} bind:value={updateEnrollmentData.startTime} required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" type="datetime-local" {...updateEnrollment.fields.endTime.as('text')} bind:value={updateEnrollmentData.endTime} required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateEnrollment.fields.semester.as('text')} bind:value={updateEnrollmentData.semester} placeholder="Semester" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateEnrollment.fields.academicYear.as('text')} bind:value={updateEnrollmentData.academicYear} placeholder="Academic Year" required />
								<button class="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-md text-sm transition-colors shadow-sm" disabled={updateEnrollment.pending > 0}>Submit</button>
				</form>
			</div>
				<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
					<h3 class="font-semibold">deleteEnrollment</h3>
					<input type="text" bind:value={enrollmentId} placeholder="Enrollment ID to delete" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
					<button class="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('deleteEnrollment', () => deleteEnrollment(enrollmentId))} disabled={loading['deleteEnrollment']}>Test</button>
				</div>
		</div>
	{/if}

	{#if activeModule === 'grades'}
		<div class="space-y-3">
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getGrades</h3>
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm mt-2" onclick={() => test('getGrades', () => getGrades().run())} disabled={loading['getGrades']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">searchGrades</h3>
				<div class="mt-2 flex flex-wrap gap-2">
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchGradeData.id} placeholder="ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchGradeData.enrollmentId} placeholder="Enrollment ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchGradeData.studentId} placeholder="Student ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchGradeData.studentName} placeholder="Student Name" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchGradeData.studentEmail} placeholder="Student Email" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchGradeData.studyProgramName} placeholder="Study Program Name" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchGradeData.courseId} placeholder="Course ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchGradeData.courseName} placeholder="Course Name" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchGradeData.lecturerId} placeholder="Lecturer ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchGradeData.letterGrade} placeholder="Letter Grade" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" type="number" bind:value={searchGradeData.minTotalScore} placeholder="Min" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" type="number" bind:value={searchGradeData.maxTotalScore} placeholder="Max" />
					<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('searchGrades', () => searchGrades({ id: searchGradeData.id || undefined, enrollmentId: searchGradeData.enrollmentId || undefined, studentId: searchGradeData.studentId || undefined, studentName: searchGradeData.studentName || undefined, studentEmail: searchGradeData.studentEmail || undefined, studyProgramName: searchGradeData.studyProgramName || undefined, courseId: searchGradeData.courseId || undefined, courseName: searchGradeData.courseName || undefined, lecturerId: searchGradeData.lecturerId || undefined, letterGrade: searchGradeData.letterGrade || undefined, minTotalScore: searchGradeData.minTotalScore === '' ? undefined : Number(searchGradeData.minTotalScore), maxTotalScore: searchGradeData.maxTotalScore === '' ? undefined : Number(searchGradeData.maxTotalScore) }).run())} disabled={loading['searchGrades']}>Test</button>
				</div>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getGrade</h3>
				<input type="text" bind:value={gradeId} placeholder="Grade ID" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('getGrade', () => getGrade(gradeId).run())} disabled={loading['getGrade']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getGradesByCourse</h3>
				<input type="text" bind:value={courseId} placeholder="Course ID" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('getGradesByCourse', () => getGradesByCourse(courseId).run())} disabled={loading['getGradesByCourse']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getGradesByStudent</h3>
				<input type="text" bind:value={studentId} placeholder="Student ID (NRP)" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('getGradesByStudent', () => getGradesByStudent(studentId).run())} disabled={loading['getGradesByStudent']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">createGrade</h3>
							<form class="mt-2 flex flex-wrap gap-2" {...formBox('createGrade', createGrade)}>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...createGrade.fields.enrollmentId.as('text')} bind:value={createGradeData.enrollmentId} placeholder="Enrollment ID" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" {...createGrade.fields.assignmentScore.as('number')} bind:value={createGradeData.assignmentScore} min="0" max="100" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" {...createGrade.fields.midtermScore.as('number')} bind:value={createGradeData.midtermScore} min="0" max="100" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" {...createGrade.fields.finalScore.as('number')} bind:value={createGradeData.finalScore} min="0" max="100" required />
								<button class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition-colors shadow-sm" disabled={createGrade.pending > 0}>Submit</button>
				</form>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">updateGrade</h3>
							<form class="mt-2 flex flex-wrap gap-2" {...formBox('updateGrade', updateGrade)}>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateGrade.fields.id.as('text')} bind:value={updateGradeData.id} placeholder="Grade ID" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateGrade.fields.enrollmentId.as('text')} bind:value={updateGradeData.enrollmentId} placeholder="Enrollment ID" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" {...updateGrade.fields.assignmentScore.as('number')} bind:value={updateGradeData.assignmentScore} min="0" max="100" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" {...updateGrade.fields.midtermScore.as('number')} bind:value={updateGradeData.midtermScore} min="0" max="100" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" {...updateGrade.fields.finalScore.as('number')} bind:value={updateGradeData.finalScore} min="0" max="100" required />
								<button class="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-md text-sm transition-colors shadow-sm" disabled={updateGrade.pending > 0}>Submit</button>
				</form>
			</div>
				<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
					<h3 class="font-semibold">batchInputGrades</h3>
					<div class="mt-2 flex flex-wrap gap-2">
						<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={batchGradeData.enrollmentId} placeholder="Enrollment ID" />
						<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" type="number" bind:value={batchGradeData.assignmentScore} min="0" max="100" placeholder="Assignment" />
						<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" type="number" bind:value={batchGradeData.midtermScore} min="0" max="100" placeholder="Midterm" />
						<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 w-24" type="number" bind:value={batchGradeData.finalScore} min="0" max="100" placeholder="Final" />
						<button class="px-4 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('batchInputGrades', () => submitBatchInputGrades())} disabled={loading['batchInputGrades']}>Test</button>
					</div>
				</div>
				<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
					<h3 class="font-semibold">deleteGrade</h3>
					<input type="text" bind:value={gradeId} placeholder="Grade ID to delete" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
					<button class="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('deleteGrade', () => deleteGrade(gradeId))} disabled={loading['deleteGrade']}>Test</button>
				</div>
		</div>
	{/if}

	{#if activeModule === 'users'}
		<div class="space-y-3">
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getUsers</h3>
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm mt-2" onclick={() => test('getUsers', () => getUsers().run())} disabled={loading['getUsers']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">searchUsers</h3>
				<div class="mt-2 flex flex-wrap gap-2">
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchUserData.id} placeholder="ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchUserData.email} placeholder="Email" />
					<select class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchUserData.role}>
						<option value="ADMIN">ADMIN</option>
						<option value="STUDENT">STUDENT</option>
						<option value="LECTURER">LECTURER</option>
					</select>
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchUserData.studentId} placeholder="Student ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchUserData.studentName} placeholder="Student Name" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchUserData.lecturerId} placeholder="Lecturer ID" />
					<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" bind:value={searchUserData.lecturerName} placeholder="Lecturer Name" />
					<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('searchUsers', () => searchUsers({ id: searchUserData.id || undefined, email: searchUserData.email || undefined, role: searchUserData.role as 'ADMIN' | 'STUDENT' | 'LECTURER', studentId: searchUserData.studentId || undefined, studentName: searchUserData.studentName || undefined, lecturerId: searchUserData.lecturerId || undefined, lecturerName: searchUserData.lecturerName || undefined }).run())} disabled={loading['searchUsers']}>Test</button>
				</div>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">getUser</h3>
				<input type="text" bind:value={userId} placeholder="User ID" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
				<button class="px-4 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('getUser', () => getUser(userId).run())} disabled={loading['getUser']}>Test</button>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">createUser</h3>
							<form class="mt-2 flex flex-wrap gap-2" {...formBox('createUser', createUser)}>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" name="email" bind:value={createUserData.email} placeholder="Email" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" name="password" type="password" bind:value={createUserData.password} placeholder="Password" required />
								<select class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" name="role" bind:value={createUserData.role}>
						<option value="ADMIN">ADMIN</option>
						<option value="STUDENT">STUDENT</option>
						<option value="LECTURER">LECTURER</option>
					</select>
					{#if createUserData.role === 'STUDENT'}
									<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" name="studentId" bind:value={createUserData.studentId} placeholder="Student ID" required />
					{/if}
					{#if createUserData.role === 'LECTURER'}
									<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" name="lecturerId" bind:value={createUserData.lecturerId} placeholder="Lecturer ID" required />
					{/if}
								<button class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm transition-colors shadow-sm" disabled={createUser.pending > 0}>Submit</button>
				</form>
			</div>
			<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
				<h3 class="font-semibold">updateUser</h3>
							<form class="mt-2 flex flex-wrap gap-2" {...formBox('updateUser', updateUser)}>
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateUser.fields.id.as('text')} bind:value={updateUserData.id} placeholder="User ID" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateUser.fields.email.as('email')} bind:value={updateUserData.email} placeholder="Email" required />
								<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateUser.fields.password.as('password')} bind:value={updateUserData.password} placeholder="Password" required />
								<select class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateUser.fields.role.as('select')} bind:value={updateUserData.role}>
						<option value="ADMIN">ADMIN</option>
						<option value="STUDENT">STUDENT</option>
						<option value="LECTURER">LECTURER</option>
					</select>
					{#if updateUserData.role === 'STUDENT'}
									<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateUser.fields.studentId.as('text')} bind:value={updateUserData.studentId} placeholder="Student ID" required />
					{/if}
					{#if updateUserData.role === 'LECTURER'}
									<input class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500" {...updateUser.fields.lecturerId.as('text')} bind:value={updateUserData.lecturerId} placeholder="Lecturer ID" required />
					{/if}
								<button class="px-4 py-1.5 bg-amber-700 hover:bg-amber-600 text-white rounded-md text-sm transition-colors shadow-sm" disabled={updateUser.pending > 0}>Submit</button>
				</form>
			</div>
				<div class="border border-gray-700 p-4 rounded-lg bg-gray-800/40 shadow-sm">
					<h3 class="font-semibold">deleteUser</h3>
					<input type="text" bind:value={userId} placeholder="User ID to delete" class="bg-gray-950 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500 mt-2 mr-2" />
					<button class="px-4 py-1.5 bg-red-700 hover:bg-red-600 text-white rounded-md text-sm transition-colors shadow-sm" onclick={() => test('deleteUser', () => deleteUser(userId))} disabled={loading['deleteUser']}>Test</button>
				</div>
		</div>
	{/if}

		{#if Object.keys(results).length > 0}
			<div class="mt-10 space-y-4">
				<h2 class="font-bold text-xl text-white">Results</h2>
				{#each Object.entries(results) as [name, result] (name)}
					<div class="border p-4 rounded-lg shadow-inner transition-all {result.success ? 'bg-green-950/20 border-green-900/50 text-green-100' : 'bg-red-950/20 border-red-900/50 text-red-100'}">
						<div class="font-semibold text-sm mb-2 opacity-80 uppercase tracking-wider">{name}</div>
						{#if result.success}
							<pre class="text-xs overflow-auto max-h-60 mt-2 bg-gray-950 p-4 rounded-md border border-gray-800 text-gray-300 font-mono leading-relaxed">{JSON.stringify(result.data, null, 2)}</pre>
						{:else}
							<div class="flex items-start gap-2 text-red-400 text-sm mt-1 bg-red-900/20 p-3 rounded border border-red-800/30">
								<span class="font-bold text-red-500">Error:</span>
								<span>{result.error}</span>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

