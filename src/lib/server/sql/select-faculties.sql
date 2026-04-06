-- @dynamicQuery
SELECT 
    id,
    name,
    created_at,
    updated_at,
    (SELECT COUNT(*) from study_programs sp WHERE sp.faculty_id = faculties.id) AS study_program_count
FROM faculties
ORDER BY name ASC