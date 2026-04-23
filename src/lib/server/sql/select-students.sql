-- @dynamicQuery
SELECT
    s.id,
    s.name,
    s.email,
    s.phone,
    s.address,
    s.year_admitted,
    s.study_program_id,
    s.created_at,
    s.updated_at,
    sp.name AS study_program_name,
    f.name AS faculty_name,
    f.id AS faculty_id,
    (SELECT COUNT(*) FROM enrollments e WHERE e.student_id = s.id) AS enrollment_count
FROM students s
INNER JOIN study_programs sp ON s.study_program_id = sp.id
INNER JOIN faculties f ON sp.faculty_id = f.id
ORDER BY s.name ASC, s.id ASC
LIMIT :offset, :limit
