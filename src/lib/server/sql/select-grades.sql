-- @dynamicQuery
SELECT
    g.id,
    g.enrollment_id,
    g.assignment_score,
    g.midterm_score,
    g.final_score,
    g.total_score,
    g.letter_grade,
    g.created_at,
    g.updated_at,
    s.id AS student_id,
    s.name AS student_name,
    s.email AS student_email,
    sp.name AS study_program_name,
    c.id AS course_id,
    c.name AS course_name,
    c.credits,
    c.lecturer_id
FROM grades g
INNER JOIN enrollments e ON g.enrollment_id = e.id
INNER JOIN students s ON e.student_id = s.id
INNER JOIN courses c ON e.course_id = c.id
INNER JOIN study_programs sp ON s.study_program_id = sp.id
ORDER BY s.name ASC