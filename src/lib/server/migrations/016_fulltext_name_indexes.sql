-- Add FULLTEXT indexes for efficient name search across all dimension tables.
-- These replace slow LIKE '%value%' queries that cannot use B-tree indexes.
--
-- Uses InnoDB FULLTEXT with boolean mode for prefix wildcard support (word*).

CREATE FULLTEXT INDEX idx_students_name ON students(name);
CREATE FULLTEXT INDEX idx_courses_name ON courses(name);
CREATE FULLTEXT INDEX idx_lecturers_name ON lecturers(name);
CREATE FULLTEXT INDEX idx_class_rooms_name ON class_rooms(name);
CREATE FULLTEXT INDEX idx_study_programs_name ON study_programs(name);
CREATE FULLTEXT INDEX idx_faculties_name ON faculties(name);
