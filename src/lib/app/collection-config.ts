import type { AppRole } from '$lib/app/academic';
import type { ViewId } from '$lib/app/navigation';

export const collectionFallbackMessages = {
	classrooms: 'Ruang kelas gagal dimuat.',
	courses: 'Mata kuliah gagal dimuat.',
	students: 'Data mahasiswa gagal dimuat.',
	lecturers: 'Data dosen gagal dimuat.',
	faculties: 'Data fakultas gagal dimuat.',
	studyPrograms: 'Program studi gagal dimuat.',
	enrollments: 'Data KRS gagal dimuat.',
	grades: 'Data nilai gagal dimuat.',
	users: 'Data akun gagal dimuat.'
} as const;

export const staticViewDataPlans = {
	calendar: {
		collections: ['courses', 'classrooms', 'lecturers'],
		requiresSchedulePreview: true
	},
	builder: {
		collections: ['courses', 'classrooms', 'lecturers', 'enrollments'],
		requiresSchedulePreview: true
	},
	classrooms: {
		collections: ['classrooms'],
		requiresSchedulePreview: false
	},
	courses: {
		collections: ['courses', 'studyPrograms', 'lecturers'],
		requiresSchedulePreview: false
	},
	students: {
		collections: ['students', 'studyPrograms'],
		requiresSchedulePreview: false
	},
	lecturers: {
		collections: ['lecturers'],
		requiresSchedulePreview: false
	},
	faculties: {
		collections: ['faculties'],
		requiresSchedulePreview: false
	},
	studyPrograms: {
		collections: ['studyPrograms', 'faculties'],
		requiresSchedulePreview: false
	},
	enrollments: {
		collections: ['enrollments', 'courses', 'classrooms', 'lecturers'],
		requiresSchedulePreview: false
	},
	grades: {
		collections: ['grades', 'enrollments', 'courses'],
		requiresSchedulePreview: false
	},
	users: {
		collections: ['users'],
		requiresSchedulePreview: false
	}
} as const;

export function dashboardViewDataPlan(role: AppRole | undefined) {
	return {
		collections: role === 'STUDENT' ? ['enrollments', 'grades'] : ['classrooms'],
		requiresSchedulePreview: true
	} as const;
}

export function viewDataPlanForRole(view: ViewId, role: AppRole | undefined) {
	if (view === 'dashboard') return dashboardViewDataPlan(role);
	return staticViewDataPlans[view];
}
