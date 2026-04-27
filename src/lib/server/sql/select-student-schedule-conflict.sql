SELECT e.id, e.schedule_start_time AS start_time, e.schedule_end_time AS end_time, c.name AS course_name
FROM enrollments e
INNER JOIN courses c ON e.course_id = c.id
WHERE e.student_id = :studentId
AND e.schedule_day = :day
AND e.schedule_start_time < :endTime
AND e.schedule_end_time > :startTime
ORDER BY e.schedule_start_time ASC
