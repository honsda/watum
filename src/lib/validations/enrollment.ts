import * as v from 'valibot';

export const days = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'] as const;

export const enrollmentSchema = v.object({
	studentId: v.string(),
	courseId: v.string(),
	classRoomId: v.string(),
	lecturerId: v.string(),
	day: v.picklist(days),
	startTime: v.string(),
	endTime: v.string(),
	semester: v.string(),
	academicYear: v.string()
});