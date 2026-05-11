-- Simplified academic schema for database systems practicum.
-- Intentionally compact enough to print on one A4 page.
-- Omits auth, refresh tokens, audit columns, triggers, policy tables, and tuning indexes.

CREATE TABLE faculties (id VARCHAR(16) PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE);

CREATE TABLE study_programs (
  id VARCHAR(16) PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  head VARCHAR(100) NOT NULL,
  faculty_id VARCHAR(16) NOT NULL,
  FOREIGN KEY (faculty_id) REFERENCES faculties(id)
);

CREATE TABLE students (
  id VARCHAR(16) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  year_admitted INT NOT NULL,
  study_program_id VARCHAR(16) NOT NULL,
  FOREIGN KEY (study_program_id) REFERENCES study_programs(id)
);

CREATE TABLE lecturers (
  id VARCHAR(16) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE courses (
  id VARCHAR(16) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  credits INT NOT NULL,
  study_program_id VARCHAR(16) NOT NULL,
  lecturer_id VARCHAR(16) NOT NULL,
  FOREIGN KEY (study_program_id) REFERENCES study_programs(id),
  FOREIGN KEY (lecturer_id) REFERENCES lecturers(id)
);

CREATE TABLE class_rooms (
  id VARCHAR(16) PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  class_room_type ENUM('REGULER','LAB_KOMPUTER','LAB_BAHASA','AUDITORIUM') NOT NULL,
  capacity INT NOT NULL
);

CREATE TABLE schedules (
  id VARCHAR(16) PRIMARY KEY,
  course_id VARCHAR(16) NOT NULL,
  class_room_id VARCHAR(16) NOT NULL,
  day ENUM('SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU') NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (class_room_id) REFERENCES class_rooms(id)
);

CREATE TABLE enrollments (
  id VARCHAR(16) PRIMARY KEY,
  student_id VARCHAR(16) NOT NULL,
  course_id VARCHAR(16) NOT NULL,
  semester ENUM('GANJIL','GENAP') NOT NULL,
  academic_year VARCHAR(16) NOT NULL,
  status ENUM('PENDING','APPROVED') NOT NULL DEFAULT 'APPROVED',
  UNIQUE KEY uq_enrollment_term (student_id, course_id, semester, academic_year),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE grades (
  id VARCHAR(16) PRIMARY KEY,
  enrollment_id VARCHAR(16) NOT NULL UNIQUE,
  assignment_score FLOAT,
  midterm_score FLOAT,
  final_score FLOAT,
  total_score FLOAT,
  letter_grade CHAR(2),
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id)
);
