import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error, invalid } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { getPool } from '$lib/server';
import { requireRole, requireUser } from '$lib/server/auth';
import { parseISO, formatDateTime } from '$lib/time-helpers';
import {
	selectEnrollments,
	selectSchedules,
	insertSchedule,
	insertEnrollment,
	deleteSchedule,
	updateSchedule,
	updateEnrollment as updateEnrollmentDb,
	deleteEnrollment as deleteEnrollmentDb
} from '$lib/server/sql';
import { enrollmentSchema } from '$lib/validations/enrollment';

export const getEnrollments = query(async () => {
	const user = await requireUser();
	if (user.role === 'STUDENT') {
		return await selectEnrollments(getPool(), {
			where: [['student_id', '=', user.studentId!]]
		});
	}
	if (user.role === 'LECTURER') {
		return await selectEnrollments(getPool(), {
			where: [['lecturer_id', '=', user.lecturerId!]]
		});
	}
	return selectEnrollments(getPool());
});

export const getEnrollment = query(v.string(), async (id) => {
	const user = await requireUser();
	const [enrollment] = await selectEnrollments(getPool(), { where: [['id', '=', id]] });
	if (!enrollment) {
		throw error(404, 'Data KRS tidak ditemukan');
	}
	if (user.role === 'STUDENT' && enrollment.student_id !== user.studentId) {
		throw error(403, 'Anda tidak berhak melihat data KRS ini');
	}
	if (user.role === 'LECTURER' && enrollment.lecturer_id !== user.lecturerId) {
		throw error(403, 'Anda tidak berhak melihat data KRS ini');
	}
	return enrollment;
});

export const createEnrollment = form(enrollmentSchema, async (data, issue) => {
	const user = await requireRole(['ADMIN', 'STUDENT']);
	if (user.role === 'STUDENT' && data.studentId !== user.studentId) {
		throw error(403, 'Anda tidak berhak membuat KRS untuk mahasiswa lain');
	}

	const startDate = parseISO(data.startTime);
	const endDate = parseISO(data.endTime);

	if (endDate <= startDate) {
		invalid(issue.endTime('Waktu selesai harus lebih besar dari waktu mulai'));
	}

	const existingSchedules = await selectSchedules(getPool(), {
		where: [
			['class_room_id', '=', data.classRoomId],
			['day', '=', data.day]
		]
	});
	const hasConflict = existingSchedules.find((s) => {
		if (!s.start_time || !s.end_time) return false;
		const s1 = new Date(s.start_time).getTime();
		const e1 = new Date(s.end_time).getTime();
		const s2 = startDate.getTime();
		const e2 = endDate.getTime();
		return s1 < e2 && s2 < e1;
	});
	if (hasConflict) {
		invalid(
			issue.classRoomId(
				`Jadwal bentrok (${formatDateTime(startDate, 'time')} - ${formatDateTime(endDate, 'time')}) dengan jadwal yang sudah ada`
			)
		);
	}

	const [existing] = await selectEnrollments(getPool(), {
		where: [
			['student_id', '=', data.studentId],
			['course_id', '=', data.courseId],
			['semester', '=', data.semester]
		]
	});
	if (existing) {
		invalid(issue.courseId('Mahasiswa sudah terdaftar di mata kuliah ini pada semester yang sama'));
	}

	const scheduleId = randomUUID();
	await insertSchedule(getPool(), {
		id: scheduleId,
		class_room_id: data.classRoomId,
		day: data.day,
		start_time: startDate,
		end_time: endDate,
		lecturer_id: data.lecturerId
	});

	const enrollmentId = randomUUID();
	await insertEnrollment(getPool(), {
		id: enrollmentId,
		student_id: data.studentId,
		course_id: data.courseId,
		class_room_id: data.classRoomId,
		lecturer_id: data.lecturerId,
		schedule_id: scheduleId,
		semester: data.semester,
		academic_year: data.academicYear
	});

	await getEnrollments().refresh();
	return { success: true, enrollmentId: enrollmentId, scheduleId: scheduleId };
});

export const updateEnrollment = form(
	v.object({ id: v.string(), ...enrollmentSchema.entries }),
	async (data, issue) => {
		await requireRole(['ADMIN']);
		const [enrollment] = await selectEnrollments(getPool(), { where: [['id', '=', data.id]] });
		if (!enrollment) {
			throw error(404, 'Data KRS tidak ditemukan');
		}
		if (enrollment.grade_id) {
			throw error(400, 'Data KRS sudah memiliki nilai, tidak dapat diubah');
		}
		const startDate = parseISO(data.startTime);
		const endDate = parseISO(data.endTime);

		if (endDate <= startDate) {
			invalid(issue.endTime('Waktu selesai harus lebih besar dari waktu mulai'));
		}

		const existingSchedules = await selectSchedules(getPool(), {
			where: [
				['class_room_id', '=', data.classRoomId],
				['day', '=', data.day]
			]
		});
		const hasConflict = existingSchedules.find((s) => {
			if (!s.start_time || !s.end_time) return false;
			if (s.id === enrollment.schedule_id) return false;
			const s1 = new Date(s.start_time).getTime();
			const e1 = new Date(s.end_time).getTime();
			const s2 = startDate.getTime();
			const e2 = endDate.getTime();
			return s1 < e2 && s2 < e1;
		});
		if (hasConflict) {
			invalid(
				issue.classRoomId(
					`Jadwal bentrok (${formatDateTime(startDate, 'time')} - ${formatDateTime(endDate, 'time')}) dengan jadwal yang sudah ada`
				)
			);
		}

		const [existing] = await selectEnrollments(getPool(), {
			where: [
				['student_id', '=', data.studentId],
				['course_id', '=', data.courseId],
				['semester', '=', data.semester]
			]
		});
		if (existing && existing.id !== data.id) {
			invalid(
				issue.courseId('Mahasiswa sudah terdaftar di mata kuliah ini pada semester yang sama')
			);
		}
		await updateSchedule(
			getPool(),
			{
				class_room_id: data.classRoomId,
				day: data.day,
				start_time: startDate,
				end_time: endDate,
				lecturer_id: data.lecturerId
			},
			{ id: enrollment.schedule_id! }
		);
		await updateEnrollmentDb(
			getPool(),
			{
				student_id: data.studentId,
				course_id: data.courseId,
				class_room_id: data.classRoomId,
				lecturer_id: data.lecturerId,
				semester: data.semester,
				academic_year: data.academicYear
			},
			{ id: data.id }
		);
		await getEnrollments().refresh();
		await getEnrollment(data.id).refresh();
		return { success: true };
	}
);

export const deleteEnrollment = command(v.string(), async (id) => {
	await requireRole(['ADMIN']);
	const [enrollment] = await selectEnrollments(getPool(), { where: [['id', '=', id]] });
	if (!enrollment) {
		throw error(404, 'Data KRS tidak ditemukan');
	}
	await deleteEnrollmentDb(getPool(), { id });
	await deleteSchedule(getPool(), { id: enrollment.schedule_id! });
	await getEnrollments().refresh();
	return { success: true };
});
