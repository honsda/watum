-- Convert schedule time columns from DATETIME(3) to TIME.
-- Academic scheduling only needs day-of-week + time-of-day, not exact dates.
-- This makes conflict detection index-friendly and eliminates the need
-- for TIME() function wrappers in every query.

ALTER TABLE schedules
  MODIFY COLUMN start_time TIME NOT NULL COMMENT 'Time of day (UTC)',
  MODIFY COLUMN end_time TIME NOT NULL COMMENT 'Time of day (UTC)';

ALTER TABLE enrollments
  MODIFY COLUMN schedule_start_time TIME NULL,
  MODIFY COLUMN schedule_end_time TIME NULL;

-- Update triggers to copy TIME values directly
DROP TRIGGER IF EXISTS enrollments_bi_audit_keys;
DROP TRIGGER IF EXISTS enrollments_bu_audit_keys;

DELIMITER //

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
  SET NEW.schedule_day = (SELECT sch.day FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1);
  SET NEW.schedule_start_time = (SELECT sch.start_time FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1);
  SET NEW.schedule_end_time = (SELECT sch.end_time FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1);
END //

CREATE TRIGGER enrollments_bu_audit_keys
BEFORE UPDATE ON enrollments
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
  SET NEW.schedule_day = (SELECT sch.day FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1);
  SET NEW.schedule_start_time = (SELECT sch.start_time FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1);
  SET NEW.schedule_end_time = (SELECT sch.end_time FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1);
END //

DELIMITER ;

-- Rebuild conflict audit indexes with TIME columns for optimal performance
DROP INDEX idx_enrollments_room_conflict ON enrollments;
DROP INDEX idx_enrollments_student_conflict ON enrollments;
DROP INDEX idx_enrollments_lecturer_conflict ON enrollments;

CREATE INDEX idx_enrollments_room_conflict
ON enrollments(class_room_audit_sk, academic_year_start, semester_sort, schedule_day, schedule_start_time, schedule_end_time, course_id, audit_sk, schedule_audit_sk);

CREATE INDEX idx_enrollments_student_conflict
ON enrollments(student_audit_sk, academic_year_start, semester_sort, schedule_day, schedule_start_time, schedule_end_time, course_id, audit_sk, schedule_audit_sk);

CREATE INDEX idx_enrollments_lecturer_conflict
ON enrollments(lecturer_audit_sk, academic_year_start, semester_sort, schedule_day, schedule_start_time, schedule_end_time, course_id, audit_sk, schedule_audit_sk);
