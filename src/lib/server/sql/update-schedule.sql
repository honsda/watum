UPDATE schedules
SET class_room_id = :class_room_id, day = :day, start_time = :start_time,
    end_time = :end_time, lecturer_id = :lecturer_id
WHERE id = :id