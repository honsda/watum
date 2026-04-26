-- Drop the courses_au_audit_keys trigger and move enrollment cascade to application code.
-- Triggers that scan + update tens of thousands of rows synchronously are an
-- anti-pattern at 10M+ scale. Batching in application code is far faster.

DROP TRIGGER IF EXISTS courses_au_audit_keys;
