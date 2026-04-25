-- Add denormalized schedule columns to enrollments for fast conflict detection.
-- These columns mirror schedules.day, schedules.start_time, schedules.end_time
-- so that conflict queries can run as pure index-only scans on enrollments
-- without joining the schedules table.

ALTER TABLE enrollments
  ADD COLUMN schedule_day ENUM('SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU') NULL AFTER schedule_audit_sk,
  ADD COLUMN schedule_start_time DATETIME(3) NULL AFTER schedule_day,
  ADD COLUMN schedule_end_time DATETIME(3) NULL AFTER schedule_start_time;

-- Populate existing rows from schedules
UPDATE enrollments e
JOIN schedules s ON s.audit_sk = e.schedule_audit_sk
SET e.schedule_day = s.day,
    e.schedule_start_time = s.start_time,
    e.schedule_end_time = s.end_time
WHERE e.schedule_day IS NULL;

-- Covering indexes for fast conflict aggregation (index-only scans)
CREATE INDEX idx_enrollments_room_conflict
ON enrollments(class_room_audit_sk, academic_year_start, semester_sort, schedule_day, schedule_start_time, schedule_end_time, audit_sk);

CREATE INDEX idx_enrollments_student_conflict
ON enrollments(student_audit_sk, academic_year_start, semester_sort, schedule_day, schedule_start_time, schedule_end_time, audit_sk);

CREATE INDEX idx_enrollments_lecturer_conflict
ON enrollments(lecturer_audit_sk, academic_year_start, semester_sort, schedule_day, schedule_start_time, schedule_end_time, audit_sk);

-- Update triggers to keep denormalized columns in sync
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
