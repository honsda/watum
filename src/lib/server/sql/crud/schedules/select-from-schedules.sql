SELECT
    `id`,
    `class_room_id`,
    `day`,
    `start_time`,
    `end_time`,
    `lecturer_id`,
    `created_at`,
    `updated_at`
FROM schedules
WHERE `id` = :id