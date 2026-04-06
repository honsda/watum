UPDATE schedules
SET
    `id` = CASE WHEN :idSet THEN :id ELSE `id` END,
    `class_room_id` = CASE WHEN :class_room_idSet THEN :class_room_id ELSE `class_room_id` END,
    `day` = CASE WHEN :daySet THEN :day ELSE `day` END,
    `start_time` = CASE WHEN :start_timeSet THEN :start_time ELSE `start_time` END,
    `end_time` = CASE WHEN :end_timeSet THEN :end_time ELSE `end_time` END,
    `lecturer_id` = CASE WHEN :lecturer_idSet THEN :lecturer_id ELSE `lecturer_id` END,
    `created_at` = CASE WHEN :created_atSet THEN :created_at ELSE `created_at` END,
    `updated_at` = CASE WHEN :updated_atSet THEN :updated_at ELSE `updated_at` END
WHERE
    `id` = :id