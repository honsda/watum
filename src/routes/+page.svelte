<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { browser } from '$app/environment';
	import { onDestroy, onMount, untrack, tick } from 'svelte';
	import type { Component } from 'svelte';
	import { clearAccessToken, ensureAccessToken, setAccessToken } from '$lib/client/auth';
	import { AlertCircle, Menu, MoonStar, RotateCw, Search, SunMedium, X } from '@lucide/svelte';
	import { days } from '$lib/validations/enrollment';
	import { classRoomTypes } from '$lib/validations/classroom';
	import { calculateGrade } from '$lib/validations/grade';
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
	import {
		headerAction,
		navigationForRole,
		navigationGroupsForRole,
		pageHeading,
		viewCatalog,
		type ViewId
	} from '$lib/app/navigation';
	import ClassroomDashboard from '$lib/components/app/ClassroomDashboard.svelte';
	import CollectionPagination from '$lib/components/app/CollectionPagination.svelte';
	import LecturersView from '$lib/components/app/LecturersView.svelte';
	import FacultiesView from '$lib/components/app/FacultiesView.svelte';
	import ClassroomsView from '$lib/components/app/ClassroomsView.svelte';
	import '$lib/components/app/page-shell.css';
	import StudentsView from '$lib/components/app/StudentsView.svelte';
	import CoursesView from '$lib/components/app/CoursesView.svelte';
	import StudyProgramsView from '$lib/components/app/StudyProgramsView.svelte';
	import GradesView from '$lib/components/app/GradesView.svelte';
	import UsersView from '$lib/components/app/UsersView.svelte';
	import DashboardView from '$lib/components/app/DashboardView.svelte';
	import CalendarView from '$lib/components/app/CalendarView.svelte';
	import BuilderView from '$lib/components/app/BuilderView.svelte';
	import EnrollmentsView from '$lib/components/app/EnrollmentsView.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import {
		createEnhancer as createSharedEnhancer,
		createOptimisticEnhancer as createSharedOptimisticEnhancer,
		firstIssue,
		type EnhancedForm
	} from '$lib/client/form-enhancers';
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
		bulkDeleteClassRooms,
		bulkUpdateClassRooms,
		type RoomDashboardSummary
	} from './classrooms/data.remote';
	import {
		getCourses,
		getCourse,
		searchCourses,
		createCourse,
		updateCourse,
		deleteCourse,
		bulkDeleteCourses,
		bulkUpdateCourses
	} from './courses/data.remote';
	import {
		getStudents,
		getStudent,
		searchStudents,
		createStudent,
		updateStudent,
		deleteStudent,
		bulkDeleteStudents,
		bulkUpdateStudents
	} from './students/data.remote';
	import {
		getLecturers,
		getLecturer,
		searchLecturers,
		createLecturer,
		updateLecturer,
		deleteLecturer,
		bulkDeleteLecturers,
		bulkUpdateLecturers
	} from './lecturers/data.remote';
	import {
		getFaculties,
		getFaculty,
		searchFaculties,
		createFaculty,
		updateFaculty,
		deleteFaculty,
		bulkDeleteFaculties,
		bulkUpdateFaculties
	} from './faculties/data.remote';
	import {
		getStudyPrograms,
		getStudyProgram,
		searchStudyPrograms,
		createStudyProgram,
		updateStudyProgram,
		deleteStudyProgram,
		bulkDeleteStudyPrograms,
		bulkUpdateStudyPrograms
	} from './study-programs/data.remote';
	import {
		getEnrollments,
		getEnrollment,
		getEnrollmentConflictAudit,
		getSchedulePreview,
		searchEnrollments,
		createEnrollment,
		updateEnrollment,
		deleteEnrollment,
		bulkDeleteEnrollments,
		bulkUpdateEnrollments
	} from './enrollments/data.remote';
	import {
		getGrades,
		getGrade,
		searchGrades,
		createGrade,
		updateGrade,
		deleteGrade,
		bulkDeleteGrades,
		bulkUpdateGrades
	} from './grades/data.remote';
	import {
		getUsers,
		searchUsers,
		updateUser,
		bulkUpdateUserRoles,
		bulkDeleteUsers,
		bulkResetPasswords
	} from './users/data.remote';
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
		| 'users'
		| 'users-bulk-role'
		| 'users-bulk-password'
		| 'classrooms-bulk'
		| 'courses-bulk'
		| 'students-bulk'
		| 'lecturers-bulk'
		| 'faculties-bulk'
		| 'studyPrograms-bulk'
		| 'enrollments-bulk'
		| 'grades-bulk';
	type DeleteKind =
		| 'classroom'
		| 'course'
		| 'student'
		| 'lecturer'
		| 'faculty'
		| 'studyProgram'
		| 'enrollment'
		| 'grade'
		| 'bulk-user'
		| 'bulk-classrooms'
		| 'bulk-courses'
		| 'bulk-students'
		| 'bulk-lecturers'
		| 'bulk-faculties'
		| 'bulk-studyPrograms'
		| 'bulk-enrollments'
		| 'bulk-grades';
	type DeleteIntent = {
		kind: DeleteKind;
		id: string;
		label: string;
		message: string;
		confirmLabel: string;
		successMessage: string;
		failureMessage: string;
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

	function openBuilderForEnrollment(item: SelectEnrollmentsResult | null | undefined) {
		if (!item) return;
		pickEnrollment(item);
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

	function activateView(view: ViewId) {
		if (!allowedViews.includes(view)) return;
		activeView = view;
		mobileRailOpen = false;
	}

	function handleKeyboardClick(event: KeyboardEvent) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		event.stopPropagation();
		(event.currentTarget as HTMLElement).click();
	}

	function clearRefreshTimers() {
		if (!browser) return;
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

	function navigateToEntity(view: ViewId, id: string | null | undefined, name?: string) {
		if (!id) return;
		activateView(view);
		stopEditing();
		pendingDelete = null;

		switch (view) {
			case 'students': {
				selectedStudentId = id;
				const existing = students.find((s) => s.id === id);
				selectedStudentRecord = existing ?? (name ? ({ id, name } as SelectStudentsResult) : null);
				if (!existing) {
					void getStudent(id)
						.run()
						.then((full) => {
							if (selectedStudentId !== id) return;
							selectedStudentRecord = full;
						});
				}
				break;
			}
			case 'lecturers': {
				selectedLecturerId = id;
				const existing = lecturers.find((l) => l.id === id);
				selectedLecturerRecord =
					existing ?? (name ? ({ id, name } as SelectLecturersResult) : null);
				if (!existing) {
					void getLecturer(id)
						.run()
						.then((full) => {
							if (selectedLecturerId !== id) return;
							selectedLecturerRecord = full;
						});
				}
				break;
			}
			case 'courses': {
				selectedCourseId = id;
				const existing = courses.find((c) => c.id === id);
				selectedCourseRecord = existing ?? (name ? ({ id, name } as SelectCoursesResult) : null);
				if (!existing) {
					void getCourse(id)
						.run()
						.then((full) => {
							if (selectedCourseId !== id) return;
							selectedCourseRecord = full;
						});
				}
				break;
			}
			case 'classrooms': {
				selectedRoomId = id;
				const existing = classrooms.find((r) => r.id === id);
				selectedRoomRecord = existing ?? (name ? ({ id, name } as SelectClassRoomsResult) : null);
				if (!existing) {
					void getClassRoom(id)
						.run()
						.then((full) => {
							if (selectedRoomId !== id) return;
							selectedRoomRecord = full;
						});
				}
				break;
			}
			case 'faculties': {
				selectedFacultyId = id;
				const existing = faculties.find((f) => f.id === id);
				selectedFacultyRecord = existing ?? (name ? ({ id, name } as SelectFacultiesResult) : null);
				if (!existing) {
					void getFaculty(id)
						.run()
						.then((full) => {
							if (selectedFacultyId !== id) return;
							selectedFacultyRecord = full;
						});
				}
				break;
			}
			case 'studyPrograms': {
				selectedStudyProgramId = id;
				const existing = studyPrograms.find((sp) => sp.id === id);
				selectedStudyProgramRecord =
					existing ?? (name ? ({ id, name } as SelectStudyProgramsResult) : null);
				if (!existing) {
					void getStudyProgram(id)
						.run()
						.then((full) => {
							if (selectedStudyProgramId !== id) return;
							selectedStudyProgramRecord = full;
						});
				}
				break;
			}
			case 'enrollments': {
				selectedEnrollmentId = id;
				const existing = enrollments.find((e) => e.id === id);
				selectedEnrollmentRecord = existing ?? null;
				if (!existing) {
					void getEnrollment(id)
						.run()
						.then((full) => {
							if (selectedEnrollmentId !== id) return;
							selectedEnrollmentRecord = full;
						});
				}
				break;
			}
			case 'grades': {
				selectedGradeId = id;
				const existing = grades.find((g) => g.id === id);
				selectedGradeRecord = existing ?? null;
				if (!existing) {
					void getGrade(id)
						.run()
						.then((full) => {
							if (selectedGradeId !== id) return;
							selectedGradeRecord = full;
						});
				}
				break;
			}
		}
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
			semester: 'GANJIL',
			academicYear: '2025/2026',
			timezone
		};
	}

	function normalizeSemesterValue(value: string | null | undefined) {
		const normalized = value?.trim().toUpperCase() ?? '';
		return normalized.startsWith('GEN') ? 'GENAP' : 'GANJIL';
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
	const allowedViews = $derived(
		navigationForRole((currentUser.current?.role ?? undefined) as AppRole | undefined)
	);
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
	let previousBodyOverflow = '';
	let selectedRoomId = $state<string | null>(null);
	let selectedCourseId = $state<string | null>(null);
	let selectedStudentId = $state<string | null>(null);
	let selectedLecturerId = $state<string | null>(null);
	let selectedFacultyId = $state<string | null>(null);
	let selectedStudyProgramId = $state<string | null>(null);
	let selectedEnrollmentId = $state<string | null>(null);
	let selectedGradeId = $state<string | null>(null);
	let selectedUserId = $state<string | null>(null);
	let selectedUserIds = $state<Set<string>>(new Set());
	let bulkUserRole = $state<'ADMIN' | 'STUDENT' | 'LECTURER'>('STUDENT');
	let bulkUserPassword = $state('');

	let bulkSelectedIds = $state<Record<string, Set<string>>>({
		classrooms: new Set(),
		courses: new Set(),
		students: new Set(),
		lecturers: new Set(),
		faculties: new Set(),
		studyPrograms: new Set(),
		enrollments: new Set(),
		grades: new Set()
	});

	let bulkEditClassRoomType = $state<'REGULER' | 'LAB_KOMPUTER' | 'LAB_BAHASA' | 'AUDITORIUM'>(
		'REGULER'
	);
	let bulkEditClassRoomCapacity = $state(30);
	let bulkEditClassRoomHasProjector = $state(false);
	let bulkEditClassRoomHasAC = $state(false);
	let bulkEditCourseCredits = $state(2);
	let bulkEditCourseStudyProgramId = $state('');
	let bulkEditCourseLecturerId = $state('');
	let bulkEditStudentStudyProgramId = $state('');
	let bulkEditStudentYearAdmitted = $state(new Date().getFullYear());
	let bulkEditLecturerEmail = $state('');
	let bulkEditLecturerName = $state('');
	let bulkEditLecturerPhone = $state('');
	let bulkEditLecturerAddress = $state('');
	let bulkEditFacultyName = $state('');
	let bulkEditStudyProgramFacultyId = $state('');
	let bulkEditStudyProgramHead = $state('');
	let bulkEditEnrollmentSemester = $state('');
	let bulkEditEnrollmentAcademicYear = $state('');
	let bulkEditGradeAssignmentScore = $state<number | undefined>(undefined);
	let bulkEditGradeMidtermScore = $state<number | undefined>(undefined);
	let bulkEditGradeFinalScore = $state<number | undefined>(undefined);

	function bulkToggleId(kind: string, id: string) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const next = new Set(bulkSelectedIds[kind] ?? []);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		bulkSelectedIds = { ...bulkSelectedIds, [kind]: next };
	}

	function bulkToggleAll(kind: string, ids: string[]) {
		const current = bulkSelectedIds[kind] ?? new Set();
		const next = current.size === ids.length && ids.length > 0 ? new Set<string>() : new Set(ids);
		bulkSelectedIds = { ...bulkSelectedIds, [kind]: next };
	}

	function bulkClear(kind: string) {
		bulkSelectedIds = { ...bulkSelectedIds, [kind]: new Set() };
	}

	function bulkGetIds(kind: string): string[] {
		return [...(bulkSelectedIds[kind] ?? [])];
	}

	function bulkCount(kind: string): number {
		return bulkSelectedIds[kind]?.size ?? 0;
	}

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

	function reportDanger(message: string) {
		setFeedback('danger', message);
	}

	function createEnhancer(form: EnhancedForm, onSuccess: () => Promise<void> | void) {
		return createSharedEnhancer(form, onSuccess, reportDanger);
	}

	function createOptimisticEnhancer(
		form: EnhancedForm,
		optimistic: () => void,
		onSuccess: () => Promise<void> | void,
		restore: () => Promise<void> | void
	) {
		return createSharedOptimisticEnhancer(form, optimistic, onSuccess, restore, reportDanger);
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

	onDestroy(() => {
		clearRefreshTimers();
		if (browser) {
			document.body.style.overflow = '';
		}
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
		clearRefreshTimers();
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

			await tick();
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
		const academicYear = scheduleAcademicYearFilter || scheduleAcademicYearOptions[0] || undefined;
		const semester = scheduleSemesterFilter || scheduleSemesterOptions[0] || undefined;
		return {
			academicYear,
			semester,
			day: (scheduleDayFilter || undefined) as
				| 'SENIN'
				| 'SELASA'
				| 'RABU'
				| 'KAMIS'
				| 'JUMAT'
				| 'SABTU'
				| undefined,
			courseId: scheduleCourseFilter || undefined,
			classRoomId: scheduleRoomFilter || undefined,
			lecturerId: scheduleLecturerFilter || undefined,
			limitGroups: 1000,
			memberSampleSize: 10
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
		const userId = currentUser.current?.id ?? null;
		if (!userId || activeView !== 'builder' || builderStep !== 'participant') return;
		const _deps = [selectedEnrollmentId, builderStep, activeView];
		void _deps;
		if (!studentPickerOptions.length) queueStudentPickerRefresh(0);
		if (!coursePickerOptions.length) queueCoursePickerRefresh(0);
	});

	$effect(() => {
		const userId = currentUser.current?.id ?? null;
		if (!userId || !['calendar', 'builder', 'enrollments'].includes(activeView)) return;
		const _deps = [activeView];
		void _deps;
		if (!scheduleCourseFilterOptions.length) queueScheduleCourseFilterRefresh(0);
		if (!scheduleRoomFilterOptions.length) queueScheduleRoomFilterRefresh(0);
		if (!scheduleLecturerFilterOptions.length) queueScheduleLecturerFilterRefresh(0);
	});

	$effect(() => {
		const userId = currentUser.current?.id ?? null;
		if (!userId || builderStep !== 'room' || !timeStepReady) return;
		const _deps = [
			enrollmentDraft.day,
			enrollmentDraft.startTime,
			enrollmentDraft.endTime,
			roomPickerSearch,
			selectedEnrollmentId
		];
		void _deps;
		queueRoomPickerRefresh(0);
	});

	$effect(() => {
		if (!browser) return;
		if (mobileRailOpen) {
			previousBodyOverflow = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = previousBodyOverflow;
		}
		return () => {
			document.body.style.overflow = previousBodyOverflow;
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
	const selectedGradeEnrollment = $derived(
		enrollments.find((item) => item.id === gradeDraft.enrollmentId) ?? null
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
	// Use the authoritative total from the audit summary (counts all seeds, not just hydrated groups).
	const conflictCount = $derived(conflictAudit?.summary?.totalGroups ?? auditConflictGroups.length);
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
	const roomPickerSourceOptions = $derived.by(() => {
		return mergeItemsById(classrooms, roomPickerOptions);
	});

	const availableRoomOptions = $derived.by(() => {
		const roomOptions = roomPickerSourceOptions;
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
	const filteredRoomsForPicker = $derived.by(() => {
		const q = normalizedSearchValue(roomPickerSearch);
		if (!q) return availableRoomOptions;

		return availableRoomOptions.filter(
			(room) =>
				matchesText(room.name, q) ||
				matchesText(beautifyRoomType(room.class_room_type), q) ||
				matchesText(String(room.capacity ?? ''), q)
		);
	});
	const filteredScheduleRoomFilterOptions = $derived(scheduleRoomFilterOptions);
	const timeStepReady = $derived(
		Boolean(
			enrollmentDraft.day &&
				enrollmentDraft.startTime &&
				enrollmentDraft.endTime &&
				enrollmentDraft.semester &&
				enrollmentDraft.academicYear
		) && enrollmentDraft.startTime < enrollmentDraft.endTime
	);
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
					// Only update the detail record — never touch courseDraft here.
					// The list item already contains every field the editor needs
					// (id, name, credits, study_program_id, lecturer_id). Overwriting
					// courseDraft from this async result races with any edits the user
					// may have already started in the form.
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
			semester: normalizeSemesterValue(item.semester),
			academicYear: item.academic_year ?? '2025/2026',
			timezone
		};
		const pickedStudent = item.student_id ? studentPickerLookup.get(item.student_id) : undefined;
		const pickedCourse = item.course_id ? coursePickerLookup.get(item.course_id) : undefined;
		studentPickerSearch = pickedStudent?.name ?? item.student_name ?? '';
		coursePickerSearch = pickedCourse?.name ?? item.course_name ?? '';
		roomPickerSearch = item.class_room_name ?? '';
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

	function toggleUserSelection(id: string) {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const next = new Set(selectedUserIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		selectedUserIds = next;
	}

	function toggleAllUsers() {
		if (selectedUserIds.size === filteredUsers.length) {
			selectedUserIds = new Set();
		} else {
			selectedUserIds = new Set(filteredUsers.map((item) => item.id).filter(Boolean) as string[]);
		}
	}

	function clearUserSelection() {
		selectedUserIds = new Set();
		bulkUserRole = 'STUDENT';
		bulkUserPassword = '';
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
		if (view in viewCatalog) clearSelection(view as ViewId);
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
			const ok = await submit();
			if (!ok) {
				setFeedback('danger', 'Sesi belum bisa ditutup. Coba lagi.');
				return;
			}
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
	const updateClassRoomEnhance = createOptimisticEnhancer(
		updateClassRoom,
		() => {
			const id = selectedRoomId;
			if (!id) return;
			classrooms = classrooms.map((room) =>
				room.id === id
					? ({
							...room,
							name: classroomDraft.name,
							class_room_type: classroomDraft.classRoomType as NonNullable<
								typeof room.class_room_type
							>,
							capacity: classroomDraft.capacity,
							has_projector: classroomDraft.hasProjector ? 1 : 0,
							has_ac: classroomDraft.hasAC ? 1 : 0
						} as SelectClassRoomsResult)
					: room
			);
		},
		async () => {
			await refreshDependencies({
				collections: ['classrooms', 'enrollments'],
				includeSchedulePreview: true,
				includeConflictAudit: true
			});
			stopEditing('classrooms');
			setFeedback('success', 'Data ruang kelas berhasil diperbarui.');
		},
		async () => {
			await refreshDependencies({
				collections: ['classrooms', 'enrollments'],
				includeSchedulePreview: true,
				includeConflictAudit: true
			});
		}
	);
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
	const updateCourseEnhance = updateCourse.enhance(
		async ({ submit }: { submit: () => Promise<boolean> }) => {
			const id = selectedCourseId;
			let applied = false;
			try {
				if (id) {
					applied = true;
					courses = courses.map((course) =>
						course.id === id
							? {
									...course,
									name: courseDraft.name,
									credits: courseDraft.credits,
									study_program_id: courseDraft.studyProgramId,
									lecturer_id: courseDraft.lecturerId
								}
							: course
					);
				}
				await submit();
				const issue = firstIssue(updateCourse);
				if (issue) {
					setFeedback('danger', issue);
					void refreshDependencies({ collections: ['courses'] }).catch(() => {});
					return;
				}

				// Close editor immediately — don't wait for background refreshes.
				await tick();
				stopEditing('courses');
				setFeedback('success', 'Mata kuliah berhasil diperbarui.');

				const result = updateCourse.result as
					| {
							id?: string;
							nameChanged?: boolean;
							lecturerChanged?: boolean;
					  }
					| undefined;

				// Refresh courses in background (optimistic update already applied).
				void refreshDependencies({ collections: ['courses'] }).catch((refreshErr) => {
					setCollectionIssue(
						'courses',
						errorMessage(refreshErr, 'Daftar mata kuliah gagal dimuat ulang setelah disimpan.')
					);
				});

				const nameChanged = Boolean(result?.nameChanged);
				const lecturerChanged = Boolean(result?.lecturerChanged);
				if (nameChanged || lecturerChanged) {
					void refreshDependencies({
						collections: nameChanged ? ['enrollments', 'grades'] : ['enrollments'],
						includeSchedulePreview: true
						// conflictAudit refreshes on its own TTL — no immediate recompute
					}).catch((error) => {
						setCollectionIssue(
							'enrollments',
							errorMessage(error, 'Data jadwal terkait mata kuliah gagal dimuat ulang.')
						);
					});
				}
			} catch (error) {
				if (applied) {
					void refreshDependencies({ collections: ['courses'] }).catch(() => {});
				}
				await tick();
				stopEditing('courses');
				const message = (error as { body?: { message?: string }; message?: string })?.body?.message;
				setFeedback('danger', message || (error as Error).message || 'Aksi gagal diproses.');
			}
		}
	);
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
	const updateStudentEnhance = createOptimisticEnhancer(
		updateStudent,
		() => {
			const id = selectedStudentId;
			if (!id) return;
			students = students.map((student) =>
				student.id === id
					? {
							...student,
							name: studentDraft.name,
							email: studentDraft.email,
							phone: studentDraft.phone,
							address: studentDraft.address,
							year_admitted: studentDraft.yearAdmitted,
							study_program_id: studentDraft.studyProgramId
						}
					: student
			);
		},
		async () => {
			await refreshDependencies({
				collections: ['students', 'enrollments', 'grades', 'users'],
				includeSchedulePreview: true,
				includeConflictAudit: true
			});
			stopEditing('students');
			setFeedback('success', 'Profil mahasiswa berhasil diperbarui.');
		},
		async () => {
			await refreshDependencies({
				collections: ['students', 'enrollments', 'grades', 'users'],
				includeSchedulePreview: true,
				includeConflictAudit: true
			});
		}
	);
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
	const updateLecturerEnhance = createOptimisticEnhancer(
		updateLecturer,
		() => {
			const id = selectedLecturerId;
			if (!id) return;
			lecturers = lecturers.map((lecturer) =>
				lecturer.id === id
					? {
							...lecturer,
							name: lecturerDraft.name,
							email: lecturerDraft.email,
							phone: lecturerDraft.phone,
							address: lecturerDraft.address
						}
					: lecturer
			);
		},
		async () => {
			await refreshDependencies({
				collections: ['lecturers', 'courses', 'enrollments', 'users'],
				includeSchedulePreview: true,
				includeConflictAudit: true
			});
			stopEditing('lecturers');
			setFeedback('success', 'Profil dosen berhasil diperbarui.');
		},
		async () => {
			await refreshDependencies({
				collections: ['lecturers', 'courses', 'enrollments', 'users'],
				includeSchedulePreview: true,
				includeConflictAudit: true
			});
		}
	);
	const createFacultyEnhance = createEnhancer(createFaculty, async () => {
		await refreshDependencies({
			collections: ['faculties', 'studyPrograms', 'students']
		});
		clearSelection('faculties');
		stopEditing('faculties');
		setFeedback('success', 'Fakultas baru berhasil ditambahkan.');
	});
	const updateFacultyEnhance = createOptimisticEnhancer(
		updateFaculty,
		() => {
			const id = selectedFacultyId;
			if (!id) return;
			faculties = faculties.map((faculty) =>
				faculty.id === id ? { ...faculty, name: facultyDraft.name } : faculty
			);
		},
		async () => {
			await refreshDependencies({
				collections: ['faculties', 'studyPrograms', 'students']
			});
			stopEditing('faculties');
			setFeedback('success', 'Data fakultas berhasil diperbarui.');
		},
		async () => {
			await refreshDependencies({
				collections: ['faculties', 'studyPrograms', 'students']
			});
		}
	);
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
	const updateStudyProgramEnhance = createOptimisticEnhancer(
		updateStudyProgram,
		() => {
			const id = selectedStudyProgramId;
			if (!id) return;
			studyPrograms = studyPrograms.map((sp) =>
				sp.id === id
					? {
							...sp,
							name: studyProgramDraft.name,
							head: studyProgramDraft.head,
							faculty_id: studyProgramDraft.facultyId
						}
					: sp
			);
		},
		async () => {
			await refreshDependencies({
				collections: ['studyPrograms', 'students', 'courses', 'enrollments', 'grades'],
				includeSchedulePreview: true,
				includeConflictAudit: true
			});
			stopEditing('studyPrograms');
			setFeedback('success', 'Program studi berhasil diperbarui.');
		},
		async () => {
			await refreshDependencies({
				collections: ['studyPrograms', 'students', 'courses', 'enrollments', 'grades'],
				includeSchedulePreview: true,
				includeConflictAudit: true
			});
		}
	);
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
	const updateGradeEnhance = createOptimisticEnhancer(
		updateGrade,
		() => {
			const id = selectedGradeId;
			if (!id) return;
			grades = grades.map((grade) => {
				if (grade.id !== id) return grade;
				const { total, letter } = calculateGrade(
					gradeDraft.assignmentScore,
					gradeDraft.midtermScore,
					gradeDraft.finalScore
				);
				return {
					...grade,
					assignment_score: gradeDraft.assignmentScore,
					midterm_score: gradeDraft.midtermScore,
					final_score: gradeDraft.finalScore,
					total_score: total,
					letter_grade: letter
				};
			});
		},
		async () => {
			await refreshDependencies({ collections: ['grades'] });
			stopEditing('grades');
			setFeedback('success', 'Nilai berhasil diperbarui.');
		},
		async () => {
			await refreshDependencies({ collections: ['grades'] });
		}
	);
	const updateUserEnhance = createOptimisticEnhancer(
		updateUser,
		() => {
			const id = selectedUserId;
			if (!id) return;
			users = users.map((user) =>
				user.id === id
					? ({
							...user,
							email: userDraft.email,
							role: userDraft.role as 'ADMIN' | 'STUDENT' | 'LECTURER',
							student_id: userDraft.studentId || undefined,
							lecturer_id: userDraft.lecturerId || undefined
						} as SelectUsersResult)
					: user
			);
		},
		async () => {
			await refreshDependencies({ collections: ['users'] });
			stopEditing('users');
			setFeedback('success', 'Akun diperbarui. Perubahan akses akan dipakai pada sesi berikutnya.');
		},
		async () => {
			await refreshDependencies({ collections: ['users'] });
		}
	);

	const bulkUpdateUserRoleEnhance = createEnhancer(bulkUpdateUserRoles, async () => {
		await refreshDependencies({ collections: ['users'] });
		clearUserSelection();
		setFeedback('success', 'Peran akun berhasil diperbarui.');
	});
	const bulkResetPasswordEnhance = createEnhancer(bulkResetPasswords, async () => {
		await refreshDependencies({ collections: ['users'] });
		clearUserSelection();
		setFeedback('success', 'Password akun terpilih berhasil direset.');
	});
	const bulkUpdateClassRoomsEnhance = createOptimisticEnhancer(
		bulkUpdateClassRooms,
		() => {
			const ids = new Set(bulkGetIds('classrooms'));
			classrooms = classrooms.map((room) =>
				ids.has(room.id ?? '')
					? {
							...room,
							class_room_type: bulkEditClassRoomType,
							capacity: bulkEditClassRoomCapacity,
							has_projector: bulkEditClassRoomHasProjector ? 1 : 0,
							has_ac: bulkEditClassRoomHasAC ? 1 : 0
						}
					: room
			);
		},
		async () => {
			await refreshDependencies({
				collections: ['classrooms', 'enrollments'],
				includeSchedulePreview: true,
				includeConflictAudit: true
			});
			bulkClear('classrooms');
			stopEditing('classrooms');
			setFeedback('success', 'Ruang terpilih berhasil diperbarui.');
		},
		async () => {
			await refreshDependencies({
				collections: ['classrooms', 'enrollments'],
				includeSchedulePreview: true,
				includeConflictAudit: true
			});
		}
	);
	const bulkUpdateCoursesEnhance = createOptimisticEnhancer(
		bulkUpdateCourses,
		() => {
			const ids = new Set(bulkGetIds('courses'));
			courses = courses.map((course) =>
				ids.has(course.id ?? '')
					? {
							...course,
							credits: bulkEditCourseCredits,
							study_program_id: bulkEditCourseStudyProgramId,
							lecturer_id: bulkEditCourseLecturerId
						}
					: course
			);
		},
		async () => {
			await refreshDependencies({
				collections: ['courses', 'enrollments', 'grades'],
				includeSchedulePreview: true,
				includeConflictAudit: true
			});
			bulkClear('courses');
			stopEditing('courses');
			setFeedback('success', 'Mata kuliah terpilih berhasil diperbarui.');
		},
		async () => {
			await refreshDependencies({
				collections: ['courses', 'enrollments', 'grades'],
				includeSchedulePreview: true,
				includeConflictAudit: true
			});
		}
	);
	const bulkUpdateStudentsEnhance = createOptimisticEnhancer(
		bulkUpdateStudents,
		() => {
			const ids = new Set(bulkGetIds('students'));
			students = students.map((student) =>
				ids.has(student.id ?? '')
					? {
							...student,
							study_program_id: bulkEditStudentStudyProgramId,
							year_admitted: bulkEditStudentYearAdmitted
						}
					: student
			);
		},
		async () => {
			await refreshDependencies({ collections: ['students'] });
			bulkClear('students');
			stopEditing('students');
			setFeedback('success', 'Mahasiswa terpilih berhasil diperbarui.');
		},
		async () => {
			await refreshDependencies({ collections: ['students'] });
		}
	);
	const bulkUpdateLecturersEnhance = createOptimisticEnhancer(
		bulkUpdateLecturers,
		() => {
			const ids = new Set(bulkGetIds('lecturers'));
			lecturers = lecturers.map((lecturer) =>
				ids.has(lecturer.id ?? '')
					? {
							...lecturer,
							name: bulkEditLecturerName || lecturer.name,
							email: bulkEditLecturerEmail || lecturer.email,
							phone: bulkEditLecturerPhone || lecturer.phone,
							address: bulkEditLecturerAddress || lecturer.address
						}
					: lecturer
			);
		},
		async () => {
			await refreshDependencies({ collections: ['lecturers'] });
			bulkClear('lecturers');
			stopEditing('lecturers');
			setFeedback('success', 'Dosen terpilih berhasil diperbarui.');
		},
		async () => {
			await refreshDependencies({ collections: ['lecturers'] });
		}
	);
	const bulkUpdateFacultiesEnhance = createOptimisticEnhancer(
		bulkUpdateFaculties,
		() => {
			const ids = new Set(bulkGetIds('faculties'));
			faculties = faculties.map((faculty) =>
				ids.has(faculty.id ?? '') ? { ...faculty, name: bulkEditFacultyName } : faculty
			);
		},
		async () => {
			await refreshDependencies({ collections: ['faculties', 'studyPrograms'] });
			bulkClear('faculties');
			stopEditing('faculties');
			setFeedback('success', 'Fakultas terpilih berhasil diperbarui.');
		},
		async () => {
			await refreshDependencies({ collections: ['faculties', 'studyPrograms'] });
		}
	);
	const bulkUpdateStudyProgramsEnhance = createOptimisticEnhancer(
		bulkUpdateStudyPrograms,
		() => {
			const ids = new Set(bulkGetIds('studyPrograms'));
			studyPrograms = studyPrograms.map((sp) =>
				ids.has(sp.id ?? '')
					? {
							...sp,
							faculty_id: bulkEditStudyProgramFacultyId,
							head: bulkEditStudyProgramHead
						}
					: sp
			);
		},
		async () => {
			await refreshDependencies({ collections: ['studyPrograms', 'students', 'courses'] });
			bulkClear('studyPrograms');
			stopEditing('studyPrograms');
			setFeedback('success', 'Prodi terpilih berhasil diperbarui.');
		},
		async () => {
			await refreshDependencies({ collections: ['studyPrograms', 'students', 'courses'] });
		}
	);
	const bulkUpdateEnrollmentsEnhance = createOptimisticEnhancer(
		bulkUpdateEnrollments,
		() => {
			const ids = new Set(bulkGetIds('enrollments'));
			enrollments = enrollments.map((enrollment) =>
				ids.has(enrollment.id ?? '')
					? {
							...enrollment,
							semester: bulkEditEnrollmentSemester,
							academic_year: bulkEditEnrollmentAcademicYear
						}
					: enrollment
			);
		},
		async () => {
			await refreshDependencies({
				collections: ['enrollments'],
				includeSchedulePreview: true,
				includeConflictAudit: true
			});
			bulkClear('enrollments');
			editorView = null;
			setFeedback('success', 'KRS terpilih berhasil diperbarui.');
		},
		async () => {
			await refreshDependencies({
				collections: ['enrollments'],
				includeSchedulePreview: true,
				includeConflictAudit: true
			});
		}
	);
	const bulkUpdateGradesEnhance = createOptimisticEnhancer(
		bulkUpdateGrades,
		() => {
			const ids = new Set(bulkGetIds('grades'));
			grades = grades.map((grade) => {
				if (!ids.has(grade.id ?? '')) return grade;
				const assignmentScore =
					bulkEditGradeAssignmentScore !== undefined
						? bulkEditGradeAssignmentScore
						: (grade.assignment_score ?? 0);
				const midtermScore =
					bulkEditGradeMidtermScore !== undefined
						? bulkEditGradeMidtermScore
						: (grade.midterm_score ?? 0);
				const finalScore =
					bulkEditGradeFinalScore !== undefined
						? bulkEditGradeFinalScore
						: (grade.final_score ?? 0);
				const { total, letter } = calculateGrade(assignmentScore, midtermScore, finalScore);
				return {
					...grade,
					assignment_score: assignmentScore,
					midterm_score: midtermScore,
					final_score: finalScore,
					total_score: total,
					letter_grade: letter
				};
			});
		},
		async () => {
			await refreshDependencies({ collections: ['grades'] });
			bulkClear('grades');
			stopEditing('grades');
			setFeedback('success', 'Nilai terpilih berhasil diperbarui.');
		},
		async () => {
			await refreshDependencies({ collections: ['grades'] });
		}
	);

	async function removeEntity(kind: DeleteKind, id: string) {
		if (!pendingDelete) return; // guard against double-click / concurrent delete
		const intent = pendingDelete;
		pendingDelete = null; // prevent re-entry before async completes
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
			if (kind === 'bulk-user') {
				await bulkDeleteUsers(id);
				await refreshDependencies({ collections: ['users'] });
				clearUserSelection();
				selectedUserId = null;
				selectedUserRecord = null;
				userDraft = emptyUserDraft();
				stopEditing('users');
			}
			if (kind === 'bulk-classrooms') {
				await bulkDeleteClassRooms(id);
				await refreshDependencies({
					collections: ['classrooms', 'enrollments'],
					includeSchedulePreview: true,
					includeConflictAudit: true
				});
				bulkClear('classrooms');
				selectedRoomId = null;
				selectedRoomRecord = null;
				stopEditing('classrooms');
			}
			if (kind === 'bulk-courses') {
				await bulkDeleteCourses(id);
				await refreshDependencies({
					collections: ['courses', 'enrollments', 'grades'],
					includeSchedulePreview: true,
					includeConflictAudit: true
				});
				bulkClear('courses');
				selectedCourseId = null;
				selectedCourseRecord = null;
				stopEditing('courses');
			}
			if (kind === 'bulk-students') {
				await bulkDeleteStudents(id);
				await refreshDependencies({
					collections: ['students', 'enrollments', 'grades', 'users'],
					includeSchedulePreview: true,
					includeConflictAudit: true
				});
				bulkClear('students');
				selectedStudentId = null;
				selectedStudentRecord = null;
				stopEditing('students');
			}
			if (kind === 'bulk-lecturers') {
				await bulkDeleteLecturers(id);
				await refreshDependencies({
					collections: ['lecturers', 'courses', 'enrollments', 'users'],
					includeSchedulePreview: true,
					includeConflictAudit: true
				});
				bulkClear('lecturers');
				selectedLecturerId = null;
				selectedLecturerRecord = null;
				stopEditing('lecturers');
			}
			if (kind === 'bulk-faculties') {
				await bulkDeleteFaculties(id);
				await refreshDependencies({
					collections: ['faculties', 'studyPrograms', 'students']
				});
				bulkClear('faculties');
				selectedFacultyId = null;
				selectedFacultyRecord = null;
				stopEditing('faculties');
			}
			if (kind === 'bulk-studyPrograms') {
				await bulkDeleteStudyPrograms(id);
				await refreshDependencies({
					collections: ['studyPrograms', 'students', 'courses', 'enrollments', 'grades'],
					includeSchedulePreview: true,
					includeConflictAudit: true
				});
				bulkClear('studyPrograms');
				selectedStudyProgramId = null;
				selectedStudyProgramRecord = null;
				stopEditing('studyPrograms');
			}
			if (kind === 'bulk-enrollments') {
				await bulkDeleteEnrollments(id);
				await refreshDependencies({
					collections: ['enrollments', 'grades'],
					includeSchedulePreview: true,
					includeConflictAudit: true
				});
				bulkClear('enrollments');
				selectedEnrollmentId = null;
				selectedEnrollmentRecord = null;
				stopEditing();
			}
			if (kind === 'bulk-grades') {
				await bulkDeleteGrades(id);
				await refreshDependencies({ collections: ['grades'] });
				bulkClear('grades');
				selectedGradeId = null;
				selectedGradeRecord = null;
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
			setFeedback(
				'success',
				`${pageHeading(activeView, currentUser.current?.role as AppRole | undefined)} berhasil dimuat ulang.`
			);
		} catch (error) {
			setFeedback(
				'danger',
				errorMessage(
					error,
					`${pageHeading(activeView, currentUser.current?.role as AppRole | undefined)} belum bisa dimuat ulang.`
				)
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
					<h2>{pageHeading(activeView, currentUser.current?.role as AppRole | undefined)}</h2>
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
					<DashboardView
						role={currentUser.current.role as AppRole}
						{nextSchedule}
						{enrollments}
						{grades}
						{studentGradeHighlights}
						{conflictCount}
						{primaryConflict}
						{additionalConflictCount}
						{conflictGroupDetailsById}
						{underusedRooms}
						{classRoomDashboardSummary}
						classRoomDashboardMetrics={classRoomDashboardMetrics?.items ?? []}
						{classRoomDashboardPagination}
						{selectedRoomId}
						conflictedCount={conflictAudit?.summary?.conflictedRooms ?? 0}
						onActivateView={activateView}
						onNavigateToEntity={navigateToEntity}
						onOpenBuilderForSchedule={openBuilderForSchedule}
						onOpenCalendarForSchedule={openCalendarForSchedule}
						onPickRoom={(id) => (selectedRoomId = id)}
						onPreviousPage={() => changeClassRoomDashboardPage('previous')}
						onNextPage={() => changeClassRoomDashboardPage('next')}
						{handleKeyboardClick}
					/>
				{/if}

				{#if activeView === 'calendar'}
					<CalendarView
						bind:enrollmentSearch
						bind:scheduleDayFilter
						bind:scheduleCourseFilter
						bind:scheduleRoomFilter
						bind:scheduleLecturerFilter
						bind:scheduleSemesterFilter
						bind:scheduleAcademicYearFilter
						bind:scheduleRoomFilterSearch
						bind:scheduleRoomFilterOpen
						bind:selectedConflictGroupId
						{calendarWeekLabel}
						{courses}
						{lecturers}
						{scheduleSemesterOptions}
						{scheduleAcademicYearOptions}
						{filteredScheduleCards}
						{scheduleActiveFilterCount}
						{calendarConflictLegend}
						{calendarNeedsFilters}
						{calendarExceedsVisibleLimit}
						calendarMaxVisibleSchedules={CALENDAR_MAX_VISIBLE_SCHEDULES}
						{EventCalendarComponent}
						{calendarPlugins}
						{calendarOptions}
						{calendarDetailSchedule}
						{selectedScheduleConflictSummary}
						{selectedScheduleConflictGroup}
						{selectedScheduleConflictPeers}
						{selectedScheduleOverlapPeers}
						{selectedScheduleId}
						{scheduleRoomFilterOptions}
						{filteredScheduleRoomFilterOptions}
						{scheduleRoomFilterIssue}
						{scheduleRoomFilterLoading}
						{scheduleRoomFilterHasMore}
						selectedScheduleRoomFilterLabel={scheduleRoomFilter
							? (classrooms.find((r) => r.id === scheduleRoomFilter)?.name ?? '')
							: ''}
						{queueCollectionRefresh}
						{queueScheduleRoomFilterRefresh}
						{loadMoreScheduleRoomFilterOptions}
						{resetScheduleFilters}
						{toggleConflictGroup}
						{navigateToEntity}
						{openBuilderForSchedule}
						{focusSchedule}
						{handleKeyboardClick}
					/>
				{/if}

				{#if activeView === 'builder' && currentUser.current.role !== 'STUDENT'}
					<BuilderView
						class="workspace-shell builder-shell"
						bind:enrollmentSearch
						bind:scheduleDayFilter
						bind:scheduleCourseFilter
						bind:scheduleRoomFilter
						bind:scheduleLecturerFilter
						bind:scheduleSemesterFilter
						bind:scheduleAcademicYearFilter
						bind:scheduleCourseFilterSearch
						bind:scheduleRoomFilterSearch
						bind:scheduleLecturerFilterSearch
						bind:scheduleCourseFilterOpen
						bind:scheduleRoomFilterOpen
						bind:scheduleLecturerFilterOpen
						bind:builderConflictOnly
						bind:builderStep
						bind:studentPickerSearch
						bind:coursePickerSearch
						bind:roomPickerSearch
						bind:studentPickerOpen
						bind:coursePickerOpen
						bind:roomPickerOpen
						bind:enrollmentDraft
						{builderTaskMode}
						{selectedEnrollmentId}
						{pendingDelete}
						{filteredBuilderEnrollments}
						{scheduleCardMap}
						auditConflictCardMap={auditConflictCardMap}
						{conflictSummaryByCardId}
						collectionPagination={collectionPagination.enrollments}
						{scheduleSemesterOptions}
						{scheduleAcademicYearOptions}
						{scheduleActiveFilterCount}
						{scheduleCourseFilterOptions}
						{scheduleRoomFilterOptions}
						{filteredScheduleRoomFilterOptions}
						{scheduleLecturerFilterOptions}
						{scheduleCourseFilterIssue}
						{scheduleRoomFilterIssue}
						{scheduleLecturerFilterIssue}
						{scheduleCourseFilterLoading}
						{scheduleRoomFilterLoading}
						{scheduleLecturerFilterLoading}
						{scheduleCourseFilterHasMore}
						{scheduleRoomFilterHasMore}
						{scheduleLecturerFilterHasMore}
						{selectedScheduleCourseFilterLabel}
						{selectedScheduleRoomFilterLabel}
						{selectedScheduleLecturerFilterLabel}
						{selectedEnrollmentScheduleCard}
						{selectedEnrollmentConflictSummary}
						{selectedEnrollmentConflictGroup}
						{selectedDraftStudent}
						{selectedDraftCourse}
						{selectedDraftRoom}
						{draftTimeSummary}
						{filteredRoomsForPicker}
						{builderConflictCards}
						{conflictCount}
						studentPickerOptions={filteredStudentsForPicker}
						coursePickerOptions={filteredCoursesForPicker}
						{studentPickerIssue}
						{coursePickerIssue}
						{roomPickerIssue}
						{studentPickerLoading}
						{coursePickerLoading}
						{roomPickerLoading}
						{studentPickerHasMore}
						{coursePickerHasMore}
						{roomPickerHasMore}
						{createEnrollment}
						{updateEnrollment}
						{createEnrollmentEnhance}
						{updateEnrollmentEnhance}
						{handleKeyboardClick}
						onClearSelection={() => clearSelection('builder')}
						onQueueEnrollmentRefresh={(delay) => queueCollectionRefresh('enrollments', delay)}
						onQueueScheduleCourseFilterRefresh={queueScheduleCourseFilterRefresh}
						onQueueScheduleRoomFilterRefresh={queueScheduleRoomFilterRefresh}
						onQueueScheduleLecturerFilterRefresh={queueScheduleLecturerFilterRefresh}
						onLoadMoreScheduleCourseFilterOptions={loadMoreScheduleCourseFilterOptions}
						onLoadMoreScheduleRoomFilterOptions={loadMoreScheduleRoomFilterOptions}
						onLoadMoreScheduleLecturerFilterOptions={loadMoreScheduleLecturerFilterOptions}
						onPickEnrollment={pickEnrollment}
						onNavigateToEntity={navigateToEntity}
						onResetScheduleFilters={resetScheduleFilters}
						onOpenBuilderForSchedule={openBuilderForSchedule}
						onOpenCalendarForSchedule={openCalendarForSchedule}
						onRequestDeleteEnrollment={() => requestDelete('enrollment', selectedEnrollmentId!)}
						onConfirmDelete={() => removeEntity(pendingDelete!.kind, pendingDelete!.id)}
						onCancelDelete={() => (pendingDelete = null)}
						onQueueStudentPickerRefresh={queueStudentPickerRefresh}
						onQueueCoursePickerRefresh={queueCoursePickerRefresh}
						onQueueRoomPickerRefresh={queueRoomPickerRefresh}
						onLoadMoreStudentPickerOptions={loadMoreStudentPickerOptions}
						onLoadMoreCoursePickerOptions={loadMoreCoursePickerOptions}
						onLoadMoreRoomPickerOptions={loadMoreRoomPickerOptions}
						onPagePrevious={() => void changeCollectionPage('enrollments', 'previous')}
						onPageNext={() => void changeCollectionPage('enrollments', 'next')}
					/>
				{/if}

				{#if activeView === 'classrooms'}
					<ClassroomsView
						currentRole={currentUser.current.role as AppRole}
						bind:roomSearch
						{filteredClassrooms}
						{selectedRoomId}
						{selectedRoom}
						bulkSelectedIds={bulkSelectedIds['classrooms'] ?? new Set()}
						bulkCount={bulkCount('classrooms')}
						bind:classroomDraft
						bind:bulkEditClassRoomType
						bind:bulkEditClassRoomCapacity
						bind:bulkEditClassRoomHasProjector
						bind:bulkEditClassRoomHasAC
						{editorView}
						{pendingDelete}
						collectionPagination={collectionPagination.classrooms}
						{createClassRoom}
						{updateClassRoom}
						{bulkUpdateClassRooms}
						{createClassRoomEnhance}
						{updateClassRoomEnhance}
						{bulkUpdateClassRoomsEnhance}
						{classRoomTypes}
						{beautifyRoomType}
						onSearchInput={() => queueCollectionRefresh('classrooms')}
						onClearSearch={() => {
							roomSearch = '';
							queueCollectionRefresh('classrooms', 0);
						}}
						onBeginCreate={() => beginCreate('classrooms')}
						onBulkClear={() => bulkClear('classrooms')}
						onOpenBulkEdit={() => {
							stopEditing('classrooms');
							editorView = 'classrooms-bulk';
						}}
						onOpenBulkDelete={() => {
							pendingDelete = {
								kind: 'bulk-classrooms',
								id: bulkGetIds('classrooms').join(','),
								label: `${bulkCount('classrooms')} ruang`,
								message: `Anda akan menghapus ${bulkCount('classrooms')} ruang. Tindakan ini tidak dapat dibatalkan.`,
								confirmLabel: 'Ya, hapus semua',
								successMessage: 'Ruang terpilih berhasil dihapus.',
								failureMessage: 'Gagal menghapus ruang terpilih.'
							};
						}}
						onBulkToggleAll={(ids) => bulkToggleAll('classrooms', ids)}
						onBulkToggleId={(id) => bulkToggleId('classrooms', id)}
						onPickClassroom={pickClassroom}
						{handleKeyboardClick}
						onNavigateToEntity={navigateToEntity}
						onBeginEdit={() => beginEdit('classrooms')}
						onStopEditing={() => stopEditing('classrooms')}
						onRequestDelete={() => requestDelete('classroom', selectedRoomId!)}
						onConfirmDelete={() => removeEntity(pendingDelete!.kind, pendingDelete!.id)}
						onCancelDelete={() => (pendingDelete = null)}
						onPagePrevious={() => void changeCollectionPage('classrooms', 'previous')}
						onPageNext={() => void changeCollectionPage('classrooms', 'next')}
					/>
				{/if}

				{#if activeView === 'courses'}
					<CoursesView
						currentRole={currentUser.current.role as AppRole}
						bind:courseSearch
						{filteredCourses}
						{selectedCourseId}
						{selectedCourse}
						bulkSelectedIds={bulkSelectedIds['courses'] ?? new Set()}
						bulkCount={bulkCount('courses')}
						bind:courseDraft
						bind:bulkEditCourseCredits
						bind:bulkEditCourseStudyProgramId
						bind:bulkEditCourseLecturerId
						{editorView}
						{pendingDelete}
						collectionPagination={collectionPagination.courses}
						{updateCourseEnhance}
						{createCourseEnhance}
						{bulkUpdateCoursesEnhance}
						{studyPrograms}
						{lecturers}
						studyProgramsIssue={collectionIssues.studyPrograms}
						lecturersIssue={collectionIssues.lecturers}
						{courseEditorBlocked}
						onSearchInput={() => queueCollectionRefresh('courses')}
						onClearSearch={() => {
							courseSearch = '';
							queueCollectionRefresh('courses', 0);
						}}
						onBeginCreate={() => beginCreate('courses')}
						onBulkClear={() => bulkClear('courses')}
						onOpenBulkEdit={() => {
							stopEditing('courses');
							editorView = 'courses-bulk';
						}}
						onOpenBulkDelete={() => {
							pendingDelete = {
								kind: 'bulk-courses',
								id: bulkGetIds('courses').join(','),
								label: `${bulkCount('courses')} mata kuliah`,
								message: `Anda akan menghapus ${bulkCount('courses')} mata kuliah. Tindakan ini tidak dapat dibatalkan.`,
								confirmLabel: 'Ya, hapus semua',
								successMessage: 'Mata kuliah terpilih berhasil dihapus.',
								failureMessage: 'Gagal menghapus mata kuliah terpilih.'
							};
						}}
						onBulkToggleAll={(ids) => bulkToggleAll('courses', ids)}
						onBulkToggleId={(id) => bulkToggleId('courses', id)}
						onPickCourse={pickCourse}
						{handleKeyboardClick}
						onNavigateToEntity={navigateToEntity}
						onBeginEdit={() => beginEdit('courses')}
						onStopEditing={() => stopEditing('courses')}
						onRequestDelete={() => requestDelete('course', selectedCourseId!)}
						onConfirmDelete={() => removeEntity(pendingDelete!.kind, pendingDelete!.id)}
						onCancelDelete={() => (pendingDelete = null)}
						onPagePrevious={() => void changeCollectionPage('courses', 'previous')}
						onPageNext={() => void changeCollectionPage('courses', 'next')}
					/>
				{/if}

				{#if activeView === 'students' && currentUser.current.role !== 'STUDENT'}
					<StudentsView
						currentRole={currentUser.current.role as AppRole}
						bind:studentSearch
						{filteredStudents}
						{selectedStudentId}
						{selectedStudent}
						bulkSelectedIds={bulkSelectedIds['students'] ?? new Set()}
						bulkCount={bulkCount('students')}
						bind:studentDraft
						bind:bulkEditStudentStudyProgramId
						bind:bulkEditStudentYearAdmitted
						{editorView}
						{pendingDelete}
						collectionPagination={collectionPagination.students}
						{createStudent}
						{updateStudent}
						{bulkUpdateStudents}
						{createStudentEnhance}
						{updateStudentEnhance}
						{bulkUpdateStudentsEnhance}
						{studyPrograms}
						studyProgramsIssue={collectionIssues.studyPrograms}
						{studentEditorBlocked}
						onSearchInput={() => queueCollectionRefresh('students')}
						onClearSearch={() => {
							studentSearch = '';
							queueCollectionRefresh('students', 0);
						}}
						onBeginCreate={() => beginCreate('students')}
						onBulkClear={() => bulkClear('students')}
						onOpenBulkEdit={() => {
							stopEditing('students');
							editorView = 'students-bulk';
						}}
						onOpenBulkDelete={() => {
							pendingDelete = {
								kind: 'bulk-students',
								id: bulkGetIds('students').join(','),
								label: `${bulkCount('students')} mahasiswa`,
								message: `Anda akan menghapus ${bulkCount('students')} mahasiswa. Tindakan ini tidak dapat dibatalkan.`,
								confirmLabel: 'Ya, hapus semua',
								successMessage: 'Mahasiswa terpilih berhasil dihapus.',
								failureMessage: 'Gagal menghapus mahasiswa terpilih.'
							};
						}}
						onBulkToggleAll={(ids) => bulkToggleAll('students', ids)}
						onBulkToggleId={(id) => bulkToggleId('students', id)}
						onPickStudent={pickStudent}
						{handleKeyboardClick}
						onNavigateToEntity={navigateToEntity}
						onBeginEdit={() => beginEdit('students')}
						onStopEditing={() => stopEditing('students')}
						onRequestDelete={() => requestDelete('student', selectedStudentId!)}
						onConfirmDelete={() => removeEntity(pendingDelete!.kind, pendingDelete!.id)}
						onCancelDelete={() => (pendingDelete = null)}
						onPagePrevious={() => void changeCollectionPage('students', 'previous')}
						onPageNext={() => void changeCollectionPage('students', 'next')}
					/>
				{/if}

				{#if activeView === 'lecturers'}
					<LecturersView
						currentRole={currentUser.current.role as AppRole}
						bind:lecturerSearch
						{filteredLecturers}
						{selectedLecturerId}
						{selectedLecturer}
						bulkSelectedIds={bulkSelectedIds['lecturers'] ?? new Set()}
						bulkCount={bulkCount('lecturers')}
						bind:lecturerDraft
						bind:bulkEditLecturerName
						bind:bulkEditLecturerEmail
						bind:bulkEditLecturerPhone
						bind:bulkEditLecturerAddress
						{editorView}
						{pendingDelete}
						collectionPagination={collectionPagination.lecturers}
						{createLecturer}
						{updateLecturer}
						{bulkUpdateLecturers}
						{createLecturerEnhance}
						{updateLecturerEnhance}
						{bulkUpdateLecturersEnhance}
						onSearchInput={() => queueCollectionRefresh('lecturers')}
						onClearSearch={() => {
							lecturerSearch = '';
							queueCollectionRefresh('lecturers', 0);
						}}
						onBeginCreate={() => beginCreate('lecturers')}
						onBulkClear={() => bulkClear('lecturers')}
						onOpenBulkEdit={() => {
							stopEditing('lecturers');
							editorView = 'lecturers-bulk';
						}}
						onOpenBulkDelete={() => {
							pendingDelete = {
								kind: 'bulk-lecturers',
								id: bulkGetIds('lecturers').join(','),
								label: `${bulkCount('lecturers')} dosen`,
								message: `Anda akan menghapus ${bulkCount('lecturers')} dosen. Tindakan ini tidak dapat dibatalkan.`,
								confirmLabel: 'Ya, hapus semua',
								successMessage: 'Dosen terpilih berhasil dihapus.',
								failureMessage: 'Gagal menghapus dosen terpilih.'
							};
						}}
						onBulkToggleAll={(ids) => bulkToggleAll('lecturers', ids)}
						onBulkToggleId={(id) => bulkToggleId('lecturers', id)}
						onPickLecturer={pickLecturer}
						{handleKeyboardClick}
						onNavigateToEntity={navigateToEntity}
						onBeginEdit={() => beginEdit('lecturers')}
						onStopEditing={() => stopEditing('lecturers')}
						onRequestDelete={() => requestDelete('lecturer', selectedLecturerId!)}
						onConfirmDelete={() => removeEntity(pendingDelete!.kind, pendingDelete!.id)}
						onCancelDelete={() => (pendingDelete = null)}
						onPagePrevious={() => void changeCollectionPage('lecturers', 'previous')}
						onPageNext={() => void changeCollectionPage('lecturers', 'next')}
					/>
				{/if}

				{#if activeView === 'faculties' && currentUser.current.role !== 'STUDENT'}
					<FacultiesView
						currentRole={currentUser.current.role as AppRole}
						bind:facultySearch
						{filteredFaculties}
						{selectedFacultyId}
						{selectedFaculty}
						bulkSelectedIds={bulkSelectedIds['faculties'] ?? new Set()}
						bulkCount={bulkCount('faculties')}
						bind:facultyDraft
						bind:bulkEditFacultyName
						{editorView}
						{pendingDelete}
						collectionPagination={collectionPagination.faculties}
						{createFaculty}
						{updateFaculty}
						{bulkUpdateFaculties}
						{createFacultyEnhance}
						{updateFacultyEnhance}
						{bulkUpdateFacultiesEnhance}
						onSearchInput={() => queueCollectionRefresh('faculties')}
						onClearSearch={() => {
							facultySearch = '';
							queueCollectionRefresh('faculties', 0);
						}}
						onBeginCreate={() => beginCreate('faculties')}
						onBulkClear={() => bulkClear('faculties')}
						onOpenBulkEdit={() => {
							stopEditing('faculties');
							editorView = 'faculties-bulk';
						}}
						onOpenBulkDelete={() => {
							pendingDelete = {
								kind: 'bulk-faculties',
								id: bulkGetIds('faculties').join(','),
								label: `${bulkCount('faculties')} fakultas`,
								message: `Anda akan menghapus ${bulkCount('faculties')} fakultas. Tindakan ini tidak dapat dibatalkan.`,
								confirmLabel: 'Ya, hapus semua',
								successMessage: 'Fakultas terpilih berhasil dihapus.',
								failureMessage: 'Gagal menghapus fakultas terpilih.'
							};
						}}
						onBulkToggleAll={(ids) => bulkToggleAll('faculties', ids)}
						onBulkToggleId={(id) => bulkToggleId('faculties', id)}
						onPickFaculty={pickFaculty}
						{handleKeyboardClick}
						onNavigateToEntity={navigateToEntity}
						onBeginEdit={() => beginEdit('faculties')}
						onStopEditing={() => stopEditing('faculties')}
						onRequestDelete={() => requestDelete('faculty', selectedFacultyId!)}
						onConfirmDelete={() => removeEntity(pendingDelete!.kind, pendingDelete!.id)}
						onCancelDelete={() => (pendingDelete = null)}
						onPagePrevious={() => void changeCollectionPage('faculties', 'previous')}
						onPageNext={() => void changeCollectionPage('faculties', 'next')}
					/>
				{/if}

				{#if activeView === 'studyPrograms' && currentUser.current.role !== 'STUDENT'}
					<StudyProgramsView
						currentRole={currentUser.current.role as AppRole}
						bind:studyProgramSearch
						{filteredStudyPrograms}
						{selectedStudyProgramId}
						{selectedStudyProgram}
						bulkSelectedIds={bulkSelectedIds['studyPrograms'] ?? new Set()}
						bulkCount={bulkCount('studyPrograms')}
						bind:studyProgramDraft
						bind:bulkEditStudyProgramFacultyId
						bind:bulkEditStudyProgramHead
						{editorView}
						{pendingDelete}
						collectionPagination={collectionPagination.studyPrograms}
						{createStudyProgram}
						{updateStudyProgram}
						{bulkUpdateStudyPrograms}
						{createStudyProgramEnhance}
						{updateStudyProgramEnhance}
						{bulkUpdateStudyProgramsEnhance}
						{faculties}
						facultiesIssue={collectionIssues.faculties}
						{studyProgramEditorBlocked}
						onSearchInput={() => queueCollectionRefresh('studyPrograms')}
						onClearSearch={() => {
							studyProgramSearch = '';
							queueCollectionRefresh('studyPrograms', 0);
						}}
						onBeginCreate={() => beginCreate('studyPrograms')}
						onBulkClear={() => bulkClear('studyPrograms')}
						onOpenBulkEdit={() => {
							stopEditing('studyPrograms');
							editorView = 'studyPrograms-bulk';
						}}
						onOpenBulkDelete={() => {
							pendingDelete = {
								kind: 'bulk-studyPrograms',
								id: bulkGetIds('studyPrograms').join(','),
								label: `${bulkCount('studyPrograms')} prodi`,
								message: `Anda akan menghapus ${bulkCount('studyPrograms')} prodi. Tindakan ini tidak dapat dibatalkan.`,
								confirmLabel: 'Ya, hapus semua',
								successMessage: 'Prodi terpilih berhasil dihapus.',
								failureMessage: 'Gagal menghapus prodi terpilih.'
							};
						}}
						onBulkToggleAll={(ids) => bulkToggleAll('studyPrograms', ids)}
						onBulkToggleId={(id) => bulkToggleId('studyPrograms', id)}
						onPickStudyProgram={pickStudyProgram}
						{handleKeyboardClick}
						onNavigateToEntity={navigateToEntity}
						onBeginEdit={() => beginEdit('studyPrograms')}
						onStopEditing={() => stopEditing('studyPrograms')}
						onRequestDelete={() => requestDelete('studyProgram', selectedStudyProgramId!)}
						onConfirmDelete={() => removeEntity(pendingDelete!.kind, pendingDelete!.id)}
						onCancelDelete={() => (pendingDelete = null)}
						onPagePrevious={() => void changeCollectionPage('studyPrograms', 'previous')}
						onPageNext={() => void changeCollectionPage('studyPrograms', 'next')}
					/>
				{/if}

				{#if activeView === 'enrollments'}
					<EnrollmentsView
						currentRole={currentUser.current.role as AppRole}
						bind:enrollmentSearch
						{filteredEnrollments}
						{selectedEnrollmentId}
						{selectedEnrollment}
						{selectedEnrollmentConflictSummary}
						{selectedEnrollmentConflictGroup}
						scheduleCardMap={scheduleCardMap}
						conflictSummaryByCardId={conflictSummaryByCardId}
						bind:scheduleDayFilter
						bind:scheduleCourseFilter
						bind:scheduleRoomFilter
						bind:scheduleLecturerFilter
						bind:scheduleSemesterFilter
						bind:scheduleAcademicYearFilter
						{courses}
						{lecturers}
						{scheduleSemesterOptions}
						{scheduleAcademicYearOptions}
						{scheduleActiveFilterCount}
						bulkSelectedIds={bulkSelectedIds['enrollments'] ?? new Set()}
						bulkCount={bulkCount('enrollments')}
						{editorView}
						{pendingDelete}
						collectionPagination={collectionPagination.enrollments}
						{bulkUpdateEnrollmentsEnhance}
						{days}
						{timezone}
						{handleKeyboardClick}
						onNavigateToEntity={navigateToEntity}
						onOpenBuilderForEnrollment={openBuilderForEnrollment}
						onSearchInput={() => queueCollectionRefresh('enrollments')}
						onClearSearch={() => {
							enrollmentSearch = '';
							queueCollectionRefresh('enrollments', 0);
						}}
						onResetScheduleFilters={resetScheduleFilters}
						onBulkClear={() => bulkClear('enrollments')}
						onOpenBulkEdit={() => {
							editorView = 'enrollments-bulk';
						}}
						onOpenBulkDelete={() => {
							pendingDelete = {
								kind: 'bulk-enrollments',
								id: bulkGetIds('enrollments').join(','),
								label: `${bulkCount('enrollments')} KRS`,
								message: `Anda akan menghapus ${bulkCount('enrollments')} KRS. Tindakan ini tidak dapat dibatalkan.`,
								confirmLabel: 'Ya, hapus semua',
								successMessage: 'KRS terpilih berhasil dihapus.',
								failureMessage: 'Gagal menghapus KRS terpilih.'
							};
						}}
						onBulkToggleAll={(ids) => bulkToggleAll('enrollments', ids)}
						onBulkToggleId={(id) => bulkToggleId('enrollments', id)}
						onPickEnrollment={pickEnrollment}
						onPagePrevious={() => void changeCollectionPage('enrollments', 'previous')}
						onPageNext={() => void changeCollectionPage('enrollments', 'next')}
						onDayChange={() => queueCollectionRefresh('enrollments', 0)}
						onCourseFilterChange={() => queueCollectionRefresh('enrollments', 0)}
						onSemesterFilterChange={() => queueCollectionRefresh('enrollments', 0)}
						onAcademicYearFilterChange={() => queueCollectionRefresh('enrollments', 0)}
					/>
				{/if}


				{#if activeView === 'grades'}
					<GradesView
						currentRole={currentUser.current.role as AppRole}
						bind:gradeSearch
						{filteredGrades}
						{selectedGradeId}
						{selectedGrade}
						{selectedGradeEnrollment}
						bulkSelectedIds={bulkSelectedIds['grades'] ?? new Set()}
						bulkCount={bulkCount('grades')}
						bind:gradeDraft
						bind:bulkEditGradeAssignmentScore
						bind:bulkEditGradeMidtermScore
						bind:bulkEditGradeFinalScore
						bind:gradeLetterFilter
						bind:gradeCourseFilter
						{editorView}
						{pendingDelete}
						collectionPagination={collectionPagination.grades}
						{bulkUpdateGrades}
						{createGradeEnhance}
						{updateGradeEnhance}
						{bulkUpdateGradesEnhance}
						{enrollments}
						{courses}
						enrollmentsIssue={collectionIssues.enrollments}
						{gradeEditorBlocked}
						onSearchInput={() => queueCollectionRefresh('grades')}
						onClearSearch={() => {
							gradeSearch = '';
							queueCollectionRefresh('grades', 0);
						}}
						onBulkClear={() => bulkClear('grades')}
						onOpenBulkEdit={() => {
							stopEditing('grades');
							editorView = 'grades-bulk';
						}}
						onOpenBulkDelete={() => {
							pendingDelete = {
								kind: 'bulk-grades',
								id: bulkGetIds('grades').join(','),
								label: `${bulkCount('grades')} nilai`,
								message: `Anda akan menghapus ${bulkCount('grades')} nilai. Tindakan ini tidak dapat dibatalkan.`,
								confirmLabel: 'Ya, hapus semua',
								successMessage: 'Nilai terpilih berhasil dihapus.',
								failureMessage: 'Gagal menghapus nilai terpilih.'
							};
						}}
						onBulkToggleAll={(ids) => bulkToggleAll('grades', ids)}
						onBulkToggleId={(id) => bulkToggleId('grades', id)}
						onPickGrade={pickGrade}
						{handleKeyboardClick}
						onNavigateToEntity={navigateToEntity}
						onBeginCreate={() => beginCreate('grades')}
						onBeginEdit={() => beginEdit('grades')}
						onStopEditing={() => stopEditing('grades')}
						onRequestDelete={() => requestDelete('grade', selectedGradeId!)}
						onConfirmDelete={() => removeEntity(pendingDelete!.kind, pendingDelete!.id)}
						onCancelDelete={() => (pendingDelete = null)}
						onPagePrevious={() => void changeCollectionPage('grades', 'previous')}
						onPageNext={() => void changeCollectionPage('grades', 'next')}
						onGradeLetterFilterChange={() => queueCollectionRefresh('grades', 0)}
						onGradeCourseFilterChange={() => queueCollectionRefresh('grades', 0)}
					/>
				{/if}

				{#if activeView === 'users' && currentUser.current.role === 'ADMIN'}
					<UsersView
						bind:userSearch
						{filteredUsers}
						{selectedUserId}
						{selectedUser}
						{selectedUserIds}
						bind:bulkUserRole
						bind:bulkUserPassword
						bind:userDraft
						{editorView}
						collectionPagination={collectionPagination.users}
						{updateUserEnhance}
						{bulkUpdateUserRoleEnhance}
						{bulkResetPasswordEnhance}
						bulkResetPasswordsPending={bulkResetPasswords.pending > 0}
						onSearchInput={() => queueCollectionRefresh('users')}
						onClearSearch={() => {
							userSearch = '';
							queueCollectionRefresh('users', 0);
						}}
						onClearSelection={clearUserSelection}
						onOpenBulkRole={() => {
							stopEditing('users');
							editorView = 'users-bulk-role';
						}}
						onOpenBulkPassword={() => {
							stopEditing('users');
							editorView = 'users-bulk-password';
						}}
						onOpenBulkDelete={() => {
							pendingDelete = {
								kind: 'bulk-user',
								id: [...selectedUserIds].join(','),
								label: `${selectedUserIds.size} akun`,
								message: `Anda akan menghapus ${selectedUserIds.size} akun. Tindakan ini tidak dapat dibatalkan.`,
								confirmLabel: 'Ya, hapus semua',
								successMessage: 'Akun terpilih berhasil dihapus.',
								failureMessage: 'Gagal menghapus akun terpilih.'
							};
						}}
						onToggleAllUsers={toggleAllUsers}
						onToggleUser={(id) => toggleUserSelection(id)}
						onPickUser={pickUser}
						{handleKeyboardClick}
						onNavigateToEntity={navigateToEntity}
						onBeginEdit={() => beginEdit('users')}
						onStopEditing={() => stopEditing('users')}
						onPagePrevious={() => void changeCollectionPage('users', 'previous')}
						onPageNext={() => void changeCollectionPage('users', 'next')}
					/>
				{/if}
			{/if}
		</main>
	</div>
{:else}
	<div class="login-shell">
		<Card.Root class="login-panel">
			<Card.Header class="login-header">
				<div class="login-actions">
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
			<Card.Content class="login-content">
				<form class="login-form" {...loginEnhance}>
					<div class="login-field">
						<Label for="email-login">Email</Label>
						<Input
							id="email-login"
							{...loginUser.fields.email.as('email')}
							autocomplete="email"
							placeholder="nama@kampus.ac.id"
						/>
					</div>
					<div class="login-field">
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
