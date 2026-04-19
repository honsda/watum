<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import {
		AlertCircle,
		ArrowRightLeft,
		BookOpen,
		Building2,
		CalendarDays,
		ClipboardList,
		DoorClosed,
		GraduationCap,
		LayoutPanelTop,
		MoonStar,
		Search,
		ShieldCheck,
		SunMedium,
		UsersRound,
		Waypoints
	} from '@lucide/svelte';
	import { days } from '$lib/validations/enrollment';
	import { classRoomTypes } from '$lib/validations/classroom';
	import {
		availableRoomsForSlot,
		beautifyRoomType,
		buildScheduleCards,
		conflictToneVariables,
		DAY_LABELS,
		formatTimeRange,
		matchesText,
		toMinutes,
		type AppRole,
		type ScheduleCard
	} from '$lib/app/academic';
	import { formatDateTimeInput, parseISO } from '$lib/time-helpers';
	import WeeklyCalendar from '$lib/components/app/WeeklyCalendar.svelte';
	import ClassroomDashboard from '$lib/components/app/ClassroomDashboard.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { getCurrentUser, loginUser, logoutUser } from './auth/data.remote';
	import {
		getClassRooms,
		createClassRoom,
		updateClassRoom,
		deleteClassRoom
	} from './classrooms/data.remote';
	import { getCourses, createCourse, updateCourse, deleteCourse } from './courses/data.remote';
	import { getStudents, createStudent, updateStudent, deleteStudent } from './students/data.remote';
	import {
		getLecturers,
		createLecturer,
		updateLecturer,
		deleteLecturer
	} from './lecturers/data.remote';
	import {
		getFaculties,
		createFaculty,
		updateFaculty,
		deleteFaculty
	} from './faculties/data.remote';
	import {
		getStudyPrograms,
		createStudyProgram,
		updateStudyProgram,
		deleteStudyProgram
	} from './study-programs/data.remote';
	import {
		getEnrollments,
		createEnrollment,
		updateEnrollment,
		deleteEnrollment
	} from './enrollments/data.remote';
	import { getGrades, createGrade, updateGrade, deleteGrade } from './grades/data.remote';
	import { getUsers, updateUser } from './users/data.remote';

	type ViewId =
		| 'dashboard'
		| 'calendar'
		| 'builder'
		| 'classrooms'
		| 'courses'
		| 'students'
		| 'lecturers'
		| 'faculties'
		| 'studyPrograms'
		| 'enrollments'
		| 'grades'
		| 'users';

	type Tone = 'neutral' | 'success' | 'danger';
	type Feedback = { tone: Tone; text: string } | null;
	type EditableView =
		| 'classrooms'
		| 'courses'
		| 'students'
		| 'lecturers'
		| 'faculties'
		| 'studyPrograms'
		| 'grades'
		| 'users';
	type DeleteKind =
		| 'classroom'
		| 'course'
		| 'student'
		| 'lecturer'
		| 'faculty'
		| 'studyProgram'
		| 'enrollment'
		| 'grade';
	type DeleteIntent = {
		kind: DeleteKind;
		id: string;
		label: string;
		message: string;
		confirmLabel: string;
		successMessage: string;
		failureMessage: string;
	};
	type NavigationGroupId =
		| 'operations'
		| 'academic'
		| 'reference'
		| 'access'
		| 'schedule'
		| 'studyReference';
	type NavigationGroup = {
		id: NavigationGroupId;
		label: string;
		description: string;
		icon: typeof LayoutPanelTop;
		views: ViewId[];
	};
	type BuilderStep = 'participant' | 'time' | 'room' | 'review';
	type DataCollectionKey =
		| 'classrooms'
		| 'courses'
		| 'students'
		| 'lecturers'
		| 'faculties'
		| 'studyPrograms'
		| 'enrollments'
		| 'grades'
		| 'users';

	const currentUser = getCurrentUser();
	const timezone = 'Asia/Jakarta';

	const viewCatalog = {
		dashboard: { label: 'Dashboard', icon: LayoutPanelTop },
		calendar: { label: 'Kalender Mingguan', icon: CalendarDays },
		builder: { label: 'Pembuat Jadwal', icon: Waypoints },
		classrooms: { label: 'Ruang Kelas', icon: DoorClosed },
		courses: { label: 'Mata Kuliah', icon: BookOpen },
		students: { label: 'Mahasiswa', icon: GraduationCap },
		lecturers: { label: 'Dosen', icon: UsersRound },
		faculties: { label: 'Fakultas', icon: Building2 },
		studyPrograms: { label: 'Program Studi', icon: ClipboardList },
		enrollments: { label: 'KRS', icon: ArrowRightLeft },
		grades: { label: 'Nilai', icon: ShieldCheck },
		users: { label: 'Akun', icon: UsersRound }
	} as const;

	function readViewFromUrl(): ViewId | null {
		if (!browser) return null;
		const rawView = new URLSearchParams(window.location.search).get('view');
		if (!rawView) return null;
		return rawView in viewCatalog ? (rawView as ViewId) : null;
	}

	function writeViewToUrl(view: ViewId) {
		if (!browser) return;
		const url = new URL(window.location.href);
		if (view === 'dashboard') {
			url.searchParams.delete('view');
		} else {
			url.searchParams.set('view', view);
		}
		replaceState(url, {});
	}

	function navigationForRole(role: AppRole | undefined): ViewId[] {
		if (role === 'ADMIN') {
			return [
				'dashboard',
				'calendar',
				'builder',
				'classrooms',
				'courses',
				'students',
				'lecturers',
				'faculties',
				'studyPrograms',
				'enrollments',
				'grades',
				'users'
			];
		}
		if (role === 'LECTURER') {
			return [
				'dashboard',
				'calendar',
				'builder',
				'classrooms',
				'courses',
				'students',
				'lecturers',
				'faculties',
				'studyPrograms',
				'enrollments',
				'grades'
			];
		}
		return ['dashboard', 'calendar', 'classrooms', 'courses', 'lecturers', 'enrollments', 'grades'];
	}

	function navigationGroupsForRole(role: AppRole | undefined): NavigationGroup[] {
		if (role === 'ADMIN') {
			return [
				{
					id: 'operations',
					label: 'Operasi',
					description: 'Fokus pada bentrok, kalender, pembuat jadwal, dan kondisi ruang hari ini.',
					icon: LayoutPanelTop,
					views: ['dashboard', 'calendar', 'builder', 'classrooms']
				}
			];
		}

		if (role === 'LECTURER') {
			return [
				{
					id: 'operations',
					label: 'Operasi',
					description: 'Pantau jadwal mingguan, tangani bentrok, dan cek ruang yang siap dipakai.',
					icon: LayoutPanelTop,
					views: ['dashboard', 'calendar', 'builder', 'classrooms']
				}
			];
		}

		return [
			{
				id: 'schedule',
				label: 'Jadwal saya',
				description: 'Pantau sesi mingguan dan perubahan ruang tanpa membawa seluruh shell staf.',
				icon: CalendarDays,
				views: ['dashboard', 'calendar']
			}
		];
	}

	function secondaryGroupsForRole(role: AppRole | undefined): NavigationGroup[] {
		if (role === 'ADMIN') {
			return [
				{
					id: 'academic',
					label: 'Akademik',
					description:
						'Kelola KRS, nilai, dan katalog akademik hanya saat ada perubahan yang perlu dicatat.',
					icon: ClipboardList,
					views: ['enrollments', 'grades', 'courses']
				},
				{
					id: 'reference',
					label: 'Referensi',
					description: 'Perbarui identitas dan struktur akademik bila data dasar memang berubah.',
					icon: Building2,
					views: ['students', 'lecturers', 'faculties', 'studyPrograms']
				},
				{
					id: 'access',
					label: 'Akses',
					description: 'Atur akun dan peran tanpa mengganggu fokus ruang kerja utama.',
					icon: ShieldCheck,
					views: ['users']
				}
			];
		}

		if (role === 'LECTURER') {
			return [
				{
					id: 'academic',
					label: 'Akademik',
					description:
						'Buka KRS, nilai, dan mata kuliah aktif ketika keputusan operasional sudah jelas.',
					icon: ClipboardList,
					views: ['enrollments', 'grades', 'courses']
				},
				{
					id: 'reference',
					label: 'Referensi',
					description:
						'Lihat data mahasiswa, dosen, dan struktur akademik sebagai pendukung keputusan.',
					icon: Building2,
					views: ['students', 'lecturers', 'faculties', 'studyPrograms']
				}
			];
		}

		return [
			{
				id: 'studyReference',
				label: 'Referensi kuliah',
				description:
					'Buka KRS, hasil belajar, ruang, dan katalog kuliah hanya saat memang diperlukan.',
				icon: BookOpen,
				views: ['enrollments', 'grades', 'classrooms', 'courses', 'lecturers']
			}
		];
	}

	function isSecondaryView(view: ViewId, role: AppRole | undefined) {
		return secondaryGroupsForRole(role).some((group) => group.views.includes(view));
	}

	function pageHeading(view: ViewId) {
		if (currentUser.current?.role === 'STUDENT' && view === 'dashboard')
			return 'Jadwal dan hasil belajar';
		if (view === 'dashboard') return 'Keputusan operasional hari ini';
		if (view === 'calendar') return 'Kalender perkuliahan mingguan';
		if (view === 'builder') return 'Ruang kerja penjadwalan';
		return viewCatalog[view].label;
	}

	function dashboardPriorityLabel(role: AppRole | undefined) {
		if (role === 'ADMIN')
			return 'Tinjau bentrok, longgarkan ruang, lalu pastikan sesi terdekat siap berjalan.';
		if (role === 'LECTURER')
			return 'Pastikan kelas berikutnya aman dan ruang pengganti masih tersedia.';
		return 'Pastikan jadwal pribadi tetap jelas dan perubahan ruang mudah ditemukan.';
	}

	function dashboardFocusLabel(role: AppRole | undefined) {
		if (role === 'ADMIN') return 'Prioritaskan bentrok aktif dan ruang yang masih terlalu longgar.';
		if (role === 'LECTURER')
			return 'Fokus pada ruang kosong dan sesi yang berlangsung paling dekat.';
		return 'Fokus pada sesi berikutnya dan ruang tempat kelas akan berlangsung.';
	}

	function conflictPeerLabel(card: ScheduleCard) {
		return `${card.course} • ${card.student} • ${card.room} • ${DAY_LABELS[card.day]} ${card.startLabel}-${card.endLabel}`;
	}

	function schedulesOverlap(left: ScheduleCard, right: ScheduleCard) {
		return (
			left.id !== right.id &&
			left.day === right.day &&
			left.startMinutes < right.endMinutes &&
			right.startMinutes < left.endMinutes
		);
	}

	function openBuilderForSchedule(card: ScheduleCard | null | undefined) {
		if (!card) return;
		pickEnrollment(card.original);
		activeView = 'builder';
	}

	const builderSteps = [
		{ id: 'participant', label: 'Peserta', hint: 'Tentukan pemilik kelas dan mata kuliahnya.' },
		{ id: 'time', label: 'Waktu', hint: 'Tetapkan hari serta slot kuliah yang akan dicek.' },
		{ id: 'room', label: 'Ruang', hint: 'Pilih ruang yang masih aman untuk slot tersebut.' },
		{ id: 'review', label: 'Tinjau', hint: 'Pastikan semua keputusan siap disimpan.' }
	] as const;

	function headerAction(view: ViewId, role: AppRole | undefined) {
		if (role === 'STUDENT') return null;
		if (isSecondaryView(view, role))
			return { label: 'Kembali ke operasi', target: 'dashboard' as ViewId };
		if (view === 'builder') return { label: 'Kembali ke dashboard', target: 'dashboard' as ViewId };
		if (view === 'calendar') return { label: 'Atur jadwal', target: 'builder' as ViewId };
		return { label: 'Buka pembuat jadwal', target: 'builder' as ViewId };
	}

	function activateView(view: ViewId) {
		activeView = view;
	}

	function emptyClassRoomDraft() {
		return {
			name: '',
			classRoomType: 'REGULER',
			capacity: 30,
			hasProjector: true,
			hasAC: true
		};
	}

	function emptyCourseDraft() {
		return { id: '', name: '', credits: 3, studyProgramId: '', lecturerId: '' };
	}

	function emptyStudentDraft() {
		return { name: '', email: '', phone: '', address: '', yearAdmitted: 2024, studyProgramId: '' };
	}

	function emptyLecturerDraft() {
		return { id: '', name: '', email: '', phone: '', address: '' };
	}

	function emptyFacultyDraft() {
		return { id: '', name: '' };
	}

	function emptyStudyProgramDraft() {
		return { id: '', name: '', head: '', facultyId: '' };
	}

	function emptyEnrollmentDraft() {
		return {
			id: '',
			studentId: '',
			courseId: '',
			classRoomId: '',
			day: 'SENIN',
			startTime: '',
			endTime: '',
			semester: 'Ganjil',
			academicYear: '2025/2026',
			timezone
		};
	}

	function emptyGradeDraft() {
		return { id: '', enrollmentId: '', assignmentScore: 80, midtermScore: 80, finalScore: 80 };
	}

	function emptyUserDraft() {
		return { id: '', email: '', password: '', role: 'ADMIN', studentId: '', lecturerId: '' };
	}

	let theme = $state<'light' | 'dark'>('light');
	let activeView = $state<ViewId>('dashboard');
	let builderStep = $state<BuilderStep>('participant');
	let editorView = $state<EditableView | null>(null);
	let pendingDelete = $state<DeleteIntent | null>(null);
	let feedback = $state<Feedback>(null);
	let appLoading = $state(false);
	let loadedForUserId = $state<string | null>(null);
	let viewRestored = $state(!browser);
	let collectionIssues = $state<Partial<Record<DataCollectionKey, string>>>({});

	let classrooms = $state<any[]>([]);
	let courses = $state<any[]>([]);
	let students = $state<any[]>([]);
	let lecturers = $state<any[]>([]);
	let faculties = $state<any[]>([]);
	let studyPrograms = $state<any[]>([]);
	let enrollments = $state<any[]>([]);
	let grades = $state<any[]>([]);
	let users = $state<any[]>([]);

	let roomSearch = $state('');
	let courseSearch = $state('');
	let studentSearch = $state('');
	let lecturerSearch = $state('');
	let facultySearch = $state('');
	let studyProgramSearch = $state('');
	let enrollmentSearch = $state('');
	let gradeSearch = $state('');
	let userSearch = $state('');

	let selectedScheduleId = $state<string | null>(null);
	let selectedRoomId = $state<string | null>(null);
	let selectedCourseId = $state<string | null>(null);
	let selectedStudentId = $state<string | null>(null);
	let selectedLecturerId = $state<string | null>(null);
	let selectedFacultyId = $state<string | null>(null);
	let selectedStudyProgramId = $state<string | null>(null);
	let selectedEnrollmentId = $state<string | null>(null);
	let selectedGradeId = $state<string | null>(null);
	let selectedUserId = $state<string | null>(null);

	let classroomDraft = $state(emptyClassRoomDraft());
	let courseDraft = $state(emptyCourseDraft());
	let studentDraft = $state(emptyStudentDraft());
	let lecturerDraft = $state(emptyLecturerDraft());
	let facultyDraft = $state(emptyFacultyDraft());
	let studyProgramDraft = $state(emptyStudyProgramDraft());
	let enrollmentDraft = $state(emptyEnrollmentDraft());
	let gradeDraft = $state(emptyGradeDraft());
	let userDraft = $state(emptyUserDraft());

	function setFeedback(tone: Tone, text: string) {
		feedback = { tone, text };
	}

	function setCollectionIssue(key: DataCollectionKey, message: string) {
		collectionIssues = { ...collectionIssues, [key]: message };
	}

	function clearCollectionIssue(key: DataCollectionKey) {
		const { [key]: _removed, ...rest } = collectionIssues;
		collectionIssues = rest;
	}

	function errorMessage(error: unknown, fallback: string) {
		return (
			(error as { body?: { message?: string }; message?: string })?.body?.message ||
			(error as Error)?.message ||
			fallback
		);
	}

	function firstIssue(form: any) {
		return form?.fields?.allIssues?.()?.[0]?.message ?? null;
	}

	function applyTheme(nextTheme: 'light' | 'dark') {
		theme = nextTheme;
		if (browser) {
			document.documentElement.classList.toggle('dark', nextTheme === 'dark');
			localStorage.setItem('watum-theme', nextTheme);
		}
	}

	onMount(() => {
		if (!browser) return;
		const storedTheme = localStorage.getItem('watum-theme');
		applyTheme(storedTheme === 'dark' ? 'dark' : 'light');
		const requestedView = readViewFromUrl();
		if (requestedView) {
			activeView = requestedView;
		}
		viewRestored = true;
	});

	function resetCollections() {
		classrooms = [];
		courses = [];
		students = [];
		lecturers = [];
		faculties = [];
		studyPrograms = [];
		enrollments = [];
		grades = [];
		users = [];
		collectionIssues = {};
	}

	async function loadCollection(
		key: DataCollectionKey,
		loader: () => Promise<void>,
		fallback: string
	) {
		try {
			await loader();
			clearCollectionIssue(key);
		} catch (error) {
			setCollectionIssue(key, errorMessage(error, fallback));
		}
	}

	async function refreshClassrooms(imperative = false) {
		classrooms = imperative ? await getClassRooms().run() : await getClassRooms();
	}

	async function refreshCourses(imperative = false) {
		courses = imperative ? await getCourses().run() : await getCourses();
	}

	async function refreshStudents(imperative = false) {
		students = imperative ? await getStudents().run() : await getStudents();
	}

	async function refreshLecturers(imperative = false) {
		lecturers = imperative ? await getLecturers().run() : await getLecturers();
	}

	async function refreshFaculties(imperative = false) {
		faculties = imperative ? await getFaculties().run() : await getFaculties();
	}

	async function refreshStudyPrograms(imperative = false) {
		studyPrograms = imperative ? await getStudyPrograms().run() : await getStudyPrograms();
	}

	async function refreshEnrollments(imperative = false) {
		enrollments = imperative ? await getEnrollments().run() : await getEnrollments();
	}

	async function refreshGrades(imperative = false) {
		grades = imperative ? await getGrades().run() : await getGrades();
	}

	async function refreshUsers(imperative = false) {
		users = imperative ? await getUsers().run() : await getUsers();
	}

	async function refreshAll() {
		if (!currentUser.current) return;
		appLoading = true;
		const role = currentUser.current.role;
		await Promise.all([
			loadCollection('classrooms', () => refreshClassrooms(), 'Ruang kelas gagal dimuat.'),
			loadCollection('courses', () => refreshCourses(), 'Mata kuliah gagal dimuat.'),
			loadCollection('lecturers', () => refreshLecturers(), 'Data dosen gagal dimuat.'),
			loadCollection('faculties', () => refreshFaculties(), 'Data fakultas gagal dimuat.'),
			loadCollection('studyPrograms', () => refreshStudyPrograms(), 'Program studi gagal dimuat.'),
			loadCollection('enrollments', () => refreshEnrollments(), 'Data KRS gagal dimuat.'),
			loadCollection('grades', () => refreshGrades(), 'Data nilai gagal dimuat.'),
			...(role === 'ADMIN' || role === 'LECTURER'
				? [loadCollection('students', () => refreshStudents(), 'Data mahasiswa gagal dimuat.')]
				: []),
			...(role === 'ADMIN'
				? [loadCollection('users', () => refreshUsers(), 'Data akun gagal dimuat.')]
				: [])
		]);
		appLoading = false;
	}

	$effect(() => {
		if (currentUser.loading || !currentUser.current) return;
		const role = currentUser.current?.role as AppRole | undefined;
		const allowedViews = navigationForRole(role);
		if (!allowedViews.includes(activeView)) {
			activeView = allowedViews[0] ?? 'dashboard';
		}
	});

	$effect(() => {
		if (!currentUser.current || !viewRestored) return;
		writeViewToUrl(activeView);
	});

	$effect(() => {
		const userId = currentUser.current?.id ?? null;
		if (!userId) {
			loadedForUserId = null;
			resetCollections();
			return;
		}
		if (loadedForUserId === userId) return;
		loadedForUserId = userId;
		void refreshAll();
	});

	const scheduleCards = $derived(buildScheduleCards(enrollments, timezone));
	const selectedSchedule = $derived(
		scheduleCards.find((item) => item.id === selectedScheduleId) ?? scheduleCards[0] ?? null
	);
	const selectedRoom = $derived(classrooms.find((item) => item.id === selectedRoomId) ?? null);
	const selectedCourse = $derived(courses.find((item) => item.id === selectedCourseId) ?? null);
	const selectedStudent = $derived(students.find((item) => item.id === selectedStudentId) ?? null);
	const selectedLecturer = $derived(
		lecturers.find((item) => item.id === selectedLecturerId) ?? null
	);
	const selectedFaculty = $derived(faculties.find((item) => item.id === selectedFacultyId) ?? null);
	const selectedStudyProgram = $derived(
		studyPrograms.find((item) => item.id === selectedStudyProgramId) ?? null
	);
	const selectedEnrollment = $derived(
		enrollments.find((item) => item.id === selectedEnrollmentId) ?? null
	);
	const selectedGrade = $derived(grades.find((item) => item.id === selectedGradeId) ?? null);
	const selectedUser = $derived(users.find((item) => item.id === selectedUserId) ?? null);
	const conflictCards = $derived(scheduleCards.filter((item) => item.hasConflict));
	const conflictGroups = $derived.by(() => {
		const seen = new Set<string>();
		return conflictCards.filter((item) => {
			const key = item.conflictGroupId ?? item.id;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	});
	const primaryConflict = $derived(conflictGroups[0] ?? null);
	const additionalConflictCount = $derived(Math.max(conflictGroups.length - 1, 0));
	const conflictCount = $derived(scheduleCards.filter((item) => item.hasConflict).length);
	const conflictPeersByCardId = $derived.by(() => {
		const groups = new Map<string, ScheduleCard[]>();
		for (const card of scheduleCards) {
			if (!card.hasConflict || !card.conflictGroupId) continue;
			const peers = groups.get(card.conflictGroupId) ?? [];
			peers.push(card);
			groups.set(card.conflictGroupId, peers);
		}

		const byCardId = new Map<string, ScheduleCard[]>();
		for (const group of groups.values()) {
			for (const card of group) {
				byCardId.set(
					card.id,
					group.filter((peer) => peer.id !== card.id)
				);
			}
		}

		return byCardId;
	});
	const conflictSummaryByCardId = $derived.by(() => {
		const summaries = new Map<string, string>();
		for (const [id, peers] of conflictPeersByCardId.entries()) {
			if (!peers.length) continue;
			const listedPeers = peers.slice(0, 2).map(conflictPeerLabel);
			const remaining = peers.length - listedPeers.length;
			const summary =
				remaining > 0
					? `${listedPeers.join('; ')}; dan ${remaining} jadwal lain`
					: listedPeers.join('; ');
			summaries.set(id, summary);
		}
		return summaries;
	});
	const overlapPeersByCardId = $derived.by(() => {
		const peers = new Map<string, ScheduleCard[]>();
		for (const card of scheduleCards) {
			peers.set(
				card.id,
				scheduleCards
					.filter((candidate) => schedulesOverlap(card, candidate))
					.sort((left, right) => left.startMinutes - right.startMinutes)
			);
		}
		return peers;
	});
	const nextSchedule = $derived(scheduleCards[0] ?? null);
	const underusedRooms = $derived(
		classrooms.filter((item) => (item.schedule_count ?? 0) === 0).length
	);
	const studentGradeHighlights = $derived(grades.slice(0, 3));

	const filteredClassrooms = $derived(
		classrooms.filter(
			(item) =>
				matchesText(item.name, roomSearch) ||
				matchesText(beautifyRoomType(item.class_room_type), roomSearch)
		)
	);
	const filteredCourses = $derived(
		courses.filter(
			(item) =>
				matchesText(item.id, courseSearch) ||
				matchesText(item.name, courseSearch) ||
				matchesText(item.lecturer_name, courseSearch)
		)
	);
	const filteredStudents = $derived(
		students.filter(
			(item) =>
				matchesText(item.id, studentSearch) ||
				matchesText(item.name, studentSearch) ||
				matchesText(item.study_program_name, studentSearch)
		)
	);
	const filteredLecturers = $derived(
		lecturers.filter(
			(item) =>
				matchesText(item.id, lecturerSearch) ||
				matchesText(item.name, lecturerSearch) ||
				matchesText(item.email, lecturerSearch)
		)
	);
	const filteredFaculties = $derived(
		faculties.filter(
			(item) => matchesText(item.id, facultySearch) || matchesText(item.name, facultySearch)
		)
	);
	const filteredStudyPrograms = $derived(
		studyPrograms.filter(
			(item) =>
				matchesText(item.id, studyProgramSearch) ||
				matchesText(item.name, studyProgramSearch) ||
				matchesText(item.faculty_name, studyProgramSearch)
		)
	);
	const filteredEnrollments = $derived(
		enrollments.filter(
			(item) =>
				matchesText(item.student_name, enrollmentSearch) ||
				matchesText(item.course_name, enrollmentSearch) ||
				matchesText(item.class_room_name, enrollmentSearch)
		)
	);
	const filteredGrades = $derived(
		grades.filter(
			(item) =>
				matchesText(item.student_name, gradeSearch) ||
				matchesText(item.course_name, gradeSearch) ||
				matchesText(item.letter_grade, gradeSearch)
		)
	);
	const filteredUsers = $derived(
		users.filter(
			(item) =>
				matchesText(item.email, userSearch) ||
				matchesText(item.student_name, userSearch) ||
				matchesText(item.lecturer_name, userSearch)
		)
	);

	const availableRoomOptions = $derived.by(() => {
		if (!enrollmentDraft.startTime || !enrollmentDraft.endTime) return classrooms;
		const startMinutes = toMinutes(parseISO(enrollmentDraft.startTime, timezone), timezone);
		const endMinutes = toMinutes(parseISO(enrollmentDraft.endTime, timezone), timezone);
		return availableRoomsForSlot(
			classrooms,
			scheduleCards,
			enrollmentDraft.day,
			startMinutes,
			endMinutes,
			selectedEnrollmentId
		);
	});
	const participantStepReady = $derived(
		Boolean(enrollmentDraft.studentId && enrollmentDraft.courseId)
	);
	const timeStepReady = $derived(
		Boolean(
			enrollmentDraft.day &&
			enrollmentDraft.startTime &&
			enrollmentDraft.endTime &&
			enrollmentDraft.semester &&
			enrollmentDraft.academicYear
		) && enrollmentDraft.startTime < enrollmentDraft.endTime
	);
	const roomStepReady = $derived(Boolean(enrollmentDraft.classRoomId));
	const builderTaskMode = $derived(Boolean(selectedEnrollmentId || builderStep !== 'participant'));
	const selectedDraftStudent = $derived(
		students.find((item) => item.id === enrollmentDraft.studentId)?.name ?? 'Belum dipilih'
	);
	const selectedDraftCourse = $derived(
		courses.find((item) => item.id === enrollmentDraft.courseId)?.name ?? 'Belum dipilih'
	);
	const selectedDraftRoom = $derived(
		classrooms.find((item) => item.id === enrollmentDraft.classRoomId)?.name ?? 'Belum dipilih'
	);
	const draftTimeSummary = $derived.by(() => {
		if (!timeStepReady) return 'Belum ditetapkan';
		const dayLabel = DAY_LABELS[enrollmentDraft.day as keyof typeof DAY_LABELS];
		return `${dayLabel} • ${formatTimeRange(parseISO(enrollmentDraft.startTime, timezone), parseISO(enrollmentDraft.endTime, timezone), timezone)}`;
	});

	function canOpenBuilderStep(step: BuilderStep) {
		if (step === 'participant') return true;
		if (step === 'time') return participantStepReady;
		if (step === 'room') return participantStepReady && timeStepReady;
		return participantStepReady && timeStepReady && roomStepReady;
	}

	function setBuilderStep(step: BuilderStep) {
		if (!canOpenBuilderStep(step)) return;
		builderStep = step;
	}

	function advanceBuilderStep() {
		if (builderStep === 'participant' && participantStepReady) {
			builderStep = 'time';
			return;
		}
		if (builderStep === 'time' && timeStepReady) {
			builderStep = 'room';
			return;
		}
		if (builderStep === 'room' && roomStepReady) {
			builderStep = 'review';
		}
	}

	function retreatBuilderStep() {
		if (builderStep === 'review') {
			builderStep = 'room';
			return;
		}
		if (builderStep === 'room') {
			builderStep = 'time';
			return;
		}
		if (builderStep === 'time') {
			builderStep = 'participant';
		}
	}

	function stepState(step: BuilderStep) {
		if (builderStep === step) return 'active';
		if (
			(step === 'participant' && participantStepReady) ||
			(step === 'time' && timeStepReady) ||
			(step === 'room' && roomStepReady)
		) {
			return 'complete';
		}
		return canOpenBuilderStep(step) ? 'available' : 'locked';
	}

	function pickClassroom(item: any) {
		pendingDelete = null;
		stopEditing();
		selectedRoomId = item.id;
		classroomDraft = {
			name: item.name ?? '',
			classRoomType: item.class_room_type ?? 'REGULER',
			capacity: item.capacity ?? 30,
			hasProjector: Boolean(item.has_projector),
			hasAC: Boolean(item.has_ac)
		};
	}

	function pickCourse(item: any) {
		pendingDelete = null;
		stopEditing();
		selectedCourseId = item.id;
		courseDraft = {
			id: item.id ?? '',
			name: item.name ?? '',
			credits: item.credits ?? 3,
			studyProgramId: item.study_program_id ?? '',
			lecturerId: item.lecturer_id ?? ''
		};
	}

	function pickStudent(item: any) {
		pendingDelete = null;
		stopEditing();
		selectedStudentId = item.id;
		studentDraft = {
			name: item.name ?? '',
			email: item.email ?? '',
			phone: item.phone ?? '',
			address: item.address ?? '',
			yearAdmitted: item.year_admitted ?? 2024,
			studyProgramId: item.study_program_id ?? ''
		};
	}

	function pickLecturer(item: any) {
		pendingDelete = null;
		stopEditing();
		selectedLecturerId = item.id;
		lecturerDraft = {
			id: item.id ?? '',
			name: item.name ?? '',
			email: item.email ?? '',
			phone: item.phone ?? '',
			address: item.address ?? ''
		};
	}

	function pickFaculty(item: any) {
		pendingDelete = null;
		stopEditing();
		selectedFacultyId = item.id;
		facultyDraft = { id: item.id ?? '', name: item.name ?? '' };
	}

	function pickStudyProgram(item: any) {
		pendingDelete = null;
		stopEditing();
		selectedStudyProgramId = item.id;
		studyProgramDraft = {
			id: item.id ?? '',
			name: item.name ?? '',
			head: item.head ?? '',
			facultyId: item.faculty_id ?? ''
		};
	}

	function pickEnrollment(item: any) {
		pendingDelete = null;
		selectedEnrollmentId = item.id;
		builderStep = 'review';
		enrollmentDraft = {
			id: item.id ?? '',
			studentId: item.student_id ?? '',
			courseId: item.course_id ?? '',
			classRoomId: item.class_room_id ?? '',
			day: item.schedule_day ?? 'SENIN',
			startTime: item.schedule_start_time
				? formatDateTimeInput(item.schedule_start_time, timezone)
				: '',
			endTime: item.schedule_end_time ? formatDateTimeInput(item.schedule_end_time, timezone) : '',
			semester: item.semester ?? 'Ganjil',
			academicYear: item.academic_year ?? '2025/2026',
			timezone
		};
	}

	function pickGrade(item: any) {
		pendingDelete = null;
		stopEditing();
		selectedGradeId = item.id;
		gradeDraft = {
			id: item.id ?? '',
			enrollmentId: item.enrollment_id ?? '',
			assignmentScore: item.assignment_score ?? 80,
			midtermScore: item.midterm_score ?? 80,
			finalScore: item.final_score ?? 80
		};
	}

	function pickUser(item: any) {
		pendingDelete = null;
		stopEditing();
		selectedUserId = item.id;
		userDraft = {
			id: item.id ?? '',
			email: item.email ?? '',
			password: '',
			role: item.role ?? 'ADMIN',
			studentId: item.student_id ?? '',
			lecturerId: item.lecturer_id ?? ''
		};
	}

	function clearSelection(view: ViewId) {
		pendingDelete = null;
		if (view === 'classrooms') {
			selectedRoomId = null;
			classroomDraft = emptyClassRoomDraft();
		}
		if (view === 'courses') {
			selectedCourseId = null;
			courseDraft = emptyCourseDraft();
		}
		if (view === 'students') {
			selectedStudentId = null;
			studentDraft = emptyStudentDraft();
		}
		if (view === 'lecturers') {
			selectedLecturerId = null;
			lecturerDraft = emptyLecturerDraft();
		}
		if (view === 'faculties') {
			selectedFacultyId = null;
			facultyDraft = emptyFacultyDraft();
		}
		if (view === 'studyPrograms') {
			selectedStudyProgramId = null;
			studyProgramDraft = emptyStudyProgramDraft();
		}
		if (view === 'enrollments' || view === 'builder') {
			selectedEnrollmentId = null;
			enrollmentDraft = emptyEnrollmentDraft();
			builderStep = 'participant';
		}
		if (view === 'grades') {
			selectedGradeId = null;
			gradeDraft = emptyGradeDraft();
		}
		if (view === 'users') {
			selectedUserId = null;
			userDraft = emptyUserDraft();
		}
	}

	function beginCreate(view: EditableView) {
		clearSelection(view);
		pendingDelete = null;
		editorView = view;
	}

	function beginEdit(view: EditableView) {
		pendingDelete = null;
		editorView = view;
	}

	function stopEditing(view?: EditableView) {
		pendingDelete = null;
		if (!view || editorView === view) editorView = null;
	}

	function requestDelete(kind: DeleteKind, id: string) {
		if (!id) return;
		if (kind === 'classroom') {
			pendingDelete = {
				kind,
				id,
				label: selectedRoom?.name ?? 'ruang ini',
				message:
					'Ruang ini akan keluar dari daftar inventaris. Pastikan jadwal yang masih bergantung pada ruang ini sudah Anda tinjau.',
				confirmLabel: 'Ya, hapus ruang',
				successMessage: 'Ruang berhasil dihapus dari inventaris.',
				failureMessage: 'Ruang gagal dihapus. Periksa kembali apakah ruang masih dipakai.'
			};
			return;
		}
		if (kind === 'course') {
			pendingDelete = {
				kind,
				id,
				label: selectedCourse?.name ?? 'mata kuliah ini',
				message:
					'Mata kuliah ini akan keluar dari katalog operasional. Pastikan perubahan ini tidak mengganggu penjadwalan atau KRS yang masih berjalan.',
				confirmLabel: 'Ya, hapus mata kuliah',
				successMessage: 'Mata kuliah berhasil dihapus dari katalog.',
				failureMessage: 'Mata kuliah gagal dihapus. Tinjau lagi keterkaitan jadwal dan KRS.'
			};
			return;
		}
		if (kind === 'student') {
			pendingDelete = {
				kind,
				id,
				label: selectedStudent?.name ?? 'mahasiswa ini',
				message:
					'Data mahasiswa ini akan hilang dari operasi akademik harian. Pastikan Anda tidak sedang membutuhkan rekam identitas ini untuk proses aktif.',
				confirmLabel: 'Ya, hapus mahasiswa',
				successMessage: 'Mahasiswa berhasil dihapus dari data aktif.',
				failureMessage: 'Mahasiswa gagal dihapus. Tinjau kembali hubungan data yang masih aktif.'
			};
			return;
		}
		if (kind === 'lecturer') {
			pendingDelete = {
				kind,
				id,
				label: selectedLecturer?.name ?? 'dosen ini',
				message:
					'Dosen ini akan keluar dari daftar pengampu. Pastikan jadwal, mata kuliah, dan relasi akun yang terkait sudah Anda cek.',
				confirmLabel: 'Ya, hapus dosen',
				successMessage: 'Dosen berhasil dihapus dari daftar pengampu.',
				failureMessage:
					'Dosen gagal dihapus. Tinjau kembali jadwal atau relasi akun yang masih terhubung.'
			};
			return;
		}
		if (kind === 'faculty') {
			pendingDelete = {
				kind,
				id,
				label: selectedFaculty?.name ?? 'fakultas ini',
				message:
					'Fakultas ini akan keluar dari struktur akademik. Pastikan perubahan ini tidak memutus program studi yang masih dipakai.',
				confirmLabel: 'Ya, hapus fakultas',
				successMessage: 'Fakultas berhasil dihapus dari struktur akademik.',
				failureMessage:
					'Fakultas gagal dihapus. Tinjau kembali struktur program studi yang terkait.'
			};
			return;
		}
		if (kind === 'studyProgram') {
			pendingDelete = {
				kind,
				id,
				label: selectedStudyProgram?.name ?? 'program studi ini',
				message:
					'Program studi ini akan keluar dari struktur akademik. Pastikan mahasiswa atau mata kuliah terkait sudah Anda tinjau sebelum melanjutkan.',
				confirmLabel: 'Ya, hapus program studi',
				successMessage: 'Program studi berhasil dihapus dari struktur akademik.',
				failureMessage: 'Program studi gagal dihapus. Tinjau kembali data yang masih terhubung.'
			};
			return;
		}
		if (kind === 'enrollment') {
			pendingDelete = {
				kind,
				id,
				label: selectedEnrollment?.course_name ?? 'jadwal ini',
				message:
					'KRS dan jadwal ini akan dihapus dari periode aktif. Pastikan perubahan ini memang final sebelum Anda mengonfirmasi.',
				confirmLabel: 'Ya, hapus jadwal',
				successMessage: 'Jadwal berhasil dihapus dari periode aktif.',
				failureMessage: 'Jadwal gagal dihapus. Tinjau kembali data KRS yang masih dipakai.'
			};
			return;
		}
		pendingDelete = {
			kind,
			id,
			label: selectedGrade?.course_name ?? 'nilai ini',
			message:
				'Nilai ini akan keluar dari rekap hasil. Jika masih diperlukan, Anda harus menginput ulang setelah penghapusan.',
			confirmLabel: 'Ya, hapus nilai',
			successMessage: 'Nilai berhasil dihapus dari rekap hasil.',
			failureMessage: 'Nilai gagal dihapus. Tinjau kembali apakah data masih dipakai di rekap.'
		};
	}

	function createEnhancer(form: any, onSuccess: () => Promise<void> | void) {
		return form.enhance(async ({ submit }: { submit: () => Promise<void> }) => {
			try {
				await submit();
				const issue = firstIssue(form);
				if (issue) {
					setFeedback('danger', issue);
					return;
				}
				await onSuccess();
			} catch (error) {
				const message = (error as { body?: { message?: string }; message?: string })?.body?.message;
				setFeedback('danger', message || (error as Error).message || 'Aksi gagal diproses.');
			}
		});
	}

	const loginEnhance = loginUser.enhance(async ({ submit }: { submit: () => Promise<void> }) => {
		try {
			await submit();
			const issue = firstIssue(loginUser);
			if (issue) {
				setFeedback('danger', issue);
				return;
			}
			await currentUser.refresh();
			setFeedback('success', 'Sesi berhasil dibuka.');
		} catch (error) {
			const message = (error as { body?: { message?: string }; message?: string })?.body?.message;
			setFeedback('danger', message || 'Login gagal.');
		}
	});

	const logoutEnhance = logoutUser.enhance(async ({ submit }: { submit: () => Promise<void> }) => {
		await submit();
		await currentUser.refresh();
		resetCollections();
		setFeedback('success', 'Sesi berhasil ditutup.');
	});

	const createClassRoomEnhance = createEnhancer(createClassRoom, async () => {
		await refreshClassrooms(true);
		clearSelection('classrooms');
		stopEditing('classrooms');
		setFeedback('success', 'Ruang kelas baru berhasil ditambahkan.');
	});
	const updateClassRoomEnhance = createEnhancer(updateClassRoom, async () => {
		await refreshClassrooms(true);
		stopEditing('classrooms');
		setFeedback('success', 'Data ruang kelas berhasil diperbarui.');
	});
	const createCourseEnhance = createEnhancer(createCourse, async () => {
		await refreshCourses(true);
		clearSelection('courses');
		stopEditing('courses');
		setFeedback('success', 'Mata kuliah baru berhasil ditambahkan.');
	});
	const updateCourseEnhance = createEnhancer(updateCourse, async () => {
		await refreshCourses(true);
		stopEditing('courses');
		setFeedback('success', 'Mata kuliah berhasil diperbarui.');
	});
	const createStudentEnhance = createEnhancer(createStudent, async () => {
		await refreshStudents(true);
		clearSelection('students');
		stopEditing('students');
		setFeedback('success', 'Mahasiswa baru berhasil ditambahkan.');
	});
	const updateStudentEnhance = createEnhancer(updateStudent, async () => {
		await refreshStudents(true);
		stopEditing('students');
		setFeedback('success', 'Profil mahasiswa berhasil diperbarui.');
	});
	const createLecturerEnhance = createEnhancer(createLecturer, async () => {
		await refreshLecturers(true);
		clearSelection('lecturers');
		stopEditing('lecturers');
		setFeedback('success', 'Dosen baru berhasil ditambahkan.');
	});
	const updateLecturerEnhance = createEnhancer(updateLecturer, async () => {
		await refreshLecturers(true);
		stopEditing('lecturers');
		setFeedback('success', 'Profil dosen berhasil diperbarui.');
	});
	const createFacultyEnhance = createEnhancer(createFaculty, async () => {
		await refreshFaculties(true);
		clearSelection('faculties');
		stopEditing('faculties');
		setFeedback('success', 'Fakultas baru berhasil ditambahkan.');
	});
	const updateFacultyEnhance = createEnhancer(updateFaculty, async () => {
		await refreshFaculties(true);
		stopEditing('faculties');
		setFeedback('success', 'Data fakultas berhasil diperbarui.');
	});
	const createStudyProgramEnhance = createEnhancer(createStudyProgram, async () => {
		await refreshStudyPrograms(true);
		clearSelection('studyPrograms');
		stopEditing('studyPrograms');
		setFeedback('success', 'Program studi baru berhasil ditambahkan.');
	});
	const updateStudyProgramEnhance = createEnhancer(updateStudyProgram, async () => {
		await refreshStudyPrograms(true);
		stopEditing('studyPrograms');
		setFeedback('success', 'Program studi berhasil diperbarui.');
	});
	const createEnrollmentEnhance = createEnhancer(createEnrollment, async () => {
		await refreshEnrollments(true);
		clearSelection('builder');
		setFeedback(
			'success',
			'Jadwal dan KRS tersimpan. Lanjutkan hanya bila ruang dan jam sudah sesuai.'
		);
	});
	const updateEnrollmentEnhance = createEnhancer(updateEnrollment, async () => {
		await refreshEnrollments(true);
		setFeedback(
			'success',
			'Jadwal diperbarui. Periksa kembali konflik dan kecocokan ruang sebelum menutup halaman.'
		);
	});
	const createGradeEnhance = createEnhancer(createGrade, async () => {
		await refreshGrades(true);
		clearSelection('grades');
		stopEditing('grades');
		setFeedback('success', 'Nilai baru berhasil disimpan.');
	});
	const updateGradeEnhance = createEnhancer(updateGrade, async () => {
		await refreshGrades(true);
		stopEditing('grades');
		setFeedback('success', 'Nilai berhasil diperbarui.');
	});
	const updateUserEnhance = createEnhancer(updateUser, async () => {
		await refreshUsers(true);
		stopEditing('users');
		setFeedback('success', 'Akun diperbarui. Perubahan akses akan dipakai pada sesi berikutnya.');
	});

	async function removeEntity(kind: DeleteKind, id: string) {
		const intent = pendingDelete;
		try {
			if (kind === 'classroom') {
				await deleteClassRoom(id);
				await refreshClassrooms(true);
				clearSelection('classrooms');
				stopEditing('classrooms');
			}
			if (kind === 'course') {
				await deleteCourse(id);
				await refreshCourses(true);
				clearSelection('courses');
				stopEditing('courses');
			}
			if (kind === 'student') {
				await deleteStudent(id);
				await refreshStudents(true);
				clearSelection('students');
				stopEditing('students');
			}
			if (kind === 'lecturer') {
				await deleteLecturer(id);
				await refreshLecturers(true);
				clearSelection('lecturers');
				stopEditing('lecturers');
			}
			if (kind === 'faculty') {
				await deleteFaculty(id);
				await refreshFaculties(true);
				clearSelection('faculties');
				stopEditing('faculties');
			}
			if (kind === 'studyProgram') {
				await deleteStudyProgram(id);
				await refreshStudyPrograms(true);
				clearSelection('studyPrograms');
				stopEditing('studyPrograms');
			}
			if (kind === 'enrollment') {
				await deleteEnrollment(id);
				await refreshEnrollments(true);
				clearSelection('builder');
			}
			if (kind === 'grade') {
				await deleteGrade(id);
				await refreshGrades(true);
				clearSelection('grades');
				stopEditing('grades');
			}
			pendingDelete = null;
			setFeedback('success', intent?.successMessage ?? 'Data berhasil dihapus.');
		} catch (error) {
			const message = (error as { body?: { message?: string }; message?: string })?.body?.message;
			setFeedback('danger', message || intent?.failureMessage || 'Penghapusan gagal.');
		}
	}

	const navigationGroups = $derived(
		navigationGroupsForRole(currentUser.current?.role as AppRole | undefined)
	);
	const secondaryNavigationGroups = $derived(
		secondaryGroupsForRole(currentUser.current?.role as AppRole | undefined)
	);
	const primaryHomeView = $derived(navigationGroups[0]?.views[0] ?? 'dashboard');
	const supportHomeView = $derived(secondaryNavigationGroups[0]?.views[0] ?? null);
	const secondaryActive = $derived(
		isSecondaryView(activeView, currentUser.current?.role as AppRole | undefined)
	);
	const activeNavigationGroup = $derived(
		navigationGroups.find((group) => group.views.includes(activeView)) ?? null
	);
	const activeSecondaryGroup = $derived(
		secondaryNavigationGroups.find((group) => group.views.includes(activeView)) ?? null
	);
	const currentHeaderAction = $derived(
		headerAction(activeView, currentUser.current?.role as AppRole | undefined)
	);
	const activeViewIssues = $derived.by(() => {
		const role = currentUser.current?.role as AppRole | undefined;
		const keys: DataCollectionKey[] =
			activeView === 'dashboard'
				? role === 'STUDENT'
					? ['enrollments', 'grades']
					: ['enrollments', 'classrooms']
				: activeView === 'calendar'
					? ['enrollments']
					: activeView === 'builder'
						? ['enrollments', 'students', 'courses', 'classrooms']
						: activeView === 'classrooms'
							? ['classrooms']
							: activeView === 'courses'
								? ['courses', 'studyPrograms', 'lecturers']
								: activeView === 'students'
									? ['students', 'studyPrograms']
									: activeView === 'lecturers'
										? ['lecturers']
										: activeView === 'faculties'
											? ['faculties']
											: activeView === 'studyPrograms'
												? ['studyPrograms', 'faculties']
												: activeView === 'enrollments'
													? ['enrollments']
													: activeView === 'grades'
														? ['grades', 'enrollments']
														: ['users'];

		return keys
			.map((key) => collectionIssues[key])
			.filter((message): message is string => Boolean(message));
	});
	const courseEditorBlocked = $derived(
		Boolean(collectionIssues.studyPrograms || collectionIssues.lecturers) &&
			(!studyPrograms.length || !lecturers.length)
	);
	const studentEditorBlocked = $derived(
		Boolean(collectionIssues.studyPrograms) && !studyPrograms.length
	);
	const studyProgramEditorBlocked = $derived(
		Boolean(collectionIssues.faculties) && !faculties.length
	);
	const gradeEditorBlocked = $derived(Boolean(collectionIssues.enrollments) && !enrollments.length);
	const scheduleCardMap = $derived(new Map(scheduleCards.map((card) => [card.id, card])));
	const selectedScheduleConflictSummary = $derived(
		selectedSchedule ? (conflictSummaryByCardId.get(selectedSchedule.id) ?? null) : null
	);
	const selectedScheduleOverlapPeers = $derived(
		selectedSchedule ? (overlapPeersByCardId.get(selectedSchedule.id) ?? []) : []
	);
	const selectedEnrollmentScheduleCard = $derived(
		selectedEnrollmentId ? (scheduleCardMap.get(selectedEnrollmentId) ?? null) : null
	);
	const selectedEnrollmentConflictSummary = $derived(
		selectedEnrollmentId ? (conflictSummaryByCardId.get(selectedEnrollmentId) ?? null) : null
	);
</script>

<svelte:head>
	<title>Watum</title>
</svelte:head>

{#if currentUser.loading}{:else if currentUser.current}
	<div class={`app-shell ${currentUser.current.role === 'STUDENT' ? 'student-app-shell' : ''}`}>
		{#if currentUser.current.role !== 'STUDENT'}
			<aside class="rail">
				<div class="rail-brand">
					<h1>Operasi Akademik</h1>
					<p class="brand-copy">
						Ruang utama dipakai untuk bentrok, kalender, pembuat jadwal, dan kondisi ruang yang
						perlu ditindak.
					</p>
				</div>

				<nav class="rail-sections">
					{#each navigationGroups as group (group.label)}
						{@const Icon = group.icon}
						<Button
							class={`nav-item nav-group ${activeNavigationGroup?.id === group.id ? 'selected' : ''}`}
							variant={activeNavigationGroup?.id === group.id ? 'default' : 'ghost'}
							size="sm"
							onclick={() =>
								activateView(group.views.includes(activeView) ? activeView : group.views[0])}
						>
							<Icon size={18} />
							<span class="nav-group-copy">
								<strong>{group.label}</strong>
							</span>
						</Button>
					{/each}
				</nav>

				<Separator />
			</aside>
		{/if}

		<main class={`main-shell ${currentUser.current.role === 'STUDENT' ? 'student-shell' : ''}`}>
			<header class="topbar">
				<div class="topbar-copy">
					<h2>{pageHeading(activeView)}</h2>
				</div>

				<div class="topbar-tools">
					<div class="user-pill">
						<Badge variant="outline">{currentUser.current.role}</Badge>
						<span class="user-pill-label"
							>{currentUser.current.student?.name ??
								currentUser.current.lecturer?.name ??
								currentUser.current.email}</span
						>
					</div>

					{#if currentHeaderAction}
						<Button
							class="primary-button header-action"
							size="sm"
							onclick={() => activateView(currentHeaderAction.target)}
						>
							{currentHeaderAction.label}
						</Button>
					{/if}

					<Button
						class="theme-switch"
						variant="outline"
						size="sm"
						onclick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')}
					>
						{#if theme === 'dark'}
							<SunMedium size={16} />
							<span>Mode terang</span>
						{:else}
							<MoonStar size={16} />
							<span>Mode gelap</span>
						{/if}
					</Button>

					<form {...logoutEnhance}>
						<Button type="submit" variant="ghost" size="sm" class="ghost-button">Keluar</Button>
					</form>
				</div>
			</header>

			{#if currentUser.current.role !== 'STUDENT' && secondaryNavigationGroups.length}
				<nav class="section-tabs section-tabs-compact" aria-label="Area kerja">
					<Button
						class={`section-tab ${!secondaryActive ? 'selected' : ''}`}
						variant={!secondaryActive ? 'default' : 'ghost'}
						size="sm"
						onclick={() => activateView(primaryHomeView)}
					>
						<span>Ruang utama</span>
					</Button>
					{#if supportHomeView}
						<Button
							class={`section-tab ${secondaryActive ? 'selected' : ''}`}
							variant={secondaryActive ? 'default' : 'ghost'}
							size="sm"
							onclick={() => activateView(supportHomeView)}
						>
							<span>Area pendukung</span>
						</Button>
					{/if}
				</nav>
			{/if}

			{#if !secondaryActive && activeNavigationGroup && activeNavigationGroup.views.length > 1}
				<nav class="section-tabs" aria-label={`Subbagian ${activeNavigationGroup.label}`}>
					{#each activeNavigationGroup.views as item (item)}
						<Button
							class={`section-tab ${activeView === item ? 'selected' : ''}`}
							variant={activeView === item ? 'default' : 'ghost'}
							size="sm"
							onclick={() => activateView(item)}
						>
							<span>{viewCatalog[item].label}</span>
						</Button>
					{/each}
				</nav>
			{/if}

			{#if secondaryActive && secondaryNavigationGroups.length && currentUser.current.role !== 'STUDENT'}
				{#if secondaryNavigationGroups.length > 1}
					<nav class="section-tabs section-tabs-compact" aria-label="Kelompok area pendukung">
						{#each secondaryNavigationGroups as group (group.id)}
							<Button
								class={`section-tab ${activeSecondaryGroup?.id === group.id ? 'selected' : ''}`}
								variant={activeSecondaryGroup?.id === group.id ? 'default' : 'ghost'}
								size="sm"
								onclick={() => activateView(group.views[0])}
							>
								<span>{group.label}</span>
							</Button>
						{/each}
					</nav>
				{/if}

				{#if activeSecondaryGroup && activeSecondaryGroup.views.length > 1}
					<nav class="section-tabs" aria-label={`Subbagian ${activeSecondaryGroup.label}`}>
						{#each activeSecondaryGroup.views as item (item)}
							<Button
								class={`section-tab ${activeView === item ? 'selected' : ''}`}
								variant={activeView === item ? 'default' : 'ghost'}
								size="sm"
								onclick={() => activateView(item)}
							>
								<span>{viewCatalog[item].label}</span>
							</Button>
						{/each}
					</nav>
				{/if}
			{/if}

			{#if secondaryActive && secondaryNavigationGroups.length && currentUser.current.role === 'STUDENT'}
				<nav class="section-tabs" aria-label="Referensi mahasiswa">
					{#each secondaryNavigationGroups[0].views as item (item)}
						<Button
							class={`section-tab ${activeView === item ? 'selected' : ''}`}
							variant={activeView === item ? 'default' : 'ghost'}
							size="sm"
							onclick={() => activateView(item)}
						>
							<span>{viewCatalog[item].label}</span>
						</Button>
					{/each}
				</nav>
			{/if}

			{#if feedback}
				<div class={`feedback ${feedback.tone}`}>
					<AlertCircle size={16} />
					<span>{feedback.text}</span>
				</div>
			{/if}

			{#if appLoading}
				<div class="loading-panel">Memuat data akademik...</div>
			{/if}

			{#if activeViewIssues.length}
				<section class="support-warning">
					<p class="warning-title">Sebagian data pendukung belum tersedia</p>
					<ul class="support-warning-list">
						{#each activeViewIssues as issue, index (`${activeView}-${index}`)}
							<li>{issue}</li>
						{/each}
					</ul>
					<p class="detail-hint">
						Bagian lain tetap bisa dipakai. Muat ulang halaman atau kembali nanti untuk mengambil
						data yang belum berhasil dimuat.
					</p>
				</section>
			{/if}

			{#if activeView === 'dashboard'}
				<div class="dashboard-stack">
					{#if currentUser.current.role === 'STUDENT'}
						<section class="student-dashboard">
							<article class="student-hero">
								<div class="student-hero-copy">
									<span>Sesi terdekat</span>
									<strong>{nextSchedule ? nextSchedule.course : 'Belum ada sesi terjadwal'}</strong>
									<p>
										{#if nextSchedule}
											{DAY_LABELS[nextSchedule.day]} • {nextSchedule.startLabel} - {nextSchedule.endLabel}
											• {nextSchedule.room}
										{:else}
											Kalender mingguan akan membantu Anda melihat perubahan ruang dan sesi
											berikutnya.
										{/if}
									</p>
								</div>
								<div class="decision-actions student-actions">
									<Button class="primary-button" onclick={() => activateView('calendar')}
										>Lihat kalender</Button
									>
									<Button
										class="ghost-button"
										variant="ghost"
										onclick={() => activateView('grades')}>Lihat nilai</Button
									>
								</div>
							</article>

							<section class="student-summary-row">
								<div>
									<span>KRS aktif</span>
									<strong>{enrollments.length} sesi tercatat</strong>
								</div>
								<div>
									<span>Nilai tersedia</span>
									<strong>{grades.length} hasil sudah masuk</strong>
								</div>
								<div>
									<span>Ruang yang dipakai</span>
									<strong>{nextSchedule ? nextSchedule.room : 'Belum ditentukan'}</strong>
								</div>
							</section>

							{#if studentGradeHighlights.length}
								<section class="student-grade-list">
									<h3>Ringkasan hasil terbaru</h3>
									<div class="student-grade-items">
										{#each studentGradeHighlights as item (item.id)}
											<div>
												<span>{item.course_name}</span>
												<strong>{item.letter_grade ?? '-'}</strong>
											</div>
										{/each}
									</div>
								</section>
							{/if}
						</section>
					{:else}
						<section class="decision-board">
							<article
								class="decision-lead"
								class:decision-alert={conflictCount > 0}
								class:decision-steady={conflictCount === 0}
							>
								<h3 class="decision-title">
									{#if conflictCount > 0}
										{conflictCount} bentrok perlu keputusan cepat
									{:else if nextSchedule}
										Jadwal hari ini siap dijalankan
									{:else}
										Belum ada sesi aktif yang perlu ditata
									{/if}
								</h3>
								<p class="decision-summary">
									{dashboardPriorityLabel(currentUser.current.role as AppRole)}
								</p>

								{#if primaryConflict}
									<section class="decision-primary">
										<div class="decision-primary-copy">
											<span>Bentrok paling dekat</span>
											<strong>{primaryConflict.course}</strong>
											<p>
												{DAY_LABELS[primaryConflict.day]} • {primaryConflict.startLabel} - {primaryConflict.endLabel}
												• {primaryConflict.room}
											</p>
										</div>
										{#if additionalConflictCount > 0}
											<p class="decision-secondary-count">
												+{additionalConflictCount} bentrok lain masih menunggu keputusan
											</p>
										{/if}
									</section>
								{:else if nextSchedule}
									<section class="decision-primary decision-primary-steady">
										<div class="decision-primary-copy">
											<span>Sesi berikutnya</span>
											<strong>{nextSchedule.course}</strong>
											<p>
												{DAY_LABELS[nextSchedule.day]} • {nextSchedule.startLabel} - {nextSchedule.endLabel}
												• {nextSchedule.room}
											</p>
										</div>
									</section>
								{/if}

								<div class="decision-actions">
									<Button class="primary-button" onclick={() => activateView('builder')}
										>Buka pembuat jadwal</Button
									>
									<Button
										class="ghost-button"
										variant="ghost"
										onclick={() => activateView('calendar')}>Lihat kalender</Button
									>
								</div>
							</article>

							<aside class="decision-notes">
								<div class="decision-note-row">
									<span>Fokus saat ini</span>
									<strong>{dashboardFocusLabel(currentUser.current.role as AppRole)}</strong>
								</div>
								<div class="decision-note-row">
									<span>Ruang longgar</span>
									<strong>{underusedRooms} ruang masih bisa dipadatkan</strong>
								</div>
								<div class="decision-note-row">
									<span>Sesi berikutnya</span>
									<strong>{nextSchedule ? nextSchedule.course : 'Belum ada sesi terjadwal'}</strong>
								</div>
							</aside>
						</section>

						<ClassroomDashboard
							role={currentUser.current.role as AppRole}
							{classrooms}
							cards={scheduleCards}
							{timezone}
							{selectedRoomId}
							onPickRoom={(id) => (selectedRoomId = id)}
						/>
					{/if}
				</div>
			{/if}

			{#if activeView === 'calendar'}
				<div class="calendar-layout">
					<WeeklyCalendar
						title="Kalender kuliah mingguan"
						subtitle=""
						cards={scheduleCards}
						selectedId={selectedSchedule?.id ?? null}
						onSelect={(card) => (selectedScheduleId = card.id)}
					/>

					<section
						class="detail-card"
						class:calendar-conflict={selectedSchedule?.hasConflict}
						style={conflictToneVariables(selectedSchedule?.conflictTone ?? null)}
					>
						{#if selectedSchedule}
							<div class="pane-head compact">
								<div>
									<h3>{selectedSchedule.course}</h3>
									{#if selectedSchedule.hasConflict && selectedScheduleConflictSummary}
										<p class="calendar-conflict-copy">
											Bentrok dengan {selectedScheduleConflictSummary}
										</p>
									{/if}
								</div>
								<Button
									class="ghost-button"
									variant="ghost"
									size="sm"
									onclick={() => openBuilderForSchedule(selectedSchedule)}
								>
									Buka di pembuat jadwal
								</Button>
							</div>
							<div class="detail-lines">
								<div><span>Hari</span><strong>{DAY_LABELS[selectedSchedule.day]}</strong></div>
								<div>
									<span>Jam</span><strong
										>{selectedSchedule.startLabel} - {selectedSchedule.endLabel}</strong
									>
								</div>
								<div><span>Ruang</span><strong>{selectedSchedule.room}</strong></div>
								<div><span>Dosen</span><strong>{selectedSchedule.lecturer}</strong></div>
								<div>
									<span>Semester</span><strong
										>{selectedSchedule.semester} • {selectedSchedule.academicYear}</strong
									>
								</div>
								<div>
									<span>Status</span><strong
										class:selected-danger={selectedSchedule.hasConflict}
										class:selected-safe={!selectedSchedule.hasConflict}
										>{selectedSchedule.hasConflict ? 'Bentrok' : 'Aman'}</strong
									>
								</div>
							</div>
							{#if selectedScheduleOverlapPeers.length}
								<section class="calendar-overlap-panel">
									<h4>Jadwal beririsan di slot ini</h4>
									<div class="calendar-overlap-list">
										{#each selectedScheduleOverlapPeers as peer (peer.id)}
											<div
												class={`calendar-overlap-item ${peer.hasConflict ? 'conflict' : ''}`}
												style={conflictToneVariables(peer.conflictTone ?? null)}
											>
												<div class="calendar-overlap-copy">
													<strong>{peer.course}</strong>
													<span>{peer.student} • {peer.room}</span>
													<small>{DAY_LABELS[peer.day]} • {peer.startLabel} - {peer.endLabel}</small
													>
												</div>
												<div class="calendar-overlap-actions">
													<Button
														class="ghost-button"
														variant="ghost"
														size="sm"
														onclick={() => (selectedScheduleId = peer.id)}
													>
														Lihat
													</Button>
													<Button
														class="ghost-button"
														variant="ghost"
														size="sm"
														onclick={() => openBuilderForSchedule(peer)}
													>
														Atur
													</Button>
												</div>
											</div>
										{/each}
									</div>
								</section>
							{/if}
						{:else}
							<p class="empty-copy">Pilih satu blok jadwal untuk melihat detailnya.</p>
						{/if}
					</section>
				</div>
			{/if}

			{#if activeView === 'builder'}
				<div class="workspace-shell builder-shell">
					<section class="workspace-list builder-list">
						<div class="pane-head">
							<div>
								<h3>{builderTaskMode ? 'Daftar terkait' : 'Jadwal berjalan'}</h3>
								<p class="pane-copy">
									{builderTaskMode
										? 'Daftar ini dipakai untuk berpindah cepat ke jadwal lain tanpa keluar dari mode penjadwalan.'
										: 'Pilih jadwal yang ingin ditinjau ulang atau mulai jadwal baru dari daftar ini.'}
								</p>
							</div>
							<Button
								variant="ghost"
								size="sm"
								class="ghost-button"
								onclick={() => clearSelection('builder')}>Jadwal baru</Button
							>
						</div>

						<label class="search-box">
							<Search size={16} />
							<input
								bind:value={enrollmentSearch}
								aria-label="Cari KRS"
								placeholder="Cari mahasiswa, mata kuliah, atau ruang"
							/>
						</label>

						<div class="list-stack">
							{#each filteredEnrollments as item (item.id)}
								{@const scheduleCard = scheduleCardMap.get(item.id)}
								<button
									type="button"
									class:selected={selectedEnrollmentId === item.id}
									class:conflict={Boolean(scheduleCard?.hasConflict)}
									class="list-row"
									style={conflictToneVariables(scheduleCard?.conflictTone ?? null)}
									onclick={() => pickEnrollment(item)}
								>
									<div>
										<strong>{item.course_name}</strong>
										<span>{item.student_name} • {item.class_room_name}</span>
										{#if scheduleCard?.hasConflict && conflictSummaryByCardId.get(item.id)}
											<small class="list-conflict-copy">
												Bentrok dengan {conflictSummaryByCardId.get(item.id)}
											</small>
										{/if}
									</div>
									<small
										>{item.schedule_day
											? DAY_LABELS[item.schedule_day as keyof typeof DAY_LABELS]
											: '-'} • {formatTimeRange(
											item.schedule_start_time,
											item.schedule_end_time,
											timezone
										)}</small
									>
								</button>
							{/each}
						</div>
					</section>

					<section class="workspace-detail builder-detail">
						<div class="pane-head compact">
							<div>
								<h3>{selectedEnrollmentId ? 'Ubah jadwal terpilih' : 'Buat jadwal baru'}</h3>
								<p class="pane-copy">
									{selectedEnrollmentId
										? 'Fokuskan perubahan pada peserta, waktu, dan ruang. Daftar lain tetap tersedia, tetapi tidak lagi memimpin halaman.'
										: 'Kerjakan penjadwalan satu keputusan pada satu waktu: pilih peserta, tetapkan slot, lalu kunci ruang.'}
								</p>
								{#if selectedEnrollmentScheduleCard?.hasConflict && selectedEnrollmentConflictSummary}
									<p
										class="builder-conflict-copy"
										style={conflictToneVariables(selectedEnrollmentScheduleCard.conflictTone)}
									>
										Bentrok dengan {selectedEnrollmentConflictSummary}
									</p>
								{/if}
							</div>
							{#if selectedEnrollmentId}
								<Button
									variant="destructive"
									size="sm"
									class="danger-button"
									onclick={() => requestDelete('enrollment', selectedEnrollmentId!)}>Hapus</Button
								>
							{/if}
						</div>

						{#if pendingDelete?.kind === 'enrollment' && pendingDelete.id === selectedEnrollmentId}
							<section class="warning-panel">
								<p class="warning-title">Hapus {pendingDelete.label}?</p>
								<p>{pendingDelete.message}</p>
								<div class="warning-actions">
									<Button
										class="danger-button"
										variant="destructive"
										size="sm"
										onclick={() => removeEntity(pendingDelete!.kind, pendingDelete!.id)}
										>{pendingDelete.confirmLabel}</Button
									>
									<Button
										class="ghost-button"
										variant="ghost"
										size="sm"
										onclick={() => (pendingDelete = null)}>Batal</Button
									>
								</div>
							</section>
						{/if}

						{#if currentUser.current.role !== 'STUDENT'}
							<div class="builder-progress" aria-label="Tahapan pembuat jadwal">
								{#each builderSteps as step, index (step.id)}
									<button
										type="button"
										class={`builder-progress-item ${stepState(step.id)}`}
										onclick={() => setBuilderStep(step.id)}
										disabled={!canOpenBuilderStep(step.id)}
									>
										<span class="builder-progress-index">{index + 1}</span>
										<span class="builder-progress-copy">
											<strong>{step.label}</strong>
											<span>{step.hint}</span>
										</span>
									</button>
								{/each}
							</div>

							<form
								class="builder-form"
								{...selectedEnrollmentId ? updateEnrollmentEnhance : createEnrollmentEnhance}
							>
								<input
									type="hidden"
									{...selectedEnrollmentId
										? updateEnrollment.fields.timezone.as('text')
										: createEnrollment.fields.timezone.as('text')}
									bind:value={enrollmentDraft.timezone}
								/>

								{#if selectedEnrollmentId}
									<input
										type="hidden"
										{...updateEnrollment.fields.id.as('text')}
										bind:value={enrollmentDraft.id}
									/>
								{/if}

								<section class="builder-snapshot">
									<div>
										<span>Peserta</span>
										<strong>{selectedDraftStudent}</strong>
										<p>{selectedDraftCourse}</p>
									</div>
									<div>
										<span>Waktu</span>
										<strong>{draftTimeSummary}</strong>
										<p>{availableRoomOptions.length} ruang cocok untuk slot ini</p>
									</div>
									<div>
										<span>Ruang</span>
										<strong>{selectedDraftRoom}</strong>
										<p>{conflictCount} bentrok masih tercatat di kalender aktif</p>
									</div>
								</section>

								<section class:hidden-stage={builderStep !== 'participant'} class="builder-section">
									<div class="builder-section-head">
										<h4>Tentukan pemilik jadwal</h4>
										<p class="builder-note">
											Pilih mahasiswa dan mata kuliah dulu agar cek waktu dan ruang tetap relevan.
										</p>
									</div>
									<div class="editor-grid">
										<label>
											<span>Mahasiswa</span>
											<select
												{...selectedEnrollmentId
													? updateEnrollment.fields.studentId.as('select')
													: createEnrollment.fields.studentId.as('select')}
												bind:value={enrollmentDraft.studentId}
											>
												<option value="">Pilih mahasiswa</option>
												{#if collectionIssues.students && !students.length}
													<option value="" disabled>{collectionIssues.students}</option>
												{/if}
												{#each students as item (item.id)}
													<option value={item.id}>{item.name} • {item.id}</option>
												{/each}
											</select>
										</label>

										<label>
											<span>Mata kuliah</span>
											<select
												{...selectedEnrollmentId
													? updateEnrollment.fields.courseId.as('select')
													: createEnrollment.fields.courseId.as('select')}
												bind:value={enrollmentDraft.courseId}
											>
												<option value="">Pilih mata kuliah</option>
												{#if collectionIssues.courses && !courses.length}
													<option value="" disabled>{collectionIssues.courses}</option>
												{/if}
												{#each courses as item (item.id)}
													<option value={item.id}>{item.name} • {item.lecturer_name}</option>
												{/each}
											</select>
										</label>
									</div>
									<div class="builder-section-actions">
										<p class="editor-note">
											Langkah berikutnya akan menampilkan slot dan ruang yang masih bisa dipakai.
										</p>
										<Button
											type="button"
											class="primary-button"
											disabled={!participantStepReady}
											onclick={advanceBuilderStep}>Lanjut ke waktu</Button
										>
									</div>
								</section>

								<section class:hidden-stage={builderStep !== 'time'} class="builder-section">
									<div class="builder-section-head">
										<h4>Tetapkan ritme perkuliahan</h4>
										<p class="builder-note">
											Masukkan hari dan jam final. Daftar ruang akan mengikuti slot ini.
										</p>
									</div>
									<div class="editor-grid">
										<label>
											<span>Hari</span>
											<select
												{...selectedEnrollmentId
													? updateEnrollment.fields.day.as('select')
													: createEnrollment.fields.day.as('select')}
												bind:value={enrollmentDraft.day}
											>
												{#each days as day (day)}
													<option value={day}>{DAY_LABELS[day]}</option>
												{/each}
											</select>
										</label>

										<label>
											<span>Mulai</span>
											<input
												type="datetime-local"
												{...selectedEnrollmentId
													? updateEnrollment.fields.startTime.as('text')
													: createEnrollment.fields.startTime.as('text')}
												bind:value={enrollmentDraft.startTime}
											/>
										</label>

										<label>
											<span>Selesai</span>
											<input
												type="datetime-local"
												{...selectedEnrollmentId
													? updateEnrollment.fields.endTime.as('text')
													: createEnrollment.fields.endTime.as('text')}
												bind:value={enrollmentDraft.endTime}
											/>
										</label>

										<label>
											<span>Semester</span>
											<input
												{...selectedEnrollmentId
													? updateEnrollment.fields.semester.as('text')
													: createEnrollment.fields.semester.as('text')}
												bind:value={enrollmentDraft.semester}
											/>
										</label>

										<label>
											<span>Tahun akademik</span>
											<input
												{...selectedEnrollmentId
													? updateEnrollment.fields.academicYear.as('text')
													: createEnrollment.fields.academicYear.as('text')}
												bind:value={enrollmentDraft.academicYear}
											/>
										</label>
									</div>
									<div class="builder-section-actions split">
										<p class="editor-note">
											Kalau jam berubah, cek ulang pilihan ruang di langkah berikutnya.
										</p>
										<div class="builder-inline-actions">
											<Button
												type="button"
												variant="ghost"
												class="ghost-button"
												onclick={retreatBuilderStep}>Kembali</Button
											>
											<Button
												type="button"
												class="primary-button"
												disabled={!timeStepReady}
												onclick={advanceBuilderStep}>Lanjut ke ruang</Button
											>
										</div>
									</div>
								</section>

								<section class:hidden-stage={builderStep !== 'room'} class="builder-section">
									<div class="builder-section-head">
										<h4>Pilih ruang yang paling aman</h4>
										<p class="builder-note">
											Pilih satu ruang yang masih aman untuk slot ini, lalu lanjut ke tinjau akhir.
										</p>
									</div>
									<div class="builder-room-stage">
										<div class="editor-grid builder-room-grid">
											<label>
												<span>Ruang</span>
												<select
													{...selectedEnrollmentId
														? updateEnrollment.fields.classRoomId.as('select')
														: createEnrollment.fields.classRoomId.as('select')}
													bind:value={enrollmentDraft.classRoomId}
												>
													<option value="">Pilih ruang</option>
													{#each availableRoomOptions as room (room.id)}
														<option value={room.id}>{room.name} • {room.capacity}</option>
													{/each}
												</select>
											</label>
										</div>

										<section class="support-panel builder-support">
											<h4>{availableRoomOptions.length} ruang cocok untuk slot ini</h4>
											<div class="support-list">
												{#if availableRoomOptions.length}
													{#each availableRoomOptions.slice(0, 4) as room (room.id)}
														<div>
															<strong>{room.name}</strong>
															<span
																>{beautifyRoomType(room.class_room_type)} • kapasitas {room.capacity}</span
															>
														</div>
													{/each}
												{:else}
													<p class="empty-copy">
														Belum ada ruang yang aman untuk slot ini. Ubah waktu atau pilih ruang
														dengan kapasitas berbeda.
													</p>
												{/if}
											</div>
										</section>
									</div>
									<div class="builder-section-actions split">
										<p class="editor-note">
											Kalau daftar ruang kosong, ubah jam dulu sebelum melanjutkan.
										</p>
										<div class="builder-inline-actions">
											<Button
												type="button"
												variant="ghost"
												class="ghost-button"
												onclick={retreatBuilderStep}>Kembali</Button
											>
											<Button
												type="button"
												class="primary-button"
												disabled={!roomStepReady}
												onclick={advanceBuilderStep}>Tinjau sebelum simpan</Button
											>
										</div>
									</div>
								</section>

								<section
									class:hidden-stage={builderStep !== 'review'}
									class="builder-section builder-review"
								>
									<div class="builder-section-head">
										<h4>Tinjau keputusan sebelum disimpan</h4>
										<p class="builder-note">
											Pastikan peserta, slot, dan ruang sudah benar sebelum disimpan.
										</p>
									</div>
									<div class="detail-lines builder-review-grid">
										<div>
											<span>Mahasiswa</span>
											<strong>{selectedDraftStudent}</strong>
										</div>
										<div>
											<span>Mata kuliah</span>
											<strong>{selectedDraftCourse}</strong>
										</div>
										<div>
											<span>Slot kuliah</span>
											<strong>{draftTimeSummary}</strong>
										</div>
										<div>
											<span>Ruang</span>
											<strong>{selectedDraftRoom}</strong>
										</div>
									</div>
									<div class="builder-review-note">
										<p class="editor-note">
											Kalau masih ragu, kembali satu langkah dan koreksi waktu atau ruang sebelum
											simpan.
										</p>
										<div class="builder-inline-actions">
											<Button
												type="button"
												variant="ghost"
												class="ghost-button"
												onclick={retreatBuilderStep}>Kembali</Button
											>
											<Button type="submit" class="primary-button builder-submit"
												>{selectedEnrollmentId ? 'Simpan perubahan' : 'Buat jadwal'}</Button
											>
										</div>
									</div>
								</section>
							</form>
						{:else}
							<p class="empty-copy">Mahasiswa hanya memiliki akses baca untuk jadwal dan KRS.</p>
						{/if}
					</section>
				</div>
			{/if}

			{#if activeView === 'classrooms'}
				<div class="workspace-shell">
					<section class="workspace-list">
						<div class="pane-head">
							<div>
								<h3>Inventaris ruang aktif</h3>
							</div>
							<Button
								variant="ghost"
								size="sm"
								class="ghost-button"
								onclick={() => beginCreate('classrooms')}>Baru</Button
							>
						</div>
						<label class="search-box"
							><Search size={16} /><input
								bind:value={roomSearch}
								aria-label="Cari ruang kelas"
								placeholder="Cari nama ruang atau tipe"
							/></label
						>
						<div class="list-stack">
							{#each filteredClassrooms as item (item.id)}
								<button
									type="button"
									class:selected={selectedRoomId === item.id}
									class="list-row"
									onclick={() => pickClassroom(item)}
								>
									<div>
										<strong>{item.name}</strong><span
											>{beautifyRoomType(item.class_room_type)} • kapasitas {item.capacity}</span
										>
									</div>
									<small>{item.schedule_count ?? 0} jadwal</small>
								</button>
							{/each}
						</div>
					</section>
					<section class="workspace-detail">
						<div class="pane-head compact">
							<div>
								<h3>{selectedRoom ? selectedRoom.name : 'Tambah ruang baru'}</h3>
							</div>
							{#if currentUser.current.role === 'ADMIN'}
								<div class="detail-actions">
									{#if editorView === 'classrooms'}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => stopEditing('classrooms')}>Tutup editor</Button
										>
									{:else if selectedRoom}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => beginEdit('classrooms')}>Ubah</Button
										>
									{/if}
									{#if selectedRoomId}
										<Button
											variant="destructive"
											size="sm"
											class="danger-button"
											onclick={() => requestDelete('classroom', selectedRoomId!)}>Hapus</Button
										>
									{/if}
								</div>
							{/if}
						</div>
						{#if pendingDelete?.kind === 'classroom' && pendingDelete.id === selectedRoomId}
							<section class="warning-panel">
								<p class="warning-title">Hapus {pendingDelete.label}?</p>
								<p>{pendingDelete.message}</p>
								<div class="warning-actions">
									<Button
										class="danger-button"
										variant="destructive"
										size="sm"
										onclick={() => removeEntity(pendingDelete!.kind, pendingDelete!.id)}
										>{pendingDelete.confirmLabel}</Button
									>
									<Button
										class="ghost-button"
										variant="ghost"
										size="sm"
										onclick={() => (pendingDelete = null)}>Batal</Button
									>
								</div>
							</section>
						{/if}
						{#if selectedRoom && editorView !== 'classrooms'}<div class="detail-stack">
								<div class="detail-lines">
									<div>
										<span>Tipe</span><strong
											>{beautifyRoomType(selectedRoom.class_room_type)}</strong
										>
									</div>
									<div><span>Kapasitas</span><strong>{selectedRoom.capacity}</strong></div>
									<div>
										<span>Projector</span><strong
											>{selectedRoom.has_projector ? 'Ya' : 'Tidak'}</strong
										>
									</div>
									<div><span>AC</span><strong>{selectedRoom.has_ac ? 'Ya' : 'Tidak'}</strong></div>
								</div>
								<p class="detail-hint">
									Tinjau ringkasan ruang terlebih dahulu. Buka editor hanya saat perlu mengubah
									data.
								</p>
							</div>{:else if currentUser.current.role === 'ADMIN' && editorView === 'classrooms'}
							<form
								class="editor-grid"
								{...selectedRoomId ? updateClassRoomEnhance : createClassRoomEnhance}
							>
								{#if selectedRoomId}<input
										type="hidden"
										{...updateClassRoom.fields.id.as('text')}
										bind:value={selectedRoomId}
									/>{/if}
								<label
									><span>Nama ruang</span><input
										{...selectedRoomId
											? updateClassRoom.fields.name.as('text')
											: createClassRoom.fields.name.as('text')}
										bind:value={classroomDraft.name}
									/></label
								>
								<label
									><span>Tipe ruang</span><select
										{...selectedRoomId
											? updateClassRoom.fields.classRoomType.as('select')
											: createClassRoom.fields.classRoomType.as('select')}
										bind:value={classroomDraft.classRoomType}
										>{#each classRoomTypes as type (type)}<option value={type}
												>{beautifyRoomType(type)}</option
											>{/each}</select
									></label
								>
								<label
									><span>Kapasitas</span><input
										min="1"
										{...selectedRoomId
											? updateClassRoom.fields.capacity.as('number')
											: createClassRoom.fields.capacity.as('number')}
										bind:value={classroomDraft.capacity}
									/></label
								>
								<label class="check-row"
									><input
										{...selectedRoomId
											? updateClassRoom.fields.hasProjector.as('checkbox')
											: createClassRoom.fields.hasProjector.as('checkbox')}
										checked={classroomDraft.hasProjector}
										onchange={(event) =>
											(classroomDraft.hasProjector = (
												event.currentTarget as HTMLInputElement
											).checked)}
									/><span>Proyektor tersedia</span></label
								>
								<label class="check-row"
									><input
										{...selectedRoomId
											? updateClassRoom.fields.hasAC.as('checkbox')
											: createClassRoom.fields.hasAC.as('checkbox')}
										checked={classroomDraft.hasAC}
										onchange={(event) =>
											(classroomDraft.hasAC = (event.currentTarget as HTMLInputElement).checked)}
									/><span>AC tersedia</span></label
								>
								<Button type="submit" class="primary-button"
									>{selectedRoomId ? 'Simpan perubahan' : 'Tambah ruang'}</Button
								>
							</form>{:else}<p class="empty-copy">
								Pilih satu ruang untuk meninjau detail, atau mulai entri baru saat perlu menambah
								inventaris.
							</p>{/if}
					</section>
				</div>
			{/if}

			{#if activeView === 'courses'}
				<div class="workspace-shell">
					<section class="workspace-list">
						<div class="pane-head">
							<div>
								<h3>Katalog perkuliahan</h3>
							</div>
							<Button
								variant="ghost"
								size="sm"
								class="ghost-button"
								onclick={() => beginCreate('courses')}>Baru</Button
							>
						</div>
						<label class="search-box"
							><Search size={16} /><input
								bind:value={courseSearch}
								aria-label="Cari mata kuliah"
								placeholder="Cari kode, nama, atau dosen"
							/></label
						>
						<div class="list-stack">
							{#each filteredCourses as item (item.id)}<button
									type="button"
									class:selected={selectedCourseId === item.id}
									class="list-row"
									onclick={() => pickCourse(item)}
									><div>
										<strong>{item.id} • {item.name}</strong><span
											>{item.study_program_name} • {item.lecturer_name}</span
										>
									</div>
									<small>{item.credits} SKS</small></button
								>{/each}
						</div>
					</section>
					<section class="workspace-detail">
						<div class="pane-head compact">
							<div>
								<h3>{selectedCourse ? selectedCourse.name : 'Tambah mata kuliah baru'}</h3>
							</div>
							{#if currentUser.current.role === 'ADMIN'}
								<div class="detail-actions">
									{#if editorView === 'courses'}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => stopEditing('courses')}>Tutup editor</Button
										>
									{:else if selectedCourse}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => beginEdit('courses')}>Ubah</Button
										>
									{/if}
									{#if selectedCourseId}
										<Button
											variant="destructive"
											size="sm"
											class="danger-button"
											onclick={() => requestDelete('course', selectedCourseId!)}>Hapus</Button
										>
									{/if}
								</div>
							{/if}
						</div>
						{#if pendingDelete?.kind === 'course' && pendingDelete.id === selectedCourseId}
							<section class="warning-panel">
								<p class="warning-title">Hapus {pendingDelete.label}?</p>
								<p>{pendingDelete.message}</p>
								<div class="warning-actions">
									<Button
										class="danger-button"
										variant="destructive"
										size="sm"
										onclick={() => removeEntity(pendingDelete!.kind, pendingDelete!.id)}
										>{pendingDelete.confirmLabel}</Button
									>
									<Button
										class="ghost-button"
										variant="ghost"
										size="sm"
										onclick={() => (pendingDelete = null)}>Batal</Button
									>
								</div>
							</section>
						{/if}
						{#if selectedCourse && editorView !== 'courses'}<div class="detail-stack">
								<div class="detail-lines">
									<div><span>Kode</span><strong>{selectedCourse.id}</strong></div>
									<div>
										<span>Program studi</span><strong>{selectedCourse.study_program_name}</strong>
									</div>
									<div><span>Dosen</span><strong>{selectedCourse.lecturer_name}</strong></div>
									<div><span>Beban</span><strong>{selectedCourse.credits} SKS</strong></div>
									<div>
										<span>Peserta</span><strong>{selectedCourse.enrollment_count ?? 0}</strong>
									</div>
								</div>
								<p class="detail-hint">
									Gunakan mode tinjau untuk membaca beban kuliah dan relasi dosen sebelum membuka
									editor.
								</p>
							</div>{:else if currentUser.current.role === 'ADMIN' && editorView === 'courses'}<form
								class="editor-grid"
								{...selectedCourseId ? updateCourseEnhance : createCourseEnhance}
							>
								{#if selectedCourseId}<input
										type="hidden"
										{...updateCourse.fields.id.as('text')}
										bind:value={courseDraft.id}
									/>{:else}<p class="editor-note">
										Kode mata kuliah dibuat otomatis saat disimpan.
									</p>{/if}<label
									><span>Nama mata kuliah</span><input
										{...selectedCourseId
											? updateCourse.fields.name.as('text')
											: createCourse.fields.name.as('text')}
										bind:value={courseDraft.name}
									/></label
								><label
									><span>SKS</span><input
										min="1"
										max="6"
										{...selectedCourseId
											? updateCourse.fields.credits.as('number')
											: createCourse.fields.credits.as('number')}
										bind:value={courseDraft.credits}
									/></label
								><label
									><span>Program studi</span><select
										{...selectedCourseId
											? updateCourse.fields.studyProgramId.as('select')
											: createCourse.fields.studyProgramId.as('select')}
										bind:value={courseDraft.studyProgramId}
										><option value="">Pilih program studi</option
										>{#if collectionIssues.studyPrograms && !studyPrograms.length}<option
												value=""
												disabled>{collectionIssues.studyPrograms}</option
											>{/if}
										>{#each studyPrograms as item (item.id)}<option value={item.id}
												>{item.name}</option
											>{/each}</select
									></label
								><label
									><span>Dosen pengampu</span><select
										{...selectedCourseId
											? updateCourse.fields.lecturerId.as('select')
											: createCourse.fields.lecturerId.as('select')}
										bind:value={courseDraft.lecturerId}
										><option value="">Pilih dosen</option
										>{#if collectionIssues.lecturers && !lecturers.length}<option value="" disabled
												>{collectionIssues.lecturers}</option
											>{/if}{#each lecturers as item (item.id)}<option value={item.id}
												>{item.name}</option
											>{/each}</select
									></label
								>{#if courseEditorBlocked}<p class="editor-note">
										Program studi dan dosen harus tersedia sebelum mata kuliah dapat disimpan.
									</p>{/if}<Button
									type="submit"
									class="primary-button"
									disabled={courseEditorBlocked}
									>{selectedCourseId ? 'Simpan perubahan' : 'Tambah mata kuliah'}</Button
								>
							</form>{:else}<p class="empty-copy">
								Pilih satu mata kuliah untuk meninjau detail, atau buka editor saat perlu menambah
								katalog baru.
							</p>{/if}
					</section>
				</div>
			{/if}

			{#if activeView === 'students' && currentUser.current.role !== 'STUDENT'}
				<div class="workspace-shell">
					<section class="workspace-list">
						<div class="pane-head">
							<div>
								<h3>Daftar mahasiswa aktif</h3>
							</div>
							<Button
								variant="ghost"
								size="sm"
								class="ghost-button"
								onclick={() => beginCreate('students')}>Baru</Button
							>
						</div>
						<label class="search-box"
							><Search size={16} /><input
								bind:value={studentSearch}
								aria-label="Cari mahasiswa"
								placeholder="Cari NRP, nama, atau program studi"
							/></label
						>
						<div class="list-stack">
							{#each filteredStudents as item (item.id)}<button
									type="button"
									class:selected={selectedStudentId === item.id}
									class="list-row"
									onclick={() => pickStudent(item)}
									><div>
										<strong>{item.name}</strong><span>{item.id} • {item.study_program_name}</span>
									</div>
									<small>{item.enrollment_count ?? 0} KRS</small></button
								>{/each}
						</div>
					</section>
					<section class="workspace-detail">
						<div class="pane-head compact">
							<div>
								<h3>{selectedStudent ? selectedStudent.name : 'Tambah mahasiswa baru'}</h3>
							</div>
							{#if currentUser.current.role === 'ADMIN'}
								<div class="detail-actions">
									{#if editorView === 'students'}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => stopEditing('students')}>Tutup editor</Button
										>
									{:else if selectedStudent}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => beginEdit('students')}>Ubah</Button
										>
									{/if}
									{#if selectedStudentId}
										<Button
											variant="destructive"
											size="sm"
											class="danger-button"
											onclick={() => requestDelete('student', selectedStudentId!)}>Hapus</Button
										>
									{/if}
								</div>
							{/if}
						</div>
						{#if pendingDelete?.kind === 'student' && pendingDelete.id === selectedStudentId}
							<section class="warning-panel">
								<p class="warning-title">Hapus {pendingDelete.label}?</p>
								<p>{pendingDelete.message}</p>
								<div class="warning-actions">
									<Button
										class="danger-button"
										variant="destructive"
										size="sm"
										onclick={() => removeEntity(pendingDelete!.kind, pendingDelete!.id)}
										>{pendingDelete.confirmLabel}</Button
									>
									<Button
										class="ghost-button"
										variant="ghost"
										size="sm"
										onclick={() => (pendingDelete = null)}>Batal</Button
									>
								</div>
							</section>
						{/if}
						{#if selectedStudent && editorView !== 'students'}<div class="detail-stack">
								<div class="detail-lines">
									<div><span>Email</span><strong>{selectedStudent.email}</strong></div>
									<div>
										<span>Program studi</span><strong>{selectedStudent.study_program_name}</strong>
									</div>
									<div><span>Fakultas</span><strong>{selectedStudent.faculty_name}</strong></div>
									<div><span>Angkatan</span><strong>{selectedStudent.year_admitted}</strong></div>
								</div>
								<p class="detail-hint">
									Tinjau identitas mahasiswa lebih dulu agar perubahan data tidak bercampur dengan
									proses baca cepat.
								</p>
							</div>{:else if currentUser.current.role === 'ADMIN' && editorView === 'students'}<form
								class="editor-grid"
								{...selectedStudentId ? updateStudentEnhance : createStudentEnhance}
							>
								{#if selectedStudentId}<input
										type="hidden"
										{...updateStudent.fields.id.as('text')}
										bind:value={selectedStudentId}
									/>{/if}<label
									><span>Nama</span><input
										{...selectedStudentId
											? updateStudent.fields.name.as('text')
											: createStudent.fields.name.as('text')}
										bind:value={studentDraft.name}
									/></label
								><label
									><span>Email</span><input
										{...selectedStudentId
											? updateStudent.fields.email.as('email')
											: createStudent.fields.email.as('email')}
										bind:value={studentDraft.email}
									/></label
								><label
									><span>Telepon</span><input
										{...selectedStudentId
											? updateStudent.fields.phone.as('text')
											: createStudent.fields.phone.as('text')}
										bind:value={studentDraft.phone}
									/></label
								><label
									><span>Alamat</span><input
										{...selectedStudentId
											? updateStudent.fields.address.as('text')
											: createStudent.fields.address.as('text')}
										bind:value={studentDraft.address}
									/></label
								><label
									><span>Angkatan</span><input
										{...selectedStudentId
											? updateStudent.fields.yearAdmitted.as('number')
											: createStudent.fields.yearAdmitted.as('number')}
										bind:value={studentDraft.yearAdmitted}
									/></label
								><label
									><span>Program studi</span><select
										{...selectedStudentId
											? updateStudent.fields.studyProgramId.as('select')
											: createStudent.fields.studyProgramId.as('select')}
										bind:value={studentDraft.studyProgramId}
										><option value="">Pilih program studi</option
										>{#if collectionIssues.studyPrograms && !studyPrograms.length}<option
												value=""
												disabled>{collectionIssues.studyPrograms}</option
											>{/if}
										>{#each studyPrograms as item (item.id)}<option value={item.id}
												>{item.name}</option
											>{/each}</select
									></label
								>{#if studentEditorBlocked}<p class="editor-note">
										Program studi harus tersedia sebelum data mahasiswa dapat disimpan.
									</p>{/if}<Button
									type="submit"
									class="primary-button"
									disabled={studentEditorBlocked}
									>{selectedStudentId ? 'Simpan perubahan' : 'Tambah mahasiswa'}</Button
								>
							</form>{:else}<p class="empty-copy">
								Pilih satu mahasiswa untuk meninjau profil, atau mulai entri baru saat perlu
								menambah data aktif.
							</p>{/if}
					</section>
				</div>
			{/if}

			{#if activeView === 'lecturers'}
				<div class="workspace-shell">
					<section class="workspace-list">
						<div class="pane-head">
							<div>
								<h3>Tenaga pengampu</h3>
							</div>
							{#if currentUser.current.role === 'ADMIN'}<Button
									variant="ghost"
									size="sm"
									class="ghost-button"
									onclick={() => beginCreate('lecturers')}>Baru</Button
								>{/if}
						</div>
						<label class="search-box"
							><Search size={16} /><input
								bind:value={lecturerSearch}
								aria-label="Cari dosen"
								placeholder="Cari NIM, nama, atau email"
							/></label
						>
						<div class="list-stack">
							{#each filteredLecturers as item (item.id)}<button
									type="button"
									class:selected={selectedLecturerId === item.id}
									class="list-row"
									onclick={() => pickLecturer(item)}
									><div><strong>{item.name}</strong><span>{item.id} • {item.email}</span></div>
									<small>{item.schedule_count ?? 0} jadwal</small></button
								>{/each}
						</div>
					</section>
					<section class="workspace-detail">
						<div class="pane-head compact">
							<div>
								<h3>{selectedLecturer ? selectedLecturer.name : 'Tambah dosen baru'}</h3>
							</div>
							{#if currentUser.current.role === 'ADMIN'}
								<div class="detail-actions">
									{#if editorView === 'lecturers'}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => stopEditing('lecturers')}>Tutup editor</Button
										>
									{:else if selectedLecturer}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => beginEdit('lecturers')}>Ubah</Button
										>
									{/if}
									{#if selectedLecturerId}
										<Button
											variant="destructive"
											size="sm"
											class="danger-button"
											onclick={() => requestDelete('lecturer', selectedLecturerId!)}>Hapus</Button
										>
									{/if}
								</div>
							{/if}
						</div>
						{#if pendingDelete?.kind === 'lecturer' && pendingDelete.id === selectedLecturerId}
							<section class="warning-panel">
								<p class="warning-title">Hapus {pendingDelete.label}?</p>
								<p>{pendingDelete.message}</p>
								<div class="warning-actions">
									<Button
										class="danger-button"
										variant="destructive"
										size="sm"
										onclick={() => removeEntity(pendingDelete!.kind, pendingDelete!.id)}
										>{pendingDelete.confirmLabel}</Button
									>
									<Button
										class="ghost-button"
										variant="ghost"
										size="sm"
										onclick={() => (pendingDelete = null)}>Batal</Button
									>
								</div>
							</section>
						{/if}
						{#if selectedLecturer && editorView !== 'lecturers'}<div class="detail-stack">
								<div class="detail-lines">
									<div><span>ID dosen</span><strong>{selectedLecturer.id}</strong></div>
									<div><span>Email</span><strong>{selectedLecturer.email}</strong></div>
									<div><span>Telepon</span><strong>{selectedLecturer.phone || '-'}</strong></div>
									<div><span>Alamat</span><strong>{selectedLecturer.address || '-'}</strong></div>
									<div>
										<span>Jadwal aktif</span><strong>{selectedLecturer.schedule_count ?? 0}</strong>
									</div>
								</div>
								<p class="detail-hint">
									Mode tinjau menjaga konteks pengampu tetap ringkas sebelum Anda membuka editor.
								</p>
							</div>{:else if currentUser.current.role === 'ADMIN' && editorView === 'lecturers'}<form
								class="editor-grid"
								{...selectedLecturerId ? updateLecturerEnhance : createLecturerEnhance}
							>
								{#if selectedLecturerId}<input
										type="hidden"
										{...updateLecturer.fields.id.as('text')}
										bind:value={lecturerDraft.id}
									/>{:else}<p class="editor-note">
										ID dosen dibuat otomatis saat disimpan.
									</p>{/if}<label
									><span>Nama</span><input
										{...selectedLecturerId
											? updateLecturer.fields.name.as('text')
											: createLecturer.fields.name.as('text')}
										bind:value={lecturerDraft.name}
									/></label
								><label
									><span>Email</span><input
										{...selectedLecturerId
											? updateLecturer.fields.email.as('email')
											: createLecturer.fields.email.as('email')}
										bind:value={lecturerDraft.email}
									/></label
								><label
									><span>Telepon</span><input
										{...selectedLecturerId
											? updateLecturer.fields.phone.as('text')
											: createLecturer.fields.phone.as('text')}
										bind:value={lecturerDraft.phone}
									/></label
								><label
									><span>Alamat</span><input
										{...selectedLecturerId
											? updateLecturer.fields.address.as('text')
											: createLecturer.fields.address.as('text')}
										bind:value={lecturerDraft.address}
									/></label
								><Button type="submit" class="primary-button"
									>{selectedLecturerId ? 'Simpan perubahan' : 'Tambah dosen'}</Button
								>
							</form>{:else}<p class="empty-copy">
								Pilih satu dosen untuk meninjau detail, atau mulai entri baru saat perlu menambah
								pengampu.
							</p>{/if}
					</section>
				</div>
			{/if}

			{#if activeView === 'faculties'}
				<div class="workspace-shell">
					<section class="workspace-list">
						<div class="pane-head">
							<div>
								<h3>Struktur fakultas</h3>
							</div>
							<Button
								variant="ghost"
								size="sm"
								class="ghost-button"
								onclick={() => beginCreate('faculties')}>Baru</Button
							>
						</div>
						<label class="search-box"
							><Search size={16} /><input
								bind:value={facultySearch}
								aria-label="Cari fakultas"
								placeholder="Cari kode atau nama fakultas"
							/></label
						>
						<div class="list-stack">
							{#each filteredFaculties as item (item.id)}<button
									type="button"
									class:selected={selectedFacultyId === item.id}
									class="list-row"
									onclick={() => pickFaculty(item)}
									><div><strong>{item.name}</strong><span>{item.id}</span></div>
									<small>{item.study_program_count ?? 0} prodi</small></button
								>{/each}
						</div>
					</section>
					<section class="workspace-detail">
						<div class="pane-head compact">
							<div>
								<h3>{selectedFaculty ? selectedFaculty.name : 'Tambah fakultas baru'}</h3>
							</div>
							{#if currentUser.current.role === 'ADMIN'}
								<div class="detail-actions">
									{#if editorView === 'faculties'}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => stopEditing('faculties')}>Tutup editor</Button
										>
									{:else if selectedFaculty}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => beginEdit('faculties')}>Ubah</Button
										>
									{/if}
									{#if selectedFacultyId}
										<Button
											variant="destructive"
											size="sm"
											class="danger-button"
											onclick={() => requestDelete('faculty', selectedFacultyId!)}>Hapus</Button
										>
									{/if}
								</div>
							{/if}
						</div>
						{#if pendingDelete?.kind === 'faculty' && pendingDelete.id === selectedFacultyId}
							<section class="warning-panel">
								<p class="warning-title">Hapus {pendingDelete.label}?</p>
								<p>{pendingDelete.message}</p>
								<div class="warning-actions">
									<Button
										class="danger-button"
										variant="destructive"
										size="sm"
										onclick={() => removeEntity(pendingDelete!.kind, pendingDelete!.id)}
										>{pendingDelete.confirmLabel}</Button
									>
									<Button
										class="ghost-button"
										variant="ghost"
										size="sm"
										onclick={() => (pendingDelete = null)}>Batal</Button
									>
								</div>
							</section>
						{/if}
						{#if selectedFaculty && editorView !== 'faculties'}<div class="detail-stack">
								<div class="detail-lines">
									<div><span>Kode</span><strong>{selectedFaculty.id}</strong></div>
									<div>
										<span>Program studi</span><strong
											>{selectedFaculty.study_program_count ?? 0}</strong
										>
									</div>
								</div>
								<p class="detail-hint">
									Tinjau ringkasan struktur dulu. Buka editor hanya untuk perubahan yang memang
									diperlukan.
								</p>
							</div>{:else if currentUser.current.role === 'ADMIN' && editorView === 'faculties'}<form
								class="editor-grid"
								{...selectedFacultyId ? updateFacultyEnhance : createFacultyEnhance}
							>
								{#if selectedFacultyId}<input
										type="hidden"
										{...updateFaculty.fields.id.as('text')}
										bind:value={facultyDraft.id}
									/>{:else}<p class="editor-note">
										ID fakultas dibuat otomatis saat disimpan.
									</p>{/if}<label
									><span>Nama fakultas</span><input
										{...selectedFacultyId
											? updateFaculty.fields.name.as('text')
											: createFaculty.fields.name.as('text')}
										bind:value={facultyDraft.name}
									/></label
								><Button type="submit" class="primary-button"
									>{selectedFacultyId ? 'Simpan perubahan' : 'Tambah fakultas'}</Button
								>
							</form>{:else}<p class="empty-copy">
								Pilih satu fakultas untuk meninjau struktur, atau mulai entri baru saat perlu
								menambah unit.
							</p>{/if}
					</section>
				</div>
			{/if}

			{#if activeView === 'studyPrograms'}
				<div class="workspace-shell">
					<section class="workspace-list">
						<div class="pane-head">
							<div>
								<h3>Peta program studi</h3>
							</div>
							<Button
								variant="ghost"
								size="sm"
								class="ghost-button"
								onclick={() => beginCreate('studyPrograms')}>Baru</Button
							>
						</div>
						<label class="search-box"
							><Search size={16} /><input
								bind:value={studyProgramSearch}
								aria-label="Cari program studi"
								placeholder="Cari kode, nama, atau fakultas"
							/></label
						>
						<div class="list-stack">
							{#each filteredStudyPrograms as item (item.id)}<button
									type="button"
									class:selected={selectedStudyProgramId === item.id}
									class="list-row"
									onclick={() => pickStudyProgram(item)}
									><div>
										<strong>{item.name}</strong><span>{item.id} • {item.faculty_name}</span>
									</div>
									<small>{item.student_count ?? 0} mahasiswa</small></button
								>{/each}
						</div>
					</section>
					<section class="workspace-detail">
						<div class="pane-head compact">
							<div>
								<h3>
									{selectedStudyProgram ? selectedStudyProgram.name : 'Tambah program studi baru'}
								</h3>
							</div>
							{#if currentUser.current.role === 'ADMIN'}
								<div class="detail-actions">
									{#if editorView === 'studyPrograms'}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => stopEditing('studyPrograms')}>Tutup editor</Button
										>
									{:else if selectedStudyProgram}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => beginEdit('studyPrograms')}>Ubah</Button
										>
									{/if}
									{#if selectedStudyProgramId}
										<Button
											variant="destructive"
											size="sm"
											class="danger-button"
											onclick={() => requestDelete('studyProgram', selectedStudyProgramId!)}
											>Hapus</Button
										>
									{/if}
								</div>
							{/if}
						</div>
						{#if pendingDelete?.kind === 'studyProgram' && pendingDelete.id === selectedStudyProgramId}
							<section class="warning-panel">
								<p class="warning-title">Hapus {pendingDelete.label}?</p>
								<p>{pendingDelete.message}</p>
								<div class="warning-actions">
									<Button
										class="danger-button"
										variant="destructive"
										size="sm"
										onclick={() => removeEntity(pendingDelete!.kind, pendingDelete!.id)}
										>{pendingDelete.confirmLabel}</Button
									>
									<Button
										class="ghost-button"
										variant="ghost"
										size="sm"
										onclick={() => (pendingDelete = null)}>Batal</Button
									>
								</div>
							</section>
						{/if}
						{#if selectedStudyProgram && editorView !== 'studyPrograms'}<div class="detail-stack">
								<div class="detail-lines">
									<div><span>ID prodi</span><strong>{selectedStudyProgram.id}</strong></div>
									<div><span>Ketua program</span><strong>{selectedStudyProgram.head}</strong></div>
									<div>
										<span>Fakultas</span><strong>{selectedStudyProgram.faculty_name}</strong>
									</div>
									<div>
										<span>Mahasiswa</span><strong>{selectedStudyProgram.student_count ?? 0}</strong>
									</div>
								</div>
								<p class="detail-hint">
									Gunakan mode tinjau agar struktur prodi tetap mudah dibaca sebelum proses edit
									dimulai.
								</p>
							</div>{:else if currentUser.current.role === 'ADMIN' && editorView === 'studyPrograms'}<form
								class="editor-grid"
								{...selectedStudyProgramId ? updateStudyProgramEnhance : createStudyProgramEnhance}
							>
								{#if selectedStudyProgramId}<input
										type="hidden"
										{...updateStudyProgram.fields.id.as('text')}
										bind:value={studyProgramDraft.id}
									/>{:else}<p class="editor-note">
										ID program studi dibuat otomatis saat disimpan.
									</p>{/if}<label
									><span>Nama prodi</span><input
										{...selectedStudyProgramId
											? updateStudyProgram.fields.name.as('text')
											: createStudyProgram.fields.name.as('text')}
										bind:value={studyProgramDraft.name}
									/></label
								><label
									><span>Ketua prodi</span><input
										{...selectedStudyProgramId
											? updateStudyProgram.fields.head.as('text')
											: createStudyProgram.fields.head.as('text')}
										bind:value={studyProgramDraft.head}
									/></label
								><label
									><span>Fakultas</span><select
										{...selectedStudyProgramId
											? updateStudyProgram.fields.facultyId.as('select')
											: createStudyProgram.fields.facultyId.as('select')}
										bind:value={studyProgramDraft.facultyId}
										><option value="">Pilih fakultas</option
										>{#if collectionIssues.faculties && !faculties.length}<option value="" disabled
												>{collectionIssues.faculties}</option
											>{/if}
										>{#each faculties as item (item.id)}<option value={item.id}>{item.name}</option
											>{/each}</select
									></label
								>{#if studyProgramEditorBlocked}<p class="editor-note">
										Fakultas harus tersedia sebelum program studi dapat disimpan.
									</p>{/if}<Button
									type="submit"
									class="primary-button"
									disabled={studyProgramEditorBlocked}
									>{selectedStudyProgramId ? 'Simpan perubahan' : 'Tambah program studi'}</Button
								>
							</form>{:else}<p class="empty-copy">
								Pilih satu program studi untuk meninjau detail, atau mulai entri baru saat perlu
								menambah struktur akademik.
							</p>{/if}
					</section>
				</div>
			{/if}

			{#if activeView === 'enrollments'}
				<div class="workspace-shell">
					<section class="workspace-list">
						<div class="pane-head">
							<div>
								<h3>Daftar pengambilan mata kuliah</h3>
							</div>
						</div>
						<label class="search-box"
							><Search size={16} /><input
								bind:value={enrollmentSearch}
								aria-label="Cari pengambilan mata kuliah"
								placeholder="Cari mahasiswa, mata kuliah, atau ruang"
							/></label
						>
						<div class="list-stack">
							{#each filteredEnrollments as item (item.id)}<button
									type="button"
									class:selected={selectedEnrollmentId === item.id}
									class="list-row"
									onclick={() => pickEnrollment(item)}
									><div>
										<strong>{item.student_name}</strong><span
											>{item.course_name} • {item.class_room_name}</span
										>
									</div>
									<small>{item.semester} • {item.academic_year}</small></button
								>{/each}
						</div>
					</section>
					<section class="workspace-detail">
						<div class="pane-head compact">
							<div>
								<h3>{selectedEnrollment ? selectedEnrollment.course_name : 'Pilih satu KRS'}</h3>
							</div>
						</div>
						{#if selectedEnrollment}<div class="detail-lines">
								<div><span>Mahasiswa</span><strong>{selectedEnrollment.student_name}</strong></div>
								<div><span>Mata kuliah</span><strong>{selectedEnrollment.course_name}</strong></div>
								<div><span>Ruang</span><strong>{selectedEnrollment.class_room_name}</strong></div>
								<div>
									<span>Jadwal</span><strong
										>{selectedEnrollment.schedule_day
											? DAY_LABELS[selectedEnrollment.schedule_day as keyof typeof DAY_LABELS]
											: '-'} • {formatTimeRange(
											selectedEnrollment.schedule_start_time,
											selectedEnrollment.schedule_end_time,
											timezone
										)}</strong
									>
								</div>
							</div>{:else}<p class="empty-copy">
								Pilih satu baris untuk meninjau detail KRS.
							</p>{/if}
					</section>
				</div>
			{/if}

			{#if activeView === 'grades'}
				<div class="workspace-shell">
					<section class="workspace-list">
						<div class="pane-head">
							<div>
								<h3>Input dan evaluasi hasil</h3>
							</div>
							{#if currentUser.current.role !== 'STUDENT'}<Button
									variant="ghost"
									size="sm"
									class="ghost-button"
									onclick={() => beginCreate('grades')}>Baru</Button
								>{/if}
						</div>
						<label class="search-box"
							><Search size={16} /><input
								bind:value={gradeSearch}
								aria-label="Cari nilai"
								placeholder="Cari mahasiswa, mata kuliah, atau huruf nilai"
							/></label
						>
						<div class="list-stack">
							{#each filteredGrades as item (item.id)}<button
									type="button"
									class:selected={selectedGradeId === item.id}
									class="list-row"
									onclick={() => pickGrade(item)}
									><div>
										<strong>{item.student_name}</strong><span
											>{item.course_name} • {item.letter_grade}</span
										>
									</div>
									<small>{item.total_score ?? '-'} poin</small></button
								>{/each}
						</div>
					</section>
					<section class="workspace-detail">
						<div class="pane-head compact">
							<div>
								<h3>
									{selectedGrade
										? `${selectedGrade.student_name} • ${selectedGrade.course_name}`
										: 'Input nilai baru'}
								</h3>
							</div>
							{#if currentUser.current.role !== 'STUDENT'}
								<div class="detail-actions">
									{#if editorView === 'grades'}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => stopEditing('grades')}>Tutup editor</Button
										>
									{:else if selectedGrade}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => beginEdit('grades')}>Ubah</Button
										>
									{/if}
									{#if selectedGradeId}
										<Button
											variant="destructive"
											size="sm"
											class="danger-button"
											onclick={() => requestDelete('grade', selectedGradeId!)}>Hapus</Button
										>
									{/if}
								</div>
							{/if}
						</div>
						{#if pendingDelete?.kind === 'grade' && pendingDelete.id === selectedGradeId}
							<section class="warning-panel">
								<p class="warning-title">Hapus {pendingDelete.label}?</p>
								<p>{pendingDelete.message}</p>
								<div class="warning-actions">
									<Button
										class="danger-button"
										variant="destructive"
										size="sm"
										onclick={() => removeEntity(pendingDelete!.kind, pendingDelete!.id)}
										>{pendingDelete.confirmLabel}</Button
									>
									<Button
										class="ghost-button"
										variant="ghost"
										size="sm"
										onclick={() => (pendingDelete = null)}>Batal</Button
									>
								</div>
							</section>
						{/if}
						{#if selectedGrade && editorView !== 'grades'}<div class="detail-stack">
								<div class="detail-lines">
									<div><span>Total</span><strong>{selectedGrade.total_score}</strong></div>
									<div><span>Huruf</span><strong>{selectedGrade.letter_grade}</strong></div>
									<div><span>Tugas</span><strong>{selectedGrade.assignment_score}</strong></div>
									<div>
										<span>UTS/UAS</span><strong
											>{selectedGrade.midterm_score} / {selectedGrade.final_score}</strong
										>
									</div>
								</div>
								<p class="detail-hint">
									Mode tinjau memisahkan pembacaan hasil dari proses edit nilai yang lebih sensitif.
								</p>
							</div>{:else if currentUser.current.role !== 'STUDENT' && editorView === 'grades'}<form
								class="editor-grid"
								{...selectedGradeId ? updateGradeEnhance : createGradeEnhance}
							>
								{#if selectedGradeId}<input
										type="hidden"
										{...updateGrade.fields.id.as('text')}
										bind:value={gradeDraft.id}
									/>{/if}<label
									><span>KRS</span><select
										{...selectedGradeId
											? updateGrade.fields.enrollmentId.as('select')
											: createGrade.fields.enrollmentId.as('select')}
										bind:value={gradeDraft.enrollmentId}
										><option value="">Pilih KRS</option
										>{#if collectionIssues.enrollments && !enrollments.length}<option
												value=""
												disabled>{collectionIssues.enrollments}</option
											>{/if}{#each enrollments as item (item.id)}<option value={item.id}
												>{item.student_name} • {item.course_name}</option
											>{/each}</select
									></label
								><label
									><span>Tugas</span><input
										min="0"
										max="100"
										{...selectedGradeId
											? updateGrade.fields.assignmentScore.as('number')
											: createGrade.fields.assignmentScore.as('number')}
										bind:value={gradeDraft.assignmentScore}
									/></label
								><label
									><span>UTS</span><input
										min="0"
										max="100"
										{...selectedGradeId
											? updateGrade.fields.midtermScore.as('number')
											: createGrade.fields.midtermScore.as('number')}
										bind:value={gradeDraft.midtermScore}
									/></label
								><label
									><span>UAS</span><input
										min="0"
										max="100"
										{...selectedGradeId
											? updateGrade.fields.finalScore.as('number')
											: createGrade.fields.finalScore.as('number')}
										bind:value={gradeDraft.finalScore}
									/></label
								>{#if gradeEditorBlocked}<p class="editor-note">
										Data KRS harus tersedia sebelum nilai dapat disimpan.
									</p>{/if}<Button
									type="submit"
									class="primary-button"
									disabled={gradeEditorBlocked}
									>{selectedGradeId ? 'Simpan perubahan' : 'Simpan nilai'}</Button
								>
							</form>{:else}<p class="empty-copy">
								Pilih satu nilai untuk meninjau hasil, atau mulai input baru saat perlu menambah
								evaluasi.
							</p>{/if}
					</section>
				</div>
			{/if}

			{#if activeView === 'users' && currentUser.current.role === 'ADMIN'}
				<div class="workspace-shell">
					<section class="workspace-list">
						<div class="pane-head">
							<div>
								<h3>Daftar akun terhubung</h3>
							</div>
						</div>
						<label class="search-box"
							><Search size={16} /><input
								bind:value={userSearch}
								aria-label="Cari akun"
								placeholder="Cari email atau pemilik akun"
							/></label
						>
						<div class="list-stack">
							{#each filteredUsers as item (item.id)}<button
									type="button"
									class:selected={selectedUserId === item.id}
									class="list-row"
									onclick={() => pickUser(item)}
									><div>
										<strong>{item.email}</strong><span
											>{item.student_name ?? item.lecturer_name ?? 'Admin sistem'}</span
										>
									</div>
									<small>{item.role}</small></button
								>{/each}
						</div>
					</section>
					<section class="workspace-detail">
						<div class="pane-head compact">
							<div>
								<h3>{selectedUser ? selectedUser.email : 'Pilih satu akun'}</h3>
							</div>
							<div class="detail-actions">
								{#if editorView === 'users'}
									<Button
										variant="ghost"
										size="sm"
										class="ghost-button"
										onclick={() => stopEditing('users')}>Tutup editor</Button
									>
								{:else if selectedUser}
									<Button
										variant="ghost"
										size="sm"
										class="ghost-button"
										onclick={() => beginEdit('users')}>Ubah akun</Button
									>
								{/if}
							</div>
						</div>
						{#if selectedUser && editorView !== 'users'}<div class="detail-stack">
								<div class="detail-lines">
									<div><span>Role</span><strong>{selectedUser.role}</strong></div>
									<div>
										<span>Mahasiswa</span><strong>{selectedUser.student_name ?? '-'}</strong>
									</div>
									<div><span>Dosen</span><strong>{selectedUser.lecturer_name ?? '-'}</strong></div>
								</div>
								<p class="detail-hint">
									Tinjau relasi akun lebih dahulu agar perubahan akses dilakukan dengan konteks yang
									jelas.
								</p>
							</div>
						{:else if selectedUser && editorView === 'users'}
							<form class="editor-grid" {...updateUserEnhance}>
								<p class="editor-note">
									Perubahan akun memengaruhi akses login. Tinjau role dan relasi identitas sebelum
									menyimpan.
								</p>
								<input
									type="hidden"
									{...updateUser.fields.id.as('text')}
									bind:value={userDraft.id}
								/><label
									><span>Email</span><input
										{...updateUser.fields.email.as('email')}
										autocomplete="email"
										bind:value={userDraft.email}
									/></label
								><label
									><span>Password baru</span><input
										{...updateUser.fields.password.as('password')}
										autocomplete="new-password"
										bind:value={userDraft.password}
										placeholder="Biarkan kosong bila password tetap dipakai"
									/></label
								><label
									><span>Role akses</span><select
										{...updateUser.fields.role.as('select')}
										bind:value={userDraft.role}
										><option value="ADMIN">ADMIN</option><option value="STUDENT">STUDENT</option
										><option value="LECTURER">LECTURER</option></select
									></label
								><label
									><span>ID mahasiswa terkait</span><input
										{...updateUser.fields.studentId.as('text')}
										bind:value={userDraft.studentId}
									/></label
								><label
									><span>ID dosen terkait</span><input
										{...updateUser.fields.lecturerId.as('text')}
										bind:value={userDraft.lecturerId}
									/></label
								><Button type="submit" class="primary-button">Simpan akun</Button>
							</form>{:else}<p class="empty-copy">
								Pilih satu akun untuk memperbarui email, role, atau relasi identitas.
							</p>{/if}
					</section>
				</div>
			{/if}
		</main>
	</div>
{:else}
	<div class="login-shell">
		<Card.Root class="login-panel">
			<Card.Header>
				<Card.Title class="login-title">
					<p class="kicker">Watum</p>
					Masuk ke operasi akademik
				</Card.Title>
				<Card.Description class="login-description">
					Dasbor ini dirancang untuk membaca jadwal mingguan, utilisasi ruang, dan perubahan data
					akademik dengan ritme yang tenang.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<form class="login-form" {...loginEnhance}>
					<div>
						<Label for="email-login">Email</Label>
						<Input
							id="email-login"
							{...loginUser.fields.email.as('email')}
							autocomplete="email"
							placeholder="nama@kampus.ac.id"
						/>
					</div>
					<div>
						<Label for="password-login">Password</Label>
						<Input
							id="password-login"
							{...loginUser.fields.password.as('password')}
							autocomplete="current-password"
							placeholder="Masukkan password"
						/>
					</div>
					<Button type="submit" class="primary-button wide">Masuk</Button>
				</form>

				{#if feedback}
					<div class={`feedback ${feedback.tone}`}>
						<AlertCircle size={16} />
						<span>{feedback.text}</span>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
{/if}

<style>
	:global(button),
	:global(input),
	:global(select) {
		font: inherit;
	}

	.app-shell {
		display: grid;
		grid-template-columns: 18rem minmax(0, 1fr);
		min-height: 100vh;
	}

	.app-shell.student-app-shell {
		grid-template-columns: 1fr;
	}

	.rail {
		display: grid;
		gap: 1rem;
		padding: 1.25rem;
		border-right: 1px solid var(--color-border);
		background: color-mix(in oklch, var(--color-panel) 88%, var(--color-surface) 12%);
		align-content: start;
	}

	.rail > * {
		min-width: 0;
	}

	.rail-brand h1,
	.topbar h2,
	.login-title,
	.detail-card h3,
	.support-panel h4,
	.workspace-detail h3,
	.workspace-list h3 {
		font: 600 1.3rem/1.06 var(--font-display);
		letter-spacing: -0.035em;
	}

	.rail-brand {
		display: grid;
		gap: 0.45rem;
	}

	.rail-brand h1 {
		font-size: 1.42rem;
		line-height: 1;
	}

	.brand-copy,
	.pane-copy,
	.decision-summary,
	.list-conflict-copy,
	.builder-progress-copy span,
	.builder-overview p,
	.decision-notes p {
		color: var(--color-muted-foreground);
	}

	.brand-copy,
	.pane-copy,
	.decision-summary,
	.decision-notes p,
	.list-conflict-copy,
	.builder-overview p,
	.builder-progress-copy span {
		font-size: 0.92rem;
		line-height: 1.45;
	}

	.rail-brand p:last-child,
	.topbar p,
	.login-description,
	.detail-card p,
	.empty-copy {
		color: var(--color-muted-foreground);
	}

	.warning-panel p:not(.warning-title) {
		line-height: 1.52;
		max-width: 66ch;
	}

	.kicker {
		margin-bottom: 0.35rem;
		font-size: 0.78rem;
		font-weight: 600;
		line-height: 1.3;
		color: var(--color-muted-foreground);
	}

	.rail-sections,
	.topbar-copy,
	.decision-board,
	.decision-lead,
	.decision-actions,
	.decision-notes,
	.section-tabs,
	.builder-progress,
	.builder-form,
	.builder-overview,
	.builder-section,
	.builder-section-head,
	.builder-section-actions,
	.builder-room-stage,
	.detail-stack {
		display: grid;
	}

	.rail-sections {
		gap: 0.55rem;
		width: 100%;
		min-width: 0;
	}

	:global(.nav-item),
	:global(.ghost-button),
	:global(.primary-button),
	:global(.danger-button),
	:global(.theme-switch),
	.list-row,
	.feedback,
	.user-pill {
		border-radius: 0.8rem;
	}

	:global(.nav-item) {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 0.82rem 0.88rem;
		border: 1px solid transparent;
		background: transparent;
		text-align: left;
		color: inherit;
		justify-content: flex-start;
		width: 100%;
		min-width: 0;
		height: auto;
		white-space: normal;
	}

	.nav-group-copy {
		display: grid;
		gap: 0.18rem;
		min-width: 0;
		flex: 1 1 auto;
	}

	.nav-group-copy strong {
		display: block;
		font-size: 0.94rem;
		line-height: 1.25;
		overflow-wrap: anywhere;
	}

	:global(.nav-item:hover) {
		background: color-mix(in oklch, var(--color-surface) 82%, var(--color-panel) 18%);
	}

	:global(.nav-item:focus-visible),
	:global(.section-tab:focus-visible),
	.list-row:focus-visible,
	.builder-progress-item:focus-visible {
		outline: 2px solid color-mix(in oklch, var(--color-accent-strong) 42%, transparent 58%);
		outline-offset: 2px;
		border-color: color-mix(in oklch, var(--color-accent-strong) 40%, var(--color-border) 60%);
	}

	:global(.nav-item.selected) {
		background: color-mix(in oklch, var(--color-surface) 76%, var(--color-accent-soft) 24%);
		border-color: var(--color-accent-strong);
	}

	.main-shell {
		display: grid;
		gap: 1.15rem;
		padding: 1.3rem;
		align-content: start;
		min-width: 0;
	}

	.main-shell.student-shell {
		max-width: 72rem;
		width: 100%;
		margin: 0 auto;
	}

	.section-tabs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.section-tabs-compact {
		justify-content: start;
	}

	:global(.section-tab) {
		justify-content: center;
		flex: 0 0 auto;
		border-radius: 0.7rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel);
		color: var(--color-foreground);
	}

	:global(.section-tab.selected) {
		border-color: var(--color-accent-strong);
		background: color-mix(in oklch, var(--color-surface) 62%, var(--color-accent-soft) 38%);
		color: var(--color-foreground);
		font-weight: 600;
	}

	.topbar {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: start;
		flex-wrap: wrap;
	}

	.topbar-copy {
		gap: 0.35rem;
		max-width: 48rem;
		min-width: 0;
		flex: 1 1 20rem;
	}

	.topbar-copy h2 {
		font-size: 1.72rem;
		line-height: 1;
	}

	.topbar-tools {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		flex-wrap: wrap;
		justify-content: end;
		min-width: 0;
		flex: 1 1 auto;
	}

	.detail-actions {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
		justify-content: end;
	}

	:global(.header-action) {
		white-space: nowrap;
	}

	:global(.theme-switch),
	:global(.ghost-button),
	:global(.danger-button) {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.68rem 0.9rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel);
		color: inherit;
	}

	:global(.theme-switch:hover),
	:global(.ghost-button:hover),
	:global(.danger-button:hover) {
		background: color-mix(in oklch, var(--color-surface) 84%, var(--color-panel) 16%);
	}

	:global(.danger-button) {
		color: var(--color-danger);
	}

	:global(.primary-button) {
		padding: 0.82rem 1rem;
		border: 1px solid var(--color-accent-strong);
		background: var(--color-accent-strong);
		color: var(--color-accent-contrast);
	}

	:global(.primary-button:hover) {
		background: color-mix(in oklch, var(--color-accent-strong) 88%, black 12%);
	}

	:global(.primary-button:disabled) {
		border-color: color-mix(in oklch, var(--color-border) 72%, var(--color-surface) 28%);
		background: color-mix(in oklch, var(--color-panel) 78%, var(--color-surface) 22%);
		color: var(--color-muted-foreground);
	}

	:global(.primary-button.wide) {
		width: 100%;
	}

	.user-pill {
		display: grid;
		gap: 0.15rem;
		padding: 0.58rem 0.8rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel);
		width: fit-content;
		max-width: 100%;
		min-width: 0;
	}

	.user-pill span,
	.list-row span,
	.list-row small,
	.detail-lines span,
	.support-list span,
	.editor-grid label span,
	.feedback span {
		color: var(--color-muted-foreground);
	}

	.user-pill-label {
		font-size: 0.94rem;
		line-height: 1.3;
	}

	.feedback {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.82rem 0.95rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel);
	}

	.feedback span {
		font-size: 0.95rem;
		line-height: 1.4;
	}

	.feedback.success {
		border-color: color-mix(in oklch, var(--color-success) 38%, var(--color-border) 62%);
		background: color-mix(in oklch, var(--color-surface) 72%, var(--color-success-soft) 28%);
	}

	.feedback.danger {
		border-color: color-mix(in oklch, var(--color-danger) 42%, var(--color-border) 58%);
		background: color-mix(in oklch, var(--color-surface) 72%, var(--color-danger-soft) 28%);
	}

	.warning-panel {
		display: grid;
		gap: 0.75rem;
		padding: 0.95rem 1rem;
		border: 1px solid color-mix(in oklch, var(--color-danger) 38%, var(--color-border) 62%);
		border-radius: var(--radius-xl);
		background: color-mix(in oklch, var(--color-surface) 76%, var(--color-danger-soft) 24%);
	}

	.warning-panel p {
		margin: 0;
	}

	.warning-title {
		font-weight: 600;
	}

	.warning-actions {
		display: flex;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.support-warning {
		display: grid;
		gap: 0.6rem;
		padding: 0.95rem 1rem;
		border: 1px solid color-mix(in oklch, var(--color-danger) 20%, var(--color-border) 80%);
		border-radius: var(--radius-xl);
		background: color-mix(in oklch, var(--color-surface) 92%, var(--color-danger-soft) 8%);
	}

	.support-warning-list {
		margin: 0;
		padding-left: 1.1rem;
		display: grid;
		gap: 0.22rem;
	}

	.support-warning-list li {
		line-height: 1.42;
	}

	.loading-panel,
	.detail-card,
	.workspace-list,
	.workspace-detail,
	.support-panel,
	.login-panel {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-panel);
	}

	.loading-panel,
	.detail-card,
	.workspace-list,
	.workspace-detail,
	.support-panel,
	.login-panel {
		padding: 1.1rem;
	}

	.dashboard-stack,
	.calendar-layout,
	.workspace-shell {
		display: grid;
		gap: 1rem;
	}

	.student-dashboard,
	.student-summary-row,
	.student-grade-items {
		display: grid;
		gap: 0.75rem;
	}

	.student-hero,
	.student-summary-row div,
	.student-grade-list {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-panel);
	}

	.student-hero,
	.student-grade-list {
		padding: 1.1rem;
	}

	.student-hero {
		display: grid;
		gap: 0.9rem;
	}

	.student-hero-copy {
		display: grid;
		gap: 0.25rem;
	}

	.student-hero-copy span,
	.student-summary-row span,
	.student-grade-items span {
		color: var(--color-muted-foreground);
	}

	.student-hero-copy strong {
		font: 600 1.38rem/1.08 var(--font-display);
		letter-spacing: -0.03em;
	}

	.student-hero-copy p,
	.student-grade-list h3 {
		margin: 0;
	}

	.student-actions {
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
	}

	.student-summary-row {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.student-summary-row div {
		padding: 0.9rem;
		display: grid;
		gap: 0.2rem;
	}

	.student-summary-row strong,
	.student-grade-items strong {
		font-size: 0.98rem;
		line-height: 1.3;
	}

	.student-grade-list {
		display: grid;
		gap: 0.8rem;
	}

	.student-grade-items {
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
	}

	.student-grade-items div {
		display: grid;
		gap: 0.2rem;
		padding: 0.85rem 0.9rem;
		border: 1px solid var(--color-border);
		border-radius: 0.8rem;
		background: var(--color-surface);
	}

	.decision-board {
		grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
		gap: 1rem;
	}

	.decision-lead,
	.decision-notes {
		border: 1px solid var(--color-border);
		background: var(--color-panel);
		border-radius: var(--radius-xl);
		padding: 1.1rem;
	}

	.decision-alert {
		border-color: color-mix(in oklch, var(--color-danger) 28%, var(--color-border) 72%);
		background: color-mix(in oklch, var(--color-panel) 82%, var(--color-danger-soft) 18%);
	}

	.decision-steady {
		border-color: color-mix(in oklch, var(--color-success) 22%, var(--color-border) 78%);
	}

	.decision-lead {
		gap: 0.7rem;
	}

	.decision-title {
		font: 600 1.62rem/1.02 var(--font-display);
		letter-spacing: -0.04em;
		max-width: 16ch;
	}

	.decision-summary {
		margin: 0;
		max-width: 58ch;
	}

	.decision-primary {
		display: grid;
		gap: 0.4rem;
		padding: 0.95rem 1rem;
		border: 1px solid color-mix(in oklch, var(--color-danger) 20%, var(--color-border) 80%);
		border-radius: 0.8rem;
		background: color-mix(in oklch, var(--color-surface) 90%, var(--color-danger-soft) 10%);
	}

	.decision-primary-steady {
		border-color: color-mix(in oklch, var(--color-success) 18%, var(--color-border) 82%);
		background: color-mix(in oklch, var(--color-surface) 94%, var(--color-success-soft) 6%);
	}

	.decision-primary-copy {
		display: grid;
		gap: 0.18rem;
	}

	.decision-primary-copy span,
	.decision-secondary-count {
		color: var(--color-muted-foreground);
	}

	.decision-primary-copy strong {
		font-size: 1rem;
		line-height: 1.35;
	}

	.decision-primary-copy p,
	.decision-secondary-count {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.4;
	}

	.decision-actions {
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 0.65rem;
	}

	.decision-notes {
		gap: 0;
		align-content: start;
	}

	.decision-note-row {
		display: grid;
		gap: 0.2rem;
		padding: 0.9rem 0;
	}

	.decision-note-row + .decision-note-row {
		border-top: 1px solid var(--color-border);
	}

	.decision-notes span,
	.builder-overview span {
		color: var(--color-muted-foreground);
	}

	.decision-note-row strong,
	.builder-overview strong {
		font-size: 0.98rem;
		line-height: 1.3;
	}

	.builder-overview div {
		display: grid;
		gap: 0.24rem;
		padding: 0.9rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		border-radius: 0.8rem;
	}

	.metric-card {
		position: relative;
		overflow: hidden;
	}

	.metric-card::after {
		content: '';
		position: absolute;
		inset: auto 0 0 0;
		height: 0.18rem;
		opacity: 0.9;
	}

	.metric-alert {
		border-color: color-mix(in oklch, var(--color-danger) 26%, var(--color-border) 74%);
		background: color-mix(in oklch, var(--color-surface) 88%, var(--color-danger-soft) 12%);
	}

	.metric-alert::after {
		background: color-mix(in oklch, var(--color-danger) 78%, var(--color-accent-strong) 22%);
	}

	.metric-open {
		border-color: color-mix(in oklch, var(--color-success) 24%, var(--color-border) 76%);
		background: color-mix(in oklch, var(--color-surface) 90%, var(--color-success-soft) 10%);
	}

	.metric-open::after {
		background: color-mix(in oklch, var(--color-success) 68%, var(--color-accent-strong) 32%);
	}

	.metric-schedule {
		border-color: color-mix(in oklch, var(--color-accent-strong) 24%, var(--color-border) 76%);
		background: color-mix(in oklch, var(--color-surface) 88%, var(--color-accent-soft) 12%);
	}

	.metric-schedule::after {
		background: color-mix(in oklch, var(--color-accent-strong) 86%, var(--color-success) 14%);
	}

	.metric-active {
		box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--color-surface) 30%, transparent 70%);
	}

	.metric-value {
		font: 600 1.14rem/1.08 var(--font-display);
		letter-spacing: -0.03em;
	}

	.focus-copy,
	.detail-lines,
	.support-list,
	.editor-grid,
	.login-form,
	.list-stack,
	.builder-snapshot,
	.search-box,
	.pane-head {
		display: grid;
		gap: 0.8rem;
	}

	.focus-copy strong,
	.detail-lines strong,
	.support-list strong,
	.list-row strong {
		font-size: 0.96rem;
	}

	.list-row strong {
		line-height: 1.24;
	}

	.list-row small,
	.list-row span,
	.detail-lines span,
	.support-list span,
	.detail-hint,
	.editor-note,
	.warning-panel p:not(.warning-title) {
		font-size: 0.91rem;
		line-height: 1.42;
	}

	.detail-stack {
		gap: 0.8rem;
	}

	.detail-hint {
		margin: 0;
		font-size: 0.9rem;
		color: var(--color-muted-foreground);
	}

	.calendar-conflict-copy {
		margin: 0 0 0.85rem;
		font-size: 0.92rem;
		line-height: 1.42;
		color: var(--conflict-ink, var(--color-danger));
		max-width: 72ch;
	}

	.calendar-overlap-panel {
		display: grid;
		gap: 0.7rem;
	}

	.calendar-overlap-panel h4 {
		font-size: 1rem;
		line-height: 1.15;
	}

	.calendar-overlap-list {
		display: grid;
		gap: 0.75rem;
	}

	.calendar-overlap-item {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.75rem;
		align-items: start;
		padding: 0.85rem 0.9rem;
		border: 1px solid var(--color-border);
		border-radius: 0.8rem;
		background: var(--color-surface);
	}

	.calendar-overlap-item.conflict {
		border-color: var(--conflict-border);
		background: color-mix(in oklch, var(--conflict-surface) 82%, var(--color-panel) 18%);
	}

	.calendar-overlap-copy {
		display: grid;
		gap: 0.2rem;
		min-width: 0;
	}

	.calendar-overlap-copy span,
	.calendar-overlap-copy small {
		color: var(--color-muted-foreground);
	}

	.calendar-overlap-item.conflict .calendar-overlap-copy strong {
		color: var(--conflict-ink);
	}

	.calendar-overlap-item.conflict .calendar-overlap-copy span,
	.calendar-overlap-item.conflict .calendar-overlap-copy small {
		color: color-mix(in oklch, var(--conflict-ink) 72%, var(--color-foreground) 28%);
	}

	.calendar-overlap-actions {
		display: flex;
		gap: 0.55rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.builder-conflict-copy {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.42;
		color: var(--conflict-ink, var(--color-danger));
		max-width: 70ch;
	}

	.selected-danger {
		color: var(--color-danger);
	}

	.selected-safe {
		color: var(--color-success);
	}

	.detail-card.calendar-conflict {
		border-color: var(--conflict-border);
		background: color-mix(in oklch, var(--conflict-surface) 82%, var(--color-panel) 18%);
	}

	.detail-card.calendar-conflict h3 {
		color: var(--conflict-ink);
	}

	.workspace-shell {
		grid-template-columns: minmax(0, 0.84fr) minmax(0, 1.16fr);
		align-items: stretch;
	}

	.builder-shell {
		grid-template-columns: minmax(20rem, 0.9fr) minmax(0, 1.1fr);
		height: calc(100svh - 18rem);
		min-height: calc(100svh - 18rem);
		align-items: stretch;
	}

	.workspace-list,
	.workspace-detail {
		align-content: start;
		min-height: 0;
	}

	.workspace-list {
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr);
		gap: 0.8rem;
	}

	.workspace-list .list-stack {
		min-height: 0;
		overflow: auto;
	}

	.workspace-detail {
		overflow: auto;
	}

	.builder-list {
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr);
		gap: 0.8rem;
		min-height: 0;
	}

	.builder-list .list-stack {
		height: 100%;
		min-height: 0;
		overflow: auto;
		padding-right: 0.1rem;
	}

	.builder-detail {
		min-height: 0;
		overflow: auto;
		border-color: color-mix(in oklch, var(--color-accent-strong) 18%, var(--color-border) 82%);
	}

	.pane-head {
		grid-template-columns: 1fr auto;
		align-items: start;
	}

	.pane-head.compact {
		margin-bottom: 0.6rem;
	}

	.builder-progress {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 0.65rem;
	}

	.builder-progress-item {
		display: flex;
		align-items: flex-start;
		flex: 0 1 auto;
		gap: 0.7rem;
		padding: 0.85rem 0.9rem;
		border: 1px solid var(--color-border);
		border-radius: 0.8rem;
		background: var(--color-panel);
		text-align: left;
		color: inherit;
		width: fit-content;
		max-width: min(100%, 18rem);
	}

	.builder-progress-item:disabled {
		opacity: 0.55;
	}

	.builder-progress-item.active {
		border-color: var(--color-accent-strong);
		background: color-mix(in oklch, var(--color-surface) 74%, var(--color-accent-soft) 26%);
	}

	.builder-progress-item.complete {
		border-color: color-mix(in oklch, var(--color-success) 26%, var(--color-border) 74%);
		background: color-mix(in oklch, var(--color-surface) 90%, var(--color-success-soft) 10%);
	}

	.builder-progress-item.available:hover {
		border-color: color-mix(in oklch, var(--color-accent-strong) 22%, var(--color-border) 78%);
	}

	.builder-progress-index {
		display: inline-grid;
		place-items: center;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 999px;
		background: color-mix(in oklch, var(--color-surface) 70%, var(--color-border) 30%);
		font-size: 0.82rem;
		font-weight: 700;
		flex: 0 0 auto;
	}

	.builder-progress-item.active .builder-progress-index,
	.builder-progress-item.complete .builder-progress-index {
		background: var(--color-accent-strong);
		color: var(--color-accent-contrast);
	}

	.builder-progress-copy {
		display: grid;
		gap: 0.12rem;
		min-width: 0;
	}

	.builder-progress-copy strong {
		font-size: 0.93rem;
		line-height: 1.25;
	}

	.builder-progress-copy span {
		width: 0;
		max-width: 0;
		max-height: 0;
		overflow: hidden;
		opacity: 0;
		transition:
			max-width 180ms ease,
			max-height 180ms ease,
			opacity 180ms ease;
	}

	.builder-progress-item.active .builder-progress-copy span {
		width: auto;
		max-width: 14rem;
		max-height: 6rem;
		opacity: 1;
	}

	.builder-form {
		gap: 1rem;
	}

	.builder-overview,
	.builder-snapshot {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 0.75rem;
	}

	.builder-snapshot div {
		display: grid;
		flex: 0 1 auto;
		gap: 0.24rem;
		padding: 0.88rem 0.95rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		border-radius: 0.8rem;
		width: fit-content;
		max-width: min(100%, 24rem);
	}

	.builder-snapshot span {
		color: var(--color-muted-foreground);
	}

	.builder-snapshot strong {
		font-size: 0.98rem;
		line-height: 1.3;
	}

	.builder-snapshot p {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.42;
		color: var(--color-muted-foreground);
	}

	.builder-section {
		gap: 0.8rem;
		padding: 1rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel);
		border-radius: var(--radius-xl);
	}

	.builder-section.hidden-stage {
		display: none;
	}

	.builder-section:first-of-type {
		border-color: color-mix(in oklch, var(--color-accent-strong) 20%, var(--color-border) 80%);
	}

	.builder-section:nth-of-type(2) {
		border-color: color-mix(in oklch, var(--color-danger) 16%, var(--color-border) 84%);
	}

	.builder-section:nth-of-type(3) {
		border-color: color-mix(in oklch, var(--color-success) 18%, var(--color-border) 82%);
	}

	.builder-section-head {
		gap: 0.25rem;
	}

	.builder-section-head h4 {
		font: 600 1.12rem/1.08 var(--font-display);
		letter-spacing: -0.025em;
	}

	.builder-note {
		margin: 0;
		max-width: 58ch;
		color: var(--color-muted-foreground);
		font-size: 0.91rem;
		line-height: 1.42;
	}

	.builder-section-head p,
	.builder-review-note p {
		margin: 0;
	}

	.builder-section-actions {
		gap: 0.75rem;
		padding-top: 0.15rem;
	}

	.builder-section-actions.split {
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
	}

	.builder-inline-actions {
		display: flex;
		gap: 0.65rem;
		flex-wrap: wrap;
		justify-content: flex-end;
	}

	.panel-title {
		font-size: 1.16rem;
		line-height: 1.08;
	}

	.warning-title {
		font: 600 1.04rem/1.08 var(--font-display);
		letter-spacing: -0.02em;
	}

	.builder-room-stage {
		grid-template-columns: minmax(0, 1fr) minmax(0, 0.8fr);
		gap: 0.85rem;
		align-items: start;
	}

	.builder-room-grid {
		grid-template-columns: 1fr;
	}

	.builder-support {
		padding: 0.95rem;
	}

	.builder-review-grid {
		margin-bottom: 0;
	}

	.builder-review-note {
		display: grid;
		gap: 0.7rem;
	}

	.builder-submit {
		min-width: 13rem;
	}

	.search-box {
		grid-template-columns: auto 1fr;
		align-items: center;
		padding: 0.7rem 0.85rem;
		border: 1px solid var(--color-border);
		border-radius: 0.8rem;
		background: var(--color-surface);
	}

	.search-box:focus-within {
		border-color: color-mix(in oklch, var(--color-accent-strong) 46%, var(--color-border) 54%);
		box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--color-accent-strong) 18%, transparent 82%);
	}

	.search-box input,
	.editor-grid input,
	.editor-grid select,
	.login-form input {
		width: 100%;
		padding: 0.72rem 0.85rem;
		border: 1px solid var(--color-border);
		border-radius: 0.8rem;
		background: var(--color-surface);
		color: inherit;
	}

	.editor-grid input:focus,
	.editor-grid select:focus,
	.login-form input:focus,
	.search-box input:focus {
		outline: 2px solid color-mix(in oklch, var(--color-accent-strong) 32%, transparent 68%);
		outline-offset: 1px;
	}

	.search-box input {
		padding: 0;
		border: 0;
		background: transparent;
	}

	.list-row {
		display: flex;
		justify-content: space-between;
		gap: 0.8rem;
		align-items: center;
		padding: 0.85rem 0.95rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		text-align: left;
		color: inherit;
		border-radius: 0.8rem;
	}

	.list-row:hover {
		border-color: color-mix(in oklch, var(--color-accent-strong) 16%, var(--color-border) 84%);
	}

	.list-row > div {
		display: grid;
		gap: 0.22rem;
		min-width: 0;
	}

	.list-conflict-copy {
		display: block;
		line-height: 1.38;
		color: var(--color-danger);
	}

	.list-row.selected {
		border-color: var(--color-accent-strong);
		background: color-mix(in oklch, var(--color-surface) 72%, var(--color-accent-soft) 28%);
		box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--color-accent-strong) 28%, transparent 72%);
	}

	.list-row.conflict {
		background: var(--conflict-surface);
		border-color: var(--conflict-border);
	}

	.list-row.conflict strong {
		color: var(--conflict-ink);
	}

	.list-row.conflict .list-conflict-copy {
		color: var(--conflict-ink);
	}

	.list-row.conflict.selected {
		box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--conflict-border) 24%, transparent 76%);
	}

	.list-row:hover {
		border-color: color-mix(in oklch, var(--color-accent-strong) 24%, var(--color-border) 76%);
	}

	.detail-lines {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		margin-bottom: 0.9rem;
	}

	.detail-lines div,
	.support-list div {
		display: grid;
		flex: 0 1 auto;
		gap: 0.22rem;
		padding: 0.82rem;
		border-radius: 0.8rem;
		background: var(--color-surface);
		width: fit-content;
		max-width: min(100%, 24rem);
	}

	.editor-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.editor-grid label {
		display: grid;
		gap: 0.35rem;
	}

	.editor-grid :global(.primary-button),
	.editor-grid .check-row,
	.editor-note {
		grid-column: 1 / -1;
	}

	.editor-note {
		color: var(--color-muted-foreground);
		font-size: 0.85rem;
	}

	.check-row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.78rem 0.85rem;
		border: 1px solid var(--color-border);
		border-radius: 0.8rem;
		background: var(--color-surface);
	}

	.support-panel h4 {
		margin-bottom: 0.8rem;
	}

	.login-shell {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 1.2rem;
	}

	.login-panel {
		width: min(100%, 34rem);
		display: grid;
		gap: 1rem;
	}

	.login-form label {
		display: grid;
		gap: 0.35rem;
	}

	@media (max-width: 1080px) {
		.app-shell {
			grid-template-columns: 1fr;
		}

		.rail {
			border-right: 0;
			border-bottom: 1px solid var(--color-border);
		}

		.rail-sections,
		.builder-progress {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.student-summary-row,
		.student-grade-items {
			grid-template-columns: 1fr;
		}

		.workspace-shell {
			grid-template-columns: 1fr;
		}

		.builder-shell {
			height: auto;
			min-height: 0;
		}

		.builder-list .list-stack,
		.builder-detail {
			max-height: none;
			min-height: 0;
		}

		.decision-board,
		.builder-room-stage {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 720px) {
		.main-shell,
		.rail {
			padding: 1rem;
		}

		.topbar,
		.pane-head {
			grid-template-columns: 1fr;
			display: grid;
		}

		.topbar-tools {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.6rem;
			width: 100%;
		}

		.topbar-copy h2 {
			font-size: 1.48rem;
		}

		.builder-progress,
		.builder-snapshot,
		.editor-grid,
		.detail-lines,
		.builder-overview,
		.decision-actions {
			grid-template-columns: 1fr;
		}

		.builder-section-actions.split {
			grid-template-columns: 1fr;
		}

		.builder-inline-actions {
			justify-content: stretch;
		}

		.builder-inline-actions :global(button),
		.builder-section-actions :global(button),
		.topbar-tools :global(button) {
			width: 100%;
		}

		.list-row {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: start;
		}

		.user-pill {
			width: 100%;
			min-width: 0;
		}

		.warning-actions > * {
			flex: 1 1 100%;
		}

		.workspace-list .list-stack {
			max-height: 18rem;
			overflow: auto;
		}
	}
</style>
