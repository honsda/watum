SELECT
    `id`,
    `student_id`,
    `course_id`,
    `class_room_id`,
    `schedule_id`,
    `semester`,
    `academic_year`,
    `created_at`,
    `updated_at`
FROM enrollments
WHERE `id` = :id