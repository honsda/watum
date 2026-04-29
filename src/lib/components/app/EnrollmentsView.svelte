<script lang="ts">
	import type { AppRole } from '$lib/app/academic';
	import type { ViewId } from '$lib/app/navigation';
	import type { SelectEnrollmentsResult, SelectCoursesResult, SelectClassRoomsResult, SelectLecturersResult } from '$lib/server/sql';
	import {
		beautifyRoomType,
		conflictToneVariables,
		DAY_LABELS,
		formatTimeRange,
		type ScheduleCard
	} from '$lib/app/academic';
	import { days as dayOptions } from '$lib/validations/enrollment';
	import CollectionPagination from '$lib/components/app/CollectionPagination.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Search, X } from '@lucide/svelte';
	import './crud-view.css';

	type EnhancedAction = {
		action: string;
		method: 'POST';
		[key: symbol]: (node: HTMLFormElement) => void;
	};

	type PendingDelete = {
		kind: string;
		id: string;
		label: string;
		message: string;
		confirmLabel: string;
	} | null;

	type PaginationState = {
		pageNumber: number;
		history: Array<string | null>;
		limit: number;
		itemCount: number;
		hasMore: boolean;
		loading: boolean;
	};

	type ScheduleCardMap = Record<string, ScheduleCard>;
	type ConflictSummaryMap = Record<string, string>;

	let {
		currentRole,
		enrollmentSearch = $bindable(''),
		filteredEnrollments,
		selectedEnrollmentId,
		selectedEnrollment,
		selectedEnrollmentConflictSummary,
		selectedEnrollmentConflictGroup,
		scheduleCardMap,
		conflictSummaryByCardId,
		scheduleDayFilter = $bindable(''),
		scheduleCourseFilter = $bindable(''),
		scheduleRoomFilter = $bindable(''),
		scheduleLecturerFilter = $bindable(''),
		scheduleSemesterFilter = $bindable(''),
		scheduleAcademicYearFilter = $bindable(''),
		courses,
		lecturers,
		scheduleSemesterOptions,
		scheduleAcademicYearOptions,
		scheduleActiveFilterCount,
		bulkSelectedIds,
		bulkCount,
		editorView,
		pendingDelete,
		collectionPagination,
		bulkUpdateEnrollmentsEnhance,
		days,
		timezone,
		handleKeyboardClick,
		onNavigateToEntity,
		onOpenBuilderForEnrollment,
		onSearchInput,
		onClearSearch,
		onResetScheduleFilters,
		onBulkClear,
		onOpenBulkEdit,
		onOpenBulkDelete,
		onBulkToggleAll,
		onBulkToggleId,
		onPickEnrollment,
		onPagePrevious,
		onPageNext,
		onDayChange,
		onCourseFilterChange,
		onSemesterFilterChange,
		onAcademicYearFilterChange
	}: {
		currentRole: AppRole;
		enrollmentSearch: string;
		filteredEnrollments: SelectEnrollmentsResult[];
		selectedEnrollmentId: string | null;
		selectedEnrollment: SelectEnrollmentsResult | null;
		selectedEnrollmentConflictSummary: string | null;
		selectedEnrollmentConflictGroup: { rooms: string; lecturers: string } | null;
		scheduleCardMap: ScheduleCardMap;
		conflictSummaryByCardId: ConflictSummaryMap;
		scheduleDayFilter: string;
		scheduleCourseFilter: string;
		scheduleRoomFilter: string;
		scheduleLecturerFilter: string;
		scheduleSemesterFilter: string;
		scheduleAcademicYearFilter: string;
		courses: SelectCoursesResult[];
		lecturers: SelectLecturersResult[];
		scheduleSemesterOptions: string[];
		scheduleAcademicYearOptions: string[];
		scheduleActiveFilterCount: number;
		bulkSelectedIds: Set<string>;
		bulkCount: number;
		editorView: string | null;
		pendingDelete: PendingDelete;
		collectionPagination: PaginationState;
		bulkUpdateEnrollmentsEnhance: EnhancedAction;
		days: typeof dayOptions;
		timezone: string;
		handleKeyboardClick: (event: KeyboardEvent) => void;
		onNavigateToEntity: (view: ViewId, id: string | null | undefined, name?: string) => void;
		onOpenBuilderForEnrollment: (item: SelectEnrollmentsResult) => void;
		onSearchInput: () => void;
		onClearSearch: () => void;
		onResetScheduleFilters: () => void;
		onBulkClear: () => void;
		onOpenBulkEdit: () => void;
		onOpenBulkDelete: () => void;
		onBulkToggleAll: (ids: string[]) => void;
		onBulkToggleId: (id: string) => void;
		onPickEnrollment: (item: SelectEnrollmentsResult) => void;
		onPagePrevious: () => void;
		onPageNext: () => void;
		onDayChange: () => void;
		onCourseFilterChange: () => void;
		onSemesterFilterChange: () => void;
		onAcademicYearFilterChange: () => void;
	} = $props();

	function resolveScheduleCard(item: SelectEnrollmentsResult) {
		return item.id ? scheduleCardMap[item.id] ?? null : null;
	}
</script>

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
				oninput={onSearchInput}
				aria-label="Cari KRS aktif"
				placeholder="Cari mahasiswa, mata kuliah, atau ruang"
			/>{#if enrollmentSearch}<button type="button" class="search-clear" onclick={onClearSearch}
				><X size={14} /></button
			>{/if}</label
		>
		<div class="editor-grid schedule-filter-grid list-filter-grid">
			<label>
				<span>Hari</span>
				<select bind:value={scheduleDayFilter} onchange={onDayChange}>
					<option value="">Semua hari</option>
					{#each days as day (day)}
						<option value={day}>{DAY_LABELS[day]}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Mata kuliah</span>
				<select bind:value={scheduleCourseFilter} onchange={onCourseFilterChange}>
					<option value="">Semua mata kuliah</option>
					{#each courses as item (item.id)}
						<option value={item.id}>{item.name}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Dosen</span>
				<select bind:value={scheduleLecturerFilter} onchange={onDayChange}>
					<option value="">Semua dosen</option>
					{#each lecturers as item (item.id)}
						<option value={item.id}>{item.name}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Semester</span>
				<select bind:value={scheduleSemesterFilter} onchange={onSemesterFilterChange}>
					<option value="">Semua semester</option>
					{#each scheduleSemesterOptions as item (item)}
						<option value={item}>{item}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Tahun akademik</span>
				<select bind:value={scheduleAcademicYearFilter} onchange={onAcademicYearFilterChange}>
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
				<Button variant="ghost" size="sm" class="ghost-button" onclick={onResetScheduleFilters} disabled={scheduleActiveFilterCount === 0}>Hapus filter</Button>
			</div>
		</div>
		{#if bulkCount > 0}
			<div class="bulk-bar">
				<span class="bulk-count">{bulkCount} KRS dipilih</span>
				<div class="bulk-actions">
					<Button variant="ghost" size="sm" class="ghost-button" onclick={onBulkClear}>Batal</Button>
					<Button variant="ghost" size="sm" class="ghost-button" onclick={onOpenBulkEdit}>Ubah</Button>
					<Button variant="destructive" size="sm" class="danger-button" onclick={onOpenBulkDelete}>Hapus</Button>
				</div>
			</div>
		{/if}
		<div class="list-stack">
			{#if filteredEnrollments.length > 1}
				<label class="list-row select-all-row">
					<input
						type="checkbox"
						checked={bulkCount === filteredEnrollments.length && filteredEnrollments.length > 0}
						onchange={() => onBulkToggleAll(filteredEnrollments.map((i) => i.id).filter(Boolean) as string[])}
					/>
					<span>Pilih semua ({filteredEnrollments.length})</span>
				</label>
			{/if}
			{#each filteredEnrollments as item (item.id)}
				{@const scheduleCard = resolveScheduleCard(item)}
				<div class="list-row user-row" class:selected={selectedEnrollmentId === item.id} class:checked={item.id != null && bulkSelectedIds.has(item.id)}>
					<label class="row-checkbox"><input type="checkbox" checked={item.id != null && bulkSelectedIds.has(item.id)} onchange={() => item.id && onBulkToggleId(item.id)} onclick={(e) => e.stopPropagation()} /></label>
					<div role="button" tabindex="0" class="row-content" onkeydown={handleKeyboardClick} onclick={() => onPickEnrollment(item)}>
						<div>
							<span role="button" tabindex="0" class="entity-link" onkeydown={handleKeyboardClick} onclick={(e) => { e.stopPropagation(); onNavigateToEntity('students', item.student_id, item.student_name ?? undefined); }}><strong>{item.student_name}</strong></span>
							<span>
								<span role="button" tabindex="0" class="entity-link" onkeydown={handleKeyboardClick} onclick={(e) => { e.stopPropagation(); onNavigateToEntity('courses', item.course_id, item.course_name ?? undefined); }}>{item.course_name}</span>
								•
								<span role="button" tabindex="0" class="entity-link" onkeydown={handleKeyboardClick} onclick={(e) => { e.stopPropagation(); onNavigateToEntity('classrooms', item.class_room_id, item.class_room_name ?? undefined); }}>{item.class_room_name}</span>
							</span>
							{#if item.id && scheduleCard?.hasConflict && conflictSummaryByCardId[item.id]}
								<small class="list-conflict-copy">Bentrok dengan {conflictSummaryByCardId[item.id]}</small>
							{/if}
						</div>
						<small>{item.semester} • {item.academic_year}</small>
					</div>
				</div>
			{/each}
		</div>
		<CollectionPagination
			label="KRS"
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
	<section class="workspace-detail">
		<div class="pane-head compact">
			<div>
				<h3>{editorView === 'enrollments-bulk' ? 'Ubah massal KRS' : selectedEnrollment ? selectedEnrollment.course_name : 'Pilih satu KRS'}</h3>
			</div>
			{#if selectedEnrollment && editorView !== 'enrollments-bulk' && currentRole !== 'STUDENT'}
				<div class="detail-actions">
					<Button variant="ghost" size="sm" class="ghost-button" onclick={() => onOpenBuilderForEnrollment(selectedEnrollment)}>Edit di penjadwalan</Button>
				</div>
			{/if}
		</div>
		{#if selectedEnrollment && editorView !== 'enrollments-bulk'}
			<div class="detail-stack">
				{#if selectedEnrollmentConflictSummary}
					<p class="builder-conflict-copy">Bentrok dengan {selectedEnrollmentConflictSummary}</p>
				{/if}
				<div class="detail-lines">
					<div><span>Mahasiswa</span><span role="button" tabindex="0" class="entity-link" onkeydown={handleKeyboardClick} onclick={(e) => { e.stopPropagation(); onNavigateToEntity('students', selectedEnrollment.student_id, selectedEnrollment.student_name); }}><strong>{selectedEnrollment.student_name}</strong></span></div>
					<div><span>Mata kuliah</span><span role="button" tabindex="0" class="entity-link" onkeydown={handleKeyboardClick} onclick={(e) => { e.stopPropagation(); onNavigateToEntity('courses', selectedEnrollment.course_id, selectedEnrollment.course_name); }}><strong>{selectedEnrollment.course_name}</strong></span></div>
					<div><span>Ruang</span><span role="button" tabindex="0" class="entity-link" onkeydown={handleKeyboardClick} onclick={(e) => { e.stopPropagation(); onNavigateToEntity('classrooms', selectedEnrollment.class_room_id, selectedEnrollment.class_room_name); }}><strong>{selectedEnrollment.class_room_name}</strong></span></div>
					<div><span>Jadwal</span><strong>{selectedEnrollment.schedule_day ? DAY_LABELS[selectedEnrollment.schedule_day as keyof typeof DAY_LABELS] : '-'} • {formatTimeRange(selectedEnrollment.schedule_start_time, selectedEnrollment.schedule_end_time, timezone)}</strong></div>
					{#if selectedEnrollmentConflictGroup}
						<div><span>Ruang bentrok</span><strong>{selectedEnrollmentConflictGroup.rooms}</strong></div>
						<div><span>Dosen terkait</span><strong>{selectedEnrollmentConflictGroup.lecturers}</strong></div>
					{/if}
				</div>
			</div>
		{:else if editorView === 'enrollments-bulk'}
			<form class="editor-grid" {...bulkUpdateEnrollmentsEnhance}>
				<p class="editor-note">Ubah semester dan tahun akademik {bulkCount} KRS terpilih sekaligus. Kosongkan field yang tidak ingin diubah.</p>
				<input type="hidden" name="ids" value={[...bulkSelectedIds].join(',')} />
				<div class="builder-inline-actions">
					<Button type="button" variant="ghost" class="ghost-button" onclick={onBulkClear}>Batal</Button>
					<Button type="submit" class="primary-button">Simpan perubahan {bulkCount} KRS</Button>
				</div>
			</form>
		{:else}
			<p class="empty-copy">Pilih satu baris untuk melihat detail KRS.</p>
		{/if}
	</section>
</div>
