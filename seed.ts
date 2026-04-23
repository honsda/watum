import 'dotenv/config';
import { createPool, type Pool, type Connection } from 'mysql2/promise';
import { hash } from 'argon2';

const pool: Pool = createPool({
	host: process.env.DB_HOST || 'localhost',
	user: process.env.DB_USER || 'root',
	password: process.env.DB_PASSWORD || '',
	database: process.env.DB_NAME || 'akademik_db',
	port: parseInt(process.env.DB_PORT || '3306'),
	timezone: '+00:00',
	multipleStatements: true,
	enableKeepAlive: true,
	keepAliveInitialDelay: 10000,
	connectTimeout: 5000
});

const DEFAULT_ADMIN_ID = 'admin-default';
const DEFAULT_ADMIN_EMAIL = 'admin@watum.local';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

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

function uuid(): string {
	return crypto.randomUUID();
}

function calcGrade(a: number, m: number, f: number) {
	const total = a * 0.3 + m * 0.3 + f * 0.4;
	let letter: string;
	if (total >= 85) letter = 'A';
	else if (total >= 70) letter = 'B';
	else if (total >= 55) letter = 'C';
	else if (total >= 40) letter = 'D';
	else letter = 'E';
	return { total, letter };
}

async function seed() {
	console.log('Seeding database...');

	await withConnection(async (conn) => {
		await conn.query('SET FOREIGN_KEY_CHECKS = 0');
		try {
			const tables = [
				'refresh_tokens',
				'grades',
				'enrollments',
				'schedules',
				'courses',
				'students',
				'lecturers',
				'class_rooms',
				'study_programs',
				'faculties'
			];
			for (const t of tables) {
				await conn.query(`TRUNCATE TABLE ${t}`);
			}

			console.log('  Preserving admin users and clearing seeded user accounts...');
			await conn.query(`DELETE FROM users WHERE role <> 'ADMIN'`);

			const defaultAdminPw = await hash(DEFAULT_ADMIN_PASSWORD);
			await conn.query(
				`INSERT IGNORE INTO users (id, email, password, role, student_id, lecturer_id)
				 VALUES (?, ?, ?, 'ADMIN', NULL, NULL)`,
				[DEFAULT_ADMIN_ID, DEFAULT_ADMIN_EMAIL, defaultAdminPw]
			);

			console.log('  Inserting faculties...');
			await conn.query(
				`INSERT INTO faculties (id, name) VALUES
			('FTI', 'Fakultas Teknologi Informasi'),
			('FEB', 'Fakultas Ekonomi dan Bisnis'),
			('FHUKUM', 'Fakultas Hukum')`
			);

			console.log('  Inserting study programs...');
			await conn.query(
				`INSERT INTO study_programs (id, name, head, faculty_id) VALUES
			('TI', 'Teknik Informatika', 'Dr. Andi Wijaya, M.Kom.', 'FTI'),
			('SI', 'Sistem Informasi', 'Dr. Budi Santoso, M.T.', 'FTI'),
			('MI', 'Manajemen Informatika', 'Ir. Cahyo Nugroho, M.Kom.', 'FTI'),
			('MN', 'Manajemen', 'Prof. Diana Putri, M.M.', 'FEB'),
			('AK', 'Akuntansi', 'Dr. Eko Prasetyo, M.Ak.', 'FEB'),
			('HT', 'Hukum Tata Negara', 'Prof. Farida Hanum, S.H., M.H.', 'FHUKUM')`
			);

			console.log('  Inserting class rooms...');
			await conn.query(
				`INSERT INTO class_rooms (id, name, class_room_type, capacity, has_projector, has_ac) VALUES
			('cr-101', 'R. 101', 'REGULER', 40, 1, 1),
			('cr-102', 'R. 102', 'REGULER', 35, 1, 1),
			('cr-201', 'R. 201', 'REGULER', 40, 0, 1),
			('cr-202', 'R. 202', 'REGULER', 30, 0, 1),
			('cr-301', 'R. 301', 'REGULER', 50, 1, 1),
			('lab-kom-1', 'Lab Komputer 1', 'LAB_KOMPUTER', 30, 1, 1),
			('lab-kom-2', 'Lab Komputer 2', 'LAB_KOMPUTER', 30, 1, 1),
			('lab-bahasa', 'Lab Bahasa', 'LAB_BAHASA', 25, 1, 1),
			('auditorium', 'Auditorium Utama', 'AUDITORIUM', 200, 1, 1)`
			);

			console.log('  Inserting lecturers...');
			await conn.query(
				`INSERT INTO lecturers (id, name, email, phone, address) VALUES
			('lec-01', 'Dr. Andi Wijaya, M.Kom.', 'andi.wijaya@watum.ac.id', '081234567001', 'Jl. Merdeka No. 10, Jakarta'),
			('lec-02', 'Dr. Budi Santoso, M.T.', 'budi.santoso@watum.ac.id', '081234567002', 'Jl. Sudirman No. 5, Bandung'),
			('lec-03', 'Ir. Cahyo Nugroho, M.Kom.', 'cahyo.nugroho@watum.ac.id', '081234567003', 'Jl. Diponegoro No. 8, Surabaya'),
			('lec-04', 'Rina Sulistyowati, S.Kom., M.Cs.', 'rina.sulistyowati@watum.ac.id', '081234567004', 'Jl. Ahmad Yani No. 12, Jakarta'),
			('lec-05', 'Hendra Gunawan, S.T., M.Kom.', 'hendra.gunawan@watum.ac.id', '081234567005', 'Jl. Gatot Subroto No. 3, Bandung'),
			('lec-06', 'Prof. Diana Putri, M.M.', 'diana.putri@watum.ac.id', '081234567006', 'Jl. Pahlawan No. 7, Surabaya'),
			('lec-07', 'Siti Aminah, S.Kom., M.Sc.', 'siti.aminah@watum.ac.id', '081234567007', 'Jl. Veteran No. 15, Jakarta'),
			('lec-08', 'Agus Setiawan, M.Kom.', 'agus.setiawan@watum.ac.id', '081234567008', 'Jl. Imam Bonjol No. 9, Bandung')`
			);

			console.log('  Inserting students...');
			await conn.query(
				`INSERT INTO students (id, name, email, phone, address, year_admitted, study_program_id) VALUES
			('mhs-01', 'Ahmad Rizky Pratama', 'ahmad.rizky@student.watum.ac.id', '082111222001', 'Jl. Kenangan No. 1, Jakarta', 2023, 'TI'),
			('mhs-02', 'Bella Safira Dewi', 'bella.safira@student.watum.ac.id', '082111222002', 'Jl. Melati No. 5, Bandung', 2023, 'TI'),
			('mhs-03', 'Citra Nuraini', 'citra.nuraini@student.watum.ac.id', '082111222003', 'Jl. Anggrek No. 8, Surabaya', 2023, 'SI'),
			('mhs-04', 'Dimas Adi Nugraha', 'dimas.adi@student.watum.ac.id', '082111222004', 'Jl. Dahlia No. 3, Jakarta', 2023, 'SI'),
			('mhs-05', 'Elsa Maharani', 'elsa.maharani@student.watum.ac.id', '082111222005', 'Jl. Mawar No. 12, Bandung', 2024, 'TI'),
			('mhs-06', 'Fajar Rahman Hakim', 'fajar.rahman@student.watum.ac.id', '082111222006', 'Jl. Teratai No. 7, Surabaya', 2024, 'TI'),
			('mhs-07', 'Gita Ananda Putri', 'gita.ananda@student.watum.ac.id', '082111222007', 'Jl. Cempaka No. 2, Jakarta', 2024, 'SI'),
			('mhs-08', 'Hadi Kurniawan', 'hadi.kurniawan@student.watum.ac.id', '082111222008', 'Jl. Bougenville No. 9, Bandung', 2024, 'MN'),
			('mhs-09', 'Indah Permata Sari', 'indah.permata@student.watum.ac.id', '082111222009', 'Jl. Flamboyan No. 4, Surabaya', 2024, 'MN'),
			('mhs-10', 'Joko Widodo Pratama', 'joko.widodo@student.watum.ac.id', '082111222010', 'Jl. Sakura No. 6, Jakarta', 2023, 'MI'),
			('mhs-11', 'Kartika Sari Dewi', 'kartika.sari@student.watum.ac.id', '082111222011', 'Jl. Angsana No. 11, Bandung', 2024, 'AK'),
			('mhs-12', 'Luthfi Hakim Ramadhan', 'luthfi.hakim@student.watum.ac.id', '082111222012', 'Jl. Seroja No. 14, Surabaya', 2024, 'HT'),
			('mhs-13', 'Mega Wulandari', 'mega.wulandari@student.watum.ac.id', '082111222013', 'Jl. Kenanga No. 1, Jakarta', 2023, 'AK'),
			('mhs-14', 'Naufal Azzam Rizqi', 'naufal.azzam@student.watum.ac.id', '082111222014', 'Jl. Kamboja No. 18, Bandung', 2024, 'MI'),
			('mhs-15', 'Olivia Rahma Putri', 'olivia.rahma@student.watum.ac.id', '082111222015', 'Jl. Tunjung No. 22, Surabaya', 2023, 'HT')`
			);

			console.log('  Inserting courses...');
			await conn.query(
				`INSERT INTO courses (id, name, credits, study_program_id, lecturer_id) VALUES
			('mk-pbo', 'Pemrograman Berorientasi Objek', 3, 'TI', 'lec-01'),
			('mk-basis-data', 'Basis Data', 3, 'TI', 'lec-02'),
			('mk-struktur-data', 'Struktur Data', 3, 'TI', 'lec-01'),
			('mk-jarkom', 'Jaringan Komputer', 3, 'TI', 'lec-05'),
			('mk-ppl', 'Pengantar Pemrograman Logam', 2, 'TI', 'lec-03'),
			('mk-web', 'Pemrograman Web', 3, 'SI', 'lec-04'),
			('mk-rekayasa-perangkat-lunak', 'Rekayasa Perangkat Lunak', 3, 'SI', 'lec-02'),
			('mk-analisis-sistem', 'Analisis Sistem Informasi', 3, 'SI', 'lec-07'),
			('mk-manajemen-keuangan', 'Manajemen Keuangan', 3, 'MN', 'lec-06'),
			('mk-akuntansi-dasar', 'Akuntansi Dasar', 3, 'AK', 'lec-06'),
			('mk-administrasi-jaringan', 'Administrasi Jaringan', 3, 'MI', 'lec-03'),
			('mk-hukum-pidana', 'Hukum Pidana', 4, 'HT', 'lec-08'),
			('mk-keamanan-informasi', 'Keamanan Informasi', 3, 'TI', 'lec-05')`
			);

			console.log('  Inserting schedules...');
			await conn.query(
				`INSERT INTO schedules (id, class_room_id, day, start_time, end_time, lecturer_id) VALUES
			('sch-01', 'cr-101', 'SENIN', '2025-01-06 07:00:00', '2025-01-06 09:30:00', 'lec-01'),
			('sch-02', 'cr-101', 'SENIN', '2025-01-06 07:00:00', '2025-01-06 09:30:00', 'lec-01'),
			('sch-03', 'lab-kom-1', 'SENIN', '2025-01-06 10:00:00', '2025-01-06 12:30:00', 'lec-02'),
			('sch-04', 'lab-kom-1', 'SENIN', '2025-01-06 10:00:00', '2025-01-06 12:30:00', 'lec-02'),
			('sch-05', 'cr-102', 'SENIN', '2025-01-06 07:00:00', '2025-01-06 09:30:00', 'lec-06'),
			('sch-06', 'cr-102', 'RABU', '2025-01-08 07:00:00', '2025-01-08 09:30:00', 'lec-01'),
			('sch-07', 'cr-201', 'SELASA', '2025-01-07 07:00:00', '2025-01-07 09:30:00', 'lec-04'),
			('sch-08', 'cr-201', 'SELASA', '2025-01-07 07:00:00', '2025-01-07 09:30:00', 'lec-04'),
			('sch-09', 'cr-102', 'SELASA', '2025-01-07 10:00:00', '2025-01-07 12:30:00', 'lec-05'),
			('sch-10', 'cr-102', 'RABU', '2025-01-08 07:00:00', '2025-01-08 09:30:00', 'lec-07'),
			('sch-11', 'cr-301', 'KAMIS', '2025-01-09 07:00:00', '2025-01-09 09:30:00', 'lec-03'),
			('sch-12', 'cr-101', 'KAMIS', '2025-01-09 10:00:00', '2025-01-09 12:30:00', 'lec-02'),
			('sch-13', 'cr-102', 'JUMAT', '2025-01-10 07:00:00', '2025-01-10 09:30:00', 'lec-08'),
			('sch-14', 'cr-201', 'JUMAT', '2025-01-10 10:00:00', '2025-01-10 12:30:00', 'lec-05'),
			('sch-15', 'cr-101', 'KAMIS', '2025-01-09 10:00:00', '2025-01-09 12:30:00', 'lec-02')`
			);

			console.log('  Inserting enrollments...');
			await conn.query(
				`INSERT INTO enrollments (id, student_id, course_id, class_room_id, schedule_id, semester, academic_year) VALUES
			('enr-01', 'mhs-01', 'mk-pbo', 'cr-101', 'sch-01', 'Ganjil 2024/2025', '2024/2025'),
			('enr-02', 'mhs-01', 'mk-basis-data', 'lab-kom-1', 'sch-03', 'Ganjil 2024/2025', '2024/2025'),
			('enr-03', 'mhs-02', 'mk-pbo', 'cr-101', 'sch-02', 'Ganjil 2024/2025', '2024/2025'),
			('enr-04', 'mhs-02', 'mk-struktur-data', 'cr-102', 'sch-06', 'Ganjil 2024/2025', '2024/2025'),
			('enr-05', 'mhs-03', 'mk-web', 'cr-201', 'sch-07', 'Ganjil 2024/2025', '2024/2025'),
			('enr-06', 'mhs-03', 'mk-analisis-sistem', 'cr-102', 'sch-10', 'Ganjil 2024/2025', '2024/2025'),
			('enr-07', 'mhs-04', 'mk-web', 'cr-201', 'sch-08', 'Ganjil 2024/2025', '2024/2025'),
			('enr-08', 'mhs-04', 'mk-rekayasa-perangkat-lunak', 'cr-102', 'sch-05', 'Ganjil 2024/2025', '2024/2025'),
			('enr-09', 'mhs-05', 'mk-jarkom', 'cr-101', 'sch-09', 'Ganjil 2024/2025', '2024/2025'),
			('enr-10', 'mhs-06', 'mk-basis-data', 'lab-kom-1', 'sch-04', 'Ganjil 2024/2025', '2024/2025'),
			('enr-11', 'mhs-08', 'mk-manajemen-keuangan', 'cr-102', 'sch-11', 'Ganjil 2024/2025', '2024/2025'),
			('enr-12', 'mhs-10', 'mk-administrasi-jaringan', 'cr-301', 'sch-12', 'Ganjil 2024/2025', '2024/2025'),
			('enr-13', 'mhs-11', 'mk-akuntansi-dasar', 'cr-102', 'sch-14', 'Ganjil 2024/2025', '2024/2025'),
			('enr-14', 'mhs-12', 'mk-hukum-pidana', 'cr-201', 'sch-15', 'Ganjil 2024/2025', '2024/2025'),
			('enr-15', 'mhs-14', 'mk-keamanan-informasi', 'cr-101', 'sch-13', 'Ganjil 2024/2025', '2024/2025')`
			);

			console.log('  Inserting grades...');
			// Keep conflict rows ungraded so schedule-resolution flows remain editable.
			const grades: Array<[string, number, number, number]> = [
				['enr-08', 92, 90, 95],
				['enr-09', 75, 70, 78],
				['enr-11', 65, 68, 62],
				['enr-13', 72, 70, 75],
				['enr-15', 86, 84, 88]
			];

			for (const [enrId, a, m, f] of grades) {
				const { total, letter } = calcGrade(a, m, f);
				await conn.query(
					`INSERT INTO grades (id, enrollment_id, assignment_score, midterm_score, final_score, total_score, letter_grade)
				VALUES (?, ?, ?, ?, ?, ?, ?)`,
					[uuid(), enrId, a, m, f, total, letter]
				);
			}

			console.log('  Inserting users...');
			const studentPw = await hash('student123');
			const lecturerPw = await hash('lecturer123');

			await conn.query(
				`INSERT INTO users (id, email, password, role, student_id, lecturer_id) VALUES
			('user-01', 'ahmad.rizky@student.watum.ac.id', ?, 'STUDENT', 'mhs-01', NULL),
			('user-02', 'bella.safira@student.watum.ac.id', ?, 'STUDENT', 'mhs-02', NULL),
			('user-03', 'citra.nuraini@student.watum.ac.id', ?, 'STUDENT', 'mhs-03', NULL),
			('user-04', 'dimas.adi@student.watum.ac.id', ?, 'STUDENT', 'mhs-04', NULL),
			('user-05', 'hadi.kurniawan@student.watum.ac.id', ?, 'STUDENT', 'mhs-08', NULL),
			('user-l01', 'andi.wijaya@watum.ac.id', ?, 'LECTURER', NULL, 'lec-01'),
			('user-l02', 'budi.santoso@watum.ac.id', ?, 'LECTURER', NULL, 'lec-02'),
			('user-l03', 'rina.sulistyowati@watum.ac.id', ?, 'LECTURER', NULL, 'lec-04'),
			('user-l04', 'hendra.gunawan@watum.ac.id', ?, 'LECTURER', NULL, 'lec-05')`,
				[
					studentPw,
					studentPw,
					studentPw,
					studentPw,
					studentPw,
					lecturerPw,
					lecturerPw,
					lecturerPw,
					lecturerPw
				]
			);
		} finally {
			await conn.query('SET FOREIGN_KEY_CHECKS = 1');
		}
	});

	console.log('\nSeed complete!\n');
	console.log(
		`  Admin:     preserved existing ADMIN user(s); default is ${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASSWORD} if missing`
	);
	console.log('  Student:   ahmad.rizky@student.watum.ac.id / student123');
	console.log('  Lecturer:  andi.wijaya@watum.ac.id / lecturer123');
}

seed()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error('Seed failed:', err);
		process.exit(1);
	})
	.finally(() => pool.end());
