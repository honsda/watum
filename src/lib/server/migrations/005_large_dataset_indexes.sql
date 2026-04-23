CREATE INDEX idx_students_name_id ON students(name, id);
CREATE INDEX idx_lecturers_name_id ON lecturers(name, id);
CREATE INDEX idx_courses_name_id ON courses(name, id);
CREATE INDEX idx_courses_study_program_name_id ON courses(study_program_id, name, id);
CREATE INDEX idx_courses_lecturer_name_id ON courses(lecturer_id, name, id);
CREATE INDEX idx_study_programs_faculty_name_id ON study_programs(faculty_id, name, id);
CREATE INDEX idx_grades_letter_grade_id ON grades(letter_grade, id);
CREATE INDEX idx_grades_total_score_id ON grades(total_score, id);
CREATE INDEX idx_schedules_day_start_id ON schedules(day, start_time, id);
