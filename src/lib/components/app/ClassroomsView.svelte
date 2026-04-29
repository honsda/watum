<script lang="ts">
	import type { AppRole } from '$lib/app/academic';
	import type { ViewId } from '$lib/app/navigation';
	import type { SelectClassRoomsResult } from '$lib/server/sql';
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
			classRoomType: FieldAccessor;
			capacity: FieldAccessor;
			hasProjector: FieldAccessor;
			hasAC: FieldAccessor;
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
		roomSearch = $bindable(''),
		filteredClassrooms,
		selectedRoomId,
		selectedRoom,
		bulkSelectedIds,
		bulkCount,
		classroomDraft = $bindable({
			name: '',
			classRoomType: 'REGULER',
			capacity: 30,
			hasProjector: true,
			hasAC: true
		}),
		bulkEditClassRoomType = $bindable('REGULER'),
		bulkEditClassRoomCapacity = $bindable(30),
		bulkEditClassRoomHasProjector = $bindable(false),
		bulkEditClassRoomHasAC = $bindable(false),
		editorView,
		pendingDelete,
		collectionPagination,
		createClassRoom,
		updateClassRoom,
		bulkUpdateClassRooms,
		createClassRoomEnhance,
		updateClassRoomEnhance,
		bulkUpdateClassRoomsEnhance,
		classRoomTypes,
		beautifyRoomType,
		onSearchInput,
		onClearSearch,
		onBeginCreate,
		onBulkClear,
		onOpenBulkEdit,
		onOpenBulkDelete,
		onBulkToggleAll,
		onBulkToggleId,
		onPickClassroom,
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
		roomSearch: string;
		filteredClassrooms: SelectClassRoomsResult[];
		selectedRoomId: string | null;
		selectedRoom: SelectClassRoomsResult | null;
		bulkSelectedIds: Set<string>;
		bulkCount: number;
		classroomDraft: {
			name: string;
			classRoomType: string;
			capacity: number;
			hasProjector: boolean;
			hasAC: boolean;
		};
		bulkEditClassRoomType: string;
		bulkEditClassRoomCapacity: number;
		bulkEditClassRoomHasProjector: boolean;
		bulkEditClassRoomHasAC: boolean;
		editorView: string | null;
		pendingDelete: PendingDelete;
		collectionPagination: PaginationState;
		createClassRoom: unknown;
		updateClassRoom: unknown;
		bulkUpdateClassRooms: unknown;
		createClassRoomEnhance: EnhancedAction;
		updateClassRoomEnhance: EnhancedAction;
		bulkUpdateClassRoomsEnhance: EnhancedAction;
		classRoomTypes: ReadonlyArray<string>;
		beautifyRoomType: (value: string | null | undefined) => string;
		onSearchInput: () => void;
		onClearSearch: () => void;
		onBeginCreate: () => void;
		onBulkClear: () => void;
		onOpenBulkEdit: () => void;
		onOpenBulkDelete: () => void;
		onBulkToggleAll: (ids: string[]) => void;
		onBulkToggleId: (id: string) => void;
		onPickClassroom: (item: SelectClassRoomsResult) => void;
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

	function createClassRoomForm() {
		return createClassRoom as FormState;
	}

	function updateClassRoomForm() {
		return updateClassRoom as FormState;
	}

	function bulkUpdateClassRoomsForm() {
		return bulkUpdateClassRooms as FormState;
	}
</script>

<div class="workspace-shell">
	<section class="workspace-list">
		<div class="pane-head">
			<div>
				<h3>Daftar ruang</h3>
			</div>
			<Button variant="ghost" size="sm" class="ghost-button" onclick={onBeginCreate}>Tambah</Button>
		</div>
		<label class="search-box"
			><Search size={16} /><input
				bind:value={roomSearch}
				oninput={onSearchInput}
				aria-label="Cari ruang"
				placeholder="Cari nama ruang atau jenis ruang"
			/>{#if roomSearch}<button type="button" class="search-clear" onclick={onClearSearch}
					><X size={14} /></button
				>{/if}</label
		>
		{#if bulkCount > 0}
			<div class="bulk-bar">
				<span class="bulk-count">{bulkCount} ruang dipilih</span>
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
			{#if filteredClassrooms.length > 1}
				<label class="list-row select-all-row">
					<input
						type="checkbox"
						checked={bulkCount === filteredClassrooms.length && filteredClassrooms.length > 0}
						onchange={() =>
							onBulkToggleAll(filteredClassrooms.map((i) => i.id).filter(Boolean) as string[])}
					/>
					<span>Pilih semua ({filteredClassrooms.length})</span>
				</label>
			{/if}
			{#each filteredClassrooms as item (item.id)}
				<div
					class="list-row user-row"
					class:selected={selectedRoomId === item.id}
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
						onclick={() => onPickClassroom(item)}
					>
						<div>
							<span
								role="button"
								tabindex="0"
								class="entity-link"
								onkeydown={handleKeyboardClick}
								onclick={(e) => {
									e.stopPropagation();
									onNavigateToEntity('classrooms', item.id, item.name ?? undefined);
								}}><strong>{item.name}</strong></span
							><span>{beautifyRoomType(item.class_room_type)} • kapasitas {item.capacity}</span>
						</div>
						<small>{beautifyRoomType(item.class_room_type)}</small>
					</div>
				</div>
			{/each}
		</div>
		<CollectionPagination
			label="ruang"
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
					{editorView === 'classrooms-bulk'
						? 'Ubah massal ruang'
						: selectedRoom
							? selectedRoom.name
							: 'Tambah ruang'}
				</h3>
			</div>
			{#if currentRole === 'ADMIN'}
				<div class="detail-actions">
					{#if editorView === 'classrooms'}
						<Button variant="ghost" size="sm" class="ghost-button" onclick={onStopEditing}
							>Tutup form</Button
						>
					{:else if selectedRoom}
						<Button variant="ghost" size="sm" class="ghost-button" onclick={onBeginEdit}
							>Edit</Button
						>
					{/if}
					{#if selectedRoomId}
						<Button variant="destructive" size="sm" class="danger-button" onclick={onRequestDelete}
							>Hapus</Button
						>
					{/if}
				</div>
			{/if}
		</div>
		{#if pendingDelete?.kind === 'classroom' && pendingDelete.id === selectedRoomId}
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
		{#if selectedRoom && editorView !== 'classrooms' && editorView !== 'classrooms-bulk'}
			<div class="detail-stack">
				<div class="detail-lines">
					<div>
						<span>Tipe</span><strong>{beautifyRoomType(selectedRoom.class_room_type)}</strong>
					</div>
					<div><span>Kapasitas</span><strong>{selectedRoom.capacity}</strong></div>
					<div>
						<span>Projector</span><strong>{selectedRoom.has_projector ? 'Ya' : 'Tidak'}</strong>
					</div>
					<div><span>AC</span><strong>{selectedRoom.has_ac ? 'Ya' : 'Tidak'}</strong></div>
				</div>
				<p class="detail-hint">
					Tinjau ringkasan ruang lebih dulu. Buka form edit hanya saat data perlu diubah.
				</p>
			</div>
		{:else if currentRole === 'ADMIN' && editorView === 'classrooms'}
			<form
				class="editor-grid"
				{...selectedRoomId ? updateClassRoomEnhance : createClassRoomEnhance}
			>
				{#if selectedRoomId}
					<input
						type="hidden"
						{...updateClassRoomForm().fields.id!.as('text')}
						value={selectedRoomId}
					/>
				{/if}
				<label
					><span>Nama ruang</span><input
						{...selectedRoomId
							? updateClassRoomForm().fields.name.as('text')
							: createClassRoomForm().fields.name.as('text')}
						bind:value={classroomDraft.name}
					/></label
				>
				<label
					><span>Tipe ruang</span><select
						{...selectedRoomId
							? updateClassRoomForm().fields.classRoomType.as('select')
							: createClassRoomForm().fields.classRoomType.as('select')}
						bind:value={classroomDraft.classRoomType}
						>{#each classRoomTypes as type (type)}<option value={type}
								>{beautifyRoomType(type)}</option
							>{/each}</select
					></label
				>
				<label
					><span>Kapasitas</span><input
						min="1"
						{...selectedRoomId
							? updateClassRoomForm().fields.capacity.as('number')
							: createClassRoomForm().fields.capacity.as('number')}
						bind:value={classroomDraft.capacity}
					/></label
				>
				<label class="check-row"
					><input
						{...selectedRoomId
							? updateClassRoomForm().fields.hasProjector.as('checkbox')
							: createClassRoomForm().fields.hasProjector.as('checkbox')}
						checked={classroomDraft.hasProjector}
						onchange={(event) =>
							(classroomDraft.hasProjector = (event.currentTarget as HTMLInputElement).checked)}
					/><span>Proyektor tersedia</span></label
				>
				<label class="check-row"
					><input
						{...selectedRoomId
							? updateClassRoomForm().fields.hasAC.as('checkbox')
							: createClassRoomForm().fields.hasAC.as('checkbox')}
						checked={classroomDraft.hasAC}
						onchange={(event) =>
							(classroomDraft.hasAC = (event.currentTarget as HTMLInputElement).checked)}
					/><span>AC tersedia</span></label
				>
				<div class="editor-submit">
					<Button type="submit" class="primary-button"
						>{selectedRoomId ? 'Simpan perubahan' : 'Tambah ruang'}</Button
					>
				</div>
			</form>
		{:else if editorView === 'classrooms-bulk'}
			<form class="editor-grid" {...bulkUpdateClassRoomsEnhance}>
				<p class="editor-note">
					Ubah tipe, kapasitas, dan fasilitas {bulkCount} ruang terpilih sekaligus. Kosongkan field yang
					tidak ingin diubah.
				</p>
				<input type="hidden" name="ids" value={[...bulkSelectedIds].join(',')} />
				<label
					><span>Tipe ruang</span><select name="classRoomType" bind:value={bulkEditClassRoomType}
						>{#each classRoomTypes as type (type)}<option value={type}
								>{beautifyRoomType(type)}</option
							>{/each}</select
					></label
				>
				<label
					><span>Kapasitas</span><input
						type="number"
						name="capacity"
						min="1"
						bind:value={bulkEditClassRoomCapacity}
					/></label
				>
				<label class="check-row"
					><input
						type="checkbox"
						name="hasProjector"
						bind:checked={bulkEditClassRoomHasProjector}
					/><span>Proyektor tersedia</span></label
				>
				<label class="check-row"
					><input type="checkbox" name="hasAC" bind:checked={bulkEditClassRoomHasAC} /><span
						>AC tersedia</span
					></label
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
						disabled={(bulkUpdateClassRoomsForm().pending ?? 0) > 0}
						>Simpan perubahan {bulkCount} ruang</Button
					>
				</div>
			</form>
		{:else}
			<p class="empty-copy">
				Pilih satu ruang untuk melihat detail, atau tambahkan ruang baru saat inventaris berubah.
			</p>
		{/if}
	</section>
</div>
