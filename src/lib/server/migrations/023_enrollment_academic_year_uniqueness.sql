ALTER TABLE enrollments
DROP INDEX enrollments_student_id_course_id_semester_key,
ADD UNIQUE KEY enrollments_student_course_term_key (
	student_id,
	course_id,
	semester,
	academic_year
);
