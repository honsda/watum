SELECT id, start_time, end_time FROM schedules
WHERE class_room_id =:classRoomId AND day = :day
AND start_time < :endTime AND end_time > :startTime
ORDER BY start_time ASC
LIMIT 1
