UPDATE students
SET
    `id` = CASE WHEN :idSet THEN :id ELSE `id` END,
    `name` = CASE WHEN :nameSet THEN :name ELSE `name` END,
    `email` = CASE WHEN :emailSet THEN :email ELSE `email` END,
    `phone` = CASE WHEN :phoneSet THEN :phone ELSE `phone` END,
    `address` = CASE WHEN :addressSet THEN :address ELSE `address` END,
    `year_admitted` = CASE WHEN :year_admittedSet THEN :year_admitted ELSE `year_admitted` END,
    `study_program_id` = CASE WHEN :study_program_idSet THEN :study_program_id ELSE `study_program_id` END,
    `created_at` = CASE WHEN :created_atSet THEN :created_at ELSE `created_at` END,
    `updated_at` = CASE WHEN :updated_atSet THEN :updated_at ELSE `updated_at` END
WHERE
    `id` = :id