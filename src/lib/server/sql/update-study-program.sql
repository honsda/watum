UPDATE study_programs
SET name = :name,
    head = :head,
    faculty_id = :faculty_id
WHERE id = :id