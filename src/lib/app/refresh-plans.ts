export const classroomScheduleRefreshPlan = {
	collections: ['classrooms', 'enrollments'],
	includeSchedulePreview: true,
	includeConflictAudit: true
} as const;

export const courseScheduleGradesRefreshPlan = {
	collections: ['courses', 'enrollments', 'grades'],
	includeSchedulePreview: true,
	includeConflictAudit: true
} as const;

export const studentAcademicUsersRefreshPlan = {
	collections: ['students', 'enrollments', 'grades', 'users'],
	includeSchedulePreview: true,
	includeConflictAudit: true
} as const;

export const lecturerCourseUsersRefreshPlan = {
	collections: ['lecturers', 'courses', 'enrollments', 'users'],
	includeSchedulePreview: true,
	includeConflictAudit: true
} as const;

export const facultyDeleteRefreshPlan = {
	collections: ['faculties', 'studyPrograms', 'students']
} as const;

export const facultyUpdateRefreshPlan = {
	collections: ['faculties', 'studyPrograms']
} as const;

export const studyProgramAcademicRefreshPlan = {
	collections: ['studyPrograms', 'students', 'courses', 'enrollments', 'grades'],
	includeSchedulePreview: true,
	includeConflictAudit: true
} as const;

export const studyProgramUpdateRefreshPlan = {
	collections: ['studyPrograms', 'students', 'courses']
} as const;

export const enrollmentGradesRefreshPlan = {
	collections: ['enrollments', 'grades'],
	includeSchedulePreview: true,
	includeConflictAudit: true
} as const;

export const gradesRefreshPlan = {
	collections: ['grades']
} as const;

export const usersRefreshPlan = {
	collections: ['users']
} as const;

export const studentsRefreshPlan = {
	collections: ['students']
} as const;

export const lecturersRefreshPlan = {
	collections: ['lecturers']
} as const;

export function cloneRefreshPlan<T extends string>(plan: {
	collections: readonly T[];
	includeSchedulePreview?: boolean;
	includeConflictAudit?: boolean;
}) {
	return {
		...plan,
		collections: [...plan.collections]
	};
}
