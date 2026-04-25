ALTER TABLE students
  ADD COLUMN audit_sk BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE;

ALTER TABLE lecturers
  ADD COLUMN audit_sk BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE;

ALTER TABLE class_rooms
  ADD COLUMN audit_sk BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE;

ALTER TABLE schedules
  ADD COLUMN audit_sk BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE;

ALTER TABLE courses
  ADD COLUMN audit_sk BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  ADD COLUMN lecturer_audit_sk BIGINT UNSIGNED NULL;

UPDATE courses c
JOIN lecturers l ON l.id = c.lecturer_id
SET c.lecturer_audit_sk = l.audit_sk
WHERE c.lecturer_audit_sk IS NULL;

ALTER TABLE courses
  MODIFY COLUMN lecturer_audit_sk BIGINT UNSIGNED NOT NULL;

ALTER TABLE enrollments
  ADD COLUMN audit_sk BIGINT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE,
  ADD COLUMN student_audit_sk BIGINT UNSIGNED NULL,
  ADD COLUMN course_audit_sk BIGINT UNSIGNED NULL,
  ADD COLUMN lecturer_audit_sk BIGINT UNSIGNED NULL,
  ADD COLUMN class_room_audit_sk BIGINT UNSIGNED NULL,
  ADD COLUMN schedule_audit_sk BIGINT UNSIGNED NULL,
  ADD COLUMN academic_year_start SMALLINT UNSIGNED NULL,
  ADD COLUMN semester_sort TINYINT UNSIGNED NULL;

UPDATE enrollments e
JOIN students s ON s.id = e.student_id
JOIN courses c ON c.id = e.course_id
JOIN class_rooms cr ON cr.id = e.class_room_id
JOIN schedules sch ON sch.id = e.schedule_id
SET e.student_audit_sk = s.audit_sk,
    e.course_audit_sk = c.audit_sk,
    e.lecturer_audit_sk = c.lecturer_audit_sk,
    e.class_room_audit_sk = cr.audit_sk,
    e.schedule_audit_sk = sch.audit_sk,
    e.academic_year_start = CAST(SUBSTRING(e.academic_year, 1, 4) AS UNSIGNED),
    e.semester_sort = CASE
      WHEN UPPER(e.semester) LIKE 'GAN%' THEN 1
      WHEN UPPER(e.semester) LIKE 'GEN%' THEN 2
      ELSE 9
    END
WHERE e.student_audit_sk IS NULL
   OR e.course_audit_sk IS NULL
   OR e.lecturer_audit_sk IS NULL
   OR e.class_room_audit_sk IS NULL
   OR e.schedule_audit_sk IS NULL
   OR e.academic_year_start IS NULL
   OR e.semester_sort IS NULL;

ALTER TABLE enrollments
  MODIFY COLUMN student_audit_sk BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN course_audit_sk BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN lecturer_audit_sk BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN class_room_audit_sk BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN schedule_audit_sk BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN academic_year_start SMALLINT UNSIGNED NOT NULL,
  MODIFY COLUMN semester_sort TINYINT UNSIGNED NOT NULL;

DROP TRIGGER IF EXISTS courses_bi_audit_keys;
DROP TRIGGER IF EXISTS courses_bu_audit_keys;
DROP TRIGGER IF EXISTS courses_au_audit_keys;
DROP TRIGGER IF EXISTS enrollments_bi_audit_keys;
DROP TRIGGER IF EXISTS enrollments_bu_audit_keys;

DELIMITER //

CREATE TRIGGER courses_bi_audit_keys
BEFORE INSERT ON courses
FOR EACH ROW
BEGIN
  SET NEW.lecturer_audit_sk = (
    SELECT l.audit_sk FROM lecturers l WHERE l.id = NEW.lecturer_id LIMIT 1
  );
END //

CREATE TRIGGER courses_bu_audit_keys
BEFORE UPDATE ON courses
FOR EACH ROW
BEGIN
  SET NEW.lecturer_audit_sk = (
    SELECT l.audit_sk FROM lecturers l WHERE l.id = NEW.lecturer_id LIMIT 1
  );
END //

CREATE TRIGGER courses_au_audit_keys
AFTER UPDATE ON courses
FOR EACH ROW
BEGIN
  IF NOT (OLD.lecturer_audit_sk <=> NEW.lecturer_audit_sk) THEN
    UPDATE enrollments
    SET lecturer_audit_sk = NEW.lecturer_audit_sk,
        course_audit_sk = NEW.audit_sk
    WHERE course_id = NEW.id;
  END IF;
END //

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
END //

DELIMITER ;

CREATE INDEX idx_courses_lecturer_audit_scan
ON courses(lecturer_audit_sk, audit_sk);

CREATE INDEX idx_enrollments_room_audit_scan
ON enrollments(class_room_audit_sk, academic_year_start, semester_sort, schedule_audit_sk, audit_sk);

CREATE INDEX idx_enrollments_student_audit_scan
ON enrollments(student_audit_sk, academic_year_start, semester_sort, schedule_audit_sk, audit_sk);

CREATE INDEX idx_enrollments_course_audit_scan
ON enrollments(course_audit_sk, academic_year_start, semester_sort, schedule_audit_sk, audit_sk);

CREATE INDEX idx_enrollments_lecturer_audit_scan
ON enrollments(lecturer_audit_sk, academic_year_start, semester_sort, course_audit_sk, schedule_audit_sk, audit_sk);
