<script lang="ts">
	import type { AppRole } from '$lib/app/academic';
	import type { ViewId } from '$lib/app/navigation';
	import type { SelectFacultiesResult } from '$lib/server/sql';
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
		facultySearch = $bindable(''),
		filteredFaculties,
		selectedFacultyId,
		selectedFaculty,
		bulkSelectedIds,
		bulkCount,
		facultyDraft = $bindable({ id: '', name: '' }),
		bulkEditFacultyName = $bindable(''),
		editorView,
		pendingDelete,
		collectionPagination,
		createFaculty,
		updateFaculty,
		bulkUpdateFaculties,
		createFacultyEnhance,
		updateFacultyEnhance,
		bulkUpdateFacultiesEnhance,
		onSearchInput,
		onClearSearch,
		onBeginCreate,
		onBulkClear,
		onOpenBulkEdit,
		onOpenBulkDelete,
		onBulkToggleAll,
		onBulkToggleId,
		onPickFaculty,
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
		facultySearch: string;
		filteredFaculties: SelectFacultiesResult[];
		selectedFacultyId: string | null;
		selectedFaculty: SelectFacultiesResult | null;
		bulkSelectedIds: Set<string>;
		bulkCount: number;
		facultyDraft: { id: string; name: string };
		bulkEditFacultyName: string;
		editorView: string | null;
		pendingDelete: PendingDelete;
		collectionPagination: PaginationState;
		createFaculty: unknown;
		updateFaculty: unknown;
		bulkUpdateFaculties: unknown;
		createFacultyEnhance: EnhancedAction;
		updateFacultyEnhance: EnhancedAction;
		bulkUpdateFacultiesEnhance: EnhancedAction;
		onSearchInput: () => void;
		onClearSearch: () => void;
		onBeginCreate: () => void;
		onBulkClear: () => void;
		onOpenBulkEdit: () => void;
		onOpenBulkDelete: () => void;
		onBulkToggleAll: (ids: string[]) => void;
		onBulkToggleId: (id: string) => void;
		onPickFaculty: (item: SelectFacultiesResult) => void;
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

	function createFacultyForm() {
		return createFaculty as FormState;
	}

	function updateFacultyForm() {
		return updateFaculty as FormState;
	}

	function bulkUpdateFacultiesForm() {
		return bulkUpdateFaculties as FormState;
	}
</script>

<div class="workspace-shell">
	<section class="workspace-list">
		<div class="pane-head">
			<div>
				<h3>Daftar fakultas</h3>
			</div>
			<Button variant="ghost" size="sm" class="ghost-button" onclick={onBeginCreate}>Tambah</Button>
		</div>
		<label class="search-box"
			><Search size={16} /><input
				bind:value={facultySearch}
				oninput={onSearchInput}
				aria-label="Cari data fakultas"
				placeholder="Cari kode atau nama fakultas"
			/>{#if facultySearch}<button type="button" class="search-clear" onclick={onClearSearch}
					><X size={14} /></button
				>{/if}</label
		>
		{#if bulkCount > 0}
			<div class="bulk-bar">
				<span class="bulk-count">{bulkCount} fakultas dipilih</span>
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
			{#if filteredFaculties.length > 1}
				<label class="list-row select-all-row">
					<input
						type="checkbox"
						checked={bulkCount === filteredFaculties.length && filteredFaculties.length > 0}
						onchange={() =>
							onBulkToggleAll(filteredFaculties.map((i) => i.id).filter(Boolean) as string[])}
					/>
					<span>Pilih semua ({filteredFaculties.length})</span>
				</label>
			{/if}
			{#each filteredFaculties as item (item.id)}
				<div
					class="list-row user-row"
					class:selected={selectedFacultyId === item.id}
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
						onclick={() => onPickFaculty(item)}
					>
						<div>
							<span
								role="button"
								tabindex="0"
								class="entity-link"
								onkeydown={handleKeyboardClick}
								onclick={(e) => {
									e.stopPropagation();
									onNavigateToEntity('faculties', item.id, item.name ?? undefined);
								}}><strong>{item.name}</strong></span
							><span>{item.id}</span>
						</div>
						<small>{item.id}</small>
					</div>
				</div>
			{/each}
		</div>
		<CollectionPagination
			label="fakultas"
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
					{editorView === 'faculties-bulk'
						? 'Ubah massal fakultas'
						: selectedFaculty
							? selectedFaculty.name
							: 'Tambah fakultas'}
				</h3>
			</div>
			{#if currentRole === 'ADMIN'}
				<div class="detail-actions">
					{#if editorView === 'faculties'}
						<Button variant="ghost" size="sm" class="ghost-button" onclick={onStopEditing}
							>Tutup form</Button
						>
					{:else if selectedFaculty}
						<Button variant="ghost" size="sm" class="ghost-button" onclick={onBeginEdit}
							>Edit</Button
						>
					{/if}
					{#if selectedFacultyId}
						<Button variant="destructive" size="sm" class="danger-button" onclick={onRequestDelete}
							>Hapus</Button
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
					<Button class="danger-button" variant="destructive" size="sm" onclick={onConfirmDelete}
						>{pendingDelete.confirmLabel}</Button
					>
					<Button class="ghost-button" variant="ghost" size="sm" onclick={onCancelDelete}
						>Batal</Button
					>
				</div>
			</section>
		{/if}
		{#if selectedFaculty && editorView !== 'faculties' && editorView !== 'faculties-bulk'}
			<div class="detail-stack">
				<div class="detail-lines">
					<div><span>Kode</span><strong>{selectedFaculty.id}</strong></div>
					<div>
						<span>Program studi</span><strong>{selectedFaculty.study_program_count ?? 0}</strong>
					</div>
				</div>
				<p class="detail-hint">
					Tinjau ringkasan struktur lebih dulu. Buka form edit hanya untuk perubahan yang memang
					diperlukan.
				</p>
			</div>
		{:else if currentRole === 'ADMIN' && editorView === 'faculties'}
			<form
				class="editor-grid"
				{...selectedFacultyId ? updateFacultyEnhance : createFacultyEnhance}
			>
				{#if selectedFacultyId}
					<input
						type="hidden"
						{...updateFacultyForm().fields.id!.as('text')}
						value={facultyDraft.id}
					/>
				{:else}
					<p class="editor-note">ID fakultas dibuat otomatis saat data disimpan.</p>
				{/if}
				<label
					><span>Nama fakultas</span><input
						{...selectedFacultyId
							? updateFacultyForm().fields.name.as('text')
							: createFacultyForm().fields.name.as('text')}
						bind:value={facultyDraft.name}
					/></label
				>
				<div class="editor-submit">
					<Button type="submit" class="primary-button"
						>{selectedFacultyId ? 'Simpan perubahan' : 'Tambah fakultas'}</Button
					>
				</div>
			</form>
		{:else if editorView === 'faculties-bulk'}
			<form class="editor-grid" {...bulkUpdateFacultiesEnhance}>
				<p class="editor-note">
					Ubah nama {bulkCount} fakultas terpilih sekaligus. Kosongkan field yang tidak ingin diubah.
				</p>
				<input type="hidden" name="ids" value={[...bulkSelectedIds].join(',')} />
				<label
					><span>Nama fakultas</span><input
						type="text"
						name="name"
						bind:value={bulkEditFacultyName}
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
						disabled={(bulkUpdateFacultiesForm().pending ?? 0) > 0}
						>Simpan perubahan {bulkCount} fakultas</Button
					>
				</div>
			</form>
		{:else}
			<p class="empty-copy">
				Pilih satu fakultas untuk melihat detail, atau tambahkan fakultas baru saat struktur
				berubah.
			</p>
		{/if}
	</section>
</div>
