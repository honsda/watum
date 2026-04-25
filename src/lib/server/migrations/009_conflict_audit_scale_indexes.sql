CREATE INDEX idx_enrollments_class_room_term_schedule_id
ON enrollments(class_room_id, academic_year, semester, schedule_id, id);

CREATE INDEX idx_enrollments_student_term_schedule_id
ON enrollments(student_id, academic_year, semester, schedule_id, id);

CREATE INDEX idx_enrollments_course_term_schedule_id
ON enrollments(course_id, academic_year, semester, schedule_id, id);
