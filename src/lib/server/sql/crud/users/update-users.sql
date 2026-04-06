UPDATE users
SET
    `id` = CASE WHEN :idSet THEN :id ELSE `id` END,
    `email` = CASE WHEN :emailSet THEN :email ELSE `email` END,
    `password` = CASE WHEN :passwordSet THEN :password ELSE `password` END,
    `role` = CASE WHEN :roleSet THEN :role ELSE `role` END,
    `student_id` = CASE WHEN :student_idSet THEN :student_id ELSE `student_id` END,
    `lecturer_id` = CASE WHEN :lecturer_idSet THEN :lecturer_id ELSE `lecturer_id` END,
    `created_at` = CASE WHEN :created_atSet THEN :created_at ELSE `created_at` END,
    `updated_at` = CASE WHEN :updated_atSet THEN :updated_at ELSE `updated_at` END
WHERE
    `id` = :id