UPDATE lecturers
SET
    `id` = CASE WHEN :idSet THEN :id ELSE `id` END,
    `name` = CASE WHEN :nameSet THEN :name ELSE `name` END,
    `email` = CASE WHEN :emailSet THEN :email ELSE `email` END,
    `phone` = CASE WHEN :phoneSet THEN :phone ELSE `phone` END,
    `address` = CASE WHEN :addressSet THEN :address ELSE `address` END,
    `created_at` = CASE WHEN :created_atSet THEN :created_at ELSE `created_at` END,
    `updated_at` = CASE WHEN :updated_atSet THEN :updated_at ELSE `updated_at` END
WHERE
    `id` = :id