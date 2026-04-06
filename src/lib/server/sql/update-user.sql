UPDATE users
SET email = :email, password = :password, role = :role, student_id = :student_id, lecturer_id = :lecturer_id
WHERE id = :id