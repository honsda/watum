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
  IF NOT (OLD.student_id <=> NEW.student_id) THEN
    SET NEW.student_audit_sk = (SELECT s.audit_sk FROM students s WHERE s.id = NEW.student_id LIMIT 1);
  END IF;

  IF NOT (OLD.course_id <=> NEW.course_id) THEN
    SELECT c.audit_sk, c.lecturer_audit_sk
      INTO NEW.course_audit_sk, NEW.lecturer_audit_sk
      FROM courses c WHERE c.id = NEW.course_id LIMIT 1;
  END IF;

  IF NOT (OLD.class_room_id <=> NEW.class_room_id) THEN
    SET NEW.class_room_audit_sk = (SELECT cr.audit_sk FROM class_rooms cr WHERE cr.id = NEW.class_room_id LIMIT 1);
  END IF;

  IF NOT (OLD.schedule_id <=> NEW.schedule_id) THEN
    SELECT sch.audit_sk, sch.day, sch.start_time, sch.end_time
      INTO NEW.schedule_audit_sk, NEW.schedule_day, NEW.schedule_start_time, NEW.schedule_end_time
      FROM schedules sch WHERE sch.id = NEW.schedule_id LIMIT 1;
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
