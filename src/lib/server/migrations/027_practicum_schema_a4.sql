-- Standalone normalized academic schema for database systems practicum.
-- Complete enough to model scheduling and enrollment, but without auth,
-- audit columns, triggers, tuning indexes, or denormalized derived fields.
-- Every table column below also exists in the production schema snapshot.

CREATE TABLE IF NOT EXISTS faculties (
  id VARCHAR(16) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS study_programs (
  id VARCHAR(16) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  head VARCHAR(255) NOT NULL,
  faculty_id VARCHAR(16) NOT NULL,
  FOREIGN KEY (faculty_id) REFERENCES faculties(id)
);

CREATE TABLE IF NOT EXISTS students (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(255),
  address TEXT,
  year_admitted INT NOT NULL,
  study_program_id VARCHAR(16) NOT NULL,
  FOREIGN KEY (study_program_id) REFERENCES study_programs(id),
  CONSTRAINT chk_students_year_admitted CHECK (year_admitted BETWEEN 1900 AND 2100)
);

CREATE TABLE IF NOT EXISTS lecturers (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(255),
  address TEXT
);

CREATE TABLE IF NOT EXISTS courses (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  credits INT NOT NULL,
  study_program_id VARCHAR(16) NOT NULL,
  lecturer_id VARCHAR(64) NOT NULL,
  UNIQUE KEY uq_courses_program_name (study_program_id, name),
  FOREIGN KEY (study_program_id) REFERENCES study_programs(id),
  FOREIGN KEY (lecturer_id) REFERENCES lecturers(id),
  CONSTRAINT chk_courses_credits CHECK (credits > 0)
);

CREATE TABLE IF NOT EXISTS class_rooms (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  class_room_type ENUM('REGULER','LAB_KOMPUTER','LAB_BAHASA','AUDITORIUM') NOT NULL,
  capacity INT NOT NULL,
  has_projector BOOLEAN NOT NULL DEFAULT FALSE,
  has_ac BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT chk_class_rooms_capacity CHECK (capacity > 0)
);

CREATE TABLE IF NOT EXISTS schedules (
  id VARCHAR(64) PRIMARY KEY,
  class_room_id VARCHAR(64) NOT NULL,
  day ENUM('SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU') NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  lecturer_id VARCHAR(64),
  FOREIGN KEY (lecturer_id) REFERENCES lecturers(id),
  FOREIGN KEY (class_room_id) REFERENCES class_rooms(id),
  CONSTRAINT chk_schedules_time CHECK (start_time < end_time)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id VARCHAR(64) PRIMARY KEY,
  student_id VARCHAR(64) NOT NULL,
  course_id VARCHAR(64) NOT NULL,
  class_room_id VARCHAR(64),
  schedule_id VARCHAR(64),
  semester VARCHAR(32) NOT NULL,
  academic_year VARCHAR(32) NOT NULL,
  status ENUM('PENDING','APPROVED') NOT NULL DEFAULT 'PENDING',
  UNIQUE KEY uq_enrollment_term (student_id, course_id, semester, academic_year),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (class_room_id) REFERENCES class_rooms(id),
  FOREIGN KEY (schedule_id) REFERENCES schedules(id)
);

CREATE TABLE IF NOT EXISTS grades (
  id VARCHAR(64) PRIMARY KEY,
  enrollment_id VARCHAR(64) NOT NULL UNIQUE,
  assignment_score FLOAT,
  midterm_score FLOAT,
  final_score FLOAT,
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id),
  CONSTRAINT chk_grades_assignment CHECK (assignment_score BETWEEN 0 AND 100),
  CONSTRAINT chk_grades_midterm CHECK (midterm_score BETWEEN 0 AND 100),
  CONSTRAINT chk_grades_final CHECK (final_score BETWEEN 0 AND 100)
);
