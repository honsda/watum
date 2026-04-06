-- @dynamicQuery
SELECT
    u.id,
    u.email,
    u.role,
    u.password,
    u.student_id,
    s.name as student_name,
    u.lecturer_id,
    l.name as lecturer_name
FROM users u
LEFT JOIN students s ON u.student_id = s.id
LEFT JOIN lecturers l ON u.lecturer_id = l.id