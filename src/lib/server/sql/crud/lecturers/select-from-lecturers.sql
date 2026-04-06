SELECT
    `id`,
    `name`,
    `email`,
    `phone`,
    `address`,
    `created_at`,
    `updated_at`
FROM lecturers
WHERE `id` = :id