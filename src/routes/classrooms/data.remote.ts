import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { formatDateTime } from '$lib/time-helpers';
import {
	getListQueryLimit,
	getListQueryOffset,
	mergeLimitedListResult,
	getPool,
	toLimitedListResult
} from '$lib/server/db';
import { requireRole } from '$lib/server/auth';
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
import dayjs from 'dayjs';

type ClassRoomType = v.InferOutput<typeof classRoomSchema>['classRoomType'];

export const getClassRooms = query(listPageSchema, async (page) => {
	await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	const limit = getListQueryLimit();
	const offset = getListQueryOffset(page?.offset);
	return toLimitedListResult(
		await selectClassRooms(getPool(), { params: { offset, limit: limit + 1 } }),
		limit
	);
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
	if (filters.name) where.push(['name', 'LIKE', filters.name]);
	if (filters.classRoomType) where.push(['class_room_type', '=', filters.classRoomType]);
	if (filters.minCapacity != null && filters.maxCapacity != null) {
		where.push(['capacity', 'BETWEEN', filters.minCapacity, filters.maxCapacity]);
	} else if (filters.minCapacity != null) {
		where.push(['capacity', '>=', filters.minCapacity]);
	} else if (filters.maxCapacity != null) {
		where.push(['capacity', '<=', filters.maxCapacity]);
	}
	const limit = getListQueryLimit();
	const offset = getListQueryOffset(filters.offset);
	const q = filters.q?.trim();
	if (q) {
		const queryLimit = offset + limit + 1;
		const variants: SelectClassRoomsWhere[][] = [
			[...where, ['id', '=', q]],
			[...where, ['name', 'LIKE', q]]
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
					where: variantWhere,
					params: { offset: 0, limit: queryLimit }
				})
			)
		);
		return mergeLimitedListResult(resultSets, offset, limit, (item) => item.id ?? null);
	}
	return toLimitedListResult(
		await selectClassRooms(getPool(), { where, params: { offset, limit: limit + 1 } }),
		limit
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

export const getClassRoomUtilization = query(
	v.object({ classRoomId: v.string(), timezone: v.string() }),
	async ({ classRoomId, timezone }) => {
		await requireRole(['ADMIN', 'LECTURER']);
		const limit = getListQueryLimit();
		const schedules = await selectSchedules(getPool(), {
			where: [['class_room_id', '=', classRoomId]],
			params: { offset: 0, limit: limit + 1 }
		});
		const limitedSchedules = toLimitedListResult(schedules, limit);
		const utilization: Record<string, Array<{ start: string; end: string; course: string }>> = {};
		for (const schedule of limitedSchedules.items) {
			if (!schedule.start_time || !schedule.end_time) {
				schedule.start_time = dayjs('1970-01-01').toDate();
				schedule.end_time = dayjs('1970-01-01').toDate();
			}
			const day = schedule.day ?? '';
			if (!utilization[day]) {
				utilization[day] = [];
			}
			utilization[day].push({
				start: formatDateTime(schedule.start_time, 'time', timezone),
				end: formatDateTime(schedule.end_time, 'time', timezone),
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
	await getClassRooms().refresh();
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
		await getClassRooms().refresh();
		return { success: true };
	}
);

export const deleteClassRoom = command(v.string(), async (id) => {
	await requireRole(['ADMIN']);
	const [classRoom] = await selectClassRooms(getPool(), { where: [['id', '=', id]] });
	if (!classRoom) {
		throw error(404, 'Ruang kelas tidak ditemukan');
	}
	if ((classRoom.schedule_count ?? 0) > 0) {
		throw error(400, 'Ruang kelas tidak dapat dihapus karena sudah digunakan dalam jadwal');
	}

	await deleteClassRoomDb(getPool(), { id });
	await getClassRooms().refresh();
	return { success: true };
});
