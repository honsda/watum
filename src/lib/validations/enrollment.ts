import * as v from "valibot";

export const days = [
	"SENIN",
	"SELASA",
	"RABU",
	"KAMIS",
	"JUMAT",
	"SABTU",
] as const;

const requiredField = (message: string) =>
	v.pipe(v.fallback(v.string(), ""), v.minLength(1, message));

const requiredDay = v.pipe(
	requiredField("Hari jadwal wajib dipilih"),
	v.picklist(days, "Hari jadwal tidak valid"),
);

export const enrollmentSchema = v.object({
	studentId: requiredField("Mahasiswa wajib dipilih"),
	courseId: requiredField("Mata kuliah wajib dipilih"),
	classRoomId: requiredField("Ruang kelas wajib dipilih"),
	timezone: v.optional(v.string()),
	day: requiredDay,
	startTime: requiredField("Waktu mulai wajib diisi"),
	endTime: requiredField("Waktu selesai wajib diisi"),
	semester: requiredField("Semester wajib diisi"),
	academicYear: requiredField("Tahun akademik wajib diisi"),
});

export const studentEnrollmentRequestSchema = v.object({
	courseId: requiredField("Mata kuliah wajib dipilih"),
});

export const approveEnrollmentSchema = v.object({
	id: v.string(),
	classRoomId: requiredField("Ruang kelas wajib dipilih"),
	timezone: v.optional(v.string()),
	day: requiredDay,
	startTime: requiredField("Waktu mulai wajib diisi"),
	endTime: requiredField("Waktu selesai wajib diisi"),
});

export const enrollmentSessionRosterSchema = v.object({
	id: v.string(),
	studentIds: v.pipe(
		v.array(v.string()),
		v.minLength(1, "Minimal satu mahasiswa harus dipilih"),
	),
});
