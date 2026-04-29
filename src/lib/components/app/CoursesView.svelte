<script lang="ts">
	import type { AppRole } from '$lib/app/academic';
	import type { ViewId } from '$lib/app/navigation';
	import type {
		SelectCoursesResult,
		SelectLecturersResult,
		SelectStudyProgramsResult
	} from '$lib/server/sql';
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

	let {
		currentRole,
		courseSearch = $bindable(''),
		filteredCourses,
		selectedCourseId,
		selectedCourse,
		bulkSelectedIds,
		bulkCount,
		courseDraft = $bindable({ id: '', name: '', credits: 3, studyProgramId: '', lecturerId: '' }),
		bulkEditCourseCredits = $bindable(2),
		bulkEditCourseStudyProgramId = $bindable(''),
		bulkEditCourseLecturerId = $bindable(''),
		editorView,
		pendingDelete,
		collectionPagination,
		updateCourseEnhance,
		createCourseEnhance,
		bulkUpdateCoursesEnhance,
		studyPrograms,
		lecturers,
		studyProgramsIssue,
		lecturersIssue,
		courseEditorBlocked,
		onSearchInput,
		onClearSearch,
		onBeginCreate,
		onBulkClear,
		onOpenBulkEdit,
		onOpenBulkDelete,
		onBulkToggleAll,
		onBulkToggleId,
		onPickCourse,
		handleKeyboardClick,
		onNavigateToEntity,
		onBeginEdit,
		onStopEditing,
		onRequestDelete,
		onConfirmDelete,
		onCancelDelete,
		onPagePrevious,
		onPageNext
	}: {
		currentRole: AppRole;
		courseSearch: string;
		filteredCourses: SelectCoursesResult[];
		selectedCourseId: string | null;
		selectedCourse: SelectCoursesResult | null;
		bulkSelectedIds: Set<string>;
		bulkCount: number;
		courseDraft: {
			id: string;
			name: string;
			credits: number;
			studyProgramId: string;
			lecturerId: string;
		};
		bulkEditCourseCredits: number;
		bulkEditCourseStudyProgramId: string;
		bulkEditCourseLecturerId: string;
		editorView: string | null;
		pendingDelete: PendingDelete;
		collectionPagination: PaginationState;
		updateCourseEnhance: EnhancedAction;
		createCourseEnhance: EnhancedAction;
		bulkUpdateCoursesEnhance: EnhancedAction;
		studyPrograms: SelectStudyProgramsResult[];
		lecturers: SelectLecturersResult[];
		studyProgramsIssue: string | undefined;
		lecturersIssue: string | undefined;
		courseEditorBlocked: boolean;
		onSearchInput: () => void;
		onClearSearch: () => void;
		onBeginCreate: () => void;
		onBulkClear: () => void;
		onOpenBulkEdit: () => void;
		onOpenBulkDelete: () => void;
		onBulkToggleAll: (ids: string[]) => void;
		onBulkToggleId: (id: string) => void;
		onPickCourse: (item: SelectCoursesResult) => void;
		handleKeyboardClick: (event: KeyboardEvent) => void;
		onNavigateToEntity: (view: ViewId, id: string | null | undefined, name?: string) => void;
		onBeginEdit: () => void;
		onStopEditing: () => void;
		onRequestDelete: () => void;
		onConfirmDelete: () => void;
		onCancelDelete: () => void;
		onPagePrevious: () => void;
		onPageNext: () => void;
	} = $props();
</script>

<div class="workspace-shell">
	<section class="workspace-list">
		<div class="pane-head">
			<div>
				<h3>Daftar mata kuliah</h3>
			</div>
			<Button variant="ghost" size="sm" class="ghost-button" onclick={onBeginCreate}>Tambah</Button>
		</div>
		<label class="search-box"
			><Search size={16} /><input
				bind:value={courseSearch}
				oninput={onSearchInput}
				aria-label="Cari data mata kuliah"
				placeholder="Cari kode, nama, atau dosen pengampu"
			/>{#if courseSearch}<button type="button" class="search-clear" onclick={onClearSearch}
					><X size={14} /></button
				>{/if}</label
		>
		{#if bulkCount > 0}
			<div class="bulk-bar">
				<span class="bulk-count">{bulkCount} mata kuliah dipilih</span>
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
			{#if filteredCourses.length > 1}
				<label class="list-row select-all-row">
					<input
						type="checkbox"
						checked={bulkCount === filteredCourses.length && filteredCourses.length > 0}
						onchange={() =>
							onBulkToggleAll(filteredCourses.map((i) => i.id).filter(Boolean) as string[])}
					/>
					<span>Pilih semua ({filteredCourses.length})</span>
				</label>
			{/if}
			{#each filteredCourses as item (item.id)}
				<div
					class="list-row user-row"
					class:selected={selectedCourseId === item.id}
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
						onclick={() => onPickCourse(item)}
					>
						<div>
							<span
								role="button"
								tabindex="0"
								class="entity-link"
								onkeydown={handleKeyboardClick}
								onclick={(e) => {
									e.stopPropagation();
									onNavigateToEntity('courses', item.id, item.name ?? undefined);
								}}><strong>{item.id} • {item.name}</strong></span
							>
							<span>
								<span
									role="button"
									tabindex="0"
									class="entity-link"
									onkeydown={handleKeyboardClick}
									onclick={(e) => {
										e.stopPropagation();
										onNavigateToEntity(
											'studyPrograms',
											item.study_program_id,
											item.study_program_name ?? undefined
										);
									}}>{item.study_program_name}</span
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
											'lecturers',
											item.lecturer_id,
											item.lecturer_name ?? undefined
										);
									}}>{item.lecturer_name}</span
								>
							</span>
						</div>
						<small>{item.credits} SKS</small>
					</div>
				</div>
			{/each}
		</div>
		<CollectionPagination
			label="mata kuliah"
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
					{editorView === 'courses-bulk'
						? 'Ubah massal mata kuliah'
						: selectedCourse
							? selectedCourse.name
							: 'Tambah mata kuliah'}
				</h3>
			</div>
			{#if currentRole === 'ADMIN'}
				<div class="detail-actions">
					{#if editorView === 'courses'}
						<Button variant="ghost" size="sm" class="ghost-button" onclick={onStopEditing}
							>Tutup form</Button
						>
					{:else if selectedCourse}
						<Button variant="ghost" size="sm" class="ghost-button" onclick={onBeginEdit}
							>Edit</Button
						>
					{/if}
					{#if selectedCourseId}
						<Button variant="destructive" size="sm" class="danger-button" onclick={onRequestDelete}
							>Hapus</Button
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
					<Button class="danger-button" variant="destructive" size="sm" onclick={onConfirmDelete}
						>{pendingDelete.confirmLabel}</Button
					>
					<Button class="ghost-button" variant="ghost" size="sm" onclick={onCancelDelete}
						>Batal</Button
					>
				</div>
			</section>
		{/if}
		{#if selectedCourse && editorView !== 'courses' && editorView !== 'courses-bulk'}
			<div class="detail-stack">
				<div class="detail-lines">
					<div><span>Kode</span><strong>{selectedCourse.id}</strong></div>
					<div>
						<span>Program studi</span><span
							role="button"
							tabindex="0"
							class="entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity(
									'studyPrograms',
									selectedCourse.study_program_id,
									selectedCourse.study_program_name ?? undefined
								);
							}}><strong>{selectedCourse.study_program_name}</strong></span
						>
					</div>
					<div>
						<span>Dosen</span><span
							role="button"
							tabindex="0"
							class="entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity(
									'lecturers',
									selectedCourse.lecturer_id,
									selectedCourse.lecturer_name ?? undefined
								);
							}}><strong>{selectedCourse.lecturer_name}</strong></span
						>
					</div>
					<div><span>Beban</span><strong>{selectedCourse.credits} SKS</strong></div>
					<div><span>Peserta</span><strong>{selectedCourse.enrollment_count ?? 0}</strong></div>
				</div>
				<p class="detail-hint">
					Gunakan mode tinjau untuk membaca beban kuliah dan relasi dosen sebelum membuka editor.
				</p>
			</div>
		{:else if currentRole === 'ADMIN' && editorView === 'courses'}
			<form class="editor-grid" {...selectedCourseId ? updateCourseEnhance : createCourseEnhance}>
				{#if selectedCourseId}<input type="hidden" name="id" value={courseDraft.id} />{:else}<p
						class="editor-note"
					>
						Kode mata kuliah dibuat otomatis saat data disimpan.
					</p>{/if}
				<label
					><span>Nama mata kuliah</span><input
						name="name"
						type="text"
						bind:value={courseDraft.name}
					/></label
				>
				<label
					><span>SKS</span><input
						name="n:credits"
						type="number"
						min="1"
						max="6"
						bind:value={courseDraft.credits}
					/></label
				>
				<label
					><span>Program studi</span><select
						name="studyProgramId"
						bind:value={courseDraft.studyProgramId}
						><option value="">Pilih program studi</option
						>{#if studyProgramsIssue && !studyPrograms.length}<option value="" disabled
								>{studyProgramsIssue}</option
							>{/if}{#each studyPrograms as item (item.id)}<option value={item.id}
								>{item.name}</option
							>{/each}</select
					>{#if courseDraft.studyProgramId}<span
							role="button"
							tabindex="0"
							class="editor-entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity('studyPrograms', courseDraft.studyProgramId);
							}}>Lihat prodi</span
						>{/if}</label
				>
				<label
					><span>Dosen pengampu</span><select name="lecturerId" bind:value={courseDraft.lecturerId}
						><option value="">Pilih dosen</option
						>{#if courseDraft.lecturerId && !lecturers.some((item) => item.id === courseDraft.lecturerId)}<option
								value={courseDraft.lecturerId}
								>{selectedCourse?.lecturer_name ?? courseDraft.lecturerId}</option
							>{/if}{#if lecturersIssue && !lecturers.length}<option value="" disabled
								>{lecturersIssue}</option
							>{/if}{#each lecturers as item (item.id)}<option value={item.id}>{item.name}</option
							>{/each}</select
					>{#if courseDraft.lecturerId}<span
							role="button"
							tabindex="0"
							class="editor-entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity('lecturers', courseDraft.lecturerId);
							}}>Lihat dosen</span
						>{/if}</label
				>
				{#if courseEditorBlocked}<p class="editor-note">
						Program studi dan dosen harus tersedia sebelum mata kuliah bisa disimpan.
					</p>{/if}
				<div class="editor-submit">
					<Button type="submit" class="primary-button" disabled={courseEditorBlocked}
						>{selectedCourseId ? 'Simpan perubahan' : 'Tambah mata kuliah'}</Button
					>
				</div>
			</form>
		{:else if editorView === 'courses-bulk'}
			<form class="editor-grid" {...bulkUpdateCoursesEnhance}>
				<p class="editor-note">
					Ubah SKS, prodi, dan dosen {bulkCount} mata kuliah terpilih sekaligus. Kosongkan field yang
					tidak ingin diubah.
				</p>
				<input type="hidden" name="ids" value={[...bulkSelectedIds].join(',')} />
				<label
					><span>SKS</span><input
						type="number"
						name="credits"
						min="1"
						max="6"
						bind:value={bulkEditCourseCredits}
					/></label
				>
				<label
					><span>Program studi</span><select
						name="studyProgramId"
						bind:value={bulkEditCourseStudyProgramId}
						><option value="">Pilih program studi</option
						>{#each studyPrograms as item (item.id)}<option value={item.id}>{item.name}</option
							>{/each}</select
					>{#if bulkEditCourseStudyProgramId}<span
							role="button"
							tabindex="0"
							class="editor-entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity('studyPrograms', bulkEditCourseStudyProgramId);
							}}>Lihat prodi</span
						>{/if}</label
				>
				<label
					><span>Dosen pengampu</span><select
						name="lecturerId"
						bind:value={bulkEditCourseLecturerId}
						><option value="">Pilih dosen</option>{#each lecturers as item (item.id)}<option
								value={item.id}>{item.name}</option
							>{/each}</select
					>{#if bulkEditCourseLecturerId}<span
							role="button"
							tabindex="0"
							class="editor-entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity('lecturers', bulkEditCourseLecturerId);
							}}>Lihat dosen</span
						>{/if}</label
				>
				<div class="builder-inline-actions">
					<Button
						type="button"
						variant="ghost"
						class="ghost-button"
						onclick={() => {
							onBulkClear();
							onStopEditing();
						}}>Batal</Button
					>
					<Button type="submit" class="primary-button" disabled={false}
						>Simpan perubahan {bulkCount} mata kuliah</Button
					>
				</div>
			</form>
		{:else}
			<p class="empty-copy">
				Pilih satu mata kuliah untuk melihat detail, atau tambahkan mata kuliah baru saat katalog
				berubah.
			</p>
		{/if}
	</section>
</div>
