UPDATE enrollments
SET student_id = :student_id, course_id = :course_id, lecturer_id = :lecturer_id,
    class_room_id = :class_room_id, semester = :semester, academic_year = :academic_year
WHERE id = :id