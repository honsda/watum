import "dotenv/config";
import { createReadStream } from "node:fs";
import { PassThrough } from "node:stream";
import { hash } from "@node-rs/argon2";
import {
	type Connection,
	createConnection,
	type PoolConnection,
} from "mysql2/promise";

const DEFAULT_STRESS_SEED_TARGET_ROWS = 10_000_000;
const DEFAULT_INSERT_BATCH_SIZE = 10_000;
const MIN_INSERT_BATCH_SIZE = 100;
const MAX_INSERT_BATCH_SIZE = 50_000;
const DEFAULT_STUDENTS_PER_CLASS_SESSION = 32;
const MIN_STUDENTS_PER_CLASS_SESSION = 2;
const MAX_STUDENTS_PER_CLASS_SESSION = 250;
const DEFAULT_ADMIN_ID = "admin-default";
const DEFAULT_ADMIN_EMAIL = "admin@watum.local";
const DEFAULT_ADMIN_PASSWORD_HASH =
	"$argon2id$v=19$m=65536,t=3,p=4$TC2FXN7fXfwlswrRL4hTzQ$ASiXrlPTYumXqldaajKCtfKPUbuh1wmz1+f+HMwkd0M";
const STUDENT_ID_PREFIX = "stress-mhs-";
const USER_ID_PREFIX = "stress-user-";
const LECTURER_ID_PREFIX = "stress-lec-";
const LECTURER_USER_ID_PREFIX = "stress-user-lec-";
const COURSE_ID_PREFIX = "stress-course-";
const CLASSROOM_ID_PREFIX = "stress-room-";
const SCHEDULE_ID_PREFIX = "stress-sch-";
const ENROLLMENT_ID_PREFIX = "stress-enr-";
const GRADE_ID_PREFIX = "stress-grade-";
const INTENTIONAL_CONFLICT_GROUP_COUNT = 6;
const INTENTIONAL_CONFLICT_MEMBERS_PER_GROUP = 2;

const ACADEMIC_YEAR = "2025/2026";
const SEMESTER = "GENAP";

const facultyRows = [
	["FTI", "Fakultas Teknologi Informasi"],
	["FEB", "Fakultas Ekonomi dan Bisnis"],
	["FHUKUM", "Fakultas Hukum"],
] as const;

const studyProgramRows = [
	["TI", "Teknik Informatika", "Dr. Andi Wijaya, M.Kom.", "FTI"],
	["SI", "Sistem Informasi", "Dr. Budi Santoso, M.T.", "FTI"],
	["MI", "Manajemen Informatika", "Ir. Cahyo Nugroho, M.Kom.", "FTI"],
	["MN", "Manajemen", "Prof. Diana Putri, M.M.", "FEB"],
	["AK", "Akuntansi", "Dr. Eko Prasetyo, M.Ak.", "FEB"],
	["HT", "Hukum Tata Negara", "Prof. Farida Hanum, S.H., M.H.", "FHUKUM"],
] as const;

const courseNameCatalog: Record<string, string[]> = {
	TI: [
		"Algoritma dan Pemrograman",
		"Struktur Data",
		"Basis Data",
		"Pemrograman Web",
		"Pemrograman Berorientasi Objek",
		"Jaringan Komputer",
		"Rekayasa Perangkat Lunak",
		"Keamanan Informasi",
	],
	SI: [
		"Analisis Sistem",
		"Perancangan Basis Data",
		"Pemodelan Proses Bisnis",
		"Sistem Enterprise",
		"Tata Kelola TI",
		"Interaksi Manusia dan Komputer",
		"Pengembangan Aplikasi Bisnis",
		"Visualisasi Data",
	],
	MI: [
		"Administrasi Sistem",
		"Pemrograman Dasar",
		"Desain UI",
		"Pengujian Perangkat Lunak",
		"Komputasi Awan",
		"Manajemen Infrastruktur",
		"Integrasi Aplikasi",
		"Pemrograman Mobile",
	],
	MN: [
		"Pengantar Manajemen",
		"Manajemen Operasi",
		"Manajemen Keuangan",
		"Manajemen Pemasaran",
		"Perilaku Organisasi",
		"Analisis Investasi",
		"Kewirausahaan",
		"Sistem Informasi Manajemen",
	],
	AK: [
		"Akuntansi Dasar",
		"Akuntansi Biaya",
		"Akuntansi Keuangan",
		"Perpajakan",
		"Sistem Informasi Akuntansi",
		"Audit Internal",
		"Pelaporan Korporat",
		"Akuntansi Sektor Publik",
	],
	HT: [
		"Hukum Tata Negara",
		"Hukum Pidana",
		"Hukum Perdata",
		"Hukum Administrasi Negara",
		"Hukum Acara",
		"Hukum Konstitusi",
		"Etika Profesi Hukum",
		"Advokasi Kebijakan Publik",
	],
};

const dayConfigs = [
	{ day: "SENIN", date: "2026-01-05" },
	{ day: "SELASA", date: "2026-01-06" },
	{ day: "RABU", date: "2026-01-07" },
	{ day: "KAMIS", date: "2026-01-08" },
	{ day: "JUMAT", date: "2026-01-09" },
	{ day: "SABTU", date: "2026-01-10" },
] as const;

const timeSlotConfigs = [
	{ start: "07:00:00", end: "08:40:00" },
	{ start: "08:50:00", end: "10:30:00" },
	{ start: "10:40:00", end: "12:20:00" },
	{ start: "13:00:00", end: "14:40:00" },
	{ start: "14:50:00", end: "16:30:00" },
	{ start: "16:40:00", end: "18:20:00" },
	{ start: "18:30:00", end: "20:10:00" },
	{ start: "20:15:00", end: "21:55:00" },
] as const;

const firstNames = [
	"Aditya",
	"Alya",
	"Bagas",
	"Bintang",
	"Cahya",
	"Cintia",
	"Daffa",
	"Dinda",
	"Fajar",
	"Farah",
	"Gilang",
	"Hana",
	"Intan",
	"Kezia",
	"Malik",
	"Nadia",
	"Putra",
	"Raka",
	"Salsa",
	"Tari",
];

const middleNames = [
	"Akbar",
	"Ananda",
	"Aulia",
	"Baskara",
	"Dwi",
	"Firdaus",
	"Kirana",
	"Mahendra",
	"Nugraha",
	"Permata",
	"Pratama",
	"Rahman",
	"Safira",
	"Saputra",
	"Utama",
	"Wibowo",
];

const lastNames = [
	"Gunawan",
	"Hakim",
	"Hidayat",
	"Kurniawan",
	"Lestari",
	"Maharani",
	"Maulana",
	"Ningsih",
	"Pangestu",
	"Prasetyo",
	"Putri",
	"Ramadhan",
	"Santoso",
	"Saputri",
	"Setiawan",
	"Wijaya",
];

type StudyProgramId = (typeof studyProgramRows)[number][0];

type StudentRecord = {
	id: string;
	auditSk: number;
	name: string;
	email: string;
	phone: string;
	address: string;
	yearAdmitted: number;
	studyProgramId: StudyProgramId;
};

type LecturerRecord = {
	id: string;
	auditSk: number;
	name: string;
	email: string;
	phone: string;
	address: string;
};

type CourseRecord = {
	id: string;
	auditSk: number;
	name: string;
	credits: number;
	studyProgramId: StudyProgramId;
	lecturerId: string;
	lecturerAuditSk: number;
};

type SlotRecord = {
	id: string;
	auditSk: number;
	classRoomId: string;
	classRoomAuditSk: number;
	day: (typeof dayConfigs)[number]["day"];
	date: string;
	start: string;
	end: string;
	lecturerId: string | null;
};

type ClassSessionRecord = SlotRecord & {
	courseId: string;
	enrollmentCount: number;
	maxStudents: number;
	studentBookingKey: string;
};

type ClassRoomSeedRow = [
	string,
	string,
	string,
	number,
	number,
	number,
	number,
];

const ACADEMIC_YEAR_START = Number.parseInt(ACADEMIC_YEAR.slice(0, 4), 10);
const SEMESTER_SORT = 2;

const streamRegistry = new Map<string, PassThrough>();

const baseSeedConfig = {
	host: process.env.DB_HOST || "localhost",
	user: process.env.DB_USER || "root",
	password: process.env.DB_PASSWORD || "",
	database: process.env.DB_NAME || "akademik_db",
	port: parseInt(process.env.DB_PORT || "3306", 10),
	timezone: "+00:00",
	charset: "utf8mb4",
	compress: true,
	infileStreamFactory: (path: string) => {
		const stream = streamRegistry.get(path);
		if (stream) return stream;
		return createReadStream(path);
	},
	enableKeepAlive: true,
	keepAliveInitialDelay: 10000,
	connectTimeout: 30000,
};

async function createSeedConnection() {
	return createConnection(baseSeedConfig);
}

async function configureSeedSession(conn: Connection) {
	await conn.query("SET SESSION foreign_key_checks = 0");
	await conn.query("SET SESSION unique_checks = 0");
}

async function restoreSeedSession(conn: Connection) {
	await conn.query("SET SESSION unique_checks = 1").catch(() => undefined);
	await conn.query("SET SESSION foreign_key_checks = 1").catch(() => undefined);
}

async function dropConflictAuditTriggers(conn: Connection) {
	await conn.query("DROP TRIGGER IF EXISTS courses_bi_audit_keys");
	await conn.query("DROP TRIGGER IF EXISTS courses_bu_audit_keys");
	await conn.query("DROP TRIGGER IF EXISTS courses_au_audit_keys");
	await conn.query("DROP TRIGGER IF EXISTS enrollments_bi_audit_keys");
	await conn.query("DROP TRIGGER IF EXISTS enrollments_bu_audit_keys");
}

function isIgnorableSchemaChangeError(error: unknown) {
	const code = (error as { code?: string })?.code;
	const message =
		(error as { sqlMessage?: string; message?: string })?.sqlMessage ??
		(error as Error)?.message ??
		"";
	return (
		code === "ER_DUP_KEYNAME" ||
		code === "ER_CANT_DROP_FIELD_OR_KEY" ||
		code === "ER_DROP_INDEX_FK" ||
		message.includes("check that column/key exists") ||
		message.includes("Duplicate key name") ||
		message.includes("needed in a foreign key constraint")
	);
}

async function ensureSharedScheduleEnrollmentSchema(conn: Connection) {
	const [nonUniqueRows] = await conn.query(
		`SELECT index_name
		 FROM information_schema.statistics
		 WHERE table_schema = DATABASE()
		   AND table_name = 'enrollments'
		   AND column_name = 'schedule_id'
		   AND non_unique = 1
		 LIMIT 1`,
	);

	if ((nonUniqueRows as unknown[]).length === 0) {
		await conn
			.query(
				"CREATE INDEX idx_enrollments_schedule_shared_seed ON enrollments(schedule_id)",
			)
			.catch((error) => {
				if (!isIgnorableSchemaChangeError(error)) throw error;
			});
	}

	const [rows] = await conn.query(
		`SELECT index_name
		 FROM information_schema.statistics
		 WHERE table_schema = DATABASE()
		   AND table_name = 'enrollments'
		   AND column_name = 'schedule_id'
		   AND non_unique = 0
		   AND index_name <> 'PRIMARY'`,
	);

	for (const row of rows as Array<{ index_name: string }>) {
		const indexName = row.index_name.replaceAll("`", "``");
		await conn
			.query(`ALTER TABLE enrollments DROP INDEX \`${indexName}\``)
			.catch((error) => {
				if (!isIgnorableSchemaChangeError(error)) throw error;
			});
	}
}

async function createConflictAuditTriggers(conn: Connection) {
	await conn.query(`
		CREATE TRIGGER courses_bi_audit_keys
		BEFORE INSERT ON courses
		FOR EACH ROW
		BEGIN
		  SET NEW.lecturer_audit_sk = (
		    SELECT l.audit_sk FROM lecturers l WHERE l.id = NEW.lecturer_id LIMIT 1
		  );
		END
	`);
	await conn.query(`
		CREATE TRIGGER courses_bu_audit_keys
		BEFORE UPDATE ON courses
		FOR EACH ROW
		BEGIN
		  IF NOT (OLD.lecturer_id <=> NEW.lecturer_id) THEN
		    SET NEW.lecturer_audit_sk = (
		      SELECT l.audit_sk FROM lecturers l WHERE l.id = NEW.lecturer_id LIMIT 1
		    );
		  END IF;
		END
	`);
	await conn.query(`
		CREATE TRIGGER courses_au_audit_keys
		AFTER UPDATE ON courses
		FOR EACH ROW
		BEGIN
		  IF NOT (OLD.lecturer_audit_sk <=> NEW.lecturer_audit_sk) THEN
		    UPDATE enrollments
		    SET lecturer_audit_sk = NEW.lecturer_audit_sk
		    WHERE course_id = NEW.id
		      AND lecturer_audit_sk <> NEW.lecturer_audit_sk;
		  END IF;
		END
	`);
	await conn.query(`
		CREATE TRIGGER enrollments_bi_audit_keys
		BEFORE INSERT ON enrollments
		FOR EACH ROW
		BEGIN
		  SET NEW.student_audit_sk = (SELECT s.audit_sk FROM students s WHERE s.id = NEW.student_id LIMIT 1);
		  SET NEW.course_audit_sk = (SELECT c.audit_sk FROM courses c WHERE c.id = NEW.course_id LIMIT 1);
		  SET NEW.lecturer_audit_sk = (SELECT c.lecturer_audit_sk FROM courses c WHERE c.id = NEW.course_id LIMIT 1);
		  SET NEW.class_room_audit_sk = (SELECT cr.audit_sk FROM class_rooms cr WHERE cr.id = NEW.class_room_id LIMIT 1);
		  SET NEW.schedule_audit_sk = (SELECT sch.audit_sk FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1);
		  SET NEW.academic_year_start = CAST(SUBSTRING(NEW.academic_year, 1, 4) AS UNSIGNED);
		  SET NEW.semester_sort = CASE
		    WHEN UPPER(NEW.semester) LIKE 'GAN%' THEN 1
		    WHEN UPPER(NEW.semester) LIKE 'GEN%' THEN 2
		    ELSE 9
		  END;
		END
	`);
	await conn.query(`
		CREATE TRIGGER enrollments_bu_audit_keys
		BEFORE UPDATE ON enrollments
		FOR EACH ROW
		BEGIN
		  IF NOT (OLD.student_id <=> NEW.student_id) THEN
		    SET NEW.student_audit_sk = (SELECT s.audit_sk FROM students s WHERE s.id = NEW.student_id LIMIT 1);
		  END IF;

		  IF NOT (OLD.course_id <=> NEW.course_id) THEN
		    SET NEW.course_audit_sk = (SELECT c.audit_sk FROM courses c WHERE c.id = NEW.course_id LIMIT 1);
		    SET NEW.lecturer_audit_sk = (SELECT c.lecturer_audit_sk FROM courses c WHERE c.id = NEW.course_id LIMIT 1);
		  END IF;

		  IF NOT (OLD.class_room_id <=> NEW.class_room_id) THEN
		    SET NEW.class_room_audit_sk = (SELECT cr.audit_sk FROM class_rooms cr WHERE cr.id = NEW.class_room_id LIMIT 1);
		  END IF;

		  IF NOT (OLD.schedule_id <=> NEW.schedule_id) THEN
		    SET NEW.schedule_audit_sk = (SELECT sch.audit_sk FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1);
		    SET NEW.schedule_day = (SELECT sch.day FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1);
		    SET NEW.schedule_start_time = (SELECT sch.start_time FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1);
		    SET NEW.schedule_end_time = (SELECT sch.end_time FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1);
		  END IF;

		  IF NOT (OLD.academic_year <=> NEW.academic_year) THEN
		    SET NEW.academic_year_start = CAST(SUBSTRING(NEW.academic_year, 1, 4) AS UNSIGNED);
		  END IF;

		  IF NOT (OLD.semester <=> NEW.semester) THEN
		    SET NEW.semester_sort = CASE
		      WHEN UPPER(NEW.semester) LIKE 'GAN%' THEN 1
		      WHEN UPPER(NEW.semester) LIKE 'GEN%' THEN 2
		      ELSE 9
		    END;
		  END IF;
		END
	`);
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
	if (!value) {
		return fallback;
	}

	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed <= 0) {
		return fallback;
	}

	return parsed;
}

function getInsertBatchSize() {
	const parsed = parsePositiveInteger(
		process.env.STRESS_SEED_BATCH_SIZE,
		DEFAULT_INSERT_BATCH_SIZE,
	);
	return Math.min(
		MAX_INSERT_BATCH_SIZE,
		Math.max(MIN_INSERT_BATCH_SIZE, parsed),
	);
}

function getStressSeedTargetRows() {
	return parsePositiveInteger(
		process.env.STRESS_SEED_TARGET_ROWS,
		DEFAULT_STRESS_SEED_TARGET_ROWS,
	);
}

function getStudentsPerClassSession() {
	const parsed = parsePositiveInteger(
		process.env.STRESS_SEED_STUDENTS_PER_SESSION,
		DEFAULT_STUDENTS_PER_CLASS_SESSION,
	);
	return Math.min(
		MAX_STUDENTS_PER_CLASS_SESSION,
		Math.max(MIN_STUDENTS_PER_CLASS_SESSION, parsed),
	);
}

function getClassRoomCountOverride() {
	if (!process.env.STRESS_SEED_CLASSROOM_COUNT) {
		return null;
	}

	const parsed = Number.parseInt(process.env.STRESS_SEED_CLASSROOM_COUNT, 10);
	if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed <= 0) {
		return null;
	}

	return parsed;
}

function getLecturerCountOverride() {
	if (!process.env.STRESS_SEED_LECTURER_COUNT) {
		return null;
	}

	const parsed = Number.parseInt(process.env.STRESS_SEED_LECTURER_COUNT, 10);
	if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed <= 0) {
		return null;
	}

	return parsed;
}

function getStudentCountOverride() {
	if (!process.env.STRESS_SEED_COUNT) {
		return null;
	}

	const parsed = Number.parseInt(process.env.STRESS_SEED_COUNT, 10);
	if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed <= 0) {
		return null;
	}

	return parsed;
}

function getStudentsWithThreeCoursesCount(studentCount: number) {
	return Math.floor((studentCount + 4) / 5);
}

function getEnrollmentCount(studentCount: number) {
	return studentCount * 2 + getStudentsWithThreeCoursesCount(studentCount);
}

function getGradeCount(enrollmentCount: number) {
	const intentionalConflictEnrollmentCount =
		getIntentionalConflictEnrollmentCount();
	if (enrollmentCount <= intentionalConflictEnrollmentCount) {
		return 0;
	}

	const eligibleEnrollments =
		enrollmentCount - intentionalConflictEnrollmentCount;
	const fullBlocks = Math.floor(eligibleEnrollments / 10);
	const remainder = eligibleEnrollments % 10;
	return fullBlocks * 7 + Math.min(7, remainder);
}

function getScheduleCount(enrollmentCount: number) {
	const intentionalConflictEnrollmentCount =
		getIntentionalConflictEnrollmentCount();
	if (enrollmentCount <= intentionalConflictEnrollmentCount) {
		return enrollmentCount;
	}

	const regularEnrollmentCount =
		enrollmentCount - intentionalConflictEnrollmentCount;
	return (
		intentionalConflictEnrollmentCount +
		Math.ceil(regularEnrollmentCount / getStudentsPerClassSession())
	);
}

function getIntentionalConflictEnrollmentCount() {
	return (
		INTENTIONAL_CONFLICT_GROUP_COUNT * INTENTIONAL_CONFLICT_MEMBERS_PER_GROUP
	);
}

function getClassRoomCount(scheduleCount: number) {
	const override = getClassRoomCountOverride();
	if (override) return override;

	const slotsPerRoom = dayConfigs.length * timeSlotConfigs.length;
	const conflictRoomReserve = 1;
	// TIME-based conflict detection has no week dimension, so rooms must scale
	// with total schedules to keep non-conflict rows unique by room/day/time.
	return Math.max(
		28,
		Math.ceil((scheduleCount / Math.max(1, slotsPerRoom)) * 1.25) +
			conflictRoomReserve,
	);
}

function estimateTotalRows(studentCount: number) {
	const lecturerCount = getLecturerCount(studentCount);
	const enrollmentCount = getEnrollmentCount(studentCount);
	const gradeCount = getGradeCount(enrollmentCount);
	const courseCount = Object.values(courseNameCatalog).reduce(
		(sum, names) => sum + names.length,
		0,
	);
	const scheduleCount = getScheduleCount(enrollmentCount);
	const classRoomCount = getClassRoomCount(scheduleCount);

	return (
		1 +
		facultyRows.length +
		studyProgramRows.length +
		classRoomCount +
		lecturerCount +
		lecturerCount +
		courseCount +
		studentCount +
		studentCount +
		scheduleCount +
		enrollmentCount +
		gradeCount
	);
}

function deriveStudentCountFromTargetRows(targetRows: number) {
	let low = 1;
	let high = Math.max(1, Math.ceil(targetRows / 6));

	while (estimateTotalRows(high) < targetRows) {
		high *= 2;
	}

	while (low < high) {
		const mid = Math.floor((low + high) / 2);
		if (estimateTotalRows(mid) >= targetRows) high = mid;
		else low = mid + 1;
	}

	return low;
}

function getStressSeedPlan() {
	const minimumStudentCount = getIntentionalConflictEnrollmentCount();
	const explicitStudentCount = getStudentCountOverride();
	if (explicitStudentCount) {
		const studentCount = Math.max(explicitStudentCount, minimumStudentCount);
		return {
			mode: "student-count" as const,
			studentCount,
			targetRows: estimateTotalRows(studentCount),
		};
	}

	const targetRows = getStressSeedTargetRows();
	const studentCount = Math.max(
		deriveStudentCountFromTargetRows(targetRows),
		minimumStudentCount,
	);
	return {
		mode: "target-rows" as const,
		studentCount,
		targetRows,
	};
}

function buildPersonName(index: number, suffix: string) {
	const firstName = firstNames[index % firstNames.length];
	const middleName =
		middleNames[Math.floor(index / firstNames.length) % middleNames.length];
	const lastName =
		lastNames[
			Math.floor(index / (firstNames.length * middleNames.length)) %
				lastNames.length
		];
	return `${firstName} ${middleName} ${lastName} ${suffix}${String(index + 1).padStart(6, "0")}`;
}

function buildStudentId(index: number) {
	return `${STUDENT_ID_PREFIX}${String(index + 1).padStart(4, "0")}`;
}

function buildStudentEmail(index: number) {
	return `student.${String(index + 1).padStart(4, "0")}@stress.watum.ac.id`;
}

function buildStudentPhone(index: number) {
	return `0817${String(index + 1).padStart(8, "0")}`;
}

function buildStudentAddress(index: number) {
	return `Jl. Stress Mahasiswa No. ${index + 1}, Dataset ${(index % 25) + 1}`;
}

function buildStudentYearAdmitted(index: number) {
	return 2021 + (index % 5);
}

function buildUserId(index: number) {
	return `${USER_ID_PREFIX}${String(index + 1).padStart(4, "0")}`;
}

function buildLecturerId(index: number) {
	return `${LECTURER_ID_PREFIX}${String(index + 1).padStart(4, "0")}`;
}

function buildLecturerEmail(index: number) {
	return `lecturer.${String(index + 1).padStart(4, "0")}@stress.watum.ac.id`;
}

function buildLecturerPhone(index: number) {
	return `0818${String(index + 1).padStart(8, "0")}`;
}

function buildLecturerAddress(index: number) {
	return `Jl. Stress Dosen No. ${index + 1}, Dataset ${(index % 12) + 1}`;
}

function buildLecturerUserId(index: number) {
	return `${LECTURER_USER_ID_PREFIX}${String(index + 1).padStart(4, "0")}`;
}

function buildClassRooms(targetCount: number = 28) {
	const rows: ClassRoomSeedRow[] = [];
	const count = Math.max(1, Math.floor(targetCount));
	const regularCount = Math.max(1, Math.floor(count * 0.72));
	const labCount = Math.max(0, Math.floor(count * 0.2));
	const auditoriumCount = Math.max(0, count - regularCount - labCount);

	for (let index = 0; index < regularCount; index += 1) {
		rows.push([
			`${CLASSROOM_ID_PREFIX}reg-${String(index + 1).padStart(3, "0")}`,
			`Ruang ${100 + index + 1}`,
			"REGULER",
			40 + (index % 3) * 5,
			1,
			1,
			index + 1,
		]);
	}

	for (let index = 0; index < labCount; index += 1) {
		rows.push([
			`${CLASSROOM_ID_PREFIX}lab-${String(index + 1).padStart(3, "0")}`,
			`Lab Komputer ${index + 1}`,
			"LAB_KOMPUTER",
			30,
			1,
			1,
			regularCount + index + 1,
		]);
	}

	for (let index = 0; index < auditoriumCount; index += 1) {
		rows.push([
			`${CLASSROOM_ID_PREFIX}aud-${String(index + 1).padStart(3, "0")}`,
			`Auditorium ${index + 1}`,
			"AUDITORIUM",
			180 + (index % 2) * 40,
			1,
			1,
			regularCount + labCount + index + 1,
		]);
	}

	return rows.slice(0, count);
}

function getLecturerCount(studentCount: number) {
	return (
		getLecturerCountOverride() ?? Math.max(48, Math.ceil(studentCount / 5000))
	);
}

function buildLecturers(count: number) {
	const lecturers: LecturerRecord[] = [];
	for (let index = 0; index < count; index += 1) {
		lecturers.push({
			id: buildLecturerId(index),
			auditSk: index + 1,
			name: buildPersonName(index + 700, "DSN"),
			email: buildLecturerEmail(index),
			phone: buildLecturerPhone(index),
			address: buildLecturerAddress(index),
		});
	}
	return lecturers;
}

function buildCourses(lecturers: LecturerRecord[]) {
	const courses: CourseRecord[] = [];
	let courseIndex = 0;

	for (const [studyProgramId] of studyProgramRows) {
		for (const [titleIndex, courseName] of courseNameCatalog[
			studyProgramId
		].entries()) {
			const lecturer = lecturers[courseIndex % lecturers.length];
			courses.push({
				id: `${COURSE_ID_PREFIX}${studyProgramId.toLowerCase()}-${String(titleIndex + 1).padStart(2, "0")}`,
				auditSk: courseIndex + 1,
				name: courseName,
				credits: titleIndex % 3 === 0 ? 2 : 3,
				studyProgramId,
				lecturerId: lecturer.id,
				lecturerAuditSk: lecturer.auditSk,
			});
			courseIndex += 1;
		}
	}

	return courses;
}

function buildStudent(index: number): StudentRecord {
	return {
		id: buildStudentId(index),
		auditSk: index + 1,
		name: buildPersonName(index, "MHS"),
		email: buildStudentEmail(index),
		phone: buildStudentPhone(index),
		address: buildStudentAddress(index),
		yearAdmitted: buildStudentYearAdmitted(index),
		studyProgramId: studyProgramRows[index % studyProgramRows.length][0],
	};
}

function addDaysToDate(date: string, daysToAdd: number) {
	const next = new Date(`${date}T00:00:00Z`);
	next.setUTCDate(next.getUTCDate() + daysToAdd);
	return next.toISOString().slice(0, 10);
}

const lecturerCounters = new Map<number, number>();
const lecturerOffsets = new Map<number, number>();
const roomBookings = new Set<string>();
const studentBookings = new Map<number, Set<string>>();
const lecturerBookings = new Map<number, Set<string>>();
const classSessionsByCourse = new Map<string, ClassSessionRecord[]>();

function getLecturerOffset(
	lecturerAuditSk: number,
	totalTimeSlots: number,
): number {
	if (!lecturerOffsets.has(lecturerAuditSk)) {
		const hash = (lecturerAuditSk * 0x9e3779b9) % totalTimeSlots;
		lecturerOffsets.set(lecturerAuditSk, Math.abs(hash));
	}
	return lecturerOffsets.get(lecturerAuditSk)!;
}

function getStudentBookingKey(
	day: (typeof dayConfigs)[number]["day"],
	start: string,
) {
	return `${day}:${start}`;
}

function getRoomBookingKey(
	roomAuditSk: number,
	day: (typeof dayConfigs)[number]["day"],
	start: string,
) {
	return `${roomAuditSk}:${day}:${start}`;
}

function getStudentBookingSet(studentAuditSk: number) {
	let set = studentBookings.get(studentAuditSk);
	if (!set) {
		set = new Set();
		studentBookings.set(studentAuditSk, set);
	}
	return set;
}

function getLecturerBookingSet(lecturerAuditSk: number) {
	let set = lecturerBookings.get(lecturerAuditSk);
	if (!set) {
		set = new Set();
		lecturerBookings.set(lecturerAuditSk, set);
	}
	return set;
}

function buildIntentionalConflictSlot(
	scheduleIndex: number,
	intentionalConflictOrdinal: number | null,
	course: CourseRecord,
	student: StudentRecord,
	classRoomIds: string[],
	classRoomAuditById: Map<string, number>,
): SlotRecord | null {
	if (intentionalConflictOrdinal == null) return null;

	const conflictRoomId = classRoomIds.at(-1) ?? classRoomIds[0];
	const groupIndex = Math.floor(
		intentionalConflictOrdinal / INTENTIONAL_CONFLICT_MEMBERS_PER_GROUP,
	);
	const dayConfig =
		dayConfigs[
			Math.floor(groupIndex / timeSlotConfigs.length) % dayConfigs.length
		];
	const timeSlot = timeSlotConfigs[groupIndex % timeSlotConfigs.length];
	const roomAuditSk = classRoomAuditById.get(conflictRoomId) ?? 1;
	const studentKey = getStudentBookingKey(dayConfig.day, timeSlot.start);
	roomBookings.add(
		getRoomBookingKey(roomAuditSk, dayConfig.day, timeSlot.start),
	);
	getStudentBookingSet(student.auditSk).add(studentKey);
	getLecturerBookingSet(course.lecturerAuditSk).add(studentKey);
	return {
		id: `${SCHEDULE_ID_PREFIX}conf-${String(scheduleIndex + 1).padStart(5, "0")}`,
		auditSk: scheduleIndex + 1,
		classRoomId: conflictRoomId,
		classRoomAuditSk: roomAuditSk,
		day: dayConfig.day,
		date: dayConfig.date,
		start: timeSlot.start,
		end: timeSlot.end,
		lecturerId: course.lecturerId,
	};
}

function buildNewClassSession(
	scheduleIndex: number,
	course: CourseRecord,
	student: StudentRecord,
	classRoomIds: string[],
	classRoomAuditById: Map<string, number>,
	classRoomCapacityById: Map<string, number>,
	studentsPerSession: number,
): ClassSessionRecord {
	const conflictRoomId = classRoomIds.at(-1) ?? classRoomIds[0];
	const usableRoomIds = classRoomIds.slice(0, -1);

	const lecturerAuditSk = course.lecturerAuditSk;
	const counter = lecturerCounters.get(lecturerAuditSk) ?? 0;
	const totalTimeSlots = dayConfigs.length * timeSlotConfigs.length;
	const offset = getLecturerOffset(lecturerAuditSk, totalTimeSlots);
	const lecturerSet = getLecturerBookingSet(lecturerAuditSk);

	const maxAttempts = totalTimeSlots * Math.max(1, usableRoomIds.length) * 20;
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const effectiveCounter = counter + offset + attempt;
		const timeSlotIndex = effectiveCounter % totalTimeSlots;
		const weekOffset = Math.floor(effectiveCounter / totalTimeSlots);
		const roomIndex =
			((lecturerAuditSk * 0x9e3779b9 + effectiveCounter * 0x85ebca6b) >>> 0) %
			Math.max(1, usableRoomIds.length);
		const dayIndex = Math.floor(timeSlotIndex / timeSlotConfigs.length);
		const timeIndex = timeSlotIndex % timeSlotConfigs.length;
		const dayConfig = dayConfigs[dayIndex];
		const timeSlot = timeSlotConfigs[timeIndex];
		const roomId = usableRoomIds[roomIndex] ?? conflictRoomId;
		const roomAuditSk = classRoomAuditById.get(roomId) ?? 1;
		const capacity = classRoomCapacityById.get(roomId) ?? studentsPerSession;

		const roomKey = getRoomBookingKey(
			roomAuditSk,
			dayConfig.day,
			timeSlot.start,
		);
		const studentKey = getStudentBookingKey(dayConfig.day, timeSlot.start);
		const studentSet = studentBookings.get(student.auditSk);

		if (
			!roomBookings.has(roomKey) &&
			!lecturerSet.has(studentKey) &&
			!studentSet?.has(studentKey)
		) {
			roomBookings.add(roomKey);
			lecturerSet.add(studentKey);
			getStudentBookingSet(student.auditSk).add(studentKey);
			lecturerCounters.set(lecturerAuditSk, counter + attempt + 1);

			return {
				id: `${SCHEDULE_ID_PREFIX}base-${String(scheduleIndex + 1).padStart(5, "0")}`,
				auditSk: scheduleIndex + 1,
				classRoomId: roomId,
				classRoomAuditSk: roomAuditSk,
				day: dayConfig.day,
				date: addDaysToDate(dayConfig.date, weekOffset * 7),
				start: timeSlot.start,
				end: timeSlot.end,
				lecturerId: course.lecturerId,
				courseId: course.id,
				enrollmentCount: 1,
				maxStudents: Math.max(1, Math.min(studentsPerSession, capacity)),
				studentBookingKey: studentKey,
			};
		}
	}

	throw new Error(
		`Could not find available class session (course ${course.id}, lecturer ${course.lecturerId}, student ${student.id})`,
	);
}

function findReusableClassSession(
	course: CourseRecord,
	student: StudentRecord,
) {
	const sessions = classSessionsByCourse.get(course.id) ?? [];
	const studentSet = studentBookings.get(student.auditSk);
	return sessions.find(
		(session) =>
			session.enrollmentCount < session.maxStudents &&
			!studentSet?.has(session.studentBookingKey),
	);
}

function registerClassSession(session: ClassSessionRecord) {
	const sessions = classSessionsByCourse.get(session.courseId) ?? [];
	sessions.push(session);
	classSessionsByCourse.set(session.courseId, sessions);
}

function fastFormatValue(value: unknown): string {
	if (value == null) {
		return "\\N";
	}
	return String(value);
}

// Note: fastFormatValue skips escaping because all data generated by this script
// is guaranteed to not contain tabs, newlines, backslashes, or carriage returns.
// If data generation is changed to include special characters, restore full escaping here.

async function loadRowsWithLocalInfile(
	conn: Connection | PoolConnection,
	fileName: string,
	tableName: string,
	columns: string[],
	rows: unknown[][],
) {
	if (rows.length === 0) {
		return;
	}

	const virtualPath = `__mem__/${fileName}`;
	const content = rows
		.map((row) => row.map(fastFormatValue).join("\t"))
		.join("\n");
	const stream = new PassThrough();
	stream.end(`${content}\n`);
	streamRegistry.set(virtualPath, stream);

	try {
		await conn.query(
			`LOAD DATA LOCAL INFILE '${virtualPath}'
			 INTO TABLE ${tableName}
			 CHARACTER SET utf8mb4
			 FIELDS TERMINATED BY '\t'
			 ESCAPED BY '\\\\'
			 LINES TERMINATED BY '\n'
			 (${columns.join(", ")})`,
		);
	} catch (error) {
		const message = (
			error as { code?: string; sqlMessage?: string; message?: string }
		)?.sqlMessage;
		const shouldFallback =
			(error as { code?: string })?.code === "ER_ERROR_DURING_COMMIT" ||
			message?.includes("Operation not permitted") ||
			(error as Error)?.message?.includes("Operation not permitted");

		if (!shouldFallback) {
			throw error;
		}

		console.warn(
			`LOAD DATA LOCAL INFILE failed for ${tableName}; falling back to batched INSERT for this chunk.`,
		);
		await conn.query("ROLLBACK").catch(() => undefined);
		await insertRowsInBatches(
			conn,
			`INSERT INTO ${tableName} (${columns.join(", ")}) VALUES ?`,
			rows,
			Math.min(getInsertBatchSize(), 500),
		);
	} finally {
		streamRegistry.delete(virtualPath);
	}
}

function isRecoverableBulkInsertError(error: unknown) {
	return (
		(error as { code?: string })?.code === "ER_ERROR_DURING_COMMIT" ||
		(error as { sqlMessage?: string })?.sqlMessage?.includes(
			"Operation not permitted",
		) ||
		(error as Error)?.message?.includes("Operation not permitted")
	);
}

async function insertRowsInBatches<T>(
	conn: Connection,
	sql: string,
	rows: T[],
	batchSize: number,
) {
	if (rows.length === 0) {
		return;
	}

	if (rows.length <= batchSize) {
		try {
			await conn.query(sql, [rows]);
		} catch (error) {
			if (!isRecoverableBulkInsertError(error) || rows.length === 1) {
				throw error;
			}

			await conn.query("ROLLBACK").catch(() => undefined);
			const midpoint = Math.floor(rows.length / 2);
			await insertRowsInBatches(conn, sql, rows.slice(0, midpoint), midpoint);
			await insertRowsInBatches(
				conn,
				sql,
				rows.slice(midpoint),
				rows.length - midpoint,
			);
		}
		return;
	}

	for (let offset = 0; offset < rows.length; offset += batchSize) {
		await insertRowsInBatches(
			conn,
			sql,
			rows.slice(offset, offset + batchSize),
			batchSize,
		);
	}
}

function formatScheduleDate(_date: string, time: string) {
	return time;
}

function calculateGrade(studentIndex: number, enrollmentIndex: number) {
	const assignment = 60 + ((studentIndex * 7 + enrollmentIndex * 3) % 35);
	const midterm = 58 + ((studentIndex * 5 + enrollmentIndex * 5) % 37);
	const final = 62 + ((studentIndex * 11 + enrollmentIndex * 2) % 33);
	const total = assignment * 0.3 + midterm * 0.3 + final * 0.4;

	let letter = "E";
	if (total >= 85) letter = "A";
	else if (total >= 70) letter = "B";
	else if (total >= 55) letter = "C";
	else if (total >= 40) letter = "D";

	return {
		assignment,
		midterm,
		final,
		total: Number(total.toFixed(2)),
		letter,
	};
}

async function resetDatabase(conn: Connection) {
	const tablesToTruncate = [
		"grades",
		"enrollments",
		"schedules",
		"courses",
		"refresh_tokens",
		"students",
		"lecturers",
		"class_rooms",
		"study_programs",
		"faculties",
	];

	for (const tableName of tablesToTruncate) {
		await conn.query(`TRUNCATE TABLE ${tableName}`);
	}

	await conn.query("DELETE FROM users WHERE id <> ?", [DEFAULT_ADMIN_ID]);
	await conn.query(
		`INSERT INTO users (id, email, password, role, student_id, lecturer_id)
		 VALUES (?, ?, ?, 'ADMIN', NULL, NULL)
		 ON DUPLICATE KEY UPDATE
		   email = VALUES(email),
		   password = VALUES(password),
		   role = 'ADMIN',
		   student_id = NULL,
		   lecturer_id = NULL`,
		[DEFAULT_ADMIN_ID, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD_HASH],
	);
}

async function seedStressData() {
	const plan = getStressSeedPlan();
	const studentCount = plan.studentCount;
	const batchSize = getInsertBatchSize();
	const studentsPerSession = getStudentsPerClassSession();
	const lecturerCount = getLecturerCount(studentCount);
	const courseCount = Object.values(courseNameCatalog).reduce(
		(sum, names) => sum + names.length,
		0,
	);
	// Reset global booking state for a fresh seed
	lecturerCounters.clear();
	lecturerOffsets.clear();
	roomBookings.clear();
	studentBookings.clear();
	lecturerBookings.clear();
	classSessionsByCourse.clear();

	const estimatedEnrollmentCount = getEnrollmentCount(studentCount);
	const estimatedScheduleCount = getScheduleCount(estimatedEnrollmentCount);
	const estimatedGradeCount = getGradeCount(estimatedEnrollmentCount);
	const estimatedTotalRows = estimateTotalRows(studentCount);
	const classRoomCount = getClassRoomCount(estimatedScheduleCount);
	const classRoomRows = buildClassRooms(classRoomCount);
	const classRoomIds = classRoomRows.map((row) => row[0]);
	const classRoomAuditById = new Map(
		classRoomRows.map((row) => [row[0], row[6]]),
	);
	const classRoomCapacityById = new Map(
		classRoomRows.map((row) => [row[0], row[3]]),
	);
	const lecturers = buildLecturers(lecturerCount);
	const courses = buildCourses(lecturers);
	const coursesByProgram = new Map<StudyProgramId, CourseRecord[]>();

	for (const course of courses) {
		const programCourses = coursesByProgram.get(course.studyProgramId) ?? [];
		programCourses.push(course);
		coursesByProgram.set(course.studyProgramId, programCourses);
	}

	console.log(
		`Resetting database and seeding approximately ${estimatedTotalRows.toLocaleString()} rows...`,
	);
	console.log(
		plan.mode === "student-count"
			? `  Using explicit student count override: ${studentCount.toLocaleString()} students`
			: `  Soft target rows: ${plan.targetRows.toLocaleString()}+ | derived students: ${studentCount.toLocaleString()}`,
	);
	console.log(
		`  Insert batch size: ${batchSize.toLocaleString()} students per batch`,
	);
	console.log(`  Estimated rows: ${estimatedTotalRows.toLocaleString()}`);
	console.log(
		`  Target students per class session: ${studentsPerSession.toLocaleString()}`,
	);
	console.log(`  Classrooms: ${classRoomRows.length.toLocaleString()}`);
	console.log(
		`  Intentional conflict groups: ${INTENTIONAL_CONFLICT_GROUP_COUNT}`,
	);

	let conn: Connection | null = null;
	let auditTriggersDropped = false;
	try {
		const [seedConn, lecturerPasswordHash, studentPasswordHash] =
			await Promise.all([
				createSeedConnection(),
				hash("stresslecturer123"),
				hash("stress123"),
			]);
		conn = seedConn;

		await configureSeedSession(seedConn);

		await resetDatabase(seedConn);
		await ensureSharedScheduleEnrollmentSchema(seedConn);
		await dropConflictAuditTriggers(seedConn);
		auditTriggersDropped = true;

		console.log("  Inserting faculties, study programs, and classrooms...");
		await seedConn.query("INSERT INTO faculties (id, name) VALUES ?", [
			facultyRows,
		]);
		await seedConn.query(
			"INSERT INTO study_programs (id, name, head, faculty_id) VALUES ?",
			[studyProgramRows],
		);
		await seedConn.query(
			`INSERT INTO class_rooms (id, name, class_room_type, capacity, has_projector, has_ac, audit_sk)
			 VALUES ?`,
			[classRoomRows],
		);

		console.log("  Inserting lecturers, courses, and lecturer users...");
		await loadRowsWithLocalInfile(
			seedConn,
			"lecturers.tsv",
			"lecturers",
			["id", "audit_sk", "name", "email", "phone", "address"],
			lecturers.map((lecturer) => [
				lecturer.id,
				lecturer.auditSk,
				lecturer.name,
				lecturer.email,
				lecturer.phone,
				lecturer.address,
			]),
		);

		await loadRowsWithLocalInfile(
			seedConn,
			"courses.tsv",
			"courses",
			[
				"id",
				"audit_sk",
				"name",
				"credits",
				"study_program_id",
				"lecturer_id",
				"lecturer_audit_sk",
			],
			courses.map((course) => [
				course.id,
				course.auditSk,
				course.name,
				course.credits,
				course.studyProgramId,
				course.lecturerId,
				course.lecturerAuditSk,
			]),
		);

		await loadRowsWithLocalInfile(
			seedConn,
			"lecturer-users.tsv",
			"users",
			["id", "email", "password", "role", "student_id", "lecturer_id"],
			lecturers.map((lecturer, index) => [
				buildLecturerUserId(index),
				lecturer.email,
				lecturerPasswordHash,
				"LECTURER",
				null,
				lecturer.id,
			]),
		);

		console.log("  Building schedules, enrollments, and grades...");

		let enrollmentIndex = 0;
		let scheduleIndex = 0;
		let gradeIndex = 0;
		const totalBatches = Math.ceil(studentCount / batchSize);

		async function processBatch(batchStart: number, batchEnd: number) {
			const studentRows: Array<
				[string, number, string, string, string, string, number, string]
			> = [];
			const studentUserRows: Array<
				[string, string, string, string, string, null]
			> = [];
			const scheduleRows: Array<
				[string, number, string, string, string, string, string | null]
			> = [];
			const enrollmentRows: Array<
				[
					string,
					number,
					string,
					number,
					string,
					number,
					number,
					string,
					number,
					string,
					number,
					string,
					string,
					string,
					string,
					string,
					number,
					number,
				]
			> = [];
			const gradeRows: Array<
				[string, string, number, number, number, number, string]
			> = [];

			for (
				let studentIndex = batchStart;
				studentIndex < batchEnd;
				studentIndex += 1
			) {
				const student = buildStudent(studentIndex);
				studentRows.push([
					student.id,
					student.auditSk,
					student.name,
					student.email,
					student.phone,
					student.address,
					student.yearAdmitted,
					student.studyProgramId,
				]);
				studentUserRows.push([
					buildUserId(studentIndex),
					student.email,
					studentPasswordHash,
					"STUDENT",
					student.id,
					null,
				]);

				const programCourses =
					coursesByProgram.get(student.studyProgramId) ?? [];
				const courseCount = studentIndex % 5 === 0 ? 3 : 2;
				const startOffset = (studentIndex * 5) % programCourses.length;

				for (let offset = 0; offset < courseCount; offset += 1) {
					const course =
						programCourses[(startOffset + offset) % programCourses.length];
					const enrollmentId = `${ENROLLMENT_ID_PREFIX}${String(enrollmentIndex + 1).padStart(5, "0")}`;
					const intentionalConflictOrdinal =
						offset === 0 &&
						studentIndex < getIntentionalConflictEnrollmentCount()
							? studentIndex
							: null;
					let slot = buildIntentionalConflictSlot(
						scheduleIndex,
						intentionalConflictOrdinal,
						course,
						student,
						classRoomIds,
						classRoomAuditById,
					);
					let shouldCreateSchedule = false;
					if (slot) {
						shouldCreateSchedule = true;
						scheduleIndex += 1;
					} else {
						let session = findReusableClassSession(course, student);
						if (session) {
							session.enrollmentCount += 1;
							getStudentBookingSet(student.auditSk).add(
								session.studentBookingKey,
							);
						} else {
							session = buildNewClassSession(
								scheduleIndex,
								course,
								student,
								classRoomIds,
								classRoomAuditById,
								classRoomCapacityById,
								studentsPerSession,
							);
							registerClassSession(session);
							shouldCreateSchedule = true;
							scheduleIndex += 1;
						}
						slot = session;
					}
					const studentAuditSk = student.auditSk;
					const courseAuditSk = course.auditSk;
					const lecturerAuditSk = course.lecturerAuditSk;

					if (shouldCreateSchedule) {
						scheduleRows.push([
							slot.id,
							slot.auditSk,
							slot.classRoomId,
							slot.day,
							formatScheduleDate(slot.date, slot.start),
							formatScheduleDate(slot.date, slot.end),
							slot.lecturerId,
						]);
					}

					enrollmentRows.push([
						enrollmentId,
						enrollmentIndex + 1,
						student.id,
						studentAuditSk,
						course.id,
						courseAuditSk,
						lecturerAuditSk,
						slot.classRoomId,
						slot.classRoomAuditSk,
						slot.id,
						slot.auditSk,
						slot.day,
						formatScheduleDate(slot.date, slot.start),
						formatScheduleDate(slot.date, slot.end),
						SEMESTER,
						ACADEMIC_YEAR,
						ACADEMIC_YEAR_START,
						SEMESTER_SORT,
					]);

					const shouldGrade =
						enrollmentIndex >= getIntentionalConflictEnrollmentCount() &&
						enrollmentIndex % 10 < 7;
					if (shouldGrade) {
						const grade = calculateGrade(studentIndex, enrollmentIndex);
						gradeIndex += 1;
						gradeRows.push([
							`${GRADE_ID_PREFIX}${String(gradeIndex).padStart(5, "0")}`,
							enrollmentId,
							grade.assignment,
							grade.midterm,
							grade.final,
							grade.total,
							grade.letter,
						]);
					}

					enrollmentIndex += 1;
				}
			}

			// Stage 1: students and schedules can be loaded in parallel
			await Promise.all([
				loadRowsWithLocalInfile(
					seedConn,
					`students-${batchStart}.tsv`,
					"students",
					[
						"id",
						"audit_sk",
						"name",
						"email",
						"phone",
						"address",
						"year_admitted",
						"study_program_id",
					],
					studentRows,
				),
				loadRowsWithLocalInfile(
					seedConn,
					`schedules-${batchStart}.tsv`,
					"schedules",
					[
						"id",
						"audit_sk",
						"class_room_id",
						"day",
						"start_time",
						"end_time",
						"lecturer_id",
					],
					scheduleRows,
				),
			]);

			// Stage 2: users and enrollments depend on students/schedules
			await Promise.all([
				loadRowsWithLocalInfile(
					seedConn,
					`student-users-${batchStart}.tsv`,
					"users",
					["id", "email", "password", "role", "student_id", "lecturer_id"],
					studentUserRows,
				),
				loadRowsWithLocalInfile(
					seedConn,
					`enrollments-${batchStart}.tsv`,
					"enrollments",
					[
						"id",
						"audit_sk",
						"student_id",
						"student_audit_sk",
						"course_id",
						"course_audit_sk",
						"lecturer_audit_sk",
						"class_room_id",
						"class_room_audit_sk",
						"schedule_id",
						"schedule_audit_sk",
						"schedule_day",
						"schedule_start_time",
						"schedule_end_time",
						"semester",
						"academic_year",
						"academic_year_start",
						"semester_sort",
					],
					enrollmentRows,
				),
			]);

			// Stage 3: grades depend on enrollments
			await loadRowsWithLocalInfile(
				seedConn,
				`grades-${batchStart}.tsv`,
				"grades",
				[
					"id",
					"enrollment_id",
					"assignment_score",
					"midterm_score",
					"final_score",
					"total_score",
					"letter_grade",
				],
				gradeRows,
			);
		}

		for (
			let batchStart = 0;
			batchStart < studentCount;
			batchStart += batchSize
		) {
			const batchEnd = Math.min(studentCount, batchStart + batchSize);
			await processBatch(batchStart, batchEnd);

			const completedBatches = Math.ceil(batchEnd / batchSize);
			if (completedBatches === totalBatches || completedBatches % 10 === 0) {
				console.log(
					`  Processed batch ${completedBatches.toLocaleString()} / ${totalBatches.toLocaleString()} (${batchEnd.toLocaleString()} students)`,
				);
			}
		}

		await createConflictAuditTriggers(seedConn);
		auditTriggersDropped = false;
	} finally {
		if (conn && auditTriggersDropped) {
			await createConflictAuditTriggers(conn).catch(() => undefined);
		}
		if (conn) {
			await restoreSeedSession(conn);
			await conn.end().catch(() => undefined);
		}
	}
	console.log("Stress-test seed complete!");
	console.log(`  Default admin preserved: ${DEFAULT_ADMIN_EMAIL}`);
	console.log(`  Students created: ${studentCount.toLocaleString()}`);
	console.log(`  Student users created: ${studentCount.toLocaleString()}`);
	console.log(`  Lecturer users created: ${lecturerCount.toLocaleString()}`);
	console.log(`  Courses created: ${courseCount.toLocaleString()}`);
	console.log(
		`  Estimated schedules created: ${estimatedScheduleCount.toLocaleString()}`,
	);
	console.log(`  Classrooms created: ${classRoomRows.length}`);
	console.log(
		`  Enrollments created: ${estimatedEnrollmentCount.toLocaleString()}`,
	);
	console.log(`  Grades created: ${estimatedGradeCount.toLocaleString()}`);
	console.log(
		`  Estimated total rows created: ${estimatedTotalRows.toLocaleString()}`,
	);
	console.log(
		`  Intentional conflict groups: ${INTENTIONAL_CONFLICT_GROUP_COUNT}`,
	);
	console.log(
		`  Intentional conflicting schedules: ${getIntentionalConflictEnrollmentCount()}`,
	);
	console.log("  Student password: stress123");
	console.log("  Lecturer password: stresslecturer123");
}

seedStressData()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("Stress seed failed:", err);
		process.exit(1);
	});
