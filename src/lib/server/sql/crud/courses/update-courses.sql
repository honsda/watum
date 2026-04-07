UPDATE courses
SET
    `id` = CASE WHEN :idSet THEN :id ELSE `id` END,
    `name` = CASE WHEN :nameSet THEN :name ELSE `name` END,
    `credits` = CASE WHEN :creditsSet THEN :credits ELSE `credits` END,
    `study_program_id` = CASE WHEN :study_program_idSet THEN :study_program_id ELSE `study_program_id` END,
    `lecturer_id` = CASE WHEN :lecturer_idSet THEN :lecturer_id ELSE `lecturer_id` END,
    `created_at` = CASE WHEN :created_atSet THEN :created_at ELSE `created_at` END,
    `updated_at` = CASE WHEN :updated_atSet THEN :updated_at ELSE `updated_at` END
WHERE
    `id` = :id