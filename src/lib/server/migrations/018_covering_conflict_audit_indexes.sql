-- Rebuild conflict audit indexes so aggregation and member lookup stay index-only.
-- The earlier conflict indexes omitted course_id and schedule_audit_sk even though
-- the audit query needs them for COUNT(DISTINCT course_id) and member hydration.

DROP INDEX idx_enrollments_room_conflict ON enrollments;
DROP INDEX idx_enrollments_student_conflict ON enrollments;
DROP INDEX idx_enrollments_lecturer_conflict ON enrollments;

CREATE INDEX idx_enrollments_room_conflict
ON enrollments(class_room_audit_sk, academic_year_start, semester_sort, schedule_day, schedule_start_time, schedule_end_time, course_id, audit_sk, schedule_audit_sk);

CREATE INDEX idx_enrollments_student_conflict
ON enrollments(student_audit_sk, academic_year_start, semester_sort, schedule_day, schedule_start_time, schedule_end_time, course_id, audit_sk, schedule_audit_sk);

CREATE INDEX idx_enrollments_lecturer_conflict
ON enrollments(lecturer_audit_sk, academic_year_start, semester_sort, schedule_day, schedule_start_time, schedule_end_time, course_id, audit_sk, schedule_audit_sk);
