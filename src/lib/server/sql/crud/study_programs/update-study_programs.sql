UPDATE study_programs
SET
    `id` = CASE WHEN :idSet THEN :id ELSE `id` END,
    `name` = CASE WHEN :nameSet THEN :name ELSE `name` END,
    `head` = CASE WHEN :headSet THEN :head ELSE `head` END,
    `faculty_id` = CASE WHEN :faculty_idSet THEN :faculty_id ELSE `faculty_id` END,
    `created_at` = CASE WHEN :created_atSet THEN :created_at ELSE `created_at` END,
    `updated_at` = CASE WHEN :updated_atSet THEN :updated_at ELSE `updated_at` END
WHERE
    `id` = :id