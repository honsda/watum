<script lang="ts">
	import type { AppRole } from '$lib/app/academic';
	import type { ViewId } from '$lib/app/navigation';
	import type { SelectEnrollmentsResult, SelectGradesResult } from '$lib/server/sql';
	import CollectionPagination from '$lib/components/app/CollectionPagination.svelte';
	import { Button } from '$lib/components/ui/button';
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

	type GradeFormState = {
		pending?: number;
	};

	let {
		currentRole,
		gradeSearch = $bindable(''),
		filteredGrades,
		selectedGradeId,
		selectedGrade,
		selectedGradeEnrollment,
		bulkSelectedIds,
		bulkCount,
		gradeDraft = $bindable({
			id: '',
			enrollmentId: '',
			assignmentScore: 80,
			midtermScore: 80,
			finalScore: 80
		}),
		bulkEditGradeAssignmentScore = $bindable<number | undefined>(undefined),
		bulkEditGradeMidtermScore = $bindable<number | undefined>(undefined),
		bulkEditGradeFinalScore = $bindable<number | undefined>(undefined),
		gradeLetterFilter = $bindable(''),
		gradeCourseFilter = $bindable(''),
		editorView,
		pendingDelete,
		collectionPagination,
		bulkUpdateGrades,
		createGradeEnhance,
		updateGradeEnhance,
		bulkUpdateGradesEnhance,
		enrollments,
		courses,
		enrollmentsIssue,
		gradeEditorBlocked,
		onSearchInput,
		onClearSearch,
		onBulkClear,
		onOpenBulkEdit,
		onOpenBulkDelete,
		onBulkToggleAll,
		onBulkToggleId,
		onPickGrade,
		handleKeyboardClick,
		onNavigateToEntity,
		onBeginCreate,
		onBeginEdit,
		onStopEditing,
		onRequestDelete,
		onConfirmDelete,
		onCancelDelete,
		onPagePrevious,
		onPageNext,
		onGradeLetterFilterChange,
		onGradeCourseFilterChange
	}: {
		currentRole: AppRole;
		gradeSearch: string;
		filteredGrades: SelectGradesResult[];
		selectedGradeId: string | null;
		selectedGrade: SelectGradesResult | null;
		selectedGradeEnrollment: SelectEnrollmentsResult | null;
		bulkSelectedIds: Set<string>;
		bulkCount: number;
		gradeDraft: {
			id: string;
			enrollmentId: string;
			assignmentScore: number;
			midtermScore: number;
			finalScore: number;
		};
		bulkEditGradeAssignmentScore: number | undefined;
		bulkEditGradeMidtermScore: number | undefined;
		bulkEditGradeFinalScore: number | undefined;
		gradeLetterFilter: string;
		gradeCourseFilter: string;
		editorView: string | null;
		pendingDelete: PendingDelete;
		collectionPagination: PaginationState;
		bulkUpdateGrades: GradeFormState;
		createGradeEnhance: EnhancedAction;
		updateGradeEnhance: EnhancedAction;
		bulkUpdateGradesEnhance: EnhancedAction;
		enrollments: SelectEnrollmentsResult[];
		courses: Array<{ id?: string | null; name?: string | null }>;
		enrollmentsIssue: string | undefined;
		gradeEditorBlocked: boolean;
		onSearchInput: () => void;
		onClearSearch: () => void;
		onBulkClear: () => void;
		onOpenBulkEdit: () => void;
		onOpenBulkDelete: () => void;
		onBulkToggleAll: (ids: string[]) => void;
		onBulkToggleId: (id: string) => void;
		onPickGrade: (item: SelectGradesResult) => void;
		handleKeyboardClick: (event: KeyboardEvent) => void;
		onNavigateToEntity: (view: ViewId, id: string | null | undefined, name?: string) => void;
		onBeginCreate: () => void;
		onBeginEdit: () => void;
		onStopEditing: () => void;
		onRequestDelete: () => void;
		onConfirmDelete: () => void;
		onCancelDelete: () => void;
		onPagePrevious: () => void;
		onPageNext: () => void;
		onGradeLetterFilterChange: () => void;
		onGradeCourseFilterChange: () => void;
	} = $props();
</script>

<div class="workspace-shell">
	<section class="workspace-list">
		<div class="pane-head">
			<div>
				<h3>Daftar nilai</h3>
			</div>
			{#if currentRole !== 'STUDENT'}
				<Button variant="ghost" size="sm" class="ghost-button" onclick={onBeginCreate}
					>Tambah</Button
				>
			{/if}
		</div>
		<div class="filter-bar">
			<label class="search-box grow"
				><Search size={16} /><input
					bind:value={gradeSearch}
					oninput={onSearchInput}
					aria-label="Cari data nilai"
					placeholder="Cari mahasiswa, mata kuliah, atau nilai huruf"
				/>{#if gradeSearch}<button type="button" class="search-clear" onclick={onClearSearch}
						><X size={14} /></button
					>{/if}</label
			>
			<label class="filter-select">
				<span>Nilai</span>
				<select bind:value={gradeLetterFilter} onchange={onGradeLetterFilterChange}>
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
				<select bind:value={gradeCourseFilter} onchange={onGradeCourseFilterChange}>
					<option value="">Semua</option>
					{#each courses as item (item.id)}
						<option value={item.id}>{item.name}</option>
					{/each}
				</select>
			</label>
		</div>
		{#if bulkCount > 0}
			<div class="bulk-bar">
				<span class="bulk-count">{bulkCount} nilai dipilih</span>
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
			{#if filteredGrades.length > 1}
				<label class="list-row select-all-row">
					<input
						type="checkbox"
						checked={bulkCount === filteredGrades.length && filteredGrades.length > 0}
						onchange={() =>
							onBulkToggleAll(filteredGrades.map((i) => i.id).filter(Boolean) as string[])}
					/>
					<span>Pilih semua ({filteredGrades.length})</span>
				</label>
			{/if}
			{#each filteredGrades as item (item.id)}
				<div
					class="list-row user-row"
					class:selected={selectedGradeId === item.id}
					class:checked={item.id != null && bulkSelectedIds.has(item.id)}
				>
					<label class="row-checkbox"
						><input
							type="checkbox"
							checked={item.id != null && bulkSelectedIds.has(item.id)}
							onchange={() => item.id && onBulkToggleId(item.id)}
							onclick={(e) => e.stopPropagation()}
						/></label
					>
					<div
						role="button"
						tabindex="0"
						class="row-content"
						onkeydown={handleKeyboardClick}
						onclick={() => onPickGrade(item)}
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
							<span
								><span
									role="button"
									tabindex="0"
									class="entity-link"
									onkeydown={handleKeyboardClick}
									onclick={(e) => {
										e.stopPropagation();
										onNavigateToEntity('courses', item.course_id, item.course_name ?? undefined);
									}}>{item.course_name}</span
								>
								• {item.letter_grade}</span
							>
						</div>
						<small>{item.total_score ?? '-'} poin</small>
					</div>
				</div>
			{/each}
		</div>
		<CollectionPagination
			label="nilai"
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
					{editorView === 'grades-bulk'
						? 'Ubah massal nilai'
						: selectedGrade
							? `${selectedGrade.student_name} • ${selectedGrade.course_name}`
							: 'Input nilai baru'}
				</h3>
			</div>
			{#if currentRole !== 'STUDENT'}
				<div class="detail-actions">
					{#if editorView === 'grades'}
						<Button variant="ghost" size="sm" class="ghost-button" onclick={onStopEditing}
							>Tutup form</Button
						>
					{:else if selectedGrade}
						<Button variant="ghost" size="sm" class="ghost-button" onclick={onBeginEdit}
							>Edit</Button
						>
					{/if}
					{#if selectedGradeId}
						<Button variant="destructive" size="sm" class="danger-button" onclick={onRequestDelete}
							>Hapus</Button
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
					<Button class="danger-button" variant="destructive" size="sm" onclick={onConfirmDelete}
						>{pendingDelete.confirmLabel}</Button
					>
					<Button class="ghost-button" variant="ghost" size="sm" onclick={onCancelDelete}
						>Batal</Button
					>
				</div>
			</section>
		{/if}
		{#if selectedGrade && editorView !== 'grades' && editorView !== 'grades-bulk'}
			<div class="detail-stack">
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
				<p class="detail-hint">Mode tinjau memisahkan peninjauan hasil dari proses edit nilai.</p>
			</div>
		{:else if currentRole !== 'STUDENT' && editorView === 'grades'}
			<form class="editor-grid" {...selectedGradeId ? updateGradeEnhance : createGradeEnhance}>
				{#if selectedGradeId}<input type="hidden" name="id" value={gradeDraft.id} />{/if}
				<label
					><span>KRS</span><select bind:value={gradeDraft.enrollmentId}
						><option value="">Pilih KRS</option>{#if enrollmentsIssue && !enrollments.length}<option
								value=""
								disabled>{enrollmentsIssue}</option
							>{/if}{#each enrollments as item (item.id)}<option value={item.id}
								>{item.student_name} • {item.course_name}</option
							>{/each}</select
					>{#if selectedGradeEnrollment}<span
							role="button"
							tabindex="0"
							class="editor-entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity(
									'students',
									selectedGradeEnrollment.student_id,
									selectedGradeEnrollment.student_name ?? undefined
								);
							}}>Lihat mahasiswa</span
						>{/if}{#if selectedGradeEnrollment}<span
							role="button"
							tabindex="0"
							class="editor-entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity(
									'courses',
									selectedGradeEnrollment.course_id,
									selectedGradeEnrollment.course_name ?? undefined
								);
							}}>Lihat mata kuliah</span
						>{/if}</label
				>
				<label
					><span>Tugas</span><input
						min="0"
						max="100"
						bind:value={gradeDraft.assignmentScore}
					/></label
				>
				<label
					><span>UTS</span><input min="0" max="100" bind:value={gradeDraft.midtermScore} /></label
				>
				<label><span>UAS</span><input min="0" max="100" bind:value={gradeDraft.finalScore} /></label
				>
				{#if gradeEditorBlocked}<p class="editor-note">
						Data KRS harus tersedia sebelum nilai bisa disimpan.
					</p>{/if}
				<div class="editor-submit">
					<Button type="submit" class="primary-button" disabled={gradeEditorBlocked}
						>{selectedGradeId ? 'Simpan perubahan' : 'Simpan nilai'}</Button
					>
				</div>
			</form>
		{:else if editorView === 'grades-bulk'}
			<form class="editor-grid" {...bulkUpdateGradesEnhance}>
				<p class="editor-note">
					Ubah komponen nilai {bulkCount} nilai terpilih sekaligus. Total dan nilai huruf akan dihitung
					ulang otomatis. Kosongkan field yang tidak ingin diubah.
				</p>
				<input type="hidden" name="ids" value={[...bulkSelectedIds].join(',')} />
				<label
					><span>Tugas</span><input
						type="number"
						name="assignmentScore"
						min="0"
						max="100"
						placeholder="Kosongkan jika tidak diubah"
						value={bulkEditGradeAssignmentScore ?? ''}
						oninput={(e) => {
							const val = (e.currentTarget as HTMLInputElement).value;
							bulkEditGradeAssignmentScore = val ? Number(val) : undefined;
						}}
					/></label
				>
				<label
					><span>UTS</span><input
						type="number"
						name="midtermScore"
						min="0"
						max="100"
						placeholder="Kosongkan jika tidak diubah"
						value={bulkEditGradeMidtermScore ?? ''}
						oninput={(e) => {
							const val = (e.currentTarget as HTMLInputElement).value;
							bulkEditGradeMidtermScore = val ? Number(val) : undefined;
						}}
					/></label
				>
				<label
					><span>UAS</span><input
						type="number"
						name="finalScore"
						min="0"
						max="100"
						placeholder="Kosongkan jika tidak diubah"
						value={bulkEditGradeFinalScore ?? ''}
						oninput={(e) => {
							const val = (e.currentTarget as HTMLInputElement).value;
							bulkEditGradeFinalScore = val ? Number(val) : undefined;
						}}
					/></label
				>
				<div class="builder-inline-actions">
					<Button type="button" variant="ghost" class="ghost-button" onclick={onBulkClear}
						>Batal</Button
					>
					<Button
						type="submit"
						class="primary-button"
						disabled={(bulkUpdateGrades.pending ?? 0) > 0}
						>Simpan perubahan {bulkCount} nilai</Button
					>
				</div>
			</form>
		{:else}
			<p class="empty-copy">
				Pilih satu nilai untuk melihat hasil, atau tambahkan nilai baru saat evaluasi perlu dicatat.
			</p>
		{/if}
	</section>
</div>
