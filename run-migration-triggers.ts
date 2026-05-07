import { createPool } from 'mysql2/promise';

const pool = createPool({
  host: '129.150.54.149',
  port: 5432,
  user: 'mariadb',
  password: 'dharon1234',
  database: 'projectbasdat2',
  timezone: '+00:00',
  connectTimeout: 10000
});

async function run() {
  const conn = await pool.getConnection();
  try {
    console.log('Dropping old triggers...');
    await conn.query(`DROP TRIGGER IF EXISTS enrollments_bi_audit_keys`);
    await conn.query(`DROP TRIGGER IF EXISTS enrollments_bu_audit_keys`);
    console.log('Triggers dropped');

    console.log('Creating bi trigger...');
    await conn.query(`
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
END
    `);
    console.log('bi trigger created');

    console.log('Creating bu trigger...');
    await conn.query(`
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
END
    `);
    console.log('bu trigger created');
    console.log('All done');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

run();
