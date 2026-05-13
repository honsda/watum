<script lang="ts">
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { browser } from '$app/environment';
	import { onDestroy, onMount, untrack, tick } from 'svelte';
	import type { Component } from 'svelte';
	import { clearAccessToken, ensureAccessToken, setAccessToken } from '$lib/client/auth';
	import { AlertCircle, Menu, MoonStar, RotateCw, SunMedium, X } from '@lucide/svelte';
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
	import { formatDateTime, getTimeComponents } from '$lib/time-helpers';
	import {
		headerAction,
		navigationForRole,
		navigationGroupsForRole,
		pageHeading,
		viewCatalog,
		type ViewId
	} from '$lib/app/navigation';
	import { collectionFallbackMessages, viewDataPlanForRole } from '$lib/app/collection-config';
	import {
		createDefaultEnrollmentPolicy,
		normalizeEnrollmentPolicy,
		type EnrollmentPolicy
	} from '$lib/app/enrollment-policy';
	import { bindableLink, createBindableFacade } from '$lib/app/bindable-facade';
	import {
		buildBuilderViewProps,
		buildCalendarViewProps,
		buildBulkViewBase,
		buildCrudEntityViewProps,
		buildDashboardViewProps,
		buildEnrollmentsViewProps,
		buildPaginationActions,
		buildSearchActions,
		buildUsersViewProps
	} from '$lib/app/view-prop-builders';
	import { selectEntityRecord } from '$lib/app/entity-selection';
	import { buildEntityDeleteIntent } from '$lib/app/delete-intents';
	import { runDeletePlan } from '$lib/app/delete-runner';
	import { loadCollection, loadCollectionPage } from '$lib/app/collection-page';
	import {
		canLoadMoreOptionList,
		queueOptionRefresh,
		refreshOptionList
	} from '$lib/app/option-list-refresh';
	import {
		errorMessage,
		mergeItemsById,
		normalizedSearchValue,
		resolveRemoteQuery
	} from '$lib/app/remote-utils';
	import { createSimpleSearchRequester } from '$lib/app/search-requesters';
	import {
		classroomScheduleRefreshPlan,
		cloneRefreshPlan,
		courseScheduleGradesRefreshPlan,
		enrollmentGradesRefreshPlan,
		facultyDeleteRefreshPlan,
		facultyUpdateRefreshPlan,
		gradesRefreshPlan,
		lecturerCourseUsersRefreshPlan,
		lecturersRefreshPlan,
		studentAcademicUsersRefreshPlan,
		studentsRefreshPlan,
		studyProgramAcademicRefreshPlan,
		studyProgramUpdateRefreshPlan,
		usersRefreshPlan
	} from '$lib/app/refresh-plans';
	import {
		buildCreateRefreshEnhancer,
		buildOptimisticRefreshEnhancer,
		createRefreshSuccess
	} from '$lib/app/mutation-effects';
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
		bulkUpdateEnrollments,
		getEnrollmentPolicy,
		updateEnrollmentPolicy,
		requestEnrollment,
		approveEnrollment,
		rejectEnrollment,
		cancelEnrollmentRequest
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
	type PendingDeleteIntent = {
		kind: DeleteKind;
		id: string;
		label: string;
		message: string;
		confirmLabel: string;
		successMessage: string;
		failureMessage: string;
	};

	type BuilderStep = 'participant' | 'time' | 'room' | 'review';
	type BuilderMode = 'create' | 'edit' | 'approve';
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
	let timezone = $state('Asia/Jakarta');
	const DEFAULT_DAY_START = 7 * 60;
	const DEFAULT_DAY_END = 20 * 60;
	const RANGE_PADDING_MINUTES = 60;
	const MIN_VISIBLE_MINUTES = 6 * 60;
	const CALENDAR_MAX_VISIBLE_SCHEDULES = 60;
	const CALENDAR_DAY_INDEX: Record<(typeof DAY_ORDER)[number], number> = {
		SENIN: 1,
		SELASA: 2,
		RABU: 3,
		KAMIS: 4,
		JUMAT: 5,
		SABTU: 6
	};

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

	function schedulesOverlap(left: ScheduleCard, right: ScheduleCard) {
		return (
			left.id !== right.id &&
			left.day === right.day &&
			left.startMinutes < right.endMinutes &&
			right.startMinutes < left.endMinutes
		);
	}

	function clearScheduleCardConflict(card: ScheduleCard): ScheduleCard {
		if (!card.hasConflict && !card.conflictGroupId && card.conflictTone == null) return card;
		return { ...card, hasConflict: false, conflictGroupId: null, conflictTone: null };
	}

	function scheduleSessionKey(card: ScheduleCard) {
		return card.original.schedule_id
			? `schedule:${card.original.schedule_id}`
			: `enrollment:${card.id}`;
	}

	function mergeCalendarSessionCards(
		cards: ScheduleCard[],
		preferredConflictGroupId: string | null
	) {
		const sessions = new Map<string, ScheduleCard>();

		for (const card of cards) {
			const key = scheduleSessionKey(card);
			const existing = sessions.get(key);
			if (!existing) {
				sessions.set(key, card);
				continue;
			}

			const prefersCurrentConflictGroup =
				preferredConflictGroupId && card.conflictGroupId === preferredConflictGroupId;
			const shouldUseCurrent =
				Boolean(prefersCurrentConflictGroup) || (!existing.hasConflict && card.hasConflict);
			const base = shouldUseCurrent ? card : existing;
			sessions.set(key, {
				...base,
				studentCount: Math.max(existing.studentCount, card.studentCount)
			});
		}

		return [...sessions.values()];
	}

	function idsFingerprint(items: Array<{ id?: string | null }>) {
		return items
			.map((item) => item.id)
			.filter(Boolean)
			.join('|');
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
			schedule_end_time: member.endTime,
			status: 'APPROVED'
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
			studentCount: 1,
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

	function clearCalendarSelection() {
		selectedScheduleId = null;
		selectedConflictGroupId = null;
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
		if (view === 'calendar' && activeView !== 'calendar') {
			clearCalendarSelection();
		}
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

	function enrollmentDraftFromRecord(item: SelectEnrollmentsResult) {
		return {
			id: item.id ?? '',
			studentId: item.student_id ?? '',
			courseId: item.course_id ?? '',
			classRoomId: item.class_room_id ?? '',
			day: item.schedule_day ?? 'SENIN',
			startTime: item.schedule_start_time
				? formatDateTime(item.schedule_start_time, 'time', timezone)
				: '',
			endTime: item.schedule_end_time
				? formatDateTime(item.schedule_end_time, 'time', timezone)
				: '',
			semester: normalizeSemesterValue(item.semester),
			academicYear: item.academic_year ?? '2025/2026',
			timezone
		};
	}

	function enrollmentDraftMatches(left: typeof enrollmentDraft, right: typeof enrollmentDraft) {
		return (
			left.id === right.id &&
			left.studentId === right.studentId &&
			left.courseId === right.courseId &&
			left.classRoomId === right.classRoomId &&
			left.day === right.day &&
			left.startTime === right.startTime &&
			left.endTime === right.endTime &&
			left.semester === right.semester &&
			left.academicYear === right.academicYear &&
			left.timezone === right.timezone
		);
	}

	function syncEnrollmentPickerLabels(item: SelectEnrollmentsResult) {
		const pickedStudent = item.student_id ? studentPickerLookup.get(item.student_id) : undefined;
		const pickedCourse = item.course_id ? coursePickerLookup.get(item.course_id) : undefined;
		studentPickerSearch = pickedStudent?.name ?? item.student_name ?? '';
		coursePickerSearch = pickedCourse?.name ?? item.course_name ?? '';
		roomPickerSearch = item.class_room_name ?? '';
	}

	async function hydratePickedEnrollment(id: string, seededDraft: typeof enrollmentDraft) {
		try {
			const full = await getEnrollment(id).run();
			if (selectedEnrollmentId !== id) return;

			selectedEnrollmentRecord = full;
			if (!enrollmentDraftMatches(enrollmentDraft, seededDraft)) return;

			enrollmentDraft = enrollmentDraftFromRecord(full);
			syncEnrollmentPickerLabels(full);
		} catch {
			// The preview row is still usable if the follow-up hydration is unavailable.
		}
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

	function roundDownHour(minutes: number) {
		return Math.floor(minutes / 60) * 60;
	}

	function clampCalendarMinute(minutes: number) {
		return Math.max(0, Math.min(minutes, 24 * 60));
	}

	function rangeForScheduleCards(cards: ScheduleCard[]) {
		const validCards = cards.filter(
			(card) =>
				Number.isFinite(card.startMinutes) &&
				Number.isFinite(card.endMinutes) &&
				card.endMinutes > card.startMinutes
		);

		if (!validCards.length) {
			return { start: DEFAULT_DAY_START, end: DEFAULT_DAY_END };
		}

		const firstStart = Math.min(...validCards.map((card) => card.startMinutes));
		const lastEnd = Math.max(...validCards.map((card) => card.endMinutes));
		let start = roundDownHour(clampCalendarMinute(firstStart - RANGE_PADDING_MINUTES));
		let end = roundUpHour(clampCalendarMinute(lastEnd + RANGE_PADDING_MINUTES));

		if (end - start < MIN_VISIBLE_MINUTES) {
			const midpoint = (start + end) / 2;
			start = roundDownHour(clampCalendarMinute(midpoint - MIN_VISIBLE_MINUTES / 2));
			end = Math.min(start + MIN_VISIBLE_MINUTES, 24 * 60);

			if (end - start < MIN_VISIBLE_MINUTES) {
				start = Math.max(0, end - MIN_VISIBLE_MINUTES);
			}
		}

		return { start, end };
	}

	function timeString(minutes: number) {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
	}

	function visibleDaysForCalendar(cards: ScheduleCard[], dayFilter: string) {
		if (dayFilter && dayFilter in CALENDAR_DAY_INDEX) {
			return [dayFilter as (typeof DAY_ORDER)[number]];
		}

		const daysWithSessions = new Set(cards.map((card) => card.day));
		const visibleDays = DAY_ORDER.filter((day) => daysWithSessions.has(day));
		return visibleDays.length ? visibleDays : DAY_ORDER;
	}

	function hiddenDaysForCalendar(visibleDays: ReadonlyArray<(typeof DAY_ORDER)[number]>) {
		const visibleIndexes = new Set(visibleDays.map((day) => CALENDAR_DAY_INDEX[day]));
		return [0, 1, 2, 3, 4, 5, 6].filter((dayIndex) => !visibleIndexes.has(dayIndex));
	}

	function calendarColumnWidth(visibleDayCount: number) {
		if (visibleDayCount <= 1) return 'minmax(18rem, 1fr)';
		if (visibleDayCount === 2) return 'minmax(16rem, 1fr)';
		if (visibleDayCount === 3) return 'minmax(14rem, 1fr)';
		return 'minmax(11.5rem, 1fr)';
	}

	function calendarSlotHeight(visibleDayCount: number) {
		if (visibleDayCount <= 2) return 42;
		if (visibleDayCount === 3) return 38;
		return 34;
	}

	function dateForCalendarDay(day: (typeof DAY_ORDER)[number]) {
		const date = createCalendarAnchorDate(calendarWeekOffset);
		date.setDate(date.getDate() + DAY_ORDER.indexOf(day));
		return date;
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
		const date = dateForCalendarDay(card.day);
		date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
		return date;
	}

	function isApprovedScheduleCard(card: ScheduleCard) {
		return !card.original.status || card.original.status === 'APPROVED';
	}

	function upcomingScheduleRank(card: ScheduleCard, now = new Date()) {
		if (!isApprovedScheduleCard(card)) return Number.POSITIVE_INFINITY;
		const { dayOfWeek } = getTimeComponents(now, timezone);
		const currentDayIndex = dayOfWeek >= 1 && dayOfWeek <= DAY_ORDER.length ? dayOfWeek - 1 : 0;
		const currentMinutes =
			dayOfWeek >= 1 && dayOfWeek <= DAY_ORDER.length ? toMinutes(now, timezone) : 0;
		const dayDelta = DAY_ORDER.indexOf(card.day) - currentDayIndex;
		if (dayDelta < 0 || (dayDelta === 0 && card.endMinutes <= currentMinutes)) {
			return Number.POSITIVE_INFINITY;
		}
		return dayDelta * 24 * 60 + card.startMinutes;
	}

	function sortUpcomingSchedules(cards: ScheduleCard[], now = new Date()) {
		return cards
			.map((card) => ({ card, rank: upcomingScheduleRank(card, now) }))
			.filter(({ rank }) => Number.isFinite(rank))
			.sort((left, right) => left.rank - right.rank)
			.map(({ card }) => card);
	}

	function sortWeeklySchedules(cards: ScheduleCard[]) {
		return [...cards].filter(isApprovedScheduleCard).sort((left, right) => {
			const dayDelta = DAY_ORDER.indexOf(left.day) - DAY_ORDER.indexOf(right.day);
			return dayDelta === 0 ? left.startMinutes - right.startMinutes : dayDelta;
		});
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
	let pendingDelete = $state<PendingDeleteIntent | null>(null);
	let feedback = $state<Feedback>(null);
	let appLoading = $state(false);
	let viewRefreshLoading = $state(false);
	let scheduleNow = $state(new Date());
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
	let conflictAuditLoaded = $state(false);
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
	let enrollmentPolicy = $state<EnrollmentPolicy>(createDefaultEnrollmentPolicy());
	let enrollmentPolicyDraft = $state<EnrollmentPolicy>(createDefaultEnrollmentPolicy());
	let enrollmentPolicyLoaded = $state(false);
	let enrollmentPolicyIssue = $state<string | null>(null);
	let pendingRefreshTimer: number | null = null;
	let collectionRefreshTimers: Partial<Record<DataCollectionKey, number>> = {};
	let conflictAuditRefreshTimer: number | null = null;
	let scheduleNowTimer: number | null = null;
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

	let classroomDraft = $state(emptyClassRoomDraft());
	let courseDraft = $state(emptyCourseDraft());
	let studentDraft = $state(emptyStudentDraft());
	let lecturerDraft = $state(emptyLecturerDraft());
	let facultyDraft = $state(emptyFacultyDraft());
	let studyProgramDraft = $state(emptyStudyProgramDraft());
	let enrollmentDraft = $state(emptyEnrollmentDraft());
	let gradeDraft = $state(emptyGradeDraft());
	let userDraft = $state(emptyUserDraft());

	let scheduleViewState = $state(
		createBindableFacade({
			enrollmentSearch: bindableLink(
				() => enrollmentSearch,
				(value) => (enrollmentSearch = value)
			),
			scheduleDayFilter: bindableLink(
				() => scheduleDayFilter,
				(value) => (scheduleDayFilter = value)
			),
			scheduleCourseFilter: bindableLink(
				() => scheduleCourseFilter,
				(value) => (scheduleCourseFilter = value)
			),
			scheduleRoomFilter: bindableLink(
				() => scheduleRoomFilter,
				(value) => (scheduleRoomFilter = value)
			),
			scheduleLecturerFilter: bindableLink(
				() => scheduleLecturerFilter,
				(value) => (scheduleLecturerFilter = value)
			),
			scheduleSemesterFilter: bindableLink(
				() => scheduleSemesterFilter,
				(value) => (scheduleSemesterFilter = value)
			),
			scheduleAcademicYearFilter: bindableLink(
				() => scheduleAcademicYearFilter,
				(value) => (scheduleAcademicYearFilter = value)
			),
			scheduleRoomFilterSearch: bindableLink(
				() => scheduleRoomFilterSearch,
				(value) => (scheduleRoomFilterSearch = value)
			),
			scheduleRoomFilterOpen: bindableLink(
				() => scheduleRoomFilterOpen,
				(value) => (scheduleRoomFilterOpen = value)
			),
			selectedConflictGroupId: bindableLink(
				() => selectedConflictGroupId,
				(value) => (selectedConflictGroupId = value)
			)
		})
	);

	let builderScheduleState = $state(
		createBindableFacade({
			enrollmentSearch: bindableLink(
				() => enrollmentSearch,
				(value) => (enrollmentSearch = value)
			),
			scheduleDayFilter: bindableLink(
				() => scheduleDayFilter,
				(value) => (scheduleDayFilter = value)
			),
			scheduleCourseFilter: bindableLink(
				() => scheduleCourseFilter,
				(value) => (scheduleCourseFilter = value)
			),
			scheduleRoomFilter: bindableLink(
				() => scheduleRoomFilter,
				(value) => (scheduleRoomFilter = value)
			),
			scheduleLecturerFilter: bindableLink(
				() => scheduleLecturerFilter,
				(value) => (scheduleLecturerFilter = value)
			),
			scheduleSemesterFilter: bindableLink(
				() => scheduleSemesterFilter,
				(value) => (scheduleSemesterFilter = value)
			),
			scheduleAcademicYearFilter: bindableLink(
				() => scheduleAcademicYearFilter,
				(value) => (scheduleAcademicYearFilter = value)
			),
			scheduleCourseFilterSearch: bindableLink(
				() => scheduleCourseFilterSearch,
				(value) => (scheduleCourseFilterSearch = value)
			),
			scheduleRoomFilterSearch: bindableLink(
				() => scheduleRoomFilterSearch,
				(value) => (scheduleRoomFilterSearch = value)
			),
			scheduleLecturerFilterSearch: bindableLink(
				() => scheduleLecturerFilterSearch,
				(value) => (scheduleLecturerFilterSearch = value)
			),
			scheduleCourseFilterOpen: bindableLink(
				() => scheduleCourseFilterOpen,
				(value) => (scheduleCourseFilterOpen = value)
			),
			scheduleRoomFilterOpen: bindableLink(
				() => scheduleRoomFilterOpen,
				(value) => (scheduleRoomFilterOpen = value)
			),
			scheduleLecturerFilterOpen: bindableLink(
				() => scheduleLecturerFilterOpen,
				(value) => (scheduleLecturerFilterOpen = value)
			),
			builderConflictOnly: bindableLink(
				() => builderConflictOnly,
				(value) => (builderConflictOnly = value)
			)
		})
	);

	let builderWorkflowState = $state(
		createBindableFacade({
			builderStep: bindableLink(
				() => builderStep,
				(value) => (builderStep = value)
			),
			studentPickerSearch: bindableLink(
				() => studentPickerSearch,
				(value) => (studentPickerSearch = value)
			),
			coursePickerSearch: bindableLink(
				() => coursePickerSearch,
				(value) => (coursePickerSearch = value)
			),
			roomPickerSearch: bindableLink(
				() => roomPickerSearch,
				(value) => (roomPickerSearch = value)
			),
			studentPickerOpen: bindableLink(
				() => studentPickerOpen,
				(value) => (studentPickerOpen = value)
			),
			coursePickerOpen: bindableLink(
				() => coursePickerOpen,
				(value) => (coursePickerOpen = value)
			),
			roomPickerOpen: bindableLink(
				() => roomPickerOpen,
				(value) => (roomPickerOpen = value)
			)
		})
	);

	function setFeedback(tone: Tone, text: string) {
		feedback = { tone, text };
	}

	function reportDanger(message: string) {
		setFeedback('danger', message);
	}

	function reportSuccess(message: string) {
		setFeedback('success', message);
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

	async function refreshStudentPickerOptions(cursor: string | null = null) {
		await refreshOptionList({
			cursor,
			nextToken: () => ++studentPickerRequestToken,
			isCurrent: (token) => token === studentPickerRequestToken,
			setLoading: (value) => (studentPickerLoading = value),
			setIssue: (value) => (studentPickerIssue = value),
			fetch: async (nextCursor) => {
				const q = normalizedSearchValue(studentPickerSearch);
				return q
					? await resolveRemoteQuery(searchStudents({ q, cursor: nextCursor ?? undefined }))
					: await resolveRemoteQuery(getStudents({ cursor: nextCursor ?? undefined }));
			},
			assignItems: (items, append) => {
				studentPickerOptions = append ? mergeItemsById(studentPickerOptions, items) : items;
			},
			setHasMore: (value) => (studentPickerHasMore = value),
			setNextCursor: (value) => (studentPickerNextCursor = value),
			errorMessage,
			issueFallback: 'Daftar mahasiswa gagal dimuat.'
		});
	}

	async function refreshCoursePickerOptions(cursor: string | null = null) {
		await refreshOptionList({
			cursor,
			nextToken: () => ++coursePickerRequestToken,
			isCurrent: (token) => token === coursePickerRequestToken,
			setLoading: (value) => (coursePickerLoading = value),
			setIssue: (value) => (coursePickerIssue = value),
			fetch: async (nextCursor) => {
				const q = normalizedSearchValue(coursePickerSearch);
				return q
					? await resolveRemoteQuery(searchCourses({ q, cursor: nextCursor ?? undefined }))
					: await resolveRemoteQuery(getCourses({ cursor: nextCursor ?? undefined }));
			},
			assignItems: (items, append) => {
				coursePickerOptions = append ? mergeItemsById(coursePickerOptions, items) : items;
			},
			setHasMore: (value) => (coursePickerHasMore = value),
			setNextCursor: (value) => (coursePickerNextCursor = value),
			errorMessage,
			issueFallback: 'Daftar mata kuliah gagal dimuat.'
		});
	}

	async function refreshScheduleCourseFilterOptions(cursor: string | null = null) {
		await refreshOptionList({
			cursor,
			nextToken: () => ++scheduleCourseFilterRequestToken,
			isCurrent: (token) => token === scheduleCourseFilterRequestToken,
			setLoading: (value) => (scheduleCourseFilterLoading = value),
			setIssue: (value) => (scheduleCourseFilterIssue = value),
			fetch: async (nextCursor) => {
				const q = normalizedSearchValue(scheduleCourseFilterSearch);
				return q
					? await resolveRemoteQuery(searchCourses({ q, cursor: nextCursor ?? undefined }))
					: await resolveRemoteQuery(getCourses({ cursor: nextCursor ?? undefined }));
			},
			assignItems: (items, append) => {
				scheduleCourseFilterOptions = append
					? mergeItemsById(scheduleCourseFilterOptions, items)
					: items;
			},
			setHasMore: (value) => (scheduleCourseFilterHasMore = value),
			setNextCursor: (value) => (scheduleCourseFilterNextCursor = value),
			errorMessage,
			issueFallback: 'Daftar mata kuliah gagal dimuat.'
		});
	}

	async function refreshScheduleLecturerFilterOptions(cursor: string | null = null) {
		await refreshOptionList({
			cursor,
			nextToken: () => ++scheduleLecturerFilterRequestToken,
			isCurrent: (token) => token === scheduleLecturerFilterRequestToken,
			setLoading: (value) => (scheduleLecturerFilterLoading = value),
			setIssue: (value) => (scheduleLecturerFilterIssue = value),
			fetch: async (nextCursor) => {
				const q = normalizedSearchValue(scheduleLecturerFilterSearch);
				return q
					? await resolveRemoteQuery(searchLecturers({ q, cursor: nextCursor ?? undefined }))
					: await resolveRemoteQuery(getLecturers({ cursor: nextCursor ?? undefined }));
			},
			assignItems: (items, append) => {
				scheduleLecturerFilterOptions = append
					? mergeItemsById(scheduleLecturerFilterOptions, items)
					: items;
			},
			setHasMore: (value) => (scheduleLecturerFilterHasMore = value),
			setNextCursor: (value) => (scheduleLecturerFilterNextCursor = value),
			errorMessage,
			issueFallback: 'Daftar Dosen gagal dimuat.'
		});
	}

	function queueStudentPickerRefresh(delay = 120) {
		queueOptionRefresh({
			browser,
			currentTimer: studentPickerRefreshTimer,
			setTimer: (value) => (studentPickerRefreshTimer = value),
			run: () => void refreshStudentPickerOptions(null),
			delay,
			clearTimer: (value) => window.clearTimeout(value),
			setTimeoutFn: (callback, wait) => window.setTimeout(callback, wait)
		});
	}

	function queueCoursePickerRefresh(delay = 120) {
		queueOptionRefresh({
			browser,
			currentTimer: coursePickerRefreshTimer,
			setTimer: (value) => (coursePickerRefreshTimer = value),
			run: () => void refreshCoursePickerOptions(null),
			delay,
			clearTimer: (value) => window.clearTimeout(value),
			setTimeoutFn: (callback, wait) => window.setTimeout(callback, wait)
		});
	}

	function queueScheduleCourseFilterRefresh(delay = 120) {
		queueOptionRefresh({
			browser,
			currentTimer: scheduleCourseFilterRefreshTimer,
			setTimer: (value) => (scheduleCourseFilterRefreshTimer = value),
			run: () => void refreshScheduleCourseFilterOptions(null),
			delay,
			clearTimer: (value) => window.clearTimeout(value),
			setTimeoutFn: (callback, wait) => window.setTimeout(callback, wait)
		});
	}

	function queueScheduleLecturerFilterRefresh(delay = 120) {
		queueOptionRefresh({
			browser,
			currentTimer: scheduleLecturerFilterRefreshTimer,
			setTimer: (value) => (scheduleLecturerFilterRefreshTimer = value),
			run: () => void refreshScheduleLecturerFilterOptions(null),
			delay,
			clearTimer: (value) => window.clearTimeout(value),
			setTimeoutFn: (callback, wait) => window.setTimeout(callback, wait)
		});
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
		scheduleNow = new Date();
		scheduleNowTimer = window.setInterval(() => {
			scheduleNow = new Date();
		}, 60_000);
		const storedTheme = localStorage.getItem('watum-theme');
		applyTheme(storedTheme === 'dark' ? 'dark' : 'light');
		const resolvedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (resolvedTimezone) {
			timezone = resolvedTimezone;
		}
		const requestedView = readViewFromUrl();
		if (requestedView) {
			activeView = requestedView;
		}
		viewRestored = true;
		void (async () => {
			await ensureAccessToken();
			await currentUser.refresh();
			if (currentUser.current) {
				await refreshEnrollmentPolicyData();
			}
		})();
	});

	onDestroy(() => {
		clearRefreshTimers();
		if (scheduleNowTimer != null) {
			window.clearInterval(scheduleNowTimer);
			scheduleNowTimer = null;
		}
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
			calendarPlugins = [mod.TimeGrid, mod.Interaction];
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
		conflictAuditLoaded = false;
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

	const requestClassroomsPage = createSimpleSearchRequester({
		getSearchTerm: () => roomSearch,
		normalizeSearchValue: normalizedSearchValue,
		getAll: getClassRooms,
		search: searchClassRooms
	});

	const requestCoursesPage = createSimpleSearchRequester({
		getSearchTerm: () => courseSearch,
		normalizeSearchValue: normalizedSearchValue,
		getAll: getCourses,
		search: searchCourses
	});

	const requestStudentsPage = createSimpleSearchRequester({
		getSearchTerm: () => studentSearch,
		normalizeSearchValue: normalizedSearchValue,
		getAll: getStudents,
		search: searchStudents
	});

	const requestLecturersPage = createSimpleSearchRequester({
		getSearchTerm: () => lecturerSearch,
		normalizeSearchValue: normalizedSearchValue,
		getAll: getLecturers,
		search: searchLecturers
	});

	const requestFacultiesPage = createSimpleSearchRequester({
		getSearchTerm: () => facultySearch,
		normalizeSearchValue: normalizedSearchValue,
		getAll: getFaculties,
		search: searchFaculties
	});

	const requestStudyProgramsPage = createSimpleSearchRequester({
		getSearchTerm: () => studyProgramSearch,
		normalizeSearchValue: normalizedSearchValue,
		getAll: getStudyPrograms,
		search: searchStudyPrograms
	});

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

	const requestUsersPage = createSimpleSearchRequester({
		getSearchTerm: () => userSearch,
		normalizeSearchValue: normalizedSearchValue,
		getAll: getUsers,
		search: searchUsers
	});

	async function refreshEnrollmentPolicyData() {
		if (!currentUser.current) {
			enrollmentPolicy = createDefaultEnrollmentPolicy();
			enrollmentPolicyDraft = createDefaultEnrollmentPolicy();
			enrollmentPolicyLoaded = false;
			enrollmentPolicyIssue = null;
			return;
		}

		try {
			const policy = normalizeEnrollmentPolicy(await getEnrollmentPolicy().run());
			enrollmentPolicy = policy;
			enrollmentPolicyDraft = { ...policy };
			enrollmentPolicyLoaded = true;
			enrollmentPolicyIssue = null;
		} catch (error) {
			enrollmentPolicyLoaded = false;
			enrollmentPolicyIssue = errorMessage(error, 'Pengaturan pengajuan KRS gagal dimuat.');
		}
	}

	function resetEnrollmentPolicyDraft() {
		enrollmentPolicyDraft = normalizeEnrollmentPolicy(enrollmentPolicy);
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
		const role = currentUser.current?.role as AppRole | undefined;
		const auditEnrollmentSource =
			role === 'STUDENT'
				? []
				: activeView === 'builder'
					? filteredBuilderEnrollments
					: activeView === 'enrollments'
						? filteredEnrollments
						: activeView === 'calendar'
							? schedulePreview.items
							: [];
		const scopedEnrollmentIds = auditEnrollmentSource
			.map((item) => item.id)
			.filter((id): id is string => Boolean(id))
			.slice(0, 500);
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
			enrollmentIds: scopedEnrollmentIds.length ? scopedEnrollmentIds : undefined,
			limitGroups: 1000,
			memberSampleSize: 10
		};
	}

	async function refreshConflictAudit() {
		if (!loadedForUserId) {
			conflictAudit = null;
			conflictAuditLoaded = false;
			return;
		}

		conflictAuditLoaded = false;
		try {
			conflictAudit = await resolveRemoteQuery(
				getEnrollmentConflictAudit(buildConflictAuditFilters())
			);
			conflictAuditLoaded = true;
		} catch {
			conflictAudit = null;
			conflictAuditLoaded = false;
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
		await refreshOptionList({
			cursor,
			nextToken: () => ++roomPickerRequestToken,
			isCurrent: (token) => token === roomPickerRequestToken,
			setLoading: (value) => (roomPickerLoading = value),
			setIssue: (value) => (roomPickerIssue = value),
			fetch: async (nextCursor) => {
				const q = normalizedSearchValue(roomPickerSearch);
				return await resolveRemoteQuery(searchClassRooms({ q, cursor: nextCursor ?? undefined }));
			},
			assignItems: (items, append) => {
				roomPickerOptions = append ? mergeItemsById(roomPickerOptions, items) : items;
			},
			setHasMore: (value) => (roomPickerHasMore = value),
			setNextCursor: (value) => (roomPickerNextCursor = value),
			errorMessage,
			issueFallback: 'Daftar ruang kelas gagal dimuat.'
		});
	}

	async function refreshScheduleRoomFilterOptions(cursor: string | null = null) {
		await refreshOptionList({
			cursor,
			nextToken: () => ++scheduleRoomFilterRequestToken,
			isCurrent: (token) => token === scheduleRoomFilterRequestToken,
			setLoading: (value) => (scheduleRoomFilterLoading = value),
			setIssue: (value) => (scheduleRoomFilterIssue = value),
			fetch: async (nextCursor) => {
				const q = normalizedSearchValue(scheduleRoomFilterSearch);
				return await resolveRemoteQuery(searchClassRooms({ q, cursor: nextCursor ?? undefined }));
			},
			assignItems: (items, append) => {
				scheduleRoomFilterOptions = append
					? mergeItemsById(scheduleRoomFilterOptions, items)
					: items;
			},
			setHasMore: (value) => (scheduleRoomFilterHasMore = value),
			setNextCursor: (value) => (scheduleRoomFilterNextCursor = value),
			errorMessage,
			issueFallback: 'Daftar ruang kelas gagal dimuat.'
		});
	}

	function loadMoreRoomPickerOptions() {
		if (
			!canLoadMoreOptionList({
				loading: roomPickerLoading,
				hasMore: roomPickerHasMore,
				nextCursor: roomPickerNextCursor
			})
		)
			return;
		void refreshRoomPickerOptions(roomPickerNextCursor);
	}

	function loadMoreScheduleRoomFilterOptions() {
		if (
			!canLoadMoreOptionList({
				loading: scheduleRoomFilterLoading,
				hasMore: scheduleRoomFilterHasMore,
				nextCursor: scheduleRoomFilterNextCursor
			})
		)
			return;
		void refreshScheduleRoomFilterOptions(scheduleRoomFilterNextCursor);
	}

	function queueRoomPickerRefresh(delay = 120) {
		queueOptionRefresh({
			browser,
			currentTimer: roomPickerRefreshTimer,
			setTimer: (value) => (roomPickerRefreshTimer = value),
			run: () => void refreshRoomPickerOptions(null),
			delay,
			clearTimer: (value) => window.clearTimeout(value),
			setTimeoutFn: (callback, wait) => window.setTimeout(callback, wait)
		});
	}

	function queueScheduleRoomFilterRefresh(delay = 120) {
		queueOptionRefresh({
			browser,
			currentTimer: scheduleRoomFilterRefreshTimer,
			setTimer: (value) => (scheduleRoomFilterRefreshTimer = value),
			run: () => void refreshScheduleRoomFilterOptions(null),
			delay,
			clearTimer: (value) => window.clearTimeout(value),
			setTimeoutFn: (callback, wait) => window.setTimeout(callback, wait)
		});
	}

	function viewDataPlan(view: ViewId, role: AppRole | undefined): ViewDataPlan {
		return viewDataPlanForRole(view, role) as ViewDataPlan;
	}

	function shouldLoadClassRoomDashboard(view: ViewId, role: AppRole | undefined) {
		return view === 'dashboard' && role === 'ADMIN';
	}

	function shouldLoadConflictAudit(view: ViewId, role: AppRole | undefined) {
		if (role === 'STUDENT') return false;
		if (view === 'dashboard') return role === 'ADMIN';
		return view === 'calendar' || view === 'builder' || view === 'enrollments';
	}

	function getViewIssues(view: ViewId, role: AppRole | undefined): string[] {
		const plan = viewDataPlan(view, role);
		const keys = new Set<DataCollectionKey>(plan.collections);
		if (plan.requiresSchedulePreview) {
			keys.add('enrollments');
		}

		return Array.from(keys)
			.map((key) => collectionIssues[key])
			.filter((message): message is string => Boolean(message));
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

		if (shouldLoadClassRoomDashboard(view, role) && (force || !classRoomDashboardLoaded)) {
			tasks.push(
				refreshClassRoomDashboard().catch((error) => {
					setCollectionIssue('classrooms', errorMessage(error, 'Dashboard ruang gagal dimuat.'));
				})
			);
		}

		for (const key of plan.collections) {
			if (!force && collectionLoaded[key]) continue;
			tasks.push(
				loadCollection({
					key,
					loader: () => collectionRefreshers[key](null),
					fallback: collectionFallbackMessages[key],
					clearIssue: clearCollectionIssue,
					setIssue: setCollectionIssue,
					errorMessage
				})
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
		await loadCollection({
			key,
			loader: () => collectionRefreshers[key](),
			fallback: collectionFallbackMessages[key],
			clearIssue: clearCollectionIssue,
			setIssue: setCollectionIssue,
			errorMessage
		});
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
			includeConflictAudit: shouldLoadConflictAudit(view, role),
			forceCollections: true
		});
		if (shouldLoadClassRoomDashboard(view, role)) {
			await refreshClassRoomDashboard(null, {
				history: [],
				pageNumber: 1,
				refreshSummary: true
			});
		}
		if (view === 'enrollments') {
			await refreshEnrollmentPolicyData();
		}
	}

	const collectionRequesters: Record<
		DataCollectionKey,
		(
			cursor: string | null
		) =>
			| Promise<LimitedCollectionResponse<unknown>>
			| { run: () => Promise<LimitedCollectionResponse<unknown>> }
	> = {
		classrooms: requestClassroomsPage,
		courses: requestCoursesPage,
		students: requestStudentsPage,
		lecturers: requestLecturersPage,
		faculties: requestFacultiesPage,
		studyPrograms: requestStudyProgramsPage,
		enrollments: requestEnrollmentsPage,
		grades: requestGradesPage,
		users: requestUsersPage
	};

	const collectionAssigners: Record<DataCollectionKey, (items: unknown[]) => void> = {
		classrooms: (items) => (classrooms = items as SelectClassRoomsResult[]),
		courses: (items) => (courses = items as SelectCoursesResult[]),
		students: (items) => (students = items as SelectStudentsResult[]),
		lecturers: (items) => (lecturers = items as SelectLecturersResult[]),
		faculties: (items) => (faculties = items as SelectFacultiesResult[]),
		studyPrograms: (items) => (studyPrograms = items as SelectStudyProgramsResult[]),
		enrollments: (items) => (enrollments = items as SelectEnrollmentsResult[]),
		grades: (items) => (grades = items as SelectGradesResult[]),
		users: (items) => (users = items as SelectUsersResult[])
	};

	const collectionRefreshers: Record<DataCollectionKey, (cursor?: string | null) => Promise<void>> =
		{
			classrooms: (cursor = collectionPagination.classrooms.currentCursor) =>
				loadCollectionPage({
					key: 'classrooms',
					cursor,
					request: requestClassroomsPage,
					assign: (items) => (classrooms = items),
					setPagination: setCollectionPagination,
					getPagination: (key) => collectionPagination[key],
					markLoaded: (key) => (collectionLoaded = { ...collectionLoaded, [key]: true })
				}),
			courses: (cursor = collectionPagination.courses.currentCursor) =>
				loadCollectionPage({
					key: 'courses',
					cursor,
					request: requestCoursesPage,
					assign: (items) => (courses = items),
					setPagination: setCollectionPagination,
					getPagination: (key) => collectionPagination[key],
					markLoaded: (key) => (collectionLoaded = { ...collectionLoaded, [key]: true })
				}),
			students: (cursor = collectionPagination.students.currentCursor) =>
				loadCollectionPage({
					key: 'students',
					cursor,
					request: requestStudentsPage,
					assign: (items) => (students = items),
					setPagination: setCollectionPagination,
					getPagination: (key) => collectionPagination[key],
					markLoaded: (key) => (collectionLoaded = { ...collectionLoaded, [key]: true })
				}),
			lecturers: (cursor = collectionPagination.lecturers.currentCursor) =>
				loadCollectionPage({
					key: 'lecturers',
					cursor,
					request: requestLecturersPage,
					assign: (items) => (lecturers = items),
					setPagination: setCollectionPagination,
					getPagination: (key) => collectionPagination[key],
					markLoaded: (key) => (collectionLoaded = { ...collectionLoaded, [key]: true })
				}),
			faculties: (cursor = collectionPagination.faculties.currentCursor) =>
				loadCollectionPage({
					key: 'faculties',
					cursor,
					request: requestFacultiesPage,
					assign: (items) => (faculties = items),
					setPagination: setCollectionPagination,
					getPagination: (key) => collectionPagination[key],
					markLoaded: (key) => (collectionLoaded = { ...collectionLoaded, [key]: true })
				}),
			studyPrograms: (cursor = collectionPagination.studyPrograms.currentCursor) =>
				loadCollectionPage({
					key: 'studyPrograms',
					cursor,
					request: requestStudyProgramsPage,
					assign: (items) => (studyPrograms = items),
					setPagination: setCollectionPagination,
					getPagination: (key) => collectionPagination[key],
					markLoaded: (key) => (collectionLoaded = { ...collectionLoaded, [key]: true })
				}),
			enrollments: (cursor = collectionPagination.enrollments.currentCursor) =>
				loadCollectionPage({
					key: 'enrollments',
					cursor,
					request: requestEnrollmentsPage,
					assign: (items) => (enrollments = items),
					setPagination: setCollectionPagination,
					getPagination: (key) => collectionPagination[key],
					markLoaded: (key) => (collectionLoaded = { ...collectionLoaded, [key]: true })
				}),
			grades: (cursor = collectionPagination.grades.currentCursor) =>
				loadCollectionPage({
					key: 'grades',
					cursor,
					request: requestGradesPage,
					assign: (items) => (grades = items),
					setPagination: setCollectionPagination,
					getPagination: (key) => collectionPagination[key],
					markLoaded: (key) => (collectionLoaded = { ...collectionLoaded, [key]: true })
				}),
			users: (cursor = collectionPagination.users.currentCursor) =>
				loadCollectionPage({
					key: 'users',
					cursor,
					request: requestUsersPage,
					assign: (items) => (users = items),
					setPagination: setCollectionPagination,
					getPagination: (key) => collectionPagination[key],
					markLoaded: (key) => (collectionLoaded = { ...collectionLoaded, [key]: true })
				})
		};

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
			void loadCollection({
				key,
				loader: () => collectionRefreshers[key](null),
				fallback: collectionFallbackMessages[key],
				clearIssue: clearCollectionIssue,
				setIssue: setCollectionIssue,
				errorMessage
			});
		}, delay);
	}

	async function changeCollectionPage(key: DataCollectionKey, direction: 'previous' | 'next') {
		const pageState = collectionPagination[key];
		if (direction === 'next') {
			if (!pageState.nextCursor) return;
			const nextHistory = [...pageState.history, pageState.currentCursor];
			await loadCollection({
				key,
				loader: () =>
					loadCollectionPage({
						key,
						cursor: pageState.nextCursor,
						request: (cursor) => collectionRequesters[key](cursor),
						assign: (items) => collectionAssigners[key](items as unknown[]),
						meta: { history: nextHistory, pageNumber: pageState.pageNumber + 1 },
						setPagination: setCollectionPagination,
						getPagination: (paginationKey) => collectionPagination[paginationKey],
						markLoaded: (loadedKey) =>
							(collectionLoaded = { ...collectionLoaded, [loadedKey]: true })
					}),
				fallback: collectionFallbackMessages[key],
				clearIssue: clearCollectionIssue,
				setIssue: setCollectionIssue,
				errorMessage
			});
			return;
		}

		if (!pageState.history.length) return;
		const nextHistory = [...pageState.history];
		const previousCursor = nextHistory.pop() ?? null;

		await loadCollection({
			key,
			loader: () =>
				loadCollectionPage({
					key,
					cursor: previousCursor,
					request: (cursor) => collectionRequesters[key](cursor),
					assign: (items) => collectionAssigners[key](items as unknown[]),
					meta: {
						history: nextHistory,
						pageNumber: Math.max(1, pageState.pageNumber - 1)
					},
					setPagination: setCollectionPagination,
					getPagination: (paginationKey) => collectionPagination[paginationKey],
					markLoaded: (loadedKey) => (collectionLoaded = { ...collectionLoaded, [loadedKey]: true })
				}),
			fallback: collectionFallbackMessages[key],
			clearIssue: clearCollectionIssue,
			setIssue: setCollectionIssue,
			errorMessage
		});
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
		const role = currentUser.current?.role as AppRole | undefined;
		if (!userId || !['dashboard', 'calendar', 'builder', 'enrollments'].includes(view)) return;
		if (!shouldLoadConflictAudit(view, role)) return;
		if (view === 'enrollments' && !collectionLoaded.enrollments) return;
		if (
			!['builder', 'enrollments'].includes(view) &&
			(!schedulePreviewLoaded || schedulePreview.loading)
		) {
			return;
		}
		const _deps = [
			scheduleAcademicYearFilter,
			scheduleSemesterFilter,
			scheduleDayFilter,
			scheduleCourseFilter,
			scheduleRoomFilter,
			scheduleLecturerFilter,
			schedulePreview.items.length,
			enrollments.length,
			idsFingerprint(schedulePreview.items),
			idsFingerprint(enrollments)
		];
		void _deps;
		conflictAuditLoaded = false;
		if (view === 'builder' && role === 'LECTURER') {
			void refreshConflictAudit();
			return;
		}
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
		if (!userId || !['calendar', 'enrollments'].includes(activeView)) return;
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
		if (!schedulePreviewLoaded && !schedulePreview.loading) {
			void refreshSchedulePreview().catch((error) => {
				setCollectionIssue('enrollments', errorMessage(error, 'Pratinjau jadwal gagal dimuat.'));
			});
		}
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
			enrollmentPolicy = createDefaultEnrollmentPolicy();
			enrollmentPolicyDraft = createDefaultEnrollmentPolicy();
			enrollmentPolicyLoaded = false;
			enrollmentPolicyIssue = null;
			resetCollections();
			return;
		}
		if (loadedForUserId === userId) return;
		if (loadedForUserId) {
			resetCollections();
		}
		loadedForUserId = userId;
		void refreshEnrollmentPolicyData();
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
		const auditAuthoritative =
			conflictAuditLoaded &&
			shouldLoadConflictAudit(activeView, currentUser.current?.role as AppRole | undefined);

		if (!auditAuthoritative && !Object.keys(membership).length) {
			return localScheduleCards;
		}

		return localScheduleCards.map((card) => {
			const match = membership[card.id];
			if (!match && auditAuthoritative) {
				return clearScheduleCardConflict(card);
			}

			return {
				...card,
				hasConflict: match ? true : card.hasConflict,
				conflictGroupId: match?.groupId ?? card.conflictGroupId,
				conflictTone: match?.tone ?? card.conflictTone
			};
		});
	});
	const scheduleAnalyticsCards = $derived(schedulePreview.hasMore ? [] : scheduleCards);
	const filteredScheduleCards = $derived(
		scheduleCards.filter(
			(card) => scheduleFiltersMatch(card.original) && scheduleSearchMatches(card.original)
		)
	);
	const calendarVisibleDays = $derived(visibleDaysForCalendar(filteredScheduleCards, scheduleDayFilter));
	const calendarHiddenDays = $derived(hiddenDaysForCalendar(calendarVisibleDays));
	const calendarColumnWidthValue = $derived(calendarColumnWidth(calendarVisibleDays.length));
	const calendarSlotHeightValue = $derived(calendarSlotHeight(calendarVisibleDays.length));
	const calendarScheduleCards = $derived.by(() =>
		mergeCalendarSessionCards(filteredScheduleCards, selectedConflictGroupId)
	);
	const calendarAnchorDate = $derived(createCalendarAnchorDate(calendarWeekOffset));
	const calendarWeekLabel = $derived.by(() => {
		if (calendarVisibleDays.length === 1) {
			const day = calendarVisibleDays[0]!;
			const formatter = new Intl.DateTimeFormat('id-ID', {
				day: 'numeric',
				month: 'long'
			});
			return `${DAY_LABELS[day]}, ${formatter.format(dateForCalendarDay(day))}`;
		}

		const start = calendarAnchorDate.getTime();
		const end = start + 5 * 24 * 60 * 60 * 1000;
		const formatter = new Intl.DateTimeFormat('id-ID', {
			day: 'numeric',
			month: 'long'
		});
		return `${formatter.format(start)} - ${formatter.format(end)}`;
	});
	const calendarVisibleRange = $derived.by(() => rangeForScheduleCards(calendarScheduleCards));
	const calendarSessionCountByDay = $derived.by(() =>
		Object.fromEntries(
			calendarVisibleDays.map((day) => [day, calendarScheduleCards.filter((card) => card.day === day).length])
		)
	);
	const calendarEvents = $derived.by(() =>
		calendarScheduleCards.map((card) => ({
			id: card.id,
			title: card.course,
			start: dateForScheduleCard(card, card.startMinutes),
			end: dateForScheduleCard(card, card.endMinutes),
			extendedProps: { card }
		}))
	);
	const calendarConflictLegend = $derived.by(() =>
		auditConflictGroups
			.map((group) => {
				const representative = calendarScheduleCards.find((card) => card.conflictGroupId === group.id);
				if (!representative) return null;

				return {
					...group,
					representative,
					selected: selectedConflictGroupId === group.id,
					label: `${DAY_LABELS[representative.day]} ${representative.startLabel}`,
					course: representative.course
				};
			})
			.filter((group): group is NonNullable<typeof group> => Boolean(group))
	);
	const effectiveSelectedScheduleId = $derived.by(() => {
		if (!selectedScheduleId) return null;

		if (
			calendarScheduleCards.some((item) => item.id === selectedScheduleId)
		) {
			return selectedScheduleId;
		}

		const selectedSourceCard = scheduleCards.find((item) => item.id === selectedScheduleId);
		if (selectedSourceCard?.original.schedule_id) {
			const matchingSession = calendarScheduleCards.find(
				(item) => item.original.schedule_id === selectedSourceCard.original.schedule_id
			);
			if (matchingSession) return matchingSession.id;
		}

		return null;
	});
	const calendarOptions = $derived.by(() => ({
		view: 'timeGridWeek',
		date: calendarAnchorDate,
		locale: 'id-ID',
		firstDay: 1,
		hiddenDays: calendarHiddenDays,
		height: 'auto',
		allDaySlot: false,
		nowIndicator: true,
		customScrollbars: true,
		columnWidth: calendarColumnWidthValue,
		slotDuration: '00:30:00',
		slotLabelInterval: '01:00:00',
		slotHeight: calendarSlotHeightValue,
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
			if (card?.durationMinutes && card.durationMinutes <= 30) {
				classes.push('is-tiny');
			} else if (card?.durationMinutes && card.durationMinutes <= 45) {
				classes.push('is-short');
			} else if (card?.durationMinutes && card.durationMinutes <= 60) {
				classes.push('is-medium');
			}
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
			const timeLabel = `${escapeHtml(card.startLabel)} - ${escapeHtml(card.endLabel)}`;
			const studentCountLabel = `${card.studentCount} Mahasiswa`;
			const escapedStudentCountLabel = escapeHtml(studentCountLabel);
			const metaLabel = `${escapeHtml(card.room)} • ${escapeHtml(card.lecturer)} • ${escapedStudentCountLabel}`;

			if (card.durationMinutes <= 30) {
				return {
					html: `
						<div class="watum-event-copy">
							<span>${timeLabel} • ${escapedStudentCountLabel}</span>
							<strong>${escapeHtml(card.course)}</strong>
						</div>
					`
				};
			}

			if (card.durationMinutes <= 45) {
				return {
					html: `
						<div class="watum-event-copy">
							<strong>${escapeHtml(card.course)}</strong>
							<span>${timeLabel} • ${escapedStudentCountLabel}</span>
						</div>
					`
				};
			}

			if (card.durationMinutes <= 60) {
				return {
					html: `
						<div class="watum-event-copy">
							<strong>${escapeHtml(card.course)}</strong>
							<span>${timeLabel} • ${escapedStudentCountLabel}</span>
							<small>${escapeHtml(card.room)}</small>
						</div>
					`
				};
			}

			return {
				html: `
					<div class="watum-event-copy">
						${card.hasConflict ? '<span class="watum-event-flag">Bentrok</span>' : ''}
						<strong>${escapeHtml(card.course)}</strong>
						<span>${timeLabel}</span>
						<small>${metaLabel}</small>
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
				`${card.course} • ${card.startLabel} - ${card.endLabel} • ${card.room} • ${card.lecturer} • ${card.studentCount} mahasiswa`
			);
		},
		eventClick(info: { event: { extendedProps: { card?: ScheduleCard } } }) {
			const card = info.event.extendedProps.card;
			focusSchedule(card);
		},
		dateClick() {
			clearCalendarSelection();
		}
	}));
	const selectedSchedule = $derived(
		calendarScheduleCards.find((item) => item.id === effectiveSelectedScheduleId) ??
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
	const builderMode = $derived.by<BuilderMode>(() => {
		if (!selectedEnrollmentId) return 'create';
		return selectedEnrollment?.status === 'PENDING' ? 'approve' : 'edit';
	});
	const selectedGrade = $derived(
		grades.find((item) => item.id === selectedGradeId) ?? selectedGradeRecord ?? null
	);
	const approvedEnrollmentOptions = $derived(
		enrollments.filter((item) => item.status === 'APPROVED')
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
					`${details.count} jadwal • Ruang: ${details.rooms} • Dosen: ${details.lecturers}`;
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
		for (const card of calendarScheduleCards) {
			peers[card.id] = calendarScheduleCards
				.filter(
					(candidate) =>
						scheduleSessionKey(candidate) !== scheduleSessionKey(card) &&
						schedulesOverlap(card, candidate)
				)
				.sort((left, right) => left.startMinutes - right.startMinutes);
		}
		return peers;
	});
	const upcomingScheduleCards = $derived.by(() =>
		sortUpcomingSchedules(scheduleCards, scheduleNow)
	);
	const weeklyScheduleCards = $derived.by(() => sortWeeklySchedules(scheduleCards));
	const nextSchedule = $derived(upcomingScheduleCards[0] ?? null);
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
	const calendarNeedsFilters = $derived(
		currentUser.current?.role !== 'STUDENT' && scheduleActiveFilterCount === 0
	);
	const calendarExceedsVisibleLimit = $derived(
		currentUser.current?.role !== 'STUDENT' &&
			calendarScheduleCards.length > CALENDAR_MAX_VISIBLE_SCHEDULES
	);
	const calendarCanRender = $derived(
		!calendarNeedsFilters && !calendarExceedsVisibleLimit && calendarScheduleCards.length > 0
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
		const startMinutes = toMinutes(enrollmentDraft.startTime, timezone);
		const endMinutes = toMinutes(enrollmentDraft.endTime, timezone);
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
		scheduleLecturerFilterLookup.get(scheduleLecturerFilter)?.name ?? 'Semua Dosen'
	);
	const draftTimeSummary = $derived.by(() => {
		if (!timeStepReady) return 'Belum ditetapkan';
		const dayLabel = DAY_LABELS[enrollmentDraft.day as keyof typeof DAY_LABELS];
		return `${dayLabel} • ${formatTimeRange(enrollmentDraft.startTime, enrollmentDraft.endTime, timezone)}`;
	});

	function beginRecordSelection() {
		pendingDelete = null;
		stopEditing();
	}

	function pickClassroom(item: SelectClassRoomsResult) {
		selectEntityRecord({
			item,
			beforeSelect: beginRecordSelection,
			setSelectedId: (id) => (selectedRoomId = id),
			setSelectedRecord: (value) => (selectedRoomRecord = value as SelectClassRoomsResult),
			applyInitial: (value) => {
				classroomDraft = {
					name: value.name ?? '',
					classRoomType: value.class_room_type ?? 'REGULER',
					capacity: value.capacity ?? 30,
					hasProjector: Boolean(value.has_projector),
					hasAC: Boolean(value.has_ac)
				};
			},
			loadFull: (id) => getClassRoom(id).run(),
			isCurrent: () => selectedRoomId === item.id,
			applyLoaded: (full) => {
				classroomDraft = {
					name: full.name ?? '',
					classRoomType: full.class_room_type ?? 'REGULER',
					capacity: full.capacity ?? 30,
					hasProjector: Boolean(full.has_projector),
					hasAC: Boolean(full.has_ac)
				};
			}
		});
	}

	function pickCourse(item: SelectCoursesResult) {
		selectEntityRecord({
			item,
			beforeSelect: beginRecordSelection,
			setSelectedId: (id) => (selectedCourseId = id),
			setSelectedRecord: (value) => (selectedCourseRecord = value as SelectCoursesResult),
			applyInitial: (value) => {
				courseDraft = {
					id: value.id ?? '',
					name: value.name ?? '',
					credits: value.credits ?? 3,
					studyProgramId: value.study_program_id ?? '',
					lecturerId: value.lecturer_id ?? ''
				};
			},
			loadFull: (id) => getCourse(id).run(),
			isCurrent: () => selectedCourseId === item.id
		});
	}

	function pickStudent(item: SelectStudentsResult) {
		selectEntityRecord({
			item,
			beforeSelect: beginRecordSelection,
			setSelectedId: (id) => (selectedStudentId = id),
			setSelectedRecord: (value) => (selectedStudentRecord = value as SelectStudentsResult),
			applyInitial: (value) => {
				studentDraft = {
					name: value.name ?? '',
					email: value.email ?? '',
					phone: value.phone ?? '',
					address: value.address ?? '',
					yearAdmitted: value.year_admitted ?? 2024,
					studyProgramId: value.study_program_id ?? ''
				};
			},
			loadFull: (id) => getStudent(id).run(),
			isCurrent: () => selectedStudentId === item.id,
			applyLoaded: (full) => {
				studentDraft = {
					name: full.name ?? '',
					email: full.email ?? '',
					phone: full.phone ?? '',
					address: full.address ?? '',
					yearAdmitted: full.year_admitted ?? 2024,
					studyProgramId: full.study_program_id ?? ''
				};
			}
		});
	}

	function pickLecturer(item: SelectLecturersResult) {
		selectEntityRecord({
			item,
			beforeSelect: beginRecordSelection,
			setSelectedId: (id) => (selectedLecturerId = id),
			setSelectedRecord: (value) => (selectedLecturerRecord = value as SelectLecturersResult),
			applyInitial: (value) => {
				lecturerDraft = {
					id: value.id ?? '',
					name: value.name ?? '',
					email: value.email ?? '',
					phone: value.phone ?? '',
					address: value.address ?? ''
				};
			},
			loadFull: (id) => getLecturer(id).run(),
			isCurrent: () => selectedLecturerId === item.id,
			applyLoaded: (full) => {
				lecturerDraft = {
					id: full.id ?? '',
					name: full.name ?? '',
					email: full.email ?? '',
					phone: full.phone ?? '',
					address: full.address ?? ''
				};
			}
		});
	}

	function pickFaculty(item: SelectFacultiesResult) {
		selectEntityRecord({
			item,
			beforeSelect: beginRecordSelection,
			setSelectedId: (id) => (selectedFacultyId = id),
			setSelectedRecord: (value) => (selectedFacultyRecord = value as SelectFacultiesResult),
			applyInitial: (value) => {
				facultyDraft = { id: value.id ?? '', name: value.name ?? '' };
			},
			loadFull: (id) => getFaculty(id).run(),
			isCurrent: () => selectedFacultyId === item.id
		});
	}

	function pickStudyProgram(item: SelectStudyProgramsResult) {
		selectEntityRecord({
			item,
			beforeSelect: beginRecordSelection,
			setSelectedId: (id) => (selectedStudyProgramId = id),
			setSelectedRecord: (value) =>
				(selectedStudyProgramRecord = value as SelectStudyProgramsResult),
			applyInitial: (value) => {
				studyProgramDraft = {
					id: value.id ?? '',
					name: value.name ?? '',
					head: value.head ?? '',
					facultyId: value.faculty_id ?? ''
				};
			},
			loadFull: (id) => getStudyProgram(id).run(),
			isCurrent: () => selectedStudyProgramId === item.id,
			applyLoaded: (full) => {
				studyProgramDraft = {
					id: full.id ?? '',
					name: full.name ?? '',
					head: full.head ?? '',
					facultyId: full.faculty_id ?? ''
				};
			}
		});
	}

	function pickEnrollment(item: SelectEnrollmentsResult) {
		pendingDelete = null;
		selectedEnrollmentId = item.id ?? null;
		selectedEnrollmentRecord = item;
		builderStep = 'review';
		const seededDraft = enrollmentDraftFromRecord(item);
		enrollmentDraft = seededDraft;
		syncEnrollmentPickerLabels(item);
		studentPickerOpen = false;
		coursePickerOpen = false;
		roomPickerOpen = false;
		if (item.id) void hydratePickedEnrollment(item.id, seededDraft);
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
		selectEntityRecord({
			item,
			beforeSelect: beginRecordSelection,
			setSelectedId: (id) => (selectedGradeId = id),
			setSelectedRecord: (value) => (selectedGradeRecord = value as SelectGradesResult),
			applyInitial: (value) => {
				gradeDraft = {
					id: value.id ?? '',
					enrollmentId: value.enrollment_id ?? '',
					assignmentScore: value.assignment_score ?? 80,
					midtermScore: value.midterm_score ?? 80,
					finalScore: value.final_score ?? 80
				};
			}
		});
	}

	function pickUser(item: SelectUsersResult) {
		selectEntityRecord({
			item,
			beforeSelect: beginRecordSelection,
			setSelectedId: (id) => (selectedUserId = id),
			setSelectedRecord: (value) => (selectedUserRecord = value as SelectUsersResult),
			applyInitial: (value) => {
				userDraft = {
					id: value.id ?? '',
					email: value.email ?? '',
					password: '',
					role: value.role ?? 'ADMIN',
					studentId: value.student_id ?? '',
					lecturerId: value.lecturer_id ?? ''
				};
			}
		});
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

	function requireCurrentRole() {
		return currentUser.current!.role as AppRole;
	}

	function openBulkEditor(activeView: EditableView, bulkView: EditableView) {
		stopEditing(activeView);
		editorView = bulkView;
	}

	function openBulkDelete(options: {
		kind: DeleteKind;
		ids: string[];
		label: string;
		successMessage: string;
		failureMessage: string;
	}) {
		pendingDelete = {
			kind: options.kind,
			id: options.ids.join(','),
			label: options.label,
			message: `Anda akan menghapus ${options.label}. Tindakan ini tidak dapat dibatalkan.`,
			confirmLabel: 'Ya, hapus semua',
			successMessage: options.successMessage,
			failureMessage: options.failureMessage
		};
	}

	function confirmPendingDelete() {
		return removeEntity(pendingDelete!.kind, pendingDelete!.id);
	}

	function cancelPendingDelete() {
		pendingDelete = null;
	}

	function createBulkDeleteAction(options: {
		kind: DeleteKind;
		bulkKey: keyof typeof bulkSelectedIds;
		noun: string;
		successMessage: string;
		failureMessage: string;
	}) {
		return () => {
			const count = bulkCount(options.bulkKey);
			openBulkDelete({
				kind: options.kind,
				ids: bulkGetIds(options.bulkKey),
				label: `${count} ${options.noun}`,
				successMessage: options.successMessage,
				failureMessage: options.failureMessage
			});
		};
	}

	const clearSelectionHandlers: Partial<Record<ViewId, () => void>> = {
		classrooms: () => {
			selectedRoomId = null;
			selectedRoomRecord = null;
			classroomDraft = emptyClassRoomDraft();
		},
		courses: () => {
			selectedCourseId = null;
			selectedCourseRecord = null;
			courseDraft = emptyCourseDraft();
		},
		students: () => {
			selectedStudentId = null;
			selectedStudentRecord = null;
			studentDraft = emptyStudentDraft();
		},
		lecturers: () => {
			selectedLecturerId = null;
			selectedLecturerRecord = null;
			lecturerDraft = emptyLecturerDraft();
		},
		faculties: () => {
			selectedFacultyId = null;
			selectedFacultyRecord = null;
			facultyDraft = emptyFacultyDraft();
		},
		studyPrograms: () => {
			selectedStudyProgramId = null;
			selectedStudyProgramRecord = null;
			studyProgramDraft = emptyStudyProgramDraft();
		},
		enrollments: () => {
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
		},
		builder: () => {
			clearSelectionHandlers.enrollments?.();
		},
		grades: () => {
			selectedGradeId = null;
			selectedGradeRecord = null;
			gradeDraft = emptyGradeDraft();
			gradeLetterFilter = '';
			gradeCourseFilter = '';
		},
		users: () => {
			selectedUserId = null;
			selectedUserRecord = null;
			userDraft = emptyUserDraft();
		}
	};

	function clearSelection(view: ViewId) {
		pendingDelete = null;
		clearSelectionHandlers[view]?.();
	}

	async function ensureGradeEditorData() {
		if (currentUser.current?.role === 'STUDENT') return;
		if (collectionLoaded.enrollments || collectionPagination.enrollments.loading) return;
		await loadCollection({
			key: 'enrollments',
			loader: () => collectionRefreshers.enrollments(null),
			fallback: collectionFallbackMessages.enrollments,
			clearIssue: clearCollectionIssue,
			setIssue: setCollectionIssue,
			errorMessage
		});
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

	type EntityDeleteKind = Exclude<DeleteKind, `bulk-${string}` | 'bulk-user'>;

	function requestDelete(kind: DeleteKind, id: string) {
		if (!id) return;
		if (
			![
				'classroom',
				'course',
				'student',
				'lecturer',
				'faculty',
				'studyProgram',
				'enrollment',
				'grade'
			].includes(kind)
		)
			return;
		const labels: Record<EntityDeleteKind, string | null | undefined> = {
			classroom: selectedRoom?.name,
			course: selectedCourse?.name,
			student: selectedStudent?.name,
			lecturer: selectedLecturer?.name,
			faculty: selectedFaculty?.name,
			studyProgram: selectedStudyProgram?.name,
			enrollment: selectedEnrollment?.course_name,
			grade: selectedGrade?.course_name
		};
		pendingDelete = buildEntityDeleteIntent({
			kind: kind as EntityDeleteKind,
			id,
			label: labels[kind as EntityDeleteKind]
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
			await refreshEnrollmentPolicyData();
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

	const createClassRoomEnhance = buildCreateRefreshEnhancer({
		createEnhancer,
		form: createClassRoom,
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(classroomScheduleRefreshPlan),
		after: () => {
			clearSelection('classrooms');
			stopEditing('classrooms');
		},
		notify: reportSuccess,
		message: 'Ruang kelas baru berhasil ditambahkan.'
	});
	const updateClassRoomEnhance = buildOptimisticRefreshEnhancer({
		createOptimisticEnhancer,
		form: updateClassRoom,
		optimistic: () => {
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
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(classroomScheduleRefreshPlan),
		after: () => stopEditing('classrooms'),
		notify: reportSuccess,
		message: 'Data ruang kelas berhasil diperbarui.'
	});
	const createCourseEnhance = buildCreateRefreshEnhancer({
		createEnhancer,
		form: createCourse,
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(courseScheduleGradesRefreshPlan),
		after: () => {
			clearSelection('courses');
			stopEditing('courses');
		},
		notify: reportSuccess,
		message: 'Mata kuliah baru berhasil ditambahkan.'
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
	const createStudentEnhance = buildCreateRefreshEnhancer({
		createEnhancer,
		form: createStudent,
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(studentAcademicUsersRefreshPlan),
		after: () => {
			clearSelection('students');
			stopEditing('students');
		},
		notify: reportSuccess,
		message: 'Mahasiswa baru berhasil ditambahkan.'
	});
	const updateStudentEnhance = buildOptimisticRefreshEnhancer({
		createOptimisticEnhancer,
		form: updateStudent,
		optimistic: () => {
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
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(studentAcademicUsersRefreshPlan),
		after: () => stopEditing('students'),
		notify: reportSuccess,
		message: 'Profil mahasiswa berhasil diperbarui.'
	});
	const createLecturerEnhance = buildCreateRefreshEnhancer({
		createEnhancer,
		form: createLecturer,
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(lecturerCourseUsersRefreshPlan),
		after: () => {
			clearSelection('lecturers');
			stopEditing('lecturers');
		},
		notify: reportSuccess,
		message: 'Dosen baru berhasil ditambahkan.'
	});
	const updateLecturerEnhance = buildOptimisticRefreshEnhancer({
		createOptimisticEnhancer,
		form: updateLecturer,
		optimistic: () => {
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
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(lecturerCourseUsersRefreshPlan),
		after: () => stopEditing('lecturers'),
		notify: reportSuccess,
		message: 'Profil Dosen berhasil diperbarui.'
	});
	const createFacultyEnhance = buildCreateRefreshEnhancer({
		createEnhancer,
		form: createFaculty,
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(facultyDeleteRefreshPlan),
		after: () => {
			clearSelection('faculties');
			stopEditing('faculties');
		},
		notify: reportSuccess,
		message: 'Fakultas baru berhasil ditambahkan.'
	});
	const updateFacultyEnhance = buildOptimisticRefreshEnhancer({
		createOptimisticEnhancer,
		form: updateFaculty,
		optimistic: () => {
			const id = selectedFacultyId;
			if (!id) return;
			faculties = faculties.map((faculty) =>
				faculty.id === id ? { ...faculty, name: facultyDraft.name } : faculty
			);
		},
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(facultyDeleteRefreshPlan),
		after: () => stopEditing('faculties'),
		notify: reportSuccess,
		message: 'Data fakultas berhasil diperbarui.'
	});
	const createStudyProgramEnhance = buildCreateRefreshEnhancer({
		createEnhancer,
		form: createStudyProgram,
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(studyProgramAcademicRefreshPlan),
		after: () => {
			clearSelection('studyPrograms');
			stopEditing('studyPrograms');
		},
		notify: reportSuccess,
		message: 'Program studi baru berhasil ditambahkan.'
	});
	const updateStudyProgramEnhance = buildOptimisticRefreshEnhancer({
		createOptimisticEnhancer,
		form: updateStudyProgram,
		optimistic: () => {
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
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(studyProgramAcademicRefreshPlan),
		after: () => stopEditing('studyPrograms'),
		notify: reportSuccess,
		message: 'Program studi berhasil diperbarui.'
	});
	const createEnrollmentEnhance = buildCreateRefreshEnhancer({
		createEnhancer,
		form: createEnrollment,
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(enrollmentGradesRefreshPlan),
		after: async () => {
			const createdId = (createEnrollment.result as { id?: string } | undefined)?.id ?? null;
			await syncBuilderSelection(createdId, true);
		},
		notify: reportSuccess,
		message: 'Jadwal dan KRS tersimpan. Lanjutkan hanya bila ruang dan jam sudah sesuai.'
	});
	const updateEnrollmentEnhance = buildCreateRefreshEnhancer({
		createEnhancer,
		form: updateEnrollment,
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(enrollmentGradesRefreshPlan),
		after: () => syncBuilderSelection(),
		notify: reportSuccess,
		message:
			'Jadwal diperbarui. Periksa kembali konflik dan kecocokan ruang sebelum menutup halaman.'
	});
	const requestEnrollmentEnhance = buildCreateRefreshEnhancer({
		createEnhancer,
		form: requestEnrollment,
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(enrollmentGradesRefreshPlan),
		after: () => clearSelection('builder'),
		notify: reportSuccess,
		message: 'Pengajuan mata kuliah berhasil dikirim. Menunggu persetujuan Dosen/Admin.'
	});
	const approveEnrollmentEnhance = buildCreateRefreshEnhancer({
		createEnhancer,
		form: approveEnrollment,
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(enrollmentGradesRefreshPlan),
		after: () => syncBuilderSelection(),
		notify: reportSuccess,
		message: 'KRS berhasil disetujui dan jadwal ditetapkan.'
	});
	const updateEnrollmentPolicyEnhance = createEnhancer(updateEnrollmentPolicy, async () => {
		await refreshEnrollmentPolicyData();
		reportSuccess('Pengaturan pengajuan KRS berhasil diperbarui.');
	});
	async function handleCancelEnrollmentRequest(id: string) {
		try {
			await cancelEnrollmentRequest(id);
			if (selectedEnrollmentId === id) {
				clearSelection('enrollments');
			}
			await refreshDependencies({ collections: ['enrollments'], includeSchedulePreview: true });
			setFeedback('success', 'Pengajuan berhasil dibatalkan.');
		} catch (err) {
			const message = (err as { body?: { message?: string }; message?: string })?.body?.message;
			setFeedback('danger', message || 'Gagal membatalkan pengajuan.');
		}
	}
	async function handleRejectEnrollment(id: string) {
		try {
			await rejectEnrollment(id);
			if (selectedEnrollmentId === id) {
				clearSelection('enrollments');
			}
			await refreshDependencies({ collections: ['enrollments'], includeSchedulePreview: true });
			setFeedback('success', 'Pengajuan berhasil ditolak.');
		} catch (err) {
			const message = (err as { body?: { message?: string }; message?: string })?.body?.message;
			setFeedback('danger', message || 'Gagal menolak pengajuan.');
		}
	}
	const createGradeEnhance = buildCreateRefreshEnhancer({
		createEnhancer,
		form: createGrade,
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(gradesRefreshPlan),
		after: () => {
			clearSelection('grades');
			stopEditing('grades');
		},
		notify: reportSuccess,
		message: 'Nilai baru berhasil disimpan.'
	});
	const updateGradeEnhance = buildOptimisticRefreshEnhancer({
		createOptimisticEnhancer,
		form: updateGrade,
		optimistic: () => {
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
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(gradesRefreshPlan),
		after: () => stopEditing('grades'),
		notify: reportSuccess,
		message: 'Nilai berhasil diperbarui.'
	});
	const updateUserEnhance = buildOptimisticRefreshEnhancer({
		createOptimisticEnhancer,
		form: updateUser,
		optimistic: () => {
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
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(usersRefreshPlan),
		after: () => stopEditing('users'),
		notify: reportSuccess,
		message: 'Akun diperbarui. Perubahan akses akan dipakai pada sesi berikutnya.'
	});

	const bulkUpdateUserRoleEnhance = createEnhancer(
		bulkUpdateUserRoles,
		createRefreshSuccess({
			refresh: refreshDependencies,
			plan: () => cloneRefreshPlan(usersRefreshPlan),
			after: clearUserSelection,
			notify: reportSuccess,
			message: 'Peran akun berhasil diperbarui.'
		})
	);
	const bulkResetPasswordEnhance = createEnhancer(
		bulkResetPasswords,
		createRefreshSuccess({
			refresh: refreshDependencies,
			plan: () => cloneRefreshPlan(usersRefreshPlan),
			after: clearUserSelection,
			notify: reportSuccess,
			message: 'Password akun terpilih berhasil direset.'
		})
	);
	const bulkUpdateClassRoomsEnhance = buildOptimisticRefreshEnhancer({
		createOptimisticEnhancer,
		form: bulkUpdateClassRooms,
		optimistic: () => {
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
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(classroomScheduleRefreshPlan),
		after: () => {
			bulkClear('classrooms');
			stopEditing('classrooms');
		},
		notify: reportSuccess,
		message: 'Ruang terpilih berhasil diperbarui.'
	});
	const bulkUpdateCoursesEnhance = buildOptimisticRefreshEnhancer({
		createOptimisticEnhancer,
		form: bulkUpdateCourses,
		optimistic: () => {
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
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(courseScheduleGradesRefreshPlan),
		after: () => {
			bulkClear('courses');
			stopEditing('courses');
		},
		notify: reportSuccess,
		message: 'Mata kuliah terpilih berhasil diperbarui.'
	});
	const bulkUpdateStudentsEnhance = buildOptimisticRefreshEnhancer({
		createOptimisticEnhancer,
		form: bulkUpdateStudents,
		optimistic: () => {
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
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(studentsRefreshPlan),
		after: () => {
			bulkClear('students');
			stopEditing('students');
		},
		notify: reportSuccess,
		message: 'Mahasiswa terpilih berhasil diperbarui.'
	});
	const bulkUpdateLecturersEnhance = buildOptimisticRefreshEnhancer({
		createOptimisticEnhancer,
		form: bulkUpdateLecturers,
		optimistic: () => {
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
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(lecturersRefreshPlan),
		after: () => {
			bulkClear('lecturers');
			stopEditing('lecturers');
		},
		notify: reportSuccess,
		message: 'Dosen terpilih berhasil diperbarui.'
	});
	const bulkUpdateFacultiesEnhance = buildOptimisticRefreshEnhancer({
		createOptimisticEnhancer,
		form: bulkUpdateFaculties,
		optimistic: () => {
			const ids = new Set(bulkGetIds('faculties'));
			faculties = faculties.map((faculty) =>
				ids.has(faculty.id ?? '') ? { ...faculty, name: bulkEditFacultyName } : faculty
			);
		},
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(facultyUpdateRefreshPlan),
		after: () => {
			bulkClear('faculties');
			stopEditing('faculties');
		},
		notify: reportSuccess,
		message: 'Fakultas terpilih berhasil diperbarui.'
	});
	const bulkUpdateStudyProgramsEnhance = buildOptimisticRefreshEnhancer({
		createOptimisticEnhancer,
		form: bulkUpdateStudyPrograms,
		optimistic: () => {
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
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(studyProgramUpdateRefreshPlan),
		after: () => {
			bulkClear('studyPrograms');
			stopEditing('studyPrograms');
		},
		notify: reportSuccess,
		message: 'Prodi terpilih berhasil diperbarui.'
	});
	const bulkUpdateEnrollmentsEnhance = buildOptimisticRefreshEnhancer({
		createOptimisticEnhancer,
		form: bulkUpdateEnrollments,
		optimistic: () => {
			const ids = new Set(bulkGetIds('enrollments'));
			enrollments = enrollments.map((enrollment) =>
				ids.has(enrollment.id ?? '')
					? {
							...enrollment,
							semester: bulkEditEnrollmentSemester || enrollment.semester,
							academic_year: bulkEditEnrollmentAcademicYear || enrollment.academic_year
						}
					: enrollment
			);
		},
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(enrollmentGradesRefreshPlan),
		after: () => {
			bulkClear('enrollments');
			bulkEditEnrollmentSemester = '';
			bulkEditEnrollmentAcademicYear = '';
			editorView = null;
		},
		notify: reportSuccess,
		message: 'KRS terpilih berhasil diperbarui.'
	});
	const bulkUpdateGradesEnhance = buildOptimisticRefreshEnhancer({
		createOptimisticEnhancer,
		form: bulkUpdateGrades,
		optimistic: () => {
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
		refresh: refreshDependencies,
		plan: () => cloneRefreshPlan(gradesRefreshPlan),
		after: () => {
			bulkClear('grades');
			stopEditing('grades');
		},
		notify: reportSuccess,
		message: 'Nilai terpilih berhasil diperbarui.'
	});

	const singleDeletePlans = {
		classroom: {
			execute: deleteClassRoom,
			refresh: classroomScheduleRefreshPlan,
			afterDelete: async () => {
				clearSelection('classrooms');
				stopEditing('classrooms');
			}
		},
		course: {
			execute: deleteCourse,
			refresh: courseScheduleGradesRefreshPlan,
			afterDelete: async () => {
				clearSelection('courses');
				stopEditing('courses');
			}
		},
		student: {
			execute: deleteStudent,
			refresh: studentAcademicUsersRefreshPlan,
			afterDelete: async () => {
				clearSelection('students');
				stopEditing('students');
			}
		},
		lecturer: {
			execute: deleteLecturer,
			refresh: lecturerCourseUsersRefreshPlan,
			afterDelete: async () => {
				clearSelection('lecturers');
				stopEditing('lecturers');
			}
		},
		faculty: {
			execute: deleteFaculty,
			refresh: facultyDeleteRefreshPlan,
			afterDelete: async () => {
				clearSelection('faculties');
				stopEditing('faculties');
			}
		},
		studyProgram: {
			execute: deleteStudyProgram,
			refresh: studyProgramAcademicRefreshPlan,
			afterDelete: async () => {
				clearSelection('studyPrograms');
				stopEditing('studyPrograms');
			}
		},
		enrollment: {
			execute: deleteEnrollment,
			refresh: enrollmentGradesRefreshPlan,
			afterDelete: async (id: string) => {
				await syncBuilderSelection(id, true);
			}
		},
		grade: {
			execute: deleteGrade,
			refresh: gradesRefreshPlan,
			afterDelete: async () => {
				clearSelection('grades');
				stopEditing('grades');
			}
		}
	} as const;

	const bulkDeletePlans = {
		'bulk-user': {
			execute: bulkDeleteUsers,
			refresh: usersRefreshPlan,
			afterDelete: async () => {
				clearUserSelection();
				clearSelection('users');
				stopEditing('users');
			}
		},
		'bulk-classrooms': {
			execute: bulkDeleteClassRooms,
			refresh: classroomScheduleRefreshPlan,
			afterDelete: async () => {
				bulkClear('classrooms');
				clearSelection('classrooms');
				stopEditing('classrooms');
			}
		},
		'bulk-courses': {
			execute: bulkDeleteCourses,
			refresh: courseScheduleGradesRefreshPlan,
			afterDelete: async () => {
				bulkClear('courses');
				clearSelection('courses');
				stopEditing('courses');
			}
		},
		'bulk-students': {
			execute: bulkDeleteStudents,
			refresh: studentAcademicUsersRefreshPlan,
			afterDelete: async () => {
				bulkClear('students');
				clearSelection('students');
				stopEditing('students');
			}
		},
		'bulk-lecturers': {
			execute: bulkDeleteLecturers,
			refresh: lecturerCourseUsersRefreshPlan,
			afterDelete: async () => {
				bulkClear('lecturers');
				clearSelection('lecturers');
				stopEditing('lecturers');
			}
		},
		'bulk-faculties': {
			execute: bulkDeleteFaculties,
			refresh: facultyDeleteRefreshPlan,
			afterDelete: async () => {
				bulkClear('faculties');
				clearSelection('faculties');
				stopEditing('faculties');
			}
		},
		'bulk-studyPrograms': {
			execute: bulkDeleteStudyPrograms,
			refresh: studyProgramAcademicRefreshPlan,
			afterDelete: async () => {
				bulkClear('studyPrograms');
				clearSelection('studyPrograms');
				stopEditing('studyPrograms');
			}
		},
		'bulk-enrollments': {
			execute: bulkDeleteEnrollments,
			refresh: enrollmentGradesRefreshPlan,
			afterDelete: async () => {
				bulkClear('enrollments');
				clearSelection('enrollments');
				stopEditing();
			}
		},
		'bulk-grades': {
			execute: bulkDeleteGrades,
			refresh: gradesRefreshPlan,
			afterDelete: async () => {
				bulkClear('grades');
				clearSelection('grades');
				stopEditing('grades');
			}
		}
	} as const;

	async function removeEntity(kind: DeleteKind, id: string) {
		if (!pendingDelete) return; // guard against double-click / concurrent delete
		const intent = pendingDelete;
		pendingDelete = null; // prevent re-entry before async completes
		await runDeletePlan({
			kind,
			id,
			singlePlans: singleDeletePlans,
			bulkPlans: bulkDeletePlans,
			refresh: (plan) =>
				refreshDependencies({
					...plan,
					collections: [...plan.collections] as DataCollectionKey[]
				}),
			onSuccess: reportSuccess,
			onFailure: reportDanger,
			intent
		});
	}

	async function handleRefreshCurrentView() {
		if (viewRefreshLoading) return;
		viewRefreshLoading = true;
		try {
			await refreshViewData(activeView);
			const issues = getViewIssues(activeView, currentUser.current?.role as AppRole | undefined);
			if (issues.length) {
				setFeedback(
					'danger',
					`${pageHeading(activeView, currentUser.current?.role as AppRole | undefined)} belum bisa dimuat sepenuhnya. Coba lagi atau refresh halaman.`
				);
				return;
			}
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

	function refreshPage() {
		if (!browser) return;
		window.location.reload();
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
	const activeViewIssues = $derived(
		getViewIssues(activeView, currentUser.current?.role as AppRole | undefined)
	);
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
	const enrollmentScheduleCardMap = $derived({ ...scheduleCardMap, ...auditConflictCardMap });
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
	const calendarSessionKeys = $derived.by(() => new Set(calendarScheduleCards.map(scheduleSessionKey)));
	const calendarSelectedScheduleConflictPeers = $derived(
		selectedScheduleConflictPeers.filter((peer) => calendarSessionKeys.has(scheduleSessionKey(peer)))
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

	const dashboardViewProps = $derived.by(() =>
		buildDashboardViewProps({
			role: requireCurrentRole(),
			nextSchedule,
			scheduleCards:
				requireCurrentRole() === 'STUDENT' ? weeklyScheduleCards : upcomingScheduleCards,
			enrollments,
			grades,
			studentGradeHighlights,
			conflictCount,
			primaryConflict,
			additionalConflictCount,
			conflictGroupDetailsById,
			underusedRooms,
			classRoomDashboardSummary,
			classRoomDashboardMetrics: classRoomDashboardMetrics?.items ?? [],
			classRoomDashboardPagination,
			selectedRoomId,
			conflictedCount: conflictAudit?.summary?.conflictedRooms ?? 0,
			onActivateView: activateView,
			onNavigateToEntity: navigateToEntity,
			onOpenBuilderForSchedule: openBuilderForSchedule,
			onOpenCalendarForSchedule: openCalendarForSchedule,
			onPickRoom: (id: string) => (selectedRoomId = id),
			onPreviousPage: () => changeClassRoomDashboardPage('previous'),
			onNextPage: () => changeClassRoomDashboardPage('next'),
			handleKeyboardClick
		})
	);

	const calendarViewProps = $derived.by(() =>
		buildCalendarViewProps({
			currentRole: requireCurrentRole(),
			calendarWeekLabel,
			courses,
			lecturers,
			scheduleSemesterOptions,
			scheduleAcademicYearOptions,
			filteredScheduleCards: calendarScheduleCards,
			scheduleActiveFilterCount,
			calendarConflictLegend,
			calendarNeedsFilters,
			calendarExceedsVisibleLimit,
			calendarMaxVisibleSchedules: CALENDAR_MAX_VISIBLE_SCHEDULES,
			EventCalendarComponent,
			calendarPlugins,
			calendarOptions,
			calendarDetailSchedule,
			selectedScheduleConflictSummary,
			selectedScheduleConflictGroup,
			selectedScheduleConflictPeers: calendarSelectedScheduleConflictPeers,
			selectedScheduleOverlapPeers,
			selectedScheduleId,
			scheduleRoomFilterOptions,
			filteredScheduleRoomFilterOptions,
			scheduleRoomFilterIssue,
			scheduleRoomFilterLoading,
			scheduleRoomFilterHasMore,
			selectedScheduleRoomFilterLabel: scheduleRoomFilter
				? (classrooms.find((r) => r.id === scheduleRoomFilter)?.name ?? '')
				: '',
			queueCollectionRefresh,
			queueScheduleRoomFilterRefresh,
			loadMoreScheduleRoomFilterOptions,
			resetScheduleFilters,
			toggleConflictGroup,
			navigateToEntity,
			openBuilderForSchedule,
			focusSchedule,
			clearCalendarSelection,
			handleKeyboardClick,
			studentStudyProgramId: currentUser.current?.studyProgramId ?? null
		})
	);

	const builderViewProps = $derived.by(() =>
		buildBuilderViewProps({
			...buildPaginationActions({
				key: 'enrollments',
				changeCollectionPage
			}),
			builderTaskMode,
			selectedEnrollmentId,
			pendingDelete,
			filteredBuilderEnrollments,
			scheduleCardMap: enrollmentScheduleCardMap,
			auditConflictCardMap,
			conflictSummaryByCardId,
			collectionPagination: collectionPagination.enrollments,
			scheduleSemesterOptions,
			scheduleAcademicYearOptions,
			scheduleActiveFilterCount,
			scheduleCourseFilterOptions,
			scheduleRoomFilterOptions,
			filteredScheduleRoomFilterOptions,
			scheduleLecturerFilterOptions,
			scheduleCourseFilterIssue,
			scheduleRoomFilterIssue,
			scheduleLecturerFilterIssue,
			scheduleCourseFilterLoading,
			scheduleRoomFilterLoading,
			scheduleLecturerFilterLoading,
			scheduleCourseFilterHasMore,
			scheduleRoomFilterHasMore,
			scheduleLecturerFilterHasMore,
			selectedScheduleCourseFilterLabel,
			selectedScheduleRoomFilterLabel,
			selectedScheduleLecturerFilterLabel,
			selectedEnrollmentScheduleCard,
			selectedEnrollmentConflictSummary,
			selectedEnrollmentConflictGroup,
			selectedDraftStudent,
			selectedDraftCourse,
			selectedDraftRoom,
			draftTimeSummary,
			filteredRoomsForPicker,
			builderConflictCards,
			conflictCount,
			studentPickerOptions: filteredStudentsForPicker,
			coursePickerOptions: filteredCoursesForPicker,
			studentPickerIssue,
			coursePickerIssue,
			roomPickerIssue,
			studentPickerLoading,
			coursePickerLoading,
			roomPickerLoading,
			studentPickerHasMore,
			coursePickerHasMore,
			roomPickerHasMore,
			createEnrollment,
			updateEnrollment,
			approveEnrollment,
			builderMode,
			createEnrollmentEnhance,
			updateEnrollmentEnhance,
			approveEnrollmentEnhance,
			handleKeyboardClick,
			onClearSelection: () => clearSelection('builder'),
			onQueueEnrollmentRefresh: (delay?: number) => queueCollectionRefresh('enrollments', delay),
			onQueueScheduleCourseFilterRefresh: queueScheduleCourseFilterRefresh,
			onQueueScheduleRoomFilterRefresh: queueScheduleRoomFilterRefresh,
			onQueueScheduleLecturerFilterRefresh: queueScheduleLecturerFilterRefresh,
			onLoadMoreScheduleCourseFilterOptions: loadMoreScheduleCourseFilterOptions,
			onLoadMoreScheduleRoomFilterOptions: loadMoreScheduleRoomFilterOptions,
			onLoadMoreScheduleLecturerFilterOptions: loadMoreScheduleLecturerFilterOptions,
			onPickEnrollment: pickEnrollment,
			onNavigateToEntity: navigateToEntity,
			onResetScheduleFilters: resetScheduleFilters,
			onOpenBuilderForSchedule: openBuilderForSchedule,
			onOpenCalendarForSchedule: openCalendarForSchedule,
			onRequestDeleteEnrollment: () => requestDelete('enrollment', selectedEnrollmentId!),
			onConfirmDelete: confirmPendingDelete,
			onCancelDelete: cancelPendingDelete,
			onQueueStudentPickerRefresh: queueStudentPickerRefresh,
			onQueueCoursePickerRefresh: queueCoursePickerRefresh,
			onQueueRoomPickerRefresh: queueRoomPickerRefresh,
			onLoadMoreStudentPickerOptions: loadMoreStudentPickerOptions,
			onLoadMoreCoursePickerOptions: loadMoreCoursePickerOptions,
			onLoadMoreRoomPickerOptions: loadMoreRoomPickerOptions
		})
	);

	const classroomsViewProps = $derived.by(() => ({
		...buildCrudEntityViewProps({
			key: 'classrooms',
			reset: () => {
				roomSearch = '';
			},
			queueCollectionRefresh,
			changeCollectionPage,
			currentRole: requireCurrentRole(),
			editorView,
			pendingDelete,
			handleKeyboardClick,
			onNavigateToEntity: navigateToEntity,
			bulkSelectedIds: bulkSelectedIds.classrooms ?? new Set(),
			bulkCount: bulkCount('classrooms'),
			bulkClear,
			bulkToggleAll,
			bulkToggleId,
			selectedId: selectedRoomId,
			editView: 'classrooms',
			bulkView: 'classrooms-bulk',
			deleteKind: 'classroom',
			beginCreate,
			beginEdit,
			stopEditing,
			requestDelete,
			confirmPendingDelete,
			cancelPendingDelete,
			openBulkEditor,
			openBulkDelete: createBulkDeleteAction({
				kind: 'bulk-classrooms',
				bulkKey: 'classrooms',
				noun: 'ruang',
				successMessage: 'Ruang terpilih berhasil dihapus.',
				failureMessage: 'Gagal menghapus ruang terpilih.'
			}),
			extras: {
				filteredClassrooms,
				selectedRoomId,
				selectedRoom,
				collectionPagination: collectionPagination.classrooms,
				createClassRoom,
				updateClassRoom,
				bulkUpdateClassRooms,
				createClassRoomEnhance,
				updateClassRoomEnhance,
				bulkUpdateClassRoomsEnhance,
				classRoomTypes,
				beautifyRoomType,
				onPickClassroom: pickClassroom
			}
		})
	}));

	const coursesViewProps = $derived.by(() => ({
		...buildCrudEntityViewProps({
			key: 'courses',
			reset: () => {
				courseSearch = '';
			},
			queueCollectionRefresh,
			changeCollectionPage,
			currentRole: requireCurrentRole(),
			editorView,
			pendingDelete,
			handleKeyboardClick,
			onNavigateToEntity: navigateToEntity,
			bulkSelectedIds: bulkSelectedIds.courses ?? new Set(),
			bulkCount: bulkCount('courses'),
			bulkClear,
			bulkToggleAll,
			bulkToggleId,
			selectedId: selectedCourseId,
			editView: 'courses',
			bulkView: 'courses-bulk',
			deleteKind: 'course',
			beginCreate,
			beginEdit,
			stopEditing,
			requestDelete,
			confirmPendingDelete,
			cancelPendingDelete,
			openBulkEditor,
			openBulkDelete: createBulkDeleteAction({
				kind: 'bulk-courses',
				bulkKey: 'courses',
				noun: 'mata kuliah',
				successMessage: 'Mata kuliah terpilih berhasil dihapus.',
				failureMessage: 'Gagal menghapus mata kuliah terpilih.'
			}),
			extras: {
				filteredCourses,
				selectedCourseId,
				selectedCourse,
				collectionPagination: collectionPagination.courses,
				updateCourseEnhance,
				createCourseEnhance,
				bulkUpdateCoursesEnhance,
				studyPrograms,
				lecturers,
				studyProgramsIssue: collectionIssues.studyPrograms,
				lecturersIssue: collectionIssues.lecturers,
				courseEditorBlocked,
				onPickCourse: pickCourse
			}
		})
	}));

	const studentsViewProps = $derived.by(() => ({
		...buildCrudEntityViewProps({
			key: 'students',
			reset: () => {
				studentSearch = '';
			},
			queueCollectionRefresh,
			changeCollectionPage,
			currentRole: requireCurrentRole(),
			editorView,
			pendingDelete,
			handleKeyboardClick,
			onNavigateToEntity: navigateToEntity,
			bulkSelectedIds: bulkSelectedIds.students ?? new Set(),
			bulkCount: bulkCount('students'),
			bulkClear,
			bulkToggleAll,
			bulkToggleId,
			selectedId: selectedStudentId,
			editView: 'students',
			bulkView: 'students-bulk',
			deleteKind: 'student',
			beginCreate,
			beginEdit,
			stopEditing,
			requestDelete,
			confirmPendingDelete,
			cancelPendingDelete,
			openBulkEditor,
			openBulkDelete: createBulkDeleteAction({
				kind: 'bulk-students',
				bulkKey: 'students',
				noun: 'mahasiswa',
				successMessage: 'Mahasiswa terpilih berhasil dihapus.',
				failureMessage: 'Gagal menghapus mahasiswa terpilih.'
			}),
			extras: {
				filteredStudents,
				selectedStudentId,
				selectedStudent,
				collectionPagination: collectionPagination.students,
				createStudent,
				updateStudent,
				bulkUpdateStudents,
				createStudentEnhance,
				updateStudentEnhance,
				bulkUpdateStudentsEnhance,
				studyPrograms,
				studyProgramsIssue: collectionIssues.studyPrograms,
				studentEditorBlocked,
				onPickStudent: pickStudent
			}
		})
	}));

	const lecturersViewProps = $derived.by(() => ({
		...buildCrudEntityViewProps({
			key: 'lecturers',
			reset: () => {
				lecturerSearch = '';
			},
			queueCollectionRefresh,
			changeCollectionPage,
			currentRole: requireCurrentRole(),
			editorView,
			pendingDelete,
			handleKeyboardClick,
			onNavigateToEntity: navigateToEntity,
			bulkSelectedIds: bulkSelectedIds.lecturers ?? new Set(),
			bulkCount: bulkCount('lecturers'),
			bulkClear,
			bulkToggleAll,
			bulkToggleId,
			selectedId: selectedLecturerId,
			editView: 'lecturers',
			bulkView: 'lecturers-bulk',
			deleteKind: 'lecturer',
			beginCreate,
			beginEdit,
			stopEditing,
			requestDelete,
			confirmPendingDelete,
			cancelPendingDelete,
			openBulkEditor,
			openBulkDelete: createBulkDeleteAction({
				kind: 'bulk-lecturers',
				bulkKey: 'lecturers',
				noun: 'Dosen',
				successMessage: 'Dosen terpilih berhasil dihapus.',
				failureMessage: 'Gagal menghapus Dosen terpilih.'
			}),
			extras: {
				filteredLecturers,
				selectedLecturerId,
				selectedLecturer,
				collectionPagination: collectionPagination.lecturers,
				createLecturer,
				updateLecturer,
				bulkUpdateLecturers,
				createLecturerEnhance,
				updateLecturerEnhance,
				bulkUpdateLecturersEnhance,
				onPickLecturer: pickLecturer
			}
		})
	}));

	const facultiesViewProps = $derived.by(() => ({
		...buildCrudEntityViewProps({
			key: 'faculties',
			reset: () => {
				facultySearch = '';
			},
			queueCollectionRefresh,
			changeCollectionPage,
			currentRole: requireCurrentRole(),
			editorView,
			pendingDelete,
			handleKeyboardClick,
			onNavigateToEntity: navigateToEntity,
			bulkSelectedIds: bulkSelectedIds.faculties ?? new Set(),
			bulkCount: bulkCount('faculties'),
			bulkClear,
			bulkToggleAll,
			bulkToggleId,
			selectedId: selectedFacultyId,
			editView: 'faculties',
			bulkView: 'faculties-bulk',
			deleteKind: 'faculty',
			beginCreate,
			beginEdit,
			stopEditing,
			requestDelete,
			confirmPendingDelete,
			cancelPendingDelete,
			openBulkEditor,
			openBulkDelete: createBulkDeleteAction({
				kind: 'bulk-faculties',
				bulkKey: 'faculties',
				noun: 'fakultas',
				successMessage: 'Fakultas terpilih berhasil dihapus.',
				failureMessage: 'Gagal menghapus fakultas terpilih.'
			}),
			extras: {
				filteredFaculties,
				selectedFacultyId,
				selectedFaculty,
				collectionPagination: collectionPagination.faculties,
				createFaculty,
				updateFaculty,
				bulkUpdateFaculties,
				createFacultyEnhance,
				updateFacultyEnhance,
				bulkUpdateFacultiesEnhance,
				onPickFaculty: pickFaculty
			}
		})
	}));

	const studyProgramsViewProps = $derived.by(() => ({
		...buildCrudEntityViewProps({
			key: 'studyPrograms',
			reset: () => {
				studyProgramSearch = '';
			},
			queueCollectionRefresh,
			changeCollectionPage,
			currentRole: requireCurrentRole(),
			editorView,
			pendingDelete,
			handleKeyboardClick,
			onNavigateToEntity: navigateToEntity,
			bulkSelectedIds: bulkSelectedIds.studyPrograms ?? new Set(),
			bulkCount: bulkCount('studyPrograms'),
			bulkClear,
			bulkToggleAll,
			bulkToggleId,
			selectedId: selectedStudyProgramId,
			editView: 'studyPrograms',
			bulkView: 'studyPrograms-bulk',
			deleteKind: 'studyProgram',
			beginCreate,
			beginEdit,
			stopEditing,
			requestDelete,
			confirmPendingDelete,
			cancelPendingDelete,
			openBulkEditor,
			openBulkDelete: createBulkDeleteAction({
				kind: 'bulk-studyPrograms',
				bulkKey: 'studyPrograms',
				noun: 'prodi',
				successMessage: 'Prodi terpilih berhasil dihapus.',
				failureMessage: 'Gagal menghapus prodi terpilih.'
			}),
			extras: {
				filteredStudyPrograms,
				selectedStudyProgramId,
				selectedStudyProgram,
				collectionPagination: collectionPagination.studyPrograms,
				createStudyProgram,
				updateStudyProgram,
				bulkUpdateStudyPrograms,
				createStudyProgramEnhance,
				updateStudyProgramEnhance,
				bulkUpdateStudyProgramsEnhance,
				faculties,
				facultiesIssue: collectionIssues.faculties,
				studyProgramEditorBlocked,
				onPickStudyProgram: pickStudyProgram
			}
		})
	}));

	const enrollmentsViewProps = $derived.by(() =>
		buildEnrollmentsViewProps({
			...buildBulkViewBase({
				key: 'enrollments',
				reset: () => {
					enrollmentSearch = '';
				},
				queueCollectionRefresh,
				changeCollectionPage,
				currentRole: requireCurrentRole(),
				editorView,
				pendingDelete,
				handleKeyboardClick,
				onNavigateToEntity: navigateToEntity,
				bulkSelectedIds: bulkSelectedIds.enrollments ?? new Set(),
				bulkCount: bulkCount('enrollments'),
				bulkClear,
				bulkToggleAll,
				bulkToggleId
			}),
			filteredEnrollments,
			selectedEnrollmentId,
			selectedEnrollment,
			selectedEnrollmentConflictSummary,
			selectedEnrollmentConflictGroup,
			scheduleCardMap: enrollmentScheduleCardMap,
			conflictSummaryByCardId,
			courses,
			lecturers,
			scheduleSemesterOptions,
			scheduleAcademicYearOptions,
			scheduleActiveFilterCount,
			collectionPagination: collectionPagination.enrollments,
			bulkUpdateEnrollmentsEnhance,
			bulkEditEnrollmentSemester,
			bulkEditEnrollmentAcademicYear,
			requestEnrollmentEnhance,
			updateEnrollmentPolicyEnhance,
			enrollmentPolicy,
			enrollmentPolicyDraft,
			enrollmentPolicyLoaded,
			enrollmentPolicyIssue,
			studentStudyProgramId: currentUser.current?.studyProgramId ?? null,
			days,
			timezone,
			onBulkEditEnrollmentSemesterInput: (value: string) => (bulkEditEnrollmentSemester = value),
			onBulkEditEnrollmentAcademicYearInput: (value: string) =>
				(bulkEditEnrollmentAcademicYear = value),
			onEnrollmentPolicyDraftSemesterInput: (value: 'GANJIL' | 'GENAP') =>
				(enrollmentPolicyDraft = { ...enrollmentPolicyDraft, semester: value }),
			onEnrollmentPolicyDraftAcademicYearInput: (value: string) =>
				(enrollmentPolicyDraft = { ...enrollmentPolicyDraft, academicYear: value }),
			onEnrollmentPolicyDraftRequestsOpenChange: (value: boolean) =>
				(enrollmentPolicyDraft = { ...enrollmentPolicyDraft, requestsOpen: value }),
			onOpenBulkEdit: () => {
				bulkEditEnrollmentSemester = '';
				bulkEditEnrollmentAcademicYear = '';
				editorView = 'enrollments-bulk';
			},
			onOpenBulkDelete: createBulkDeleteAction({
				kind: 'bulk-enrollments',
				bulkKey: 'enrollments',
				noun: 'KRS',
				successMessage: 'KRS terpilih berhasil dihapus.',
				failureMessage: 'Gagal menghapus KRS terpilih.'
			}),
			onOpenBuilderForEnrollment: openBuilderForEnrollment,
			onOpenBuilderForApproval: (item: SelectEnrollmentsResult) => {
				pickEnrollment(item);
				builderStep = 'time';
				activeView = 'builder';
			},
			onCancelRequest: handleCancelEnrollmentRequest,
			onRejectRequest: handleRejectEnrollment,
			onShowPolicySettings: () => {
				resetEnrollmentPolicyDraft();
				clearSelection('enrollments');
			},
			onStartRequest: () => clearSelection('enrollments'),
			onResetScheduleFilters: resetScheduleFilters,
			onPickEnrollment: pickEnrollment,
			onDayChange: () => queueCollectionRefresh('enrollments', 0),
			onCourseFilterChange: () => queueCollectionRefresh('enrollments', 0),
			onSemesterFilterChange: () => queueCollectionRefresh('enrollments', 0),
			onAcademicYearFilterChange: () => queueCollectionRefresh('enrollments', 0)
		})
	);

	const gradesViewProps = $derived.by(() => ({
		...buildCrudEntityViewProps({
			key: 'grades',
			reset: () => {
				gradeSearch = '';
			},
			queueCollectionRefresh,
			changeCollectionPage,
			currentRole: requireCurrentRole(),
			editorView,
			pendingDelete,
			handleKeyboardClick,
			onNavigateToEntity: navigateToEntity,
			bulkSelectedIds: bulkSelectedIds.grades ?? new Set(),
			bulkCount: bulkCount('grades'),
			bulkClear,
			bulkToggleAll,
			bulkToggleId,
			selectedId: selectedGradeId,
			editView: 'grades',
			bulkView: 'grades-bulk',
			deleteKind: 'grade',
			beginCreate,
			beginEdit,
			stopEditing,
			requestDelete,
			confirmPendingDelete,
			cancelPendingDelete,
			openBulkEditor,
			openBulkDelete: createBulkDeleteAction({
				kind: 'bulk-grades',
				bulkKey: 'grades',
				noun: 'nilai',
				successMessage: 'Nilai terpilih berhasil dihapus.',
				failureMessage: 'Gagal menghapus nilai terpilih.'
			}),
			extras: {
				filteredGrades,
				selectedGradeId,
				selectedGrade,
				selectedGradeEnrollment,
				collectionPagination: collectionPagination.grades,
				bulkUpdateGrades,
				createGradeEnhance,
				updateGradeEnhance,
				bulkUpdateGradesEnhance,
				enrollments: approvedEnrollmentOptions,
				courses,
				studentStudyProgramId: currentUser.current?.studyProgramId ?? null,
				enrollmentsIssue: collectionIssues.enrollments,
				gradeEditorBlocked,
				onPickGrade: pickGrade,
				onGradeLetterFilterChange: () => queueCollectionRefresh('grades', 0),
				onGradeCourseFilterChange: () => queueCollectionRefresh('grades', 0)
			}
		})
	}));

	const usersViewProps = $derived.by(() =>
		buildUsersViewProps({
			...buildSearchActions({
				key: 'users',
				reset: () => {
					userSearch = '';
				},
				queueCollectionRefresh
			}),
			...buildPaginationActions({
				key: 'users',
				changeCollectionPage
			}),
			filteredUsers,
			selectedUserId,
			selectedUser,
			selectedUserIds,
			editorView,
			collectionPagination: collectionPagination.users,
			updateUserEnhance,
			bulkUpdateUserRoleEnhance,
			bulkResetPasswordEnhance,
			bulkResetPasswordsPending: bulkResetPasswords.pending > 0,
			onClearSelection: clearUserSelection,
			onOpenBulkRole: () => openBulkEditor('users', 'users-bulk-role'),
			onOpenBulkPassword: () => openBulkEditor('users', 'users-bulk-password'),
			onOpenBulkDelete: () =>
				openBulkDelete({
					kind: 'bulk-user',
					ids: [...selectedUserIds],
					label: `${selectedUserIds.size} akun`,
					successMessage: 'Akun terpilih berhasil dihapus.',
					failureMessage: 'Gagal menghapus akun terpilih.'
				}),
			onToggleAllUsers: toggleAllUsers,
			onToggleUser: (id: string) => toggleUserSelection(id),
			onPickUser: pickUser,
			handleKeyboardClick,
			onNavigateToEntity: navigateToEntity,
			onBeginEdit: () => beginEdit('users'),
			onStopEditing: () => stopEditing('users')
		})
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
						<div class="warning-actions">
							<Button
								variant="ghost"
								size="sm"
								class="ghost-button"
								onclick={handleRefreshCurrentView}
								disabled={viewRefreshLoading}
							>
								{viewRefreshLoading ? 'Memuat...' : 'Coba lagi'}
							</Button>
							<Button variant="outline" size="sm" onclick={refreshPage}>Refresh halaman</Button>
						</div>
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
					<DashboardView {...dashboardViewProps} />
				{/if}

				{#if activeView === 'calendar'}
					<CalendarView bind:state={scheduleViewState} {...calendarViewProps} />
				{/if}

				{#if activeView === 'builder' && currentUser.current.role !== 'STUDENT'}
					<BuilderView
						class="workspace-shell builder-shell"
						bind:filterState={builderScheduleState}
						bind:workflowState={builderWorkflowState}
						bind:enrollmentDraft
						{...builderViewProps}
					/>
				{/if}

				{#if activeView === 'classrooms'}
					<ClassroomsView
						bind:roomSearch
						bind:classroomDraft
						bind:bulkEditClassRoomType
						bind:bulkEditClassRoomCapacity
						bind:bulkEditClassRoomHasProjector
						bind:bulkEditClassRoomHasAC
						{...classroomsViewProps}
					/>
				{/if}

				{#if activeView === 'courses'}
					<CoursesView
						bind:courseSearch
						bind:courseDraft
						bind:bulkEditCourseCredits
						bind:bulkEditCourseStudyProgramId
						bind:bulkEditCourseLecturerId
						{...coursesViewProps}
					/>
				{/if}

				{#if activeView === 'students' && currentUser.current.role !== 'STUDENT'}
					<StudentsView
						bind:studentSearch
						bind:studentDraft
						bind:bulkEditStudentStudyProgramId
						bind:bulkEditStudentYearAdmitted
						{...studentsViewProps}
					/>
				{/if}

				{#if activeView === 'lecturers'}
					<LecturersView
						bind:lecturerSearch
						bind:lecturerDraft
						bind:bulkEditLecturerName
						bind:bulkEditLecturerEmail
						bind:bulkEditLecturerPhone
						bind:bulkEditLecturerAddress
						{...lecturersViewProps}
					/>
				{/if}

				{#if activeView === 'faculties' && currentUser.current.role !== 'STUDENT'}
					<FacultiesView
						bind:facultySearch
						bind:facultyDraft
						bind:bulkEditFacultyName
						{...facultiesViewProps}
					/>
				{/if}

				{#if activeView === 'studyPrograms' && currentUser.current.role !== 'STUDENT'}
					<StudyProgramsView
						bind:studyProgramSearch
						bind:studyProgramDraft
						bind:bulkEditStudyProgramFacultyId
						bind:bulkEditStudyProgramHead
						{...studyProgramsViewProps}
					/>
				{/if}

				{#if activeView === 'enrollments'}
					<EnrollmentsView bind:state={scheduleViewState} {...enrollmentsViewProps} />
				{/if}

				{#if activeView === 'grades'}
					<GradesView
						bind:gradeSearch
						bind:gradeDraft
						bind:bulkEditGradeAssignmentScore
						bind:bulkEditGradeMidtermScore
						bind:bulkEditGradeFinalScore
						bind:gradeLetterFilter
						bind:gradeCourseFilter
						{...gradesViewProps}
					/>
				{/if}

				{#if activeView === 'users' && currentUser.current.role === 'ADMIN'}
					<UsersView
						bind:userSearch
						bind:bulkUserRole
						bind:bulkUserPassword
						bind:userDraft
						{...usersViewProps}
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
