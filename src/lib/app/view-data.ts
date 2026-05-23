import type { AppRole } from '$lib/app/academic';
import { type collectionFallbackMessages, viewDataPlanForRole } from '$lib/app/collection-config';
import type { ViewId } from '$lib/app/navigation';

export type DataCollectionKey = keyof typeof collectionFallbackMessages;

export type ViewDataPlan = {
	collections: DataCollectionKey[];
	requiresSchedulePreview: boolean;
};

export type RefreshDependencies = {
	collections?: DataCollectionKey[];
	includeSchedulePreview?: boolean;
	includeConflictAudit?: boolean;
	forceCollections?: boolean;
};

export type CollectionLoadedState = Record<DataCollectionKey, boolean>;

export type CollectionPaginationState = {
	currentCursor: string | null;
	nextCursor: string | null;
	history: Array<string | null>;
	pageNumber: number;
	limit: number;
	hasMore: boolean;
	loading: boolean;
	itemCount: number;
};

export function emptyCollectionPaginationState(): CollectionPaginationState {
	return {
		currentCursor: null,
		nextCursor: null,
		history: [],
		pageNumber: 1,
		limit: 0,
		hasMore: false,
		loading: false,
		itemCount: 0
	};
}

export function createCollectionPaginationState(): Record<
	DataCollectionKey,
	CollectionPaginationState
> {
	return {
		classrooms: emptyCollectionPaginationState(),
		courses: emptyCollectionPaginationState(),
		students: emptyCollectionPaginationState(),
		lecturers: emptyCollectionPaginationState(),
		faculties: emptyCollectionPaginationState(),
		studyPrograms: emptyCollectionPaginationState(),
		enrollments: emptyCollectionPaginationState(),
		grades: emptyCollectionPaginationState(),
		users: emptyCollectionPaginationState()
	};
}

export function createCollectionLoadedState(): CollectionLoadedState {
	return {
		classrooms: false,
		courses: false,
		students: false,
		lecturers: false,
		faculties: false,
		studyPrograms: false,
		enrollments: false,
		grades: false,
		users: false
	};
}

export function viewDataPlan(view: ViewId, role: AppRole | undefined): ViewDataPlan {
	const plan = viewDataPlanForRole(view, role);
	return {
		collections: [...plan.collections] as DataCollectionKey[],
		requiresSchedulePreview: plan.requiresSchedulePreview
	};
}

export function shouldLoadClassRoomDashboard(view: ViewId, role: AppRole | undefined) {
	return view === 'dashboard' && role === 'ADMIN';
}

export function shouldLoadConflictAudit(view: ViewId, role: AppRole | undefined) {
	if (role === 'STUDENT') return false;
	if (view === 'dashboard') return role === 'ADMIN';
	return view === 'calendar' || view === 'builder' || view === 'enrollments';
}

export function getViewIssues(options: {
	view: ViewId;
	role: AppRole | undefined;
	collectionIssues: Partial<Record<DataCollectionKey, string>>;
}) {
	const plan = viewDataPlan(options.view, options.role);
	const keys = [...plan.collections];
	if (plan.requiresSchedulePreview && !keys.includes('enrollments')) {
		keys.push('enrollments');
	}

	return keys
		.map((key) => options.collectionIssues[key])
		.filter((message): message is string => Boolean(message));
}
