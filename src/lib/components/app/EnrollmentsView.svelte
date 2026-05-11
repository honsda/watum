<script lang="ts">
	import type { AppRole } from '$lib/app/academic';
	import type { ViewId } from '$lib/app/navigation';
	import type {
		SelectEnrollmentsResult,
		SelectCoursesResult,
		SelectLecturersResult
	} from '$lib/server/sql';
	import { DAY_LABELS, formatTimeRange, type ScheduleCard } from '$lib/app/academic';
	import { days as dayOptions } from '$lib/validations/enrollment';
	import CollectionPagination from '$lib/components/app/CollectionPagination.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Search, X } from '@lucide/svelte';
	import './crud-view.css';

	type EnrollmentsViewState = {
		enrollmentSearch: string;
		scheduleDayFilter: string;
		scheduleCourseFilter: string;
		scheduleRoomFilter: string;
		scheduleLecturerFilter: string;
		scheduleSemesterFilter: string;
		scheduleAcademicYearFilter: string;
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

	type ScheduleCardMap = Record<string, ScheduleCard>;
	type ConflictSummaryMap = Record<string, string>;
	type EnrollmentPolicy = {
		semester: 'GANJIL' | 'GENAP';
		academicYear: string;
		requestsOpen: boolean;
	};

	let {
		currentRole,
		state = $bindable<EnrollmentsViewState>({
			enrollmentSearch: '',
			scheduleDayFilter: '',
			scheduleCourseFilter: '',
			scheduleRoomFilter: '',
			scheduleLecturerFilter: '',
			scheduleSemesterFilter: '',
			scheduleAcademicYearFilter: ''
		}),
		filteredEnrollments,
		selectedEnrollmentId,
		selectedEnrollment,
		selectedEnrollmentConflictSummary,
		selectedEnrollmentConflictGroup,
		scheduleCardMap,
		conflictSummaryByCardId,
		courses,
		lecturers,
		scheduleSemesterOptions,
		scheduleAcademicYearOptions,
		scheduleActiveFilterCount,
		bulkSelectedIds,
		bulkCount,
		editorView,
		collectionPagination,
		bulkUpdateEnrollmentsEnhance,
		bulkEditEnrollmentSemester,
		bulkEditEnrollmentAcademicYear,
		requestEnrollmentEnhance,
		updateEnrollmentPolicyEnhance,
		enrollmentPolicy = { semester: 'GANJIL', academicYear: '2025/2026', requestsOpen: false },
		enrollmentPolicyDraft = { semester: 'GANJIL', academicYear: '2025/2026', requestsOpen: false },
		enrollmentPolicyLoaded,
		enrollmentPolicyIssue,
		studentStudyProgramId = null,
		days,
		timezone,
		onBulkEditEnrollmentSemesterInput,
		onBulkEditEnrollmentAcademicYearInput,
		onEnrollmentPolicyDraftSemesterInput,
		onEnrollmentPolicyDraftAcademicYearInput,
		onEnrollmentPolicyDraftRequestsOpenChange,
		handleKeyboardClick,
		onNavigateToEntity,
		onOpenBuilderForEnrollment,
		onOpenBuilderForApproval,
		onCancelRequest,
		onRejectRequest,
		onShowPolicySettings,
		onStartRequest,
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
		state: EnrollmentsViewState;
		filteredEnrollments: SelectEnrollmentsResult[];
		selectedEnrollmentId: string | null;
		selectedEnrollment: SelectEnrollmentsResult | null;
		selectedEnrollmentConflictSummary: string | null;
		selectedEnrollmentConflictGroup: { rooms: string; lecturers: string } | null;
		scheduleCardMap: ScheduleCardMap;
		conflictSummaryByCardId: ConflictSummaryMap;
		courses: SelectCoursesResult[];
		lecturers: SelectLecturersResult[];
		scheduleSemesterOptions: string[];
		scheduleAcademicYearOptions: string[];
		scheduleActiveFilterCount: number;
		bulkSelectedIds: Set<string>;
		bulkCount: number;
		editorView: string | null;
		collectionPagination: PaginationState;
		bulkUpdateEnrollmentsEnhance: EnhancedAction;
		bulkEditEnrollmentSemester: string;
		bulkEditEnrollmentAcademicYear: string;
		requestEnrollmentEnhance?: EnhancedAction;
		updateEnrollmentPolicyEnhance?: EnhancedAction;
		enrollmentPolicy?: EnrollmentPolicy;
		enrollmentPolicyDraft?: EnrollmentPolicy;
		enrollmentPolicyLoaded?: boolean;
		enrollmentPolicyIssue?: string | null;
		studentStudyProgramId?: string | null;
		days: typeof dayOptions;
		timezone: string;
		onBulkEditEnrollmentSemesterInput: (value: string) => void;
		onBulkEditEnrollmentAcademicYearInput: (value: string) => void;
		onEnrollmentPolicyDraftSemesterInput: (value: 'GANJIL' | 'GENAP') => void;
		onEnrollmentPolicyDraftAcademicYearInput: (value: string) => void;
		onEnrollmentPolicyDraftRequestsOpenChange: (value: boolean) => void;
		handleKeyboardClick: (event: KeyboardEvent) => void;
		onNavigateToEntity: (view: ViewId, id: string | null | undefined, name?: string) => void;
		onOpenBuilderForEnrollment: (item: SelectEnrollmentsResult) => void;
		onOpenBuilderForApproval?: (item: SelectEnrollmentsResult) => void;
		onCancelRequest?: (id: string) => void;
		onRejectRequest?: (id: string) => void;
		onShowPolicySettings?: () => void;
		onStartRequest?: () => void;
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
		return item.id ? (scheduleCardMap[item.id] ?? null) : null;
	}

	const requestCourses = $derived(
		studentStudyProgramId
			? courses.filter((c) => c.study_program_id === studentStudyProgramId)
			: courses
	);
	const studentCanRequestEnrollment = $derived(
		Boolean(
			enrollmentPolicyLoaded &&
				enrollmentPolicy?.requestsOpen &&
				requestCourses.length &&
				requestEnrollmentEnhance
		)
	);
</script>

<div class="workspace-shell">
	<section class="workspace-list">
		<div class="pane-head">
			<div>
				<h3>KRS aktif</h3>
			</div>
			{#if currentRole === 'STUDENT'}
				<Button
					size="sm"
					class="primary-button"
					disabled={!studentCanRequestEnrollment}
					onclick={() => onStartRequest?.()}
					>Ajukan mata kuliah</Button
				>
			{/if}
		</div>
		<label class="search-box"
			><Search size={16} /><input
				bind:value={state.enrollmentSearch}
				oninput={onSearchInput}
				aria-label="Cari KRS aktif"
				placeholder="Cari mahasiswa, mata kuliah, atau ruang"
			/>{#if state.enrollmentSearch}<button
					type="button"
					class="search-clear"
					onclick={onClearSearch}><X size={14} /></button
				>{/if}</label
		>
		<div class="editor-grid schedule-filter-grid list-filter-grid">
			<label>
				<span>Hari</span>
				<select bind:value={state.scheduleDayFilter} onchange={onDayChange}>
					<option value="">Semua hari</option>
					{#each days as day (day)}
						<option value={day}>{DAY_LABELS[day]}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Mata kuliah</span>
				<select bind:value={state.scheduleCourseFilter} onchange={onCourseFilterChange}>
					<option value="">Semua mata kuliah</option>
					{#each requestCourses as item (item.id)}
						<option value={item.id}>{item.name}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Dosen</span>
				<select bind:value={state.scheduleLecturerFilter} onchange={onDayChange}>
					<option value="">Semua dosen</option>
					{#each lecturers as item (item.id)}
						<option value={item.id}>{item.name}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Semester</span>
				<select bind:value={state.scheduleSemesterFilter} onchange={onSemesterFilterChange}>
					<option value="">Semua semester</option>
					{#each scheduleSemesterOptions as item (item)}
						<option value={item}>{item}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>Tahun akademik</span>
				<select bind:value={state.scheduleAcademicYearFilter} onchange={onAcademicYearFilterChange}>
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
					variant="ghost"
					size="sm"
					class="ghost-button"
					onclick={onResetScheduleFilters}
					disabled={scheduleActiveFilterCount === 0}>Hapus filter</Button
				>
			</div>
		</div>
		{#if currentRole !== 'STUDENT' && bulkCount > 0}
			<div class="bulk-bar">
				<span class="bulk-count">{bulkCount} KRS dipilih</span>
				<div class="bulk-actions">
					<Button variant="ghost" size="sm" class="ghost-button" onclick={onBulkClear}>Batal</Button
					>
					<Button variant="ghost" size="sm" class="ghost-button" onclick={onOpenBulkEdit}
						>Ubah</Button
					>
					<Button variant="destructive" size="sm" class="danger-button" onclick={onOpenBulkDelete}
						>Hapus</Button
					>
				</div>
			</div>
		{/if}
		<div class="list-stack">
			{#if currentRole !== 'STUDENT' && filteredEnrollments.length > 1}
				<label class="list-row select-all-row">
					<input
						type="checkbox"
						checked={bulkCount === filteredEnrollments.length && filteredEnrollments.length > 0}
						onchange={() =>
							onBulkToggleAll(filteredEnrollments.map((i) => i.id).filter(Boolean) as string[])}
					/>
					<span>Pilih semua ({filteredEnrollments.length})</span>
				</label>
			{/if}
			{#each filteredEnrollments as item (item.id)}
				{@const scheduleCard = resolveScheduleCard(item)}
				<div
					class="list-row user-row"
					class:selected={selectedEnrollmentId === item.id}
					class:checked={item.id != null && bulkSelectedIds.has(item.id)}
				>
					{#if currentRole !== 'STUDENT'}
						<label class="row-checkbox"
							><input
								type="checkbox"
								checked={item.id != null && bulkSelectedIds.has(item.id)}
								onchange={() => item.id && onBulkToggleId(item.id)}
								onclick={(e) => e.stopPropagation()}
							/></label
						>
					{/if}
					<div
						role="button"
						tabindex="0"
						class="row-content"
						onkeydown={handleKeyboardClick}
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
									onNavigateToEntity('students', item.student_id, item.student_name ?? undefined);
								}}><strong>{item.student_name}</strong></span
							>
							<span>
								<span
									role="button"
									tabindex="0"
									class="entity-link"
									onkeydown={handleKeyboardClick}
									onclick={(e) => {
										e.stopPropagation();
										onNavigateToEntity('courses', item.course_id, item.course_name ?? undefined);
									}}>{item.course_name}</span
								>
								•
								<span
									role="button"
									tabindex="0"
									class="entity-link"
									onkeydown={handleKeyboardClick}
									onclick={(e) => {
										e.stopPropagation();
										onNavigateToEntity(
											'classrooms',
											item.class_room_id,
											item.class_room_name ?? undefined
										);
									}}>{item.class_room_name}</span
								>
							</span>
							{#if item.id && scheduleCard?.hasConflict && conflictSummaryByCardId[item.id]}
								<small class="list-conflict-copy"
									>Bentrok dengan {conflictSummaryByCardId[item.id]}</small
								>
							{/if}
						</div>
						<small>
							{item.semester} • {item.academic_year}
							{#if item.status === 'PENDING'}
								<Badge variant="secondary">Menunggu</Badge>
							{/if}
						</small>
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
				<h3>
					{editorView === 'enrollments-bulk'
						? 'Ubah massal KRS'
						: currentRole === 'ADMIN' && !selectedEnrollment
							? 'Pengaturan pengajuan KRS'
						: selectedEnrollment
							? selectedEnrollment.course_name
							: 'Pilih satu KRS'}
				</h3>
			</div>
			{#if selectedEnrollment && editorView !== 'enrollments-bulk'}
				<div class="detail-actions">
					{#if currentRole === 'ADMIN'}
						<Button
							variant="outline"
							size="sm"
							onclick={() => onShowPolicySettings?.()}
						>
							Pengaturan
						</Button>
					{/if}
					{#if currentRole === 'STUDENT' && selectedEnrollment.status === 'PENDING'}
						<Button
							variant="ghost"
							size="sm"
							class="ghost-button"
							onclick={() => onCancelRequest?.(selectedEnrollment.id!)}
							>Batalkan pengajuan</Button
						>
					{:else if currentRole !== 'STUDENT' && selectedEnrollment.status === 'PENDING'}
						<Button
							variant="ghost"
							size="sm"
							class="ghost-button"
							onclick={() => onOpenBuilderForApproval?.(selectedEnrollment)}
							>Setujui</Button
						>
						<Button
							variant="destructive"
							size="sm"
							class="danger-button"
							onclick={() => onRejectRequest?.(selectedEnrollment.id!)}
							>Tolak</Button
						>
					{:else if currentRole !== 'STUDENT' && selectedEnrollment.status === 'APPROVED'}
						<Button
							variant="ghost"
							size="sm"
							class="ghost-button"
							onclick={() => onOpenBuilderForEnrollment(selectedEnrollment)}
							>Edit di penjadwalan</Button
						>
					{/if}
				</div>
			{/if}
		</div>
		{#if selectedEnrollment && editorView !== 'enrollments-bulk'}
			<div class="detail-stack">
				{#if selectedEnrollmentConflictSummary}
					<p class="builder-conflict-copy">Bentrok dengan {selectedEnrollmentConflictSummary}</p>
				{/if}
				<div class="detail-lines">
					<div>
						<span>Status</span><strong
							>{selectedEnrollment.status === 'PENDING' ? 'Menunggu persetujuan' : 'Disetujui'}</strong
						>
					</div>
					<div>
						<span>Mahasiswa</span><span
							role="button"
							tabindex="0"
							class="entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity(
									'students',
									selectedEnrollment.student_id,
									selectedEnrollment.student_name
								);
							}}><strong>{selectedEnrollment.student_name}</strong></span
						>
					</div>
					<div>
						<span>Mata kuliah</span><span
							role="button"
							tabindex="0"
							class="entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity(
									'courses',
									selectedEnrollment.course_id,
									selectedEnrollment.course_name
								);
							}}><strong>{selectedEnrollment.course_name}</strong></span
						>
					</div>
					<div>
						<span>Ruang</span><span
							role="button"
							tabindex="0"
							class="entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity(
									'classrooms',
									selectedEnrollment.class_room_id,
									selectedEnrollment.class_room_name
								);
							}}><strong>{selectedEnrollment.class_room_name}</strong></span
						>
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
							<span>Ruang bentrok</span><strong>{selectedEnrollmentConflictGroup.rooms}</strong>
						</div>
						<div>
							<span>Dosen terkait</span><strong>{selectedEnrollmentConflictGroup.lecturers}</strong>
						</div>
					{/if}
				</div>
			</div>
		{:else if editorView === 'enrollments-bulk'}
			<form class="editor-grid" {...bulkUpdateEnrollmentsEnhance}>
				<p class="editor-note">
					Ubah semester dan tahun akademik {bulkCount} KRS terpilih sekaligus. Kosongkan field yang tidak
					ingin diubah.
				</p>
				<input type="hidden" name="ids" value={[...bulkSelectedIds].join(',')} />
				<label>
					<span>Semester</span>
					<select
						name="semester"
						value={bulkEditEnrollmentSemester}
						onchange={(event) =>
							onBulkEditEnrollmentSemesterInput(
								(event.currentTarget as HTMLSelectElement).value
							)}
					>
						<option value="">Tidak diubah</option>
						<option value="GANJIL">GANJIL</option>
						<option value="GENAP">GENAP</option>
					</select>
				</label>
				<label>
					<span>Tahun akademik</span>
					<input
						name="academicYear"
						value={bulkEditEnrollmentAcademicYear}
						oninput={(event) =>
							onBulkEditEnrollmentAcademicYearInput(
								(event.currentTarget as HTMLInputElement).value
							)}
						placeholder="Contoh: 2025/2026"
					/>
				</label>
				<div class="builder-inline-actions">
					<Button type="button" variant="ghost" class="ghost-button" onclick={onBulkClear}
						>Batal</Button
					>
					<Button type="submit" class="primary-button">Simpan perubahan {bulkCount} KRS</Button>
				</div>
			</form>
		{:else if currentRole === 'ADMIN' && updateEnrollmentPolicyEnhance}
			<div class="policy-settings-shell">
				<div class="policy-settings-summary">
					<div>
						<p class="policy-settings-kicker">Kontrol global</p>
						<h4>Pengajuan KRS mahasiswa</h4>
						<p class="editor-note">
							Tentukan semester dan tahun akademik aktif, lalu buka atau tutup pengajuan secara
							global dari satu panel.
						</p>
					</div>
					<div class="policy-settings-badges">
						<Badge variant="outline">{enrollmentPolicy.semester}</Badge>
						<Badge variant="secondary">{enrollmentPolicy.academicYear}</Badge>
						<Badge variant={enrollmentPolicy.requestsOpen ? 'default' : 'secondary'}>
							{enrollmentPolicy.requestsOpen ? 'Terbuka' : 'Tertutup'}
						</Badge>
					</div>
				</div>
				<form class="editor-grid policy-settings-form" {...updateEnrollmentPolicyEnhance}>
					<div class="policy-settings-grid">
						<label>
							<span>Semester aktif</span>
							<select
								name="semester"
								value={enrollmentPolicyDraft.semester}
								onchange={(event) =>
									onEnrollmentPolicyDraftSemesterInput(
										(event.currentTarget as HTMLSelectElement).value as 'GANJIL' | 'GENAP'
									)}
								required
							>
								<option value="GANJIL">GANJIL</option>
								<option value="GENAP">GENAP</option>
							</select>
						</label>
						<label>
							<span>Tahun akademik aktif</span>
							<input
								name="academicYear"
								value={enrollmentPolicyDraft.academicYear}
								oninput={(event) =>
									onEnrollmentPolicyDraftAcademicYearInput(
										(event.currentTarget as HTMLInputElement).value
									)}
								placeholder="Contoh: 2025/2026"
								required
							/>
						</label>
					</div>
					<label class="policy-toggle-card">
						<div>
							<strong>Buka pengajuan mahasiswa</strong>
							<p>
								Saat aktif, mahasiswa dapat mengirim usulan KRS sesuai prodi, semester, dan tahun
								akademik yang ditetapkan admin.
							</p>
						</div>
						<input
							type="checkbox"
							name="requestsOpen"
							checked={enrollmentPolicyDraft.requestsOpen}
							onchange={(event) =>
								onEnrollmentPolicyDraftRequestsOpenChange(
									(event.currentTarget as HTMLInputElement).checked
								)}
						/>
					</label>
					{#if enrollmentPolicyIssue}
						<p class="editor-note">{enrollmentPolicyIssue}</p>
					{/if}
					<div class="builder-inline-actions">
						<Button type="submit" class="primary-button" disabled={!enrollmentPolicyLoaded}
							>Simpan pengaturan</Button
						>
					</div>
				</form>
			</div>
		{:else if currentRole === 'STUDENT' && requestEnrollmentEnhance}
			<form class="editor-grid" {...requestEnrollmentEnhance}>
				<p class="editor-note">Ajukan mata kuliah baru untuk semester ini.</p>
				<label>
					<span>Mata kuliah</span>
				<select name="courseId" required disabled={!studentCanRequestEnrollment}>
					<option value="" disabled selected>Pilih mata kuliah</option>
					{#each requestCourses as course (course.id)}
						<option value={course.id}>{course.name}</option>
					{/each}
					</select>
				</label>
				<label>
					<span>Semester</span>
					<input value={enrollmentPolicy?.semester ?? '-'} readonly disabled />
				</label>
				<label>
					<span>Tahun akademik</span>
					<input value={enrollmentPolicy?.academicYear ?? '-'} readonly disabled />
				</label>
				{#if enrollmentPolicyIssue}
					<p class="editor-note">{enrollmentPolicyIssue}</p>
				{:else if !enrollmentPolicyLoaded}
					<p class="editor-note">Memuat pengaturan pengajuan KRS...</p>
				{:else if !(enrollmentPolicy?.requestsOpen ?? false)}
					<p class="editor-note">Pengajuan KRS sedang ditutup oleh admin.</p>
				{:else if !requestCourses.length}
					<p class="editor-note">Belum ada mata kuliah yang tersedia untuk program studi Anda.</p>
				{/if}
				<div class="builder-inline-actions">
					<Button type="submit" class="primary-button" disabled={!studentCanRequestEnrollment}
						>Ajukan mata kuliah</Button
					>
				</div>
			</form>
		{:else}
			<p class="empty-copy">Pilih satu baris untuk melihat detail KRS.</p>
		{/if}
	</section>
</div>

<style>
	.policy-settings-shell {
		display: grid;
		gap: 1rem;
	}

	.policy-settings-summary {
		display: grid;
		gap: 0.9rem;
		padding: 1rem;
		border: 1px solid color-mix(in oklch, var(--color-accent-strong) 18%, var(--color-border) 82%);
		border-radius: 1rem;
		background:
			linear-gradient(
				180deg,
				color-mix(in oklch, var(--color-accent-soft) 22%, var(--color-surface) 78%),
				var(--color-panel)
			);
	}

	.policy-settings-kicker {
		margin: 0;
		font-size: 0.74rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-accent-strong);
	}

	.policy-settings-summary h4 {
		margin: 0;
		font: 600 1.05rem/1.2 var(--font-display);
		letter-spacing: -0.02em;
	}

	.policy-settings-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.policy-settings-form,
	.policy-settings-grid {
		display: grid;
		gap: 0.9rem;
	}

	.policy-settings-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.policy-toggle-card {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		padding: 0.95rem 1rem;
		border: 1px solid var(--color-border);
		border-radius: 0.95rem;
		background: var(--color-surface);
	}

	.policy-toggle-card strong {
		display: block;
		margin-bottom: 0.25rem;
		font-size: 0.96rem;
	}

	.policy-toggle-card p {
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.45;
		color: var(--color-muted-foreground);
	}

	.policy-toggle-card input {
		width: 1.05rem;
		height: 1.05rem;
		margin-top: 0.15rem;
		flex: 0 0 auto;
	}

	@media (max-width: 720px) {
		.policy-settings-grid {
			grid-template-columns: 1fr;
		}

		.policy-toggle-card {
			flex-direction: column;
		}
	}
</style>
