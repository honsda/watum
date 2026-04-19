import * as v from 'valibot';

export const days = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'] as const;

const requiredField = (message: string) =>
	v.pipe(v.fallback(v.string(), ''), v.minLength(1, message));

export const enrollmentSchema = v.object({
	studentId: requiredField('Mahasiswa wajib dipilih'),
	courseId: requiredField('Mata kuliah wajib dipilih'),
	classRoomId: requiredField('Ruang kelas wajib dipilih'),
	timezone: v.optional(v.string()),
	day: v.picklist(days),
	startTime: requiredField('Waktu mulai wajib diisi'),
	endTime: requiredField('Waktu selesai wajib diisi'),
	semester: requiredField('Semester wajib diisi'),
	academicYear: requiredField('Tahun akademik wajib diisi')
});
