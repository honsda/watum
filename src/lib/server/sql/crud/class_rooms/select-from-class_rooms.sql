SELECT
    `id`,
    `name`,
    `class_room_type`,
    `capacity`,
    `has_projector`,
    `has_ac`,
    `created_at`,
    `updated_at`
FROM class_rooms
WHERE `id` = :id