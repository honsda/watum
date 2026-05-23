import type { SelectEnrollmentsResult } from '$lib/server/sql';
import { formatDateTime } from '$lib/time-helpers';

export type EnrollmentDraft = ReturnType<typeof emptyEnrollmentDraft>;

export function emptyClassRoomDraft() {
	return {
		name: '',
		classRoomType: 'REGULER',
		capacity: 30,
		hasProjector: true,
		hasAC: true
	};
}

export function emptyCourseDraft() {
	return { id: '', name: '', credits: 3, studyProgramId: '', lecturerId: '' };
}

export function emptyStudentDraft() {
	return {
		name: '',
		email: '',
		phone: '',
		address: '',
		yearAdmitted: 2024,
		studyProgramId: ''
	};
}

export function emptyLecturerDraft() {
	return { id: '', name: '', email: '', phone: '', address: '' };
}

export function emptyFacultyDraft() {
	return { id: '', name: '' };
}

export function emptyStudyProgramDraft() {
	return { id: '', name: '', head: '', facultyId: '' };
}

export function emptyEnrollmentDraft(timezone: string) {
	return {
		id: '',
		studentId: '',
		courseId: '',
		classRoomId: '',
		day: 'SENIN',
		startTime: '',
		endTime: '',
		semester: 'GANJIL',
		academicYear: '2025/2026',
		timezone
	};
}

export function normalizeSemesterValue(value: string | null | undefined) {
	const normalized = value?.trim().toUpperCase() ?? '';
	return normalized.startsWith('GEN') ? 'GENAP' : 'GANJIL';
}

export function enrollmentDraftFromRecord(item: SelectEnrollmentsResult, timezone: string) {
	return {
		id: item.id ?? '',
		studentId: item.student_id ?? '',
		courseId: item.course_id ?? '',
		classRoomId: item.class_room_id ?? '',
		day: item.schedule_day ?? 'SENIN',
		startTime: item.schedule_start_time
			? formatDateTime(item.schedule_start_time, 'time', timezone)
			: '',
		endTime: item.schedule_end_time ? formatDateTime(item.schedule_end_time, 'time', timezone) : '',
		semester: normalizeSemesterValue(item.semester),
		academicYear: item.academic_year ?? '2025/2026',
		timezone
	};
}

export function enrollmentDraftMatches(left: EnrollmentDraft, right: EnrollmentDraft) {
	return (
		left.id === right.id &&
		left.studentId === right.studentId &&
		left.courseId === right.courseId &&
		left.classRoomId === right.classRoomId &&
		left.day === right.day &&
		left.startTime === right.startTime &&
		left.endTime === right.endTime &&
		left.semester === right.semester &&
		left.academicYear === right.academicYear &&
		left.timezone === right.timezone
	);
}

export function emptyGradeDraft() {
	return {
		id: '',
		enrollmentId: '',
		assignmentScore: 80,
		midtermScore: 80,
		finalScore: 80
	};
}

export function emptyUserDraft() {
	return {
		id: '',
		email: '',
		password: '',
		role: 'ADMIN',
		studentId: '',
		lecturerId: ''
	};
}
