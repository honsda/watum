SELECT
    `id`,
    `email`,
    `password`,
    `role`,
    `student_id`,
    `lecturer_id`,
    `created_at`,
    `updated_at`
FROM users
WHERE `id` = :id