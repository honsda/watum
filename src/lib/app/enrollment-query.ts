import type { AppRole } from '$lib/app/academic';
import type { ViewId } from '$lib/app/navigation';
import type { SelectEnrollmentsResult } from '$lib/server/sql';

export type ScheduleDay = 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU';

export function buildEnrollmentSearchParams(options: {
	cursor: string | null;
	q: string | undefined;
	courseId: string;
	classRoomId: string;
	lecturerId: string;
	scheduleDay: string;
	semester: string;
	academicYear: string;
}) {
	return {
		cursor: options.cursor ?? undefined,
		q: options.q,
		courseId: options.courseId || undefined,
		classRoomId: options.classRoomId || undefined,
		lecturerId: options.lecturerId || undefined,
		scheduleDay: (options.scheduleDay || undefined) as ScheduleDay | undefined,
		semester: options.semester || undefined,
		academicYear: options.academicYear || undefined
	};
}

export function buildConflictAuditFilters(options: {
	academicYear: string | undefined;
	semester: string | undefined;
	role: AppRole | undefined;
	activeView: ViewId;
	builderEnrollments: SelectEnrollmentsResult[];
	filteredEnrollments: SelectEnrollmentsResult[];
	schedulePreviewItems: SelectEnrollmentsResult[];
	scheduleDayFilter: string;
	scheduleCourseFilter: string;
	scheduleRoomFilter: string;
	scheduleLecturerFilter: string;
}) {
	const auditEnrollmentSource =
		options.role === 'STUDENT'
			? []
			: options.activeView === 'builder'
				? options.builderEnrollments
				: options.activeView === 'enrollments'
					? options.filteredEnrollments
					: options.activeView === 'calendar'
						? options.schedulePreviewItems
						: [];
	const scopedEnrollmentIds = auditEnrollmentSource
		.map((item) => item.id)
		.filter((id): id is string => Boolean(id))
		.slice(0, 500);

	return {
		academicYear: options.academicYear,
		semester: options.semester,
		day: (options.scheduleDayFilter || undefined) as ScheduleDay | undefined,
		courseId: options.scheduleCourseFilter || undefined,
		classRoomId: options.scheduleRoomFilter || undefined,
		lecturerId: options.scheduleLecturerFilter || undefined,
		enrollmentIds: scopedEnrollmentIds.length ? scopedEnrollmentIds : undefined,
		limitGroups: 1000,
		memberSampleSize: 10
	};
}
