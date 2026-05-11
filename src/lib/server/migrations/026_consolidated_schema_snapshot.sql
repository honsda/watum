-- Consolidated schema snapshot.
-- This file merges the base schema and follow-up migrations into a single
-- fresh-install migration using the latest schema shape as reference.
-- Existing migration files are intentionally kept for history.

-- ============================================
-- FACULTIES
-- ============================================

CREATE TABLE IF NOT EXISTS faculties (
  id VARCHAR(16) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY name (name),
  FULLTEXT KEY idx_faculties_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- STUDY PROGRAMS
-- ============================================

CREATE TABLE IF NOT EXISTS study_programs (
  id VARCHAR(16) NOT NULL,
  name VARCHAR(255) NOT NULL,
  head VARCHAR(255) NOT NULL,
  faculty_id VARCHAR(16) NOT NULL,
  created_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY name (name),
  KEY idx_study_programs_faculty_name_id (faculty_id, name, id),
  KEY idx_study_programs_faculty (faculty_id),
  FULLTEXT KEY idx_study_programs_name (name),
  CONSTRAINT study_programs_ibfk_1 FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE NO ACTION ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- CLASSROOMS
-- ============================================

CREATE TABLE IF NOT EXISTS class_rooms (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  class_room_type ENUM('REGULER','LAB_KOMPUTER','LAB_BAHASA','AUDITORIUM') NOT NULL,
  capacity INT NOT NULL,
  has_projector BOOLEAN DEFAULT FALSE,
  has_ac BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  audit_sk BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),
  UNIQUE KEY name (name),
  UNIQUE KEY audit_sk (audit_sk),
  FULLTEXT KEY idx_class_rooms_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- LECTURERS
-- ============================================

CREATE TABLE IF NOT EXISTS lecturers (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(255) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  created_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  audit_sk BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),
  UNIQUE KEY email (email),
  UNIQUE KEY audit_sk (audit_sk),
  KEY idx_lecturers_name_id (name, id),
  FULLTEXT KEY idx_lecturers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- STUDENTS
-- ============================================

CREATE TABLE IF NOT EXISTS students (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(255) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  year_admitted INT NOT NULL,
  study_program_id VARCHAR(16) NOT NULL,
  created_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  audit_sk BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),
  UNIQUE KEY email (email),
  UNIQUE KEY audit_sk (audit_sk),
  KEY idx_students_study_program (study_program_id),
  KEY idx_students_name_id (name, id),
  FULLTEXT KEY idx_students_name (name),
  CONSTRAINT students_ibfk_1 FOREIGN KEY (study_program_id) REFERENCES study_programs(id) ON DELETE NO ACTION ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- COURSES
-- ============================================

CREATE TABLE IF NOT EXISTS courses (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  credits INT NOT NULL,
  study_program_id VARCHAR(16) NOT NULL,
  lecturer_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  audit_sk BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  lecturer_audit_sk BIGINT(20) UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY audit_sk (audit_sk),
  KEY idx_courses_name_id (name, id),
  KEY idx_courses_study_program_name_id (study_program_id, name, id),
  KEY idx_courses_lecturer_name_id (lecturer_id, name, id),
  KEY idx_courses_lecturer_audit_scan (lecturer_audit_sk, audit_sk),
  KEY idx_courses_study_program (study_program_id),
  KEY idx_courses_lecturer (lecturer_id),
  FULLTEXT KEY idx_courses_name (name),
  CONSTRAINT courses_ibfk_1 FOREIGN KEY (study_program_id) REFERENCES study_programs(id) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT courses_ibfk_2 FOREIGN KEY (lecturer_id) REFERENCES lecturers(id) ON DELETE NO ACTION ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SCHEDULES
-- ============================================

CREATE TABLE IF NOT EXISTS schedules (
  id VARCHAR(64) NOT NULL,
  class_room_id VARCHAR(64) NOT NULL,
  day ENUM('SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU') NOT NULL,
  start_time TIME NOT NULL COMMENT 'Time of day (UTC)',
  end_time TIME NOT NULL COMMENT 'Time of day (UTC)',
  lecturer_id VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  audit_sk BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id),
  UNIQUE KEY audit_sk (audit_sk),
  KEY idx_schedules_room_day_time (class_room_id, day, start_time, end_time),
  KEY idx_schedules_day_start_id (day, start_time, id),
  KEY idx_schedules_lecturer_day_time_id (lecturer_id, day, start_time, end_time, id),
  KEY idx_schedules_class_room (class_room_id),
  KEY idx_schedules_lecturer (lecturer_id),
  KEY idx_schedules_day (day),
  CONSTRAINT schedules_ibfk_1 FOREIGN KEY (class_room_id) REFERENCES class_rooms(id) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT schedules_ibfk_2 FOREIGN KEY (lecturer_id) REFERENCES lecturers(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ENROLLMENT POLICY
-- ============================================

CREATE TABLE IF NOT EXISTS enrollment_policy (
  id TINYINT NOT NULL,
  semester ENUM('GANJIL','GENAP') NOT NULL DEFAULT 'GANJIL',
  academic_year VARCHAR(32) NOT NULL,
  student_enrollment_requests_open BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO enrollment_policy (id, semester, academic_year, student_enrollment_requests_open)
VALUES (1, 'GANJIL', '2025/2026', FALSE);

-- ============================================
-- ENROLLMENTS
-- ============================================

CREATE TABLE IF NOT EXISTS enrollments (
  id VARCHAR(64) NOT NULL,
  student_id VARCHAR(64) NOT NULL,
  course_id VARCHAR(64) NOT NULL,
  class_room_id VARCHAR(64) DEFAULT NULL,
  schedule_id VARCHAR(64) DEFAULT NULL,
  semester VARCHAR(32) NOT NULL,
  academic_year VARCHAR(32) NOT NULL,
  created_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  audit_sk BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  student_audit_sk BIGINT(20) UNSIGNED NOT NULL,
  course_audit_sk BIGINT(20) UNSIGNED NOT NULL,
  lecturer_audit_sk BIGINT(20) UNSIGNED NOT NULL,
  class_room_audit_sk BIGINT(20) UNSIGNED NOT NULL,
  schedule_audit_sk BIGINT(20) UNSIGNED NOT NULL,
  schedule_day ENUM('SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU') DEFAULT NULL,
  schedule_start_time TIME DEFAULT NULL,
  schedule_end_time TIME DEFAULT NULL,
  academic_year_start SMALLINT(5) UNSIGNED NOT NULL,
  semester_sort TINYINT(3) UNSIGNED NOT NULL,
  status ENUM('PENDING','APPROVED') NOT NULL DEFAULT 'APPROVED',
  PRIMARY KEY (id),
  UNIQUE KEY audit_sk (audit_sk),
  UNIQUE KEY enrollments_student_course_term_key (student_id, course_id, semester, academic_year),
  UNIQUE KEY schedule_id (schedule_id),
  KEY idx_enrollments_semester_year (semester, academic_year),
  KEY idx_enrollments_student_schedule (student_id, schedule_id),
  KEY idx_enrollments_student_id_id (student_id, id),
  KEY idx_enrollments_academic_year_id (academic_year, id),
  KEY idx_enrollments_course_schedule_id (course_id, schedule_id, id),
  KEY idx_enrollments_class_room_schedule_id (class_room_id, schedule_id, id),
  KEY idx_enrollments_course_lecturer (course_id, lecturer_audit_sk),
  KEY idx_enrollments_class_room_term_schedule_id (class_room_id, academic_year, semester, schedule_id, id),
  KEY idx_enrollments_student_term_schedule_id (student_id, academic_year, semester, schedule_id, id),
  KEY idx_enrollments_course_term_schedule_id (course_id, academic_year, semester, schedule_id, id),
  KEY idx_enrollments_student (student_id),
  KEY idx_enrollments_course (course_id),
  KEY idx_enrollments_class_room (class_room_id),
  KEY idx_enrollments_schedule (schedule_id),
  KEY idx_enrollments_room_conflict (class_room_audit_sk, academic_year_start, semester_sort, schedule_day, schedule_start_time, schedule_end_time, course_id, audit_sk, schedule_audit_sk),
  KEY idx_enrollments_student_conflict (student_audit_sk, academic_year_start, semester_sort, schedule_day, schedule_start_time, schedule_end_time, course_id, audit_sk, schedule_audit_sk),
  KEY idx_enrollments_lecturer_conflict (lecturer_audit_sk, academic_year_start, semester_sort, schedule_day, schedule_start_time, schedule_end_time, course_id, audit_sk, schedule_audit_sk),
  CONSTRAINT enrollments_ibfk_1 FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT enrollments_ibfk_2 FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT enrollments_ibfk_3 FOREIGN KEY (class_room_id) REFERENCES class_rooms(id) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT enrollments_ibfk_4 FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE NO ACTION ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- GRADES
-- ============================================

CREATE TABLE IF NOT EXISTS grades (
  id VARCHAR(64) NOT NULL,
  enrollment_id VARCHAR(64) NOT NULL,
  assignment_score FLOAT DEFAULT NULL,
  midterm_score FLOAT DEFAULT NULL,
  final_score FLOAT DEFAULT NULL,
  total_score FLOAT DEFAULT NULL,
  letter_grade VARCHAR(8) DEFAULT NULL,
  created_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY enrollment_id (enrollment_id),
  KEY idx_grades_letter_grade_id (letter_grade, id),
  KEY idx_grades_total_score_id (total_score, id),
  KEY idx_grades_enrollment (enrollment_id),
  CONSTRAINT grades_ibfk_1 FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT chk_grades_assignment CHECK (assignment_score >= 0 and assignment_score <= 100),
  CONSTRAINT chk_grades_midterm CHECK (midterm_score >= 0 and midterm_score <= 100),
  CONSTRAINT chk_grades_final CHECK (final_score >= 0 and final_score <= 100),
  CONSTRAINT chk_grades_total CHECK (total_score >= 0 and total_score <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- USERS
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('ADMIN','STUDENT','LECTURER') NOT NULL,
  student_id VARCHAR(64) DEFAULT NULL,
  lecturer_id VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY email (email),
  UNIQUE KEY student_id (student_id),
  UNIQUE KEY lecturer_id (lecturer_id),
  KEY idx_users_student (student_id),
  KEY idx_users_lecturer (lecturer_id),
  CONSTRAINT users_ibfk_1 FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT users_ibfk_2 FOREIGN KEY (lecturer_id) REFERENCES lecturers(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- REFRESH TOKENS
-- ============================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  context_binding VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP(3) NOT NULL,
  created_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY token_hash (token_hash),
  KEY idx_refresh_tokens_expires (expires_at),
  KEY idx_refresh_tokens_user_context (user_id, context_binding),
  KEY idx_refresh_tokens_user (user_id),
  CONSTRAINT refresh_tokens_ibfk_1 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SCHEMA MIGRATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS schema_migrations (
  id VARCHAR(255) NOT NULL,
  applied_at TIMESTAMP(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SEED DATA
-- ============================================

INSERT INTO users (id, email, password, role, student_id, lecturer_id)
VALUES (
  'admin-default',
  'admin@watum.local',
  '$argon2id$v=19$m=65536,t=3,p=4$TC2FXN7fXfwlswrRL4hTzQ$ASiXrlPTYumXqldaajKCtfKPUbuh1wmz1+f+HMwkd0M',
  'ADMIN',
  NULL,
  NULL
)
ON DUPLICATE KEY UPDATE
  password = VALUES(password),
  role = 'ADMIN',
  student_id = NULL,
  lecturer_id = NULL;

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS courses_bu_audit_keys;
DROP TRIGGER IF EXISTS courses_au_audit_keys;
DROP TRIGGER IF EXISTS enrollments_bi_audit_keys;
DROP TRIGGER IF EXISTS enrollments_bu_audit_keys;
DROP TRIGGER IF EXISTS grades_bi_compute_total;
DROP TRIGGER IF EXISTS grades_bu_compute_total;

DELIMITER //

CREATE TRIGGER courses_bu_audit_keys
BEFORE UPDATE ON courses
FOR EACH ROW
BEGIN
  IF NOT (OLD.lecturer_id <=> NEW.lecturer_id) THEN
    SET NEW.lecturer_audit_sk = (
      SELECT l.audit_sk FROM lecturers l WHERE l.id = NEW.lecturer_id LIMIT 1
    );
  END IF;
END //

CREATE TRIGGER courses_au_audit_keys
AFTER UPDATE ON courses
FOR EACH ROW
BEGIN
  IF NOT (OLD.lecturer_audit_sk <=> NEW.lecturer_audit_sk) THEN
    UPDATE enrollments
    SET lecturer_audit_sk = NEW.lecturer_audit_sk,
        course_audit_sk = NEW.audit_sk
    WHERE course_id = NEW.id
      AND NOT (lecturer_audit_sk <=> NEW.lecturer_audit_sk);
  END IF;
END //

CREATE TRIGGER enrollments_bi_audit_keys
BEFORE INSERT ON enrollments
FOR EACH ROW
BEGIN
  SET NEW.student_audit_sk = (SELECT s.audit_sk FROM students s WHERE s.id = NEW.student_id LIMIT 1);
  SET NEW.course_audit_sk = (SELECT c.audit_sk FROM courses c WHERE c.id = NEW.course_id LIMIT 1);
  SET NEW.lecturer_audit_sk = (SELECT c.lecturer_audit_sk FROM courses c WHERE c.id = NEW.course_id LIMIT 1);
  SET NEW.class_room_audit_sk = IFNULL((SELECT cr.audit_sk FROM class_rooms cr WHERE cr.id = NEW.class_room_id LIMIT 1), 0);
  SET NEW.schedule_audit_sk = IFNULL((SELECT sch.audit_sk FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1), 0);
  SET NEW.academic_year_start = CAST(SUBSTRING(NEW.academic_year, 1, 4) AS UNSIGNED);
  SET NEW.semester_sort = CASE
    WHEN UPPER(NEW.semester) LIKE 'GAN%' THEN 1
    WHEN UPPER(NEW.semester) LIKE 'GEN%' THEN 2
    ELSE 9
  END;
  IF NEW.schedule_id IS NOT NULL THEN
    SET NEW.schedule_day = (SELECT sch.day FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1);
    SET NEW.schedule_start_time = (SELECT sch.start_time FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1);
    SET NEW.schedule_end_time = (SELECT sch.end_time FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1);
  ELSE
    SET NEW.schedule_day = NULL;
    SET NEW.schedule_start_time = NULL;
    SET NEW.schedule_end_time = NULL;
  END IF;
END //

CREATE TRIGGER enrollments_bu_audit_keys
BEFORE UPDATE ON enrollments
FOR EACH ROW
BEGIN
  DECLARE v_course_audit_sk BIGINT UNSIGNED;
  DECLARE v_lecturer_audit_sk BIGINT UNSIGNED;
  DECLARE v_schedule_audit_sk BIGINT UNSIGNED;
  DECLARE v_schedule_day ENUM('SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU');
  DECLARE v_schedule_start_time TIME;
  DECLARE v_schedule_end_time TIME;

  IF NOT (OLD.student_id <=> NEW.student_id) THEN
    SET NEW.student_audit_sk = (SELECT s.audit_sk FROM students s WHERE s.id = NEW.student_id LIMIT 1);
  END IF;

  IF NOT (OLD.course_id <=> NEW.course_id) THEN
    SELECT c.audit_sk, c.lecturer_audit_sk
      INTO v_course_audit_sk, v_lecturer_audit_sk
      FROM courses c WHERE c.id = NEW.course_id LIMIT 1;
    SET NEW.course_audit_sk = v_course_audit_sk;
    SET NEW.lecturer_audit_sk = v_lecturer_audit_sk;
  END IF;

  IF NOT (OLD.class_room_id <=> NEW.class_room_id) THEN
    SET NEW.class_room_audit_sk = IFNULL((SELECT cr.audit_sk FROM class_rooms cr WHERE cr.id = NEW.class_room_id LIMIT 1), 0);
  END IF;

  IF NOT (OLD.schedule_id <=> NEW.schedule_id) THEN
    IF NEW.schedule_id IS NOT NULL THEN
      SELECT sch.audit_sk, sch.day, sch.start_time, sch.end_time
        INTO v_schedule_audit_sk, v_schedule_day, v_schedule_start_time, v_schedule_end_time
        FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1;
      SET NEW.schedule_audit_sk = IFNULL(v_schedule_audit_sk, 0);
      SET NEW.schedule_day = v_schedule_day;
      SET NEW.schedule_start_time = v_schedule_start_time;
      SET NEW.schedule_end_time = v_schedule_end_time;
    ELSE
      SET NEW.schedule_audit_sk = 0;
      SET NEW.schedule_day = NULL;
      SET NEW.schedule_start_time = NULL;
      SET NEW.schedule_end_time = NULL;
    END IF;
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
END //

CREATE TRIGGER grades_bi_compute_total
BEFORE INSERT ON grades
FOR EACH ROW
BEGIN
  SET NEW.total_score = ROUND(NEW.assignment_score * 0.3 + NEW.midterm_score * 0.3 + NEW.final_score * 0.4, 2);
END //

CREATE TRIGGER grades_bu_compute_total
BEFORE UPDATE ON grades
FOR EACH ROW
BEGIN
  IF NOT (OLD.assignment_score <=> NEW.assignment_score)
     OR NOT (OLD.midterm_score   <=> NEW.midterm_score)
     OR NOT (OLD.final_score     <=> NEW.final_score) THEN
    SET NEW.total_score = ROUND(NEW.assignment_score * 0.3 + NEW.midterm_score * 0.3 + NEW.final_score * 0.4, 2);
  END IF;
END //

DELIMITER ;
