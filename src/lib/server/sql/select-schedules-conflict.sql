SELECT id, start_time, end_time FROM schedules
WHERE class_room_id =:classRoomId AND day = :day
AND ((start_time < :startTime AND end_time > :startTime)
OR (start_time < :endTime AND end_time > :endTime))