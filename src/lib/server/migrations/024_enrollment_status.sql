-- Add enrollment status to support student course requests vs approved scheduled enrollments.
-- Students can request courses (PENDING); admins/lecturers set schedule and approve (APPROVED).

ALTER TABLE enrollments
  ADD COLUMN status ENUM('PENDING', 'APPROVED') NOT NULL DEFAULT 'APPROVED',
  MODIFY COLUMN class_room_id VARCHAR(64) NULL,
  MODIFY COLUMN schedule_id VARCHAR(64) UNIQUE NULL;

-- Update triggers to handle NULL class_room_id / schedule_id for pending enrollments.
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
    IF NEW.schedule_id IS NOT NULL THEN
      SET NEW.schedule_day = (SELECT sch.day FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1);
      SET NEW.schedule_start_time = (SELECT sch.start_time FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1);
      SET NEW.schedule_end_time = (SELECT sch.end_time FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1);
    ELSE
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

DELIMITER ;
