-- @dynamicQuery
SELECT 
    sp.id,
    sp.name,
    sp.head,
    sp.faculty_id,
    f.name AS faculty_name,
    sp.created_at,
    sp.updated_at,
    (SELECT COUNT(*) FROM students s WHERE s.study_program_id = sp.id) AS student_count
FROM study_programs sp
INNER JOIN faculties f ON sp.faculty_id = f.id
ORDER BY sp.name ASC