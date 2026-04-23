-- @dynamicQuery
SELECT
    id,
    name,
    email,
    phone,
    address,
    created_at,
    updated_at,
    (SELECT COUNT(*) FROM schedules s WHERE s.lecturer_id = lecturers.id) AS schedule_count
FROM lecturers
ORDER BY name ASC, id ASC
LIMIT :offset, :limit
