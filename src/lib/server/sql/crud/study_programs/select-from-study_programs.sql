SELECT
    `id`,
    `name`,
    `head`,
    `faculty_id`,
    `created_at`,
    `updated_at`
FROM study_programs
WHERE `id` = :id