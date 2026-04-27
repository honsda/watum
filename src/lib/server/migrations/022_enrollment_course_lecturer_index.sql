-- Add a composite index on (course_id, lecturer_audit_sk) so the
-- courses_au_audit_keys trigger can resolve its WHERE clause entirely
-- in the index without touching table rows.
--
-- The trigger does:
--   UPDATE enrollments
--   SET lecturer_audit_sk = ?, course_audit_sk = ?
--   WHERE course_id = ? AND NOT (lecturer_audit_sk <=> ?)
--
-- With this index MariaDB navigates to course_id, then skips rows where
-- lecturer_audit_sk already matches the new value, turning the UPDATE
-- into a narrow index-range scan instead of a wider row lookup.

CREATE INDEX idx_enrollments_course_lecturer ON enrollments(course_id, lecturer_audit_sk);
