UPDATE courses
SET name = :name,
    credits = :credits,
    study_program_id = :study_program_id
WHERE id = :id