import { formatDateTime } from '$lib/time-helpers';
import type { SelectClassRoomsResult } from '$lib/server/sql/select-class-rooms';
import type { SelectEnrollmentsResult } from '$lib/server/sql/select-enrollments';

export const DAY_ORDER = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'] as const;

export const DAY_LABELS: Record<(typeof DAY_ORDER)[number], string> = {
	SENIN: 'Senin',
	SELASA: 'Selasa',
	RABU: 'Rabu',
	KAMIS: 'Kamis',
	JUMAT: 'Jumat',
	SABTU: 'Sabtu'
};

export type AppRole = 'ADMIN' | 'LECTURER' | 'STUDENT';

export type ScheduleCard = {
	id: string;
	day: (typeof DAY_ORDER)[number];
	course: string;
	lecturer: string;
	room: string;
	student: string;
	semester: string;
	academicYear: string;
	startLabel: string;
	endLabel: string;
	startMinutes: number;
	endMinutes: number;
	durationMinutes: number;
	hasConflict: boolean;
	conflictGroupId: string | null;
	conflictTone: number | null;
	original: SelectEnrollmentsResult;
};

const CONFLICT_TONES = [
	{
		surface: 'oklch(0.95 0.032 18)',
		border: 'oklch(0.8 0.092 18)',
		ink: 'oklch(0.53 0.168 18)'
	},
	{
		surface: 'oklch(0.96 0.032 72)',
		border: 'oklch(0.83 0.11 72)',
		ink: 'oklch(0.56 0.17 72)'
	},
	{
		surface: 'oklch(0.95 0.03 145)',
		border: 'oklch(0.8 0.1 145)',
		ink: 'oklch(0.52 0.15 145)'
	},
	{
		surface: 'oklch(0.95 0.028 205)',
		border: 'oklch(0.79 0.095 205)',
		ink: 'oklch(0.5 0.145 205)'
	},
	{
		surface: 'oklch(0.95 0.03 255)',
		border: 'oklch(0.79 0.1 255)',
		ink: 'oklch(0.49 0.16 255)'
	},
	{
		surface: 'oklch(0.95 0.03 300)',
		border: 'oklch(0.8 0.105 300)',
		ink: 'oklch(0.52 0.17 300)'
	},
	{
		surface: 'oklch(0.95 0.03 340)',
		border: 'oklch(0.81 0.105 340)',
		ink: 'oklch(0.54 0.17 340)'
	},
	{
		surface: 'oklch(0.95 0.028 32)',
		border: 'oklch(0.81 0.1 32)',
		ink: 'oklch(0.55 0.16 32)'
	}
] as const;

export type RoomMetric = {
	id: string;
	name: string;
	type: string;
	capacity: number;
	hasProjector: boolean;
	hasAC: boolean;
	utilizationPercent: number;
	scheduledBlocks: number;
	occupiedMinutes: number;
	nextUse: string;
	isAvailableNow: boolean;
	conflictCount: number;
	currentCourse: string;
};

const DAY_WINDOW_MINUTES = (20 - 7) * 60;
const WEEK_WINDOW_MINUTES = DAY_WINDOW_MINUTES * DAY_ORDER.length;

export function toMinutes(date: Date | null | undefined, timezone: string): number {
	if (!date) return 0;
	const formatted = formatDateTime(date, 'time', timezone);
	const [hours, minutes] = formatted.split(':').map(Number);
	return hours * 60 + minutes;
}

export function formatTimeRange(
	start: Date | null | undefined,
	end: Date | null | undefined,
	timezone: string
) {
	if (!start || !end) return 'Belum dijadwalkan';
	return `${formatDateTime(start, 'time', timezone)} - ${formatDateTime(end, 'time', timezone)}`;
}

export function buildScheduleCards(
	enrollments: SelectEnrollmentsResult[],
	timezone: string
): ScheduleCard[] {
	const safeEnrollments = Array.isArray(enrollments) ? enrollments : [];

	const cards = safeEnrollments
		.filter(
			(
				item
			): item is SelectEnrollmentsResult & {
				id: string;
				schedule_day: (typeof DAY_ORDER)[number];
				schedule_start_time: Date;
				schedule_end_time: Date;
			} =>
				Boolean(item.id && item.schedule_day && item.schedule_start_time && item.schedule_end_time)
		)
		.map((item) => {
			const startMinutes = toMinutes(item.schedule_start_time, timezone);
			const endMinutes = toMinutes(item.schedule_end_time, timezone);

			return {
				id: item.id,
				day: item.schedule_day,
				course: item.course_name ?? 'Mata kuliah tanpa nama',
				lecturer: item.lecturer_name ?? 'Dosen belum diisi',
				room: item.class_room_name ?? 'Ruang belum diisi',
				student: item.student_name ?? 'Mahasiswa belum diisi',
				semester: item.semester ?? '-',
				academicYear: item.academic_year ?? '-',
				startLabel: formatDateTime(item.schedule_start_time, 'time', timezone),
				endLabel: formatDateTime(item.schedule_end_time, 'time', timezone),
				startMinutes,
				endMinutes,
				durationMinutes: Math.max(endMinutes - startMinutes, 0),
				hasConflict: false,
				conflictGroupId: null,
				conflictTone: null,
				original: item
			};
		});

	let conflictIndex = 0;
	for (const day of DAY_ORDER) {
		const roomNames = [
			...new Set(cards.filter((card) => card.day === day).map((card) => card.room))
		].sort();

		for (const room of roomNames) {
			const roomCards = cards
				.filter((card) => card.day === day && card.room === room)
				.sort((left, right) => left.startMinutes - right.startMinutes);

			let cluster: ScheduleCard[] = [];
			let clusterEnd = 0;

			for (const card of roomCards) {
				if (!cluster.length) {
					cluster = [card];
					clusterEnd = card.endMinutes;
					continue;
				}

				if (card.startMinutes < clusterEnd) {
					cluster.push(card);
					clusterEnd = Math.max(clusterEnd, card.endMinutes);
					continue;
				}

				if (cluster.length > 1) {
					const tone = conflictIndex;
					const groupId = `conflict-${conflictIndex + 1}`;
					for (const conflictCard of cluster) {
						conflictCard.hasConflict = true;
						conflictCard.conflictGroupId = groupId;
						conflictCard.conflictTone = tone;
					}
					conflictIndex += 1;
				}

				cluster = [card];
				clusterEnd = card.endMinutes;
			}

			if (cluster.length > 1) {
				const tone = conflictIndex;
				const groupId = `conflict-${conflictIndex + 1}`;
				for (const conflictCard of cluster) {
					conflictCard.hasConflict = true;
					conflictCard.conflictGroupId = groupId;
					conflictCard.conflictTone = tone;
				}
				conflictIndex += 1;
			}
		}
	}

	return cards;
}

export function conflictToneVariables(conflictTone: number | null) {
	if (conflictTone == null) return '';
	const tone = CONFLICT_TONES[conflictTone % CONFLICT_TONES.length];

	return `--conflict-surface: ${tone.surface}; --conflict-border: ${tone.border}; --conflict-ink: ${tone.ink};`;
}

export function groupCardsByDay(cards: ScheduleCard[]) {
	return DAY_ORDER.map((day) => ({
		day,
		label: DAY_LABELS[day],
		items: cards
			.filter((card) => card.day === day)
			.sort((left, right) => left.startMinutes - right.startMinutes)
	}));
}

export function buildRoomMetrics(
	classrooms: SelectClassRoomsResult[],
	cards: ScheduleCard[],
	timezone: string,
	now = new Date()
): RoomMetric[] {
	const currentDayIndex = Math.max(now.getDay() - 1, 0);
	const currentDay = DAY_ORDER[Math.min(currentDayIndex, DAY_ORDER.length - 1)];
	const currentMinutes = toMinutes(now, timezone);

	return classrooms.map((room) => {
		const roomCards = cards.filter((card) => card.original.class_room_id === room.id);
		const currentBlock = roomCards.find(
			(card) =>
				card.day === currentDay &&
				currentMinutes >= card.startMinutes &&
				currentMinutes < card.endMinutes
		);
		const nextUse = roomCards
			.filter(
				(card) =>
					DAY_ORDER.indexOf(card.day) > DAY_ORDER.indexOf(currentDay) ||
					(card.day === currentDay && card.startMinutes >= currentMinutes)
			)
			.sort((left, right) => {
				const dayDelta = DAY_ORDER.indexOf(left.day) - DAY_ORDER.indexOf(right.day);
				return dayDelta === 0 ? left.startMinutes - right.startMinutes : dayDelta;
			})[0];

		const occupiedMinutes = roomCards.reduce((total, card) => total + card.durationMinutes, 0);
		const utilizationPercent = Math.round((occupiedMinutes / WEEK_WINDOW_MINUTES) * 100);
		const conflictCount = roomCards.filter((card) => card.hasConflict).length;

		return {
			id: room.id ?? '',
			name: room.name ?? 'Ruang tanpa nama',
			type: beautifyRoomType(room.class_room_type),
			capacity: room.capacity ?? 0,
			hasProjector: Boolean(room.has_projector),
			hasAC: Boolean(room.has_ac),
			utilizationPercent,
			scheduledBlocks: roomCards.length,
			occupiedMinutes,
			nextUse: nextUse ? `${DAY_LABELS[nextUse.day]}, ${nextUse.startLabel}` : 'Belum ada jadwal',
			isAvailableNow: !currentBlock,
			conflictCount,
			currentCourse: currentBlock?.course ?? 'Kosong sekarang'
		};
	});
}

export function sortRoomsForRole(metrics: RoomMetric[], role: AppRole) {
	const sorted = [...metrics];
	if (role === 'ADMIN') {
		return sorted.sort((left, right) => {
			if (right.utilizationPercent !== left.utilizationPercent) {
				return right.utilizationPercent - left.utilizationPercent;
			}
			return right.conflictCount - left.conflictCount;
		});
	}

	if (role === 'LECTURER') {
		return sorted.sort((left, right) => {
			if (Number(right.isAvailableNow) !== Number(left.isAvailableNow)) {
				return Number(right.isAvailableNow) - Number(left.isAvailableNow);
			}
			return left.utilizationPercent - right.utilizationPercent;
		});
	}

	return sorted.sort((left, right) => right.capacity - left.capacity);
}

export function occupancyCopy(role: AppRole) {
	if (role === 'ADMIN') {
		return {
			title: 'Utilisasi ruang minggu ini'
		};
	}

	if (role === 'LECTURER') {
		return {
			title: 'Ruang kosong yang siap dipakai'
		};
	}

	return {
		title: 'Ketersediaan ruang'
	};
}

export function availableRoomsForSlot(
	classrooms: SelectClassRoomsResult[],
	cards: ScheduleCard[],
	day: string,
	startMinutes: number,
	endMinutes: number,
	excludedCardId?: string | null
) {
	return classrooms.filter((room) => {
		const roomCards = cards.filter((card) => card.original.class_room_id === room.id);
		return !roomCards.some((card) => {
			if (excludedCardId && card.id === excludedCardId) return false;
			if (card.day !== day) return false;
			return card.startMinutes < endMinutes && startMinutes < card.endMinutes;
		});
	});
}

export function beautifyRoomType(value: string | null | undefined) {
	if (!value) return 'Tidak diketahui';
	return value
		.replaceAll('_', ' ')
		.toLowerCase()
		.replace(/(^|\s)\S/g, (part) => part.toUpperCase());
}

export function matchesText(value: string | null | undefined, query: string) {
	if (!query.trim()) return true;
	return (value ?? '').toLowerCase().includes(query.trim().toLowerCase());
}

export function formatMinutes(minutes: number) {
	const hours = Math.floor(minutes / 60);
	const remainder = minutes % 60;
	if (!hours) return `${remainder} menit`;
	if (!remainder) return `${hours} jam`;
	return `${hours} jam ${remainder} menit`;
}
