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
		DAY_ORDER,
		DAY_LABELS,
		formatTimeRange,
		matchesText,
		toMinutes,
		type AppRole,
		type ScheduleCard
	} from '$lib/app/academic';
	import { formatDateTimeInput, parseISO } from '$lib/time-helpers';
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
		| 'overview'
		| 'planning'
		| 'records'
		| 'people'
		| 'access'
		| 'schedule'
		| 'study';
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
	const DEFAULT_DAY_START = 7 * 60;
	const DEFAULT_DAY_END = 20 * 60;
	const RANGE_PADDING_MINUTES = 60;
	const MIN_VISIBLE_MINUTES = 6 * 60;
	const CALENDAR_WEEK_START = new Date(2025, 0, 6);

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
					id: 'overview',
					label: 'Pantauan',
					description: 'Pantau bentrok, kalender, dan ruang yang perlu ditangani lebih dulu.',
					icon: LayoutPanelTop,
					views: ['dashboard', 'calendar']
				},
				{
					id: 'planning',
					label: 'Penjadwalan',
					description: 'Atur jadwal kelas dan pilih ruang pengganti dari alur kerja yang sama.',
					icon: Waypoints,
					views: ['builder', 'classrooms']
				},
				{
					id: 'records',
					label: 'Perkuliahan',
					description: 'Buka KRS, nilai, dan katalog kuliah yang aktif pada semester ini.',
					icon: ClipboardList,
					views: ['enrollments', 'grades', 'courses']
				},
				{
					id: 'people',
					label: 'Identitas',
					description: 'Rapikan data mahasiswa, dosen, fakultas, dan program studi.',
					icon: Building2,
					views: ['students', 'lecturers', 'faculties', 'studyPrograms']
				},
				{
					id: 'access',
					label: 'Akun',
					description: 'Perbarui peran dan akses login saat relasi identitas berubah.',
					icon: ShieldCheck,
					views: ['users']
				}
			];
		}

		if (role === 'LECTURER') {
			return [
				{
					id: 'overview',
					label: 'Pantauan',
					description: 'Lihat kelas terdekat, cek bentrok, dan cari ruang yang siap dipakai.',
					icon: LayoutPanelTop,
					views: ['dashboard', 'calendar']
				},
				{
					id: 'planning',
					label: 'Penjadwalan',
					description: 'Pindahkan jadwal dan pilih ruang dari alur yang lebih fokus.',
					icon: Waypoints,
					views: ['builder', 'classrooms']
				},
				{
					id: 'records',
					label: 'Perkuliahan',
					description: 'Buka KRS, nilai, dan mata kuliah aktif saat keputusan akademik diperlukan.',
					icon: ClipboardList,
					views: ['enrollments', 'grades', 'courses']
				},
				{
					id: 'people',
					label: 'Referensi',
					description: 'Lihat mahasiswa, dosen, fakultas, dan program studi sebagai referensi.',
					icon: Building2,
					views: ['students', 'lecturers', 'faculties', 'studyPrograms']
				}
			];
		}

		return [
			{
				id: 'schedule',
				label: 'Jadwal',
				description: 'Lihat kelas berikutnya, perubahan ruang, dan jadwal mingguan dengan cepat.',
				icon: CalendarDays,
				views: ['dashboard', 'calendar']
			},
			{
				id: 'study',
				label: 'Studi',
				description: 'Buka KRS, nilai, ruang, dan katalog kuliah tanpa panel staf yang penuh.',
				icon: BookOpen,
				views: ['enrollments', 'grades', 'courses', 'lecturers', 'classrooms']
			}
		];
	}

	function pageHeading(view: ViewId) {
		if (currentUser.current?.role === 'STUDENT' && view === 'dashboard') return 'Jadwal dan nilai';
		if (view === 'dashboard') return 'Pantauan ruang dan jadwal';
		if (view === 'calendar') return 'Kalender perkuliahan';
		if (view === 'builder') return 'Penjadwalan kelas';
		return viewCatalog[view].label;
	}

	function pageSummary(view: ViewId, role: AppRole | undefined) {
		if (role === 'STUDENT' && view === 'dashboard') {
			return 'Lihat kelas berikutnya, ruang kuliah, dan nilai terbaru dari satu panel ringkas.';
		}

		if (view === 'dashboard') {
			return role === 'ADMIN'
				? 'Mulai dari bentrok terdekat, lalu cek ruang yang masih longgar sebelum mengubah jadwal.'
				: 'Mulai dari kelas terdekat, lalu cek ruang pengganti jika ada bentrok.';
		}

		if (view === 'calendar') {
			return 'Bandingkan slot per hari, pilih blok yang relevan, lalu buka penjadwalan langsung dari sini.';
		}

		if (view === 'builder') {
			return 'Selesaikan satu jadwal sampai siap disimpan: pilih peserta, tentukan slot, pilih ruang, lalu tinjau.';
		}

		if (view === 'classrooms') {
			return 'Tinjau kapasitas dan fasilitas ruang lebih dulu, lalu edit hanya saat data inventaris berubah.';
		}

		if (view === 'courses') {
			return 'Tinjau beban kuliah, dosen pengampu, dan program studi sebelum mengubah katalog.';
		}

		if (view === 'students') {
			return 'Buka identitas mahasiswa yang relevan lebih dulu agar perubahan akademik tetap punya konteks.';
		}

		if (view === 'lecturers') {
			return 'Periksa dosen pengampu dan kontak yang terhubung sebelum memperbarui data dosen.';
		}

		if (view === 'faculties') {
			return 'Jaga struktur fakultas tetap rapi agar program studi dan katalog lain tetap punya acuan.';
		}

		if (view === 'studyPrograms') {
			return 'Pastikan setiap program studi terhubung ke fakultas yang tepat sebelum disimpan.';
		}

		if (view === 'enrollments') {
			return 'Gunakan daftar kiri untuk menemukan KRS yang tepat, lalu baca jadwal, ruang, dan semester di panel detail.';
		}

		if (view === 'grades') {
			return 'Pisahkan peninjauan hasil dari proses input agar evaluasi dan perubahan nilai tidak bercampur.';
		}

		return 'Tinjau akses login dengan konteks identitas yang jelas sebelum memperbarui peran atau kredensial.';
	}

	function workspacePanelLead(view: ViewId) {
		if (view === 'classrooms') {
			return 'Panel kanan menampilkan kapasitas, fasilitas, dan ringkasan jadwal ruang yang dipilih.';
		}

		if (view === 'courses') {
			return 'Panel kanan merangkum dosen pengampu, program studi, dan beban kuliah sebelum Anda mengedit data.';
		}

		if (view === 'students') {
			return 'Panel kanan menjaga konteks mahasiswa tetap terlihat saat data akademik diperbarui.';
		}

		if (view === 'lecturers') {
			return 'Panel kanan menyatukan identitas dosen dan detail pengampu agar perubahan tetap terarah.';
		}

		if (view === 'faculties') {
			return 'Panel kanan membantu Anda membaca struktur fakultas sebelum menambah atau mengubah data.';
		}

		if (view === 'studyPrograms') {
			return 'Panel kanan menampilkan hubungan program studi dan fakultas agar struktur akademik tetap jelas.';
		}

		if (view === 'enrollments') {
			return 'Panel kanan menampilkan ringkasan KRS dari baris yang sedang dipilih.';
		}

		if (view === 'grades') {
			return 'Panel kanan memisahkan peninjauan hasil dari proses input agar evaluasi tetap mudah dibaca.';
		}

		return 'Panel kanan merangkum peran dan relasi identitas sebelum akses login diperbarui.';
	}

	function dashboardPriorityLabel(role: AppRole | undefined) {
		if (role === 'ADMIN')
			return 'Tinjau bentrok, rapikan alokasi ruang, lalu pastikan kelas terdekat siap berjalan.';
		if (role === 'LECTURER')
			return 'Pastikan kelas berikutnya aman dan ruang pengganti masih tersedia.';
		return 'Pastikan jadwal pribadi tetap jelas dan perubahan ruang mudah ditemukan.';
	}

	function dashboardFocusLabel(role: AppRole | undefined) {
		if (role === 'ADMIN')
			return 'Fokus pada bentrok aktif dan ruang yang pemakaiannya masih rendah.';
		if (role === 'LECTURER')
			return 'Fokus pada ruang kosong dan kelas yang berlangsung paling dekat.';
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
		{ id: 'participant', label: 'Peserta', hint: 'Pilih mahasiswa dan mata kuliah.' },
		{ id: 'time', label: 'Waktu', hint: 'Tentukan hari dan jam kuliah.' },
		{ id: 'room', label: 'Ruang', hint: 'Pilih ruang yang tersedia.' },
		{ id: 'review', label: 'Tinjau', hint: 'Periksa sebelum disimpan.' }
	] as const;

	function shellLead(role: AppRole | undefined) {
		if (role === 'ADMIN') {
			return 'Pantau bentrok, atur ruang, lalu rapikan data akademik dari satu tempat.';
		}

		if (role === 'LECTURER') {
			return 'Buka jadwal, pilih ruang pengganti, dan cek data kuliah tanpa berpindah terlalu jauh.';
		}

		return 'Lihat jadwal, KRS, dan nilai dari panel yang ringkas untuk mahasiswa.';
	}

	function headerAction(view: ViewId, role: AppRole | undefined) {
		if (role === 'STUDENT') {
			if (view === 'dashboard') return { label: 'Buka kalender', target: 'calendar' as ViewId };
			return null;
		}

		if (view === 'builder') return { label: 'Lihat kalender', target: 'calendar' as ViewId };
		if (view === 'calendar') return { label: 'Buka penjadwalan', target: 'builder' as ViewId };
		if (view === 'dashboard') return { label: 'Atur jadwal', target: 'builder' as ViewId };
		return { label: 'Kembali ke pantauan', target: 'dashboard' as ViewId };
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

	function roundUpHour(minutes: number) {
		return Math.ceil(minutes / 60) * 60;
	}

	function timeString(minutes: number) {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
	}

	function dayKeyFromDate(date: Date): (typeof DAY_ORDER)[number] | null {
		const map = {
			1: 'SENIN',
			2: 'SELASA',
			3: 'RABU',
			4: 'KAMIS',
			5: 'JUMAT',
			6: 'SABTU'
		} as const;

		return map[date.getDay() as keyof typeof map] ?? null;
	}

	function dateForScheduleCard(card: ScheduleCard, minutes: number) {
		const date = new Date(CALENDAR_WEEK_START);
		date.setDate(CALENDAR_WEEK_START.getDate() + DAY_ORDER.indexOf(card.day));
		date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
		return date;
	}

	function escapeHtml(value: string) {
		return value
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#39;');
	}

	let EventCalendarComponent = $state<any>(null);
	let calendarPlugins = $state<any[]>([]);
	let calendarLoadPromise = $state<Promise<void> | null>(null);
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
	let pendingRefreshTimer = $state<number | null>(null);
	let studentPickerSearch = $state('');
	let coursePickerSearch = $state('');
	let studentPickerOpen = $state(false);
	let coursePickerOpen = $state(false);

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

	async function ensureCalendarLoaded() {
		if (EventCalendarComponent) return;
		if (calendarLoadPromise) {
			await calendarLoadPromise;
			return;
		}

		calendarLoadPromise = (async () => {
			const mod = await import('@event-calendar/core');
			await import('@event-calendar/core/index.css');
			EventCalendarComponent = mod.Calendar;
			calendarPlugins = [mod.TimeGrid];
		})();

		try {
			await calendarLoadPromise;
		} finally {
			calendarLoadPromise = null;
		}
	}

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
		classrooms = await getClassRooms().run();
	}

	async function refreshCourses(imperative = false) {
		courses = await getCourses().run();
	}

	async function refreshStudents(imperative = false) {
		students = await getStudents().run();
	}

	async function refreshLecturers(imperative = false) {
		lecturers = await getLecturers().run();
	}

	async function refreshFaculties(imperative = false) {
		faculties = await getFaculties().run();
	}

	async function refreshStudyPrograms(imperative = false) {
		studyPrograms = await getStudyPrograms().run();
	}

	async function refreshEnrollments(imperative = false) {
		enrollments = await getEnrollments().run();
	}

	async function refreshGrades(imperative = false) {
		grades = await getGrades().run();
	}

	async function refreshUsers(imperative = false) {
		users = await getUsers().run();
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

	function scheduleRefreshAll() {
		if (!browser) {
			void refreshAll();
			return;
		}
		if (pendingRefreshTimer != null) {
			window.clearTimeout(pendingRefreshTimer);
		}
		pendingRefreshTimer = window.setTimeout(() => {
			pendingRefreshTimer = null;
			void refreshAll();
		}, 0);
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
		if (!browser || activeView !== 'calendar') return;
		void ensureCalendarLoaded();
	});

	$effect(() => {
		const userId = currentUser.current?.id ?? null;
		if (!userId) {
			if (browser && pendingRefreshTimer != null) {
				window.clearTimeout(pendingRefreshTimer);
				pendingRefreshTimer = null;
			}
			loadedForUserId = null;
			resetCollections();
			return;
		}
		if (loadedForUserId === userId) return;
		loadedForUserId = userId;
		scheduleRefreshAll();
	});

	const scheduleCards = $derived(buildScheduleCards(enrollments, timezone));
	const calendarVisibleRange = $derived.by(() => {
		if (!scheduleCards.length) {
			return { start: DEFAULT_DAY_START, end: DEFAULT_DAY_END };
		}

		const start = DEFAULT_DAY_START;
		let end = roundUpHour(
			Math.min(
				Math.max(...scheduleCards.map((card) => card.endMinutes)) + RANGE_PADDING_MINUTES,
				24 * 60
			)
		);

		if (end - start < MIN_VISIBLE_MINUTES) {
			end = Math.min(start + MIN_VISIBLE_MINUTES, 24 * 60);
		}

		return { start, end };
	});
	const calendarSessionCountByDay = $derived.by(() =>
		Object.fromEntries(
			DAY_ORDER.map((day) => [day, scheduleCards.filter((card) => card.day === day).length])
		)
	);
	const calendarEvents = $derived.by(() =>
		scheduleCards.map((card) => ({
			id: card.id,
			title: card.course,
			start: dateForScheduleCard(card, card.startMinutes),
			end: dateForScheduleCard(card, card.endMinutes),
			extendedProps: { card }
		}))
	);
	const effectiveSelectedScheduleId = $derived(selectedScheduleId ?? scheduleCards[0]?.id ?? null);
	const calendarOptions = $derived.by(() => ({
		view: 'timeGridWeek',
		date: CALENDAR_WEEK_START,
		locale: 'id-ID',
		firstDay: 1,
		hiddenDays: [0],
		height: 'auto',
		allDaySlot: false,
		customScrollbars: true,
		slotDuration: '00:30:00',
		slotLabelInterval: '01:00:00',
		slotHeight: 34,
		slotMinTime: timeString(calendarVisibleRange.start),
		slotMaxTime: timeString(calendarVisibleRange.end),
		scrollTime: timeString(calendarVisibleRange.start),
		slotEventOverlap: false,
		columnWidth: '18rem',
		headerToolbar: { start: '', center: '', end: '' },
		events: calendarEvents,
		dayHeaderFormat(date: Date) {
			const day = dayKeyFromDate(date);
			if (!day) return '';
			return {
				html: `<div class="watum-day-head"><strong>${escapeHtml(DAY_LABELS[day])}</strong><span>${calendarSessionCountByDay[day]} sesi</span></div>`
			};
		},
		eventClassNames(info: { event: { id: string; extendedProps: { card?: ScheduleCard } } }) {
			const card = info.event.extendedProps.card;
			const classes = ['watum-ec-event'];
			if (card?.hasConflict) classes.push('is-conflict');
			if (info.event.id === effectiveSelectedScheduleId) classes.push('is-selected');
			return classes;
		},
		eventContent(info: { event: { extendedProps: { card?: ScheduleCard } } }) {
			const card = info.event.extendedProps.card;
			if (!card) return undefined;

			return {
				html: `
					<div class="watum-event-copy">
						${card.hasConflict ? '<span class="watum-event-flag">Bentrok</span>' : ''}
						<strong>${escapeHtml(card.course)}</strong>
						<span>${escapeHtml(card.startLabel)} - ${escapeHtml(card.endLabel)}</span>
						<small>${escapeHtml(card.room)} • ${escapeHtml(card.lecturer)}</small>
					</div>
				`
			};
		},
		eventDidMount(info: { el: HTMLElement; event: { extendedProps: { card?: ScheduleCard } } }) {
			const card = info.event.extendedProps.card;
			if (!card) return;

			const positionMatch = info.el
				.getAttribute('style')
				?.match(
					/inset-inline-start:\s*calc\(\(100% - var\(--ec-event-col-gap\)\) \/ (\d+) \* (\d+)\)/
				);
			const laneIndex = positionMatch ? Number(positionMatch[2]) + 1 : 1;
			info.el.dataset.lane = String(laneIndex);

			const tone = conflictToneVariables(card.conflictTone);
			if (tone) {
				info.el.style.cssText += `;${tone}`;
			}

			info.el.setAttribute(
				'title',
				`${card.course} • ${card.startLabel} - ${card.endLabel} • ${card.room} • ${card.lecturer}`
			);
		},
		eventClick(info: { event: { extendedProps: { card?: ScheduleCard } } }) {
			const card = info.event.extendedProps.card;
			if (card) selectedScheduleId = card.id;
		}
	}));
	const selectedSchedule = $derived(
		scheduleCards.find((item) => item.id === effectiveSelectedScheduleId) ?? null
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
	const conflictCount = $derived(conflictCards.length);
	const additionalConflictCount = $derived(Math.max(conflictCount - 1, 0));
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
	const filteredStudentsForPicker = $derived(
		students
			.filter(
				(item) =>
					!studentPickerSearch ||
					matchesText(item.name, studentPickerSearch) ||
					matchesText(item.id, studentPickerSearch)
			)
			.slice(0, 24)
	);
	const filteredCoursesForPicker = $derived(
		courses
			.filter(
				(item) =>
					!coursePickerSearch ||
					matchesText(item.name, coursePickerSearch) ||
					matchesText(item.id, coursePickerSearch) ||
					matchesText(item.lecturer_name, coursePickerSearch)
			)
			.slice(0, 24)
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
		const pickedStudent = students.find((s) => s.id === item.student_id);
		const pickedCourse = courses.find((c) => c.id === item.course_id);
		studentPickerSearch = pickedStudent ? `${pickedStudent.name} • ${pickedStudent.id}` : '';
		coursePickerSearch = pickedCourse ? `${pickedCourse.name} • ${pickedCourse.lecturer_name}` : '';
		studentPickerOpen = false;
		coursePickerOpen = false;
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
			studentPickerSearch = '';
			coursePickerSearch = '';
			studentPickerOpen = false;
			coursePickerOpen = false;
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
					'Ruang ini akan dihapus dari inventaris. Pastikan tidak ada jadwal aktif yang masih bergantung pada ruang ini.',
				confirmLabel: 'Ya, hapus ruang',
				successMessage: 'Ruang dihapus dari inventaris.',
				failureMessage: 'Ruang belum bisa dihapus. Periksa apakah ruang masih dipakai.'
			};
			return;
		}
		if (kind === 'course') {
			pendingDelete = {
				kind,
				id,
				label: selectedCourse?.name ?? 'mata kuliah ini',
				message:
					'Mata kuliah ini akan dihapus dari katalog. Pastikan perubahan ini tidak mengganggu jadwal atau KRS yang masih aktif.',
				confirmLabel: 'Ya, hapus mata kuliah',
				successMessage: 'Mata kuliah dihapus dari katalog.',
				failureMessage: 'Mata kuliah belum bisa dihapus. Periksa jadwal dan KRS yang masih terkait.'
			};
			return;
		}
		if (kind === 'student') {
			pendingDelete = {
				kind,
				id,
				label: selectedStudent?.name ?? 'mahasiswa ini',
				message:
					'Data mahasiswa ini akan dihapus dari data aktif. Pastikan identitas ini tidak lagi dipakai dalam proses akademik berjalan.',
				confirmLabel: 'Ya, hapus mahasiswa',
				successMessage: 'Mahasiswa dihapus dari data aktif.',
				failureMessage: 'Mahasiswa belum bisa dihapus. Periksa data yang masih terkait.'
			};
			return;
		}
		if (kind === 'lecturer') {
			pendingDelete = {
				kind,
				id,
				label: selectedLecturer?.name ?? 'dosen ini',
				message:
					'Dosen ini akan dihapus dari daftar pengampu. Pastikan jadwal, mata kuliah, dan akun terkait sudah diperiksa.',
				confirmLabel: 'Ya, hapus dosen',
				successMessage: 'Dosen dihapus dari daftar pengampu.',
				failureMessage: 'Dosen belum bisa dihapus. Periksa jadwal atau akun yang masih terhubung.'
			};
			return;
		}
		if (kind === 'faculty') {
			pendingDelete = {
				kind,
				id,
				label: selectedFaculty?.name ?? 'fakultas ini',
				message:
					'Fakultas ini akan dihapus dari struktur akademik. Pastikan tidak ada program studi aktif yang masih bergantung padanya.',
				confirmLabel: 'Ya, hapus fakultas',
				successMessage: 'Fakultas dihapus dari struktur akademik.',
				failureMessage: 'Fakultas belum bisa dihapus. Periksa program studi yang masih terkait.'
			};
			return;
		}
		if (kind === 'studyProgram') {
			pendingDelete = {
				kind,
				id,
				label: selectedStudyProgram?.name ?? 'program studi ini',
				message:
					'Program studi ini akan dihapus dari struktur akademik. Pastikan mahasiswa dan mata kuliah terkait sudah ditinjau.',
				confirmLabel: 'Ya, hapus program studi',
				successMessage: 'Program studi dihapus dari struktur akademik.',
				failureMessage: 'Program studi belum bisa dihapus. Periksa data yang masih terhubung.'
			};
			return;
		}
		if (kind === 'enrollment') {
			pendingDelete = {
				kind,
				id,
				label: selectedEnrollment?.course_name ?? 'jadwal ini',
				message:
					'KRS dan jadwal ini akan dihapus dari periode aktif. Lanjutkan hanya jika perubahan ini sudah final.',
				confirmLabel: 'Ya, hapus jadwal',
				successMessage: 'Jadwal dihapus dari periode aktif.',
				failureMessage: 'Jadwal belum bisa dihapus. Periksa data KRS yang masih dipakai.'
			};
			return;
		}
		pendingDelete = {
			kind,
			id,
			label: selectedGrade?.course_name ?? 'nilai ini',
			message:
				'Nilai ini akan dihapus dari rekap hasil. Jika masih diperlukan, Anda perlu memasukkannya lagi setelah penghapusan.',
			confirmLabel: 'Ya, hapus nilai',
			successMessage: 'Nilai dihapus dari rekap hasil.',
			failureMessage: 'Nilai belum bisa dihapus. Periksa apakah data masih dipakai di rekap.'
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
	const activeNavigationGroup = $derived(
		navigationGroups.find((group) => group.views.includes(activeView)) ?? null
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
	<div class="app-shell">
		<aside class="rail">
			<div class="rail-brand">
				<h1>Watum</h1>
			</div>

			<nav class="rail-sections" aria-label="Navigasi utama">
				{#each navigationGroups as group (group.id)}
					{@const GroupIcon = group.icon}
					<section class="rail-group">
						<div class="rail-group-header">
							<div class="rail-group-title">
								<GroupIcon size={16} />
								<strong>{group.label}</strong>
							</div>
						</div>
						<div class="rail-links">
							{#each group.views as item (item)}
								{@const ItemIcon = viewCatalog[item].icon}
								<Button
									class={`nav-item ${activeView === item ? 'selected' : ''}`}
									variant={activeView === item ? 'default' : 'ghost'}
									size="sm"
									onclick={() => activateView(item)}
								>
									<ItemIcon size={17} />
									<span class="nav-link-copy">
										<strong>{viewCatalog[item].label}</strong>
									</span>
								</Button>
							{/each}
						</div>
					</section>
				{/each}
			</nav>

			<Separator />
		</aside>

		<main class="main-shell">
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

			{#if feedback}
				<div class={`feedback ${feedback.tone}`}>
					<AlertCircle size={16} />
					<span>{feedback.text}</span>
					<button
						type="button"
						class="feedback-dismiss"
						aria-label="Tutup notifikasi"
						onclick={() => (feedback = null)}>×</button
					>
				</div>
			{/if}

			{#if appLoading}
				<div class="loading-panel">
					<div class="skeleton-rows">
						<div class="skeleton skeleton-title"></div>
						<div class="skeleton skeleton-text"></div>
						{#each Array(5) as _, i (i)}
							<div class="skeleton skeleton-row"></div>
						{/each}
					</div>
				</div>
			{/if}

			{#if activeViewIssues.length}
				<section class="support-warning">
					<div class="support-warning-head">
						<p class="warning-title">Sebagian data pendukung belum tersedia</p>
						<Button variant="ghost" size="sm" class="ghost-button" onclick={() => void refreshAll()}
							>Coba lagi</Button
						>
					</div>
					<ul class="support-warning-list">
						{#each activeViewIssues as issue, index (`${activeView}-${index}`)}
							<li>{issue}</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if activeView === 'dashboard'}
				<div class="dashboard-stack">
					{#if currentUser.current.role === 'STUDENT'}
						<section class="student-dashboard">
							<article class="student-hero">
								<div class="student-hero-copy">
									<span>Kelas berikutnya</span>
									<strong>{nextSchedule ? nextSchedule.course : 'Belum ada kelas terjadwal'}</strong
									>
									<p>
										{#if nextSchedule}
											{DAY_LABELS[nextSchedule.day]} • {nextSchedule.startLabel} - {nextSchedule.endLabel}
											• {nextSchedule.room}
										{:else}
											Kalender mingguan membantu Anda melihat perubahan ruang dan kelas berikutnya.
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
									<strong>{enrollments.length} kelas tercatat</strong>
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
									<h3>Nilai terbaru</h3>
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
										{conflictCount} bentrok perlu ditangani
									{:else if nextSchedule}
										Jadwal hari ini siap berjalan
									{:else}
										Belum ada kelas aktif yang perlu diatur
									{/if}
								</h3>
								<p class="decision-summary">
									{dashboardPriorityLabel(currentUser.current.role as AppRole)}
								</p>

								{#if primaryConflict}
									<section class="decision-primary">
										<div class="decision-primary-copy">
											<span>Bentrok terdekat</span>
											<strong>{primaryConflict.course}</strong>
											<p>
												{DAY_LABELS[primaryConflict.day]} • {primaryConflict.startLabel} - {primaryConflict.endLabel}
												• {primaryConflict.room}
											</p>
										</div>
										{#if additionalConflictCount > 0}
											<p class="decision-secondary-count">
												+{additionalConflictCount} bentrok lain masih menunggu tindak lanjut
											</p>
										{/if}
									</section>
								{:else if nextSchedule}
									<section class="decision-primary decision-primary-steady">
										<div class="decision-primary-copy">
											<span>Kelas berikutnya</span>
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
										>Buka penjadwalan</Button
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
									<span>Fokus hari ini</span>
									<strong>{dashboardFocusLabel(currentUser.current.role as AppRole)}</strong>
								</div>
								<div class="decision-note-row">
									<span>Ruang belum padat</span>
									<strong>{underusedRooms} ruang masih bisa dioptimalkan</strong>
								</div>
								<div class="decision-note-row">
									<span>Kelas berikutnya</span>
									<strong>{nextSchedule ? nextSchedule.course : 'Belum ada kelas terjadwal'}</strong
									>
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
					<section class="calendar-surface">
						<header class="surface-head">
							<div>
								<p class="surface-kicker">Kalender</p>
								<h2>Kalender kuliah mingguan</h2>
							</div>
						</header>

						<div class="event-calendar-host">
							{#if EventCalendarComponent}
								<EventCalendarComponent plugins={calendarPlugins} options={calendarOptions} />
							{:else}
								<div class="calendar-loading">Memuat kalender...</div>
							{/if}
						</div>
					</section>

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
									Buka di penjadwalan
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
									<h4>Jadwal lain pada slot ini</h4>
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
							<p class="empty-copy">Pilih satu blok jadwal untuk melihat detail kelas.</p>
						{/if}
					</section>
				</div>
			{/if}

			{#if activeView === 'builder'}
				<div class="workspace-shell builder-shell">
					<section class="workspace-list builder-list">
						<div class="pane-head">
							<div>
								<h3>{builderTaskMode ? 'Jadwal terkait' : 'Jadwal aktif'}</h3>
							</div>
							<Button
								variant="ghost"
								size="sm"
								class="ghost-button"
								onclick={() => clearSelection('builder')}>Tambah jadwal</Button
							>
						</div>

						<label class="search-box">
							<Search size={16} />
							<input
								bind:value={enrollmentSearch}
								aria-label="Cari jadwal kuliah"
								placeholder="Cari mahasiswa, mata kuliah, atau ruang"
							/>
						</label>

						<div class="list-summary">
							<span>{filteredEnrollments.length} jadwal ditemukan</span>
						</div>

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
								<h3>{selectedEnrollmentId ? 'Edit jadwal terpilih' : 'Tambah jadwal baru'}</h3>
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
							<div class="builder-progress" aria-label="Tahapan penjadwalan">
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
										<p>{availableRoomOptions.length} ruang tersedia untuk slot ini</p>
									</div>
									<div>
										<span>Ruang</span>
										<strong>{selectedDraftRoom}</strong>
										<p>{conflictCount} bentrok masih tercatat di kalender aktif</p>
									</div>
								</section>

								<section class:hidden-stage={builderStep !== 'participant'} class="builder-section">
									<div class="builder-section-head">
										<h4>Pilih peserta dan mata kuliah</h4>
										<p class="builder-note">
											Pilih mahasiswa dan mata kuliah dulu agar cek waktu dan ruang tetap relevan.
										</p>
									</div>
									<div class="editor-grid">
										<label>
											<span>Mahasiswa</span>
											<input
												type="hidden"
												{...selectedEnrollmentId
													? updateEnrollment.fields.studentId.as('text')
													: createEnrollment.fields.studentId.as('text')}
												bind:value={enrollmentDraft.studentId}
											/>
											<!-- svelte-ignore a11y_no_static_element_interactions -->
											<div
												class="combobox-wrap"
												onfocusout={(e) => {
													if (!e.currentTarget.contains(e.relatedTarget as Node)) {
														studentPickerOpen = false;
													}
												}}
											>
												<input
													type="text"
													class="combobox-input"
													placeholder="Cari mahasiswa..."
													value={enrollmentDraft.studentId
														? `${students.find((s) => s.id === enrollmentDraft.studentId)?.name ?? ''} • ${enrollmentDraft.studentId}`
														: studentPickerSearch}
													oninput={(e) => {
														studentPickerSearch = (e.currentTarget as HTMLInputElement).value;
														if (enrollmentDraft.studentId) enrollmentDraft.studentId = '';
														studentPickerOpen = true;
													}}
													onfocus={() => (studentPickerOpen = true)}
												/>
												{#if collectionIssues.students && !students.length}
													<p class="combobox-error">{collectionIssues.students}</p>
												{:else if studentPickerOpen && filteredStudentsForPicker.length}
													<div class="combobox-dropdown" role="listbox">
														{#each filteredStudentsForPicker as item (item.id)}
															<button
																type="button"
																role="option"
																aria-selected={enrollmentDraft.studentId === item.id}
																class="combobox-option"
																class:active={enrollmentDraft.studentId === item.id}
																onmousedown={(e) => {
																	e.preventDefault();
																	enrollmentDraft.studentId = item.id;
																	studentPickerSearch = '';
																	studentPickerOpen = false;
																}}
															>
																<strong>{item.name}</strong>
																<span>{item.id}</span>
															</button>
														{/each}
													</div>
												{/if}
											</div>
										</label>

										<label>
											<span>Mata kuliah</span>
											<input
												type="hidden"
												{...selectedEnrollmentId
													? updateEnrollment.fields.courseId.as('text')
													: createEnrollment.fields.courseId.as('text')}
												bind:value={enrollmentDraft.courseId}
											/>
											<!-- svelte-ignore a11y_no_static_element_interactions -->
											<div
												class="combobox-wrap"
												onfocusout={(e) => {
													if (!e.currentTarget.contains(e.relatedTarget as Node)) {
														coursePickerOpen = false;
													}
												}}
											>
												<input
													type="text"
													class="combobox-input"
													placeholder="Cari mata kuliah..."
													value={enrollmentDraft.courseId
														? `${courses.find((c) => c.id === enrollmentDraft.courseId)?.name ?? ''} • ${courses.find((c) => c.id === enrollmentDraft.courseId)?.lecturer_name ?? ''}`
														: coursePickerSearch}
													oninput={(e) => {
														coursePickerSearch = (e.currentTarget as HTMLInputElement).value;
														if (enrollmentDraft.courseId) enrollmentDraft.courseId = '';
														coursePickerOpen = true;
													}}
													onfocus={() => (coursePickerOpen = true)}
												/>
												{#if collectionIssues.courses && !courses.length}
													<p class="combobox-error">{collectionIssues.courses}</p>
												{:else if coursePickerOpen && filteredCoursesForPicker.length}
													<div class="combobox-dropdown" role="listbox">
														{#each filteredCoursesForPicker as item (item.id)}
															<button
																type="button"
																role="option"
																aria-selected={enrollmentDraft.courseId === item.id}
																class="combobox-option"
																class:active={enrollmentDraft.courseId === item.id}
																onmousedown={(e) => {
																	e.preventDefault();
																	enrollmentDraft.courseId = item.id;
																	coursePickerSearch = '';
																	coursePickerOpen = false;
																}}
															>
																<strong>{item.name}</strong>
																<span>{item.id} • {item.lecturer_name}</span>
															</button>
														{/each}
													</div>
												{/if}
											</div>
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
											onclick={advanceBuilderStep}>Lanjut ke jadwal</Button
										>
									</div>
								</section>

								<section class:hidden-stage={builderStep !== 'time'} class="builder-section">
									<div class="builder-section-head">
										<h4>Tentukan hari dan jam</h4>
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
											Jika jam berubah, periksa lagi pilihan ruang di langkah berikutnya.
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
										<h4>Pilih ruang yang tersedia</h4>
										<p class="builder-note">
											Pilih satu ruang yang tersedia untuk slot ini, lalu lanjut ke langkah tinjau.
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
											<h4>{availableRoomOptions.length} ruang tersedia untuk slot ini</h4>
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
														Belum ada ruang yang tersedia untuk slot ini. Ubah jadwal atau pilih
														slot lain.
													</p>
												{/if}
											</div>
										</section>
									</div>
									<div class="builder-section-actions split">
										<p class="editor-note">
											Jika daftar ruang kosong, ubah jadwal lebih dulu sebelum melanjutkan.
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
										<h4>Tinjau sebelum disimpan</h4>
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
											Jika masih ragu, kembali satu langkah lalu perbaiki waktu atau ruang sebelum
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
												>{selectedEnrollmentId ? 'Simpan perubahan' : 'Simpan jadwal'}</Button
											>
										</div>
									</div>
								</section>
							</form>
						{:else}
							<p class="empty-copy">Mahasiswa hanya dapat melihat jadwal dan KRS.</p>
						{/if}
					</section>
				</div>
			{/if}

			{#if activeView === 'classrooms'}
				<div class="workspace-shell">
					<section class="workspace-list">
						<div class="pane-head">
							<div>
								<h3>Daftar ruang</h3>
							</div>
							<Button
								variant="ghost"
								size="sm"
								class="ghost-button"
								onclick={() => beginCreate('classrooms')}>Tambah</Button
							>
						</div>
						<label class="search-box"
							><Search size={16} /><input
								bind:value={roomSearch}
								aria-label="Cari ruang"
								placeholder="Cari nama ruang atau jenis ruang"
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
								<h3>{selectedRoom ? selectedRoom.name : 'Tambah ruang'}</h3>
							</div>
							{#if currentUser.current.role === 'ADMIN'}
								<div class="detail-actions">
									{#if editorView === 'classrooms'}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => stopEditing('classrooms')}>Tutup form</Button
										>
									{:else if selectedRoom}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => beginEdit('classrooms')}>Edit</Button
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
									Tinjau ringkasan ruang lebih dulu. Buka form edit hanya saat data perlu diubah.
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
								Pilih satu ruang untuk melihat detail, atau tambahkan ruang baru saat inventaris
								berubah.
							</p>{/if}
					</section>
				</div>
			{/if}

			{#if activeView === 'courses'}
				<div class="workspace-shell">
					<section class="workspace-list">
						<div class="pane-head">
							<div>
								<h3>Daftar mata kuliah</h3>
							</div>
							<Button
								variant="ghost"
								size="sm"
								class="ghost-button"
								onclick={() => beginCreate('courses')}>Tambah</Button
							>
						</div>
						<label class="search-box"
							><Search size={16} /><input
								bind:value={courseSearch}
								aria-label="Cari data mata kuliah"
								placeholder="Cari kode, nama, atau dosen pengampu"
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
								<h3>{selectedCourse ? selectedCourse.name : 'Tambah mata kuliah'}</h3>
							</div>
							{#if currentUser.current.role === 'ADMIN'}
								<div class="detail-actions">
									{#if editorView === 'courses'}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => stopEditing('courses')}>Tutup form</Button
										>
									{:else if selectedCourse}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => beginEdit('courses')}>Edit</Button
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
										Kode mata kuliah dibuat otomatis saat data disimpan.
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
										Program studi dan dosen harus tersedia sebelum mata kuliah bisa disimpan.
									</p>{/if}<Button
									type="submit"
									class="primary-button"
									disabled={courseEditorBlocked}
									>{selectedCourseId ? 'Simpan perubahan' : 'Tambah mata kuliah'}</Button
								>
							</form>{:else}<p class="empty-copy">
								Pilih satu mata kuliah untuk melihat detail, atau tambahkan mata kuliah baru saat
								katalog berubah.
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
								onclick={() => beginCreate('students')}>Tambah</Button
							>
						</div>
						<label class="search-box"
							><Search size={16} /><input
								bind:value={studentSearch}
								aria-label="Cari data mahasiswa"
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
								<h3>{selectedStudent ? selectedStudent.name : 'Tambah mahasiswa'}</h3>
							</div>
							{#if currentUser.current.role === 'ADMIN'}
								<div class="detail-actions">
									{#if editorView === 'students'}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => stopEditing('students')}>Tutup form</Button
										>
									{:else if selectedStudent}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => beginEdit('students')}>Edit</Button
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
										Program studi harus tersedia sebelum data mahasiswa bisa disimpan.
									</p>{/if}<Button
									type="submit"
									class="primary-button"
									disabled={studentEditorBlocked}
									>{selectedStudentId ? 'Simpan perubahan' : 'Tambah mahasiswa'}</Button
								>
							</form>{:else}<p class="empty-copy">
								Pilih satu mahasiswa untuk melihat profil, atau tambahkan mahasiswa baru saat data
								aktif berubah.
							</p>{/if}
					</section>
				</div>
			{/if}

			{#if activeView === 'lecturers'}
				<div class="workspace-shell">
					<section class="workspace-list">
						<div class="pane-head">
							<div>
								<h3>Daftar dosen</h3>
							</div>
							{#if currentUser.current.role === 'ADMIN'}<Button
									variant="ghost"
									size="sm"
									class="ghost-button"
									onclick={() => beginCreate('lecturers')}>Tambah</Button
								>{/if}
						</div>
						<label class="search-box"
							><Search size={16} /><input
								bind:value={lecturerSearch}
								aria-label="Cari data dosen"
								placeholder="Cari ID dosen, nama, atau email"
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
								<h3>{selectedLecturer ? selectedLecturer.name : 'Tambah dosen'}</h3>
							</div>
							{#if currentUser.current.role === 'ADMIN'}
								<div class="detail-actions">
									{#if editorView === 'lecturers'}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => stopEditing('lecturers')}>Tutup form</Button
										>
									{:else if selectedLecturer}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => beginEdit('lecturers')}>Edit</Button
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
									Mode tinjau membantu Anda membaca konteks dosen sebelum membuka form edit.
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
										ID dosen dibuat otomatis saat data disimpan.
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
								Pilih satu dosen untuk melihat detail, atau tambahkan dosen baru saat data pengampu
								berubah.
							</p>{/if}
					</section>
				</div>
			{/if}

			{#if activeView === 'faculties'}
				<div class="workspace-shell">
					<section class="workspace-list">
						<div class="pane-head">
							<div>
								<h3>Daftar fakultas</h3>
							</div>
							<Button
								variant="ghost"
								size="sm"
								class="ghost-button"
								onclick={() => beginCreate('faculties')}>Tambah</Button
							>
						</div>
						<label class="search-box"
							><Search size={16} /><input
								bind:value={facultySearch}
								aria-label="Cari data fakultas"
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
								<h3>{selectedFaculty ? selectedFaculty.name : 'Tambah fakultas'}</h3>
							</div>
							{#if currentUser.current.role === 'ADMIN'}
								<div class="detail-actions">
									{#if editorView === 'faculties'}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => stopEditing('faculties')}>Tutup form</Button
										>
									{:else if selectedFaculty}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => beginEdit('faculties')}>Edit</Button
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
									Tinjau ringkasan struktur lebih dulu. Buka form edit hanya untuk perubahan yang
									memang diperlukan.
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
										ID fakultas dibuat otomatis saat data disimpan.
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
								Pilih satu fakultas untuk melihat detail, atau tambahkan fakultas baru saat struktur
								berubah.
							</p>{/if}
					</section>
				</div>
			{/if}

			{#if activeView === 'studyPrograms'}
				<div class="workspace-shell">
					<section class="workspace-list">
						<div class="pane-head">
							<div>
								<h3>Daftar program studi</h3>
							</div>
							<Button
								variant="ghost"
								size="sm"
								class="ghost-button"
								onclick={() => beginCreate('studyPrograms')}>Tambah</Button
							>
						</div>
						<label class="search-box"
							><Search size={16} /><input
								bind:value={studyProgramSearch}
								aria-label="Cari data program studi"
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
									{selectedStudyProgram ? selectedStudyProgram.name : 'Tambah program studi'}
								</h3>
							</div>
							{#if currentUser.current.role === 'ADMIN'}
								<div class="detail-actions">
									{#if editorView === 'studyPrograms'}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => stopEditing('studyPrograms')}>Tutup form</Button
										>
									{:else if selectedStudyProgram}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => beginEdit('studyPrograms')}>Edit</Button
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
										ID program studi dibuat otomatis saat data disimpan.
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
										Fakultas harus tersedia sebelum program studi bisa disimpan.
									</p>{/if}<Button
									type="submit"
									class="primary-button"
									disabled={studyProgramEditorBlocked}
									>{selectedStudyProgramId ? 'Simpan perubahan' : 'Tambah program studi'}</Button
								>
							</form>{:else}<p class="empty-copy">
								Pilih satu program studi untuk melihat detail, atau tambahkan program studi baru
								saat struktur akademik berubah.
							</p>{/if}
					</section>
				</div>
			{/if}

			{#if activeView === 'enrollments'}
				<div class="workspace-shell">
					<section class="workspace-list">
						<div class="pane-head">
							<div>
								<h3>KRS aktif</h3>
							</div>
						</div>
						<label class="search-box"
							><Search size={16} /><input
								bind:value={enrollmentSearch}
								aria-label="Cari KRS aktif"
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
							</div>{:else}<p class="empty-copy">Pilih satu baris untuk melihat detail KRS.</p>{/if}
					</section>
				</div>
			{/if}

			{#if activeView === 'grades'}
				<div class="workspace-shell">
					<section class="workspace-list">
						<div class="pane-head">
							<div>
								<h3>Daftar nilai</h3>
							</div>
							{#if currentUser.current.role !== 'STUDENT'}<Button
									variant="ghost"
									size="sm"
									class="ghost-button"
									onclick={() => beginCreate('grades')}>Tambah</Button
								>{/if}
						</div>
						<label class="search-box"
							><Search size={16} /><input
								bind:value={gradeSearch}
								aria-label="Cari data nilai"
								placeholder="Cari mahasiswa, mata kuliah, atau nilai huruf"
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
											onclick={() => stopEditing('grades')}>Tutup form</Button
										>
									{:else if selectedGrade}
										<Button
											variant="ghost"
											size="sm"
											class="ghost-button"
											onclick={() => beginEdit('grades')}>Edit</Button
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
									Mode tinjau memisahkan peninjauan hasil dari proses edit nilai.
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
										Data KRS harus tersedia sebelum nilai bisa disimpan.
									</p>{/if}<Button
									type="submit"
									class="primary-button"
									disabled={gradeEditorBlocked}
									>{selectedGradeId ? 'Simpan perubahan' : 'Simpan nilai'}</Button
								>
							</form>{:else}<p class="empty-copy">
								Pilih satu nilai untuk melihat hasil, atau tambahkan nilai baru saat evaluasi perlu
								dicatat.
							</p>{/if}
					</section>
				</div>
			{/if}

			{#if activeView === 'users' && currentUser.current.role === 'ADMIN'}
				<div class="workspace-shell">
					<section class="workspace-list">
						<div class="pane-head">
							<div>
								<h3>Akun pengguna</h3>
							</div>
						</div>
						<label class="search-box"
							><Search size={16} /><input
								bind:value={userSearch}
								aria-label="Cari akun pengguna"
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
											>{item.student_name ?? item.lecturer_name ?? 'Administrator sistem'}</span
										>
									</div>
									<small>{item.role}</small></button
								>{/each}
						</div>
					</section>
					<section class="workspace-detail">
						<div class="pane-head compact">
							<div>
								<h3>{selectedUser ? selectedUser.email : 'Pilih akun'}</h3>
							</div>
							<div class="detail-actions">
								{#if editorView === 'users'}
									<Button
										variant="ghost"
										size="sm"
										class="ghost-button"
										onclick={() => stopEditing('users')}>Tutup form</Button
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
									<div><span>Peran</span><strong>{selectedUser.role}</strong></div>
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
									Perubahan akun memengaruhi akses login. Tinjau peran dan relasi identitas sebelum
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
										placeholder="Biarkan kosong jika password lama tetap dipakai"
									/></label
								><label
									><span>Peran akses</span><select
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
								Pilih satu akun untuk memperbarui email, peran, atau relasi identitas.
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
					Masuk ke Watum
				</Card.Title>
				<Card.Description class="login-description">
					Pantau jadwal, ruang, dan perubahan data akademik dari satu panel kerja yang ringkas.
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
		grid-template-columns: 15.75rem minmax(0, 1fr);
		min-height: 100vh;
	}

	.rail {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		gap: 1.15rem;
		padding: 1.15rem 1rem;
		border-right: 1px solid var(--color-border);
		background: color-mix(in oklch, var(--color-panel) 82%, var(--color-surface) 18%);
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
		gap: 0.35rem;
	}

	.rail-brand h1 {
		font-size: 1.28rem;
		line-height: 1.04;
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
	.empty-copy,
	.workspace-copy,
	.list-summary p,
	.workspace-summary p {
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
		gap: 0.95rem;
		width: 100%;
		min-width: 0;
		overflow: auto;
		align-content: start;
	}

	.rail-group {
		display: grid;
		gap: 0.55rem;
	}

	.rail-group-title {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	.rail-group-title strong {
		display: block;
		font-size: 0.83rem;
		line-height: 1.3;
	}

	.rail-links {
		display: grid;
		gap: 0.22rem;
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

	.nav-link-copy {
		display: grid;
		min-width: 0;
		flex: 1 1 auto;
	}

	.nav-link-copy strong {
		display: block;
		font-size: 0.94rem;
		line-height: 1.25;
		overflow-wrap: anywhere;
	}

	:global(.nav-item:hover) {
		background: color-mix(in oklch, var(--color-surface) 82%, var(--color-panel) 18%);
	}

	:global(.nav-item:focus-visible),
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
		gap: 1.25rem;
		padding: 1.45rem 1.5rem;
		align-content: start;
		min-width: 0;
	}

	.topbar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 1rem;
		align-items: end;
		padding-bottom: 0.15rem;
		border-bottom: 1px solid color-mix(in oklch, var(--color-border) 86%, var(--color-surface) 14%);
	}

	.topbar-copy {
		gap: 0.42rem;
		max-width: 52rem;
		min-width: 0;
	}

	.topbar-copy h2 {
		font-size: 1.56rem;
		line-height: 1.04;
	}

	.topbar-tools {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		flex-wrap: wrap;
		justify-content: end;
		min-width: 0;
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
		padding: 0.5rem 0.72rem;
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

	.list-summary,
	.workspace-summary {
		display: grid;
		gap: 0.28rem;
		padding: 0.88rem 0.95rem;
		border: 1px solid color-mix(in oklch, var(--color-border) 88%, var(--color-surface) 12%);
		border-radius: 0.8rem;
		background: color-mix(in oklch, var(--color-surface) 82%, var(--color-panel) 18%);
	}

	.list-summary span,
	.workspace-summary span {
		font-size: 0.79rem;
		font-weight: 700;
		letter-spacing: 0.01em;
		color: var(--color-foreground-soft);
	}

	.workspace-summary-strong {
		border-color: color-mix(in oklch, var(--color-accent-strong) 18%, var(--color-border) 82%);
		background: color-mix(in oklch, var(--color-surface) 78%, var(--color-accent-soft) 22%);
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

	.calendar-layout {
		min-width: 0;
	}

	.calendar-layout > * {
		min-width: 0;
	}

	.calendar-surface {
		display: grid;
		gap: 1rem;
		min-width: 0;
	}

	.surface-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: end;
	}

	.surface-head h2 {
		font: 600 1.3rem/1.1 var(--font-display);
		letter-spacing: -0.03em;
	}

	.surface-head p {
		max-width: 48ch;
		color: var(--color-muted-foreground);
	}

	.surface-kicker {
		margin-bottom: 0.45rem;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: color-mix(in oklch, var(--color-accent-strong) 72%, var(--color-foreground) 28%);
	}

	.event-calendar-host {
		min-width: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-panel);
		overflow: hidden;
	}

	.calendar-loading {
		padding: 1.2rem;
		color: var(--color-muted-foreground);
	}

	:global(.event-calendar-host .ec) {
		--ec-border-color: color-mix(in oklch, var(--color-border) 74%, var(--color-foreground) 26%);
		--ec-day-bg-color: var(--color-panel);
		--ec-bg-color: var(--color-panel);
		--ec-body-bg-color: color-mix(in oklch, var(--color-panel) 95%, var(--color-surface) 5%);
		--watum-grid-minor: rgba(56, 64, 81, 0.22);
		--watum-grid-major: rgba(37, 45, 61, 0.34);
		--ec-button-bg-color: var(--color-panel);
		--ec-button-border-color: var(--color-border);
		--ec-button-text-color: var(--color-foreground);
		--ec-button-active-bg-color: var(--color-accent-strong);
		--ec-button-active-border-color: var(--color-accent-strong);
		--ec-button-active-text-color: var(--color-accent-contrast);
		--ec-event-bg-color: var(--color-surface);
		--ec-event-border-color: color-mix(in oklch, var(--color-border) 88%, var(--color-surface) 12%);
		--ec-event-text-color: var(--color-foreground);
		--ec-now-indicator-color: var(--color-accent-strong);
		--ec-scrollbar-thumb-color: var(--color-border);
		--ec-scrollbar-track-color: transparent;
		color: var(--color-foreground);
		font-family: var(--font-sans);
	}

	:global(.dark .event-calendar-host .ec) {
		--ec-body-bg-color: color-mix(in oklch, var(--color-panel) 92%, var(--color-surface) 8%);
		--ec-border-color: color-mix(in oklch, var(--color-border) 62%, var(--color-foreground) 38%);
		--watum-grid-minor: rgba(197, 205, 218, 0.32);
		--watum-grid-major: rgba(214, 221, 233, 0.46);
	}

	:global(.event-calendar-host .ec-toolbar) {
		display: none;
	}

	:global(.event-calendar-host .ec-header) {
		border-bottom: 1px solid var(--color-border);
	}

	:global(.event-calendar-host .ec-day-head) {
		padding: 0.95rem 1rem;
		background: color-mix(in oklch, var(--color-panel) 82%, var(--color-surface) 18%);
	}

	:global(.event-calendar-host .watum-day-head) {
		display: grid;
		gap: 0.22rem;
		text-align: left;
	}

	:global(.event-calendar-host .watum-day-head strong) {
		font-size: 0.92rem;
	}

	:global(.event-calendar-host .watum-day-head span) {
		color: var(--color-muted-foreground);
		font-size: 0.84rem;
	}

	:global(.event-calendar-host .ec-time) {
		font-size: 0.82rem;
		color: var(--color-muted-foreground);
	}

	:global(.event-calendar-host .ec-time-grid .ec-header .ec-sidebar),
	:global(.event-calendar-host .ec-time-grid .ec-body .ec-sidebar) {
		inline-size: 3.9rem;
		width: 3.9rem;
		flex: 0 0 3.9rem;
	}

	:global(.event-calendar-host .ec-time-grid .ec-body .ec-sidebar .ec-slot) {
		position: relative;
	}

	:global(.event-calendar-host .ec-time-grid .ec-body .ec-sidebar .ec-slot time) {
		position: absolute;
		top: 0;
		right: 0.1rem;
		transform: translateY(-50%);
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		padding-inline: 0.12rem 0.04rem;
		font-size: 0.78rem;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		background: var(--ec-bg-color);
		color: var(--color-foreground-soft);
		z-index: 2;
	}

	:global(.event-calendar-host .ec-scrollgrid) {
		border: 0;
	}

	:global(.event-calendar-host .ec-time-grid .ec-header .ec-day-head),
	:global(.event-calendar-host .ec-time-grid .ec-body .ec-day) {
		position: relative;
	}

	:global(.event-calendar-host .ec-time-grid .ec-header .ec-day-head::after),
	:global(.event-calendar-host .ec-time-grid .ec-body .ec-day::after) {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		width: 1px;
		pointer-events: none;
		background: var(--watum-grid-major);
	}

	:global(.event-calendar-host .ec-time-grid .ec-body .ec-day::before) {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background-image:
			repeating-linear-gradient(
				to top,
				var(--watum-grid-minor) 0 1px,
				transparent 1px,
				transparent var(--ec-slot-height)
			),
			repeating-linear-gradient(
				to top,
				var(--watum-grid-major) 0 2px,
				transparent 2px,
				transparent calc(var(--ec-slot-height) * var(--ec-slot-label-periodicity))
			);
		background-size:
			100% var(--ec-slot-height),
			100% calc(var(--ec-slot-height) * var(--ec-slot-label-periodicity));
		background-repeat: repeat;
	}

	:global(.event-calendar-host .ec-time-grid .ec-body .ec-sidebar) {
		position: relative;
	}

	:global(.event-calendar-host .ec-time-grid .ec-body .ec-sidebar::before) {
		content: '';
		position: absolute;
		inset: 0;
		pointer-events: none;
		background-image:
			repeating-linear-gradient(
				to top,
				var(--watum-grid-minor) 0 1px,
				transparent 1px,
				transparent var(--ec-slot-height)
			),
			repeating-linear-gradient(
				to top,
				var(--watum-grid-major) 0 2px,
				transparent 2px,
				transparent calc(var(--ec-slot-height) * var(--ec-slot-label-periodicity))
			);
		background-size:
			100% var(--ec-slot-height),
			100% calc(var(--ec-slot-height) * var(--ec-slot-label-periodicity));
		background-repeat: repeat;
	}

	:global(.event-calendar-host .ec-time-grid .ec-body .ec-slot) {
		box-shadow: inset 0 -1px 0 var(--watum-grid-minor);
	}

	:global(.event-calendar-host .ec-time-grid .ec-body .ec-slot:not(.ec-hidden):nth-child(odd)) {
		box-shadow: inset 0 -2px 0 var(--watum-grid-major);
	}

	:global(.event-calendar-host .ec-time-grid .ec-events) {
		padding-inline: 0.45rem;
	}

	:global(.event-calendar-host .watum-ec-event) {
		position: relative;
		overflow: hidden;
		isolation: isolate;
		border-radius: 0.95rem;
		border: 1px solid color-mix(in oklch, var(--color-border) 88%, var(--color-surface) 12%);
		background: var(--watum-event-surface, var(--color-surface));
		box-shadow:
			0 6px 16px color-mix(in oklch, var(--color-shadow) 8%, transparent 92%),
			inset 0 0 0 1px color-mix(in oklch, var(--color-foreground) 4%, transparent 96%);
	}

	:global(.event-calendar-host .watum-ec-event::before) {
		content: '';
		position: absolute;
		inset: 0 0 auto;
		height: 0.24rem;
		background: var(
			--watum-lane-accent,
			color-mix(in oklch, var(--color-accent-strong) 78%, var(--color-panel) 22%)
		);
		opacity: 0.95;
	}

	:global(.event-calendar-host .watum-ec-event.is-selected) {
		border-color: var(--color-accent-strong);
		background: color-mix(in oklch, var(--color-surface) 72%, var(--color-accent-soft) 28%);
		box-shadow:
			0 12px 24px color-mix(in oklch, var(--color-accent-strong) 12%, transparent 88%),
			inset 0 0 0 1px color-mix(in oklch, var(--color-accent-strong) 34%, transparent 66%);
	}

	:global(.event-calendar-host .watum-ec-event.is-conflict) {
		border-color: var(--conflict-border, var(--color-danger));
		background: color-mix(
			in oklch,
			var(--conflict-surface, var(--color-danger-soft)) 92%,
			var(--color-panel) 8%
		);
	}

	:global(.event-calendar-host .watum-ec-event.is-conflict.is-selected) {
		border-color: var(--color-accent-strong);
	}

	:global(.event-calendar-host .watum-ec-event[data-lane='1']) {
		--watum-lane-accent: color-mix(
			in oklch,
			var(--color-accent-strong) 82%,
			var(--color-panel) 18%
		);
		--watum-event-surface: color-mix(
			in oklch,
			var(--color-surface) 84%,
			var(--color-accent-soft) 16%
		);
	}

	:global(.event-calendar-host .watum-ec-event[data-lane='2']) {
		--watum-lane-accent: color-mix(in oklch, var(--color-success) 78%, var(--color-panel) 22%);
		--watum-event-surface: color-mix(
			in oklch,
			var(--color-surface) 84%,
			var(--color-success-soft) 16%
		);
	}

	:global(.event-calendar-host .watum-ec-event[data-lane='3']) {
		--watum-lane-accent: oklch(0.68 0.13 62);
		--watum-event-surface: color-mix(in oklch, var(--color-surface) 86%, oklch(0.93 0.03 62) 14%);
	}

	:global(.event-calendar-host .watum-ec-event[data-lane='4']) {
		--watum-lane-accent: oklch(0.66 0.12 220);
		--watum-event-surface: color-mix(in oklch, var(--color-surface) 86%, oklch(0.9 0.028 220) 14%);
	}

	:global(.event-calendar-host .watum-event-copy) {
		display: grid;
		gap: 0.3rem;
		padding: 0.22rem 0.18rem 0.12rem;
		min-width: 0;
	}

	:global(.event-calendar-host .watum-event-copy strong) {
		font-size: 0.88rem;
		line-height: 1.18;
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	:global(.event-calendar-host .watum-event-copy span) {
		font-size: 0.76rem;
		color: var(--color-muted-foreground);
	}

	:global(.event-calendar-host .watum-event-copy small) {
		font-size: 0.75rem;
		line-height: 1.25;
		color: var(--color-foreground-soft);
	}

	:global(.event-calendar-host .watum-ec-event.is-conflict .watum-event-copy strong) {
		color: var(--conflict-ink, var(--color-danger));
	}

	:global(.event-calendar-host .watum-ec-event.is-conflict .watum-event-copy span),
	:global(.event-calendar-host .watum-ec-event.is-conflict .watum-event-copy small) {
		color: color-mix(
			in oklch,
			var(--conflict-ink, var(--color-danger)) 74%,
			var(--color-foreground) 26%
		);
	}

	:global(.event-calendar-host .watum-event-flag) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: fit-content;
		padding: 0.18rem 0.45rem;
		border-radius: 0.5rem;
		border: 1px solid
			color-mix(in oklch, var(--conflict-border, var(--color-danger)) 72%, transparent 28%);
		background: color-mix(
			in oklch,
			var(--conflict-surface, var(--color-danger-soft)) 82%,
			var(--color-panel) 18%
		);
		color: var(--conflict-ink, var(--color-danger));
		font-size: 0.72rem;
		font-weight: 700;
		line-height: 1;
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
		grid-template-columns: minmax(18rem, 0.78fr) minmax(0, 1.22fr);
		align-items: stretch;
	}

	.builder-shell {
		grid-template-columns: minmax(18rem, 0.72fr) minmax(0, 1.28fr);
		height: auto;
		min-height: 0;
		align-items: stretch;
	}

	.workspace-list,
	.workspace-detail {
		display: grid;
		gap: 0.9rem;
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
		grid-template-rows: auto auto auto minmax(0, 1fr);
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
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.65rem;
	}

	.builder-progress-item {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: start;
		gap: 0.7rem;
		padding: 0.85rem 0.9rem;
		border: 1px solid var(--color-border);
		border-radius: 0.8rem;
		background: var(--color-panel);
		text-align: left;
		color: inherit;
		width: 100%;
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
		gap: 0.18rem;
		min-width: 0;
	}

	.builder-progress-copy strong {
		font-size: 0.93rem;
		line-height: 1.25;
	}

	.builder-progress-copy span {
		font-size: 0.82rem;
		line-height: 1.36;
	}

	.builder-form {
		gap: 1rem;
	}

	.builder-overview,
	.builder-snapshot {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 0.75rem;
	}

	.builder-snapshot div {
		display: grid;
		gap: 0.24rem;
		padding: 0.88rem 0.95rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		border-radius: 0.8rem;
		width: 100%;
		max-width: none;
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
		border-color: color-mix(in oklch, var(--color-accent-strong) 14%, var(--color-border) 86%);
	}

	.builder-section:nth-of-type(3) {
		border-color: color-mix(in oklch, var(--color-accent-strong) 12%, var(--color-border) 88%);
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
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.8rem;
		align-items: start;
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
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
		align-items: stretch;
		margin-bottom: 0.9rem;
	}

	.detail-lines div,
	.support-list div {
		display: grid;
		gap: 0.22rem;
		padding: 0.82rem;
		border-radius: 0.8rem;
		background: var(--color-surface);
		width: 100%;
		max-width: none;
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
		:global(.event-calendar-host .ec) {
			--ec-slot-height: 30px;
		}

		:global(.event-calendar-host .ec-time-grid .ec-events) {
			padding-inline: 0.25rem;
		}

		.app-shell {
			grid-template-columns: 1fr;
		}

		.rail {
			border-right: 0;
			border-bottom: 1px solid var(--color-border);
		}

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

	/* --- Shimmer skeleton --- */
	@keyframes shimmer {
		from {
			background-position: -200% 0;
		}
		to {
			background-position: 200% 0;
		}
	}

	.skeleton {
		border-radius: 0.5rem;
		background: linear-gradient(
			90deg,
			var(--color-surface) 0%,
			color-mix(in oklch, var(--color-surface) 68%, var(--color-border) 32%) 50%,
			var(--color-surface) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.6s ease-in-out infinite;
	}

	.skeleton-rows {
		display: grid;
		gap: 0.75rem;
	}

	.skeleton-title {
		height: 1.3rem;
		width: 38%;
	}

	.skeleton-text {
		height: 0.8rem;
		width: 60%;
	}

	.skeleton-row {
		height: 3.1rem;
		width: 100%;
	}

	/* --- Searchable combobox --- */
	.combobox-wrap {
		position: relative;
	}

	.combobox-input {
		width: 100%;
		padding: 0.72rem 0.85rem;
		border: 1px solid var(--color-border);
		border-radius: 0.8rem;
		background: var(--color-surface);
		color: inherit;
		font: inherit;
	}

	.combobox-input:focus {
		outline: 2px solid color-mix(in oklch, var(--color-accent-strong) 32%, transparent 68%);
		outline-offset: 1px;
		border-color: color-mix(in oklch, var(--color-accent-strong) 38%, var(--color-border) 62%);
	}

	.combobox-dropdown {
		position: absolute;
		z-index: 20;
		top: calc(100% + 0.35rem);
		left: 0;
		right: 0;
		max-height: 15rem;
		overflow-y: auto;
		border: 1px solid var(--color-border);
		border-radius: 0.8rem;
		background: var(--color-panel);
		box-shadow: 0 8px 24px color-mix(in oklch, var(--color-shadow) 18%, transparent 82%);
		display: grid;
		gap: 0.1rem;
		padding: 0.35rem;
	}

	.combobox-option {
		display: grid;
		gap: 0.12rem;
		padding: 0.6rem 0.75rem;
		border-radius: 0.55rem;
		border: 1px solid transparent;
		text-align: left;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
	}

	.combobox-option:hover,
	.combobox-option.active {
		background: color-mix(in oklch, var(--color-surface) 76%, var(--color-accent-soft) 24%);
		border-color: color-mix(in oklch, var(--color-accent-strong) 14%, var(--color-border) 86%);
	}

	.combobox-option strong {
		font-size: 0.9rem;
		line-height: 1.25;
	}

	.combobox-option span {
		font-size: 0.8rem;
		color: var(--color-muted-foreground);
	}

	.combobox-error {
		margin: 0.35rem 0 0;
		font-size: 0.86rem;
		color: var(--color-danger);
	}

	/* --- Feedback dismiss --- */
	.feedback {
		align-items: center;
	}

	.feedback-dismiss {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		margin-left: auto;
		flex: 0 0 auto;
		width: 1.55rem;
		height: 1.55rem;
		border: 0;
		border-radius: 0.35rem;
		background: transparent;
		color: inherit;
		font-size: 1.05rem;
		line-height: 1;
		cursor: pointer;
		opacity: 0.55;
		transition:
			opacity 120ms ease,
			background 120ms ease;
	}

	.feedback-dismiss:hover {
		opacity: 1;
		background: color-mix(in oklch, var(--color-foreground) 8%, transparent 92%);
	}

	/* --- Support warning retry head --- */
	.support-warning-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
</style>
