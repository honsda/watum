-- Allow one schedule row to represent a class session with multiple enrolled students.
-- A non-unique schedule_id index already exists for joins and FK support.
SET @schedule_id_unique_exists := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'enrollments'
    AND index_name = 'schedule_id'
    AND non_unique = 0
);

SET @drop_schedule_id_unique := IF(
  @schedule_id_unique_exists > 0,
  'ALTER TABLE enrollments DROP INDEX schedule_id',
  'SELECT 1'
);

PREPARE drop_schedule_id_unique_stmt FROM @drop_schedule_id_unique;
EXECUTE drop_schedule_id_unique_stmt;
DEALLOCATE PREPARE drop_schedule_id_unique_stmt;
