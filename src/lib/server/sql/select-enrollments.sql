-- @dynamicQuery
SELECT
    e.id,
    e.student_id,
    e.course_id,
    e.lecturer_id,
    e.class_room_id,
    e.schedule_id,
    e.semester,
    e.academic_year,
    s.name AS student_name,
    sp.name AS study_program_name,
    c.name AS course_name,
    c.credits AS course_credits,
    l.name AS lecturer_name,
    cr.name AS class_room_name,
    sch.day AS schedule_day,
    sch.start_time AS schedule_start_time,
    sch.end_time AS schedule_end_time,
    g.id as grade_id,
    g.letter_grade as letter_grade
FROM enrollments e 
INNER JOIN students s on e.student_id = s.id
INNER JOIN study_programs sp ON s.study_program_id = sp.id
INNER JOIN courses c ON e.course_id = c.id
INNER JOIN lecturers l ON e.lecturer_id = l.id
INNER JOIN class_rooms cr ON e.class_room_id = cr.id
INNER JOIN schedules sch ON e.schedule_id = sch.id
LEFT JOIN grades g ON e.id = g.enrollment_id
ORDER BY e.academic_year DESC, s.name ASC