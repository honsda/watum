SELECT e.id, sch.start_time, sch.end_time, c.name AS course_name
FROM enrollments e
INNER JOIN schedules sch ON e.schedule_id = sch.id
INNER JOIN courses c ON e.course_id = c.id
WHERE e.student_id = :studentId
AND sch.day = :day
AND sch.start_time < :endTime
AND sch.end_time > :startTime
LIMIT 1
