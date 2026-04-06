UPDATE class_rooms
SET
    name = :name,
    class_room_type = :class_room_type,
    capacity = :capacity,
    has_projector = :has_projector,
    has_ac = :has_ac
WHERE class_rooms.id = :id