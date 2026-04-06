SELECT
    `id`,
    `name`,
    `credits`,
    `study_program_id`,
    `created_at`,
    `updated_at`
FROM courses
WHERE `id` = :id