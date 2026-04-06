import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { formatDateTime } from '$lib/time-helpers';
import { getPool } from '$lib/server/db';
import {
	selectClassRooms,
	selectSchedules,
	insertClassRoom,
	updateClassRoom as updateClassRoomDb,
	deleteClassRoom as deleteClassRoomDb
} from '$lib/server/sql';
import { classRoomSchema } from '$lib/validations/classroom';
import dayjs from 'dayjs';



type ClassRoomType = v.InferOutput<typeof classRoomSchema>['classRoomType'];

export const getClassRooms = query(async () => {
	return await selectClassRooms(getPool());
});

export const getClassRoom = query(v.string(), async (id) => {
	const [classRoom] = await selectClassRooms(getPool(), { where: [['id', '=', id]] });
	if (!classRoom) {
		error(404, 'Ruang kelas tidak ditemukan');
		return classRoom;
	}
});

export const getClassRoomUtilization = query(
	v.object({ classRoomId: v.string(), timezone: v.string() }),
	async ({ classRoomId, timezone }) => {
		const schedules = await selectSchedules(getPool(), {
			where: [['class_room_id', '=', classRoomId]]
		});
		const utilization: Record<string, Array<{ start: string; end: string; course: string }>> = {};
		for (const schedule of schedules) {
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
		return utilization;
	}
);



export const createClassRoom = form(classRoomSchema, async (data) => {
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
		await getClassRoom(id).refresh();
		return { success: true };
	}
);

export const deleteClassRoom = command(v.string(), async (id) => {
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
