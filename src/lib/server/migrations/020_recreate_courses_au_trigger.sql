-- Recreate courses_au_audit_keys trigger with optimized query.
-- The trigger now only updates enrollments where lecturer_audit_sk
-- actually differs, avoiding unnecessary writes.

DROP TRIGGER IF EXISTS courses_au_audit_keys;

DELIMITER //

CREATE TRIGGER courses_au_audit_keys
AFTER UPDATE ON courses
FOR EACH ROW
BEGIN
  IF NOT (OLD.lecturer_audit_sk <=> NEW.lecturer_audit_sk) THEN
    UPDATE enrollments
    SET lecturer_audit_sk = NEW.lecturer_audit_sk
    WHERE course_id = NEW.id
      AND lecturer_audit_sk <> NEW.lecturer_audit_sk;
  END IF;
END //

DELIMITER ;
