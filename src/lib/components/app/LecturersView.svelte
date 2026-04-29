<script lang="ts">
	import type { AppRole } from '$lib/app/academic';
	import type { ViewId } from '$lib/app/navigation';
	import type { SelectLecturersResult } from '$lib/server/sql';
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
			email: FieldAccessor;
			phone: FieldAccessor;
			address: FieldAccessor;
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
		lecturerSearch = $bindable(''),
		filteredLecturers,
		selectedLecturerId,
		selectedLecturer,
		bulkSelectedIds,
		bulkCount,
		lecturerDraft = $bindable({ id: '', name: '', email: '', phone: '', address: '' }),
		bulkEditLecturerName = $bindable(''),
		bulkEditLecturerEmail = $bindable(''),
		bulkEditLecturerPhone = $bindable(''),
		bulkEditLecturerAddress = $bindable(''),
		editorView,
		pendingDelete,
		collectionPagination,
		createLecturer,
		updateLecturer,
		bulkUpdateLecturers,
		createLecturerEnhance,
		updateLecturerEnhance,
		bulkUpdateLecturersEnhance,
		onSearchInput,
		onClearSearch,
		onBeginCreate,
		onBulkClear,
		onOpenBulkEdit,
		onOpenBulkDelete,
		onBulkToggleAll,
		onBulkToggleId,
		onPickLecturer,
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
		lecturerSearch: string;
		filteredLecturers: SelectLecturersResult[];
		selectedLecturerId: string | null;
		selectedLecturer: SelectLecturersResult | null;
		bulkSelectedIds: Set<string>;
		bulkCount: number;
		lecturerDraft: { id: string; name: string; email: string; phone: string; address: string };
		bulkEditLecturerName: string;
		bulkEditLecturerEmail: string;
		bulkEditLecturerPhone: string;
		bulkEditLecturerAddress: string;
		editorView: string | null;
		pendingDelete: PendingDelete;
		collectionPagination: PaginationState;
		createLecturer: unknown;
		updateLecturer: unknown;
		bulkUpdateLecturers: unknown;
		createLecturerEnhance: EnhancedAction;
		updateLecturerEnhance: EnhancedAction;
		bulkUpdateLecturersEnhance: EnhancedAction;
		onSearchInput: () => void;
		onClearSearch: () => void;
		onBeginCreate: () => void;
		onBulkClear: () => void;
		onOpenBulkEdit: () => void;
		onOpenBulkDelete: () => void;
		onBulkToggleAll: (ids: string[]) => void;
		onBulkToggleId: (id: string) => void;
		onPickLecturer: (item: SelectLecturersResult) => void;
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

	function createLecturerForm() {
		return createLecturer as FormState;
	}

	function updateLecturerForm() {
		return updateLecturer as FormState;
	}

	function bulkUpdateLecturersForm() {
		return bulkUpdateLecturers as FormState;
	}
</script>

<div class="workspace-shell">
	<section class="workspace-list">
		<div class="pane-head">
			<div>
				<h3>Daftar dosen</h3>
			</div>
			{#if currentRole === 'ADMIN'}
				<Button variant="ghost" size="sm" class="ghost-button" onclick={onBeginCreate}
					>Tambah</Button
				>
			{/if}
		</div>
		<label class="search-box"
			><Search size={16} /><input
				bind:value={lecturerSearch}
				oninput={onSearchInput}
				aria-label="Cari data dosen"
				placeholder="Cari ID dosen, nama, atau email"
			/>{#if lecturerSearch}<button type="button" class="search-clear" onclick={onClearSearch}
					><X size={14} /></button
				>{/if}</label
		>
		{#if bulkCount > 0}
			<div class="bulk-bar">
				<span class="bulk-count">{bulkCount} dosen dipilih</span>
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
			{#if filteredLecturers.length > 1}
				<label class="list-row select-all-row">
					<input
						type="checkbox"
						checked={bulkCount === filteredLecturers.length && filteredLecturers.length > 0}
						onchange={() =>
							onBulkToggleAll(filteredLecturers.map((i) => i.id).filter(Boolean) as string[])}
					/>
					<span>Pilih semua ({filteredLecturers.length})</span>
				</label>
			{/if}
			{#each filteredLecturers as item (item.id)}
				<div
					class="list-row user-row"
					class:selected={selectedLecturerId === item.id}
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
						onclick={() => onPickLecturer(item)}
					>
						<div>
							<span
								role="button"
								tabindex="0"
								class="entity-link"
								onkeydown={handleKeyboardClick}
								onclick={(e) => {
									e.stopPropagation();
									onNavigateToEntity('lecturers', item.id, item.name ?? undefined);
								}}><strong>{item.name}</strong></span
							><span>{item.id} • {item.email}</span>
						</div>
						<small>{item.email}</small>
					</div>
				</div>
			{/each}
		</div>
		<CollectionPagination
			label="dosen"
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
					{editorView === 'lecturers-bulk'
						? 'Ubah massal dosen'
						: selectedLecturer
							? selectedLecturer.name
							: 'Tambah dosen'}
				</h3>
			</div>
			{#if currentRole === 'ADMIN'}
				<div class="detail-actions">
					{#if editorView === 'lecturers'}
						<Button variant="ghost" size="sm" class="ghost-button" onclick={onStopEditing}
							>Tutup form</Button
						>
					{:else if selectedLecturer}
						<Button variant="ghost" size="sm" class="ghost-button" onclick={onBeginEdit}
							>Edit</Button
						>
					{/if}
					{#if selectedLecturerId}
						<Button variant="destructive" size="sm" class="danger-button" onclick={onRequestDelete}
							>Hapus</Button
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
					<Button class="danger-button" variant="destructive" size="sm" onclick={onConfirmDelete}
						>{pendingDelete.confirmLabel}</Button
					>
					<Button class="ghost-button" variant="ghost" size="sm" onclick={onCancelDelete}
						>Batal</Button
					>
				</div>
			</section>
		{/if}
		{#if selectedLecturer && editorView !== 'lecturers' && editorView !== 'lecturers-bulk'}
			<div class="detail-stack">
				<div class="detail-lines">
					<div><span>ID dosen</span><strong>{selectedLecturer.id}</strong></div>
					<div><span>Email</span><strong>{selectedLecturer.email}</strong></div>
					<div><span>Telepon</span><strong>{selectedLecturer.phone || '-'}</strong></div>
					<div><span>Alamat</span><strong>{selectedLecturer.address || '-'}</strong></div>
					<div>
						<span>Jadwal aktif</span><strong>{selectedLecturer.schedule_count ?? 0}</strong>
					</div>
				</div>
				<p class="detail-hint">
					Mode tinjau membantu Anda membaca konteks dosen sebelum membuka form edit.
				</p>
			</div>
		{:else if currentRole === 'ADMIN' && editorView === 'lecturers'}
			<form
				class="editor-grid"
				{...selectedLecturerId ? updateLecturerEnhance : createLecturerEnhance}
			>
				{#if selectedLecturerId}
					<input
						type="hidden"
						{...updateLecturerForm().fields.id!.as('text')}
						value={lecturerDraft.id}
					/>
				{:else}
					<p class="editor-note">ID dosen dibuat otomatis saat data disimpan.</p>
				{/if}
				<label
					><span>Nama</span><input
						{...selectedLecturerId
							? updateLecturerForm().fields.name.as('text')
							: createLecturerForm().fields.name.as('text')}
						bind:value={lecturerDraft.name}
					/></label
				>
				<label
					><span>Email</span><input
						{...selectedLecturerId
							? updateLecturerForm().fields.email.as('email')
							: createLecturerForm().fields.email.as('email')}
						bind:value={lecturerDraft.email}
					/></label
				>
				<label
					><span>Telepon</span><input
						{...selectedLecturerId
							? updateLecturerForm().fields.phone.as('text')
							: createLecturerForm().fields.phone.as('text')}
						bind:value={lecturerDraft.phone}
					/></label
				>
				<label
					><span>Alamat</span><input
						{...selectedLecturerId
							? updateLecturerForm().fields.address.as('text')
							: createLecturerForm().fields.address.as('text')}
						bind:value={lecturerDraft.address}
					/></label
				>
				<div class="editor-submit">
					<Button type="submit" class="primary-button"
						>{selectedLecturerId ? 'Simpan perubahan' : 'Tambah dosen'}</Button
					>
				</div>
			</form>
		{:else if editorView === 'lecturers-bulk'}
			<form class="editor-grid" {...bulkUpdateLecturersEnhance}>
				<p class="editor-note">
					Ubah data {bulkCount} dosen terpilih sekaligus. Kosongkan field yang tidak ingin diubah.
				</p>
				<input type="hidden" name="ids" value={[...bulkSelectedIds].join(',')} />
				<label
					><span>Nama</span><input
						type="text"
						name="name"
						bind:value={bulkEditLecturerName}
					/></label
				>
				<label
					><span>Email</span><input
						type="email"
						name="email"
						bind:value={bulkEditLecturerEmail}
					/></label
				>
				<label
					><span>Telepon</span><input
						type="text"
						name="phone"
						bind:value={bulkEditLecturerPhone}
					/></label
				>
				<label
					><span>Alamat</span><input
						type="text"
						name="address"
						bind:value={bulkEditLecturerAddress}
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
						disabled={(bulkUpdateLecturersForm().pending ?? 0) > 0}
						>Simpan perubahan {bulkCount} dosen</Button
					>
				</div>
			</form>
		{:else}
			<p class="empty-copy">
				Pilih satu dosen untuk melihat detail, atau tambahkan dosen baru saat data pengampu berubah.
			</p>
		{/if}
	</section>
</div>
