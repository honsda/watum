import {
	ArrowRightLeft,
	BookOpen,
	Building2,
	CalendarDays,
	ClipboardList,
	DoorClosed,
	GraduationCap,
	LayoutPanelTop,
	ShieldCheck,
	UsersRound,
	Waypoints
} from '@lucide/svelte';
import type { AppRole } from '$lib/app/academic';

export type ViewId =
	| 'dashboard'
	| 'calendar'
	| 'builder'
	| 'classrooms'
	| 'courses'
	| 'students'
	| 'lecturers'
	| 'faculties'
	| 'studyPrograms'
	| 'enrollments'
	| 'grades'
	| 'users';

export type NavigationGroupId =
	| 'overview'
	| 'planning'
	| 'records'
	| 'people'
	| 'access'
	| 'schedule'
	| 'study';

export type NavigationGroup = {
	id: NavigationGroupId;
	label: string;
	description: string;
	icon: typeof LayoutPanelTop;
	views: ViewId[];
};

export const viewCatalog = {
	dashboard: { label: 'Ringkasan', icon: LayoutPanelTop },
	calendar: { label: 'Kalender Mingguan', icon: CalendarDays },
	builder: { label: 'Penjadwalan', icon: Waypoints },
	classrooms: { label: 'Ruang Kelas', icon: DoorClosed },
	courses: { label: 'Mata Kuliah', icon: BookOpen },
	students: { label: 'Mahasiswa', icon: GraduationCap },
	lecturers: { label: 'Dosen', icon: UsersRound },
	faculties: { label: 'Fakultas', icon: Building2 },
	studyPrograms: { label: 'Program Studi', icon: ClipboardList },
	enrollments: { label: 'KRS', icon: ArrowRightLeft },
	grades: { label: 'Nilai', icon: ShieldCheck },
	users: { label: 'Akun', icon: UsersRound }
} as const;

export function navigationForRole(role: AppRole | undefined): ViewId[] {
	if (role === 'ADMIN') {
		return [
			'dashboard',
			'calendar',
			'builder',
			'classrooms',
			'courses',
			'students',
			'lecturers',
			'faculties',
			'studyPrograms',
			'enrollments',
			'grades',
			'users'
		];
	}
	if (role === 'LECTURER') {
		return [
			'dashboard',
			'calendar',
			'builder',
			'classrooms',
			'courses',
			'students',
			'lecturers',
			'faculties',
			'studyPrograms',
			'enrollments',
			'grades'
		];
	}
	return ['dashboard', 'calendar', 'classrooms', 'courses', 'lecturers', 'enrollments', 'grades'];
}

export function navigationGroupsForRole(role: AppRole | undefined): NavigationGroup[] {
	if (role === 'ADMIN') {
		return [
			{
				id: 'overview',
				label: 'Ringkasan',
				description: 'Lihat bentrok, kalender, dan ruang yang perlu ditata.',
				icon: LayoutPanelTop,
				views: ['dashboard', 'calendar']
			},
			{
				id: 'planning',
				label: 'Penjadwalan',
				description: 'Atur jadwal kelas dan pilih ruang pengganti dari satu halaman.',
				icon: Waypoints,
				views: ['builder', 'classrooms']
			},
			{
				id: 'records',
				label: 'Perkuliahan',
				description: 'Buka KRS, nilai, dan katalog kuliah yang aktif pada semester ini.',
				icon: ClipboardList,
				views: ['enrollments', 'grades', 'courses']
			},
			{
				id: 'people',
				label: 'Identitas',
				description: 'Rapikan data mahasiswa, dosen, fakultas, dan program studi.',
				icon: Building2,
				views: ['students', 'lecturers', 'faculties', 'studyPrograms']
			},
			{
				id: 'access',
				label: 'Akun',
				description: 'Perbarui peran dan akses login saat relasi identitas berubah.',
				icon: ShieldCheck,
				views: ['users']
			}
		];
	}

	if (role === 'LECTURER') {
		return [
			{
				id: 'overview',
				label: 'Ringkasan',
				description: 'Lihat kelas terdekat, bentrok, dan ruang yang masih tersedia.',
				icon: LayoutPanelTop,
				views: ['dashboard', 'calendar']
			},
			{
				id: 'planning',
				label: 'Penjadwalan',
				description: 'Pindahkan jadwal dan pilih ruang dari halaman penjadwalan.',
				icon: Waypoints,
				views: ['builder', 'classrooms']
			},
			{
				id: 'records',
				label: 'Perkuliahan',
				description: 'Buka KRS, nilai, dan mata kuliah aktif saat keputusan akademik diperlukan.',
				icon: ClipboardList,
				views: ['enrollments', 'grades', 'courses']
			},
			{
				id: 'people',
				label: 'Referensi',
				description: 'Lihat mahasiswa, dosen, fakultas, dan program studi sebagai referensi.',
				icon: Building2,
				views: ['students', 'lecturers', 'faculties', 'studyPrograms']
			}
		];
	}

	return [
		{
			id: 'schedule',
			label: 'Jadwal',
			description: 'Lihat kelas berikutnya, perubahan ruang, dan jadwal mingguan.',
			icon: CalendarDays,
			views: ['dashboard', 'calendar']
		},
		{
			id: 'study',
			label: 'Studi',
			description: 'Buka KRS, nilai, ruang, dan daftar mata kuliah.',
			icon: BookOpen,
			views: ['enrollments', 'grades', 'courses', 'lecturers', 'classrooms']
		}
	];
}

export function pageHeading(view: ViewId, role: AppRole | undefined) {
	if (role === 'STUDENT' && view === 'dashboard') return 'Jadwal dan nilai';
	if (view === 'dashboard') return 'Ringkasan jadwal';
	if (view === 'calendar') return 'Kalender perkuliahan';
	if (view === 'builder') return 'Penjadwalan kelas';
	return viewCatalog[view].label;
}

export function headerAction(view: ViewId, role: AppRole | undefined) {
	if (role === 'STUDENT') {
		if (view === 'dashboard') return { label: 'Buka kalender', target: 'calendar' as ViewId };
		return null;
	}

	if (view === 'builder') return { label: 'Lihat kalender', target: 'calendar' as ViewId };
	if (view === 'calendar') return { label: 'Buka penjadwalan', target: 'builder' as ViewId };
	if (view === 'dashboard') return { label: 'Atur jadwal', target: 'builder' as ViewId };
	return { label: 'Kembali ke ringkasan', target: 'dashboard' as ViewId };
}
