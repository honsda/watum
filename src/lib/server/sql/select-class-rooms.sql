-- @dynamicQuery
SELECT 
    c.id,
    c.name,
    c.class_room_type,
    c.capacity,
    c.has_projector,
    c.has_ac,
    c.created_at,
    c.updated_at,
    (SELECT COUNT(*) FROM enrollments e WHERE e.class_room_id = c.id) as enrollment_count,
    (SELECT COUNT(*) FROM schedules s WHERE s.class_room_id = c.id) as schedule_count
FROM class_rooms c
ORDER BY c.name