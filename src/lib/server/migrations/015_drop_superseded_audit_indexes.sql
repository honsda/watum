-- Drop redundant indexes that were superseded by denormalized conflict indexes.
-- The old *_audit_scan indexes (migration 011) used schedule_audit_sk;
-- the new *_conflict indexes (migration 012) use schedule_day/start/end
-- and the app conflict audit now queries those denormalized columns directly.
-- Also drops idx_schedules_audit_covering, which was only needed for the
-- old subquery pattern: schedule_audit_sk IN (SELECT audit_sk FROM schedules WHERE day = ?).

DROP INDEX IF EXISTS idx_enrollments_room_audit_scan ON enrollments;
DROP INDEX IF EXISTS idx_enrollments_student_audit_scan ON enrollments;
DROP INDEX IF EXISTS idx_enrollments_course_audit_scan ON enrollments;
DROP INDEX IF EXISTS idx_enrollments_lecturer_audit_scan ON enrollments;
DROP INDEX IF EXISTS idx_schedules_audit_covering ON schedules;
