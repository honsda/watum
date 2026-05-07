import type { AppRole } from '$lib/app/academic';
import type { ViewId } from '$lib/app/navigation';

type PaginationDirection = 'previous' | 'next';

type QueueCollectionRefresh<K extends string> = (key: K, delay?: number) => void;
type ChangeCollectionPage<K extends string> = (key: K, direction: PaginationDirection) => unknown;
type BulkClear<K extends string> = (key: K) => void;
type BulkToggleAll<K extends string> = (key: K, ids: string[]) => void;
type BulkToggleId<K extends string> = (key: K, id: string) => void;
type OpenBulkEditor<V extends string> = (activeView: V, bulkView: V) => void;
type RequestDelete<D extends string> = (kind: D, id: string) => void;

export type NavigateToEntity = (view: ViewId, id: string | null | undefined, name?: string) => void;

export function buildSearchActions<K extends string>(options: {
	key: K;
	reset: () => void;
	queueCollectionRefresh: QueueCollectionRefresh<K>;
}) {
	return {
		onSearchInput: () => options.queueCollectionRefresh(options.key),
		onClearSearch: () => {
			options.reset();
			options.queueCollectionRefresh(options.key, 0);
		}
	};
}

export function buildPaginationActions<K extends string>(options: {
	key: K;
	changeCollectionPage: ChangeCollectionPage<K>;
}) {
	return {
		onPagePrevious: () => void options.changeCollectionPage(options.key, 'previous'),
		onPageNext: () => void options.changeCollectionPage(options.key, 'next')
	};
}

export function buildBulkSelectionActions<K extends string>(options: {
	key: K;
	bulkClear: BulkClear<K>;
	bulkToggleAll: BulkToggleAll<K>;
	bulkToggleId: BulkToggleId<K>;
}) {
	return {
		onBulkClear: () => options.bulkClear(options.key),
		onBulkToggleAll: (ids: string[]) => options.bulkToggleAll(options.key, ids),
		onBulkToggleId: (id: string) => options.bulkToggleId(options.key, id)
	};
}

export function buildRoleAwareViewBase<K extends string, EditorView, PendingDelete>(options: {
	key: K;
	reset: () => void;
	queueCollectionRefresh: QueueCollectionRefresh<K>;
	changeCollectionPage: ChangeCollectionPage<K>;
	currentRole: AppRole;
	editorView: EditorView;
	pendingDelete: PendingDelete;
	handleKeyboardClick: (event: KeyboardEvent) => void;
	onNavigateToEntity: NavigateToEntity;
}) {
	return {
		...buildSearchActions({
			key: options.key,
			reset: options.reset,
			queueCollectionRefresh: options.queueCollectionRefresh
		}),
		...buildPaginationActions({
			key: options.key,
			changeCollectionPage: options.changeCollectionPage
		}),
		currentRole: options.currentRole,
		editorView: options.editorView,
		pendingDelete: options.pendingDelete,
		handleKeyboardClick: options.handleKeyboardClick,
		onNavigateToEntity: options.onNavigateToEntity
	};
}

export function buildBulkViewBase<K extends string, EditorView, PendingDelete>(options: {
	key: K;
	reset: () => void;
	queueCollectionRefresh: QueueCollectionRefresh<K>;
	changeCollectionPage: ChangeCollectionPage<K>;
	currentRole: AppRole;
	editorView: EditorView;
	pendingDelete: PendingDelete;
	handleKeyboardClick: (event: KeyboardEvent) => void;
	onNavigateToEntity: NavigateToEntity;
	bulkSelectedIds: Set<string>;
	bulkCount: number;
	bulkClear: BulkClear<K>;
	bulkToggleAll: BulkToggleAll<K>;
	bulkToggleId: BulkToggleId<K>;
}) {
	return {
		...buildRoleAwareViewBase(options),
		...buildBulkSelectionActions({
			key: options.key,
			bulkClear: options.bulkClear,
			bulkToggleAll: options.bulkToggleAll,
			bulkToggleId: options.bulkToggleId
		}),
		bulkSelectedIds: options.bulkSelectedIds,
		bulkCount: options.bulkCount
	};
}

export function buildEntityEditorActions<V extends string, D extends string>(options: {
	editView: V;
	deleteKind: D;
	selectedId: string | null;
	beginCreate: (view: V) => void;
	beginEdit: (view: V) => void;
	stopEditing: (view?: V) => void;
	requestDelete: RequestDelete<D>;
	confirmPendingDelete: () => unknown;
	cancelPendingDelete: () => void;
}) {
	return {
		onBeginCreate: () => options.beginCreate(options.editView),
		onBeginEdit: () => options.beginEdit(options.editView),
		onStopEditing: () => options.stopEditing(options.editView),
		onRequestDelete: () => options.requestDelete(options.deleteKind, options.selectedId!),
		onConfirmDelete: options.confirmPendingDelete,
		onCancelDelete: options.cancelPendingDelete
	};
}

export function buildBulkEditorActions<V extends string>(options: {
	editView: V;
	bulkView: V;
	openBulkEditor: OpenBulkEditor<V>;
	openBulkDelete: () => void;
}) {
	return {
		onOpenBulkEdit: () => options.openBulkEditor(options.editView, options.bulkView),
		onOpenBulkDelete: options.openBulkDelete
	};
}

export function buildCrudEntityViewProps<
	K extends string,
	V extends string,
	D extends string,
	EditorView,
	PendingDelete,
	Extras extends Record<string, unknown>
>(options: {
	key: K;
	reset: () => void;
	queueCollectionRefresh: QueueCollectionRefresh<K>;
	changeCollectionPage: ChangeCollectionPage<K>;
	currentRole: AppRole;
	editorView: EditorView;
	pendingDelete: PendingDelete;
	handleKeyboardClick: (event: KeyboardEvent) => void;
	onNavigateToEntity: NavigateToEntity;
	bulkSelectedIds: Set<string>;
	bulkCount: number;
	bulkClear: BulkClear<K>;
	bulkToggleAll: BulkToggleAll<K>;
	bulkToggleId: BulkToggleId<K>;
	selectedId: string | null;
	editView: V;
	bulkView: V;
	deleteKind: D;
	beginCreate: (view: V) => void;
	beginEdit: (view: V) => void;
	stopEditing: (view?: V) => void;
	requestDelete: RequestDelete<D>;
	confirmPendingDelete: () => unknown;
	cancelPendingDelete: () => void;
	openBulkEditor: OpenBulkEditor<V>;
	openBulkDelete: () => void;
	extras: Extras;
}) {
	return {
		...buildBulkViewBase({
			key: options.key,
			reset: options.reset,
			queueCollectionRefresh: options.queueCollectionRefresh,
			changeCollectionPage: options.changeCollectionPage,
			currentRole: options.currentRole,
			editorView: options.editorView,
			pendingDelete: options.pendingDelete,
			handleKeyboardClick: options.handleKeyboardClick,
			onNavigateToEntity: options.onNavigateToEntity,
			bulkSelectedIds: options.bulkSelectedIds,
			bulkCount: options.bulkCount,
			bulkClear: options.bulkClear,
			bulkToggleAll: options.bulkToggleAll,
			bulkToggleId: options.bulkToggleId
		}),
		...options.extras,
		...buildEntityEditorActions({
			editView: options.editView,
			deleteKind: options.deleteKind,
			selectedId: options.selectedId,
			beginCreate: options.beginCreate,
			beginEdit: options.beginEdit,
			stopEditing: options.stopEditing,
			requestDelete: options.requestDelete,
			confirmPendingDelete: options.confirmPendingDelete,
			cancelPendingDelete: options.cancelPendingDelete
		}),
		...buildBulkEditorActions({
			editView: options.editView,
			bulkView: options.bulkView,
			openBulkEditor: options.openBulkEditor,
			openBulkDelete: options.openBulkDelete
		})
	};
}

export function buildDashboardViewProps<T>(options: T) {
	return options;
}

export function buildCalendarViewProps<T>(options: T) {
	return options;
}

export function buildBuilderViewProps<T>(options: T) {
	return options;
}

export function buildEnrollmentsViewProps<T>(options: T) {
	return options;
}

export function buildUsersViewProps<T>(options: T) {
	return options;
}
