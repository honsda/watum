SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE refresh_tokens DROP FOREIGN KEY refresh_tokens_ibfk_1;
ALTER TABLE grades DROP FOREIGN KEY grades_ibfk_1;
ALTER TABLE enrollments DROP FOREIGN KEY enrollments_ibfk_1;
ALTER TABLE enrollments DROP FOREIGN KEY enrollments_ibfk_2;
ALTER TABLE enrollments DROP FOREIGN KEY enrollments_ibfk_3;
ALTER TABLE enrollments DROP FOREIGN KEY enrollments_ibfk_4;
ALTER TABLE schedules DROP FOREIGN KEY schedules_ibfk_1;
ALTER TABLE schedules DROP FOREIGN KEY schedules_ibfk_2;
ALTER TABLE courses DROP FOREIGN KEY courses_ibfk_1;
ALTER TABLE courses DROP FOREIGN KEY courses_ibfk_2;
ALTER TABLE students DROP FOREIGN KEY students_ibfk_1;
ALTER TABLE study_programs DROP FOREIGN KEY study_programs_ibfk_1;
ALTER TABLE users DROP FOREIGN KEY users_ibfk_1;
ALTER TABLE users DROP FOREIGN KEY users_ibfk_2;

ALTER TABLE faculties
  MODIFY COLUMN id VARCHAR(16) NOT NULL;

ALTER TABLE study_programs
  MODIFY COLUMN id VARCHAR(16) NOT NULL,
  MODIFY COLUMN faculty_id VARCHAR(16) NOT NULL;

ALTER TABLE class_rooms
  MODIFY COLUMN id VARCHAR(64) NOT NULL;

ALTER TABLE students
  MODIFY COLUMN id VARCHAR(64) NOT NULL,
  MODIFY COLUMN study_program_id VARCHAR(16) NOT NULL;

ALTER TABLE lecturers
  MODIFY COLUMN id VARCHAR(64) NOT NULL;

ALTER TABLE courses
  MODIFY COLUMN id VARCHAR(64) NOT NULL,
  MODIFY COLUMN study_program_id VARCHAR(16) NOT NULL,
  MODIFY COLUMN lecturer_id VARCHAR(64) NOT NULL;

ALTER TABLE schedules
  MODIFY COLUMN id VARCHAR(64) NOT NULL,
  MODIFY COLUMN class_room_id VARCHAR(64) NOT NULL,
  MODIFY COLUMN lecturer_id VARCHAR(64) NULL;

ALTER TABLE enrollments
  MODIFY COLUMN id VARCHAR(64) NOT NULL,
  MODIFY COLUMN student_id VARCHAR(64) NOT NULL,
  MODIFY COLUMN course_id VARCHAR(64) NOT NULL,
  MODIFY COLUMN class_room_id VARCHAR(64) NOT NULL,
  MODIFY COLUMN schedule_id VARCHAR(64) NOT NULL,
  MODIFY COLUMN semester VARCHAR(32) NOT NULL,
  MODIFY COLUMN academic_year VARCHAR(32) NOT NULL;

ALTER TABLE grades
  MODIFY COLUMN id VARCHAR(64) NOT NULL,
  MODIFY COLUMN enrollment_id VARCHAR(64) NOT NULL,
  MODIFY COLUMN letter_grade VARCHAR(8) NULL;

ALTER TABLE users
  MODIFY COLUMN id VARCHAR(64) NOT NULL,
  MODIFY COLUMN student_id VARCHAR(64) NULL,
  MODIFY COLUMN lecturer_id VARCHAR(64) NULL;

ALTER TABLE refresh_tokens
  MODIFY COLUMN id VARCHAR(64) NOT NULL,
  MODIFY COLUMN user_id VARCHAR(64) NOT NULL;

DROP INDEX IF EXISTS idx_enrollments_class_room_term_schedule_id ON enrollments;
DROP INDEX IF EXISTS idx_enrollments_student_term_schedule_id ON enrollments;
DROP INDEX IF EXISTS idx_enrollments_course_term_schedule_id ON enrollments;

CREATE INDEX idx_enrollments_class_room_term_schedule_id
ON enrollments(class_room_id, academic_year, semester, schedule_id, id);

CREATE INDEX idx_enrollments_student_term_schedule_id
ON enrollments(student_id, academic_year, semester, schedule_id, id);

CREATE INDEX idx_enrollments_course_term_schedule_id
ON enrollments(course_id, academic_year, semester, schedule_id, id);

ALTER TABLE study_programs
  ADD CONSTRAINT study_programs_ibfk_1
  FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE students
  ADD CONSTRAINT students_ibfk_1
  FOREIGN KEY (study_program_id) REFERENCES study_programs(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE courses
  ADD CONSTRAINT courses_ibfk_1
  FOREIGN KEY (study_program_id) REFERENCES study_programs(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT courses_ibfk_2
  FOREIGN KEY (lecturer_id) REFERENCES lecturers(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE schedules
  ADD CONSTRAINT schedules_ibfk_1
  FOREIGN KEY (class_room_id) REFERENCES class_rooms(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT schedules_ibfk_2
  FOREIGN KEY (lecturer_id) REFERENCES lecturers(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_ibfk_1
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT enrollments_ibfk_2
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT enrollments_ibfk_3
  FOREIGN KEY (class_room_id) REFERENCES class_rooms(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT enrollments_ibfk_4
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE grades
  ADD CONSTRAINT grades_ibfk_1
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE users
  ADD CONSTRAINT users_ibfk_1
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT users_ibfk_2
  FOREIGN KEY (lecturer_id) REFERENCES lecturers(id) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE refresh_tokens
  ADD CONSTRAINT refresh_tokens_ibfk_1
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;
