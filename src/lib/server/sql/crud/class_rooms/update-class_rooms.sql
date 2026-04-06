UPDATE class_rooms
SET
    `id` = CASE WHEN :idSet THEN :id ELSE `id` END,
    `name` = CASE WHEN :nameSet THEN :name ELSE `name` END,
    `class_room_type` = CASE WHEN :class_room_typeSet THEN :class_room_type ELSE `class_room_type` END,
    `capacity` = CASE WHEN :capacitySet THEN :capacity ELSE `capacity` END,
    `has_projector` = CASE WHEN :has_projectorSet THEN :has_projector ELSE `has_projector` END,
    `has_ac` = CASE WHEN :has_acSet THEN :has_ac ELSE `has_ac` END,
    `created_at` = CASE WHEN :created_atSet THEN :created_at ELSE `created_at` END,
    `updated_at` = CASE WHEN :updated_atSet THEN :updated_at ELSE `updated_at` END
WHERE
    `id` = :id