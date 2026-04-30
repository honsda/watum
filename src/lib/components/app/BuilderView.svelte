<script lang="ts">
	import type { ViewId } from '$lib/app/navigation';
	import type {
		SelectClassRoomsResult,
		SelectCoursesResult,
		SelectEnrollmentsResult,
		SelectLecturersResult,
		SelectStudentsResult
	} from '$lib/server/sql';
	import {
		beautifyRoomType,
		conflictToneVariables,
		DAY_LABELS,
		formatTimeRange,
		type ScheduleCard
	} from '$lib/app/academic';
	import { days } from '$lib/validations/enrollment';
	import CollectionPagination from '$lib/components/app/CollectionPagination.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Search, X } from '@lucide/svelte';

	type BuilderStep = 'participant' | 'time' | 'room' | 'review';

	type FieldAccessor = {
		as: (...args: unknown[]) => Record<string, unknown>;
	};

	type EnrollmentFormState = {
		fields: {
			id?: FieldAccessor;
			studentId: FieldAccessor;
			courseId: FieldAccessor;
			classRoomId: FieldAccessor;
			day: FieldAccessor;
			startTime: FieldAccessor;
			endTime: FieldAccessor;
			semester: FieldAccessor;
			academicYear: FieldAccessor;
			timezone: FieldAccessor;
		};
	};

	type EnhancedAction = {
		action: string;
		method: 'POST';
		[key: symbol]: (node: HTMLFormElement) => void;
	};

	type PaginationState = {
		pageNumber: number;
		history: Array<string | null>;
		limit: number;
		itemCount: number;
		hasMore: boolean;
		loading: boolean;
	};

	type PendingDelete = {
		kind: string;
		id: string;
		label: string;
		message: string;
		confirmLabel: string;
	} | null;

	type EnrollmentDraft = {
		id: string;
		studentId: string;
		courseId: string;
		classRoomId: string;
		day: string;
		startTime: string;
		endTime: string;
		semester: string;
		academicYear: string;
		timezone: string;
	};

	type ConflictGroupCard = {
		id: string;
		selected: boolean;
		label: string;
		representative: ScheduleCard;
		details: { count: number; lecturers: string; rooms: string } | null;
	};

	let {
		class: className = '',
		enrollmentSearch = $bindable(''),
		scheduleDayFilter = $bindable(''),
		scheduleCourseFilter = $bindable(''),
		scheduleRoomFilter = $bindable(''),
		scheduleLecturerFilter = $bindable(''),
		scheduleSemesterFilter = $bindable(''),
		scheduleAcademicYearFilter = $bindable(''),
		scheduleCourseFilterSearch = $bindable(''),
		scheduleRoomFilterSearch = $bindable(''),
		scheduleLecturerFilterSearch = $bindable(''),
		scheduleCourseFilterOpen = $bindable(false),
		scheduleRoomFilterOpen = $bindable(false),
		scheduleLecturerFilterOpen = $bindable(false),
		builderConflictOnly = $bindable(false),
		builderStep = $bindable<BuilderStep>('participant'),
		studentPickerSearch = $bindable(''),
		coursePickerSearch = $bindable(''),
		roomPickerSearch = $bindable(''),
		studentPickerOpen = $bindable(false),
		coursePickerOpen = $bindable(false),
		roomPickerOpen = $bindable(false),
		enrollmentDraft = $bindable<EnrollmentDraft>({
			id: '',
			studentId: '',
			courseId: '',
			classRoomId: '',
			day: 'SENIN',
			startTime: '',
			endTime: '',
			semester: 'GANJIL',
			academicYear: '',
			timezone: 'Asia/Jakarta'
		}),
		builderTaskMode,
		selectedEnrollmentId,
		pendingDelete,
		filteredBuilderEnrollments,
		scheduleCardMap,
		auditConflictCardMap,
		conflictSummaryByCardId,
		collectionPagination,
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
		studentPickerOptions,
		coursePickerOptions,
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
		createEnrollmentEnhance,
		updateEnrollmentEnhance,
		handleKeyboardClick,
		onClearSelection,
		onQueueEnrollmentRefresh,
		onQueueScheduleCourseFilterRefresh,
		onQueueScheduleRoomFilterRefresh,
		onQueueScheduleLecturerFilterRefresh,
		onLoadMoreScheduleCourseFilterOptions,
		onLoadMoreScheduleRoomFilterOptions,
		onLoadMoreScheduleLecturerFilterOptions,
		onPickEnrollment,
		onNavigateToEntity,
		onResetScheduleFilters,
		onOpenBuilderForSchedule,
		onOpenCalendarForSchedule,
		onRequestDeleteEnrollment,
		onConfirmDelete,
		onCancelDelete,
		onQueueStudentPickerRefresh,
		onQueueCoursePickerRefresh,
		onQueueRoomPickerRefresh,
		onLoadMoreStudentPickerOptions,
		onLoadMoreCoursePickerOptions,
		onLoadMoreRoomPickerOptions,
		onPagePrevious,
		onPageNext
	}: {
		class?: string;
		enrollmentSearch: string;
		scheduleDayFilter: string;
		scheduleCourseFilter: string;
		scheduleRoomFilter: string;
		scheduleLecturerFilter: string;
		scheduleSemesterFilter: string;
		scheduleAcademicYearFilter: string;
		scheduleCourseFilterSearch: string;
		scheduleRoomFilterSearch: string;
		scheduleLecturerFilterSearch: string;
		scheduleCourseFilterOpen: boolean;
		scheduleRoomFilterOpen: boolean;
		scheduleLecturerFilterOpen: boolean;
		builderConflictOnly: boolean;
		builderStep: BuilderStep;
		studentPickerSearch: string;
		coursePickerSearch: string;
		roomPickerSearch: string;
		studentPickerOpen: boolean;
		coursePickerOpen: boolean;
		roomPickerOpen: boolean;
		enrollmentDraft: EnrollmentDraft;
		builderTaskMode: boolean;
		selectedEnrollmentId: string | null;
		pendingDelete: PendingDelete;
		filteredBuilderEnrollments: SelectEnrollmentsResult[];
		scheduleCardMap: Record<string, ScheduleCard>;
		auditConflictCardMap: Record<string, ScheduleCard>;
		conflictSummaryByCardId: Record<string, string>;
		collectionPagination: PaginationState;
		scheduleSemesterOptions: string[];
		scheduleAcademicYearOptions: string[];
		scheduleActiveFilterCount: number;
		scheduleCourseFilterOptions: SelectCoursesResult[];
		scheduleRoomFilterOptions: SelectClassRoomsResult[];
		filteredScheduleRoomFilterOptions: SelectClassRoomsResult[];
		scheduleLecturerFilterOptions: SelectLecturersResult[];
		scheduleCourseFilterIssue: string | null;
		scheduleRoomFilterIssue: string | null;
		scheduleLecturerFilterIssue: string | null;
		scheduleCourseFilterLoading: boolean;
		scheduleRoomFilterLoading: boolean;
		scheduleLecturerFilterLoading: boolean;
		scheduleCourseFilterHasMore: boolean;
		scheduleRoomFilterHasMore: boolean;
		scheduleLecturerFilterHasMore: boolean;
		selectedScheduleCourseFilterLabel: string;
		selectedScheduleRoomFilterLabel: string;
		selectedScheduleLecturerFilterLabel: string;
		selectedEnrollmentScheduleCard: ScheduleCard | null;
		selectedEnrollmentConflictSummary: string | null;
		selectedEnrollmentConflictGroup: { rooms: string; lecturers: string } | null;
		selectedDraftStudent: string;
		selectedDraftCourse: string;
		selectedDraftRoom: string;
		draftTimeSummary: string;
		filteredRoomsForPicker: SelectClassRoomsResult[];
		builderConflictCards: ConflictGroupCard[];
		conflictCount: number;
		studentPickerOptions: SelectStudentsResult[];
		coursePickerOptions: SelectCoursesResult[];
		studentPickerIssue: string | null;
		coursePickerIssue: string | null;
		roomPickerIssue: string | null;
		studentPickerLoading: boolean;
		coursePickerLoading: boolean;
		roomPickerLoading: boolean;
		studentPickerHasMore: boolean;
		coursePickerHasMore: boolean;
		roomPickerHasMore: boolean;
		createEnrollment: unknown;
		updateEnrollment: unknown;
		createEnrollmentEnhance: EnhancedAction;
		updateEnrollmentEnhance: EnhancedAction;
		handleKeyboardClick: (event: KeyboardEvent) => void;
		onClearSelection: () => void;
		onQueueEnrollmentRefresh: (delay?: number) => void;
		onQueueScheduleCourseFilterRefresh: (delay?: number) => void;
		onQueueScheduleRoomFilterRefresh: (delay?: number) => void;
		onQueueScheduleLecturerFilterRefresh: (delay?: number) => void;
		onLoadMoreScheduleCourseFilterOptions: () => void;
		onLoadMoreScheduleRoomFilterOptions: () => void;
		onLoadMoreScheduleLecturerFilterOptions: () => void;
		onPickEnrollment: (item: SelectEnrollmentsResult) => void;
		onNavigateToEntity: (view: ViewId, id: string | null | undefined, name?: string) => void;
		onResetScheduleFilters: () => void;
		onOpenBuilderForSchedule: (card: ScheduleCard) => void;
		onOpenCalendarForSchedule: (card: ScheduleCard) => void;
		onRequestDeleteEnrollment: () => void;
		onConfirmDelete: () => void;
		onCancelDelete: () => void;
		onQueueStudentPickerRefresh: (delay?: number) => void;
		onQueueCoursePickerRefresh: (delay?: number) => void;
		onQueueRoomPickerRefresh: (delay?: number) => void;
		onLoadMoreStudentPickerOptions: () => void;
		onLoadMoreCoursePickerOptions: () => void;
		onLoadMoreRoomPickerOptions: () => void;
		onPagePrevious: () => void;
		onPageNext: () => void;
	} = $props();

	const builderSteps = [
		{ id: 'participant', label: 'Peserta', hint: 'Pilih mahasiswa dan mata kuliah.' },
		{ id: 'time', label: 'Waktu', hint: 'Tentukan hari dan jam kuliah.' },
		{ id: 'room', label: 'Ruang', hint: 'Pilih ruang yang tersedia.' },
		{ id: 'review', label: 'Tinjau', hint: 'Periksa sebelum disimpan.' }
	] as const;

	let scheduleCourseFilterActiveIndex = $state(-1);
	let scheduleRoomFilterActiveIndex = $state(-1);
	let scheduleLecturerFilterActiveIndex = $state(-1);
	let studentPickerActiveIndex = $state(-1);
	let coursePickerActiveIndex = $state(-1);
	let roomPickerActiveIndex = $state(-1);

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

	function createEnrollmentForm() {
		return createEnrollment as EnrollmentFormState;
	}

	function updateEnrollmentForm() {
		return updateEnrollment as EnrollmentFormState;
	}

	function clampActiveIndex(nextIndex: number, count: number) {
		if (count <= 0) return -1;
		if (nextIndex < 0) return count - 1;
		if (nextIndex >= count) return 0;
		return nextIndex;
	}

	function activeDescendantId(prefix: string, index: number) {
		return index >= 0 ? `${prefix}-option-${index}` : undefined;
	}

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

	function conflictGroupMetaCopy(
		details: { count: number; lecturers: string; rooms: string } | null
	) {
		if (!details) return null;
		return `${details.count} jadwal • Ruang: ${details.rooms} • Dosen: ${details.lecturers}`;
	}

	function selectScheduleCourseFilterOption(item: SelectCoursesResult | null) {
		scheduleCourseFilter = item?.id ?? '';
		scheduleCourseFilterSearch = item?.name ?? '';
		scheduleCourseFilterActiveIndex = -1;
		scheduleCourseFilterOpen = false;
		onQueueEnrollmentRefresh(0);
	}

	function selectScheduleRoomFilterOption(item: SelectClassRoomsResult | null) {
		scheduleRoomFilter = item?.id ?? '';
		scheduleRoomFilterSearch = item?.name ?? '';
		scheduleRoomFilterActiveIndex = -1;
		scheduleRoomFilterOpen = false;
		onQueueEnrollmentRefresh(0);
	}

	function selectScheduleLecturerFilterOption(item: SelectLecturersResult | null) {
		scheduleLecturerFilter = item?.id ?? '';
		scheduleLecturerFilterSearch = item?.name ?? '';
		scheduleLecturerFilterActiveIndex = -1;
		scheduleLecturerFilterOpen = false;
		onQueueEnrollmentRefresh(0);
	}

	function selectStudentPickerOption(item: SelectStudentsResult) {
		enrollmentDraft.studentId = item.id ?? '';
		studentPickerSearch = item.name ?? '';
		studentPickerActiveIndex = -1;
		studentPickerOpen = false;
	}

	function selectCoursePickerOption(item: SelectCoursesResult) {
		enrollmentDraft.courseId = item.id ?? '';
		coursePickerSearch = item.name ?? '';
		coursePickerActiveIndex = -1;
		coursePickerOpen = false;
	}

	function selectRoomPickerOption(item: SelectClassRoomsResult) {
		enrollmentDraft.classRoomId = item.id ?? '';
		roomPickerSearch = item.name ?? '';
		roomPickerActiveIndex = -1;
		roomPickerOpen = false;
	}

	function handleScheduleCourseFilterKeydown(event: KeyboardEvent) {
		const optionCount = scheduleCourseFilterOptions.length + 1;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			scheduleCourseFilterOpen = true;
			if (!scheduleCourseFilterOptions.length) onQueueScheduleCourseFilterRefresh(0);
			const delta = event.key === 'ArrowDown' ? 1 : -1;
			scheduleCourseFilterActiveIndex = clampActiveIndex(
				scheduleCourseFilterActiveIndex + delta,
				optionCount
			);
			return;
		}
		if (event.key === 'Enter' && scheduleCourseFilterOpen) {
			event.preventDefault();
			if (scheduleCourseFilterActiveIndex === 0) {
				selectScheduleCourseFilterOption(null);
				return;
			}
			const item = scheduleCourseFilterOptions[scheduleCourseFilterActiveIndex - 1];
			if (item) selectScheduleCourseFilterOption(item);
			return;
		}
		if (event.key === 'Escape') {
			scheduleCourseFilterOpen = false;
			scheduleCourseFilterActiveIndex = -1;
		}
	}

	function handleScheduleRoomFilterKeydown(event: KeyboardEvent) {
		const optionCount = filteredScheduleRoomFilterOptions.length + 1;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			scheduleRoomFilterOpen = true;
			if (!scheduleRoomFilterOptions.length) onQueueScheduleRoomFilterRefresh(0);
			const delta = event.key === 'ArrowDown' ? 1 : -1;
			scheduleRoomFilterActiveIndex = clampActiveIndex(
				scheduleRoomFilterActiveIndex + delta,
				optionCount
			);
			return;
		}
		if (event.key === 'Enter' && scheduleRoomFilterOpen) {
			event.preventDefault();
			if (scheduleRoomFilterActiveIndex === 0) {
				selectScheduleRoomFilterOption(null);
				return;
			}
			const item = filteredScheduleRoomFilterOptions[scheduleRoomFilterActiveIndex - 1];
			if (item) selectScheduleRoomFilterOption(item);
			return;
		}
		if (event.key === 'Escape') {
			scheduleRoomFilterOpen = false;
			scheduleRoomFilterActiveIndex = -1;
		}
	}

	function handleScheduleLecturerFilterKeydown(event: KeyboardEvent) {
		const optionCount = scheduleLecturerFilterOptions.length + 1;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			scheduleLecturerFilterOpen = true;
			if (!scheduleLecturerFilterOptions.length) onQueueScheduleLecturerFilterRefresh(0);
			const delta = event.key === 'ArrowDown' ? 1 : -1;
			scheduleLecturerFilterActiveIndex = clampActiveIndex(
				scheduleLecturerFilterActiveIndex + delta,
				optionCount
			);
			return;
		}
		if (event.key === 'Enter' && scheduleLecturerFilterOpen) {
			event.preventDefault();
			if (scheduleLecturerFilterActiveIndex === 0) {
				selectScheduleLecturerFilterOption(null);
				return;
			}
			const item = scheduleLecturerFilterOptions[scheduleLecturerFilterActiveIndex - 1];
			if (item) selectScheduleLecturerFilterOption(item);
			return;
		}
		if (event.key === 'Escape') {
			scheduleLecturerFilterOpen = false;
			scheduleLecturerFilterActiveIndex = -1;
		}
	}

	function handleStudentPickerKeydown(event: KeyboardEvent) {
		const optionCount = studentPickerOptions.length;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			studentPickerOpen = true;
			if (!studentPickerOptions.length) onQueueStudentPickerRefresh(0);
			if (optionCount > 0) {
				const delta = event.key === 'ArrowDown' ? 1 : -1;
				studentPickerActiveIndex = clampActiveIndex(studentPickerActiveIndex + delta, optionCount);
			}
			return;
		}
		if (event.key === 'Enter' && studentPickerOpen) {
			const item = studentPickerOptions[studentPickerActiveIndex];
			if (item) {
				event.preventDefault();
				selectStudentPickerOption(item);
			}
			return;
		}
		if (event.key === 'Escape') {
			studentPickerOpen = false;
			studentPickerActiveIndex = -1;
		}
	}

	function handleCoursePickerKeydown(event: KeyboardEvent) {
		const optionCount = coursePickerOptions.length;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			coursePickerOpen = true;
			if (!coursePickerOptions.length) onQueueCoursePickerRefresh(0);
			if (optionCount > 0) {
				const delta = event.key === 'ArrowDown' ? 1 : -1;
				coursePickerActiveIndex = clampActiveIndex(coursePickerActiveIndex + delta, optionCount);
			}
			return;
		}
		if (event.key === 'Enter' && coursePickerOpen) {
			const item = coursePickerOptions[coursePickerActiveIndex];
			if (item) {
				event.preventDefault();
				selectCoursePickerOption(item);
			}
			return;
		}
		if (event.key === 'Escape') {
			coursePickerOpen = false;
			coursePickerActiveIndex = -1;
		}
	}

	function handleRoomPickerKeydown(event: KeyboardEvent) {
		const optionCount = filteredRoomsForPicker.length;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			roomPickerOpen = true;
			if (!filteredRoomsForPicker.length) onQueueRoomPickerRefresh(0);
			if (optionCount > 0) {
				const delta = event.key === 'ArrowDown' ? 1 : -1;
				roomPickerActiveIndex = clampActiveIndex(roomPickerActiveIndex + delta, optionCount);
			}
			return;
		}
		if (event.key === 'Enter' && roomPickerOpen) {
			const item = filteredRoomsForPicker[roomPickerActiveIndex];
			if (item) {
				event.preventDefault();
				selectRoomPickerOption(item);
			}
			return;
		}
		if (event.key === 'Escape') {
			roomPickerOpen = false;
			roomPickerActiveIndex = -1;
		}
	}
</script>

<div class={className}>
	<section class="workspace-list builder-list">
		<div class="pane-head">
			<div>
				<h3>{builderTaskMode ? 'Jadwal terkait' : 'Jadwal aktif'}</h3>
			</div>
			<Button variant="ghost" size="sm" class="ghost-button" onclick={onClearSelection}
				>Tambah jadwal</Button
			>
		</div>

		<label class="search-box">
			<Search size={16} />
			<input
				bind:value={enrollmentSearch}
				oninput={() => onQueueEnrollmentRefresh()}
				aria-label="Cari jadwal kuliah"
				placeholder="Cari mahasiswa, mata kuliah, atau ruang"
			/>
			{#if enrollmentSearch}
				<button
					type="button"
					class="search-clear"
					onclick={() => {
						enrollmentSearch = '';
						onQueueEnrollmentRefresh(0);
					}}
				>
					<X size={14} />
				</button>
			{/if}
		</label>

		<div class="editor-grid schedule-filter-grid list-filter-grid">
			<label>
				<span>Hari</span>
				<select bind:value={scheduleDayFilter} onchange={() => onQueueEnrollmentRefresh(0)}>
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
							scheduleCourseFilterActiveIndex = -1;
						}
					}}
				>
					<input
						type="text"
						role="combobox"
						class="combobox-input"
						placeholder="Cari mata kuliah filter..."
						aria-expanded={scheduleCourseFilterOpen}
						aria-controls="schedule-course-filter-listbox"
						aria-autocomplete="list"
						aria-activedescendant={activeDescendantId(
							'schedule-course-filter',
							scheduleCourseFilterActiveIndex
						)}
						value={scheduleCourseFilter
							? selectedScheduleCourseFilterLabel
							: scheduleCourseFilterSearch}
						oninput={(e) => {
							scheduleCourseFilterSearch = (e.currentTarget as HTMLInputElement).value;
							scheduleCourseFilterActiveIndex = -1;
							if (scheduleCourseFilter) {
								scheduleCourseFilter = '';
								onQueueEnrollmentRefresh(0);
							}
							scheduleCourseFilterOpen = true;
							onQueueScheduleCourseFilterRefresh();
						}}
						onkeydown={handleScheduleCourseFilterKeydown}
						onfocus={(e) => {
							if (scheduleCourseFilter) {
								(e.currentTarget as HTMLInputElement).select();
							}
							scheduleCourseFilterActiveIndex = -1;
							scheduleCourseFilterOpen = true;
							onQueueScheduleCourseFilterRefresh(0);
						}}
					/>
					{#if scheduleCourseFilterIssue}
						<p class="combobox-error">{scheduleCourseFilterIssue}</p>
					{:else if scheduleCourseFilterOpen && scheduleCourseFilterLoading && !scheduleCourseFilterOptions.length}
						<p class="combobox-empty">Memuat mata kuliah...</p>
					{:else if scheduleCourseFilterOpen}
						<div id="schedule-course-filter-listbox" class="combobox-dropdown" role="listbox">
							<button
								id="schedule-course-filter-option-0"
								type="button"
								role="option"
								aria-selected={!scheduleCourseFilter}
								class="combobox-option"
								class:active={scheduleCourseFilterActiveIndex === 0 || !scheduleCourseFilter}
								onmousedown={(e) => {
									e.preventDefault();
									selectScheduleCourseFilterOption(null);
								}}
								onfocus={() => (scheduleCourseFilterActiveIndex = 0)}
								onmouseover={() => (scheduleCourseFilterActiveIndex = 0)}
							>
								<strong>Semua mata kuliah</strong>
								<span>Hapus filter mata kuliah</span>
							</button>
							{#each scheduleCourseFilterOptions as item, index (item.id)}
								<button
									id={`schedule-course-filter-option-${index + 1}`}
									type="button"
									role="option"
									aria-selected={scheduleCourseFilter === item.id}
									class="combobox-option"
									class:active={scheduleCourseFilterActiveIndex === index + 1 ||
										scheduleCourseFilter === item.id}
									onmousedown={(e) => {
										e.preventDefault();
										selectScheduleCourseFilterOption(item);
									}}
									onfocus={() => (scheduleCourseFilterActiveIndex = index + 1)}
									onmouseover={() => (scheduleCourseFilterActiveIndex = index + 1)}
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
									<span class="combobox-meta">{scheduleCourseFilterOptions.length} opsi dimuat</span
									>
									<button
										type="button"
										class="combobox-more"
										disabled={!scheduleCourseFilterHasMore || scheduleCourseFilterLoading}
										onmousedown={(e) => {
											e.preventDefault();
											onLoadMoreScheduleCourseFilterOptions();
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
							scheduleRoomFilterActiveIndex = -1;
						}
					}}
				>
					<input
						type="text"
						role="combobox"
						class="combobox-input"
						placeholder="Cari ruang filter..."
						aria-expanded={scheduleRoomFilterOpen}
						aria-controls="schedule-room-filter-listbox"
						aria-autocomplete="list"
						aria-activedescendant={activeDescendantId(
							'schedule-room-filter',
							scheduleRoomFilterActiveIndex
						)}
						value={scheduleRoomFilter ? selectedScheduleRoomFilterLabel : scheduleRoomFilterSearch}
						oninput={(e) => {
							scheduleRoomFilterSearch = (e.currentTarget as HTMLInputElement).value;
							scheduleRoomFilterActiveIndex = -1;
							if (scheduleRoomFilter) {
								scheduleRoomFilter = '';
								onQueueEnrollmentRefresh(0);
							}
							onQueueScheduleRoomFilterRefresh();
							scheduleRoomFilterOpen = true;
						}}
						onkeydown={handleScheduleRoomFilterKeydown}
						onfocus={(e) => {
							if (scheduleRoomFilter) {
								(e.currentTarget as HTMLInputElement).select();
							}
							scheduleRoomFilterActiveIndex = -1;
							scheduleRoomFilterOpen = true;
							if (!scheduleRoomFilterOptions.length) {
								onQueueScheduleRoomFilterRefresh(0);
							}
						}}
					/>
					{#if scheduleRoomFilterIssue}
						<p class="combobox-error">{scheduleRoomFilterIssue}</p>
					{:else if scheduleRoomFilterOpen && scheduleRoomFilterLoading && !scheduleRoomFilterOptions.length}
						<p class="combobox-empty">Memuat ruang kelas...</p>
					{:else if scheduleRoomFilterOpen}
						<div id="schedule-room-filter-listbox" class="combobox-dropdown" role="listbox">
							<button
								id="schedule-room-filter-option-0"
								type="button"
								role="option"
								aria-selected={!scheduleRoomFilter}
								class="combobox-option"
								class:active={scheduleRoomFilterActiveIndex === 0 || !scheduleRoomFilter}
								onmousedown={(e) => {
									e.preventDefault();
									selectScheduleRoomFilterOption(null);
								}}
								onfocus={() => (scheduleRoomFilterActiveIndex = 0)}
								onmouseover={() => (scheduleRoomFilterActiveIndex = 0)}
							>
								<strong>Semua ruang</strong>
								<span>Hapus filter ruang</span>
							</button>
							{#each filteredScheduleRoomFilterOptions as item, index (item.id)}
								<button
									id={`schedule-room-filter-option-${index + 1}`}
									type="button"
									role="option"
									aria-selected={scheduleRoomFilter === item.id}
									class="combobox-option"
									class:active={scheduleRoomFilterActiveIndex === index + 1 ||
										scheduleRoomFilter === item.id}
									onmousedown={(e) => {
										e.preventDefault();
										selectScheduleRoomFilterOption(item);
									}}
									onfocus={() => (scheduleRoomFilterActiveIndex = index + 1)}
									onmouseover={() => (scheduleRoomFilterActiveIndex = index + 1)}
								>
									<strong>{item.name}</strong>
									<span>{beautifyRoomType(item.class_room_type)} • kapasitas {item.capacity}</span>
								</button>
							{/each}
							{#if !filteredScheduleRoomFilterOptions.length && !scheduleRoomFilterLoading}
								<p class="combobox-empty">Ruang tidak ditemukan.</p>
							{/if}
							{#if scheduleRoomFilterHasMore || scheduleRoomFilterLoading}
								<div class="combobox-footer">
									<span class="combobox-meta">{scheduleRoomFilterOptions.length} opsi dimuat</span>
									<button
										type="button"
										class="combobox-more"
										disabled={!scheduleRoomFilterHasMore || scheduleRoomFilterLoading}
										onmousedown={(e) => {
											e.preventDefault();
											onLoadMoreScheduleRoomFilterOptions();
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
							scheduleLecturerFilterActiveIndex = -1;
						}
					}}
				>
					<input
						type="text"
						role="combobox"
						class="combobox-input"
						placeholder="Cari dosen filter..."
						aria-expanded={scheduleLecturerFilterOpen}
						aria-controls="schedule-lecturer-filter-listbox"
						aria-autocomplete="list"
						aria-activedescendant={activeDescendantId(
							'schedule-lecturer-filter',
							scheduleLecturerFilterActiveIndex
						)}
						value={scheduleLecturerFilter
							? selectedScheduleLecturerFilterLabel
							: scheduleLecturerFilterSearch}
						oninput={(e) => {
							scheduleLecturerFilterSearch = (e.currentTarget as HTMLInputElement).value;
							scheduleLecturerFilterActiveIndex = -1;
							if (scheduleLecturerFilter) {
								scheduleLecturerFilter = '';
								onQueueEnrollmentRefresh(0);
							}
							scheduleLecturerFilterOpen = true;
							onQueueScheduleLecturerFilterRefresh();
						}}
						onkeydown={handleScheduleLecturerFilterKeydown}
						onfocus={(e) => {
							if (scheduleLecturerFilter) {
								(e.currentTarget as HTMLInputElement).select();
							}
							scheduleLecturerFilterActiveIndex = -1;
							scheduleLecturerFilterOpen = true;
							onQueueScheduleLecturerFilterRefresh(0);
						}}
					/>
					{#if scheduleLecturerFilterIssue}
						<p class="combobox-error">{scheduleLecturerFilterIssue}</p>
					{:else if scheduleLecturerFilterOpen && scheduleLecturerFilterLoading && !scheduleLecturerFilterOptions.length}
						<p class="combobox-empty">Memuat dosen...</p>
					{:else if scheduleLecturerFilterOpen}
						<div id="schedule-lecturer-filter-listbox" class="combobox-dropdown" role="listbox">
							<button
								id="schedule-lecturer-filter-option-0"
								type="button"
								role="option"
								aria-selected={!scheduleLecturerFilter}
								class="combobox-option"
								class:active={scheduleLecturerFilterActiveIndex === 0 || !scheduleLecturerFilter}
								onmousedown={(e) => {
									e.preventDefault();
									selectScheduleLecturerFilterOption(null);
								}}
								onfocus={() => (scheduleLecturerFilterActiveIndex = 0)}
								onmouseover={() => (scheduleLecturerFilterActiveIndex = 0)}
							>
								<strong>Semua dosen</strong>
								<span>Hapus filter dosen</span>
							</button>
							{#each scheduleLecturerFilterOptions as item, index (item.id)}
								<button
									id={`schedule-lecturer-filter-option-${index + 1}`}
									type="button"
									role="option"
									aria-selected={scheduleLecturerFilter === item.id}
									class="combobox-option"
									class:active={scheduleLecturerFilterActiveIndex === index + 1 ||
										scheduleLecturerFilter === item.id}
									onmousedown={(e) => {
										e.preventDefault();
										selectScheduleLecturerFilterOption(item);
									}}
									onfocus={() => (scheduleLecturerFilterActiveIndex = index + 1)}
									onmouseover={() => (scheduleLecturerFilterActiveIndex = index + 1)}
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
									<span class="combobox-meta"
										>{scheduleLecturerFilterOptions.length} opsi dimuat</span
									>
									<button
										type="button"
										class="combobox-more"
										disabled={!scheduleLecturerFilterHasMore || scheduleLecturerFilterLoading}
										onmousedown={(e) => {
											e.preventDefault();
											onLoadMoreScheduleLecturerFilterOptions();
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
				<select bind:value={scheduleSemesterFilter} onchange={() => onQueueEnrollmentRefresh(0)}>
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
					onchange={() => onQueueEnrollmentRefresh(0)}
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
					onclick={onResetScheduleFilters}
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
				<div
					role="button"
					tabindex="0"
					onkeydown={handleKeyboardClick}
					class:selected={selectedEnrollmentId === item.id}
					class:conflict={Boolean(scheduleCard?.hasConflict)}
					class="list-row"
					style={conflictToneVariables(scheduleCard?.conflictTone ?? null)}
					onclick={() => onPickEnrollment(item)}
				>
					<div>
						<span
							role="button"
							tabindex="0"
							class="entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity('courses', item.course_id, item.course_name);
							}}><strong>{item.course_name}</strong></span
						>
						<span
							><span
								role="button"
								tabindex="0"
								class="entity-link"
								onkeydown={handleKeyboardClick}
								onclick={(e) => {
									e.stopPropagation();
									onNavigateToEntity('students', item.student_id, item.student_name);
								}}>{item.student_name}</span
							>
							•
							<span
								role="button"
								tabindex="0"
								class="entity-link"
								onkeydown={handleKeyboardClick}
								onclick={(e) => {
									e.stopPropagation();
									onNavigateToEntity('classrooms', item.class_room_id, item.class_room_name);
								}}>{item.class_room_name}</span
							></span
						>
						{#if item.id && scheduleCard?.hasConflict && conflictSummaryByCardId[item.id]}
							<small class="list-conflict-copy"
								>Bentrok dengan {conflictSummaryByCardId[item.id]}</small
							>
						{/if}
					</div>
					<small
						>{item.schedule_day ? DAY_LABELS[item.schedule_day as keyof typeof DAY_LABELS] : '-'} • {formatTimeRange(
							item.schedule_start_time,
							item.schedule_end_time,
							enrollmentDraft.timezone
						)}</small
					>
				</div>
			{/each}
		</div>
		<CollectionPagination
			label="jadwal"
			pageNumber={collectionPagination.pageNumber}
			canPrevious={collectionPagination.history.length > 0}
			limit={collectionPagination.limit}
			itemCount={collectionPagination.itemCount}
			hasMore={collectionPagination.hasMore}
			loading={collectionPagination.loading}
			onPrevious={onPagePrevious}
			onNext={onPageNext}
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
					onclick={onRequestDeleteEnrollment}>Hapus</Button
				>
			{/if}
		</div>

		{#if pendingDelete?.kind === 'enrollment' && pendingDelete.id === selectedEnrollmentId}
			<section class="warning-panel">
				<p class="warning-title">Hapus {pendingDelete.label}?</p>
				<p>{pendingDelete.message}</p>
				<div class="warning-actions">
					<Button class="danger-button" variant="destructive" size="sm" onclick={onConfirmDelete}
						>{pendingDelete.confirmLabel}</Button
					>
					<Button class="ghost-button" variant="ghost" size="sm" onclick={onCancelDelete}
						>Batal</Button
					>
				</div>
			</section>
		{/if}

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
					? updateEnrollmentForm().fields.timezone.as('text')
					: createEnrollmentForm().fields.timezone.as('text')}
				value={enrollmentDraft.timezone}
			/>

			{#if selectedEnrollmentId}
				<input
					type="hidden"
					{...updateEnrollmentForm().fields.id?.as('text')}
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
					<p>{filteredRoomsForPicker.length} ruang tersedia untuk slot ini</p>
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
							<p class="detail-hint">Buka daftar hanya saat perlu meninjau grup bentrok.</p>
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
										onclick={() => onOpenBuilderForSchedule(group.representative)}
									>
										Buka di penjadwalan
									</Button>
									<Button
										class="ghost-button"
										variant="ghost"
										size="sm"
										onclick={() => onOpenCalendarForSchedule(group.representative)}
									>
										Buka di kalender
									</Button>
								</div>
							</article>
						{/each}
					</div>
				</details>
			{/if}

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
								? updateEnrollmentForm().fields.studentId.as('text')
								: createEnrollmentForm().fields.studentId.as('text')}
							value={enrollmentDraft.studentId}
						/>
						<div
							class="combobox-wrap"
							onfocusout={(e) => {
								if (!e.currentTarget.contains(e.relatedTarget as Node)) {
									studentPickerOpen = false;
									studentPickerActiveIndex = -1;
								}
							}}
						>
							<input
								type="text"
								role="combobox"
								class="combobox-input"
								placeholder="Cari mahasiswa..."
								aria-expanded={studentPickerOpen}
								aria-controls="student-picker-listbox"
								aria-autocomplete="list"
								aria-activedescendant={activeDescendantId(
									'student-picker',
									studentPickerActiveIndex
								)}
								value={enrollmentDraft.studentId ? selectedDraftStudent : studentPickerSearch}
								oninput={(e) => {
									studentPickerSearch = (e.currentTarget as HTMLInputElement).value;
									studentPickerActiveIndex = -1;
									if (enrollmentDraft.studentId) enrollmentDraft.studentId = '';
									studentPickerOpen = true;
									onQueueStudentPickerRefresh();
								}}
								onkeydown={handleStudentPickerKeydown}
								onfocus={() => {
									studentPickerActiveIndex = -1;
									studentPickerOpen = true;
									onQueueStudentPickerRefresh(0);
								}}
							/>
							{#if studentPickerIssue}
								<p class="combobox-error">{studentPickerIssue}</p>
							{:else if studentPickerOpen && studentPickerLoading && !studentPickerOptions.length}
								<p class="combobox-empty">Memuat mahasiswa...</p>
							{:else if studentPickerOpen && studentPickerOptions.length}
								<div id="student-picker-listbox" class="combobox-dropdown" role="listbox">
									{#each studentPickerOptions as item, index (item.id)}
										<button
											id={`student-picker-option-${index}`}
											type="button"
											role="option"
											aria-selected={enrollmentDraft.studentId === item.id}
											class="combobox-option"
											class:active={studentPickerActiveIndex === index ||
												enrollmentDraft.studentId === item.id}
											onmousedown={(e) => {
												e.preventDefault();
												selectStudentPickerOption(item);
											}}
											onfocus={() => (studentPickerActiveIndex = index)}
											onmouseover={() => (studentPickerActiveIndex = index)}
										>
											<strong>{item.name}</strong>
											<span>{item.id}</span>
										</button>
									{/each}
									{#if studentPickerHasMore || studentPickerLoading}
										<div class="combobox-footer">
											<span class="combobox-meta"
												>{studentPickerOptions.length} mahasiswa dimuat</span
											>
											<button
												type="button"
												class="combobox-more"
												disabled={!studentPickerHasMore || studentPickerLoading}
												onmousedown={(e) => {
													e.preventDefault();
													onLoadMoreStudentPickerOptions();
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
								? updateEnrollmentForm().fields.courseId.as('text')
								: createEnrollmentForm().fields.courseId.as('text')}
							value={enrollmentDraft.courseId}
						/>
						<div
							class="combobox-wrap"
							onfocusout={(e) => {
								if (!e.currentTarget.contains(e.relatedTarget as Node)) {
									coursePickerOpen = false;
									coursePickerActiveIndex = -1;
								}
							}}
						>
							<input
								type="text"
								role="combobox"
								class="combobox-input"
								placeholder="Cari mata kuliah..."
								aria-expanded={coursePickerOpen}
								aria-controls="course-picker-listbox"
								aria-autocomplete="list"
								aria-activedescendant={activeDescendantId('course-picker', coursePickerActiveIndex)}
								value={enrollmentDraft.courseId ? selectedDraftCourse : coursePickerSearch}
								oninput={(e) => {
									coursePickerSearch = (e.currentTarget as HTMLInputElement).value;
									coursePickerActiveIndex = -1;
									if (enrollmentDraft.courseId) enrollmentDraft.courseId = '';
									coursePickerOpen = true;
									onQueueCoursePickerRefresh();
								}}
								onkeydown={handleCoursePickerKeydown}
								onfocus={() => {
									coursePickerActiveIndex = -1;
									coursePickerOpen = true;
									onQueueCoursePickerRefresh(0);
								}}
							/>
							{#if coursePickerIssue}
								<p class="combobox-error">{coursePickerIssue}</p>
							{:else if coursePickerOpen && coursePickerLoading && !coursePickerOptions.length}
								<p class="combobox-empty">Memuat mata kuliah...</p>
							{:else if coursePickerOpen && coursePickerOptions.length}
								<div id="course-picker-listbox" class="combobox-dropdown" role="listbox">
									{#each coursePickerOptions as item, index (item.id)}
										<button
											id={`course-picker-option-${index}`}
											type="button"
											role="option"
											aria-selected={enrollmentDraft.courseId === item.id}
											class="combobox-option"
											class:active={coursePickerActiveIndex === index ||
												enrollmentDraft.courseId === item.id}
											onmousedown={(e) => {
												e.preventDefault();
												selectCoursePickerOption(item);
											}}
											onfocus={() => (coursePickerActiveIndex = index)}
											onmouseover={() => (coursePickerActiveIndex = index)}
										>
											<strong>{item.name}</strong>
											<span>{item.id} • {item.lecturer_name}</span>
										</button>
									{/each}
									{#if coursePickerHasMore || coursePickerLoading}
										<div class="combobox-footer">
											<span class="combobox-meta"
												>{coursePickerOptions.length} mata kuliah dimuat</span
											>
											<button
												type="button"
												class="combobox-more"
												disabled={!coursePickerHasMore || coursePickerLoading}
												onmousedown={(e) => {
													e.preventDefault();
													onLoadMoreCoursePickerOptions();
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
								? updateEnrollmentForm().fields.day.as('select')
								: createEnrollmentForm().fields.day.as('select')}
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
								? updateEnrollmentForm().fields.startTime.as('text')
								: createEnrollmentForm().fields.startTime.as('text')}
							bind:value={enrollmentDraft.startTime}
						/>
					</label>

					<label>
						<span>Selesai</span>
						<input
							type="datetime-local"
							{...selectedEnrollmentId
								? updateEnrollmentForm().fields.endTime.as('text')
								: createEnrollmentForm().fields.endTime.as('text')}
							bind:value={enrollmentDraft.endTime}
						/>
					</label>

					<label>
						<span>Semester</span>
						<select
							{...selectedEnrollmentId
								? updateEnrollmentForm().fields.semester.as('select')
								: createEnrollmentForm().fields.semester.as('select')}
							bind:value={enrollmentDraft.semester}
						>
							<option value="GANJIL">GANJIL</option>
							<option value="GENAP">GENAP</option>
						</select>
					</label>

					<label>
						<span>Tahun akademik</span>
						<input
							{...selectedEnrollmentId
								? updateEnrollmentForm().fields.academicYear.as('text')
								: createEnrollmentForm().fields.academicYear.as('text')}
							bind:value={enrollmentDraft.academicYear}
						/>
					</label>
				</div>
				<div class="builder-section-actions split">
					<p class="editor-note">
						Jika jam berubah, periksa lagi pilihan ruang di langkah berikutnya.
					</p>
					<div class="builder-inline-actions">
						<Button type="button" variant="ghost" class="ghost-button" onclick={retreatBuilderStep}
							>Kembali</Button
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
							<input
								type="hidden"
								{...selectedEnrollmentId
									? updateEnrollmentForm().fields.classRoomId.as('text')
									: createEnrollmentForm().fields.classRoomId.as('text')}
								value={enrollmentDraft.classRoomId}
							/>
							<div
								class="combobox-wrap"
								onfocusout={(e) => {
									if (!e.currentTarget.contains(e.relatedTarget as Node)) {
										roomPickerOpen = false;
										roomPickerActiveIndex = -1;
									}
								}}
							>
								<input
									type="text"
									role="combobox"
									class="combobox-input"
									placeholder="Cari ruang tersedia..."
									aria-expanded={roomPickerOpen}
									aria-controls="room-picker-listbox"
									aria-autocomplete="list"
									aria-activedescendant={activeDescendantId('room-picker', roomPickerActiveIndex)}
									value={enrollmentDraft.classRoomId ? selectedDraftRoom : roomPickerSearch}
									oninput={(e) => {
										roomPickerSearch = (e.currentTarget as HTMLInputElement).value;
										roomPickerActiveIndex = -1;
										if (enrollmentDraft.classRoomId) enrollmentDraft.classRoomId = '';
										onQueueRoomPickerRefresh();
										roomPickerOpen = true;
									}}
									onkeydown={handleRoomPickerKeydown}
									onfocus={() => {
										roomPickerActiveIndex = -1;
										roomPickerOpen = true;
										if (!filteredRoomsForPicker.length) {
											onQueueRoomPickerRefresh(0);
										}
									}}
								/>
								{#if roomPickerIssue}
									<p class="combobox-error">{roomPickerIssue}</p>
								{:else if roomPickerOpen && roomPickerLoading && !filteredRoomsForPicker.length}
									<p class="combobox-empty">Memuat ruang kelas...</p>
								{:else if roomPickerOpen}
									<div id="room-picker-listbox" class="combobox-dropdown" role="listbox">
										{#each filteredRoomsForPicker as room, index (room.id)}
											<button
												id={`room-picker-option-${index}`}
												type="button"
												role="option"
												aria-selected={enrollmentDraft.classRoomId === room.id}
												class="combobox-option"
												class:active={roomPickerActiveIndex === index ||
													enrollmentDraft.classRoomId === room.id}
												onmousedown={(e) => {
													e.preventDefault();
													selectRoomPickerOption(room);
												}}
												onfocus={() => (roomPickerActiveIndex = index)}
												onmouseover={() => (roomPickerActiveIndex = index)}
											>
												<strong>{room.name}</strong>
												<span
													>{beautifyRoomType(room.class_room_type)} • kapasitas {room.capacity}</span
												>
											</button>
										{/each}
										{#if !filteredRoomsForPicker.length && !roomPickerLoading}
											<p class="combobox-empty">Ruang tidak ditemukan untuk slot ini.</p>
										{/if}
										{#if roomPickerHasMore || roomPickerLoading}
											<div class="combobox-footer">
												<span class="combobox-meta"
													>{filteredRoomsForPicker.length} ruang dimuat</span
												>
												<button
													type="button"
													class="combobox-more"
													disabled={!roomPickerHasMore || roomPickerLoading}
													onmousedown={(e) => {
														e.preventDefault();
														onLoadMoreRoomPickerOptions();
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
										<span>{beautifyRoomType(room.class_room_type)} • kapasitas {room.capacity}</span
										>
									</div>
								{/each}
								{#if roomPickerHasMore || roomPickerLoading}
									<div class="combobox-footer support-footer">
										<button
											type="button"
											class="combobox-more"
											disabled={!roomPickerHasMore || roomPickerLoading}
											onclick={onLoadMoreRoomPickerOptions}
										>
											{roomPickerLoading ? 'Memuat...' : 'Muat lebih banyak'}
										</button>
									</div>
								{/if}
							{:else}
								<p class="empty-copy">
									Belum ada ruang yang tersedia untuk slot ini. Ubah jadwal atau pilih slot lain.
								</p>
								{#if roomPickerHasMore || roomPickerLoading}
									<div class="combobox-footer support-footer">
										<button
											type="button"
											class="combobox-more"
											disabled={!roomPickerHasMore || roomPickerLoading}
											onclick={onLoadMoreRoomPickerOptions}
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
						<Button type="button" variant="ghost" class="ghost-button" onclick={retreatBuilderStep}
							>Kembali</Button
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

			<section class:hidden-stage={builderStep !== 'review'} class="builder-section builder-review">
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
						Jika masih ragu, kembali satu langkah lalu perbaiki waktu atau ruang sebelum simpan.
					</p>
					<div class="builder-inline-actions">
						<Button type="button" variant="ghost" class="ghost-button" onclick={retreatBuilderStep}
							>Kembali</Button
						>
						<Button type="submit" class="primary-button builder-submit"
							>{selectedEnrollmentId ? 'Simpan perubahan' : 'Simpan jadwal'}</Button
						>
					</div>
				</div>
			</section>
		</form>
	</section>
</div>

<style>
	.workspace-shell {
		display: grid;
		grid-template-columns: minmax(18rem, 0.78fr) minmax(0, 1.22fr);
		align-items: stretch;
		gap: 1rem;
		min-width: 0;
	}

	.builder-shell {
		grid-template-columns: minmax(18rem, 0.72fr) minmax(0, 1.28fr);
		height: clamp(32rem, calc(100dvh - 9.5rem), 56rem);
		min-height: 0;
		align-items: stretch;
		overflow: hidden;
	}

	.workspace-list,
	.workspace-detail,
	.list-stack,
	.builder-snapshot,
	.builder-progress,
	.builder-form,
	.builder-section,
	.builder-section-head,
	.builder-section-actions,
	.builder-room-stage,
	.search-box,
	.pane-head,
	.editor-grid,
	.detail-lines,
	.support-list {
		display: grid;
		gap: 0.8rem;
	}

	.workspace-list,
	.workspace-detail {
		align-content: start;
		min-height: 0;
		min-width: 0;
	}

	.workspace-list {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.workspace-detail {
		overflow: auto;
	}

	.builder-list {
		flex: 1 1 auto;
		height: 100%;
		min-height: 0;
	}

	.builder-list .list-stack {
		flex: 1 1 auto;
		height: 100%;
		min-width: 0;
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

	.workspace-detail h3,
	.workspace-list h3,
	.support-panel h4 {
		margin: 0;
	}

	.workspace-detail h3,
	.workspace-list h3 {
		font: 600 1.3rem/1.06 var(--font-display);
		letter-spacing: -0.03em;
	}

	.pane-head {
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: start;
	}

	.pane-head > :first-child {
		min-width: 0;
	}

	.pane-head.compact {
		margin-bottom: 0.6rem;
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

	.search-box:focus-within {
		border-color: color-mix(in oklch, var(--color-accent-strong) 46%, var(--color-border) 54%);
		box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--color-accent-strong) 18%, transparent 82%);
	}

	.search-box input,
	.editor-grid input,
	.editor-grid select {
		width: 100%;
		padding: 0.72rem 0.85rem;
		border: 1px solid var(--color-border);
		border-radius: 0.8rem;
		background: var(--color-surface);
		color: inherit;
	}

	.search-box input {
		min-width: 0;
		padding: 0;
		border: 0;
		background: transparent;
	}

	.search-box input:focus,
	.editor-grid input:focus,
	.editor-grid select:focus,
	.combobox-input:focus {
		outline: 2px solid color-mix(in oklch, var(--color-accent-strong) 32%, transparent 68%);
		outline-offset: 1px;
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

	.editor-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.schedule-filter-grid.list-filter-grid {
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
	}

	.editor-grid label {
		display: grid;
		gap: 0.35rem;
	}

	.editor-grid label span,
	.support-list span,
	.detail-lines span,
	.builder-snapshot span {
		color: var(--color-muted-foreground);
	}

	.filter-toggle-row {
		display: flex;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 0.7rem;
		padding: 0.78rem 0.85rem;
		border: 1px solid var(--color-border);
		border-radius: 0.8rem;
		background: var(--color-surface);
	}

	.filter-toggle-row input {
		margin: 0;
	}

	.filter-toggle-row span {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.list-summary {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.schedule-filter-actions,
	.builder-inline-actions,
	.builder-conflict-card-actions,
	.warning-actions {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		flex-wrap: wrap;
		min-width: 0;
	}

	.builder-inline-actions,
	.builder-conflict-card-actions {
		justify-content: flex-end;
	}

	.schedule-filter-actions :global([data-slot='button']),
	.builder-inline-actions :global([data-slot='button']),
	.builder-conflict-card-actions :global([data-slot='button']),
	.warning-actions :global([data-slot='button']) {
		min-width: 0;
		max-width: 100%;
		flex-shrink: 1;
		white-space: normal;
		height: auto;
	}

	.schedule-filter-actions :global([data-slot='badge']),
	.builder-conflict-summary :global([data-slot='badge']) {
		min-width: 0;
		max-width: 100%;
		flex-shrink: 1;
		white-space: normal;
		height: auto;
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
		border-color: color-mix(in oklch, var(--color-accent-strong) 24%, var(--color-border) 76%);
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

	.list-row > div {
		display: grid;
		gap: 0.22rem;
		min-width: 0;
	}

	.list-row > small {
		justify-self: end;
		text-align: right;
	}

	.list-row strong,
	.detail-lines strong,
	.support-list strong,
	.builder-snapshot strong {
		font-size: 0.96rem;
		line-height: 1.24;
	}

	.list-row strong,
	.list-row span,
	.list-row small {
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.list-row.conflict strong,
	.list-row.conflict .list-conflict-copy,
	.builder-conflict-copy {
		color: var(--conflict-ink, var(--color-danger));
	}

	.list-conflict-copy,
	.editor-note,
	.builder-note,
	.empty-copy,
	.warning-panel p:not(.warning-title),
	.builder-snapshot p {
		margin: 0;
		font-size: 0.91rem;
		line-height: 1.42;
		color: var(--color-muted-foreground);
	}

	.entity-link {
		cursor: pointer;
		text-decoration: none;
	}

	.entity-link:hover {
		text-decoration: underline;
	}

	.warning-panel {
		display: grid;
		gap: 0.85rem;
		padding: 0.95rem 1rem;
		border: 1px solid color-mix(in oklch, var(--color-danger) 26%, var(--color-border) 74%);
		border-radius: 0.9rem;
		background: color-mix(in oklch, var(--color-panel) 84%, var(--color-danger-soft) 16%);
	}

	.warning-panel p {
		margin: 0;
	}

	.warning-title {
		font: 600 1.04rem/1.08 var(--font-display);
		letter-spacing: -0.02em;
		color: var(--color-foreground);
	}

	.builder-progress {
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
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
	}

	.builder-progress-item.complete {
		border-color: color-mix(in oklch, var(--color-success) 26%, var(--color-border) 74%);
		background: color-mix(in oklch, var(--color-surface) 90%, var(--color-success-soft) 10%);
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
	}

	.builder-progress-copy span {
		font-size: 0.82rem;
		line-height: 1.36;
		color: var(--color-muted-foreground);
	}

	.builder-snapshot {
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
		gap: 0.75rem;
	}

	.detail-lines {
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
	}

	.builder-snapshot div,
	.detail-lines div,
	.support-list div {
		display: grid;
		gap: 0.22rem;
		padding: 0.85rem 0.9rem;
		border: 1px solid var(--color-border);
		border-radius: 0.8rem;
		background: var(--color-surface);
		min-width: 0;
	}

	.detail-lines strong,
	.detail-lines span,
	.support-list strong,
	.support-list span,
	.builder-snapshot strong,
	.builder-snapshot span,
	.builder-snapshot p {
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.builder-section {
		padding: 1rem;
		border: 1px solid var(--color-border);
		background: var(--color-panel);
		border-radius: var(--radius-xl);
	}

	.builder-section.hidden-stage {
		display: none;
	}

	.builder-section-head {
		gap: 0.25rem;
	}

	.builder-section-head h4 {
		margin: 0;
		font: 600 1.12rem/1.08 var(--font-display);
		letter-spacing: -0.025em;
	}

	.builder-section-actions.split {
		grid-template-columns: minmax(0, 1fr) minmax(0, auto);
		align-items: center;
	}

	.builder-room-stage {
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
		gap: 0.85rem;
		align-items: start;
	}

	.builder-room-grid {
		grid-template-columns: 1fr;
	}

	.support-panel {
		padding: 0.95rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-panel);
	}

	.support-panel h4 {
		margin-bottom: 0.8rem;
	}

	.builder-support .support-list {
		max-height: clamp(11rem, 30dvh, 18rem);
		overflow: auto;
		padding-right: 0.1rem;
		scrollbar-gutter: stable;
		overscroll-behavior: contain;
	}

	.builder-review-note {
		display: grid;
		gap: 0.7rem;
	}

	.builder-submit {
		min-width: min(100%, 13rem);
	}

	.builder-conflict-panel {
		display: grid;
		gap: 0.75rem;
		padding: 0.75rem 0.85rem;
	}

	.builder-conflict-summary {
		display: flex;
		align-items: flex-start;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 1rem;
		cursor: pointer;
		list-style: none;
	}

	.builder-conflict-summary > :first-child {
		min-width: 0;
	}

	.builder-conflict-summary::-webkit-details-marker {
		display: none;
	}

	.builder-conflict-summary::after {
		content: 'Tampilkan';
		font-size: 0.78rem;
		font-weight: 700;
		color: var(--color-accent-strong);
		margin-left: auto;
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
		grid-template-columns: minmax(0, 1fr) minmax(0, auto);
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
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.builder-conflict-card-actions {
		min-width: 0;
	}

	.combobox-wrap {
		position: relative;
	}

	.combobox-input {
		width: 100%;
	}

	.combobox-dropdown {
		position: absolute;
		z-index: 20;
		top: calc(100% + 0.45rem);
		left: 0;
		right: 0;
		width: auto;
		min-width: 100%;
		max-width: none;
		max-height: 20rem;
		overflow: auto;
		padding: 0.35rem;
		border: 1px solid var(--color-border);
		border-radius: 0.9rem;
		background: var(--color-panel);
		box-shadow: 0 18px 40px color-mix(in oklch, var(--color-shadow) 12%, transparent 88%);
	}

	.combobox-option {
		display: grid;
		gap: 0.18rem;
		width: 100%;
		min-width: 0;
		padding: 0.75rem 0.8rem;
		border: 0;
		border-radius: 0.7rem;
		background: transparent;
		text-align: left;
		color: inherit;
	}

	.combobox-option.active,
	.combobox-option:hover {
		background: color-mix(in oklch, var(--color-accent-soft) 18%, var(--color-surface) 82%);
	}

	.combobox-option strong {
		font-size: 0.9rem;
	}

	.combobox-option strong,
	.combobox-option span {
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.combobox-option span,
	.combobox-meta,
	.combobox-empty,
	.combobox-error {
		font-size: 0.82rem;
		line-height: 1.4;
	}

	.combobox-empty,
	.combobox-error {
		margin: 0;
		padding: 0.55rem 0.2rem 0;
	}

	.combobox-error {
		color: var(--color-danger);
	}

	.combobox-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: 0.75rem;
		padding: 0.55rem 0.45rem 0.15rem;
	}

	.combobox-footer > * {
		min-width: 0;
	}

	.combobox-more {
		padding: 0.45rem 0.7rem;
		border: 1px solid var(--color-border);
		border-radius: 0.7rem;
		background: var(--color-surface);
		font: inherit;
	}

	.combobox-more:disabled {
		opacity: 0.6;
	}

	@media (max-width: 1280px) {
		.workspace-shell,
		.builder-shell,
		.builder-room-stage,
		.builder-section-actions.split {
			grid-template-columns: 1fr;
		}

		.builder-shell {
			height: auto;
			overflow: visible;
		}

		.builder-inline-actions {
			justify-content: stretch;
		}

		.builder-inline-actions :global(button) {
			flex: 1 1 12rem;
		}

		.builder-conflict-card {
			grid-template-columns: 1fr;
		}

		.builder-conflict-card-actions {
			justify-content: flex-start;
		}
	}

	@media (max-width: 900px) {
		.list-summary,
		.schedule-filter-actions {
			align-items: stretch;
		}

		.schedule-filter-grid.list-filter-grid,
		.editor-grid,
		.detail-lines {
			grid-template-columns: minmax(0, 1fr);
		}

		.combobox-dropdown {
			left: 0;
			right: 0;
			width: auto;
			min-width: 0;
			max-width: none;
		}

		.builder-conflict-summary::after {
			content: none;
		}

		.builder-conflict-card-actions :global([data-slot='button']),
		.builder-inline-actions :global([data-slot='button']),
		.schedule-filter-actions :global([data-slot='button']) {
			width: 100%;
		}

		.list-row {
			grid-template-columns: 1fr;
		}

		.list-row > small {
			justify-self: start;
			text-align: left;
		}
	}
</style>
