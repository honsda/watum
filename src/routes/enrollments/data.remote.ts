import * as v from 'valibot';
import { query, form, command } from '$app/server';
import { error, invalid } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { getPool, withTransaction } from '$lib/server';
import { requireRole, requireUser } from '$lib/server/auth';
import { getTimeComponents, parseISO, formatDateTime } from '$lib/time-helpers';
import {
	selectClassRooms,
	selectCourses,
	selectEnrollments,
	selectSchedules,
	selectStudents,
	insertSchedule,
	insertEnrollment,
	deleteSchedule,
	updateSchedule,
	updateEnrollment as updateEnrollmentDb,
	deleteEnrollment as deleteEnrollmentDb
} from '$lib/server/sql';
import { type SelectEnrollmentsWhere } from '$lib/server/sql';
import { days, enrollmentSchema } from '$lib/validations/enrollment';

const weekdayFromIndex = ['MINGGU', ...days] as const;

function validateScheduleWindow(
	data: { day: string; startTime: string; endTime: string; timezone?: string },
	issue: {
		day: (message: string) => any;
		endTime: (message: string) => any;
	}
) {
	const clientTimezone = data.timezone ?? 'UTC';
	const startDate = parseISO(data.startTime, clientTimezone);
	const endDate = parseISO(data.endTime, clientTimezone);
	const startDay =
		weekdayFromIndex[getTimeComponents(startDate, clientTimezone).dayOfWeek] ?? 'MINGGU';
	const endDay = weekdayFromIndex[getTimeComponents(endDate, clientTimezone).dayOfWeek] ?? 'MINGGU';

	if (startDay !== endDay) {
		invalid(issue.endTime('Waktu mulai dan selesai harus berada pada hari yang sama'));
	}

	if (data.day !== startDay) {
		invalid(issue.day(`Hari jadwal harus sesuai dengan tanggal yang dipilih (${startDay})`));
	}

	return { clientTimezone, startDate, endDate };
}

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

const searchEnrollmentsSchema = v.object({
	id: v.optional(v.string()),
	studentId: v.optional(v.string()),
	courseId: v.optional(v.string()),
	lecturerId: v.optional(v.string()),
	classRoomId: v.optional(v.string()),
	semester: v.optional(v.string()),
	academicYear: v.optional(v.string()),
	studentName: v.optional(v.string()),
	studyProgramName: v.optional(v.string()),
	courseName: v.optional(v.string()),
	lecturerName: v.optional(v.string()),
	classRoomName: v.optional(v.string()),
	scheduleDay: v.optional(v.picklist(['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'])),
	letterGrade: v.optional(v.string())
});

export const searchEnrollments = query(searchEnrollmentsSchema, async (filters) => {
	const user = await requireUser();
	const where: SelectEnrollmentsWhere[] = [];
	if (user.role === 'STUDENT') {
		where.push(['student_id', '=', user.studentId!]);
	} else if (user.role === 'LECTURER') {
		where.push(['lecturer_id', '=', user.lecturerId!]);
	}
	if (filters.id) where.push(['id', '=', filters.id]);
	if (filters.studentId) where.push(['student_id', '=', filters.studentId]);
	if (filters.courseId) where.push(['course_id', '=', filters.courseId]);
	if (filters.lecturerId) where.push(['lecturer_id', '=', filters.lecturerId]);
	if (filters.classRoomId) where.push(['class_room_id', '=', filters.classRoomId]);
	if (filters.semester) where.push(['semester', 'LIKE', filters.semester]);
	if (filters.academicYear) where.push(['academic_year', 'LIKE', filters.academicYear]);
	if (filters.studentName) where.push(['student_name', 'LIKE', filters.studentName]);
	if (filters.studyProgramName)
		where.push(['study_program_name', 'LIKE', filters.studyProgramName]);
	if (filters.courseName) where.push(['course_name', 'LIKE', filters.courseName]);
	if (filters.lecturerName) where.push(['lecturer_name', 'LIKE', filters.lecturerName]);
	if (filters.classRoomName) where.push(['class_room_name', 'LIKE', filters.classRoomName]);
	if (filters.scheduleDay) where.push(['schedule_day', '=', filters.scheduleDay]);
	if (filters.letterGrade) where.push(['letter_grade', '=', filters.letterGrade]);
	return selectEnrollments(getPool(), { where });
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
	const user = await requireRole(['ADMIN', 'LECTURER', 'STUDENT']);
	if (user.role === 'STUDENT' && data.studentId !== user.studentId) {
		throw error(403, 'Anda tidak berhak membuat KRS untuk mahasiswa lain');
	}

	const [student] = await selectStudents(getPool(), { where: [['id', '=', data.studentId]] });
	if (!student) {
		invalid(issue.studentId('Mahasiswa tidak ditemukan'));
	}

	const [course] = await selectCourses(getPool(), { where: [['id', '=', data.courseId]] });
	if (!course) {
		invalid(issue.courseId('Mata kuliah tidak ditemukan'));
	}
	if (!course.lecturer_id) {
		invalid(issue.courseId('Mata kuliah belum memiliki dosen pengampu'));
	}
	if (user.role === 'LECTURER' && course.lecturer_id !== user.lecturerId) {
		throw error(403, 'Anda hanya dapat mengelola jadwal untuk mata kuliah yang Anda ampu');
	}

	const [classRoom] = await selectClassRooms(getPool(), { where: [['id', '=', data.classRoomId]] });
	if (!classRoom) {
		invalid(issue.classRoomId('Ruang kelas tidak ditemukan'));
	}
	const { clientTimezone, startDate, endDate } = validateScheduleWindow(data, issue);

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
				`Jadwal bentrok (${formatDateTime(startDate, 'time', clientTimezone)} - ${formatDateTime(endDate, 'time', clientTimezone)}) dengan jadwal yang sudah ada`
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
	const enrollmentId = randomUUID();
	await withTransaction(async (conn) => {
		await insertSchedule(conn, {
			id: scheduleId,
			class_room_id: data.classRoomId,
			day: data.day,
			start_time: startDate,
			end_time: endDate,
			lecturer_id: course.lecturer_id
		});

		await insertEnrollment(conn, {
			id: enrollmentId,
			student_id: data.studentId,
			course_id: data.courseId,
			class_room_id: data.classRoomId,
			schedule_id: scheduleId,
			semester: data.semester,
			academic_year: data.academicYear
		});
	});

	await getEnrollments().refresh();
	return { success: true, enrollmentId: enrollmentId, scheduleId: scheduleId };
});

export const updateEnrollment = form(
	v.object({ id: v.string(), ...enrollmentSchema.entries }),
	async (data, issue) => {
		const user = await requireRole(['ADMIN', 'LECTURER']);
		const [enrollment] = await selectEnrollments(getPool(), { where: [['id', '=', data.id]] });
		if (!enrollment) {
			throw error(404, 'Data KRS tidak ditemukan');
		}
		if (user.role === 'LECTURER' && enrollment.lecturer_id !== user.lecturerId) {
			throw error(403, 'Anda hanya dapat mengubah jadwal untuk mata kuliah yang Anda ampu');
		}
		if (enrollment.grade_id) {
			throw error(400, 'Data KRS sudah memiliki nilai, tidak dapat diubah');
		}

		const [student] = await selectStudents(getPool(), { where: [['id', '=', data.studentId]] });
		if (!student) {
			invalid(issue.studentId('Mahasiswa tidak ditemukan'));
		}

		const [course] = await selectCourses(getPool(), { where: [['id', '=', data.courseId]] });
		if (!course) {
			invalid(issue.courseId('Mata kuliah tidak ditemukan'));
		}
		if (!course.lecturer_id) {
			invalid(issue.courseId('Mata kuliah belum memiliki dosen pengampu'));
		}
		if (user.role === 'LECTURER' && course.lecturer_id !== user.lecturerId) {
			throw error(403, 'Anda hanya dapat memindahkan jadwal dalam mata kuliah yang Anda ampu');
		}

		const [classRoom] = await selectClassRooms(getPool(), {
			where: [['id', '=', data.classRoomId]]
		});
		if (!classRoom) {
			invalid(issue.classRoomId('Ruang kelas tidak ditemukan'));
		}
		const { clientTimezone, startDate, endDate } = validateScheduleWindow(data, issue);

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
					`Jadwal bentrok (${formatDateTime(startDate, 'time', clientTimezone)} - ${formatDateTime(endDate, 'time', clientTimezone)}) dengan jadwal yang sudah ada`
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
		await withTransaction(async (conn) => {
			await updateSchedule(
				conn,
				{
					class_room_id: data.classRoomId,
					day: data.day,
					start_time: startDate,
					end_time: endDate,
					lecturer_id: course.lecturer_id
				},
				{ id: enrollment.schedule_id! }
			);
			await updateEnrollmentDb(
				conn,
				{
					student_id: data.studentId,
					course_id: data.courseId,
					class_room_id: data.classRoomId,
					semester: data.semester,
					academic_year: data.academicYear
				},
				{ id: data.id }
			);
		});
		await getEnrollments().refresh();
		return { success: true };
	}
);

export const deleteEnrollment = command(v.string(), async (id) => {
	const user = await requireRole(['ADMIN', 'LECTURER']);
	const [enrollment] = await selectEnrollments(getPool(), { where: [['id', '=', id]] });
	if (!enrollment) {
		throw error(404, 'Data KRS tidak ditemukan');
	}
	if (user.role === 'LECTURER' && enrollment.lecturer_id !== user.lecturerId) {
		throw error(403, 'Anda hanya dapat menghapus jadwal untuk mata kuliah yang Anda ampu');
	}
	await withTransaction(async (conn) => {
		await deleteEnrollmentDb(conn, { id });
		await deleteSchedule(conn, { id: enrollment.schedule_id! });
	});
	await getEnrollments().refresh();
	return { success: true };
});
