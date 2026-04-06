-- @dynamicQuery
SELECT
    s.id,
    s.class_room_id,
    s.day,
    s.start_time,
    s.end_time,
    s.lecturer_id,
    c.name AS course_name
FROM schedules s
LEFT JOIN enrollments e ON s.id = e.schedule_id
LEFT JOIN courses c ON e.course_id = c.id
ORDER BY s.day, s.start_time