<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { browser } from '$app/environment';
	import { onMount, untrack } from 'svelte';
	import type { Component } from 'svelte';
	import { clearAccessToken, ensureAccessToken, setAccessToken } from '$lib/client/auth';
	import {
		AlertCircle,
		ArrowRightLeft,
		BookOpen,
		Building2,
		CalendarDays,
		ChevronLeft,
		ChevronRight,
		ClipboardList,
		DoorClosed,
		GraduationCap,
		LayoutPanelTop,
		Menu,
		MoonStar,
		RotateCw,
		Search,
		ShieldCheck,
		SunMedium,
		UsersRound,
		Waypoints,
		X
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
		type RoomMetric,
		type ScheduleCard
	} from '$lib/app/academic';
	import { formatDateTime, formatDateTimeInput, parseISO } from '$lib/time-helpers';
	import ClassroomDashboard from '$lib/components/app/ClassroomDashboard.svelte';
	import CollectionPagination from '$lib/components/app/CollectionPagination.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { getCurrentUser, loginUser, logoutUser } from './auth/data.remote';
	import {
		getClassRooms,
		getClassRoom,
		getClassRoomDashboardMetrics,
		getClassRoomDashboardSummary,
		searchClassRooms,
		createClassRoom,
		updateClassRoom,
		deleteClassRoom,
		type RoomDashboardSummary
	} from './classrooms/data.remote';
	import {
		getCourses,
		getCourse,
		searchCourses,
		createCourse,
		updateCourse,
		deleteCourse
	} from './courses/data.remote';
	import {
		getStudents,
		getStudent,
		searchStudents,
		createStudent,
		updateStudent,
		deleteStudent
	} from './students/data.remote';
	import {
		getLecturers,
		getLecturer,
		searchLecturers,
		createLecturer,
		updateLecturer,
		deleteLecturer
	} from './lecturers/data.remote';
	import {
		getFaculties,
		getFaculty,
		searchFaculties,
		createFaculty,
		updateFaculty,
		deleteFaculty
	} from './faculties/data.remote';
	import {
		getStudyPrograms,
		getStudyProgram,
		searchStudyPrograms,
		createStudyProgram,
		updateStudyProgram,
		deleteStudyProgram
	} from './study-programs/data.remote';
	import {
		getEnrollments,
		getEnrollmentConflictAudit,
		getSchedulePreview,
		searchEnrollments,
		createEnrollment,
		updateEnrollment,
		deleteEnrollment
	} from './enrollments/data.remote';
	import {
		getGrades,
		searchGrades,
		createGrade,
		updateGrade,
		deleteGrade
	} from './grades/data.remote';
	import { getUsers, searchUsers, updateUser } from './users/data.remote';
	import type {
		SelectClassRoomsResult,
		SelectCoursesResult,
		SelectEnrollmentsResult,
		SelectFacultiesResult,
		SelectGradesResult,
		SelectLecturersResult,
		SelectStudentsResult,
		SelectStudyProgramsResult,
		SelectUsersResult
	} from '$lib/server/sql';

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
	type IssueForm = {
		fields?: {
			allIssues?: () => Array<{ message?: string }> | undefined;
		};
	};
	type LimitedCollectionResponse<T> = {
		items: T[];
		limit: number;
		hasMore: boolean;
		nextCursor: string | null;
	};
	type ViewDataPlan = {
		collections: DataCollectionKey[];
		requiresSchedulePreview: boolean;
	};
	type RefreshDependencies = {
		collections?: DataCollectionKey[];
		includeSchedulePreview?: boolean;
		includeConflictAudit?: boolean;
		forceCollections?: boolean;
	};
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
	type SchedulePreviewState = {
		items: SelectEnrollmentsResult[];
		hasMore: boolean;
		loading: boolean;
	};
	type CollectionLoadedState = Record<DataCollectionKey, boolean>;
	type EnhancedForm = IssueForm & {
		enhance: (callback: (opts: { submit: () => Promise<boolean> }) => void | Promise<void>) => {
			action: string;
			method: 'POST';
			[key: symbol]: (node: HTMLFormElement) => void;
		};
	};

	const currentUser = getCurrentUser();
	const timezone = 'Asia/Jakarta';
	const DEFAULT_DAY_START = 7 * 60;
	const DEFAULT_DAY_END = 20 * 60;
	const RANGE_PADDING_MINUTES = 60;
	const MIN_VISIBLE_MINUTES = 6 * 60;
	const CALENDAR_MAX_VISIBLE_SCHEDULES = 60;
	function createCalendarWeekStart() {
		return new Date(2025, 0, 6);
	}

	function createCalendarAnchorDate(weekOffset = 0) {
		const date = createCalendarWeekStart();
		date.setDate(date.getDate() + weekOffset * 7);
		return date;
	}

	const viewCatalog = {
		dashboard: { label: 'Ringkasan', icon: LayoutPanelTop },
		calendar: { label: 'Kalender Mingguan', icon: CalendarDays },
		builder: { label: 'Penjadwalan', icon: Waypoints },
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
		const resolveRoute = resolve as unknown as (path: string) => string;
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		replaceState(resolveRoute(`${url.pathname}${url.search}${url.hash}`), {});
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
					label: 'Ringkasan',
					description: 'Lihat bentrok, kalender, dan ruang yang perlu ditata.',
					icon: LayoutPanelTop,
					views: ['dashboard', 'calendar']
				},
				{
					id: 'planning',
					label: 'Penjadwalan',
					description: 'Atur jadwal kelas dan pilih ruang pengganti dari satu halaman.',
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
					label: 'Ringkasan',
					description: 'Lihat kelas terdekat, bentrok, dan ruang yang masih tersedia.',
					icon: LayoutPanelTop,
					views: ['dashboard', 'calendar']
				},
				{
					id: 'planning',
					label: 'Penjadwalan',
					description: 'Pindahkan jadwal dan pilih ruang dari halaman penjadwalan.',
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
				description: 'Lihat kelas berikutnya, perubahan ruang, dan jadwal mingguan.',
				icon: CalendarDays,
				views: ['dashboard', 'calendar']
			},
			{
				id: 'study',
				label: 'Studi',
				description: 'Buka KRS, nilai, ruang, dan daftar mata kuliah.',
				icon: BookOpen,
				views: ['enrollments', 'grades', 'courses', 'lecturers', 'classrooms']
			}
		];
	}

	function pageHeading(view: ViewId) {
		if (currentUser.current?.role === 'STUDENT' && view === 'dashboard') return 'Jadwal dan nilai';
		if (view === 'dashboard') return 'Ringkasan jadwal';
		if (view === 'calendar') return 'Kalender perkuliahan';
		if (view === 'builder') return 'Penjadwalan kelas';
		return viewCatalog[view].label;
	}

	function conflictPeerLabel(card: ScheduleCard) {
		return `${card.course} • ${card.student} • ${card.room} • ${DAY_LABELS[card.day]} ${card.startLabel}-${card.endLabel}`;
	}

	function summarizeDistinctValues(values: Array<string | null | undefined>, maxVisible = 2) {
		const uniqueValues = Array.from(
			new Set(
				values
					.map((value) => value?.trim())
					.filter((value): value is string => Boolean(value && value.length))
			)
		);

		if (!uniqueValues.length) return '-';
		if (uniqueValues.length <= maxVisible) return uniqueValues.join(', ');

		return `${uniqueValues.slice(0, maxVisible).join(', ')} +${uniqueValues.length - maxVisible} lain`;
	}

	function conflictGroupMetaCopy(
		details: {
			count: number;
			lecturers: string;
			rooms: string;
		} | null
	) {
		if (!details) return null;
		return `${details.count} jadwal • Ruang: ${details.rooms} • Dosen: ${details.lecturers}`;
	}

	function schedulesOverlap(left: ScheduleCard, right: ScheduleCard) {
		return (
			left.id !== right.id &&
			left.day === right.day &&
			left.startMinutes < right.endMinutes &&
			right.startMinutes < left.endMinutes
		);
	}

	type ConflictAuditResult = Awaited<ReturnType<typeof getEnrollmentConflictAudit>>;
	type ConflictAuditGroupResult = ConflictAuditResult['groups'][number];
	type ConflictAuditMemberResult = ConflictAuditGroupResult['members'][number];

	function toEnrollmentResultFromConflictMember(
		member: ConflictAuditMemberResult
	): SelectEnrollmentsResult {
		return {
			id: member.enrollmentId,
			student_id: member.studentId,
			course_id: member.courseId,
			lecturer_id: member.lecturerId,
			class_room_id: member.classRoomId,
			schedule_id: member.scheduleId,
			semester: member.semester,
			academic_year: member.academicYear,
			student_name: member.studentName,
			course_name: member.courseName,
			lecturer_name: member.lecturerName,
			class_room_name: member.classRoomName,
			schedule_day: member.day,
			schedule_start_time: member.startTime,
			schedule_end_time: member.endTime
		};
	}

	function scheduleCardFromConflictMember(
		member: ConflictAuditMemberResult,
		groupId: string,
		tone: number
	): ScheduleCard {
		const original = toEnrollmentResultFromConflictMember(member);
		const startMinutes = toMinutes(member.startTime, timezone);
		const endMinutes = toMinutes(member.endTime, timezone);
		return {
			id: member.enrollmentId,
			day: member.day,
			course: member.courseName,
			lecturer: member.lecturerName,
			room: member.classRoomName,
			student: member.studentName,
			semester: member.semester,
			academicYear: member.academicYear,
			startLabel: formatDateTime(member.startTime, 'time', timezone),
			endLabel: formatDateTime(member.endTime, 'time', timezone),
			startMinutes,
			endMinutes,
			durationMinutes: Math.max(30, endMinutes - startMinutes),
			hasConflict: true,
			conflictGroupId: groupId,
			conflictTone: tone,
			original
		};
	}

	function openBuilderForSchedule(card: ScheduleCard | null | undefined) {
		if (!card) return;
		selectedScheduleId = card.id;
		selectedConflictGroupId = card.hasConflict ? (card.conflictGroupId ?? card.id) : null;
		pickEnrollment(card.original);
		activeView = 'builder';
	}

	function openCalendarForSchedule(card: ScheduleCard | null | undefined) {
		if (!card) return;
		focusSchedule(card);
		activeView = 'calendar';
	}

	function focusSchedule(card: ScheduleCard | null | undefined) {
		if (!card) return;
		selectedScheduleId = card.id;
		selectedConflictGroupId = card.hasConflict ? (card.conflictGroupId ?? card.id) : null;
	}

	function toggleConflictGroup(groupId: string, representative: ScheduleCard) {
		if (selectedConflictGroupId === groupId) {
			selectedConflictGroupId = null;
			return;
		}
		selectedConflictGroupId = groupId;
		selectedScheduleId = representative.id;
	}

	const builderSteps = [
		{ id: 'participant', label: 'Peserta', hint: 'Pilih mahasiswa dan mata kuliah.' },
		{ id: 'time', label: 'Waktu', hint: 'Tentukan hari dan jam kuliah.' },
		{ id: 'room', label: 'Ruang', hint: 'Pilih ruang yang tersedia.' },
		{ id: 'review', label: 'Tinjau', hint: 'Periksa sebelum disimpan.' }
	] as const;
	function headerAction(view: ViewId, role: AppRole | undefined) {
		if (role === 'STUDENT') {
			if (view === 'dashboard') return { label: 'Buka kalender', target: 'calendar' as ViewId };
			return null;
		}

		if (view === 'builder') return { label: 'Lihat kalender', target: 'calendar' as ViewId };
		if (view === 'calendar') return { label: 'Buka penjadwalan', target: 'builder' as ViewId };
		if (view === 'dashboard') return { label: 'Atur jadwal', target: 'builder' as ViewId };
		return { label: 'Kembali ke ringkasan', target: 'dashboard' as ViewId };
	}

	function activateView(view: ViewId) {
		activeView = view;
		mobileRailOpen = false;
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
		const date = createCalendarAnchorDate(calendarWeekOffset);
		date.setDate(date.getDate() + DAY_ORDER.indexOf(card.day));
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

	let EventCalendarComponent = $state<Component<{ plugins?: unknown[]; options?: unknown }> | null>(
		null
	);
	let calendarPlugins = $state<unknown[]>([]);
	let calendarLoadPromise: Promise<void> | null = null;
	let theme = $state<'light' | 'dark'>('light');
	let activeView = $state<ViewId>('dashboard');
	let builderStep = $state<BuilderStep>('participant');
	let editorView = $state<EditableView | null>(null);
	let pendingDelete = $state<DeleteIntent | null>(null);
	let feedback = $state<Feedback>(null);
	let appLoading = $state(false);
	let viewRefreshLoading = $state(false);
	let initialViewHydrated = $state(false);
	let loadedForUserId = $state<string | null>(null);
	let viewRestored = $state(!browser);
	let collectionIssues = $state<Partial<Record<DataCollectionKey, string>>>({});
	let collectionPagination = $state<Record<DataCollectionKey, CollectionPaginationState>>(
		createCollectionPaginationState()
	);
	let collectionLoaded = $state<CollectionLoadedState>(createCollectionLoadedState());
	let schedulePreviewLoaded = $state(false);
	let conflictAudit = $state<Awaited<ReturnType<typeof getEnrollmentConflictAudit>> | null>(null);
	let classRoomDashboardSummary = $state<RoomDashboardSummary | null>(null);
	let classRoomDashboardMetrics = $state<{
		items: RoomMetric[];
		pageSize: number;
		hasMore: boolean;
		nextCursor: string | null;
	} | null>(null);
	let classRoomDashboardPagination = $state<CollectionPaginationState>(
		emptyCollectionPaginationState()
	);
	let classRoomDashboardLoaded = $state(false);
	let classRoomDashboardRequestToken = 0;
	let pendingRefreshTimer: number | null = null;
	let collectionRefreshTimers: Partial<Record<DataCollectionKey, number>> = {};
	let conflictAuditRefreshTimer: number | null = null;
	let studentPickerSearch = $state('');
	let coursePickerSearch = $state('');
	let studentPickerOpen = $state(false);
	let coursePickerOpen = $state(false);
	let studentPickerOptions = $state<SelectStudentsResult[]>([]);
	let coursePickerOptions = $state<SelectCoursesResult[]>([]);
	let studentPickerLoading = $state(false);
	let coursePickerLoading = $state(false);
	let studentPickerIssue = $state<string | null>(null);
	let coursePickerIssue = $state<string | null>(null);
	let studentPickerHasMore = $state(false);
	let coursePickerHasMore = $state(false);
	let studentPickerNextCursor = $state<string | null>(null);
	let coursePickerNextCursor = $state<string | null>(null);
	let studentPickerRefreshTimer: number | null = null;
	let coursePickerRefreshTimer: number | null = null;
	let studentPickerRequestToken = 0;
	let coursePickerRequestToken = 0;
	let roomPickerSearch = $state('');
	let roomPickerOpen = $state(false);
	let roomPickerOptions = $state<SelectClassRoomsResult[]>([]);
	let roomPickerLoading = $state(false);
	let roomPickerIssue = $state<string | null>(null);
	let roomPickerHasMore = $state(false);
	let roomPickerNextCursor = $state<string | null>(null);
	let roomPickerRefreshTimer: number | null = null;
	let roomPickerRequestToken = 0;

	let classrooms = $state<SelectClassRoomsResult[]>([]);
	let courses = $state<SelectCoursesResult[]>([]);
	let students = $state<SelectStudentsResult[]>([]);
	let lecturers = $state<SelectLecturersResult[]>([]);
	let faculties = $state<SelectFacultiesResult[]>([]);
	let studyPrograms = $state<SelectStudyProgramsResult[]>([]);
	let enrollments = $state<SelectEnrollmentsResult[]>([]);
	let grades = $state<SelectGradesResult[]>([]);
	let users = $state<SelectUsersResult[]>([]);
	let schedulePreview = $state<SchedulePreviewState>({
		items: [],
		hasMore: false,
		loading: false
	});
	let selectedRoomRecord = $state<SelectClassRoomsResult | null>(null);
	let selectedCourseRecord = $state<SelectCoursesResult | null>(null);
	let selectedStudentRecord = $state<SelectStudentsResult | null>(null);
	let selectedLecturerRecord = $state<SelectLecturersResult | null>(null);
	let selectedFacultyRecord = $state<SelectFacultiesResult | null>(null);
	let selectedStudyProgramRecord = $state<SelectStudyProgramsResult | null>(null);
	let selectedEnrollmentRecord = $state<SelectEnrollmentsResult | null>(null);
	let selectedGradeRecord = $state<SelectGradesResult | null>(null);
	let selectedUserRecord = $state<SelectUsersResult | null>(null);

	let roomSearch = $state('');
	let courseSearch = $state('');
	let studentSearch = $state('');
	let lecturerSearch = $state('');
	let facultySearch = $state('');
	let studyProgramSearch = $state('');
	let enrollmentSearch = $state('');
	let scheduleCourseFilter = $state('');
	let scheduleRoomFilter = $state('');
	let scheduleLecturerFilter = $state('');
	let scheduleCourseFilterSearch = $state('');
	let scheduleRoomFilterSearch = $state('');
	let scheduleLecturerFilterSearch = $state('');
	let scheduleCourseFilterOpen = $state(false);
	let scheduleRoomFilterOpen = $state(false);
	let scheduleLecturerFilterOpen = $state(false);
	let scheduleCourseFilterOptions = $state<SelectCoursesResult[]>([]);
	let scheduleLecturerFilterOptions = $state<SelectLecturersResult[]>([]);
	let scheduleCourseFilterLoading = $state(false);
	let scheduleLecturerFilterLoading = $state(false);
	let scheduleCourseFilterIssue = $state<string | null>(null);
	let scheduleLecturerFilterIssue = $state<string | null>(null);
	let scheduleCourseFilterHasMore = $state(false);
	let scheduleLecturerFilterHasMore = $state(false);
	let scheduleCourseFilterNextCursor = $state<string | null>(null);
	let scheduleLecturerFilterNextCursor = $state<string | null>(null);
	let scheduleCourseFilterRefreshTimer: number | null = null;
	let scheduleLecturerFilterRefreshTimer: number | null = null;
	let scheduleCourseFilterRequestToken = 0;
	let scheduleLecturerFilterRequestToken = 0;
	let scheduleRoomFilterOptions = $state<SelectClassRoomsResult[]>([]);
	let scheduleRoomFilterLoading = $state(false);
	let scheduleRoomFilterIssue = $state<string | null>(null);
	let scheduleRoomFilterHasMore = $state(false);
	let scheduleRoomFilterNextCursor = $state<string | null>(null);
	let scheduleRoomFilterRefreshTimer: number | null = null;
	let scheduleRoomFilterRequestToken = 0;
	let scheduleDayFilter = $state('');
	let scheduleSemesterFilter = $state('');
	let scheduleAcademicYearFilter = $state('');
	let builderConflictOnly = $state(false);
	let gradeSearch = $state('');
	let gradeLetterFilter = $state('');
	let gradeCourseFilter = $state('');
	let userSearch = $state('');

	let selectedScheduleId = $state<string | null>(null);
	let selectedConflictGroupId = $state<string | null>(null);
	let calendarWeekOffset = $state(0);
	let mobileRailOpen = $state(false);
	let selectedRoomId = $state<string | null>(null);
	let selectedCourseId = $state<string | null>(null);
	let selectedStudentId = $state<string | null>(null);
	let selectedLecturerId = $state<string | null>(null);
	let selectedFacultyId = $state<string | null>(null);
	let selectedStudyProgramId = $state<string | null>(null);
	let selectedEnrollmentId = $state<string | null>(null);
	let selectedGradeId = $state<string | null>(null);
	let selectedUserId = $state<string | null>(null);

	const emptyRoomDashboardSummary: RoomDashboardSummary = {
		totalRooms: 0,
		availableNowCount: 0,
		occupiedRoomCount: 0,
		lowUtilizationRoomCount: 0,
		averageUtilization: 0,
		conflictedCount: 0
	};

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
		const nextIssues = { ...collectionIssues };
		delete nextIssues[key];
		collectionIssues = nextIssues;
	}

	function emptyCollectionPaginationState(): CollectionPaginationState {
		return {
			currentCursor: null,
			nextCursor: null,
			history: [],
			pageNumber: 1,
			limit: 0,
			hasMore: false,
			loading: false,
			itemCount: 0
		};
	}

	function createCollectionPaginationState(): Record<DataCollectionKey, CollectionPaginationState> {
		return {
			classrooms: emptyCollectionPaginationState(),
			courses: emptyCollectionPaginationState(),
			students: emptyCollectionPaginationState(),
			lecturers: emptyCollectionPaginationState(),
			faculties: emptyCollectionPaginationState(),
			studyPrograms: emptyCollectionPaginationState(),
			enrollments: emptyCollectionPaginationState(),
			grades: emptyCollectionPaginationState(),
			users: emptyCollectionPaginationState()
		};
	}

	function createCollectionLoadedState(): CollectionLoadedState {
		return {
			classrooms: false,
			courses: false,
			students: false,
			lecturers: false,
			faculties: false,
			studyPrograms: false,
			enrollments: false,
			grades: false,
			users: false
		};
	}

	function setCollectionPagination(
		key: DataCollectionKey,
		patch: Partial<CollectionPaginationState>
	) {
		collectionPagination = {
			...collectionPagination,
			[key]: {
				...collectionPagination[key],
				...patch
			}
		};
	}

	function applyLimitedCollection<T>(
		result: LimitedCollectionResponse<T>,
		assign: (items: T[]) => void
	) {
		assign(result.items);
	}

	async function resolveRemoteQuery<T>(query: Promise<T> | { run: () => Promise<T> }): Promise<T> {
		try {
			return await (query as Promise<T>);
		} catch (error) {
			if (
				typeof query === 'object' &&
				query != null &&
				'run' in query &&
				typeof query.run === 'function' &&
				(error as Error)?.message?.includes(
					'This query was not created in a reactive context and is limited to calling `.run`, `.refresh`, and `.set`.'
				)
			) {
				return await query.run();
			}

			throw error;
		}
	}

	function errorMessage(error: unknown, fallback: string) {
		return (
			(error as { body?: { message?: string }; message?: string })?.body?.message ||
			(error as Error)?.message ||
			fallback
		);
	}

	function normalizedSearchValue(value: string) {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	}

	function mergeItemsById<T extends { id?: string }>(current: T[], next: T[]) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const itemsById = new Map<string, T>();
		const anonymousItems: T[] = [];
		for (const item of [...current, ...next]) {
			if (!item.id) {
				anonymousItems.push(item);
				continue;
			}
			itemsById.set(item.id, item);
		}
		return [...itemsById.values(), ...anonymousItems];
	}

	async function refreshStudentPickerOptions(cursor: string | null = null) {
		const token = ++studentPickerRequestToken;
		const append = cursor != null;
		studentPickerLoading = true;
		studentPickerIssue = null;
		try {
			const q = normalizedSearchValue(studentPickerSearch);
			const result = q
				? await resolveRemoteQuery(searchStudents({ q, cursor: cursor ?? undefined }))
				: await resolveRemoteQuery(getStudents({ cursor: cursor ?? undefined }));
			if (token !== studentPickerRequestToken) return;
			studentPickerOptions = append
				? mergeItemsById(studentPickerOptions, result.items)
				: result.items;
			studentPickerHasMore = result.hasMore;
			studentPickerNextCursor = result.nextCursor;
		} catch (error) {
			if (token !== studentPickerRequestToken) return;
			studentPickerIssue = errorMessage(error, 'Daftar mahasiswa gagal dimuat.');
		} finally {
			if (token === studentPickerRequestToken) {
				studentPickerLoading = false;
			}
		}
	}

	async function refreshCoursePickerOptions(cursor: string | null = null) {
		const token = ++coursePickerRequestToken;
		const append = cursor != null;
		coursePickerLoading = true;
		coursePickerIssue = null;
		try {
			const q = normalizedSearchValue(coursePickerSearch);
			const result = q
				? await resolveRemoteQuery(searchCourses({ q, cursor: cursor ?? undefined }))
				: await resolveRemoteQuery(getCourses({ cursor: cursor ?? undefined }));
			if (token !== coursePickerRequestToken) return;
			coursePickerOptions = append
				? mergeItemsById(coursePickerOptions, result.items)
				: result.items;
			coursePickerHasMore = result.hasMore;
			coursePickerNextCursor = result.nextCursor;
		} catch (error) {
			if (token !== coursePickerRequestToken) return;
			coursePickerIssue = errorMessage(error, 'Daftar mata kuliah gagal dimuat.');
		} finally {
			if (token === coursePickerRequestToken) {
				coursePickerLoading = false;
			}
		}
	}

	async function refreshScheduleCourseFilterOptions(cursor: string | null = null) {
		const token = ++scheduleCourseFilterRequestToken;
		const append = cursor != null;
		scheduleCourseFilterLoading = true;
		scheduleCourseFilterIssue = null;
		try {
			const q = normalizedSearchValue(scheduleCourseFilterSearch);
			const result = q
				? await resolveRemoteQuery(searchCourses({ q, cursor: cursor ?? undefined }))
				: await resolveRemoteQuery(getCourses({ cursor: cursor ?? undefined }));
			if (token !== scheduleCourseFilterRequestToken) return;
			scheduleCourseFilterOptions = append
				? mergeItemsById(scheduleCourseFilterOptions, result.items)
				: result.items;
			scheduleCourseFilterHasMore = result.hasMore;
			scheduleCourseFilterNextCursor = result.nextCursor;
		} catch (error) {
			if (token !== scheduleCourseFilterRequestToken) return;
			scheduleCourseFilterIssue = errorMessage(error, 'Daftar mata kuliah gagal dimuat.');
		} finally {
			if (token === scheduleCourseFilterRequestToken) {
				scheduleCourseFilterLoading = false;
			}
		}
	}

	async function refreshScheduleLecturerFilterOptions(cursor: string | null = null) {
		const token = ++scheduleLecturerFilterRequestToken;
		const append = cursor != null;
		scheduleLecturerFilterLoading = true;
		scheduleLecturerFilterIssue = null;
		try {
			const q = normalizedSearchValue(scheduleLecturerFilterSearch);
			const result = q
				? await resolveRemoteQuery(searchLecturers({ q, cursor: cursor ?? undefined }))
				: await resolveRemoteQuery(getLecturers({ cursor: cursor ?? undefined }));
			if (token !== scheduleLecturerFilterRequestToken) return;
			scheduleLecturerFilterOptions = append
				? mergeItemsById(scheduleLecturerFilterOptions, result.items)
				: result.items;
			scheduleLecturerFilterHasMore = result.hasMore;
			scheduleLecturerFilterNextCursor = result.nextCursor;
		} catch (error) {
			if (token !== scheduleLecturerFilterRequestToken) return;
			scheduleLecturerFilterIssue = errorMessage(error, 'Daftar dosen gagal dimuat.');
		} finally {
			if (token === scheduleLecturerFilterRequestToken) {
				scheduleLecturerFilterLoading = false;
			}
		}
	}

	function queueStudentPickerRefresh(delay = 120) {
		if (!browser) {
			void refreshStudentPickerOptions(null);
			return;
		}
		if (studentPickerRefreshTimer != null) {
			window.clearTimeout(studentPickerRefreshTimer);
		}
		studentPickerRefreshTimer = window.setTimeout(() => {
			studentPickerRefreshTimer = null;
			void refreshStudentPickerOptions(null);
		}, delay);
	}

	function queueCoursePickerRefresh(delay = 120) {
		if (!browser) {
			void refreshCoursePickerOptions(null);
			return;
		}
		if (coursePickerRefreshTimer != null) {
			window.clearTimeout(coursePickerRefreshTimer);
		}
		coursePickerRefreshTimer = window.setTimeout(() => {
			coursePickerRefreshTimer = null;
			void refreshCoursePickerOptions(null);
		}, delay);
	}

	function queueScheduleCourseFilterRefresh(delay = 120) {
		if (!browser) {
			void refreshScheduleCourseFilterOptions(null);
			return;
		}
		if (scheduleCourseFilterRefreshTimer != null) {
			window.clearTimeout(scheduleCourseFilterRefreshTimer);
		}
		scheduleCourseFilterRefreshTimer = window.setTimeout(() => {
			scheduleCourseFilterRefreshTimer = null;
			void refreshScheduleCourseFilterOptions(null);
		}, delay);
	}

	function queueScheduleLecturerFilterRefresh(delay = 120) {
		if (!browser) {
			void refreshScheduleLecturerFilterOptions(null);
			return;
		}
		if (scheduleLecturerFilterRefreshTimer != null) {
			window.clearTimeout(scheduleLecturerFilterRefreshTimer);
		}
		scheduleLecturerFilterRefreshTimer = window.setTimeout(() => {
			scheduleLecturerFilterRefreshTimer = null;
			void refreshScheduleLecturerFilterOptions(null);
		}, delay);
	}

	function loadMoreStudentPickerOptions() {
		if (studentPickerLoading || !studentPickerHasMore || !studentPickerNextCursor) return;
		void refreshStudentPickerOptions(studentPickerNextCursor);
	}

	function loadMoreCoursePickerOptions() {
		if (coursePickerLoading || !coursePickerHasMore || !coursePickerNextCursor) return;
		void refreshCoursePickerOptions(coursePickerNextCursor);
	}

	function loadMoreScheduleCourseFilterOptions() {
		if (
			scheduleCourseFilterLoading ||
			!scheduleCourseFilterHasMore ||
			!scheduleCourseFilterNextCursor
		)
			return;
		void refreshScheduleCourseFilterOptions(scheduleCourseFilterNextCursor);
	}

	function loadMoreScheduleLecturerFilterOptions() {
		if (
			scheduleLecturerFilterLoading ||
			!scheduleLecturerFilterHasMore ||
			!scheduleLecturerFilterNextCursor
		)
			return;
		void refreshScheduleLecturerFilterOptions(scheduleLecturerFilterNextCursor);
	}

	function scheduleFiltersMatch(item: SelectEnrollmentsResult) {
		if (scheduleCourseFilter && item.course_id !== scheduleCourseFilter) return false;
		if (scheduleRoomFilter && item.class_room_id !== scheduleRoomFilter) return false;
		if (scheduleLecturerFilter && item.lecturer_id !== scheduleLecturerFilter) return false;
		if (scheduleDayFilter && item.schedule_day !== scheduleDayFilter) return false;
		if (scheduleSemesterFilter && item.semester !== scheduleSemesterFilter) return false;
		if (scheduleAcademicYearFilter && item.academic_year !== scheduleAcademicYearFilter)
			return false;
		return true;
	}

	function scheduleSearchMatches(item: SelectEnrollmentsResult) {
		if (!enrollmentSearch) return true;
		const dayLabel = item.schedule_day
			? DAY_LABELS[item.schedule_day as keyof typeof DAY_LABELS]
			: '';

		return (
			matchesText(item.student_name, enrollmentSearch) ||
			matchesText(item.course_name, enrollmentSearch) ||
			matchesText(item.class_room_name, enrollmentSearch) ||
			matchesText(item.lecturer_name, enrollmentSearch) ||
			matchesText(dayLabel, enrollmentSearch) ||
			matchesText(item.semester, enrollmentSearch) ||
			matchesText(item.academic_year, enrollmentSearch)
		);
	}

	function resetScheduleFilters() {
		enrollmentSearch = '';
		scheduleCourseFilter = '';
		scheduleRoomFilter = '';
		scheduleLecturerFilter = '';
		scheduleCourseFilterSearch = '';
		scheduleRoomFilterSearch = '';
		scheduleLecturerFilterSearch = '';
		scheduleCourseFilterOpen = false;
		scheduleRoomFilterOpen = false;
		scheduleLecturerFilterOpen = false;
		scheduleDayFilter = '';
		scheduleSemesterFilter = '';
		scheduleAcademicYearFilter = '';
		builderConflictOnly = false;
		selectedConflictGroupId = null;
		queueCollectionRefresh('enrollments', 0);
	}

	function firstIssue(form: IssueForm) {
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
		void (async () => {
			await ensureAccessToken();
			await currentUser.refresh();
		})();
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
		schedulePreview = { items: [], hasMore: false, loading: false };
		schedulePreviewLoaded = false;
		conflictAudit = null;
		classRoomDashboardSummary = null;
		classRoomDashboardMetrics = null;
		classRoomDashboardPagination = emptyCollectionPaginationState();
		classRoomDashboardLoaded = false;
		initialViewHydrated = false;
		selectedRoomRecord = null;
		selectedCourseRecord = null;
		selectedStudentRecord = null;
		selectedLecturerRecord = null;
		selectedFacultyRecord = null;
		selectedStudyProgramRecord = null;
		selectedEnrollmentRecord = null;
		selectedGradeRecord = null;
		selectedUserRecord = null;
		collectionIssues = {};
		collectionPagination = createCollectionPaginationState();
		collectionLoaded = createCollectionLoadedState();
		roomPickerOptions = [];
		roomPickerLoading = false;
		roomPickerIssue = null;
		roomPickerHasMore = false;
		roomPickerNextCursor = null;
		scheduleRoomFilterOptions = [];
		scheduleRoomFilterLoading = false;
		scheduleRoomFilterIssue = null;
		scheduleRoomFilterHasMore = false;
		scheduleRoomFilterNextCursor = null;
		if (browser) {
			for (const timer of Object.values(collectionRefreshTimers)) {
				if (timer != null) window.clearTimeout(timer);
			}
			if (conflictAuditRefreshTimer != null) window.clearTimeout(conflictAuditRefreshTimer);
			if (studentPickerRefreshTimer != null) window.clearTimeout(studentPickerRefreshTimer);
			if (coursePickerRefreshTimer != null) window.clearTimeout(coursePickerRefreshTimer);
			if (scheduleCourseFilterRefreshTimer != null) {
				window.clearTimeout(scheduleCourseFilterRefreshTimer);
			}
			if (scheduleLecturerFilterRefreshTimer != null) {
				window.clearTimeout(scheduleLecturerFilterRefreshTimer);
			}
			if (roomPickerRefreshTimer != null) window.clearTimeout(roomPickerRefreshTimer);
			if (scheduleRoomFilterRefreshTimer != null) {
				window.clearTimeout(scheduleRoomFilterRefreshTimer);
			}
		}
		collectionRefreshTimers = {};
		conflictAuditRefreshTimer = null;
		studentPickerRefreshTimer = null;
		coursePickerRefreshTimer = null;
		scheduleCourseFilterRefreshTimer = null;
		scheduleLecturerFilterRefreshTimer = null;
		studentPickerOptions = [];
		coursePickerOptions = [];
		scheduleCourseFilterOptions = [];
		scheduleLecturerFilterOptions = [];
		studentPickerLoading = false;
		coursePickerLoading = false;
		scheduleCourseFilterLoading = false;
		scheduleLecturerFilterLoading = false;
		studentPickerIssue = null;
		coursePickerIssue = null;
		scheduleCourseFilterIssue = null;
		scheduleLecturerFilterIssue = null;
		studentPickerHasMore = false;
		coursePickerHasMore = false;
		scheduleCourseFilterHasMore = false;
		scheduleLecturerFilterHasMore = false;
		studentPickerNextCursor = null;
		coursePickerNextCursor = null;
		scheduleCourseFilterNextCursor = null;
		scheduleLecturerFilterNextCursor = null;
		roomPickerSearch = '';
		roomPickerOpen = false;
		scheduleCourseFilterSearch = '';
		scheduleRoomFilterSearch = '';
		scheduleLecturerFilterSearch = '';
		scheduleCourseFilterOpen = false;
		scheduleRoomFilterOpen = false;
		scheduleLecturerFilterOpen = false;
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

	async function loadCollectionPage<T>(
		key: DataCollectionKey,
		cursor: string | null,
		request: (
			cursor: string | null
		) =>
			| Promise<LimitedCollectionResponse<T>>
			| { run: () => Promise<LimitedCollectionResponse<T>> },
		assign: (items: T[]) => void,
		meta?: { history?: Array<string | null>; pageNumber?: number }
	) {
		setCollectionPagination(key, { loading: true });
		try {
			const result = await resolveRemoteQuery(request(cursor));

			applyLimitedCollection(result, assign);
			const nextHistory =
				meta?.history ?? (cursor == null ? [] : collectionPagination[key].history);
			const nextPageNumber =
				meta?.pageNumber ?? (cursor == null ? 1 : collectionPagination[key].pageNumber);
			setCollectionPagination(key, {
				currentCursor: cursor,
				nextCursor: result.nextCursor,
				history: nextHistory,
				pageNumber: nextPageNumber,
				limit: result.limit,
				hasMore: result.hasMore,
				loading: false,
				itemCount: result.items.length
			});
			collectionLoaded = { ...collectionLoaded, [key]: true };
		} catch (error) {
			setCollectionPagination(key, { loading: false });
			throw error;
		}
	}

	function buildEnrollmentSearchParams(cursor: string | null) {
		return {
			cursor: cursor ?? undefined,
			q: normalizedSearchValue(enrollmentSearch),
			courseId: scheduleCourseFilter || undefined,
			classRoomId: scheduleRoomFilter || undefined,
			lecturerId: scheduleLecturerFilter || undefined,
			scheduleDay: (scheduleDayFilter || undefined) as (typeof days)[number] | undefined,
			semester: scheduleSemesterFilter || undefined,
			academicYear: scheduleAcademicYearFilter || undefined
		};
	}

	function requestClassroomsPage(cursor: string | null) {
		const q = normalizedSearchValue(roomSearch);
		return q
			? searchClassRooms({ cursor: cursor ?? undefined, q })
			: getClassRooms({ cursor: cursor ?? undefined });
	}

	function requestCoursesPage(cursor: string | null) {
		const q = normalizedSearchValue(courseSearch);
		return q
			? searchCourses({ cursor: cursor ?? undefined, q })
			: getCourses({ cursor: cursor ?? undefined });
	}

	function requestStudentsPage(cursor: string | null) {
		const q = normalizedSearchValue(studentSearch);
		return q
			? searchStudents({ cursor: cursor ?? undefined, q })
			: getStudents({ cursor: cursor ?? undefined });
	}

	function requestLecturersPage(cursor: string | null) {
		const q = normalizedSearchValue(lecturerSearch);
		return q
			? searchLecturers({ cursor: cursor ?? undefined, q })
			: getLecturers({ cursor: cursor ?? undefined });
	}

	function requestFacultiesPage(cursor: string | null) {
		const q = normalizedSearchValue(facultySearch);
		return q
			? searchFaculties({ cursor: cursor ?? undefined, q })
			: getFaculties({ cursor: cursor ?? undefined });
	}

	function requestStudyProgramsPage(cursor: string | null) {
		const q = normalizedSearchValue(studyProgramSearch);
		return q
			? searchStudyPrograms({ cursor: cursor ?? undefined, q })
			: getStudyPrograms({ cursor: cursor ?? undefined });
	}

	function requestEnrollmentsPage(cursor: string | null) {
		const params = buildEnrollmentSearchParams(cursor);
		const hasFilters = Object.entries(params).some(
			([key, value]) => key !== 'cursor' && value != null
		);
		return hasFilters ? searchEnrollments(params) : getEnrollments({ cursor: cursor ?? undefined });
	}

	function requestGradesPage(cursor: string | null) {
		const q = normalizedSearchValue(gradeSearch);
		const letterGrade = gradeLetterFilter || undefined;
		const courseId = gradeCourseFilter || undefined;
		const hasFilters = q || letterGrade || courseId;
		return hasFilters
			? searchGrades({ cursor: cursor ?? undefined, q, letterGrade, courseId })
			: getGrades({ cursor: cursor ?? undefined });
	}

	function requestUsersPage(cursor: string | null) {
		const q = normalizedSearchValue(userSearch);
		return q
			? searchUsers({ cursor: cursor ?? undefined, q })
			: getUsers({ cursor: cursor ?? undefined });
	}

	async function refreshSchedulePreview() {
		schedulePreview = { ...schedulePreview, loading: true };
		try {
			const params = buildEnrollmentSearchParams(null);
			const hasFilters = Object.values(params).some((value) => value != null);
			const result = hasFilters
				? await resolveRemoteQuery(searchEnrollments({ ...params, preview: true }))
				: await resolveRemoteQuery(getSchedulePreview());
			schedulePreview = {
				items: result.items,
				hasMore: result.hasMore,
				loading: false
			};
			schedulePreviewLoaded = true;
		} catch (error) {
			schedulePreview = { ...schedulePreview, loading: false };
			throw error;
		}
	}

	function buildConflictAuditFilters() {
		return {
			limitGroups: 1000
		};
	}

	async function refreshConflictAudit() {
		if (!loadedForUserId) {
			conflictAudit = null;
			return;
		}

		try {
			conflictAudit = await resolveRemoteQuery(
				getEnrollmentConflictAudit(buildConflictAuditFilters())
			);
		} catch {
			conflictAudit = null;
		}
	}

	function queueConflictAuditRefresh(delay = 120) {
		if (!browser) {
			void refreshConflictAudit();
			return;
		}
		if (conflictAuditRefreshTimer != null) {
			window.clearTimeout(conflictAuditRefreshTimer);
		}
		conflictAuditRefreshTimer = window.setTimeout(() => {
			conflictAuditRefreshTimer = null;
			void refreshConflictAudit();
		}, delay);
	}

	async function refreshClassrooms(cursor = collectionPagination.classrooms.currentCursor) {
		await loadCollectionPage(
			'classrooms',
			cursor,
			requestClassroomsPage,
			(items) => (classrooms = items)
		);
	}

	async function refreshClassRoomDashboard(
		cursor: string | null = classRoomDashboardPagination.currentCursor,
		meta?: { history?: Array<string | null>; pageNumber?: number; refreshSummary?: boolean }
	) {
		const token = ++classRoomDashboardRequestToken;
		classRoomDashboardPagination = { ...classRoomDashboardPagination, loading: true };
		try {
			const shouldRefreshSummary = meta?.refreshSummary ?? !classRoomDashboardSummary;
			const [summary, metrics] = await Promise.all([
				shouldRefreshSummary
					? resolveRemoteQuery(getClassRoomDashboardSummary({ timezone }))
					: Promise.resolve(classRoomDashboardSummary),
				resolveRemoteQuery(getClassRoomDashboardMetrics({ timezone, cursor: cursor ?? undefined }))
			]);
			if (token !== classRoomDashboardRequestToken) return;
			classRoomDashboardSummary = summary;
			classRoomDashboardMetrics = metrics;
			classRoomDashboardPagination = {
				currentCursor: cursor,
				nextCursor: metrics.nextCursor,
				history: meta?.history ?? (cursor == null ? [] : classRoomDashboardPagination.history),
				pageNumber:
					meta?.pageNumber ?? (cursor == null ? 1 : classRoomDashboardPagination.pageNumber),
				limit: metrics.pageSize,
				hasMore: metrics.hasMore,
				loading: false,
				itemCount: metrics.items.length
			};
			classRoomDashboardLoaded = true;
		} catch (error) {
			if (token === classRoomDashboardRequestToken) {
				classRoomDashboardPagination = { ...classRoomDashboardPagination, loading: false };
			}
			throw error;
		}
	}

	function changeClassRoomDashboardPage(direction: 'previous' | 'next') {
		const pageState = classRoomDashboardPagination;
		if (direction === 'next') {
			if (!pageState.nextCursor) return;
			void refreshClassRoomDashboard(pageState.nextCursor, {
				history: [...pageState.history, pageState.currentCursor],
				pageNumber: pageState.pageNumber + 1
			});
			return;
		}

		const previousCursor = pageState.history.at(-1);
		if (previousCursor === undefined) return;
		void refreshClassRoomDashboard(previousCursor, {
			history: pageState.history.slice(0, -1),
			pageNumber: Math.max(1, pageState.pageNumber - 1)
		});
	}

	async function refreshRoomPickerOptions(cursor: string | null = null) {
		const token = ++roomPickerRequestToken;
		const append = cursor != null;
		roomPickerLoading = true;
		roomPickerIssue = null;
		try {
			const q = normalizedSearchValue(roomPickerSearch);
			const result = await resolveRemoteQuery(searchClassRooms({ q, cursor: cursor ?? undefined }));
			if (token !== roomPickerRequestToken) return;
			roomPickerOptions = append ? mergeItemsById(roomPickerOptions, result.items) : result.items;
			roomPickerHasMore = result.hasMore;
			roomPickerNextCursor = result.nextCursor;
		} catch (error) {
			if (token !== roomPickerRequestToken) return;
			roomPickerIssue = errorMessage(error, 'Daftar ruang kelas gagal dimuat.');
		} finally {
			if (token === roomPickerRequestToken) {
				roomPickerLoading = false;
			}
		}
	}

	async function refreshScheduleRoomFilterOptions(cursor: string | null = null) {
		const token = ++scheduleRoomFilterRequestToken;
		const append = cursor != null;
		scheduleRoomFilterLoading = true;
		scheduleRoomFilterIssue = null;
		try {
			const q = normalizedSearchValue(scheduleRoomFilterSearch);
			const result = await resolveRemoteQuery(searchClassRooms({ q, cursor: cursor ?? undefined }));
			if (token !== scheduleRoomFilterRequestToken) return;
			scheduleRoomFilterOptions = append
				? mergeItemsById(scheduleRoomFilterOptions, result.items)
				: result.items;
			scheduleRoomFilterHasMore = result.hasMore;
			scheduleRoomFilterNextCursor = result.nextCursor;
		} catch (error) {
			if (token !== scheduleRoomFilterRequestToken) return;
			scheduleRoomFilterIssue = errorMessage(error, 'Daftar ruang kelas gagal dimuat.');
		} finally {
			if (token === scheduleRoomFilterRequestToken) {
				scheduleRoomFilterLoading = false;
			}
		}
	}

	function loadMoreRoomPickerOptions() {
		if (roomPickerLoading || !roomPickerHasMore || !roomPickerNextCursor) return;
		void refreshRoomPickerOptions(roomPickerNextCursor);
	}

	function loadMoreScheduleRoomFilterOptions() {
		if (scheduleRoomFilterLoading || !scheduleRoomFilterHasMore || !scheduleRoomFilterNextCursor)
			return;
		void refreshScheduleRoomFilterOptions(scheduleRoomFilterNextCursor);
	}

	function queueRoomPickerRefresh(delay = 120) {
		if (!browser) {
			void refreshRoomPickerOptions(null);
			return;
		}
		if (roomPickerRefreshTimer != null) {
			window.clearTimeout(roomPickerRefreshTimer);
		}
		roomPickerRefreshTimer = window.setTimeout(() => {
			roomPickerRefreshTimer = null;
			void refreshRoomPickerOptions(null);
		}, delay);
	}

	function queueScheduleRoomFilterRefresh(delay = 120) {
		if (!browser) {
			void refreshScheduleRoomFilterOptions(null);
			return;
		}
		if (scheduleRoomFilterRefreshTimer != null) {
			window.clearTimeout(scheduleRoomFilterRefreshTimer);
		}
		scheduleRoomFilterRefreshTimer = window.setTimeout(() => {
			scheduleRoomFilterRefreshTimer = null;
			void refreshScheduleRoomFilterOptions(null);
		}, delay);
	}

	async function refreshCourses(cursor = collectionPagination.courses.currentCursor) {
		await loadCollectionPage('courses', cursor, requestCoursesPage, (items) => (courses = items));
	}

	async function refreshStudents(cursor = collectionPagination.students.currentCursor) {
		await loadCollectionPage(
			'students',
			cursor,
			requestStudentsPage,
			(items) => (students = items)
		);
	}

	async function refreshLecturers(cursor = collectionPagination.lecturers.currentCursor) {
		await loadCollectionPage(
			'lecturers',
			cursor,
			requestLecturersPage,
			(items) => (lecturers = items)
		);
	}

	async function refreshFaculties(cursor = collectionPagination.faculties.currentCursor) {
		await loadCollectionPage(
			'faculties',
			cursor,
			requestFacultiesPage,
			(items) => (faculties = items)
		);
	}

	async function refreshStudyPrograms(cursor = collectionPagination.studyPrograms.currentCursor) {
		await loadCollectionPage(
			'studyPrograms',
			cursor,
			requestStudyProgramsPage,
			(items) => (studyPrograms = items)
		);
	}

	async function refreshEnrollments(cursor = collectionPagination.enrollments.currentCursor) {
		await loadCollectionPage(
			'enrollments',
			cursor,
			requestEnrollmentsPage,
			(items) => (enrollments = items)
		);
	}

	async function refreshGrades(cursor = collectionPagination.grades.currentCursor) {
		await loadCollectionPage('grades', cursor, requestGradesPage, (items) => (grades = items));
	}

	async function refreshUsers(cursor = collectionPagination.users.currentCursor) {
		await loadCollectionPage('users', cursor, requestUsersPage, (items) => (users = items));
	}

	function collectionFallbackMessage(key: DataCollectionKey) {
		if (key === 'classrooms') return 'Ruang kelas gagal dimuat.';
		if (key === 'courses') return 'Mata kuliah gagal dimuat.';
		if (key === 'students') return 'Data mahasiswa gagal dimuat.';
		if (key === 'lecturers') return 'Data dosen gagal dimuat.';
		if (key === 'faculties') return 'Data fakultas gagal dimuat.';
		if (key === 'studyPrograms') return 'Program studi gagal dimuat.';
		if (key === 'enrollments') return 'Data KRS gagal dimuat.';
		if (key === 'grades') return 'Data nilai gagal dimuat.';
		return 'Data akun gagal dimuat.';
	}

	function viewDataPlan(view: ViewId, role: AppRole | undefined): ViewDataPlan {
		if (view === 'dashboard') {
			return {
				collections:
					role === 'STUDENT'
						? (['enrollments', 'grades'] as DataCollectionKey[])
						: (['classrooms'] as DataCollectionKey[]),
				requiresSchedulePreview: true
			};
		}
		if (view === 'calendar') {
			return {
				collections: ['courses', 'classrooms', 'lecturers'] as DataCollectionKey[],
				requiresSchedulePreview: true
			};
		}
		if (view === 'builder') {
			return {
				collections: ['courses', 'classrooms', 'lecturers', 'enrollments'] as DataCollectionKey[],
				requiresSchedulePreview: true
			};
		}
		if (view === 'classrooms') {
			return {
				collections: ['classrooms'] as DataCollectionKey[],
				requiresSchedulePreview: false
			};
		}
		if (view === 'courses') {
			return {
				collections: ['courses', 'studyPrograms', 'lecturers'] as DataCollectionKey[],
				requiresSchedulePreview: false
			};
		}
		if (view === 'students') {
			return {
				collections: ['students', 'studyPrograms'] as DataCollectionKey[],
				requiresSchedulePreview: false
			};
		}
		if (view === 'lecturers') {
			return {
				collections: ['lecturers'] as DataCollectionKey[],
				requiresSchedulePreview: false
			};
		}
		if (view === 'faculties') {
			return {
				collections: ['faculties'] as DataCollectionKey[],
				requiresSchedulePreview: false
			};
		}
		if (view === 'studyPrograms') {
			return {
				collections: ['studyPrograms', 'faculties'] as DataCollectionKey[],
				requiresSchedulePreview: false
			};
		}
		if (view === 'enrollments') {
			return {
				collections: ['enrollments', 'courses', 'classrooms', 'lecturers'] as DataCollectionKey[],
				requiresSchedulePreview: false
			};
		}
		if (view === 'grades') {
			return {
				collections: ['grades', 'enrollments', 'courses'] as DataCollectionKey[],
				requiresSchedulePreview: false
			};
		}
		return {
			collections: ['users'] as DataCollectionKey[],
			requiresSchedulePreview: false
		};
	}

	async function ensureViewData(view: ViewId, force = false) {
		const role = currentUser.current?.role as AppRole | undefined;
		const plan = viewDataPlan(view, role);
		const tasks: Promise<unknown>[] = [];
		const shouldBlockUi = !initialViewHydrated;

		if (plan.requiresSchedulePreview && (force || !schedulePreviewLoaded)) {
			tasks.push(
				refreshSchedulePreview().catch((error) => {
					setCollectionIssue('enrollments', errorMessage(error, 'Pratinjau jadwal gagal dimuat.'));
				})
			);
		}

		if (view === 'dashboard' && role !== 'STUDENT' && (force || !classRoomDashboardLoaded)) {
			tasks.push(
				refreshClassRoomDashboard().catch((error) => {
					setCollectionIssue('classrooms', errorMessage(error, 'Dashboard ruang gagal dimuat.'));
				})
			);
		}

		for (const key of plan.collections) {
			if (!force && collectionLoaded[key]) continue;
			tasks.push(
				loadCollection(key, () => collectionRefresher(key)(null), collectionFallbackMessage(key))
			);
		}

		if (!tasks.length) return;
		if (shouldBlockUi) {
			appLoading = true;
		}
		await Promise.all(tasks);
		if (shouldBlockUi) {
			initialViewHydrated = true;
			appLoading = false;
		}
	}

	async function refreshCollectionData(key: DataCollectionKey, force = false) {
		if (!force && !collectionLoaded[key]) return;
		await loadCollection(key, () => collectionRefresher(key)(), collectionFallbackMessage(key));
	}

	async function refreshSchedulePreviewData(force = false) {
		if (!force && !schedulePreviewLoaded) return;
		try {
			await refreshSchedulePreview();
			clearCollectionIssue('enrollments');
		} catch (error) {
			setCollectionIssue('enrollments', errorMessage(error, 'Pratinjau jadwal gagal dimuat.'));
			throw error;
		}
	}

	async function refreshDependencies({
		collections = [],
		includeSchedulePreview = false,
		includeConflictAudit = false,
		forceCollections = false
	}: RefreshDependencies) {
		const tasks: Promise<unknown>[] = [];
		for (const key of new Set(collections)) {
			tasks.push(refreshCollectionData(key, forceCollections));
		}
		if (includeSchedulePreview) {
			tasks.push(refreshSchedulePreviewData(forceCollections));
		}
		await Promise.all(tasks);
		if (includeConflictAudit) {
			await refreshConflictAudit();
		}
	}

	async function refreshViewData(view: ViewId) {
		const role = currentUser.current?.role as AppRole | undefined;
		const plan = viewDataPlan(view, role);
		await refreshDependencies({
			collections: plan.collections,
			includeSchedulePreview: plan.requiresSchedulePreview,
			includeConflictAudit: true,
			forceCollections: true
		});
		if (view === 'dashboard' && role !== 'STUDENT') {
			await refreshClassRoomDashboard(null, {
				history: [],
				pageNumber: 1,
				refreshSummary: true
			});
		}
	}

	function collectionRefresher(key: DataCollectionKey) {
		const refreshers: Record<DataCollectionKey, (cursor?: string | null) => Promise<void>> = {
			classrooms: refreshClassrooms,
			courses: refreshCourses,
			students: refreshStudents,
			lecturers: refreshLecturers,
			faculties: refreshFaculties,
			studyPrograms: refreshStudyPrograms,
			enrollments: refreshEnrollments,
			grades: refreshGrades,
			users: refreshUsers
		};

		return refreshers[key];
	}

	function requestCollectionPage(key: DataCollectionKey, cursor: string | null) {
		if (key === 'classrooms') return requestClassroomsPage(cursor);
		if (key === 'courses') return requestCoursesPage(cursor);
		if (key === 'students') return requestStudentsPage(cursor);
		if (key === 'lecturers') return requestLecturersPage(cursor);
		if (key === 'faculties') return requestFacultiesPage(cursor);
		if (key === 'studyPrograms') return requestStudyProgramsPage(cursor);
		if (key === 'enrollments') return requestEnrollmentsPage(cursor);
		if (key === 'grades') return requestGradesPage(cursor);
		return requestUsersPage(cursor);
	}

	function assignCollectionItems(key: DataCollectionKey, items: unknown[]) {
		if (key === 'classrooms') classrooms = items as SelectClassRoomsResult[];
		if (key === 'courses') courses = items as SelectCoursesResult[];
		if (key === 'students') students = items as SelectStudentsResult[];
		if (key === 'lecturers') lecturers = items as SelectLecturersResult[];
		if (key === 'faculties') faculties = items as SelectFacultiesResult[];
		if (key === 'studyPrograms') studyPrograms = items as SelectStudyProgramsResult[];
		if (key === 'enrollments') enrollments = items as SelectEnrollmentsResult[];
		if (key === 'grades') grades = items as SelectGradesResult[];
		if (key === 'users') users = items as SelectUsersResult[];
	}

	function queueCollectionRefresh(key: DataCollectionKey, delay = 220) {
		if (!browser || !loadedForUserId) return;
		const existingTimer = collectionRefreshTimers[key];
		if (existingTimer != null) {
			window.clearTimeout(existingTimer);
		}
		collectionRefreshTimers[key] = window.setTimeout(() => {
			delete collectionRefreshTimers[key];
			if (key === 'enrollments' && ['dashboard', 'calendar', 'builder'].includes(activeView)) {
				void refreshSchedulePreview().catch((error) => {
					setCollectionIssue('enrollments', errorMessage(error, 'Pratinjau jadwal gagal dimuat.'));
				});
			}
			void loadCollection(
				key,
				() => collectionRefresher(key)(null),
				collectionFallbackMessage(key)
			);
		}, delay);
	}

	async function changeCollectionPage(key: DataCollectionKey, direction: 'previous' | 'next') {
		const pageState = collectionPagination[key];
		if (direction === 'next') {
			if (!pageState.nextCursor) return;
			const nextHistory = [...pageState.history, pageState.currentCursor];
			await loadCollection(
				key,
				() =>
					loadCollectionPage(
						key,
						pageState.nextCursor,
						(cursor) => requestCollectionPage(key, cursor),
						(items) => assignCollectionItems(key, items as unknown[]),
						{ history: nextHistory, pageNumber: pageState.pageNumber + 1 }
					),
				collectionFallbackMessage(key)
			);
			return;
		}

		if (!pageState.history.length) return;
		const nextHistory = [...pageState.history];
		const previousCursor = nextHistory.pop() ?? null;

		await loadCollection(
			key,
			() =>
				loadCollectionPage(
					key,
					previousCursor,
					(cursor) => requestCollectionPage(key, cursor),
					(items) => assignCollectionItems(key, items as unknown[]),
					{ history: nextHistory, pageNumber: Math.max(1, pageState.pageNumber - 1) }
				),
			collectionFallbackMessage(key)
		);
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
		const view = activeView;
		const userId = currentUser.current?.id ?? null;
		if (!userId || !viewRestored || loadedForUserId !== userId) return;
		void untrack(() => ensureViewData(view));
	});

	$effect(() => {
		const userId = currentUser.current?.id ?? null;
		const view = activeView;
		if (!userId || !['dashboard', 'calendar', 'builder'].includes(view)) return;
		if (!schedulePreviewLoaded || schedulePreview.loading) return;
		const _deps = [
			scheduleAcademicYearFilter,
			scheduleSemesterFilter,
			scheduleDayFilter,
			scheduleCourseFilter,
			scheduleRoomFilter,
			scheduleLecturerFilter,
			schedulePreview.items.length
		];
		void _deps;
		queueConflictAuditRefresh();
	});

	$effect(() => {
		if (!browser || activeView !== 'calendar') return;
		void ensureCalendarLoaded();
	});

	$effect(() => {
		if (!selectedConflictGroupId) return;
		if (calendarConflictLegend.some((group) => group.id === selectedConflictGroupId)) return;
		selectedConflictGroupId = null;
	});

	$effect(() => {
		if (!browser) return;
		document.body.style.overflow = mobileRailOpen ? 'hidden' : '';
		return () => {
			document.body.style.overflow = '';
		};
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
		if (loadedForUserId) {
			resetCollections();
		}
		loadedForUserId = userId;
	});

	const blocksViewRendering = $derived(appLoading && !initialViewHydrated);

	const localScheduleCards = $derived(buildScheduleCards(schedulePreview.items, timezone));
	const conflictAuditGroupsById = $derived.by(() => {
		const groups: Record<
			string,
			{
				count: number;
				courses: string;
				lecturers: string;
				rooms: string;
				students: string;
				tone: number;
			}
		> = {};
		for (const [index, group] of (conflictAudit?.groups ?? []).entries()) {
			groups[`audit-conflict-${index + 1}`] = {
				count: group.memberCount,
				courses: summarizeDistinctValues(group.members.map((item) => item.courseName)),
				lecturers: summarizeDistinctValues(group.members.map((item) => item.lecturerName)),
				rooms: summarizeDistinctValues(group.members.map((item) => item.classRoomName)),
				students: summarizeDistinctValues(group.members.map((item) => item.studentName)),
				tone: index
			};
		}
		return groups;
	});
	const conflictAuditMembershipByEnrollmentId = $derived.by(() => {
		const membership: Record<string, { groupId: string; tone: number }> = {};
		for (const [index, group] of (conflictAudit?.groups ?? []).entries()) {
			const groupId = `audit-conflict-${index + 1}`;
			for (const member of group.members) {
				membership[member.enrollmentId] = { groupId, tone: index };
			}
		}
		return membership;
	});
	const auditConflictCardMap = $derived.by(() => {
		const cards: Record<string, ScheduleCard> = {};
		for (const [index, group] of (conflictAudit?.groups ?? []).entries()) {
			const groupId = `audit-conflict-${index + 1}`;
			for (const member of group.members) {
				cards[member.enrollmentId] = scheduleCardFromConflictMember(member, groupId, index);
			}
		}
		return cards;
	});
	const auditConflictGroups = $derived.by(() =>
		(conflictAudit?.groups ?? [])
			.map((group, index) => {
				const groupId = `audit-conflict-${index + 1}`;
				const representative = group.members[0];
				return {
					id: groupId,
					tone: index,
					representative: representative
						? scheduleCardFromConflictMember(representative, groupId, index)
						: null,
					details: conflictAuditGroupsById[groupId] ?? null,
					count: group.memberCount,
					selected: selectedConflictGroupId === groupId,
					label: representative
						? `${DAY_LABELS[representative.day]} ${formatDateTime(representative.startTime, 'time', timezone)}`
						: groupId,
					course: representative?.courseName ?? '-'
				};
			})
			.filter((group): group is NonNullable<typeof group> & { representative: ScheduleCard } =>
				Boolean(group.representative)
			)
	);
	const scheduleCards = $derived.by(() => {
		const membership = conflictAuditMembershipByEnrollmentId;
		if (!Object.keys(membership).length) {
			return localScheduleCards;
		}
		return localScheduleCards.map((card) => {
			const match = membership[card.id];
			return {
				...card,
				hasConflict: Boolean(match),
				conflictGroupId: match?.groupId ?? null,
				conflictTone: match?.tone ?? null
			};
		});
	});
	const scheduleAnalyticsCards = $derived(schedulePreview.hasMore ? [] : scheduleCards);
	const filteredScheduleCards = $derived(
		scheduleCards.filter(
			(card) => scheduleFiltersMatch(card.original) && scheduleSearchMatches(card.original)
		)
	);
	const calendarAnchorDate = $derived(createCalendarAnchorDate(calendarWeekOffset));
	const calendarWeekLabel = $derived.by(() => {
		const start = calendarAnchorDate.getTime();
		const end = start + 5 * 24 * 60 * 60 * 1000;
		const formatter = new Intl.DateTimeFormat('id-ID', {
			day: 'numeric',
			month: 'long'
		});
		return `${formatter.format(start)} - ${formatter.format(end)}`;
	});
	const calendarVisibleRange = $derived.by(() => {
		if (!filteredScheduleCards.length) {
			return { start: DEFAULT_DAY_START, end: DEFAULT_DAY_END };
		}

		const start = DEFAULT_DAY_START;
		let end = roundUpHour(
			Math.min(
				Math.max(...filteredScheduleCards.map((card) => card.endMinutes)) + RANGE_PADDING_MINUTES,
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
			DAY_ORDER.map((day) => [day, filteredScheduleCards.filter((card) => card.day === day).length])
		)
	);
	const calendarEvents = $derived.by(() =>
		filteredScheduleCards.map((card) => ({
			id: card.id,
			title: card.course,
			start: dateForScheduleCard(card, card.startMinutes),
			end: dateForScheduleCard(card, card.endMinutes),
			extendedProps: { card }
		}))
	);
	const calendarConflictLegend = $derived(auditConflictGroups);
	const effectiveSelectedScheduleId = $derived.by(() => {
		if (
			selectedScheduleId &&
			filteredScheduleCards.some((item) => item.id === selectedScheduleId)
		) {
			return selectedScheduleId;
		}

		return filteredScheduleCards[0]?.id ?? null;
	});
	const calendarOptions = $derived.by(() => ({
		view: 'timeGridWeek',
		date: calendarAnchorDate,
		locale: 'id-ID',
		firstDay: 1,
		hiddenDays: [0],
		height: 'auto',
		allDaySlot: false,
		nowIndicator: true,
		customScrollbars: true,
		slotDuration: '00:30:00',
		slotLabelInterval: '01:00:00',
		slotHeight: 34,
		slotMinTime: timeString(calendarVisibleRange.start),
		slotMaxTime: timeString(calendarVisibleRange.end),
		scrollTime: timeString(calendarVisibleRange.start),
		slotEventOverlap: false,
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
			if (selectedConflictGroupId) {
				if (card?.conflictGroupId === selectedConflictGroupId) {
					classes.push('is-conflict-focus');
				} else {
					classes.push('is-dimmed');
				}
			}
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
			focusSchedule(card);
		}
	}));
	const selectedSchedule = $derived(
		filteredScheduleCards.find((item) => item.id === effectiveSelectedScheduleId) ??
			auditConflictCardMap[effectiveSelectedScheduleId ?? ''] ??
			null
	);
	const calendarDetailSchedule = $derived.by(() => {
		if (calendarCanRender) {
			return selectedSchedule;
		}

		return selectedConflictGroupId && selectedSchedule?.hasConflict ? selectedSchedule : null;
	});
	const selectedRoom = $derived(
		classrooms.find((item) => item.id === selectedRoomId) ?? selectedRoomRecord ?? null
	);
	const selectedCourse = $derived(
		courses.find((item) => item.id === selectedCourseId) ?? selectedCourseRecord ?? null
	);
	const selectedStudent = $derived(
		students.find((item) => item.id === selectedStudentId) ?? selectedStudentRecord ?? null
	);
	const selectedLecturer = $derived(
		lecturers.find((item) => item.id === selectedLecturerId) ?? selectedLecturerRecord ?? null
	);
	const selectedFaculty = $derived(
		faculties.find((item) => item.id === selectedFacultyId) ?? selectedFacultyRecord ?? null
	);
	const selectedStudyProgram = $derived(
		studyPrograms.find((item) => item.id === selectedStudyProgramId) ??
			selectedStudyProgramRecord ??
			null
	);
	const selectedEnrollment = $derived(
		enrollments.find((item) => item.id === selectedEnrollmentId) ??
			schedulePreview.items.find((item) => item.id === selectedEnrollmentId) ??
			selectedEnrollmentRecord ??
			null
	);
	const selectedGrade = $derived(
		grades.find((item) => item.id === selectedGradeId) ?? selectedGradeRecord ?? null
	);
	const selectedUser = $derived(
		users.find((item) => item.id === selectedUserId) ?? selectedUserRecord ?? null
	);
	const conflictGroupCardsById = $derived.by(() => {
		const groups: Record<string, ScheduleCard[]> = {};
		for (const card of scheduleAnalyticsCards) {
			if (!card.hasConflict || !card.conflictGroupId) continue;
			const peers = groups[card.conflictGroupId] ?? [];
			peers.push(card);
			groups[card.conflictGroupId] = peers;
		}

		return groups;
	});
	const conflictGroupDetailsById = $derived.by(() =>
		Object.fromEntries(
			Object.entries(conflictAuditGroupsById).map(([groupId, group]) => [
				groupId,
				{
					count: group.count,
					courses: group.courses,
					lecturers: group.lecturers,
					rooms: group.rooms,
					students: group.students
				}
			])
		)
	);
	const primaryConflict = $derived(auditConflictGroups[0]?.representative ?? null);
	const conflictCount = $derived(auditConflictGroups.length);
	const additionalConflictCount = $derived(Math.max(conflictCount - 1, 0));
	const auditConflictPeersByCardId = $derived.by(() => {
		const peers: Record<string, ScheduleCard[]> = {};
		for (const group of auditConflictGroups) {
			const details = conflictAudit?.groups?.find(
				(_item, index) => `audit-conflict-${index + 1}` === group.id
			);
			if (!details) continue;
			const memberCards = details.members.map((member, index) =>
				scheduleCardFromConflictMember(member, group.id, group.representative.conflictTone ?? index)
			);
			for (const card of memberCards) {
				peers[card.id] = memberCards.filter((peer) => peer.id !== card.id);
			}
		}
		return peers;
	});
	const conflictPeersByCardId = $derived.by(() => {
		if (Object.keys(auditConflictPeersByCardId).length) {
			return auditConflictPeersByCardId;
		}
		const byCardId: Record<string, ScheduleCard[]> = {};
		for (const group of Object.values(conflictGroupCardsById)) {
			for (const card of group) {
				byCardId[card.id] = group.filter((peer) => peer.id !== card.id);
			}
		}

		return byCardId;
	});
	const conflictSummaryByCardId = $derived.by(() => {
		const summaries: Record<string, string> = {};
		for (const [id, peers] of Object.entries(conflictPeersByCardId)) {
			if (!peers.length) continue;
			const card = scheduleCardMap[id] ?? auditConflictCardMap[id];
			const details = card?.conflictGroupId ? conflictGroupDetailsById[card.conflictGroupId] : null;
			if (details) {
				summaries[id] =
					`${details.count} jadwal • ruang: ${details.rooms} • dosen: ${details.lecturers}`;
				continue;
			}

			const listedPeers = peers.slice(0, 2).map(conflictPeerLabel);
			const remaining = peers.length - listedPeers.length;
			const summary =
				remaining > 0
					? `${listedPeers.join('; ')}; dan ${remaining} jadwal lain`
					: listedPeers.join('; ');
			summaries[id] = summary;
		}
		return summaries;
	});
	const builderConflictCards = $derived(auditConflictGroups);
	const overlapPeersByCardId = $derived.by(() => {
		const peers: Record<string, ScheduleCard[]> = {};
		for (const card of scheduleAnalyticsCards) {
			peers[card.id] = scheduleAnalyticsCards
				.filter((candidate) => schedulesOverlap(card, candidate))
				.sort((left, right) => left.startMinutes - right.startMinutes);
		}
		return peers;
	});
	const nextSchedule = $derived(scheduleAnalyticsCards[0] ?? null);
	const underusedRooms = $derived.by(() => {
		const occupiedRoomIds = new Set(
			scheduleAnalyticsCards.map((card) => card.original.class_room_id).filter(Boolean)
		);
		return classrooms.filter((item) => !item.id || !occupiedRoomIds.has(item.id)).length;
	});
	const studentGradeHighlights = $derived(grades.slice(0, 3));

	const filteredClassrooms = $derived(classrooms);
	const filteredCourses = $derived(courses);
	const filteredStudents = $derived(students);
	const filteredLecturers = $derived(lecturers);
	const filteredFaculties = $derived(faculties);
	const filteredStudyPrograms = $derived(studyPrograms);
	const filteredEnrollments = $derived(enrollments);
	const filteredBuilderEnrollments = $derived(
		filteredEnrollments.filter((item) => {
			if (!builderConflictOnly) return true;
			return Boolean(
				item.id && (scheduleCardMap[item.id] ?? auditConflictCardMap[item.id])?.hasConflict
			);
		})
	);
	const scheduleFilterSource = $derived(
		activeView === 'enrollments' ? enrollments : schedulePreview.items
	);
	const scheduleSemesterOptions = $derived.by(() =>
		Array.from(
			new Set(scheduleFilterSource.map((item) => item.semester).filter(Boolean) as string[])
		).sort((left, right) => left.localeCompare(right))
	);
	const scheduleAcademicYearOptions = $derived.by(() =>
		Array.from(
			new Set(scheduleFilterSource.map((item) => item.academic_year).filter(Boolean) as string[])
		).sort((left, right) => right.localeCompare(left))
	);
	const scheduleActiveFilterCount = $derived(
		[
			enrollmentSearch,
			scheduleCourseFilter,
			scheduleRoomFilter,
			scheduleLecturerFilter,
			scheduleDayFilter,
			scheduleSemesterFilter,
			scheduleAcademicYearFilter
		].filter(Boolean).length
	);
	const schedulePreviewNotice = $derived.by(() => {
		if (!schedulePreview.hasMore) return null;
		if (scheduleActiveFilterCount > 0) {
			return 'Hasil jadwal masih terlalu besar. Persempit filter agar kalender dan analitik menampilkan data yang lengkap.';
		}
		return 'Data jadwal terlalu besar untuk dimuat penuh. Gunakan pencarian atau filter agar dashboard, kalender, dan penjadwalan menampilkan hasil yang akurat.';
	});
	const calendarNeedsFilters = $derived(scheduleActiveFilterCount === 0);
	const calendarExceedsVisibleLimit = $derived(
		scheduleActiveFilterCount > 0 && filteredScheduleCards.length > CALENDAR_MAX_VISIBLE_SCHEDULES
	);
	const calendarCanRender = $derived(
		!calendarNeedsFilters && !calendarExceedsVisibleLimit && filteredScheduleCards.length > 0
	);
	const studentPickerLookup = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const lookup = new Map<string, SelectStudentsResult>();
		for (const item of students) {
			if (item.id) lookup.set(item.id, item);
		}
		for (const item of studentPickerOptions) {
			if (item.id) lookup.set(item.id, item);
		}
		return lookup;
	});
	const coursePickerLookup = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const lookup = new Map<string, SelectCoursesResult>();
		for (const item of courses) {
			if (item.id) lookup.set(item.id, item);
		}
		for (const item of coursePickerOptions) {
			if (item.id) lookup.set(item.id, item);
		}
		return lookup;
	});
	const roomPickerLookup = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const lookup = new Map<string, SelectClassRoomsResult>();
		for (const item of classrooms) {
			if (item.id) lookup.set(item.id, item);
		}
		for (const item of roomPickerOptions) {
			if (item.id) lookup.set(item.id, item);
		}
		for (const item of scheduleRoomFilterOptions) {
			if (item.id) lookup.set(item.id, item);
		}
		return lookup;
	});
	const scheduleCourseFilterLookup = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const lookup = new Map<string, SelectCoursesResult>();
		for (const item of courses) {
			if (item.id) lookup.set(item.id, item);
		}
		for (const item of scheduleCourseFilterOptions) {
			if (item.id) lookup.set(item.id, item);
		}
		return lookup;
	});
	const scheduleLecturerFilterLookup = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const lookup = new Map<string, SelectLecturersResult>();
		for (const item of lecturers) {
			if (item.id) lookup.set(item.id, item);
		}
		for (const item of scheduleLecturerFilterOptions) {
			if (item.id) lookup.set(item.id, item);
		}
		return lookup;
	});
	const filteredStudentsForPicker = $derived(studentPickerOptions);
	const filteredCoursesForPicker = $derived(coursePickerOptions);
	const filteredGrades = $derived(grades);
	const filteredUsers = $derived(users);

	const availableRoomOptions = $derived.by(() => {
		const roomOptions = roomPickerOptions;
		if (!enrollmentDraft.startTime || !enrollmentDraft.endTime) return roomOptions;
		const startMinutes = toMinutes(parseISO(enrollmentDraft.startTime, timezone), timezone);
		const endMinutes = toMinutes(parseISO(enrollmentDraft.endTime, timezone), timezone);
		const availableRooms = availableRoomsForSlot(
			roomOptions,
			scheduleCards,
			enrollmentDraft.day,
			startMinutes,
			endMinutes,
			selectedEnrollmentId
		);
		if (!selectedEnrollmentId || !enrollmentDraft.classRoomId) return availableRooms;

		const availableRoomIds = new Set(availableRooms.map((room) => room.id));
		return roomOptions.filter(
			(room) => room.id === enrollmentDraft.classRoomId || availableRoomIds.has(room.id)
		);
	});
	const filteredRoomsForPicker = $derived(availableRoomOptions);
	const filteredScheduleRoomFilterOptions = $derived(scheduleRoomFilterOptions);
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
		studentPickerLookup.get(enrollmentDraft.studentId)?.name ??
			selectedStudentRecord?.name ??
			selectedEnrollmentRecord?.student_name ??
			'Belum dipilih'
	);
	const selectedDraftCourse = $derived(
		coursePickerLookup.get(enrollmentDraft.courseId)?.name ??
			selectedCourseRecord?.name ??
			selectedEnrollmentRecord?.course_name ??
			'Belum dipilih'
	);
	const selectedDraftRoom = $derived(
		roomPickerLookup.get(enrollmentDraft.classRoomId)?.name ??
			selectedRoomRecord?.name ??
			selectedEnrollmentRecord?.class_room_name ??
			'Belum dipilih'
	);
	const selectedScheduleCourseFilterLabel = $derived(
		scheduleCourseFilterLookup.get(scheduleCourseFilter)?.name ?? 'Semua mata kuliah'
	);
	const selectedScheduleRoomFilterLabel = $derived(
		roomPickerLookup.get(scheduleRoomFilter)?.name ?? 'Semua ruang'
	);
	const selectedScheduleLecturerFilterLabel = $derived(
		scheduleLecturerFilterLookup.get(scheduleLecturerFilter)?.name ?? 'Semua dosen'
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

	function pickClassroom(item: SelectClassRoomsResult) {
		pendingDelete = null;
		stopEditing();
		selectedRoomId = item.id ?? null;
		selectedRoomRecord = item;
		classroomDraft = {
			name: item.name ?? '',
			classRoomType: item.class_room_type ?? 'REGULER',
			capacity: item.capacity ?? 30,
			hasProjector: Boolean(item.has_projector),
			hasAC: Boolean(item.has_ac)
		};
		if (item.id) {
			void getClassRoom(item.id)
				.run()
				.then((full) => {
					if (selectedRoomId !== item.id) return;
					selectedRoomRecord = full;
					classroomDraft = {
						name: full.name ?? '',
						classRoomType: full.class_room_type ?? 'REGULER',
						capacity: full.capacity ?? 30,
						hasProjector: Boolean(full.has_projector),
						hasAC: Boolean(full.has_ac)
					};
				});
		}
	}

	function pickCourse(item: SelectCoursesResult) {
		pendingDelete = null;
		stopEditing();
		selectedCourseId = item.id ?? null;
		selectedCourseRecord = item;
		courseDraft = {
			id: item.id ?? '',
			name: item.name ?? '',
			credits: item.credits ?? 3,
			studyProgramId: item.study_program_id ?? '',
			lecturerId: item.lecturer_id ?? ''
		};
		if (item.id) {
			void getCourse(item.id)
				.run()
				.then((full) => {
					if (selectedCourseId !== item.id) return;
					selectedCourseRecord = full;
				});
		}
	}

	function pickStudent(item: SelectStudentsResult) {
		pendingDelete = null;
		stopEditing();
		selectedStudentId = item.id ?? null;
		selectedStudentRecord = item;
		studentDraft = {
			name: item.name ?? '',
			email: item.email ?? '',
			phone: item.phone ?? '',
			address: item.address ?? '',
			yearAdmitted: item.year_admitted ?? 2024,
			studyProgramId: item.study_program_id ?? ''
		};
		if (item.id) {
			void getStudent(item.id)
				.run()
				.then((full) => {
					if (selectedStudentId !== item.id) return;
					selectedStudentRecord = full;
					studentDraft = {
						name: full.name ?? '',
						email: full.email ?? '',
						phone: full.phone ?? '',
						address: full.address ?? '',
						yearAdmitted: full.year_admitted ?? 2024,
						studyProgramId: full.study_program_id ?? ''
					};
				});
		}
	}

	function pickLecturer(item: SelectLecturersResult) {
		pendingDelete = null;
		stopEditing();
		selectedLecturerId = item.id ?? null;
		selectedLecturerRecord = item;
		lecturerDraft = {
			id: item.id ?? '',
			name: item.name ?? '',
			email: item.email ?? '',
			phone: item.phone ?? '',
			address: item.address ?? ''
		};
		if (item.id) {
			void getLecturer(item.id)
				.run()
				.then((full) => {
					if (selectedLecturerId !== item.id) return;
					selectedLecturerRecord = full;
					lecturerDraft = {
						id: full.id ?? '',
						name: full.name ?? '',
						email: full.email ?? '',
						phone: full.phone ?? '',
						address: full.address ?? ''
					};
				});
		}
	}

	function pickFaculty(item: SelectFacultiesResult) {
		pendingDelete = null;
		stopEditing();
		selectedFacultyId = item.id ?? null;
		selectedFacultyRecord = item;
		facultyDraft = { id: item.id ?? '', name: item.name ?? '' };
		if (item.id) {
			void getFaculty(item.id)
				.run()
				.then((full) => {
					if (selectedFacultyId !== item.id) return;
					selectedFacultyRecord = full;
				});
		}
	}

	function pickStudyProgram(item: SelectStudyProgramsResult) {
		pendingDelete = null;
		stopEditing();
		selectedStudyProgramId = item.id ?? null;
		selectedStudyProgramRecord = item;
		studyProgramDraft = {
			id: item.id ?? '',
			name: item.name ?? '',
			head: item.head ?? '',
			facultyId: item.faculty_id ?? ''
		};
		if (item.id) {
			void getStudyProgram(item.id)
				.run()
				.then((full) => {
					if (selectedStudyProgramId !== item.id) return;
					selectedStudyProgramRecord = full;
					studyProgramDraft = {
						id: full.id ?? '',
						name: full.name ?? '',
						head: full.head ?? '',
						facultyId: full.faculty_id ?? ''
					};
				});
		}
	}

	function pickEnrollment(item: SelectEnrollmentsResult) {
		pendingDelete = null;
		selectedEnrollmentId = item.id ?? null;
		selectedEnrollmentRecord = item;
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
		const pickedStudent = item.student_id ? studentPickerLookup.get(item.student_id) : undefined;
		const pickedCourse = item.course_id ? coursePickerLookup.get(item.course_id) : undefined;
		studentPickerSearch = pickedStudent
			? `${pickedStudent.name} • ${pickedStudent.id}`
			: item.student_name
				? `${item.student_name} • ${item.student_id}`
				: '';
		coursePickerSearch = pickedCourse
			? `${pickedCourse.name} • ${pickedCourse.lecturer_name}`
			: item.course_name
				? `${item.course_name} • ${item.lecturer_name ?? ''}`
				: '';
		roomPickerSearch = '';
		studentPickerOpen = false;
		coursePickerOpen = false;
		roomPickerOpen = false;
	}

	async function findEnrollmentSelection(id: string) {
		const localMatch =
			enrollments.find((item) => item.id === id) ??
			schedulePreview.items.find((item) => item.id === id) ??
			null;
		if (localMatch) return localMatch;

		try {
			const result = await resolveRemoteQuery(searchEnrollments({ id, preview: true }));
			return result.items.find((item) => item.id === id) ?? null;
		} catch {
			return null;
		}
	}

	async function syncBuilderSelection(preferredId = selectedEnrollmentId, fallbackToFirst = false) {
		if (preferredId) {
			const exactMatch = await findEnrollmentSelection(preferredId);
			if (exactMatch) {
				pickEnrollment(exactMatch);
				return;
			}
		}

		if (fallbackToFirst) {
			const fallback =
				enrollments.find((item) => item.id && item.id !== preferredId) ??
				schedulePreview.items.find((item) => item.id && item.id !== preferredId) ??
				null;
			if (fallback) {
				pickEnrollment(fallback);
				return;
			}
		}

		clearSelection('builder');
	}

	function pickGrade(item: SelectGradesResult) {
		pendingDelete = null;
		stopEditing();
		selectedGradeId = item.id ?? null;
		selectedGradeRecord = item;
		gradeDraft = {
			id: item.id ?? '',
			enrollmentId: item.enrollment_id ?? '',
			assignmentScore: item.assignment_score ?? 80,
			midtermScore: item.midterm_score ?? 80,
			finalScore: item.final_score ?? 80
		};
	}

	function pickUser(item: SelectUsersResult) {
		pendingDelete = null;
		stopEditing();
		selectedUserId = item.id ?? null;
		selectedUserRecord = item;
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
			selectedRoomRecord = null;
			classroomDraft = emptyClassRoomDraft();
		}
		if (view === 'courses') {
			selectedCourseId = null;
			selectedCourseRecord = null;
			courseDraft = emptyCourseDraft();
		}
		if (view === 'students') {
			selectedStudentId = null;
			selectedStudentRecord = null;
			studentDraft = emptyStudentDraft();
		}
		if (view === 'lecturers') {
			selectedLecturerId = null;
			selectedLecturerRecord = null;
			lecturerDraft = emptyLecturerDraft();
		}
		if (view === 'faculties') {
			selectedFacultyId = null;
			selectedFacultyRecord = null;
			facultyDraft = emptyFacultyDraft();
		}
		if (view === 'studyPrograms') {
			selectedStudyProgramId = null;
			selectedStudyProgramRecord = null;
			studyProgramDraft = emptyStudyProgramDraft();
		}
		if (view === 'enrollments' || view === 'builder') {
			selectedEnrollmentId = null;
			selectedEnrollmentRecord = null;
			enrollmentDraft = emptyEnrollmentDraft();
			builderStep = 'participant';
			studentPickerSearch = '';
			coursePickerSearch = '';
			roomPickerSearch = '';
			studentPickerOpen = false;
			coursePickerOpen = false;
			roomPickerOpen = false;
			studentPickerOptions = [];
			coursePickerOptions = [];
			studentPickerHasMore = false;
			coursePickerHasMore = false;
			studentPickerNextCursor = null;
			coursePickerNextCursor = null;
			studentPickerIssue = null;
			coursePickerIssue = null;
		}
		if (view === 'grades') {
			selectedGradeId = null;
			selectedGradeRecord = null;
			gradeDraft = emptyGradeDraft();
			gradeLetterFilter = '';
			gradeCourseFilter = '';
		}
		if (view === 'users') {
			selectedUserId = null;
			selectedUserRecord = null;
			userDraft = emptyUserDraft();
		}
	}

	async function ensureGradeEditorData() {
		if (currentUser.current?.role === 'STUDENT') return;
		if (collectionLoaded.enrollments || collectionPagination.enrollments.loading) return;
		await loadCollection(
			'enrollments',
			() => refreshEnrollments(null),
			collectionFallbackMessage('enrollments')
		);
	}

	function beginCreate(view: EditableView) {
		clearSelection(view);
		pendingDelete = null;
		editorView = view;
		if (view === 'grades') {
			void ensureGradeEditorData();
		}
	}

	function beginEdit(view: EditableView) {
		pendingDelete = null;
		editorView = view;
		if (view === 'grades') {
			void ensureGradeEditorData();
		}
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

	function createEnhancer(form: EnhancedForm, onSuccess: () => Promise<void> | void) {
		return form.enhance(async ({ submit }: { submit: () => Promise<boolean> }) => {
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

	const loginEnhance = loginUser.enhance(async ({ submit }: { submit: () => Promise<boolean> }) => {
		try {
			await submit();
			const issue = firstIssue(loginUser);
			if (issue) {
				setFeedback('danger', issue);
				return;
			}
			const accessToken = (loginUser.result as { accessToken?: string } | undefined)?.accessToken;
			setAccessToken(accessToken ?? null);
			await currentUser.refresh();
			setFeedback('success', 'Sesi berhasil dibuka.');
		} catch (error) {
			const message = (error as { body?: { message?: string }; message?: string })?.body?.message;
			setFeedback('danger', message || 'Masuk gagal.');
		}
	});

	const logoutEnhance = logoutUser.enhance(
		async ({ submit }: { submit: () => Promise<boolean> }) => {
			await submit();
			clearAccessToken();
			await currentUser.refresh();
			resetCollections();
			setFeedback('success', 'Sesi berhasil ditutup.');
		}
	);

	const createClassRoomEnhance = createEnhancer(createClassRoom, async () => {
		await refreshDependencies({
			collections: ['classrooms', 'enrollments'],
			includeSchedulePreview: true,
			includeConflictAudit: true
		});
		clearSelection('classrooms');
		stopEditing('classrooms');
		setFeedback('success', 'Ruang kelas baru berhasil ditambahkan.');
	});
	const updateClassRoomEnhance = createEnhancer(updateClassRoom, async () => {
		await refreshDependencies({
			collections: ['classrooms', 'enrollments'],
			includeSchedulePreview: true,
			includeConflictAudit: true
		});
		stopEditing('classrooms');
		setFeedback('success', 'Data ruang kelas berhasil diperbarui.');
	});
	const createCourseEnhance = createEnhancer(createCourse, async () => {
		await refreshDependencies({
			collections: ['courses', 'enrollments', 'grades'],
			includeSchedulePreview: true,
			includeConflictAudit: true
		});
		clearSelection('courses');
		stopEditing('courses');
		setFeedback('success', 'Mata kuliah baru berhasil ditambahkan.');
	});
	const updateCourseEnhance = createEnhancer(updateCourse, async () => {
		await refreshDependencies({
			collections: ['courses', 'enrollments', 'grades'],
			includeSchedulePreview: true,
			includeConflictAudit: true
		});
		stopEditing('courses');
		setFeedback('success', 'Mata kuliah berhasil diperbarui.');
	});
	const createStudentEnhance = createEnhancer(createStudent, async () => {
		await refreshDependencies({
			collections: ['students', 'enrollments', 'grades', 'users'],
			includeSchedulePreview: true,
			includeConflictAudit: true
		});
		clearSelection('students');
		stopEditing('students');
		setFeedback('success', 'Mahasiswa baru berhasil ditambahkan.');
	});
	const updateStudentEnhance = createEnhancer(updateStudent, async () => {
		await refreshDependencies({
			collections: ['students', 'enrollments', 'grades', 'users'],
			includeSchedulePreview: true,
			includeConflictAudit: true
		});
		stopEditing('students');
		setFeedback('success', 'Profil mahasiswa berhasil diperbarui.');
	});
	const createLecturerEnhance = createEnhancer(createLecturer, async () => {
		await refreshDependencies({
			collections: ['lecturers', 'courses', 'enrollments', 'users'],
			includeSchedulePreview: true,
			includeConflictAudit: true
		});
		clearSelection('lecturers');
		stopEditing('lecturers');
		setFeedback('success', 'Dosen baru berhasil ditambahkan.');
	});
	const updateLecturerEnhance = createEnhancer(updateLecturer, async () => {
		await refreshDependencies({
			collections: ['lecturers', 'courses', 'enrollments', 'users'],
			includeSchedulePreview: true,
			includeConflictAudit: true
		});
		stopEditing('lecturers');
		setFeedback('success', 'Profil dosen berhasil diperbarui.');
	});
	const createFacultyEnhance = createEnhancer(createFaculty, async () => {
		await refreshDependencies({
			collections: ['faculties', 'studyPrograms', 'students']
		});
		clearSelection('faculties');
		stopEditing('faculties');
		setFeedback('success', 'Fakultas baru berhasil ditambahkan.');
	});
	const updateFacultyEnhance = createEnhancer(updateFaculty, async () => {
		await refreshDependencies({
			collections: ['faculties', 'studyPrograms', 'students']
		});
		stopEditing('faculties');
		setFeedback('success', 'Data fakultas berhasil diperbarui.');
	});
	const createStudyProgramEnhance = createEnhancer(createStudyProgram, async () => {
		await refreshDependencies({
			collections: ['studyPrograms', 'students', 'courses', 'enrollments', 'grades'],
			includeSchedulePreview: true,
			includeConflictAudit: true
		});
		clearSelection('studyPrograms');
		stopEditing('studyPrograms');
		setFeedback('success', 'Program studi baru berhasil ditambahkan.');
	});
	const updateStudyProgramEnhance = createEnhancer(updateStudyProgram, async () => {
		await refreshDependencies({
			collections: ['studyPrograms', 'students', 'courses', 'enrollments', 'grades'],
			includeSchedulePreview: true,
			includeConflictAudit: true
		});
		stopEditing('studyPrograms');
		setFeedback('success', 'Program studi berhasil diperbarui.');
	});
	const createEnrollmentEnhance = createEnhancer(createEnrollment, async () => {
		const createdId = (createEnrollment.result as { id?: string } | undefined)?.id ?? null;
		await refreshDependencies({
			collections: ['enrollments', 'grades'],
			includeSchedulePreview: true,
			includeConflictAudit: true
		});
		await syncBuilderSelection(createdId, true);
		setFeedback(
			'success',
			'Jadwal dan KRS tersimpan. Lanjutkan hanya bila ruang dan jam sudah sesuai.'
		);
	});
	const updateEnrollmentEnhance = createEnhancer(updateEnrollment, async () => {
		await refreshDependencies({
			collections: ['enrollments', 'grades'],
			includeSchedulePreview: true,
			includeConflictAudit: true
		});
		await syncBuilderSelection();
		setFeedback(
			'success',
			'Jadwal diperbarui. Periksa kembali konflik dan kecocokan ruang sebelum menutup halaman.'
		);
	});
	const createGradeEnhance = createEnhancer(createGrade, async () => {
		await refreshDependencies({ collections: ['grades'] });
		clearSelection('grades');
		stopEditing('grades');
		setFeedback('success', 'Nilai baru berhasil disimpan.');
	});
	const updateGradeEnhance = createEnhancer(updateGrade, async () => {
		await refreshDependencies({ collections: ['grades'] });
		stopEditing('grades');
		setFeedback('success', 'Nilai berhasil diperbarui.');
	});
	const updateUserEnhance = createEnhancer(updateUser, async () => {
		await refreshDependencies({ collections: ['users'] });
		stopEditing('users');
		setFeedback('success', 'Akun diperbarui. Perubahan akses akan dipakai pada sesi berikutnya.');
	});

	async function removeEntity(kind: DeleteKind, id: string) {
		const intent = pendingDelete;
		try {
			if (kind === 'classroom') {
				await deleteClassRoom(id);
				await refreshDependencies({
					collections: ['classrooms', 'enrollments'],
					includeSchedulePreview: true,
					includeConflictAudit: true
				});
				clearSelection('classrooms');
				stopEditing('classrooms');
			}
			if (kind === 'course') {
				await deleteCourse(id);
				await refreshDependencies({
					collections: ['courses', 'enrollments', 'grades'],
					includeSchedulePreview: true,
					includeConflictAudit: true
				});
				clearSelection('courses');
				stopEditing('courses');
			}
			if (kind === 'student') {
				await deleteStudent(id);
				await refreshDependencies({
					collections: ['students', 'enrollments', 'grades', 'users'],
					includeSchedulePreview: true,
					includeConflictAudit: true
				});
				clearSelection('students');
				stopEditing('students');
			}
			if (kind === 'lecturer') {
				await deleteLecturer(id);
				await refreshDependencies({
					collections: ['lecturers', 'courses', 'enrollments', 'users'],
					includeSchedulePreview: true,
					includeConflictAudit: true
				});
				clearSelection('lecturers');
				stopEditing('lecturers');
			}
			if (kind === 'faculty') {
				await deleteFaculty(id);
				await refreshDependencies({
					collections: ['faculties', 'studyPrograms', 'students']
				});
				clearSelection('faculties');
				stopEditing('faculties');
			}
			if (kind === 'studyProgram') {
				await deleteStudyProgram(id);
				await refreshDependencies({
					collections: ['studyPrograms', 'students', 'courses', 'enrollments', 'grades'],
					includeSchedulePreview: true,
					includeConflictAudit: true
				});
				clearSelection('studyPrograms');
				stopEditing('studyPrograms');
			}
			if (kind === 'enrollment') {
				await deleteEnrollment(id);
				await refreshDependencies({
					collections: ['enrollments', 'grades'],
					includeSchedulePreview: true,
					includeConflictAudit: true
				});
				await syncBuilderSelection(id, true);
			}
			if (kind === 'grade') {
				await deleteGrade(id);
				await refreshDependencies({ collections: ['grades'] });
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

	async function handleRefreshCurrentView() {
		if (viewRefreshLoading) return;
		viewRefreshLoading = true;
		try {
			await refreshViewData(activeView);
			setFeedback('success', `${pageHeading(activeView)} berhasil dimuat ulang.`);
		} catch (error) {
			setFeedback(
				'danger',
				errorMessage(error, `${pageHeading(activeView)} belum bisa dimuat ulang.`)
			);
		} finally {
			viewRefreshLoading = false;
		}
	}

	const navigationGroups = $derived(
		navigationGroupsForRole(currentUser.current?.role as AppRole | undefined)
	);
	const currentHeaderAction = $derived(
		headerAction(activeView, currentUser.current?.role as AppRole | undefined)
	);
	const currentViewPlan = $derived(
		viewDataPlan(activeView, currentUser.current?.role as AppRole | undefined)
	);
	const activeViewIssues = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const keys = new Set<DataCollectionKey>(currentViewPlan.collections);
		if (currentViewPlan.requiresSchedulePreview) {
			keys.add('enrollments');
		}

		return Array.from(keys)
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
	const gradeEditorBlocked = $derived(
		(Boolean(collectionIssues.enrollments) && !enrollments.length) ||
			(collectionPagination.enrollments.loading && !enrollments.length)
	);
	const scheduleCardMap = $derived.by(
		() =>
			Object.fromEntries(scheduleAnalyticsCards.map((card) => [card.id, card])) as Record<
				string,
				ScheduleCard
			>
	);
	const selectedScheduleConflictSummary = $derived(
		selectedSchedule ? (conflictSummaryByCardId[selectedSchedule.id] ?? null) : null
	);
	const selectedScheduleConflictGroup = $derived(
		selectedSchedule?.conflictGroupId
			? (conflictGroupDetailsById[selectedSchedule.conflictGroupId] ?? null)
			: null
	);
	const selectedScheduleConflictPeers = $derived(
		selectedSchedule ? (conflictPeersByCardId[selectedSchedule.id] ?? []) : []
	);
	const selectedScheduleOverlapPeers = $derived(
		selectedSchedule ? (overlapPeersByCardId[selectedSchedule.id] ?? []) : []
	);
	const selectedEnrollmentScheduleCard = $derived(
		selectedEnrollmentId
			? (scheduleCardMap[selectedEnrollmentId] ??
					auditConflictCardMap[selectedEnrollmentId] ??
					null)
			: null
	);
	const selectedEnrollmentConflictSummary = $derived(
		selectedEnrollmentId ? (conflictSummaryByCardId[selectedEnrollmentId] ?? null) : null
	);
	const selectedEnrollmentConflictGroup = $derived(
		selectedEnrollmentScheduleCard?.conflictGroupId
			? (conflictGroupDetailsById[selectedEnrollmentScheduleCard.conflictGroupId] ?? null)
			: null
	);
</script>

<svelte:head>
	<title>Watum</title>
</svelte:head>

{#if currentUser.loading}{:else if currentUser.current}
	<div class="app-shell">
		{#if mobileRailOpen}
			<button
				type="button"
				class="rail-backdrop"
				aria-label="Tutup menu navigasi"
				onclick={() => (mobileRailOpen = false)}
			></button>
		{/if}

		<aside class:open={mobileRailOpen} class="rail">
			<div class="rail-brand">
				<h1>Watum</h1>
				<button
					type="button"
					class="rail-close"
					aria-label="Tutup menu navigasi"
					onclick={() => (mobileRailOpen = false)}
				>
					<X size={18} />
				</button>
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
					<button
						type="button"
						class="rail-toggle"
						aria-label="Buka menu navigasi"
						onclick={() => (mobileRailOpen = true)}
					>
						<Menu size={18} />
					</button>
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
						class="header-action"
						variant="outline"
						size="sm"
						onclick={handleRefreshCurrentView}
						disabled={viewRefreshLoading}
					>
						<RotateCw size={16} />
						<span>{viewRefreshLoading ? 'Memuat...' : 'Refresh'}</span>
					</Button>

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

			{#if blocksViewRendering}
				<div class="loading-panel">
					<div class="skeleton-rows">
						<div class="skeleton skeleton-title"></div>
						<div class="skeleton skeleton-text"></div>
						{#each Array.from({ length: 5 }, (_item, index) => index) as index (index)}
							<div class="skeleton skeleton-row"></div>
						{/each}
					</div>
				</div>
			{/if}

			{#if !blocksViewRendering && activeViewIssues.length}
				<section class="support-warning">
					<div class="support-warning-head">
						<p class="warning-title">Sebagian data pendukung belum tersedia</p>
						<Button
							variant="ghost"
							size="sm"
							class="ghost-button"
							onclick={() => void ensureViewData(activeView, true)}>Coba lagi</Button
						>
					</div>
					<ul class="support-warning-list">
						{#each activeViewIssues as issue, index (`${activeView}-${index}`)}
							<li>{issue}</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if !blocksViewRendering && schedulePreviewNotice && ['dashboard', 'calendar', 'builder'].includes(activeView)}
				<section class="support-warning compact-warning">
					<div class="support-warning-head">
						<p class="warning-title">Pratinjau jadwal dibatasi</p>
					</div>
					<p>{schedulePreviewNotice}</p>
				</section>
			{/if}

			{#if !blocksViewRendering}
				{#if activeView === 'dashboard'}
					<div class="dashboard-stack">
						{#if currentUser.current.role === 'STUDENT'}
							<section class="student-dashboard">
								<article class="student-hero">
									<div class="student-hero-copy">
										<span>Kelas berikutnya</span>
										<strong
											>{nextSchedule ? nextSchedule.course : 'Belum ada kelas terjadwal'}</strong
										>
										{#if nextSchedule}
											<p>
												{DAY_LABELS[nextSchedule.day]} • {nextSchedule.startLabel} - {nextSchedule.endLabel}
												• {nextSchedule.room}
											</p>
										{/if}
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
									{#if primaryConflict}
										<section class="decision-primary">
											<div class="decision-primary-copy">
												<span>Bentrok terdekat</span>
												<strong>{primaryConflict.course}</strong>
												<p>
													{DAY_LABELS[primaryConflict.day]} • {primaryConflict.startLabel} - {primaryConflict.endLabel}
												</p>
												{#if primaryConflict.conflictGroupId && conflictGroupDetailsById[primaryConflict.conflictGroupId]}
													<p>
														{conflictGroupMetaCopy(
															conflictGroupDetailsById[primaryConflict.conflictGroupId]
														)}
													</p>
												{/if}
											</div>
											{#if additionalConflictCount > 0}
												<p class="decision-secondary-count">
													+{additionalConflictCount} bentrok lain belum ditangani
												</p>
											{/if}
											<div class="decision-actions conflict-card-actions">
												<Button
													class="ghost-button"
													variant="ghost"
													size="sm"
													onclick={() => openBuilderForSchedule(primaryConflict)}
												>
													Buka di penjadwalan
												</Button>
												<Button
													class="ghost-button"
													variant="ghost"
													size="sm"
													onclick={() => openCalendarForSchedule(primaryConflict)}
												>
													Buka di kalender
												</Button>
											</div>
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
										<span>Ruang belum padat</span>
										<strong>{underusedRooms} ruang masih longgar</strong>
									</div>
									<div class="decision-note-row">
										<span>Kelas berikutnya</span>
										<strong
											>{nextSchedule ? nextSchedule.course : 'Belum ada kelas terjadwal'}</strong
										>
									</div>
								</aside>
							</section>

							<ClassroomDashboard
								role={currentUser.current.role as AppRole}
								summary={classRoomDashboardSummary ?? emptyRoomDashboardSummary}
								metrics={classRoomDashboardMetrics?.items ?? []}
								page={classRoomDashboardPagination.pageNumber}
								pageSize={classRoomDashboardPagination.limit || 10}
								total={classRoomDashboardSummary?.totalRooms ?? 0}
								hasMore={classRoomDashboardPagination.hasMore}
								loading={classRoomDashboardPagination.loading}
								canPrevious={classRoomDashboardPagination.history.length > 0}
								{selectedRoomId}
								onPickRoom={(id) => (selectedRoomId = id)}
								onPreviousPage={() => changeClassRoomDashboardPage('previous')}
								onNextPage={() => changeClassRoomDashboardPage('next')}
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
									<p class="calendar-week-label">{calendarWeekLabel}</p>
								</div>
								<div class="calendar-toolbar">
									<Button
										class="ghost-button"
										variant="ghost"
										size="sm"
										disabled={!calendarCanRender}
										onclick={() => (calendarWeekOffset -= 1)}
									>
										<ChevronLeft size={16} />
										<span>Minggu lalu</span>
									</Button>
									<Button
										class="ghost-button"
										variant="outline"
										size="sm"
										disabled={!calendarCanRender}
										onclick={() => (calendarWeekOffset = 0)}
									>
										Minggu dasar
									</Button>
									<Button
										class="ghost-button"
										variant="ghost"
										size="sm"
										disabled={!calendarCanRender}
										onclick={() => (calendarWeekOffset += 1)}
									>
										<span>Minggu depan</span>
										<ChevronRight size={16} />
									</Button>
								</div>
							</header>

							<section class="schedule-filter-panel">
								<div class="editor-grid schedule-filter-grid">
									<label class="schedule-filter-search">
										<span>Cari jadwal</span>
										<div class="search-box compact">
											<Search size={16} />
											<input
												bind:value={enrollmentSearch}
												aria-label="Cari jadwal kalender"
												placeholder="Cari mahasiswa, mata kuliah, ruang, atau dosen"
												oninput={() => queueCollectionRefresh('enrollments')}
											/>
										</div>
									</label>
									<label>
										<span>Hari</span>
										<select
											bind:value={scheduleDayFilter}
											onchange={() => queueCollectionRefresh('enrollments', 0)}
										>
											<option value="">Semua hari</option>
											{#each days as day (day)}
												<option value={day}>{DAY_LABELS[day]}</option>
											{/each}
										</select>
									</label>
									<label>
										<span>Mata kuliah</span>
										<select
											bind:value={scheduleCourseFilter}
											onchange={() => queueCollectionRefresh('enrollments', 0)}
										>
											<option value="">Semua mata kuliah</option>
											{#each courses as item (item.id)}
												<option value={item.id}>{item.name}</option>
											{/each}
										</select>
									</label>
									<label>
										<span>Ruang</span>
										<div
											class="combobox-wrap"
											onfocusout={(e) => {
												if (!e.currentTarget.contains(e.relatedTarget as Node)) {
													scheduleRoomFilterOpen = false;
												}
											}}
										>
											<input
												type="text"
												class="combobox-input"
												placeholder="Cari ruang filter..."
												value={scheduleRoomFilter
													? selectedScheduleRoomFilterLabel
													: scheduleRoomFilterSearch}
												oninput={(e) => {
													scheduleRoomFilterSearch = (e.currentTarget as HTMLInputElement).value;
													if (scheduleRoomFilter) {
														scheduleRoomFilter = '';
														queueCollectionRefresh('enrollments', 0);
													}
													queueScheduleRoomFilterRefresh();
													scheduleRoomFilterOpen = true;
												}}
												onfocus={() => {
													scheduleRoomFilterOpen = true;
													if (!scheduleRoomFilterOptions.length) {
														queueScheduleRoomFilterRefresh(0);
													}
												}}
											/>
											{#if scheduleRoomFilterIssue}
												<p class="combobox-error">{scheduleRoomFilterIssue}</p>
											{:else if scheduleRoomFilterOpen && scheduleRoomFilterLoading && !scheduleRoomFilterOptions.length}
												<p class="combobox-empty">Memuat ruang kelas...</p>
											{:else if scheduleRoomFilterOpen}
												<div class="combobox-dropdown" role="listbox">
													<button
														type="button"
														role="option"
														aria-selected={!scheduleRoomFilter}
														class="combobox-option"
														class:active={!scheduleRoomFilter}
														onmousedown={(e) => {
															e.preventDefault();
															scheduleRoomFilter = '';
															scheduleRoomFilterSearch = '';
															scheduleRoomFilterOpen = false;
															queueCollectionRefresh('enrollments', 0);
														}}
													>
														<strong>Semua ruang</strong>
														<span>Hapus filter ruang</span>
													</button>
													{#each filteredScheduleRoomFilterOptions as item (item.id)}
														<button
															type="button"
															role="option"
															aria-selected={scheduleRoomFilter === item.id}
															class="combobox-option"
															class:active={scheduleRoomFilter === item.id}
															onmousedown={(e) => {
																e.preventDefault();
																scheduleRoomFilter = item.id ?? '';
																scheduleRoomFilterSearch = '';
																scheduleRoomFilterOpen = false;
																queueCollectionRefresh('enrollments', 0);
															}}
														>
															<strong>{item.name}</strong>
															<span
																>{beautifyRoomType(item.class_room_type)} • kapasitas {item.capacity}</span
															>
														</button>
													{/each}
													{#if !filteredScheduleRoomFilterOptions.length && !scheduleRoomFilterLoading}
														<p class="combobox-empty">Ruang tidak ditemukan.</p>
													{/if}
													{#if scheduleRoomFilterHasMore || scheduleRoomFilterLoading}
														<div class="combobox-footer">
															<span class="combobox-meta">
																{scheduleRoomFilterOptions.length} opsi dimuat
															</span>
															<button
																type="button"
																class="combobox-more"
																disabled={!scheduleRoomFilterHasMore || scheduleRoomFilterLoading}
																onmousedown={(e) => {
																	e.preventDefault();
																	loadMoreScheduleRoomFilterOptions();
																}}
															>
																{scheduleRoomFilterLoading ? 'Memuat...' : 'Muat lebih banyak'}
															</button>
														</div>
													{/if}
												</div>
											{/if}
										</div>
									</label>
									<label>
										<span>Dosen</span>
										<select
											bind:value={scheduleLecturerFilter}
											onchange={() => queueCollectionRefresh('enrollments', 0)}
										>
											<option value="">Semua dosen</option>
											{#each lecturers as item (item.id)}
												<option value={item.id}>{item.name}</option>
											{/each}
										</select>
									</label>
									<label>
										<span>Semester</span>
										<select
											bind:value={scheduleSemesterFilter}
											onchange={() => queueCollectionRefresh('enrollments', 0)}
										>
											<option value="">Semua semester</option>
											{#each scheduleSemesterOptions as item (item)}
												<option value={item}>{item}</option>
											{/each}
										</select>
									</label>
									<label>
										<span>Tahun akademik</span>
										<select
											bind:value={scheduleAcademicYearFilter}
											onchange={() => queueCollectionRefresh('enrollments', 0)}
										>
											<option value="">Semua tahun</option>
											{#each scheduleAcademicYearOptions as item (item)}
												<option value={item}>{item}</option>
											{/each}
										</select>
									</label>
								</div>
								<div class="list-summary schedule-filter-summary">
									<span>{filteredScheduleCards.length} jadwal tampil</span>
									<div class="schedule-filter-actions">
										<Badge variant="secondary">{scheduleActiveFilterCount} filter aktif</Badge>
										<Button
											class="ghost-button"
											variant="ghost"
											size="sm"
											onclick={resetScheduleFilters}
											disabled={scheduleActiveFilterCount === 0}
										>
											Hapus filter
										</Button>
									</div>
								</div>
							</section>

							{#if calendarConflictLegend.length}
								<div class="calendar-conflict-toolbar">
									<div class="calendar-conflict-toolbar-head">
										<strong>{calendarConflictLegend.length} grup bentrok</strong>
										{#if selectedConflictGroupId}
											<Button
												class="ghost-button"
												variant="ghost"
												size="sm"
												onclick={() => (selectedConflictGroupId = null)}
											>
												Lihat semua
											</Button>
										{/if}
									</div>
									<div class="calendar-conflict-legend">
										{#each calendarConflictLegend as group (group.id)}
											<button
												type="button"
												class={`calendar-conflict-chip ${group.selected ? 'selected' : ''}`}
												style={conflictToneVariables(group.tone)}
												onclick={() => toggleConflictGroup(group.id, group.representative)}
											>
												<span class="calendar-conflict-chip-dot"></span>
												<span class="calendar-conflict-chip-copy">
													<strong>{group.label}</strong>
													<small>{group.course}</small>
													{#if group.details}
														<small>{conflictGroupMetaCopy(group.details)}</small>
													{/if}
												</span>
											</button>
										{/each}
									</div>
								</div>
							{/if}

							{#if calendarNeedsFilters}
								<section class="calendar-empty-state support-panel">
									<h3>Terapkan filter jadwal terlebih dahulu</h3>
									<p class="detail-hint">
										Kalender penuh disembunyikan. Pilih mata kuliah, ruang, dosen, hari, semester,
										atau tahun akademik untuk menampilkan jadwal yang ingin dilihat.
									</p>
								</section>
							{:else if calendarExceedsVisibleLimit}
								<section class="calendar-empty-state support-warning">
									<h3>Persempit hasil sebelum membuka kalender</h3>
									<p>
										{filteredScheduleCards.length} jadwal masih cocok dengan filter saat ini. Kurangi
										hasil hingga maksimal {CALENDAR_MAX_VISIBLE_SCHEDULES} jadwal agar kalender tetap
										mudah dibaca.
									</p>
								</section>
							{:else if !filteredScheduleCards.length}
								<section class="calendar-empty-state support-panel">
									<h3>Tidak ada jadwal yang cocok</h3>
									<p class="detail-hint">
										Ubah kata kunci atau longgarkan filter untuk menampilkan jadwal pada kalender.
									</p>
								</section>
							{:else}
								<div class="event-calendar-host">
									{#if EventCalendarComponent}
										<EventCalendarComponent plugins={calendarPlugins} options={calendarOptions} />
									{:else}
										<div class="calendar-loading">Memuat kalender...</div>
									{/if}
								</div>
							{/if}
						</section>

						<section
							class="detail-card"
							class:calendar-conflict={calendarDetailSchedule?.hasConflict}
							style={conflictToneVariables(calendarDetailSchedule?.conflictTone ?? null)}
						>
							{#if calendarDetailSchedule}
								<div class="pane-head compact">
									<div>
										<h3>{calendarDetailSchedule.course}</h3>
										{#if calendarDetailSchedule.hasConflict && selectedScheduleConflictSummary}
											<p class="calendar-conflict-copy">
												Bentrok dengan {selectedScheduleConflictSummary}
											</p>
										{/if}
									</div>
									<Button
										class="ghost-button"
										variant="ghost"
										size="sm"
										onclick={() => openBuilderForSchedule(calendarDetailSchedule)}
									>
										Buka di penjadwalan
									</Button>
								</div>
								<div class="detail-lines">
									<div>
										<span>Hari</span><strong>{DAY_LABELS[calendarDetailSchedule.day]}</strong>
									</div>
									<div>
										<span>Jam</span><strong
											>{calendarDetailSchedule.startLabel} - {calendarDetailSchedule.endLabel}</strong
										>
									</div>
									<div><span>Ruang</span><strong>{calendarDetailSchedule.room}</strong></div>
									<div><span>Dosen</span><strong>{calendarDetailSchedule.lecturer}</strong></div>
									<div>
										<span>Semester</span><strong
											>{calendarDetailSchedule.semester} • {calendarDetailSchedule.academicYear}</strong
										>
									</div>
									<div>
										<span>Status</span><strong
											class:selected-danger={calendarDetailSchedule.hasConflict}
											class:selected-safe={!calendarDetailSchedule.hasConflict}
											>{calendarDetailSchedule.hasConflict ? 'Bentrok' : 'Aman'}</strong
										>
									</div>
									{#if selectedScheduleConflictGroup}
										<div>
											<span>Ruang bentrok</span><strong
												>{selectedScheduleConflictGroup.rooms}</strong
											>
										</div>
										<div>
											<span>Dosen terkait</span><strong
												>{selectedScheduleConflictGroup.lecturers}</strong
											>
										</div>
									{/if}
								</div>
								{#if calendarDetailSchedule.hasConflict && selectedScheduleConflictPeers.length}
									<section class="calendar-overlap-panel">
										<h4>Jadwal lain di grup bentrok ini</h4>
										<div class="calendar-overlap-list">
											{#each selectedScheduleConflictPeers as peer (peer.id)}
												<div
													class={`calendar-overlap-item ${peer.hasConflict ? 'conflict' : ''} ${selectedScheduleId === peer.id ? 'selected' : ''}`}
													style={conflictToneVariables(peer.conflictTone ?? null)}
												>
													<div class="calendar-overlap-copy">
														<strong>{peer.course}</strong>
														<span>{peer.student} • {peer.lecturer} • {peer.room}</span>
														<small
															>{DAY_LABELS[peer.day]} • {peer.startLabel} - {peer.endLabel}</small
														>
													</div>
													<div class="calendar-overlap-actions">
														<Button
															class="ghost-button"
															variant="ghost"
															size="sm"
															onclick={() => focusSchedule(peer)}
														>
															Lihat jadwal
														</Button>
														<Button
															class="ghost-button"
															variant="ghost"
															size="sm"
															onclick={() => openBuilderForSchedule(peer)}
														>
															Buka penjadwalan
														</Button>
													</div>
												</div>
											{/each}
										</div>
									</section>
								{:else if selectedScheduleOverlapPeers.length}
									<section class="calendar-overlap-panel">
										<h4>Jadwal lain pada slot ini</h4>
										<div class="calendar-overlap-list">
											{#each selectedScheduleOverlapPeers as peer (peer.id)}
												<div
													class={`calendar-overlap-item ${peer.hasConflict ? 'conflict' : ''} ${selectedScheduleId === peer.id ? 'selected' : ''}`}
													style={conflictToneVariables(peer.conflictTone ?? null)}
												>
													<div class="calendar-overlap-copy">
														<strong>{peer.course}</strong>
														<span>{peer.student} • {peer.lecturer} • {peer.room}</span>
														<small
															>{DAY_LABELS[peer.day]} • {peer.startLabel} - {peer.endLabel}</small
														>
													</div>
													<div class="calendar-overlap-actions">
														<Button
															class="ghost-button"
															variant="ghost"
															size="sm"
															onclick={() => focusSchedule(peer)}
														>
															Lihat jadwal
														</Button>
														<Button
															class="ghost-button"
															variant="ghost"
															size="sm"
															onclick={() => openBuilderForSchedule(peer)}
														>
															Buka penjadwalan
														</Button>
													</div>
												</div>
											{/each}
										</div>
									</section>
								{/if}
							{:else if calendarNeedsFilters}
								<p class="empty-copy">
									Kalender mingguan akan tampil setelah filter dipilih. Gunakan daftar bentrok di
									atas untuk mulai memeriksa jadwal yang bentrok.
								</p>
							{:else if calendarExceedsVisibleLimit}
								<p class="empty-copy">
									Terlalu banyak jadwal untuk ditampilkan sekaligus. Tambahkan filter sampai
									hasilnya maksimal {CALENDAR_MAX_VISIBLE_SCHEDULES} jadwal, atau pilih salah satu grup
									bentrok di atas untuk melihat rinciannya lebih dulu.
								</p>
							{:else if !filteredScheduleCards.length}
								<p class="empty-copy">Belum ada jadwal yang cocok dengan filter saat ini.</p>
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
									oninput={() => queueCollectionRefresh('enrollments')}
									aria-label="Cari jadwal kuliah"
									placeholder="Cari mahasiswa, mata kuliah, atau ruang"
								/>
								{#if enrollmentSearch}
									<button
										type="button"
										class="search-clear"
										onclick={() => {
											enrollmentSearch = '';
											queueCollectionRefresh('enrollments', 0);
										}}
									>
										<X size={14} />
									</button>
								{/if}
							</label>

							<div class="editor-grid schedule-filter-grid list-filter-grid">
								<label>
									<span>Hari</span>
									<select
										bind:value={scheduleDayFilter}
										onchange={() => queueCollectionRefresh('enrollments', 0)}
									>
										<option value="">Semua hari</option>
										{#each days as day (day)}
											<option value={day}>{DAY_LABELS[day]}</option>
										{/each}
									</select>
								</label>
								<label>
									<span>Mata kuliah</span>
									<div
										class="combobox-wrap"
										onfocusout={(e) => {
											if (!e.currentTarget.contains(e.relatedTarget as Node)) {
												scheduleCourseFilterOpen = false;
											}
										}}
									>
										<input
											type="text"
											class="combobox-input"
											placeholder="Cari mata kuliah filter..."
											value={scheduleCourseFilter
												? selectedScheduleCourseFilterLabel
												: scheduleCourseFilterSearch}
											oninput={(e) => {
												scheduleCourseFilterSearch = (e.currentTarget as HTMLInputElement).value;
												if (scheduleCourseFilter) {
													scheduleCourseFilter = '';
													queueCollectionRefresh('enrollments', 0);
												}
												scheduleCourseFilterOpen = true;
												queueScheduleCourseFilterRefresh();
											}}
											onfocus={() => {
												scheduleCourseFilterOpen = true;
												queueScheduleCourseFilterRefresh(0);
											}}
										/>
										{#if scheduleCourseFilterIssue}
											<p class="combobox-error">{scheduleCourseFilterIssue}</p>
										{:else if scheduleCourseFilterOpen && scheduleCourseFilterLoading && !scheduleCourseFilterOptions.length}
											<p class="combobox-empty">Memuat mata kuliah...</p>
										{:else if scheduleCourseFilterOpen}
											<div class="combobox-dropdown" role="listbox">
												<button
													type="button"
													role="option"
													aria-selected={!scheduleCourseFilter}
													class="combobox-option"
													class:active={!scheduleCourseFilter}
													onmousedown={(e) => {
														e.preventDefault();
														scheduleCourseFilter = '';
														scheduleCourseFilterSearch = '';
														scheduleCourseFilterOpen = false;
														queueCollectionRefresh('enrollments', 0);
													}}
												>
													<strong>Semua mata kuliah</strong>
													<span>Hapus filter mata kuliah</span>
												</button>
												{#each scheduleCourseFilterOptions as item (item.id)}
													<button
														type="button"
														role="option"
														aria-selected={scheduleCourseFilter === item.id}
														class="combobox-option"
														class:active={scheduleCourseFilter === item.id}
														onmousedown={(e) => {
															e.preventDefault();
															scheduleCourseFilter = item.id ?? '';
															scheduleCourseFilterSearch = '';
															scheduleCourseFilterOpen = false;
															queueCollectionRefresh('enrollments', 0);
														}}
													>
														<strong>{item.name}</strong>
														<span>{item.id} • {item.lecturer_name}</span>
													</button>
												{/each}
												{#if !scheduleCourseFilterOptions.length && !scheduleCourseFilterLoading}
													<p class="combobox-empty">Mata kuliah tidak ditemukan.</p>
												{/if}
												{#if scheduleCourseFilterHasMore || scheduleCourseFilterLoading}
													<div class="combobox-footer">
														<span class="combobox-meta">
															{scheduleCourseFilterOptions.length} opsi dimuat
														</span>
														<button
															type="button"
															class="combobox-more"
															disabled={!scheduleCourseFilterHasMore || scheduleCourseFilterLoading}
															onmousedown={(e) => {
																e.preventDefault();
																loadMoreScheduleCourseFilterOptions();
															}}
														>
															{scheduleCourseFilterLoading ? 'Memuat...' : 'Muat lebih banyak'}
														</button>
													</div>
												{/if}
											</div>
										{/if}
									</div>
								</label>
								<label>
									<span>Ruang</span>
									<div
										class="combobox-wrap"
										onfocusout={(e) => {
											if (!e.currentTarget.contains(e.relatedTarget as Node)) {
												scheduleRoomFilterOpen = false;
											}
										}}
									>
										<input
											type="text"
											class="combobox-input"
											placeholder="Cari ruang filter..."
											value={scheduleRoomFilter
												? selectedScheduleRoomFilterLabel
												: scheduleRoomFilterSearch}
											oninput={(e) => {
												scheduleRoomFilterSearch = (e.currentTarget as HTMLInputElement).value;
												if (scheduleRoomFilter) {
													scheduleRoomFilter = '';
													queueCollectionRefresh('enrollments', 0);
												}
												queueScheduleRoomFilterRefresh();
												scheduleRoomFilterOpen = true;
											}}
											onfocus={() => {
												scheduleRoomFilterOpen = true;
												if (!scheduleRoomFilterOptions.length) {
													queueScheduleRoomFilterRefresh(0);
												}
											}}
										/>
										{#if scheduleRoomFilterIssue}
											<p class="combobox-error">{scheduleRoomFilterIssue}</p>
										{:else if scheduleRoomFilterOpen && scheduleRoomFilterLoading && !scheduleRoomFilterOptions.length}
											<p class="combobox-empty">Memuat ruang kelas...</p>
										{:else if scheduleRoomFilterOpen}
											<div class="combobox-dropdown" role="listbox">
												<button
													type="button"
													role="option"
													aria-selected={!scheduleRoomFilter}
													class="combobox-option"
													class:active={!scheduleRoomFilter}
													onmousedown={(e) => {
														e.preventDefault();
														scheduleRoomFilter = '';
														scheduleRoomFilterSearch = '';
														scheduleRoomFilterOpen = false;
														queueCollectionRefresh('enrollments', 0);
													}}
												>
													<strong>Semua ruang</strong>
													<span>Hapus filter ruang</span>
												</button>
												{#each filteredScheduleRoomFilterOptions as item (item.id)}
													<button
														type="button"
														role="option"
														aria-selected={scheduleRoomFilter === item.id}
														class="combobox-option"
														class:active={scheduleRoomFilter === item.id}
														onmousedown={(e) => {
															e.preventDefault();
															scheduleRoomFilter = item.id ?? '';
															scheduleRoomFilterSearch = '';
															scheduleRoomFilterOpen = false;
															queueCollectionRefresh('enrollments', 0);
														}}
													>
														<strong>{item.name}</strong>
														<span
															>{beautifyRoomType(item.class_room_type)} • kapasitas {item.capacity}</span
														>
													</button>
												{/each}
												{#if !filteredScheduleRoomFilterOptions.length && !scheduleRoomFilterLoading}
													<p class="combobox-empty">Ruang tidak ditemukan.</p>
												{/if}
												{#if scheduleRoomFilterHasMore || scheduleRoomFilterLoading}
													<div class="combobox-footer">
														<span class="combobox-meta">
															{scheduleRoomFilterOptions.length} opsi dimuat
														</span>
														<button
															type="button"
															class="combobox-more"
															disabled={!scheduleRoomFilterHasMore || scheduleRoomFilterLoading}
															onmousedown={(e) => {
																e.preventDefault();
																loadMoreScheduleRoomFilterOptions();
															}}
														>
															{scheduleRoomFilterLoading ? 'Memuat...' : 'Muat lebih banyak'}
														</button>
													</div>
												{/if}
											</div>
										{/if}
									</div>
								</label>
								<label>
									<span>Dosen</span>
									<div
										class="combobox-wrap"
										onfocusout={(e) => {
											if (!e.currentTarget.contains(e.relatedTarget as Node)) {
												scheduleLecturerFilterOpen = false;
											}
										}}
									>
										<input
											type="text"
											class="combobox-input"
											placeholder="Cari dosen filter..."
											value={scheduleLecturerFilter
												? selectedScheduleLecturerFilterLabel
												: scheduleLecturerFilterSearch}
											oninput={(e) => {
												scheduleLecturerFilterSearch = (e.currentTarget as HTMLInputElement).value;
												if (scheduleLecturerFilter) {
													scheduleLecturerFilter = '';
													queueCollectionRefresh('enrollments', 0);
												}
												scheduleLecturerFilterOpen = true;
												queueScheduleLecturerFilterRefresh();
											}}
											onfocus={() => {
												scheduleLecturerFilterOpen = true;
												queueScheduleLecturerFilterRefresh(0);
											}}
										/>
										{#if scheduleLecturerFilterIssue}
											<p class="combobox-error">{scheduleLecturerFilterIssue}</p>
										{:else if scheduleLecturerFilterOpen && scheduleLecturerFilterLoading && !scheduleLecturerFilterOptions.length}
											<p class="combobox-empty">Memuat dosen...</p>
										{:else if scheduleLecturerFilterOpen}
											<div class="combobox-dropdown" role="listbox">
												<button
													type="button"
													role="option"
													aria-selected={!scheduleLecturerFilter}
													class="combobox-option"
													class:active={!scheduleLecturerFilter}
													onmousedown={(e) => {
														e.preventDefault();
														scheduleLecturerFilter = '';
														scheduleLecturerFilterSearch = '';
														scheduleLecturerFilterOpen = false;
														queueCollectionRefresh('enrollments', 0);
													}}
												>
													<strong>Semua dosen</strong>
													<span>Hapus filter dosen</span>
												</button>
												{#each scheduleLecturerFilterOptions as item (item.id)}
													<button
														type="button"
														role="option"
														aria-selected={scheduleLecturerFilter === item.id}
														class="combobox-option"
														class:active={scheduleLecturerFilter === item.id}
														onmousedown={(e) => {
															e.preventDefault();
															scheduleLecturerFilter = item.id ?? '';
															scheduleLecturerFilterSearch = '';
															scheduleLecturerFilterOpen = false;
															queueCollectionRefresh('enrollments', 0);
														}}
													>
														<strong>{item.name}</strong>
														<span>{item.id} • {item.email}</span>
													</button>
												{/each}
												{#if !scheduleLecturerFilterOptions.length && !scheduleLecturerFilterLoading}
													<p class="combobox-empty">Dosen tidak ditemukan.</p>
												{/if}
												{#if scheduleLecturerFilterHasMore || scheduleLecturerFilterLoading}
													<div class="combobox-footer">
														<span class="combobox-meta">
															{scheduleLecturerFilterOptions.length} opsi dimuat
														</span>
														<button
															type="button"
															class="combobox-more"
															disabled={!scheduleLecturerFilterHasMore ||
																scheduleLecturerFilterLoading}
															onmousedown={(e) => {
																e.preventDefault();
																loadMoreScheduleLecturerFilterOptions();
															}}
														>
															{scheduleLecturerFilterLoading ? 'Memuat...' : 'Muat lebih banyak'}
														</button>
													</div>
												{/if}
											</div>
										{/if}
									</div>
								</label>
								<label>
									<span>Semester</span>
									<select
										bind:value={scheduleSemesterFilter}
										onchange={() => queueCollectionRefresh('enrollments', 0)}
									>
										<option value="">Semua semester</option>
										{#each scheduleSemesterOptions as item (item)}
											<option value={item}>{item}</option>
										{/each}
									</select>
								</label>
								<label>
									<span>Tahun akademik</span>
									<select
										bind:value={scheduleAcademicYearFilter}
										onchange={() => queueCollectionRefresh('enrollments', 0)}
									>
										<option value="">Semua tahun</option>
										{#each scheduleAcademicYearOptions as item (item)}
											<option value={item}>{item}</option>
										{/each}
									</select>
								</label>
							</div>

							<label class="filter-toggle-row">
								<input type="checkbox" bind:checked={builderConflictOnly} />
								<span>Hanya tampilkan jadwal bentrok</span>
							</label>

							<div class="list-summary">
								<span>{filteredBuilderEnrollments.length} jadwal ditemukan</span>
								<div class="schedule-filter-actions">
									{#if builderConflictOnly}
										<Badge variant="secondary">Bentrok saja</Badge>
									{/if}
									<Badge variant="secondary"
										>{scheduleActiveFilterCount + Number(builderConflictOnly)} filter aktif</Badge
									>
									<Button
										class="ghost-button"
										variant="ghost"
										size="sm"
										onclick={resetScheduleFilters}
										disabled={scheduleActiveFilterCount === 0 && !builderConflictOnly}
									>
										Hapus filter
									</Button>
								</div>
							</div>

							<div class="list-stack">
								{#each filteredBuilderEnrollments as item (item.id)}
									{@const scheduleCard = item.id
										? (scheduleCardMap[item.id] ?? auditConflictCardMap[item.id])
										: null}
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
											{#if item.id && scheduleCard?.hasConflict && conflictSummaryByCardId[item.id]}
												<small class="list-conflict-copy">
													Bentrok dengan {conflictSummaryByCardId[item.id]}
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
							<CollectionPagination
								label="jadwal"
								pageNumber={collectionPagination.enrollments.pageNumber}
								canPrevious={collectionPagination.enrollments.history.length > 0}
								limit={collectionPagination.enrollments.limit}
								itemCount={collectionPagination.enrollments.itemCount}
								hasMore={collectionPagination.enrollments.hasMore}
								loading={collectionPagination.enrollments.loading}
								onPrevious={() => void changeCollectionPage('enrollments', 'previous')}
								onNext={() => void changeCollectionPage('enrollments', 'next')}
							/>
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
										{#if selectedEnrollmentConflictGroup}
											<p class="builder-conflict-copy">
												Ruang: {selectedEnrollmentConflictGroup.rooms} • Dosen: {selectedEnrollmentConflictGroup.lecturers}
											</p>
										{/if}
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
										value={enrollmentDraft.timezone}
									/>

									{#if selectedEnrollmentId}
										<input
											type="hidden"
											{...updateEnrollment.fields.id.as('text')}
											value={enrollmentDraft.id}
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

									{#if builderConflictCards.length}
										<details class="support-panel builder-conflict-panel">
											<summary class="builder-conflict-summary">
												<div>
													<h4>Daftar bentrok</h4>
													<p class="detail-hint">
														Buka daftar hanya saat perlu meninjau grup bentrok.
													</p>
												</div>
												<Badge variant="secondary">{builderConflictCards.length} grup</Badge>
											</summary>
											<div class="builder-conflict-list">
												{#each builderConflictCards as group (group.id)}
													<article
														class={`builder-conflict-card ${group.selected ? 'selected' : ''}`}
														style={conflictToneVariables(group.representative.conflictTone ?? null)}
													>
														<div class="builder-conflict-card-copy">
															<strong>{group.label}</strong>
															<span>{group.representative.course}</span>
															{#if group.details}
																<small>{conflictGroupMetaCopy(group.details)}</small>
															{/if}
														</div>
														<div class="builder-conflict-card-actions">
															<Button
																class="ghost-button"
																variant="ghost"
																size="sm"
																onclick={() => openBuilderForSchedule(group.representative)}
															>
																Buka di penjadwalan
															</Button>
															<Button
																class="ghost-button"
																variant="ghost"
																size="sm"
																onclick={() => openCalendarForSchedule(group.representative)}
															>
																Buka di kalender
															</Button>
														</div>
													</article>
												{/each}
											</div>
										</details>
									{/if}

									<section
										class:hidden-stage={builderStep !== 'participant'}
										class="builder-section"
									>
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
													value={enrollmentDraft.studentId}
												/>
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
															? `${selectedDraftStudent} • ${enrollmentDraft.studentId}`
															: studentPickerSearch}
														oninput={(e) => {
															studentPickerSearch = (e.currentTarget as HTMLInputElement).value;
															if (enrollmentDraft.studentId) enrollmentDraft.studentId = '';
															studentPickerOpen = true;
															queueStudentPickerRefresh();
														}}
														onfocus={() => {
															studentPickerOpen = true;
															queueStudentPickerRefresh(0);
														}}
													/>
													{#if studentPickerIssue}
														<p class="combobox-error">{studentPickerIssue}</p>
													{:else if studentPickerOpen && studentPickerLoading && !filteredStudentsForPicker.length}
														<p class="combobox-empty">Memuat mahasiswa...</p>
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
																		enrollmentDraft.studentId = item.id ?? '';
																		studentPickerSearch = '';
																		studentPickerOpen = false;
																	}}
																>
																	<strong>{item.name}</strong>
																	<span>{item.id}</span>
																</button>
															{/each}
															{#if studentPickerHasMore || studentPickerLoading}
																<div class="combobox-footer">
																	<span class="combobox-meta">
																		{studentPickerOptions.length} mahasiswa dimuat
																	</span>
																	<button
																		type="button"
																		class="combobox-more"
																		disabled={!studentPickerHasMore || studentPickerLoading}
																		onmousedown={(e) => {
																			e.preventDefault();
																			loadMoreStudentPickerOptions();
																		}}
																	>
																		{studentPickerLoading ? 'Memuat...' : 'Muat lebih banyak'}
																	</button>
																</div>
															{/if}
														</div>
													{:else if studentPickerOpen}
														<p class="combobox-empty">Mahasiswa tidak ditemukan.</p>
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
													value={enrollmentDraft.courseId}
												/>
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
															? `${selectedDraftCourse} • ${coursePickerLookup.get(enrollmentDraft.courseId)?.lecturer_name ?? selectedEnrollmentRecord?.lecturer_name ?? ''}`
															: coursePickerSearch}
														oninput={(e) => {
															coursePickerSearch = (e.currentTarget as HTMLInputElement).value;
															if (enrollmentDraft.courseId) enrollmentDraft.courseId = '';
															coursePickerOpen = true;
															queueCoursePickerRefresh();
														}}
														onfocus={() => {
															coursePickerOpen = true;
															queueCoursePickerRefresh(0);
														}}
													/>
													{#if coursePickerIssue}
														<p class="combobox-error">{coursePickerIssue}</p>
													{:else if coursePickerOpen && coursePickerLoading && !filteredCoursesForPicker.length}
														<p class="combobox-empty">Memuat mata kuliah...</p>
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
																		enrollmentDraft.courseId = item.id ?? '';
																		coursePickerSearch = '';
																		coursePickerOpen = false;
																	}}
																>
																	<strong>{item.name}</strong>
																	<span>{item.id} • {item.lecturer_name}</span>
																</button>
															{/each}
															{#if coursePickerHasMore || coursePickerLoading}
																<div class="combobox-footer">
																	<span class="combobox-meta">
																		{coursePickerOptions.length} mata kuliah dimuat
																	</span>
																	<button
																		type="button"
																		class="combobox-more"
																		disabled={!coursePickerHasMore || coursePickerLoading}
																		onmousedown={(e) => {
																			e.preventDefault();
																			loadMoreCoursePickerOptions();
																		}}
																	>
																		{coursePickerLoading ? 'Memuat...' : 'Muat lebih banyak'}
																	</button>
																</div>
															{/if}
														</div>
													{:else if coursePickerOpen}
														<p class="combobox-empty">Mata kuliah tidak ditemukan.</p>
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
													value={enrollmentDraft.day}
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
													value={enrollmentDraft.startTime}
												/>
											</label>

											<label>
												<span>Selesai</span>
												<input
													type="datetime-local"
													{...selectedEnrollmentId
														? updateEnrollment.fields.endTime.as('text')
														: createEnrollment.fields.endTime.as('text')}
													value={enrollmentDraft.endTime}
												/>
											</label>

											<label>
												<span>Semester</span>
												<input
													{...selectedEnrollmentId
														? updateEnrollment.fields.semester.as('text')
														: createEnrollment.fields.semester.as('text')}
													value={enrollmentDraft.semester}
												/>
											</label>

											<label>
												<span>Tahun akademik</span>
												<input
													{...selectedEnrollmentId
														? updateEnrollment.fields.academicYear.as('text')
														: createEnrollment.fields.academicYear.as('text')}
													value={enrollmentDraft.academicYear}
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
												Pilih satu ruang yang tersedia untuk slot ini, lalu lanjut ke langkah
												tinjau.
											</p>
										</div>
										<div class="builder-room-stage">
											<div class="editor-grid builder-room-grid">
												<label>
													<span>Ruang</span>
													<input
														type="hidden"
														{...selectedEnrollmentId
															? updateEnrollment.fields.classRoomId.as('text')
															: createEnrollment.fields.classRoomId.as('text')}
														value={enrollmentDraft.classRoomId}
													/>
													<div
														class="combobox-wrap"
														onfocusout={(e) => {
															if (!e.currentTarget.contains(e.relatedTarget as Node)) {
																roomPickerOpen = false;
															}
														}}
													>
														<input
															type="text"
															class="combobox-input"
															placeholder="Cari ruang tersedia..."
															value={enrollmentDraft.classRoomId
																? selectedDraftRoom
																: roomPickerSearch}
															oninput={(e) => {
																roomPickerSearch = (e.currentTarget as HTMLInputElement).value;
																if (enrollmentDraft.classRoomId) enrollmentDraft.classRoomId = '';
																queueRoomPickerRefresh();
																roomPickerOpen = true;
															}}
															onfocus={() => {
																roomPickerOpen = true;
																if (!roomPickerOptions.length) {
																	queueRoomPickerRefresh(0);
																}
															}}
														/>
														{#if roomPickerIssue}
															<p class="combobox-error">{roomPickerIssue}</p>
														{:else if roomPickerOpen && roomPickerLoading && !roomPickerOptions.length}
															<p class="combobox-empty">Memuat ruang kelas...</p>
														{:else if roomPickerOpen}
															<div class="combobox-dropdown" role="listbox">
																{#each filteredRoomsForPicker as room (room.id)}
																	<button
																		type="button"
																		role="option"
																		aria-selected={enrollmentDraft.classRoomId === room.id}
																		class="combobox-option"
																		class:active={enrollmentDraft.classRoomId === room.id}
																		onmousedown={(e) => {
																			e.preventDefault();
																			enrollmentDraft.classRoomId = room.id ?? '';
																			roomPickerSearch = '';
																			roomPickerOpen = false;
																		}}
																	>
																		<strong>{room.name}</strong>
																		<span
																			>{beautifyRoomType(room.class_room_type)} • kapasitas {room.capacity}</span
																		>
																	</button>
																{/each}
																{#if !filteredRoomsForPicker.length && !roomPickerLoading}
																	<p class="combobox-empty">
																		Ruang tidak ditemukan untuk slot ini.
																	</p>
																{/if}
																{#if roomPickerHasMore || roomPickerLoading}
																	<div class="combobox-footer">
																		<span class="combobox-meta">
																			{filteredRoomsForPicker.length} ruang dimuat
																		</span>
																		<button
																			type="button"
																			class="combobox-more"
																			disabled={!roomPickerHasMore || roomPickerLoading}
																			onmousedown={(e) => {
																				e.preventDefault();
																				loadMoreRoomPickerOptions();
																			}}
																		>
																			{roomPickerLoading ? 'Memuat...' : 'Muat lebih banyak'}
																		</button>
																	</div>
																{/if}
															</div>
														{/if}
													</div>
												</label>
											</div>

											<section class="support-panel builder-support">
												<h4>Ruang tersedia untuk slot ini</h4>
												<div class="support-list">
													{#if filteredRoomsForPicker.length}
														{#each filteredRoomsForPicker as room (room.id)}
															<div>
																<strong>{room.name}</strong>
																<span
																	>{beautifyRoomType(room.class_room_type)} • kapasitas {room.capacity}</span
																>
															</div>
														{/each}
														{#if roomPickerHasMore || roomPickerLoading}
															<div class="combobox-footer support-footer">
																<button
																	type="button"
																	class="combobox-more"
																	disabled={!roomPickerHasMore || roomPickerLoading}
																	onclick={() => loadMoreRoomPickerOptions()}
																>
																	{roomPickerLoading ? 'Memuat...' : 'Muat lebih banyak'}
																</button>
															</div>
														{/if}
													{:else}
														<p class="empty-copy">
															Belum ada ruang yang tersedia untuk slot ini. Ubah jadwal atau pilih
															slot lain.
														</p>
														{#if roomPickerHasMore || roomPickerLoading}
															<div class="combobox-footer support-footer">
																<button
																	type="button"
																	class="combobox-more"
																	disabled={!roomPickerHasMore || roomPickerLoading}
																	onclick={() => loadMoreRoomPickerOptions()}
																>
																	{roomPickerLoading ? 'Memuat...' : 'Muat lebih banyak'}
																</button>
															</div>
														{/if}
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
									oninput={() => queueCollectionRefresh('classrooms')}
									aria-label="Cari ruang"
									placeholder="Cari nama ruang atau jenis ruang"
								/>{#if roomSearch}<button
										type="button"
										class="search-clear"
										onclick={() => {
											roomSearch = '';
											queueCollectionRefresh('classrooms', 0);
										}}><X size={14} /></button
									>{/if}</label
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
										<small>{beautifyRoomType(item.class_room_type)}</small>
									</button>
								{/each}
							</div>
							<CollectionPagination
								label="ruang"
								pageNumber={collectionPagination.classrooms.pageNumber}
								canPrevious={collectionPagination.classrooms.history.length > 0}
								limit={collectionPagination.classrooms.limit}
								itemCount={collectionPagination.classrooms.itemCount}
								hasMore={collectionPagination.classrooms.hasMore}
								loading={collectionPagination.classrooms.loading}
								onPrevious={() => void changeCollectionPage('classrooms', 'previous')}
								onNext={() => void changeCollectionPage('classrooms', 'next')}
							/>
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
										<div>
											<span>AC</span><strong>{selectedRoom.has_ac ? 'Ya' : 'Tidak'}</strong>
										</div>
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
											value={selectedRoomId}
										/>{/if}
									<label
										><span>Nama ruang</span><input
											{...selectedRoomId
												? updateClassRoom.fields.name.as('text')
												: createClassRoom.fields.name.as('text')}
											value={classroomDraft.name}
										/></label
									>
									<label
										><span>Tipe ruang</span><select
											{...selectedRoomId
												? updateClassRoom.fields.classRoomType.as('select')
												: createClassRoom.fields.classRoomType.as('select')}
											value={classroomDraft.classRoomType}
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
											value={classroomDraft.capacity}
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
									oninput={() => queueCollectionRefresh('courses')}
									aria-label="Cari data mata kuliah"
									placeholder="Cari kode, nama, atau dosen pengampu"
								/>{#if courseSearch}<button
										type="button"
										class="search-clear"
										onclick={() => {
											courseSearch = '';
											queueCollectionRefresh('courses', 0);
										}}><X size={14} /></button
									>{/if}</label
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
							<CollectionPagination
								label="mata kuliah"
								pageNumber={collectionPagination.courses.pageNumber}
								canPrevious={collectionPagination.courses.history.length > 0}
								limit={collectionPagination.courses.limit}
								itemCount={collectionPagination.courses.itemCount}
								hasMore={collectionPagination.courses.hasMore}
								loading={collectionPagination.courses.loading}
								onPrevious={() => void changeCollectionPage('courses', 'previous')}
								onNext={() => void changeCollectionPage('courses', 'next')}
							/>
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
											value={courseDraft.id}
										/>{:else}<p class="editor-note">
											Kode mata kuliah dibuat otomatis saat data disimpan.
										</p>{/if}<label
										><span>Nama mata kuliah</span><input
											{...selectedCourseId
												? updateCourse.fields.name.as('text')
												: createCourse.fields.name.as('text')}
											value={courseDraft.name}
										/></label
									><label
										><span>SKS</span><input
											min="1"
											max="6"
											{...selectedCourseId
												? updateCourse.fields.credits.as('number')
												: createCourse.fields.credits.as('number')}
											value={courseDraft.credits}
										/></label
									><label
										><span>Program studi</span><select
											{...selectedCourseId
												? updateCourse.fields.studyProgramId.as('select')
												: createCourse.fields.studyProgramId.as('select')}
											value={courseDraft.studyProgramId}
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
											value={courseDraft.lecturerId}
											><option value="">Pilih dosen</option
											>{#if collectionIssues.lecturers && !lecturers.length}<option
													value=""
													disabled>{collectionIssues.lecturers}</option
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
									oninput={() => queueCollectionRefresh('students')}
									aria-label="Cari data mahasiswa"
									placeholder="Cari NRP, nama, atau program studi"
								/>{#if studentSearch}<button
										type="button"
										class="search-clear"
										onclick={() => {
											studentSearch = '';
											queueCollectionRefresh('students', 0);
										}}><X size={14} /></button
									>{/if}</label
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
										<small>{item.year_admitted}</small></button
									>{/each}
							</div>
							<CollectionPagination
								label="mahasiswa"
								pageNumber={collectionPagination.students.pageNumber}
								canPrevious={collectionPagination.students.history.length > 0}
								limit={collectionPagination.students.limit}
								itemCount={collectionPagination.students.itemCount}
								hasMore={collectionPagination.students.hasMore}
								loading={collectionPagination.students.loading}
								onPrevious={() => void changeCollectionPage('students', 'previous')}
								onNext={() => void changeCollectionPage('students', 'next')}
							/>
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
											<span>Program studi</span><strong>{selectedStudent.study_program_name}</strong
											>
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
											value={selectedStudentId}
										/>{/if}<label
										><span>Nama</span><input
											{...selectedStudentId
												? updateStudent.fields.name.as('text')
												: createStudent.fields.name.as('text')}
											value={studentDraft.name}
										/></label
									><label
										><span>Email</span><input
											{...selectedStudentId
												? updateStudent.fields.email.as('email')
												: createStudent.fields.email.as('email')}
											value={studentDraft.email}
										/></label
									><label
										><span>Telepon</span><input
											{...selectedStudentId
												? updateStudent.fields.phone.as('text')
												: createStudent.fields.phone.as('text')}
											value={studentDraft.phone}
										/></label
									><label
										><span>Alamat</span><input
											{...selectedStudentId
												? updateStudent.fields.address.as('text')
												: createStudent.fields.address.as('text')}
											value={studentDraft.address}
										/></label
									><label
										><span>Angkatan</span><input
											{...selectedStudentId
												? updateStudent.fields.yearAdmitted.as('number')
												: createStudent.fields.yearAdmitted.as('number')}
											value={studentDraft.yearAdmitted}
										/></label
									><label
										><span>Program studi</span><select
											{...selectedStudentId
												? updateStudent.fields.studyProgramId.as('select')
												: createStudent.fields.studyProgramId.as('select')}
											value={studentDraft.studyProgramId}
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
									oninput={() => queueCollectionRefresh('lecturers')}
									aria-label="Cari data dosen"
									placeholder="Cari ID dosen, nama, atau email"
								/>{#if lecturerSearch}<button
										type="button"
										class="search-clear"
										onclick={() => {
											lecturerSearch = '';
											queueCollectionRefresh('lecturers', 0);
										}}><X size={14} /></button
									>{/if}</label
							>
							<div class="list-stack">
								{#each filteredLecturers as item (item.id)}<button
										type="button"
										class:selected={selectedLecturerId === item.id}
										class="list-row"
										onclick={() => pickLecturer(item)}
										><div><strong>{item.name}</strong><span>{item.id} • {item.email}</span></div>
										<small>{item.email}</small></button
									>{/each}
							</div>
							<CollectionPagination
								label="dosen"
								pageNumber={collectionPagination.lecturers.pageNumber}
								canPrevious={collectionPagination.lecturers.history.length > 0}
								limit={collectionPagination.lecturers.limit}
								itemCount={collectionPagination.lecturers.itemCount}
								hasMore={collectionPagination.lecturers.hasMore}
								loading={collectionPagination.lecturers.loading}
								onPrevious={() => void changeCollectionPage('lecturers', 'previous')}
								onNext={() => void changeCollectionPage('lecturers', 'next')}
							/>
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
											<span>Jadwal aktif</span><strong
												>{selectedLecturer.schedule_count ?? 0}</strong
											>
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
											value={lecturerDraft.id}
										/>{:else}<p class="editor-note">
											ID dosen dibuat otomatis saat data disimpan.
										</p>{/if}<label
										><span>Nama</span><input
											{...selectedLecturerId
												? updateLecturer.fields.name.as('text')
												: createLecturer.fields.name.as('text')}
											value={lecturerDraft.name}
										/></label
									><label
										><span>Email</span><input
											{...selectedLecturerId
												? updateLecturer.fields.email.as('email')
												: createLecturer.fields.email.as('email')}
											value={lecturerDraft.email}
										/></label
									><label
										><span>Telepon</span><input
											{...selectedLecturerId
												? updateLecturer.fields.phone.as('text')
												: createLecturer.fields.phone.as('text')}
											value={lecturerDraft.phone}
										/></label
									><label
										><span>Alamat</span><input
											{...selectedLecturerId
												? updateLecturer.fields.address.as('text')
												: createLecturer.fields.address.as('text')}
											value={lecturerDraft.address}
										/></label
									><Button type="submit" class="primary-button"
										>{selectedLecturerId ? 'Simpan perubahan' : 'Tambah dosen'}</Button
									>
								</form>{:else}<p class="empty-copy">
									Pilih satu dosen untuk melihat detail, atau tambahkan dosen baru saat data
									pengampu berubah.
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
									oninput={() => queueCollectionRefresh('faculties')}
									aria-label="Cari data fakultas"
									placeholder="Cari kode atau nama fakultas"
								/>{#if facultySearch}<button
										type="button"
										class="search-clear"
										onclick={() => {
											facultySearch = '';
											queueCollectionRefresh('faculties', 0);
										}}><X size={14} /></button
									>{/if}</label
							>
							<div class="list-stack">
								{#each filteredFaculties as item (item.id)}<button
										type="button"
										class:selected={selectedFacultyId === item.id}
										class="list-row"
										onclick={() => pickFaculty(item)}
										><div><strong>{item.name}</strong><span>{item.id}</span></div>
										<small>{item.id}</small></button
									>{/each}
							</div>
							<CollectionPagination
								label="fakultas"
								pageNumber={collectionPagination.faculties.pageNumber}
								canPrevious={collectionPagination.faculties.history.length > 0}
								limit={collectionPagination.faculties.limit}
								itemCount={collectionPagination.faculties.itemCount}
								hasMore={collectionPagination.faculties.hasMore}
								loading={collectionPagination.faculties.loading}
								onPrevious={() => void changeCollectionPage('faculties', 'previous')}
								onNext={() => void changeCollectionPage('faculties', 'next')}
							/>
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
											value={facultyDraft.id}
										/>{:else}<p class="editor-note">
											ID fakultas dibuat otomatis saat data disimpan.
										</p>{/if}<label
										><span>Nama fakultas</span><input
											{...selectedFacultyId
												? updateFaculty.fields.name.as('text')
												: createFaculty.fields.name.as('text')}
											value={facultyDraft.name}
										/></label
									><Button type="submit" class="primary-button"
										>{selectedFacultyId ? 'Simpan perubahan' : 'Tambah fakultas'}</Button
									>
								</form>{:else}<p class="empty-copy">
									Pilih satu fakultas untuk melihat detail, atau tambahkan fakultas baru saat
									struktur berubah.
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
									oninput={() => queueCollectionRefresh('studyPrograms')}
									aria-label="Cari data program studi"
									placeholder="Cari kode, nama, atau fakultas"
								/>{#if studyProgramSearch}<button
										type="button"
										class="search-clear"
										onclick={() => {
											studyProgramSearch = '';
											queueCollectionRefresh('studyPrograms', 0);
										}}><X size={14} /></button
									>{/if}</label
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
										<small>{item.head ?? item.faculty_name}</small></button
									>{/each}
							</div>
							<CollectionPagination
								label="program studi"
								pageNumber={collectionPagination.studyPrograms.pageNumber}
								canPrevious={collectionPagination.studyPrograms.history.length > 0}
								limit={collectionPagination.studyPrograms.limit}
								itemCount={collectionPagination.studyPrograms.itemCount}
								hasMore={collectionPagination.studyPrograms.hasMore}
								loading={collectionPagination.studyPrograms.loading}
								onPrevious={() => void changeCollectionPage('studyPrograms', 'previous')}
								onNext={() => void changeCollectionPage('studyPrograms', 'next')}
							/>
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
										<div>
											<span>Ketua program</span><strong>{selectedStudyProgram.head}</strong>
										</div>
										<div>
											<span>Fakultas</span><strong>{selectedStudyProgram.faculty_name}</strong>
										</div>
										<div>
											<span>Mahasiswa</span><strong
												>{selectedStudyProgram.student_count ?? 0}</strong
											>
										</div>
									</div>
									<p class="detail-hint">
										Gunakan mode tinjau agar struktur prodi tetap mudah dibaca sebelum proses edit
										dimulai.
									</p>
								</div>{:else if currentUser.current.role === 'ADMIN' && editorView === 'studyPrograms'}<form
									class="editor-grid"
									{...selectedStudyProgramId
										? updateStudyProgramEnhance
										: createStudyProgramEnhance}
								>
									{#if selectedStudyProgramId}<input
											type="hidden"
											{...updateStudyProgram.fields.id.as('text')}
											value={studyProgramDraft.id}
										/>{:else}<p class="editor-note">
											ID program studi dibuat otomatis saat data disimpan.
										</p>{/if}<label
										><span>Nama prodi</span><input
											{...selectedStudyProgramId
												? updateStudyProgram.fields.name.as('text')
												: createStudyProgram.fields.name.as('text')}
											value={studyProgramDraft.name}
										/></label
									><label
										><span>Ketua prodi</span><input
											{...selectedStudyProgramId
												? updateStudyProgram.fields.head.as('text')
												: createStudyProgram.fields.head.as('text')}
											value={studyProgramDraft.head}
										/></label
									><label
										><span>Fakultas</span><select
											{...selectedStudyProgramId
												? updateStudyProgram.fields.facultyId.as('select')
												: createStudyProgram.fields.facultyId.as('select')}
											value={studyProgramDraft.facultyId}
											><option value="">Pilih fakultas</option
											>{#if collectionIssues.faculties && !faculties.length}<option
													value=""
													disabled>{collectionIssues.faculties}</option
												>{/if}
											>{#each faculties as item (item.id)}<option value={item.id}
													>{item.name}</option
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
									oninput={() => queueCollectionRefresh('enrollments')}
									aria-label="Cari KRS aktif"
									placeholder="Cari mahasiswa, mata kuliah, atau ruang"
								/>{#if enrollmentSearch}<button
										type="button"
										class="search-clear"
										onclick={() => {
											enrollmentSearch = '';
											queueCollectionRefresh('enrollments', 0);
										}}><X size={14} /></button
									>{/if}</label
							>
							<div class="editor-grid schedule-filter-grid list-filter-grid">
								<label>
									<span>Hari</span>
									<select
										bind:value={scheduleDayFilter}
										onchange={() => queueCollectionRefresh('enrollments', 0)}
									>
										<option value="">Semua hari</option>
										{#each days as day (day)}
											<option value={day}>{DAY_LABELS[day]}</option>
										{/each}
									</select>
								</label>
								<label>
									<span>Mata kuliah</span>
									<select
										bind:value={scheduleCourseFilter}
										onchange={() => queueCollectionRefresh('enrollments', 0)}
									>
										<option value="">Semua mata kuliah</option>
										{#each courses as item (item.id)}
											<option value={item.id}>{item.name}</option>
										{/each}
									</select>
								</label>
								<label>
									<span>Ruang</span>
									<div
										class="combobox-wrap"
										onfocusout={(e) => {
											if (!e.currentTarget.contains(e.relatedTarget as Node)) {
												scheduleRoomFilterOpen = false;
											}
										}}
									>
										<input
											type="text"
											class="combobox-input"
											placeholder="Cari ruang filter..."
											value={scheduleRoomFilter
												? selectedScheduleRoomFilterLabel
												: scheduleRoomFilterSearch}
											oninput={(e) => {
												scheduleRoomFilterSearch = (e.currentTarget as HTMLInputElement).value;
												if (scheduleRoomFilter) {
													scheduleRoomFilter = '';
													queueCollectionRefresh('enrollments', 0);
												}
												queueScheduleRoomFilterRefresh();
												scheduleRoomFilterOpen = true;
											}}
											onfocus={() => {
												scheduleRoomFilterOpen = true;
												if (!scheduleRoomFilterOptions.length) {
													queueScheduleRoomFilterRefresh(0);
												}
											}}
										/>
										{#if scheduleRoomFilterIssue}
											<p class="combobox-error">{scheduleRoomFilterIssue}</p>
										{:else if scheduleRoomFilterOpen && scheduleRoomFilterLoading && !scheduleRoomFilterOptions.length}
											<p class="combobox-empty">Memuat ruang kelas...</p>
										{:else if scheduleRoomFilterOpen}
											<div class="combobox-dropdown" role="listbox">
												<button
													type="button"
													role="option"
													aria-selected={!scheduleRoomFilter}
													class="combobox-option"
													class:active={!scheduleRoomFilter}
													onmousedown={(e) => {
														e.preventDefault();
														scheduleRoomFilter = '';
														scheduleRoomFilterSearch = '';
														scheduleRoomFilterOpen = false;
														queueCollectionRefresh('enrollments', 0);
													}}
												>
													<strong>Semua ruang</strong>
													<span>Hapus filter ruang</span>
												</button>
												{#each filteredScheduleRoomFilterOptions as item (item.id)}
													<button
														type="button"
														role="option"
														aria-selected={scheduleRoomFilter === item.id}
														class="combobox-option"
														class:active={scheduleRoomFilter === item.id}
														onmousedown={(e) => {
															e.preventDefault();
															scheduleRoomFilter = item.id ?? '';
															scheduleRoomFilterSearch = '';
															scheduleRoomFilterOpen = false;
															queueCollectionRefresh('enrollments', 0);
														}}
													>
														<strong>{item.name}</strong>
														<span
															>{beautifyRoomType(item.class_room_type)} • kapasitas {item.capacity}</span
														>
													</button>
												{/each}
												{#if !filteredScheduleRoomFilterOptions.length && !scheduleRoomFilterLoading}
													<p class="combobox-empty">Ruang tidak ditemukan.</p>
												{/if}
												{#if scheduleRoomFilterHasMore || scheduleRoomFilterLoading}
													<div class="combobox-footer">
														<span class="combobox-meta">
															{scheduleRoomFilterOptions.length} opsi dimuat
														</span>
														<button
															type="button"
															class="combobox-more"
															disabled={!scheduleRoomFilterHasMore || scheduleRoomFilterLoading}
															onmousedown={(e) => {
																e.preventDefault();
																loadMoreScheduleRoomFilterOptions();
															}}
														>
															{scheduleRoomFilterLoading ? 'Memuat...' : 'Muat lebih banyak'}
														</button>
													</div>
												{/if}
											</div>
										{/if}
									</div>
								</label>
								<label>
									<span>Dosen</span>
									<select
										bind:value={scheduleLecturerFilter}
										onchange={() => queueCollectionRefresh('enrollments', 0)}
									>
										<option value="">Semua dosen</option>
										{#each lecturers as item (item.id)}
											<option value={item.id}>{item.name}</option>
										{/each}
									</select>
								</label>
								<label>
									<span>Semester</span>
									<select
										bind:value={scheduleSemesterFilter}
										onchange={() => queueCollectionRefresh('enrollments', 0)}
									>
										<option value="">Semua semester</option>
										{#each scheduleSemesterOptions as item (item)}
											<option value={item}>{item}</option>
										{/each}
									</select>
								</label>
								<label>
									<span>Tahun akademik</span>
									<select
										bind:value={scheduleAcademicYearFilter}
										onchange={() => queueCollectionRefresh('enrollments', 0)}
									>
										<option value="">Semua tahun</option>
										{#each scheduleAcademicYearOptions as item (item)}
											<option value={item}>{item}</option>
										{/each}
									</select>
								</label>
							</div>
							<div class="list-summary schedule-filter-summary">
								<span>{filteredEnrollments.length} KRS tampil</span>
								<div class="schedule-filter-actions">
									<Badge variant="secondary">{scheduleActiveFilterCount} filter aktif</Badge>
									<Button
										class="ghost-button"
										variant="ghost"
										size="sm"
										onclick={resetScheduleFilters}
										disabled={scheduleActiveFilterCount === 0}
									>
										Hapus filter
									</Button>
								</div>
							</div>
							<div class="list-stack">
								{#each filteredEnrollments as item (item.id)}
									{@const scheduleCard = item.id ? scheduleCardMap[item.id] : null}
									<button
										type="button"
										class:selected={selectedEnrollmentId === item.id}
										class="list-row"
										onclick={() => pickEnrollment(item)}
										><div>
											<strong>{item.student_name}</strong><span
												>{item.course_name} • {item.class_room_name}</span
											>
											{#if item.id && scheduleCard?.hasConflict && conflictSummaryByCardId[item.id]}
												<small class="list-conflict-copy">
													Bentrok dengan {conflictSummaryByCardId[item.id]}
												</small>
											{/if}
										</div>
										<small>{item.semester} • {item.academic_year}</small></button
									>{/each}
							</div>
							<CollectionPagination
								label="KRS"
								pageNumber={collectionPagination.enrollments.pageNumber}
								canPrevious={collectionPagination.enrollments.history.length > 0}
								limit={collectionPagination.enrollments.limit}
								itemCount={collectionPagination.enrollments.itemCount}
								hasMore={collectionPagination.enrollments.hasMore}
								loading={collectionPagination.enrollments.loading}
								onPrevious={() => void changeCollectionPage('enrollments', 'previous')}
								onNext={() => void changeCollectionPage('enrollments', 'next')}
							/>
						</section>
						<section class="workspace-detail">
							<div class="pane-head compact">
								<div>
									<h3>{selectedEnrollment ? selectedEnrollment.course_name : 'Pilih satu KRS'}</h3>
								</div>
							</div>
							{#if selectedEnrollment}
								<div class="detail-stack">
									{#if selectedEnrollmentConflictSummary}
										<p class="builder-conflict-copy">
											Bentrok dengan {selectedEnrollmentConflictSummary}
										</p>
									{/if}
									<div class="detail-lines">
										<div>
											<span>Mahasiswa</span><strong>{selectedEnrollment.student_name}</strong>
										</div>
										<div>
											<span>Mata kuliah</span><strong>{selectedEnrollment.course_name}</strong>
										</div>
										<div>
											<span>Ruang</span><strong>{selectedEnrollment.class_room_name}</strong>
										</div>
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
										{#if selectedEnrollmentConflictGroup}
											<div>
												<span>Ruang bentrok</span><strong
													>{selectedEnrollmentConflictGroup.rooms}</strong
												>
											</div>
											<div>
												<span>Dosen terkait</span><strong
													>{selectedEnrollmentConflictGroup.lecturers}</strong
												>
											</div>
										{/if}
									</div>
								</div>
							{:else}<p class="empty-copy">Pilih satu baris untuk melihat detail KRS.</p>{/if}
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
							<div class="filter-bar">
								<label class="search-box grow"
									><Search size={16} /><input
										bind:value={gradeSearch}
										oninput={() => queueCollectionRefresh('grades')}
										aria-label="Cari data nilai"
										placeholder="Cari mahasiswa, mata kuliah, atau nilai huruf"
									/>{#if gradeSearch}<button
											type="button"
											class="search-clear"
											onclick={() => {
												gradeSearch = '';
												queueCollectionRefresh('grades', 0);
											}}><X size={14} /></button
										>{/if}</label
								>
								<label class="filter-select">
									<span>Nilai</span>
									<select
										bind:value={gradeLetterFilter}
										onchange={() => queueCollectionRefresh('grades', 0)}
									>
										<option value="">Semua</option>
										<option value="A">A</option>
										<option value="B">B</option>
										<option value="C">C</option>
										<option value="D">D</option>
										<option value="E">E</option>
									</select>
								</label>
								<label class="filter-select">
									<span>Mata kuliah</span>
									<select
										bind:value={gradeCourseFilter}
										onchange={() => queueCollectionRefresh('grades', 0)}
									>
										<option value="">Semua</option>
										{#each courses as item (item.id)}
											<option value={item.id}>{item.name}</option>
										{/each}
									</select>
								</label>
							</div>
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
							<CollectionPagination
								label="nilai"
								pageNumber={collectionPagination.grades.pageNumber}
								canPrevious={collectionPagination.grades.history.length > 0}
								limit={collectionPagination.grades.limit}
								itemCount={collectionPagination.grades.itemCount}
								hasMore={collectionPagination.grades.hasMore}
								loading={collectionPagination.grades.loading}
								onPrevious={() => void changeCollectionPage('grades', 'previous')}
								onNext={() => void changeCollectionPage('grades', 'next')}
							/>
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
											value={gradeDraft.id}
										/>{/if}<label
										><span>KRS</span><select
											{...selectedGradeId
												? updateGrade.fields.enrollmentId.as('select')
												: createGrade.fields.enrollmentId.as('select')}
											value={gradeDraft.enrollmentId}
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
											value={gradeDraft.assignmentScore}
										/></label
									><label
										><span>UTS</span><input
											min="0"
											max="100"
											{...selectedGradeId
												? updateGrade.fields.midtermScore.as('number')
												: createGrade.fields.midtermScore.as('number')}
											value={gradeDraft.midtermScore}
										/></label
									><label
										><span>UAS</span><input
											min="0"
											max="100"
											{...selectedGradeId
												? updateGrade.fields.finalScore.as('number')
												: createGrade.fields.finalScore.as('number')}
											value={gradeDraft.finalScore}
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
									Pilih satu nilai untuk melihat hasil, atau tambahkan nilai baru saat evaluasi
									perlu dicatat.
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
									oninput={() => queueCollectionRefresh('users')}
									aria-label="Cari akun pengguna"
									placeholder="Cari email atau pemilik akun"
								/>{#if userSearch}<button
										type="button"
										class="search-clear"
										onclick={() => {
											userSearch = '';
											queueCollectionRefresh('users', 0);
										}}><X size={14} /></button
									>{/if}</label
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
							<CollectionPagination
								label="akun"
								pageNumber={collectionPagination.users.pageNumber}
								canPrevious={collectionPagination.users.history.length > 0}
								limit={collectionPagination.users.limit}
								itemCount={collectionPagination.users.itemCount}
								hasMore={collectionPagination.users.hasMore}
								loading={collectionPagination.users.loading}
								onPrevious={() => void changeCollectionPage('users', 'previous')}
								onNext={() => void changeCollectionPage('users', 'next')}
							/>
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
										<div>
											<span>Dosen</span><strong>{selectedUser.lecturer_name ?? '-'}</strong>
										</div>
									</div>
									<p class="detail-hint">
										Tinjau relasi akun lebih dahulu agar perubahan akses dilakukan dengan konteks
										yang jelas.
									</p>
								</div>
							{:else if selectedUser && editorView === 'users'}
								<form class="editor-grid" {...updateUserEnhance}>
									<p class="editor-note">
										Perubahan akun memengaruhi akses login. Tinjau peran dan relasi identitas
										sebelum menyimpan.
									</p>
									<input
										type="hidden"
										{...updateUser.fields.id.as('text')}
										value={userDraft.id}
									/><label
										><span>Email</span><input
											{...updateUser.fields.email.as('email')}
											autocomplete="email"
											value={userDraft.email}
										/></label
									><label
										><span>Password baru</span><input
											{...updateUser.fields.password.as('password')}
											autocomplete="new-password"
											value={userDraft.password}
											placeholder="Biarkan kosong jika password lama tetap dipakai"
										/></label
									><label
										><span>Peran akses</span><select
											{...updateUser.fields.role.as('select')}
											value={userDraft.role}
											><option value="ADMIN">ADMIN</option><option value="STUDENT">STUDENT</option
											><option value="LECTURER">LECTURER</option></select
										></label
									><label
										><span>ID mahasiswa terkait</span><input
											{...updateUser.fields.studentId.as('text')}
											value={userDraft.studentId}
										/></label
									><label
										><span>ID dosen terkait</span><input
											{...updateUser.fields.lecturerId.as('text')}
											value={userDraft.lecturerId}
										/></label
									><Button type="submit" class="primary-button">Simpan akun</Button>
								</form>{:else}<p class="empty-copy">
									Pilih satu akun untuk memperbarui email, peran, atau relasi identitas.
								</p>{/if}
						</section>
					</div>
				{/if}
			{/if}
		</main>
	</div>
{:else}
	<div class="login-shell">
		<Card.Root class="login-panel">
			<Card.Header>
				<div class="topbar-tools">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onclick={() => window.location.reload()}
					>
						<RotateCw size={16} />
						<span>Refresh</span>
					</Button>
				</div>
				<Card.Title class="login-title">
					<p class="kicker">Watum</p>
					Masuk
				</Card.Title>
				<Card.Description class="login-description">
					Lihat jadwal, ruang, dan data akademik dari satu tempat.
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
						<Label for="password-login">Kata sandi</Label>
						<Input
							id="password-login"
							{...loginUser.fields.password.as('password')}
							autocomplete="current-password"
							placeholder="Masukkan kata sandi"
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
		position: relative;
	}

	.rail-backdrop,
	.rail-toggle,
	.rail-close {
		display: none;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--color-border);
		border-radius: 0.8rem;
		background: var(--color-panel);
		color: inherit;
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
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.35rem;
	}

	.rail-brand h1 {
		font-size: 1.28rem;
		line-height: 1.04;
	}

	.brand-copy,
	.pane-copy,
	.list-conflict-copy,
	.builder-progress-copy span,
	.builder-overview p,
	.decision-notes p {
		color: var(--color-muted-foreground);
	}

	.brand-copy,
	.pane-copy,
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
		display: flex;
		align-items: center;
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
		align-content: center;
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

	.schedule-filter-panel {
		display: grid;
		gap: 0.85rem;
		padding: 0.95rem 1rem;
		border: 1px solid color-mix(in oklch, var(--color-border) 88%, var(--color-surface) 12%);
		border-radius: 1rem;
		background: color-mix(in oklch, var(--color-surface) 86%, var(--color-panel) 14%);
	}

	.schedule-filter-grid {
		grid-template-columns: repeat(4, minmax(0, 1fr));
		align-items: end;
	}

	.list-filter-grid {
		grid-template-columns: repeat(4, minmax(0, 1fr));
	}

	.schedule-filter-search {
		display: grid;
		gap: 0.45rem;
	}

	.schedule-filter-summary {
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.75rem;
	}

	.schedule-filter-actions {
		display: flex;
		gap: 0.6rem;
		justify-content: flex-end;
		align-items: center;
		flex-wrap: wrap;
	}

	.filter-bar {
		display: flex;
		gap: 0.6rem;
		align-items: end;
		padding: 0 0 0.35rem;
	}

	.filter-bar .grow {
		flex: 1 1 0;
	}

	.filter-select {
		display: grid;
		gap: 0.35rem;
		min-width: 8rem;
	}

	.filter-select span {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--color-muted-foreground);
	}

	.filter-toggle-row {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--color-muted-foreground);
		font-size: 0.92rem;
	}

	.filter-toggle-row input {
		margin: 0;
		inline-size: 1rem;
		block-size: 1rem;
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

	.loading-panel {
		display: grid;
		align-content: start;
		min-height: clamp(42rem, 88vh, 58rem);
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

	.calendar-week-label {
		margin: 0.28rem 0 0;
		font-size: 0.88rem;
		color: var(--color-muted-foreground);
	}

	.calendar-toolbar {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.55rem;
	}

	.calendar-conflict-toolbar {
		display: grid;
		gap: 0.7rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: 1rem;
		background: color-mix(in oklch, var(--color-panel) 82%, var(--color-surface) 18%);
	}

	.calendar-conflict-toolbar-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.calendar-conflict-toolbar-head strong {
		font-size: 0.94rem;
	}

	.calendar-conflict-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
	}

	.calendar-conflict-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.6rem 0.72rem;
		border: 1px solid var(--conflict-border, var(--color-border));
		border-radius: 0.95rem;
		background: color-mix(
			in oklch,
			var(--conflict-surface, var(--color-surface)) 78%,
			var(--color-panel) 22%
		);
		color: inherit;
		text-align: left;
		font: inherit;
		cursor: pointer;
		transition:
			transform 140ms ease,
			box-shadow 140ms ease,
			border-color 140ms ease,
			opacity 140ms ease;
	}

	.calendar-conflict-chip:hover {
		transform: translateY(-1px);
		box-shadow: 0 10px 18px color-mix(in oklch, var(--color-shadow) 8%, transparent 92%);
	}

	.calendar-conflict-chip.selected {
		border-color: var(--color-accent-strong);
		box-shadow:
			0 10px 20px color-mix(in oklch, var(--color-accent-strong) 12%, transparent 88%),
			inset 0 0 0 1px color-mix(in oklch, var(--color-accent-strong) 34%, transparent 66%);
	}

	.calendar-conflict-chip-dot {
		width: 0.7rem;
		height: 0.7rem;
		border-radius: 999px;
		background: var(--conflict-border, var(--color-accent-strong));
		box-shadow: 0 0 0 3px
			color-mix(in oklch, var(--conflict-border, var(--color-accent-strong)) 18%, transparent 82%);
		flex: 0 0 auto;
	}

	.calendar-conflict-chip-copy {
		display: grid;
		gap: 0.1rem;
	}

	.calendar-conflict-chip-copy strong {
		font-size: 0.86rem;
		line-height: 1.2;
	}

	.calendar-conflict-chip-copy small {
		font-size: 0.75rem;
		line-height: 1.25;
		color: var(--color-muted-foreground);
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
		border-width: 2px;
		border-color: var(--color-accent-strong);
		background: color-mix(in oklch, var(--color-surface) 72%, var(--color-accent-soft) 28%);
		box-shadow:
			0 12px 24px color-mix(in oklch, var(--color-accent-strong) 12%, transparent 88%),
			inset 0 0 0 2px color-mix(in oklch, var(--color-accent-strong) 34%, transparent 66%);
	}

	:global(.event-calendar-host .watum-ec-event.is-dimmed) {
		opacity: 0.32;
		filter: saturate(0.7);
	}

	:global(.event-calendar-host .watum-ec-event.is-conflict-focus) {
		border-width: 2px;
		box-shadow:
			0 16px 28px
				color-mix(in oklch, var(--conflict-border, var(--color-danger)) 12%, transparent 88%),
			inset 0 0 0 3px
				color-mix(in oklch, var(--conflict-border, var(--color-danger)) 18%, transparent 82%);
		transform: translateY(-1px);
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
		border-width: 2px;
		border-color: var(--color-accent-strong);
		background: color-mix(
			in oklch,
			var(--conflict-surface, var(--color-danger-soft)) 70%,
			var(--color-accent-soft) 30%
		);
		box-shadow:
			0 14px 28px color-mix(in oklch, var(--color-danger) 12%, transparent 88%),
			inset 0 0 0 3px color-mix(in oklch, var(--color-accent-strong) 42%, transparent 58%);
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

	.conflict-card-actions {
		margin-top: 0.2rem;
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

	@media (min-width: 721px) {
		.topbar {
			min-height: 4.35rem;
		}

		.topbar-tools {
			min-height: 2.9rem;
			align-content: start;
		}

		.decision-lead,
		.decision-notes {
			min-height: 15rem;
		}

		.decision-primary {
			min-height: 5.9rem;
			align-content: start;
		}

		.decision-actions {
			min-height: 3.2rem;
			align-content: start;
		}
	}

	@media (min-width: 960px) {
		.topbar-tools {
			flex-wrap: nowrap;
		}

		.topbar-tools :global(button),
		.topbar-tools .user-pill {
			white-space: nowrap;
			min-height: 2.85rem;
		}

		:global(.theme-switch) {
			min-width: 7.8rem;
			justify-content: center;
		}
	}

	.builder-overview div {
		display: grid;
		gap: 0.24rem;
		padding: 0.9rem;
		border: 1px solid var(--color-border);
		background: var(--color-surface);
		border-radius: 0.8rem;
	}

	.builder-conflict-panel {
		display: grid;
		gap: 0.75rem;
		padding: 0.75rem 0.85rem;
	}

	.builder-conflict-summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		cursor: pointer;
		list-style: none;
	}

	.builder-conflict-summary::-webkit-details-marker {
		display: none;
	}

	.builder-conflict-summary::after {
		content: 'Tampilkan';
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--color-accent-strong);
	}

	.builder-conflict-panel[open] .builder-conflict-summary::after {
		content: 'Sembunyikan';
	}

	.builder-conflict-list {
		display: grid;
		gap: 0.75rem;
		max-height: 18rem;
		overflow: auto;
		padding-right: 0.2rem;
	}

	.builder-conflict-card {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.75rem;
		align-items: start;
		padding: 0.9rem;
		border: 1px solid var(--conflict-border, var(--color-border));
		border-radius: 0.9rem;
		background: color-mix(
			in oklch,
			var(--conflict-surface, var(--color-surface)) 86%,
			var(--color-panel) 14%
		);
	}

	.builder-conflict-card.selected {
		box-shadow:
			0 12px 24px color-mix(in oklch, var(--conflict-ink, var(--color-danger)) 10%, transparent 90%),
			inset 0 0 0 1px color-mix(in oklch, var(--color-accent-strong) 38%, transparent 62%);
	}

	.builder-conflict-card-copy {
		display: grid;
		gap: 0.22rem;
		min-width: 0;
	}

	.builder-conflict-card-copy span,
	.builder-conflict-card-copy small {
		color: color-mix(
			in oklch,
			var(--conflict-ink, var(--color-muted-foreground)) 72%,
			var(--color-foreground) 28%
		);
	}

	.builder-conflict-card-actions {
		display: flex;
		gap: 0.55rem;
		flex-wrap: wrap;
		justify-content: flex-end;
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

	.calendar-overlap-item.selected {
		border-color: var(--color-accent-strong);
		background: color-mix(in oklch, var(--color-surface) 74%, var(--color-accent-soft) 26%);
		box-shadow:
			0 12px 24px color-mix(in oklch, var(--color-accent-strong) 10%, transparent 90%),
			inset 0 0 0 1px color-mix(in oklch, var(--color-accent-strong) 38%, transparent 62%);
	}

	.calendar-overlap-item.conflict.selected {
		border-color: var(--color-accent-strong);
		background: color-mix(in oklch, var(--conflict-surface) 68%, var(--color-accent-soft) 32%);
		box-shadow:
			0 12px 24px color-mix(in oklch, var(--color-danger) 12%, transparent 88%),
			inset 0 0 0 1px color-mix(in oklch, var(--color-accent-strong) 42%, transparent 58%);
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
		height: clamp(32rem, calc(100dvh - 9.5rem), 56rem);
		min-height: 0;
		align-items: stretch;
		overflow: hidden;
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
		height: 100%;
		min-height: 0;
	}

	.builder-list .list-stack {
		height: 100%;
		min-height: 0;
		overflow: auto;
		padding-right: 0.1rem;
		scrollbar-gutter: stable;
		overscroll-behavior: contain;
	}

	.builder-detail {
		height: 100%;
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
		position: relative;
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
		box-shadow:
			0 10px 24px color-mix(in oklch, var(--color-accent-strong) 10%, transparent 90%),
			inset 0 0 0 1px color-mix(in oklch, var(--color-accent-strong) 34%, transparent 66%);
		transform: translateY(-1px);
		outline: 2px solid color-mix(in oklch, var(--color-accent-strong) 22%, transparent 78%);
		outline-offset: 1px;
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

	.builder-progress-item.active .builder-progress-copy strong {
		color: var(--color-accent-strong);
	}

	.builder-progress-item.active .builder-progress-copy span {
		color: color-mix(in oklch, var(--color-accent-strong) 70%, var(--color-foreground) 30%);
	}

	.builder-progress-item.active::after {
		content: '';
		position: absolute;
		left: 0.85rem;
		right: 0.85rem;
		bottom: 0.45rem;
		height: 0.22rem;
		border-radius: 999px;
		background: var(--color-accent-strong);
		opacity: 0.92;
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

	.builder-support .support-list {
		max-height: clamp(11rem, 30dvh, 18rem);
		overflow: auto;
		padding-right: 0.1rem;
		scrollbar-gutter: stable;
		overscroll-behavior: contain;
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
		grid-template-columns: auto 1fr auto;
		align-items: center;
		padding: 0.7rem 0.85rem;
		border: 1px solid var(--color-border);
		border-radius: 0.8rem;
		background: var(--color-surface);
		gap: 0.55rem;
	}

	.search-box.compact {
		padding: 0.62rem 0.75rem;
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

	.search-clear {
		display: inline-grid;
		place-items: center;
		width: 1.6rem;
		height: 1.6rem;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--color-muted-foreground);
	}

	.search-clear:hover {
		background: color-mix(in oklch, var(--color-surface) 78%, var(--color-border) 22%);
		color: var(--color-foreground);
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

	.list-row > small {
		justify-self: end;
		text-align: right;
		min-width: 0;
	}

	.list-row strong,
	.list-row span,
	.list-row small {
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.list-conflict-copy {
		display: block;
		line-height: 1.38;
		color: var(--color-danger);
	}

	.list-row.selected {
		border-color: var(--color-accent-strong);
		box-shadow: inset 0 0 0 2px color-mix(in oklch, var(--color-accent-strong) 42%, transparent 58%);
	}

	.list-row.conflict {
		background: var(--conflict-surface);
		border-color: var(--conflict-border);
	}

	.list-row.conflict.selected {
		border-color: var(--color-accent-strong);
		box-shadow: inset 0 0 0 3px color-mix(in oklch, var(--color-accent-strong) 48%, transparent 52%);
	}

	.list-row.conflict strong {
		color: var(--conflict-ink);
	}

	.list-row.conflict .list-conflict-copy {
		color: var(--conflict-ink);
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

		.rail-backdrop {
			display: block;
			position: fixed;
			inset: 0;
			z-index: 30;
			border: 0;
			background: color-mix(in oklch, var(--color-shadow) 24%, transparent 76%);
			backdrop-filter: blur(2px);
		}

		.rail {
			position: fixed;
			top: 0;
			left: 0;
			bottom: 0;
			z-index: 40;
			width: min(19rem, calc(100vw - 2rem));
			max-width: calc(100vw - 2rem);
			border-right: 1px solid var(--color-border);
			border-bottom: 0;
			box-shadow: 0 24px 60px color-mix(in oklch, var(--color-shadow) 20%, transparent 80%);
			overflow: auto;
			transform: translateX(-110%);
			transition: transform 180ms ease;
		}

		.rail.open {
			transform: translateX(0);
		}

		.rail-toggle,
		.rail-close {
			display: inline-flex;
			width: 2.6rem;
			height: 2.6rem;
			padding: 0;
		}

		.rail-close {
			justify-self: end;
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

		.event-calendar-host {
			overflow-x: auto;
			overflow-y: hidden;
			-webkit-overflow-scrolling: touch;
			overscroll-behavior-x: contain;
		}

		:global(.event-calendar-host .ec) {
			--ec-slot-height: 38px;
			min-width: 112rem;
		}

		:global(.event-calendar-host .ec-time-grid .ec-header .ec-sidebar),
		:global(.event-calendar-host .ec-time-grid .ec-body .ec-sidebar) {
			inline-size: 3.35rem;
			width: 3.35rem;
			flex: 0 0 3.35rem;
		}

		:global(.event-calendar-host .ec-day-head) {
			padding: 0.8rem 0.7rem;
		}

		:global(.event-calendar-host .watum-day-head strong) {
			font-size: 0.84rem;
		}

		:global(.event-calendar-host .watum-day-head span) {
			font-size: 0.72rem;
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

		.schedule-filter-summary {
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
			grid-template-columns: minmax(0, 1fr);
			gap: 0.45rem;
			align-items: start;
		}

		.list-row > small {
			justify-self: start;
			text-align: left;
		}

		.user-pill {
			width: 100%;
			min-width: 0;
		}

		.warning-actions > * {
			flex: 1 1 100%;
		}

		.workspace-list .list-stack {
			max-height: clamp(14rem, 36dvh, 22rem);
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
		max-height: clamp(12rem, 34dvh, 20rem);
		overflow-y: auto;
		scrollbar-gutter: stable;
		overscroll-behavior: contain;
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

	.combobox-empty {
		margin: 0.35rem 0 0;
		font-size: 0.86rem;
		color: var(--color-muted-foreground);
	}

	.combobox-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0.45rem 0.35rem 0.2rem;
		border-top: 1px solid color-mix(in oklch, var(--color-border) 88%, transparent 12%);
	}

	.combobox-meta {
		font-size: 0.78rem;
		color: var(--color-muted-foreground);
	}

	.combobox-more {
		border: 1px solid var(--color-border);
		border-radius: 999px;
		padding: 0.3rem 0.7rem;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}

	.combobox-more:disabled {
		opacity: 0.48;
		cursor: default;
	}

	.combobox-pagination {
		display: flex;
		gap: 0.45rem;
	}

	.support-footer {
		padding-inline: 0;
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
