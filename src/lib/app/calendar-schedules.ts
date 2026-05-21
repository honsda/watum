import { DAY_LABELS, DAY_ORDER, type ScheduleCard, toMinutes } from '$lib/app/academic';
import type { SelectEnrollmentsResult } from '$lib/server/sql';
import { formatDateTime, getTimeComponents } from '$lib/time-helpers';

export type ConflictAuditMemberLike = {
	enrollmentId: string;
	studentId: string;
	courseId: string;
	lecturerId: string;
	classRoomId: string;
	scheduleId: string;
	semester: string;
	academicYear: string;
	studentName: string;
	courseName: string;
	lecturerName: string;
	classRoomName: string;
	day: (typeof DAY_ORDER)[number];
	startTime: string;
	endTime: string;
};

export const CALENDAR_DAY_INDEX: Record<(typeof DAY_ORDER)[number], number> = {
	SENIN: 1,
	SELASA: 2,
	RABU: 3,
	KAMIS: 4,
	JUMAT: 5,
	SABTU: 6
};

export const DEFAULT_DAY_START = 7 * 60;
export const DEFAULT_DAY_END = 20 * 60;
export const RANGE_PADDING_MINUTES = 60;
export const MIN_VISIBLE_MINUTES = 6 * 60;

export function createCalendarWeekStart() {
	return new Date(2025, 0, 6);
}

export function createCalendarAnchorDate(weekOffset = 0) {
	const date = createCalendarWeekStart();
	date.setDate(date.getDate() + weekOffset * 7);
	return date;
}

export function roundUpHour(minutes: number) {
	return Math.ceil(minutes / 60) * 60;
}

export function roundDownHour(minutes: number) {
	return Math.floor(minutes / 60) * 60;
}

export function clampCalendarMinute(minutes: number) {
	return Math.max(0, Math.min(minutes, 24 * 60));
}

export function rangeForScheduleCards(cards: ScheduleCard[]) {
	const validCards = cards.filter(
		(card) =>
			Number.isFinite(card.startMinutes) &&
			Number.isFinite(card.endMinutes) &&
			card.endMinutes > card.startMinutes
	);

	if (!validCards.length) {
		return { start: DEFAULT_DAY_START, end: DEFAULT_DAY_END };
	}

	const firstStart = Math.min(...validCards.map((card) => card.startMinutes));
	const lastEnd = Math.max(...validCards.map((card) => card.endMinutes));
	let start = roundDownHour(clampCalendarMinute(firstStart - RANGE_PADDING_MINUTES));
	let end = roundUpHour(clampCalendarMinute(lastEnd + RANGE_PADDING_MINUTES));

	if (end - start < MIN_VISIBLE_MINUTES) {
		const midpoint = (start + end) / 2;
		start = roundDownHour(clampCalendarMinute(midpoint - MIN_VISIBLE_MINUTES / 2));
		end = Math.min(start + MIN_VISIBLE_MINUTES, 24 * 60);

		if (end - start < MIN_VISIBLE_MINUTES) {
			start = Math.max(0, end - MIN_VISIBLE_MINUTES);
		}
	}

	return { start, end };
}

export function timeString(minutes: number) {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`;
}

export function dateForCalendarDay(day: (typeof DAY_ORDER)[number], weekOffset: number) {
	const date = createCalendarAnchorDate(weekOffset);
	date.setDate(date.getDate() + DAY_ORDER.indexOf(day));
	return date;
}

export function dateForScheduleCard(card: ScheduleCard, minutes: number, weekOffset: number) {
	const date = dateForCalendarDay(card.day, weekOffset);
	date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
	return date;
}

export function conflictPeerLabel(card: ScheduleCard) {
	return `${card.course} • ${card.student} • ${card.room} • ${DAY_LABELS[card.day]} ${card.startLabel}-${card.endLabel}`;
}

export function toEnrollmentResultFromConflictMember(
	member: ConflictAuditMemberLike
): SelectEnrollmentsResult {
	return {
		id: member.enrollmentId,
		student_id: member.studentId,
		course_id: member.courseId,
		lecturer_id: member.lecturerId,
		class_room_id: member.classRoomId,
		schedule_id: member.scheduleId,
		semester: member.semester,
		academic_year: member.academicYear,
		student_name: member.studentName,
		course_name: member.courseName,
		lecturer_name: member.lecturerName,
		class_room_name: member.classRoomName,
		schedule_day: member.day,
		schedule_start_time: member.startTime,
		schedule_end_time: member.endTime,
		status: 'APPROVED'
	};
}

export function scheduleCardFromConflictMember(
	member: ConflictAuditMemberLike,
	groupId: string,
	tone: number,
	timezone: string
): ScheduleCard {
	const original = toEnrollmentResultFromConflictMember(member);
	const startMinutes = toMinutes(member.startTime, timezone);
	const endMinutes = toMinutes(member.endTime, timezone);
	return {
		id: member.enrollmentId,
		day: member.day,
		course: member.courseName,
		lecturer: member.lecturerName,
		room: member.classRoomName,
		student: member.studentName,
		semester: member.semester,
		academicYear: member.academicYear,
		startLabel: formatDateTime(member.startTime, 'time', timezone),
		endLabel: formatDateTime(member.endTime, 'time', timezone),
		startMinutes,
		endMinutes,
		durationMinutes: Math.max(30, endMinutes - startMinutes),
		studentCount: 1,
		hasConflict: true,
		conflictGroupId: groupId,
		conflictTone: tone,
		original
	};
}

export function summarizeDistinctValues(values: Array<string | null | undefined>, maxVisible = 2) {
	const uniqueValues = Array.from(
		new Set(
			values
				.map((value) => value?.trim())
				.filter((value): value is string => Boolean(value && value.length))
		)
	);

	if (!uniqueValues.length) return '-';
	if (uniqueValues.length <= maxVisible) return uniqueValues.join(', ');

	return `${uniqueValues.slice(0, maxVisible).join(', ')} +${uniqueValues.length - maxVisible} lain`;
}

export function schedulesOverlap(left: ScheduleCard, right: ScheduleCard) {
	return (
		left.id !== right.id &&
		left.day === right.day &&
		left.startMinutes < right.endMinutes &&
		right.startMinutes < left.endMinutes
	);
}

export function visibleDaysForCalendar(cards: ScheduleCard[], dayFilter: string) {
	if (dayFilter && dayFilter in CALENDAR_DAY_INDEX) {
		return [dayFilter as (typeof DAY_ORDER)[number]];
	}

	const daysWithSessions = new Set(cards.map((card) => card.day));
	const visibleDays = DAY_ORDER.filter((day) => daysWithSessions.has(day));
	return visibleDays.length ? visibleDays : DAY_ORDER;
}

export function hiddenDaysForCalendar(visibleDays: ReadonlyArray<(typeof DAY_ORDER)[number]>) {
	const visibleIndexes = new Set(visibleDays.map((day) => CALENDAR_DAY_INDEX[day]));
	return [0, 1, 2, 3, 4, 5, 6].filter((dayIndex) => !visibleIndexes.has(dayIndex));
}

export function calendarColumnWidth(visibleDayCount: number) {
	if (visibleDayCount <= 1) return 'minmax(18rem, 1fr)';
	if (visibleDayCount === 2) return 'minmax(16rem, 1fr)';
	if (visibleDayCount === 3) return 'minmax(14rem, 1fr)';
	return 'minmax(11.5rem, 1fr)';
}

export function calendarSlotHeight(visibleDayCount: number) {
	if (visibleDayCount <= 2) return 42;
	if (visibleDayCount === 3) return 38;
	return 34;
}

export function dayKeyFromDate(date: Date): (typeof DAY_ORDER)[number] | null {
	const map = {
		1: 'SENIN',
		2: 'SELASA',
		3: 'RABU',
		4: 'KAMIS',
		5: 'JUMAT',
		6: 'SABTU'
	} as const;

	return map[date.getDay() as keyof typeof map] ?? null;
}

export function isApprovedScheduleCard(card: ScheduleCard) {
	return !card.original.status || card.original.status === 'APPROVED';
}

export function upcomingScheduleRank(card: ScheduleCard, timezone: string, now = new Date()) {
	if (!isApprovedScheduleCard(card)) return Number.POSITIVE_INFINITY;
	const { dayOfWeek } = getTimeComponents(now, timezone);
	const currentDayIndex = dayOfWeek >= 1 && dayOfWeek <= DAY_ORDER.length ? dayOfWeek - 1 : 0;
	const currentMinutes =
		dayOfWeek >= 1 && dayOfWeek <= DAY_ORDER.length ? toMinutes(now, timezone) : 0;
	const dayDelta = DAY_ORDER.indexOf(card.day) - currentDayIndex;
	if (dayDelta < 0 || (dayDelta === 0 && card.endMinutes <= currentMinutes)) {
		return Number.POSITIVE_INFINITY;
	}
	return dayDelta * 24 * 60 + card.startMinutes;
}

export function sortUpcomingSchedules(cards: ScheduleCard[], timezone: string, now = new Date()) {
	return cards
		.map((card) => ({ card, rank: upcomingScheduleRank(card, timezone, now) }))
		.filter(({ rank }) => Number.isFinite(rank))
		.sort((left, right) => left.rank - right.rank)
		.map(({ card }) => card);
}

export function sortWeeklySchedules(cards: ScheduleCard[]) {
	return [...cards].filter(isApprovedScheduleCard).sort((left, right) => {
		const dayDelta = DAY_ORDER.indexOf(left.day) - DAY_ORDER.indexOf(right.day);
		return dayDelta === 0 ? left.startMinutes - right.startMinutes : dayDelta;
	});
}

export function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

export function clearScheduleCardConflict(card: ScheduleCard): ScheduleCard {
	if (!card.hasConflict && !card.conflictGroupId && card.conflictTone == null) return card;
	return {
		...card,
		hasConflict: false,
		conflictGroupId: null,
		conflictTone: null
	};
}

export function scheduleSessionKey(card: ScheduleCard) {
	return card.original.schedule_id
		? `schedule:${card.original.schedule_id}`
		: `enrollment:${card.id}`;
}

export function mergeCalendarSessionCards(
	cards: ScheduleCard[],
	preferredConflictGroupId: string | null
) {
	const sessions: Record<string, ScheduleCard> = {};
	const sessionKeys: string[] = [];

	for (const card of cards) {
		const key = scheduleSessionKey(card);
		const existing = sessions[key];
		if (!existing) {
			sessions[key] = card;
			sessionKeys.push(key);
			continue;
		}

		const prefersCurrentConflictGroup =
			preferredConflictGroupId && card.conflictGroupId === preferredConflictGroupId;
		const shouldUseCurrent =
			Boolean(prefersCurrentConflictGroup) || (!existing.hasConflict && card.hasConflict);
		const base = shouldUseCurrent ? card : existing;
		sessions[key] = {
			...base,
			studentCount: Math.max(existing.studentCount, card.studentCount)
		};
	}

	return sessionKeys.map((key) => sessions[key]!);
}

export function idsFingerprint(items: Array<{ id?: string | null }>) {
	return items
		.map((item) => item.id)
		.filter(Boolean)
		.join('|');
}
