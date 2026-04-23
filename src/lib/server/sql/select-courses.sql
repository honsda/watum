-- @dynamicQuery
SELECT
    c.id,
    c.name,
    c.credits,
    c.study_program_id,
    c.lecturer_id,
    l.name AS lecturer_name,
    sp.name AS study_program_name,
    c.created_at,
    c.updated_at,
    (SELECT COUNT(*) from enrollments e WHERE e.course_id = c.id) AS enrollment_count
FROM courses c
INNER JOIN study_programs sp ON c.study_program_id = sp.id
INNER JOIN lecturers l ON c.lecturer_id = l.id
ORDER BY c.name ASC, c.id ASC
LIMIT :offset, :limit
