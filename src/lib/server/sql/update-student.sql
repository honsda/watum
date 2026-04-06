UPDATE students 
SET name = :name,
    email = :email,
    phone = :phone,
    address = :address,
    year_admitted = :year_admitted,
    study_program_id = :study_program_id
WHERE id = :id