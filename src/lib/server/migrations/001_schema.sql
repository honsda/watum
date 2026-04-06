-- Database schema for Sistem Informasi Akademik "Universitas Merdeka Digital"
-- Generated from Prisma schema
-- Using MySQL with UTC timezone

-- ============================================
-- ENUMS (using ENUM type)
-- ============================================

-- ============================================
-- FACULTIES (manual ID)
-- ============================================

CREATE TABLE IF NOT EXISTS faculties (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- STUDY PROGRAMS (manual ID)
-- ============================================

CREATE TABLE IF NOT EXISTS study_programs (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  head VARCHAR(255) NOT NULL,
  faculty_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CLASSROOMS (auto-generated CUID)
-- ============================================

CREATE TABLE IF NOT EXISTS class_rooms (
  id VARCHAR(255) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL UNIQUE,
  class_room_type ENUM('REGULER', 'LAB_KOMPUTER', 'LAB_BAHASA', 'AUDITORIUM') NOT NULL,
  capacity INT NOT NULL,
  has_projector BOOLEAN DEFAULT FALSE,
  has_ac BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- STUDENTS (manual ID)
-- ============================================

CREATE TABLE IF NOT EXISTS students (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(255),
  address TEXT,
  year_admitted INT NOT NULL,
  study_program_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (study_program_id) REFERENCES study_programs(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- LECTURERS (manual ID)
-- ============================================

CREATE TABLE IF NOT EXISTS lecturers (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(255),
  address TEXT,
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- COURSES (manual ID)
-- ============================================

CREATE TABLE IF NOT EXISTS courses (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  credits INT NOT NULL,
  study_program_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (study_program_id) REFERENCES study_programs(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- COURSE LECTURERS (Many-to-Many junction table)
-- ============================================

CREATE TABLE IF NOT EXISTS _CourseToLecturer (
  A VARCHAR(255) NOT NULL,
  B VARCHAR(255) NOT NULL,
  PRIMARY KEY (A, B),
  FOREIGN KEY (A) REFERENCES courses(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (B) REFERENCES lecturers(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SCHEDULES (auto-generated CUID)
-- ============================================

CREATE TABLE IF NOT EXISTS schedules (
  id VARCHAR(255) PRIMARY KEY DEFAULT (UUID()),
  class_room_id VARCHAR(255) NOT NULL,
  day ENUM('SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU') NOT NULL,
  start_time DATETIME(3) NOT NULL COMMENT 'Stored as UTC with millisecond precision',
  end_time DATETIME(3) NOT NULL COMMENT 'Stored as UTC with millisecond precision',
  lecturer_id VARCHAR(255),
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (class_room_id) REFERENCES class_rooms(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (lecturer_id) REFERENCES lecturers(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ENROLLMENTS (auto-generated CUID)
-- ============================================

CREATE TABLE IF NOT EXISTS enrollments (
  id VARCHAR(255) PRIMARY KEY DEFAULT (UUID()),
  student_id VARCHAR(255) NOT NULL,
  course_id VARCHAR(255) NOT NULL,
  class_room_id VARCHAR(255) NOT NULL,
  lecturer_id VARCHAR(255) NOT NULL,
  schedule_id VARCHAR(255) UNIQUE NOT NULL,
  semester VARCHAR(255) NOT NULL,
  academic_year VARCHAR(255) NOT NULL,
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (class_room_id) REFERENCES class_rooms(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (lecturer_id) REFERENCES lecturers(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  UNIQUE KEY enrollments_student_id_course_id_semester_key (student_id, course_id, semester)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- GRADES (auto-generated CUID)
-- ============================================

CREATE TABLE IF NOT EXISTS grades (
  id VARCHAR(255) PRIMARY KEY DEFAULT (UUID()),
  enrollment_id VARCHAR(255) UNIQUE NOT NULL,
  assignment_score FLOAT,
  midterm_score FLOAT,
  final_score FLOAT,
  total_score FLOAT,
  letter_grade VARCHAR(255),
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- USERS (auto-generated CUID)
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'STUDENT', 'LECTURER') NOT NULL,
  student_id VARCHAR(255) UNIQUE,
  lecturer_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (lecturer_id) REFERENCES lecturers(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- INDEXES
-- ============================================

-- Study Programs
CREATE INDEX idx_study_programs_faculty ON study_programs(faculty_id);

-- Students
CREATE INDEX idx_students_study_program ON students(study_program_id);

-- Courses
CREATE INDEX idx_courses_study_program ON courses(study_program_id);

-- Course Lecturers
CREATE INDEX idx_course_lecturers_course ON _CourseToLecturer(A);
CREATE INDEX idx_course_lecturers_lecturer ON _CourseToLecturer(B);

-- Schedules
CREATE INDEX idx_schedules_class_room ON schedules(class_room_id);
CREATE INDEX idx_schedules_lecturer ON schedules(lecturer_id);
CREATE INDEX idx_schedules_day ON schedules(day);

-- Enrollments
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_course ON enrollments(course_id);
CREATE INDEX idx_enrollments_class_room ON enrollments(class_room_id);
CREATE INDEX idx_enrollments_lecturer ON enrollments(lecturer_id);
CREATE INDEX idx_enrollments_schedule ON enrollments(schedule_id);
CREATE INDEX idx_enrollments_semester_year ON enrollments(semester, academic_year);

-- Grades
CREATE INDEX idx_grades_enrollment ON grades(enrollment_id);

-- Users
CREATE INDEX idx_users_student ON users(student_id);
CREATE INDEX idx_users_lecturer ON users(lecturer_id);
