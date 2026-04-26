import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { formatDateTime, getTimeComponents } from '$lib/time-helpers';
import { DAY_LABELS, DAY_ORDER, beautifyRoomType, type RoomMetric } from '$lib/app/academic';
import {
	getListQueryLimit,
	getListQueryCursor,
	mergeLimitedListResult,
	getPool,
	toLimitedListResult
} from '$lib/server/db';
import { requireRole } from '$lib/server/auth';
import { invalidateConflictAuditCache } from '$lib/server/conflict-audit';
import {
	containsSearchPattern,
	prefixSearchPattern,
	wordPrefixSearchPattern
} from '$lib/server/search';
import {
	selectClassRooms,
	selectSchedules,
	insertClassRoom,
	updateClassRoom as updateClassRoomDb,
	deleteClassRoom as deleteClassRoomDb
} from '$lib/server/sql';
import { type SelectClassRoomsWhere } from '$lib/server/sql';
import { classRoomSchema } from '$lib/validations/classroom';
import { listPageEntries, listPageSchema } from '$lib/validations/pagination';

type ClassRoomType = v.InferOutput<typeof classRoomSchema>['classRoomType'];

type RoomPageRow = {
	id: string;
	name: string;
	class_room_type: string;
	capacity: number;
	has_projector: number;
	has_ac: number;
};

type RoomUsageRow = {
	class_room_id: string;
	scheduled_blocks: number | string;
	occupied_minutes: number | string;
};

type RoomCurrentRow = {
	class_room_id: string;
	schedule_id: string;
};

type RoomNextKeyRow = {
	class_room_id: string;
	next_key: string | null;
};

type ScheduleCourseRow = {
	schedule_id: string;
	course_name: string | null;
};

export type RoomDashboardSummary = {
	totalRooms: number;
	availableNowCount: number;
	occupiedRoomCount: number;
	lowUtilizationRoomCount: number;
	averageUtilization: number;
	conflictedCount: number;
};

export type AdminDashboardTotals = {
	totalRooms: number;
	totalStudents: number;
	totalLecturers: number;
	totalUsers: number;
};

const ROOM_METRIC_WINDOW_MINUTES = (20 - 7) * 60 * DAY_ORDER.length;
const DASHBOARD_PAGE_SIZE = 10;

function toNumber(value: number | string | null | undefined) {
	if (typeof value === 'number') return value;
	if (typeof value === 'string') return Number(value);
	return 0;
}

const classRoomListSelect = {
	id: true,
	name: true,
	class_room_type: true,
	capacity: true
} as const;

export const getClassRooms = query(listPageSchema, async (page) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const limit = getListQueryLimit();
	const afterId = getListQueryCursor(page?.cursor);
	return toLimitedListResult(
		await selectClassRooms(getPool(), {
			select: classRoomListSelect,
			params: { afterId, limit: limit + 1 }
		}),
		limit,
		(item) => item.id ?? null
	);
});

export const getAllClassRooms = query(async () => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	return await selectClassRooms(getPool(), {
		select: classRoomListSelect
	});
});

const searchClassRoomsSchema = v.object({
	...listPageEntries,
	q: v.optional(v.string()),
	id: v.optional(v.string()),
	name: v.optional(v.string()),
	classRoomType: v.optional(v.picklist(['REGULER', 'LAB_KOMPUTER', 'LAB_BAHASA', 'AUDITORIUM'])),
	minCapacity: v.optional(v.number()),
	maxCapacity: v.optional(v.number())
});

export const searchClassRooms = query(searchClassRoomsSchema, async (filters) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const where: SelectClassRoomsWhere[] = [];
	if (filters.id) where.push(['id', '=', filters.id]);
	if (filters.name) where.push(['name', 'LIKE', containsSearchPattern(filters.name)!]);
	if (filters.classRoomType) where.push(['class_room_type', '=', filters.classRoomType]);
	if (filters.minCapacity != null && filters.maxCapacity != null) {
		where.push(['capacity', 'BETWEEN', filters.minCapacity, filters.maxCapacity]);
	} else if (filters.minCapacity != null) {
		where.push(['capacity', '>=', filters.minCapacity]);
	} else if (filters.maxCapacity != null) {
		where.push(['capacity', '<=', filters.maxCapacity]);
	}
	const limit = getListQueryLimit();
	const afterId = getListQueryCursor(filters.cursor);
	const q = filters.q?.trim();
	if (q) {
		const qPrefix = prefixSearchPattern(q)!;
		const qWordPrefix = wordPrefixSearchPattern(q)!;
		const queryLimit = limit + 1;
		const variants: SelectClassRoomsWhere[][] = [
			[...where, ['id', '=', q]],
			[...where, ['name', 'LIKE', qPrefix]],
			[...where, ['name', 'LIKE', qWordPrefix]]
		];
		const normalizedType = q
			.toUpperCase()
			.replaceAll(/[^A-Z]/g, '_')
			.replaceAll(/_+/g, '_') as ClassRoomType;
		if (['REGULER', 'LAB_KOMPUTER', 'LAB_BAHASA', 'AUDITORIUM'].includes(normalizedType)) {
			variants.push([...where, ['class_room_type', '=', normalizedType]]);
		}
		const resultSets = await Promise.all(
			variants.map((variantWhere) =>
				selectClassRooms(getPool(), {
					select: classRoomListSelect,
					where: variantWhere,
					params: { afterId, limit: queryLimit }
				})
			)
		);
		return mergeLimitedListResult(resultSets, limit, (item) => item.id ?? null);
	}
	return toLimitedListResult(
		await selectClassRooms(getPool(), {
			select: classRoomListSelect,
			where,
			params: { afterId, limit: limit + 1 }
		}),
		limit,
		(item) => item.id ?? null
	);
});

export const getClassRoom = query(v.string(), async (id) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const [classRoom] = await selectClassRooms(getPool(), { where: [['id', '=', id]] });
	if (!classRoom) {
		throw error(404, 'Ruang kelas tidak ditemukan');
	}
	return classRoom;
});

export const getClassRoomDashboardSummary = query(
	v.object({ timezone: v.string() }),
	async ({ timezone }) => {
		const user = await requireRole(['ADMIN', 'LECTURER']);
		const pool = getPool();
		const now = new Date();
		const { dayOfWeek } = getTimeComponents(now, timezone);
		const currentDay =
			dayOfWeek >= 1 && dayOfWeek <= DAY_ORDER.length ? DAY_ORDER[dayOfWeek - 1] : null;
		const currentTime = formatDateTime(now, 'time', timezone);
		const lecturerWhere = user.role === 'LECTURER' ? 'AND s.lecturer_id = ?' : '';
		const lecturerValues = user.role === 'LECTURER' ? [user.lecturerId!] : [];

		const [totalRows, usageRows, currentRows] = await Promise.all([
			pool
				.query('SELECT COUNT(*) AS total FROM class_rooms')
				.then(([rows]) => (rows as Array<{ total: number | string }>)[0]),
			pool
				.query(
					[
						'SELECT s.class_room_id, COUNT(*) AS scheduled_blocks,',
						'COALESCE(SUM(TIME_TO_SEC(TIMEDIFF(s.end_time, s.start_time)) / 60), 0) AS occupied_minutes',
						'FROM schedules s FORCE INDEX (idx_schedules_room_day_time)',
						'WHERE 1 = 1',
						lecturerWhere,
						'GROUP BY s.class_room_id'
					]
						.filter(Boolean)
						.join(' '),
					lecturerValues
				)
				.then(([rows]) => rows as RoomUsageRow[]),
			currentDay
				? pool
						.query(
							[
								'SELECT DISTINCT s.class_room_id',
								'FROM schedules s FORCE INDEX (idx_schedules_room_day_time)',
								'WHERE s.day = ? AND s.start_time <= ? AND s.end_time > ?',
								lecturerWhere
							]
								.filter(Boolean)
								.join(' '),
							[...lecturerValues, currentDay, currentTime, currentTime]
						)
						.then(([rows]) => rows as Array<{ class_room_id: string }>)
				: Promise.resolve([] as Array<{ class_room_id: string }>)
		]);

		const totalRooms = toNumber(totalRows?.total);
		const occupiedRoomIds = new Set(usageRows.map((row) => row.class_room_id));
		const totalOccupiedMinutes = usageRows.reduce(
			(sum, row) => sum + toNumber(row.occupied_minutes),
			0
		);
		const averageUtilization =
			totalRooms > 0
				? Math.round((totalOccupiedMinutes / (totalRooms * ROOM_METRIC_WINDOW_MINUTES)) * 100)
				: 0;
		const busyNowRoomIds = new Set(currentRows.map((row) => row.class_room_id));
		const availableNowCount = totalRooms - busyNowRoomIds.size;
		const occupiedRoomCount = occupiedRoomIds.size;
		const lowUtilizationThreshold = Math.round(ROOM_METRIC_WINDOW_MINUTES * 0.3);
		const lowUtilizationRoomCount = usageRows.filter(
			(row) => toNumber(row.occupied_minutes) < lowUtilizationThreshold
		).length;

		return {
			totalRooms,
			availableNowCount,
			occupiedRoomCount,
			lowUtilizationRoomCount,
			averageUtilization,
			conflictedCount: 0
		} satisfies RoomDashboardSummary;
	}
);

export const getAdminDashboardTotals = query(async () => {
	await requireRole(['ADMIN']);
	const pool = getPool();
	const [roomRows, studentRows, lecturerRows, userRows] = await Promise.all([
		pool
			.query('SELECT COUNT(*) AS total FROM class_rooms')
			.then(([rows]) => rows as Array<{ total: number | string }>),
		pool
			.query('SELECT COUNT(*) AS total FROM students')
			.then(([rows]) => rows as Array<{ total: number | string }>),
		pool
			.query('SELECT COUNT(*) AS total FROM lecturers')
			.then(([rows]) => rows as Array<{ total: number | string }>),
		pool
			.query('SELECT COUNT(*) AS total FROM users')
			.then(([rows]) => rows as Array<{ total: number | string }>)
	]);
	return {
		totalRooms: toNumber(roomRows[0]?.total),
		totalStudents: toNumber(studentRows[0]?.total),
		totalLecturers: toNumber(lecturerRows[0]?.total),
		totalUsers: toNumber(userRows[0]?.total)
	} satisfies AdminDashboardTotals;
});

export const getClassRoomDashboardMetrics = query(
	v.object({
		timezone: v.string(),
		cursor: v.optional(v.string()),
		pageSize: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(50)))
	}),
	async ({ timezone, cursor, pageSize = DASHBOARD_PAGE_SIZE }) => {
		const user = await requireRole(['ADMIN', 'LECTURER']);
		const pool = getPool();
		const now = new Date();
		const { dayOfWeek } = getTimeComponents(now, timezone);
		const currentDay =
			dayOfWeek >= 1 && dayOfWeek <= DAY_ORDER.length ? DAY_ORDER[dayOfWeek - 1] : null;
		const currentTime = formatDateTime(now, 'time', timezone);
		const afterId = getListQueryCursor(cursor);
		const roomWhere = afterId ? 'WHERE id > ?' : '';
		const roomValues = afterId ? [afterId, pageSize + 1] : [pageSize + 1];

		const roomRowsRaw = await pool
			.query(
				`SELECT id, name, class_room_type, capacity, has_projector, has_ac
				 FROM class_rooms
				 ${roomWhere}
				 ORDER BY id ASC
				 LIMIT ?`,
				roomValues
			)
			.then(([rows]) => rows as RoomPageRow[]);
		const roomRows = roomRowsRaw.slice(0, pageSize);
		const hasMore = roomRowsRaw.length > pageSize;
		const nextCursor = hasMore ? (roomRows.at(-1)?.id ?? null) : null;
		const roomIds = roomRows.map((row) => row.id);
		if (!roomIds.length) {
			return { items: [], pageSize, hasMore: false, nextCursor: null };
		}

		const roomIdPlaceholders = roomIds.map(() => '?').join(',');
		const lecturerWhere = user.role === 'LECTURER' ? 'AND s.lecturer_id = ?' : '';

		const usageSql = [
			'SELECT s.class_room_id, COUNT(*) AS scheduled_blocks,',
			'COALESCE(SUM(TIME_TO_SEC(TIMEDIFF(s.end_time, s.start_time)) / 60), 0) AS occupied_minutes',
			'FROM schedules s FORCE INDEX (idx_schedules_room_day_time)',
			`WHERE s.class_room_id IN (${roomIdPlaceholders})`,
			lecturerWhere,
			'GROUP BY s.class_room_id'
		]
			.filter(Boolean)
			.join(' ');

		const currentSql = [
			'SELECT s.class_room_id, s.id AS schedule_id',
			'FROM schedules s FORCE INDEX (idx_schedules_room_day_time)',
			`WHERE s.class_room_id IN (${roomIdPlaceholders})`,
			lecturerWhere,
			'AND s.day = ? AND s.start_time <= ? AND s.end_time > ?'
		]
			.filter(Boolean)
			.join(' ');

		const rotatedDays = currentDay
			? [
					...DAY_ORDER.slice(DAY_ORDER.indexOf(currentDay)),
					...DAY_ORDER.slice(0, DAY_ORDER.indexOf(currentDay))
				]
			: [...DAY_ORDER];
		const nextCaseParts: string[] = [];
		const nextCaseValues: unknown[] = [];
		for (const [offsetIdx, day] of rotatedDays.entries()) {
			if (currentDay && offsetIdx === 0) {
				nextCaseParts.push(
					`WHEN s.day = ? AND s.start_time >= ? THEN '${String(offsetIdx).padStart(2, '0')}'`
				);
				nextCaseValues.push(day, currentTime);
			} else {
				nextCaseParts.push(`WHEN s.day = ? THEN '${String(offsetIdx).padStart(2, '0')}'`);
				nextCaseValues.push(day);
			}
		}
		const nextKeyExpr = `MIN(CONCAT(CASE ${nextCaseParts.join(' ')} ELSE NULL END, '|', s.day, '|', TIME_FORMAT(s.start_time, '%H:%i:%s'), '|', s.id))`;
		const nextSql = [
			'SELECT s.class_room_id,',
			`${nextKeyExpr} AS next_key`,
			'FROM schedules s FORCE INDEX (idx_schedules_room_day_time)',
			`WHERE s.class_room_id IN (${roomIdPlaceholders})`,
			lecturerWhere,
			'GROUP BY s.class_room_id'
		]
			.filter(Boolean)
			.join(' ');

		const baseValues = [...roomIds];
		const lecturerValue = user.role === 'LECTURER' ? [user.lecturerId!] : [];

		const [usageRows, currentRows, nextRows] = await Promise.all([
			pool
				.query(usageSql, [...baseValues, ...lecturerValue])
				.then(([rows]) => rows as RoomUsageRow[]),
			currentDay
				? pool
						.query(currentSql, [
							...baseValues,
							...lecturerValue,
							currentDay,
							currentTime,
							currentTime
						])
						.then(([rows]) => rows as RoomCurrentRow[])
				: Promise.resolve([] as RoomCurrentRow[]),
			pool
				.query(nextSql, [...baseValues, ...lecturerValue, ...nextCaseValues])
				.then(([rows]) => rows as RoomNextKeyRow[])
		]);

		const usageByRoomId = new Map(usageRows.map((row) => [row.class_room_id, row]));
		const currentScheduleIdsByRoomId = new Map<string, string[]>();
		for (const row of currentRows) {
			const ids = currentScheduleIdsByRoomId.get(row.class_room_id) ?? [];
			ids.push(row.schedule_id);
			currentScheduleIdsByRoomId.set(row.class_room_id, ids);
		}
		const nextByRoomId = new Map(
			nextRows
				.filter((row): row is RoomNextKeyRow & { next_key: string } => Boolean(row.next_key))
				.map((row) => [row.class_room_id, row.next_key])
		);

		const scheduleIds = new Set<string>();
		for (const ids of currentScheduleIdsByRoomId.values()) {
			for (const id of ids) scheduleIds.add(id);
		}
		for (const packed of nextByRoomId.values()) {
			const parts = packed.split('|');
			const scheduleId = parts[3];
			if (scheduleId) scheduleIds.add(scheduleId);
		}

		const scheduleCourseRows = scheduleIds.size
			? await pool
					.query(
						`SELECT e.schedule_id, MIN(c.name) AS course_name
						 FROM enrollments e
						 INNER JOIN courses c ON c.id = e.course_id
						 WHERE e.schedule_id IN (?)
						 GROUP BY e.schedule_id`,
						[[...scheduleIds]]
					)
					.then(([rows]) => rows as ScheduleCourseRow[])
			: [];
		const courseNameByScheduleId = new Map(
			scheduleCourseRows.map((row) => [row.schedule_id, row.course_name ?? 'Terjadwal'])
		);

		const items = roomRows.map((room) => {
			const roomId = room.id ?? '';
			const usage = usageByRoomId.get(roomId);
			const currentScheduleIds = currentScheduleIdsByRoomId.get(roomId) ?? [];
			const currentCourses = currentScheduleIds
				.map((id) => courseNameByScheduleId.get(id))
				.filter((value): value is string => Boolean(value));
			const uniqueCurrentCourses = [...new Set(currentCourses)];
			const nextPacked = nextByRoomId.get(roomId);
			const nextParts = nextPacked?.split('|') ?? [];
			const nextUseDay = (nextParts[1] as (typeof DAY_ORDER)[number] | undefined) ?? null;
			const nextUseStartTime = nextParts[2] ?? null;
			const nextUseScheduleId = nextParts[3] ?? null;
			const nextUseCourse = nextUseScheduleId
				? (courseNameByScheduleId.get(nextUseScheduleId) ?? 'Terjadwal')
				: null;
			const nextUse =
				nextUseDay && nextUseStartTime
					? `${DAY_LABELS[nextUseDay]}, ${formatDateTime(nextUseStartTime, 'time', timezone)}`
					: 'Belum ada jadwal';

			const metric: RoomMetric = {
				id: roomId,
				name: room.name ?? 'Ruang tanpa nama',
				type: beautifyRoomType(room.class_room_type),
				capacity: room.capacity ?? 0,
				hasProjector: Boolean(room.has_projector),
				hasAC: Boolean(room.has_ac),
				utilizationPercent: Math.round(
					(toNumber(usage?.occupied_minutes) / ROOM_METRIC_WINDOW_MINUTES) * 100
				),
				scheduledBlocks: toNumber(usage?.scheduled_blocks),
				occupiedMinutes: toNumber(usage?.occupied_minutes),
				nextUse,
				isAvailableNow: uniqueCurrentCourses.length === 0,
				conflictCount: 0,
				currentCourse: uniqueCurrentCourses.length
					? uniqueCurrentCourses.join(', ')
					: 'Kosong sekarang',
				nextUseDay,
				nextUseStartTime,
				nextUseCourse
			};

			return metric;
		});

		return {
			items,
			pageSize,
			hasMore,
			nextCursor
		};
	}
);

export const getClassRoomUtilization = query(
	v.object({ classRoomId: v.string(), timezone: v.string() }),
	async ({ classRoomId, timezone }) => {
		await requireRole(['ADMIN', 'LECTURER']);
		const limit = getListQueryLimit();
		const schedules = await selectSchedules(getPool(), {
			where: [['class_room_id', '=', classRoomId]],
			params: { limit: limit + 1 }
		});
		const limitedSchedules = toLimitedListResult(
			schedules,
			limit,
			(schedule) => schedule.id ?? null
		);
		const utilization: Record<string, Array<{ start: string; end: string; course: string }>> = {};
		for (const schedule of limitedSchedules.items) {
			if (!schedule.start_time || !schedule.end_time) {
				schedule.start_time = '00:00:00';
				schedule.end_time = '00:00:00';
			}
			const day = schedule.day ?? '';
			if (!utilization[day]) {
				utilization[day] = [];
			}
			utilization[day].push({
				start: formatDateTime(schedule.start_time ?? '00:00:00', 'time', timezone),
				end: formatDateTime(schedule.end_time ?? '00:00:00', 'time', timezone),
				course: schedule.course_name ?? ''
			});
		}
		return {
			utilization,
			limit: limitedSchedules.limit,
			hasMore: limitedSchedules.hasMore
		};
	}
);

export const createClassRoom = form(classRoomSchema, async (data) => {
	await requireRole(['ADMIN']);
	const [existing] = await selectClassRooms(getPool(), { where: [['name', '=', data.name]] });
	if (existing) {
		throw error(400, 'Ruang kelas dengan nama tersebut sudah ada');
	}

	const id = randomUUID();
	await insertClassRoom(getPool(), {
		id,
		name: data.name,
		class_room_type: data.classRoomType as ClassRoomType,
		capacity: data.capacity,
		has_projector: +data.hasProjector,
		has_ac: +data.hasAC
	});
	invalidateConflictAuditCache();
	await getClassRooms().refresh();
	await getAllClassRooms().refresh();
	return { success: true, id };
});

export const updateClassRoom = form(
	v.object({ id: v.string(), ...classRoomSchema.entries }),
	async (data) => {
		await requireRole(['ADMIN']);
		const { id, ...updateData } = data;
		const [existing] = await selectClassRooms(getPool(), { where: [['name', '=', data.name]] });
		if (existing && existing.id !== id) {
			throw error(400, 'Ruang kelas dengan nama tersebut sudah ada');
		}

		await updateClassRoomDb(
			getPool(),
			{
				name: updateData.name,
				class_room_type: updateData.classRoomType as ClassRoomType,
				capacity: updateData.capacity,
				has_projector: +updateData.hasProjector,
				has_ac: +updateData.hasAC
			},
			{ id }
		);
		invalidateConflictAuditCache();
		await getClassRooms().refresh();
		await getAllClassRooms().refresh();
		return { success: true };
	}
);

export const deleteClassRoom = command(v.string(), async (id) => {
	await requireRole(['ADMIN']);
	await deleteClassRoomDb(getPool(), { id });
	invalidateConflictAuditCache();
	await getClassRooms().refresh();
	await getAllClassRooms().refresh();
	return { success: true };
});
