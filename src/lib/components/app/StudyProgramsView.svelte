<script lang="ts">
	import type { AppRole } from '$lib/app/academic';
	import type { ViewId } from '$lib/app/navigation';
	import type { SelectFacultiesResult, SelectStudyProgramsResult } from '$lib/server/sql';
	import CollectionPagination from '$lib/components/app/CollectionPagination.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Search, X } from '@lucide/svelte';
	import './crud-view.css';

	type FieldAccessor = {
		as: (...args: unknown[]) => Record<string, unknown>;
	};

	type FormState = {
		fields: {
			id?: FieldAccessor;
			name: FieldAccessor;
			head: FieldAccessor;
			facultyId: FieldAccessor;
		};
		pending?: number;
	};

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
		studyProgramSearch = $bindable(''),
		filteredStudyPrograms,
		selectedStudyProgramId,
		selectedStudyProgram,
		bulkSelectedIds,
		bulkCount,
		studyProgramDraft = $bindable({ id: '', name: '', head: '', facultyId: '' }),
		bulkEditStudyProgramFacultyId = $bindable(''),
		bulkEditStudyProgramHead = $bindable(''),
		editorView,
		pendingDelete,
		collectionPagination,
		createStudyProgram,
		updateStudyProgram,
		bulkUpdateStudyPrograms,
		createStudyProgramEnhance,
		updateStudyProgramEnhance,
		bulkUpdateStudyProgramsEnhance,
		faculties,
		facultiesIssue,
		studyProgramEditorBlocked,
		onSearchInput,
		onClearSearch,
		onBeginCreate,
		onBulkClear,
		onOpenBulkEdit,
		onOpenBulkDelete,
		onBulkToggleAll,
		onBulkToggleId,
		onPickStudyProgram,
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
		studyProgramSearch: string;
		filteredStudyPrograms: SelectStudyProgramsResult[];
		selectedStudyProgramId: string | null;
		selectedStudyProgram: SelectStudyProgramsResult | null;
		bulkSelectedIds: Set<string>;
		bulkCount: number;
		studyProgramDraft: { id: string; name: string; head: string; facultyId: string };
		bulkEditStudyProgramFacultyId: string;
		bulkEditStudyProgramHead: string;
		editorView: string | null;
		pendingDelete: PendingDelete;
		collectionPagination: PaginationState;
		createStudyProgram: unknown;
		updateStudyProgram: unknown;
		bulkUpdateStudyPrograms: unknown;
		createStudyProgramEnhance: EnhancedAction;
		updateStudyProgramEnhance: EnhancedAction;
		bulkUpdateStudyProgramsEnhance: EnhancedAction;
		faculties: SelectFacultiesResult[];
		facultiesIssue: string | undefined;
		studyProgramEditorBlocked: boolean;
		onSearchInput: () => void;
		onClearSearch: () => void;
		onBeginCreate: () => void;
		onBulkClear: () => void;
		onOpenBulkEdit: () => void;
		onOpenBulkDelete: () => void;
		onBulkToggleAll: (ids: string[]) => void;
		onBulkToggleId: (id: string) => void;
		onPickStudyProgram: (item: SelectStudyProgramsResult) => void;
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

	function createStudyProgramForm() {
		return createStudyProgram as FormState;
	}

	function updateStudyProgramForm() {
		return updateStudyProgram as FormState;
	}

	function bulkUpdateStudyProgramsForm() {
		return bulkUpdateStudyPrograms as FormState;
	}
</script>

<div class="workspace-shell">
	<section class="workspace-list">
		<div class="pane-head">
			<div>
				<h3>Daftar program studi</h3>
			</div>
			<Button variant="ghost" size="sm" class="ghost-button" onclick={onBeginCreate}>Tambah</Button>
		</div>
		<label class="search-box"
			><Search size={16} /><input
				bind:value={studyProgramSearch}
				oninput={onSearchInput}
				aria-label="Cari data program studi"
				placeholder="Cari kode, nama, atau fakultas"
			/>{#if studyProgramSearch}<button type="button" class="search-clear" onclick={onClearSearch}
					><X size={14} /></button
				>{/if}</label
		>
		{#if bulkCount > 0}
			<div class="bulk-bar">
				<span class="bulk-count">{bulkCount} prodi dipilih</span>
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
			{#if filteredStudyPrograms.length > 1}
				<label class="list-row select-all-row">
					<input
						type="checkbox"
						checked={bulkCount === filteredStudyPrograms.length && filteredStudyPrograms.length > 0}
						onchange={() =>
							onBulkToggleAll(filteredStudyPrograms.map((i) => i.id).filter(Boolean) as string[])}
					/>
					<span>Pilih semua ({filteredStudyPrograms.length})</span>
				</label>
			{/if}
			{#each filteredStudyPrograms as item (item.id)}
				<div
					class="list-row user-row"
					class:selected={selectedStudyProgramId === item.id}
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
						onclick={() => onPickStudyProgram(item)}
					>
						<div>
							<span
								role="button"
								tabindex="0"
								class="entity-link"
								onkeydown={handleKeyboardClick}
								onclick={(e) => {
									e.stopPropagation();
									onNavigateToEntity('studyPrograms', item.id, item.name ?? undefined);
								}}><strong>{item.name}</strong></span
							>
							<span
								>{item.id} •
								<span
									role="button"
									tabindex="0"
									class="entity-link"
									onkeydown={handleKeyboardClick}
									onclick={(e) => {
										e.stopPropagation();
										onNavigateToEntity(
											'faculties',
											item.faculty_id,
											item.faculty_name ?? undefined
										);
									}}>{item.faculty_name}</span
								></span
							>
						</div>
						<small>{item.head ?? item.faculty_name}</small>
					</div>
				</div>
			{/each}
		</div>
		<CollectionPagination
			label="program studi"
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
					{editorView === 'studyPrograms-bulk'
						? 'Ubah massal program studi'
						: selectedStudyProgram
							? selectedStudyProgram.name
							: 'Tambah program studi'}
				</h3>
			</div>
			{#if currentRole === 'ADMIN'}
				<div class="detail-actions">
					{#if editorView === 'studyPrograms'}
						<Button variant="ghost" size="sm" class="ghost-button" onclick={onStopEditing}
							>Tutup form</Button
						>
					{:else if selectedStudyProgram}
						<Button variant="ghost" size="sm" class="ghost-button" onclick={onBeginEdit}
							>Edit</Button
						>
					{/if}
					{#if selectedStudyProgramId}
						<Button variant="destructive" size="sm" class="danger-button" onclick={onRequestDelete}
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
					<Button class="danger-button" variant="destructive" size="sm" onclick={onConfirmDelete}
						>{pendingDelete.confirmLabel}</Button
					>
					<Button class="ghost-button" variant="ghost" size="sm" onclick={onCancelDelete}
						>Batal</Button
					>
				</div>
			</section>
		{/if}
		{#if selectedStudyProgram && editorView !== 'studyPrograms' && editorView !== 'studyPrograms-bulk'}
			<div class="detail-stack">
				<div class="detail-lines">
					<div><span>ID prodi</span><strong>{selectedStudyProgram.id}</strong></div>
					<div><span>Ketua program</span><strong>{selectedStudyProgram.head}</strong></div>
					<div>
						<span>Fakultas</span><span
							role="button"
							tabindex="0"
							class="entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity(
									'faculties',
									selectedStudyProgram.faculty_id,
									selectedStudyProgram.faculty_name ?? undefined
								);
							}}><strong>{selectedStudyProgram.faculty_name}</strong></span
						>
					</div>
					<div>
						<span>Mahasiswa</span><strong>{selectedStudyProgram.student_count ?? 0}</strong>
					</div>
				</div>
				<p class="detail-hint">
					Gunakan mode tinjau agar struktur prodi tetap mudah dibaca sebelum proses edit dimulai.
				</p>
			</div>
		{:else if currentRole === 'ADMIN' && editorView === 'studyPrograms'}
			<form
				class="editor-grid"
				{...selectedStudyProgramId ? updateStudyProgramEnhance : createStudyProgramEnhance}
			>
				{#if selectedStudyProgramId}
					<input
						type="hidden"
						{...updateStudyProgramForm().fields.id!.as('text')}
						value={studyProgramDraft.id}
					/>
				{:else}
					<p class="editor-note">ID program studi dibuat otomatis saat data disimpan.</p>
				{/if}
				<label
					><span>Nama prodi</span><input
						{...selectedStudyProgramId
							? updateStudyProgramForm().fields.name.as('text')
							: createStudyProgramForm().fields.name.as('text')}
						bind:value={studyProgramDraft.name}
					/></label
				>
				<label
					><span>Ketua prodi</span><input
						{...selectedStudyProgramId
							? updateStudyProgramForm().fields.head.as('text')
							: createStudyProgramForm().fields.head.as('text')}
						bind:value={studyProgramDraft.head}
					/></label
				>
				<label
					><span>Fakultas</span><select
						{...selectedStudyProgramId
							? updateStudyProgramForm().fields.facultyId.as('select')
							: createStudyProgramForm().fields.facultyId.as('select')}
						bind:value={studyProgramDraft.facultyId}
						><option value="">Pilih fakultas</option
						>{#if facultiesIssue && !faculties.length}<option value="" disabled
								>{facultiesIssue}</option
							>{/if}{#each faculties as item (item.id)}<option value={item.id}>{item.name}</option
							>{/each}</select
					>{#if studyProgramDraft.facultyId}<span
							role="button"
							tabindex="0"
							class="editor-entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity('faculties', studyProgramDraft.facultyId);
							}}>Lihat fakultas</span
						>{/if}</label
				>
				{#if studyProgramEditorBlocked}<p class="editor-note">
						Fakultas harus tersedia sebelum program studi bisa disimpan.
					</p>{/if}
				<div class="editor-submit">
					<Button type="submit" class="primary-button" disabled={studyProgramEditorBlocked}
						>{selectedStudyProgramId ? 'Simpan perubahan' : 'Tambah program studi'}</Button
					>
				</div>
			</form>
		{:else if editorView === 'studyPrograms-bulk'}
			<form class="editor-grid" {...bulkUpdateStudyProgramsEnhance}>
				<p class="editor-note">
					Ubah fakultas dan ketua prodi {bulkCount} prodi terpilih sekaligus. Kosongkan field yang tidak
					ingin diubah.
				</p>
				<input type="hidden" name="ids" value={[...bulkSelectedIds].join(',')} />
				<label
					><span>Fakultas</span><select name="facultyId" bind:value={bulkEditStudyProgramFacultyId}
						><option value="">Pilih fakultas</option>{#each faculties as item (item.id)}<option
								value={item.id}>{item.name}</option
							>{/each}</select
					>{#if bulkEditStudyProgramFacultyId}<span
							role="button"
							tabindex="0"
							class="editor-entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity('faculties', bulkEditStudyProgramFacultyId);
							}}>Lihat fakultas</span
						>{/if}</label
				>
				<label
					><span>Ketua prodi</span><input
						type="text"
						name="head"
						bind:value={bulkEditStudyProgramHead}
					/></label
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
					<Button
						type="submit"
						class="primary-button"
						disabled={(bulkUpdateStudyProgramsForm().pending ?? 0) > 0}
						>Simpan perubahan {bulkCount} prodi</Button
					>
				</div>
			</form>
		{:else}
			<p class="empty-copy">
				Pilih satu program studi untuk melihat detail, atau tambahkan program studi baru saat
				struktur akademik berubah.
			</p>
		{/if}
	</section>
</div>
