import 'dotenv/config';
import { hash } from 'argon2';
import { createPool, type Connection, type Pool } from 'mysql2/promise';

const MIN_STRESS_SEED_COUNT = 300;
const MAX_STRESS_SEED_COUNT = 500;
const DEFAULT_STRESS_SEED_COUNT = 400;
const DEFAULT_ADMIN_ID = 'admin-default';
const DEFAULT_ADMIN_EMAIL = 'admin@watum.local';
const DEFAULT_ADMIN_PASSWORD_HASH =
	'$argon2id$v=19$m=65536,t=3,p=4$TC2FXN7fXfwlswrRL4hTzQ$ASiXrlPTYumXqldaajKCtfKPUbuh1wmz1+f+HMwkd0M';
const STUDENT_ID_PREFIX = 'stress-mhs-';
const USER_ID_PREFIX = 'stress-user-';
const LECTURER_ID_PREFIX = 'stress-lec-';
const LECTURER_USER_ID_PREFIX = 'stress-user-lec-';
const COURSE_ID_PREFIX = 'stress-course-';
const CLASSROOM_ID_PREFIX = 'stress-room-';
const SCHEDULE_ID_PREFIX = 'stress-sch-';
const ENROLLMENT_ID_PREFIX = 'stress-enr-';
const GRADE_ID_PREFIX = 'stress-grade-';
const CONFLICTING_SCHEDULE_COUNT = 4;
const ACADEMIC_YEAR = '2025/2026';
const SEMESTER = 'GENAP';

const facultyRows = [
	['FTI', 'Fakultas Teknologi Informasi'],
	['FEB', 'Fakultas Ekonomi dan Bisnis'],
	['FHUKUM', 'Fakultas Hukum']
] as const;

const studyProgramRows = [
	['TI', 'Teknik Informatika', 'Dr. Andi Wijaya, M.Kom.', 'FTI'],
	['SI', 'Sistem Informasi', 'Dr. Budi Santoso, M.T.', 'FTI'],
	['MI', 'Manajemen Informatika', 'Ir. Cahyo Nugroho, M.Kom.', 'FTI'],
	['MN', 'Manajemen', 'Prof. Diana Putri, M.M.', 'FEB'],
	['AK', 'Akuntansi', 'Dr. Eko Prasetyo, M.Ak.', 'FEB'],
	['HT', 'Hukum Tata Negara', 'Prof. Farida Hanum, S.H., M.H.', 'FHUKUM']
] as const;

const courseNameCatalog: Record<string, string[]> = {
	TI: [
		'Algoritma dan Pemrograman',
		'Struktur Data',
		'Basis Data',
		'Pemrograman Web',
		'Pemrograman Berorientasi Objek',
		'Jaringan Komputer',
		'Rekayasa Perangkat Lunak',
		'Keamanan Informasi'
	],
	SI: [
		'Analisis Sistem',
		'Perancangan Basis Data',
		'Pemodelan Proses Bisnis',
		'Sistem Enterprise',
		'Tata Kelola TI',
		'Interaksi Manusia dan Komputer',
		'Pengembangan Aplikasi Bisnis',
		'Visualisasi Data'
	],
	MI: [
		'Administrasi Sistem',
		'Pemrograman Dasar',
		'Desain UI',
		'Pengujian Perangkat Lunak',
		'Komputasi Awan',
		'Manajemen Infrastruktur',
		'Integrasi Aplikasi',
		'Pemrograman Mobile'
	],
	MN: [
		'Pengantar Manajemen',
		'Manajemen Operasi',
		'Manajemen Keuangan',
		'Manajemen Pemasaran',
		'Perilaku Organisasi',
		'Analisis Investasi',
		'Kewirausahaan',
		'Sistem Informasi Manajemen'
	],
	AK: [
		'Akuntansi Dasar',
		'Akuntansi Biaya',
		'Akuntansi Keuangan',
		'Perpajakan',
		'Sistem Informasi Akuntansi',
		'Audit Internal',
		'Pelaporan Korporat',
		'Akuntansi Sektor Publik'
	],
	HT: [
		'Hukum Tata Negara',
		'Hukum Pidana',
		'Hukum Perdata',
		'Hukum Administrasi Negara',
		'Hukum Acara',
		'Hukum Konstitusi',
		'Etika Profesi Hukum',
		'Advokasi Kebijakan Publik'
	]
};

const dayConfigs = [
	{ day: 'SENIN', date: '2026-01-05' },
	{ day: 'SELASA', date: '2026-01-06' },
	{ day: 'RABU', date: '2026-01-07' },
	{ day: 'KAMIS', date: '2026-01-08' },
	{ day: 'JUMAT', date: '2026-01-09' },
	{ day: 'SABTU', date: '2026-01-10' }
] as const;

const timeSlotConfigs = [
	{ start: '07:00:00', end: '08:40:00' },
	{ start: '08:50:00', end: '10:30:00' },
	{ start: '10:40:00', end: '12:20:00' },
	{ start: '13:00:00', end: '14:40:00' },
	{ start: '14:50:00', end: '16:30:00' },
	{ start: '16:40:00', end: '18:20:00' },
	{ start: '18:30:00', end: '20:10:00' },
	{ start: '20:15:00', end: '21:55:00' }
] as const;

const firstNames = [
	'Aditya',
	'Alya',
	'Bagas',
	'Bintang',
	'Cahya',
	'Cintia',
	'Daffa',
	'Dinda',
	'Fajar',
	'Farah',
	'Gilang',
	'Hana',
	'Intan',
	'Kezia',
	'Malik',
	'Nadia',
	'Putra',
	'Raka',
	'Salsa',
	'Tari'
];

const middleNames = [
	'Akbar',
	'Ananda',
	'Aulia',
	'Baskara',
	'Dwi',
	'Firdaus',
	'Kirana',
	'Mahendra',
	'Nugraha',
	'Permata',
	'Pratama',
	'Rahman',
	'Safira',
	'Saputra',
	'Utama',
	'Wibowo'
];

const lastNames = [
	'Gunawan',
	'Hakim',
	'Hidayat',
	'Kurniawan',
	'Lestari',
	'Maharani',
	'Maulana',
	'Ningsih',
	'Pangestu',
	'Prasetyo',
	'Putri',
	'Ramadhan',
	'Santoso',
	'Saputri',
	'Setiawan',
	'Wijaya'
];

type StudyProgramId = (typeof studyProgramRows)[number][0];

type StudentRecord = {
	id: string;
	name: string;
	email: string;
	phone: string;
	address: string;
	yearAdmitted: number;
	studyProgramId: StudyProgramId;
};

type LecturerRecord = {
	id: string;
	name: string;
	email: string;
	phone: string;
	address: string;
};

type CourseRecord = {
	id: string;
	name: string;
	credits: number;
	studyProgramId: StudyProgramId;
	lecturerId: string;
};

type SlotRecord = {
	classRoomId: string;
	classRoomIndex: number;
	day: (typeof dayConfigs)[number]['day'];
	date: string;
	start: string;
	end: string;
};

const pool: Pool = createPool({
	host: process.env.DB_HOST || 'localhost',
	user: process.env.DB_USER || 'root',
	password: process.env.DB_PASSWORD || '',
	database: process.env.DB_NAME || 'akademik_db',
	port: parseInt(process.env.DB_PORT || '3306', 10),
	timezone: '+00:00',
	multipleStatements: true,
	enableKeepAlive: true,
	keepAliveInitialDelay: 10000,
	connectTimeout: 5000
});

async function withConnection<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();
		const result = await fn(conn);
		await conn.commit();
		return result;
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

function getStressSeedCount() {
	const parsed = parseInt(process.env.STRESS_SEED_COUNT || `${DEFAULT_STRESS_SEED_COUNT}`, 10);
	if (Number.isNaN(parsed)) {
		return DEFAULT_STRESS_SEED_COUNT;
	}

	return Math.min(MAX_STRESS_SEED_COUNT, Math.max(MIN_STRESS_SEED_COUNT, parsed));
}

function buildPersonName(index: number) {
	const firstName = firstNames[index % firstNames.length];
	const middleName = middleNames[Math.floor(index / firstNames.length) % middleNames.length];
	const lastName =
		lastNames[Math.floor(index / (firstNames.length * middleNames.length)) % lastNames.length];
	return `${firstName} ${middleName} ${lastName}`;
}

function buildStudentId(index: number) {
	return `${STUDENT_ID_PREFIX}${String(index + 1).padStart(4, '0')}`;
}

function buildStudentEmail(index: number) {
	return `student.${String(index + 1).padStart(4, '0')}@stress.watum.ac.id`;
}

function buildStudentPhone(index: number) {
	return `0817${String(index + 1).padStart(8, '0')}`;
}

function buildStudentAddress(index: number) {
	return `Jl. Stress Mahasiswa No. ${index + 1}, Dataset ${(index % 25) + 1}`;
}

function buildStudentYearAdmitted(index: number) {
	return 2021 + (index % 5);
}

function buildUserId(index: number) {
	return `${USER_ID_PREFIX}${String(index + 1).padStart(4, '0')}`;
}

function buildLecturerId(index: number) {
	return `${LECTURER_ID_PREFIX}${String(index + 1).padStart(4, '0')}`;
}

function buildLecturerEmail(index: number) {
	return `lecturer.${String(index + 1).padStart(4, '0')}@stress.watum.ac.id`;
}

function buildLecturerPhone(index: number) {
	return `0818${String(index + 1).padStart(8, '0')}`;
}

function buildLecturerAddress(index: number) {
	return `Jl. Stress Dosen No. ${index + 1}, Dataset ${(index % 12) + 1}`;
}

function buildLecturerUserId(index: number) {
	return `${LECTURER_USER_ID_PREFIX}${String(index + 1).padStart(4, '0')}`;
}

function buildClassRooms() {
	const rows: Array<[string, string, string, number, number, number]> = [];

	for (let index = 0; index < 20; index += 1) {
		rows.push([
			`${CLASSROOM_ID_PREFIX}reg-${String(index + 1).padStart(3, '0')}`,
			`Ruang ${100 + index + 1}`,
			'REGULER',
			40 + (index % 3) * 5,
			1,
			1
		]);
	}

	for (let index = 0; index < 6; index += 1) {
		rows.push([
			`${CLASSROOM_ID_PREFIX}lab-${String(index + 1).padStart(3, '0')}`,
			`Lab Komputer ${index + 1}`,
			'LAB_KOMPUTER',
			30,
			1,
			1
		]);
	}

	rows.push([`${CLASSROOM_ID_PREFIX}aud-001`, 'Auditorium Timur', 'AUDITORIUM', 180, 1, 1]);
	rows.push([`${CLASSROOM_ID_PREFIX}aud-002`, 'Auditorium Barat', 'AUDITORIUM', 220, 1, 1]);

	return rows;
}

function getLecturerCount(studentCount: number) {
	return Math.max(32, Math.min(48, Math.ceil(studentCount / 12)));
}

function buildLecturers(count: number) {
	const lecturers: LecturerRecord[] = [];
	for (let index = 0; index < count; index += 1) {
		lecturers.push({
			id: buildLecturerId(index),
			name: buildPersonName(index + 700),
			email: buildLecturerEmail(index),
			phone: buildLecturerPhone(index),
			address: buildLecturerAddress(index)
		});
	}
	return lecturers;
}

function buildCourses(lecturers: LecturerRecord[]) {
	const courses: CourseRecord[] = [];
	let courseIndex = 0;

	for (const [studyProgramId] of studyProgramRows) {
		for (const [titleIndex, courseName] of courseNameCatalog[studyProgramId].entries()) {
			courses.push({
				id: `${COURSE_ID_PREFIX}${studyProgramId.toLowerCase()}-${String(titleIndex + 1).padStart(2, '0')}`,
				name: courseName,
				credits: titleIndex % 3 === 0 ? 2 : 3,
				studyProgramId,
				lecturerId: lecturers[courseIndex % lecturers.length].id
			});
			courseIndex += 1;
		}
	}

	return courses;
}

function buildStudents(studentCount: number) {
	const students: StudentRecord[] = [];
	for (let index = 0; index < studentCount; index += 1) {
		students.push({
			id: buildStudentId(index),
			name: buildPersonName(index),
			email: buildStudentEmail(index),
			phone: buildStudentPhone(index),
			address: buildStudentAddress(index),
			yearAdmitted: buildStudentYearAdmitted(index),
			studyProgramId: studyProgramRows[index % studyProgramRows.length][0]
		});
	}
	return students;
}

function buildUniqueSlots(classRoomIds: string[]) {
	const slots: SlotRecord[] = [];
	for (const [classRoomIndex, classRoomId] of classRoomIds.entries()) {
		for (const dayConfig of dayConfigs) {
			for (const timeSlot of timeSlotConfigs) {
				const isReservedConflictTime =
					dayConfig.day === dayConfigs[0].day && timeSlot.start === timeSlotConfigs[0].start;
				if (isReservedConflictTime) {
					continue;
				}

				slots.push({
					classRoomId,
					classRoomIndex,
					day: dayConfig.day,
					date: dayConfig.date,
					start: timeSlot.start,
					end: timeSlot.end
				});
			}
		}
	}
	return slots;
}

function buildConflictSlot(classRoomId: string): SlotRecord {
	return {
		classRoomId,
		classRoomIndex: 0,
		day: dayConfigs[0].day,
		date: dayConfigs[0].date,
		start: timeSlotConfigs[0].start,
		end: timeSlotConfigs[0].end
	};
}

function formatScheduleDate(date: string, time: string) {
	return `${date} ${time}`;
}

function calculateGrade(studentIndex: number, enrollmentIndex: number) {
	const assignment = 60 + ((studentIndex * 7 + enrollmentIndex * 3) % 35);
	const midterm = 58 + ((studentIndex * 5 + enrollmentIndex * 5) % 37);
	const final = 62 + ((studentIndex * 11 + enrollmentIndex * 2) % 33);
	const total = assignment * 0.3 + midterm * 0.3 + final * 0.4;

	let letter = 'E';
	if (total >= 85) letter = 'A';
	else if (total >= 70) letter = 'B';
	else if (total >= 55) letter = 'C';
	else if (total >= 40) letter = 'D';

	return {
		assignment,
		midterm,
		final,
		total: Number(total.toFixed(2)),
		letter
	};
}

async function resetDatabase(conn: Connection) {
	await conn.query('SET FOREIGN_KEY_CHECKS = 0');
	try {
		const tablesToTruncate = [
			'grades',
			'enrollments',
			'schedules',
			'courses',
			'refresh_tokens',
			'students',
			'lecturers',
			'class_rooms',
			'study_programs',
			'faculties'
		];

		for (const tableName of tablesToTruncate) {
			await conn.query(`TRUNCATE TABLE ${tableName}`);
		}

		await conn.query('DELETE FROM users WHERE id <> ?', [DEFAULT_ADMIN_ID]);
		await conn.query(
			`INSERT INTO users (id, email, password, role, student_id, lecturer_id)
			 VALUES (?, ?, ?, 'ADMIN', NULL, NULL)
			 ON DUPLICATE KEY UPDATE
			   email = VALUES(email),
			   password = VALUES(password),
			   role = 'ADMIN',
			   student_id = NULL,
			   lecturer_id = NULL`,
			[DEFAULT_ADMIN_ID, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD_HASH]
		);
	} finally {
		await conn.query('SET FOREIGN_KEY_CHECKS = 1');
	}
}

async function seedStressData() {
	const studentCount = getStressSeedCount();
	const lecturerCount = getLecturerCount(studentCount);
	const classRoomRows = buildClassRooms();
	const lecturers = buildLecturers(lecturerCount);
	const courses = buildCourses(lecturers);
	const students = buildStudents(studentCount);
	const coursesByProgram = new Map<StudyProgramId, CourseRecord[]>();

	for (const course of courses) {
		const programCourses = coursesByProgram.get(course.studyProgramId) ?? [];
		programCourses.push(course);
		coursesByProgram.set(course.studyProgramId, programCourses);
	}

	console.log(`Resetting database and seeding ${studentCount} students...`);

	await withConnection(async (conn) => {
		await resetDatabase(conn);

		console.log('  Inserting faculties, study programs, and classrooms...');
		await conn.query('INSERT INTO faculties (id, name) VALUES ?', [facultyRows]);
		await conn.query('INSERT INTO study_programs (id, name, head, faculty_id) VALUES ?', [
			studyProgramRows
		]);
		await conn.query(
			`INSERT INTO class_rooms (id, name, class_room_type, capacity, has_projector, has_ac)
			 VALUES ?`,
			[classRoomRows]
		);

		console.log('  Inserting lecturers, courses, students, and users...');
		await conn.query('INSERT INTO lecturers (id, name, email, phone, address) VALUES ?', [
			lecturers.map((lecturer) => [
				lecturer.id,
				lecturer.name,
				lecturer.email,
				lecturer.phone,
				lecturer.address
			])
		]);

		await conn.query(
			`INSERT INTO courses (id, name, credits, study_program_id, lecturer_id)
			 VALUES ?`,
			[
				courses.map((course) => [
					course.id,
					course.name,
					course.credits,
					course.studyProgramId,
					course.lecturerId
				])
			]
		);

		await conn.query(
			`INSERT INTO students (id, name, email, phone, address, year_admitted, study_program_id)
			 VALUES ?`,
			[
				students.map((student) => [
					student.id,
					student.name,
					student.email,
					student.phone,
					student.address,
					student.yearAdmitted,
					student.studyProgramId
				])
			]
		);

		const lecturerPasswordHash = await hash('stresslecturer123');
		const studentPasswordHash = await hash('stress123');

		await conn.query(
			`INSERT INTO users (id, email, password, role, student_id, lecturer_id)
			 VALUES ?`,
			[
				[
					...lecturers.map((lecturer, index) => [
						buildLecturerUserId(index),
						lecturer.email,
						lecturerPasswordHash,
						'LECTURER',
						null,
						lecturer.id
					]),
					...students.map((student, index) => [
						buildUserId(index),
						student.email,
						studentPasswordHash,
						'STUDENT',
						student.id,
						null
					])
				]
			]
		);

		console.log('  Building schedules, enrollments, and grades...');
		const uniqueSlots = buildUniqueSlots(classRoomRows.map((row) => row[0]));
		const conflictSlot = buildConflictSlot(classRoomRows[0][0]);

		const scheduleRows: Array<[string, string, string, string, string, string | null]> = [];
		const enrollmentRows: Array<[string, string, string, string, string, string, string]> = [];
		const gradeRows: Array<[string, string, number, number, number, number, string]> = [];

		let enrollmentIndex = 0;
		for (const [studentIndex, student] of students.entries()) {
			const programCourses = coursesByProgram.get(student.studyProgramId) ?? [];
			const courseCount = studentIndex % 5 === 0 ? 3 : 2;
			const startOffset = (studentIndex * 2) % programCourses.length;

			for (let offset = 0; offset < courseCount; offset += 1) {
				const course = programCourses[(startOffset + offset) % programCourses.length];
				const scheduleId = `${SCHEDULE_ID_PREFIX}${String(enrollmentIndex + 1).padStart(5, '0')}`;
				const enrollmentId = `${ENROLLMENT_ID_PREFIX}${String(enrollmentIndex + 1).padStart(5, '0')}`;
				const slot =
					enrollmentIndex < CONFLICTING_SCHEDULE_COUNT
						? conflictSlot
						: uniqueSlots[enrollmentIndex - CONFLICTING_SCHEDULE_COUNT];

				if (!slot) {
					throw new Error('Not enough unique slots to generate the requested stress dataset.');
				}

				const scheduleLecturerId =
					enrollmentIndex < CONFLICTING_SCHEDULE_COUNT
						? lecturers[enrollmentIndex].id
						: lecturers[slot.classRoomIndex % lecturers.length].id;

				scheduleRows.push([
					scheduleId,
					slot.classRoomId,
					slot.day,
					formatScheduleDate(slot.date, slot.start),
					formatScheduleDate(slot.date, slot.end),
					scheduleLecturerId
				]);

				enrollmentRows.push([
					enrollmentId,
					student.id,
					course.id,
					slot.classRoomId,
					scheduleId,
					SEMESTER,
					ACADEMIC_YEAR
				]);

				const shouldGrade =
					enrollmentIndex >= CONFLICTING_SCHEDULE_COUNT && enrollmentIndex % 10 < 7;
				if (shouldGrade) {
					const grade = calculateGrade(studentIndex, enrollmentIndex);
					gradeRows.push([
						`${GRADE_ID_PREFIX}${String(gradeRows.length + 1).padStart(5, '0')}`,
						enrollmentId,
						grade.assignment,
						grade.midterm,
						grade.final,
						grade.total,
						grade.letter
					]);
				}

				enrollmentIndex += 1;
			}
		}

		await conn.query(
			`INSERT INTO schedules (id, class_room_id, day, start_time, end_time, lecturer_id)
			 VALUES ?`,
			[scheduleRows]
		);

		await conn.query(
			`INSERT INTO enrollments (id, student_id, course_id, class_room_id, schedule_id, semester, academic_year)
			 VALUES ?`,
			[enrollmentRows]
		);

		await conn.query(
			`INSERT INTO grades (id, enrollment_id, assignment_score, midterm_score, final_score, total_score, letter_grade)
			 VALUES ?`,
			[gradeRows]
		);
	});

	const enrollmentCount = students.reduce(
		(total, _student, index) => total + (index % 5 === 0 ? 3 : 2),
		0
	);
	console.log('Stress-test seed complete!');
	console.log(`  Default admin preserved: ${DEFAULT_ADMIN_EMAIL}`);
	console.log(`  Students created: ${studentCount}`);
	console.log(`  Student users created: ${studentCount}`);
	console.log(`  Lecturer users created: ${lecturerCount}`);
	console.log(
		`  Courses created: ${Object.values(courseNameCatalog).reduce((sum, names) => sum + names.length, 0)}`
	);
	console.log(`  Classrooms created: ${classRoomRows.length}`);
	console.log(`  Enrollments and schedules created: ${enrollmentCount}`);
	console.log(`  Intentional conflicting schedules: ${CONFLICTING_SCHEDULE_COUNT}`);
	console.log('  Student password: stress123');
	console.log('  Lecturer password: stresslecturer123');
}

seedStressData()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error('Stress seed failed:', err);
		process.exit(1);
	})
	.finally(() => pool.end());
