import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import localeData from 'dayjs/plugin/localeData';
import duration from 'dayjs/plugin/duration';
import 'dayjs/locale/id';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(localeData);
dayjs.extend(duration);

export function toUTCDate(date: Date | dayjs.Dayjs): Date {
	return dayjs(date).utc().toDate();
}

export function createUTCDate(
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number,
	second: number = 0
): Date {
	const date = dayjs()
		.year(year)
		.month(month)
		.date(day)
		.hour(hour)
		.minute(minute)
		.second(second)
		.millisecond(0)
		.utc()
		.toDate();

	return date;
}

export function createUTCDateFromString(dateStr: string, timeStr: string): Date {
	const [year, month, day] = dateStr.split('-').map(Number);
	const [hour, minute] = timeStr.split(':').map(Number);

	return createUTCDate(year, month - 1, day, hour, minute);
}

function hasExplicitTimezone(value: string): boolean {
	return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
}

export function parseISO(isoStr: string, sourceTimezone?: string): Date {
	// Datetime-local values have no offset. Parse them in the browser timezone first,
	// then convert to UTC so DB storage remains consistent.
	if (!hasExplicitTimezone(isoStr) && sourceTimezone) {
		const parsed = dayjs.tz(isoStr, 'YYYY-MM-DDTHH:mm', sourceTimezone);
		if (parsed.isValid()) {
			return parsed.utc().toDate();
		}
	}

	return dayjs(isoStr).utc().toDate();
}

export function formatDateTime(
	date: Date | dayjs.Dayjs,
	format: 'full' | 'date' | 'time' = 'full',
	timezone: string = 'Asia/Jakarta'
): string {
	const dayjsDate = dayjs(date).tz(timezone);

	switch (format) {
		case 'time':
			return dayjsDate.format('HH:mm');
		case 'date':
			return dayjsDate.format('DD MMMM YYYY');
		case 'full':
		default:
			return dayjsDate.format('DD MMMM YYYY HH:mm');
	}
}
export function getDuration(
	startDate: Date | dayjs.Dayjs,
	endDate: Date | dayjs.Dayjs,
	format: 'full' | 'short' | 'simple' = 'full'
): string {
	const duration = dayjs.duration(dayjs(endDate).diff(dayjs(startDate)));
	switch (format) {
		case 'short':
			return duration.format('HH:mm');
		case 'full':
			return duration.format('DD HH:mm');
		case 'simple':
			return duration.format('HH');
	}
}
export function getTimeComponents(
	date: Date | dayjs.Dayjs,
	timezone: string
): {
	hours: number;
	minutes: number;
	day: number;
	month: number;
	year: number;
	dayOfWeek: number;
} {
	const dayjsDate = dayjs(date).tz(timezone);

	return {
		hours: dayjsDate.hour(),
		minutes: dayjsDate.minute(),
		day: dayjsDate.date(),
		month: dayjsDate.month() + 1,
		year: dayjsDate.year(),
		dayOfWeek: dayjsDate.day()
	};
}
