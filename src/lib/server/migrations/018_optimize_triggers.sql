-- Optimize audit triggers to skip expensive SELECT subqueries when FKs haven't changed.
-- This eliminates the O(n) SELECT cascade when courses_au_audit_keys updates
-- thousands of enrollment rows (each enrollment update was firing 8 SELECTs).

DROP TRIGGER IF EXISTS courses_bu_audit_keys;
DROP TRIGGER IF EXISTS courses_au_audit_keys;
DROP TRIGGER IF EXISTS enrollments_bu_audit_keys;

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
    SET NEW.class_room_audit_sk = (SELECT cr.audit_sk FROM class_rooms cr WHERE cr.id = NEW.class_room_id LIMIT 1);
  END IF;

  IF NOT (OLD.schedule_id <=> NEW.schedule_id) THEN
    SELECT sch.audit_sk, sch.day, sch.start_time, sch.end_time
      INTO v_schedule_audit_sk, v_schedule_day, v_schedule_start_time, v_schedule_end_time
      FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1;
    SET NEW.schedule_audit_sk = v_schedule_audit_sk;
    SET NEW.schedule_day = v_schedule_day;
    SET NEW.schedule_start_time = v_schedule_start_time;
    SET NEW.schedule_end_time = v_schedule_end_time;
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
