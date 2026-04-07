UPDATE enrollments
SET
    `id` = CASE WHEN :idSet THEN :id ELSE `id` END,
    `student_id` = CASE WHEN :student_idSet THEN :student_id ELSE `student_id` END,
    `course_id` = CASE WHEN :course_idSet THEN :course_id ELSE `course_id` END,
    `class_room_id` = CASE WHEN :class_room_idSet THEN :class_room_id ELSE `class_room_id` END,
    `schedule_id` = CASE WHEN :schedule_idSet THEN :schedule_id ELSE `schedule_id` END,
    `semester` = CASE WHEN :semesterSet THEN :semester ELSE `semester` END,
    `academic_year` = CASE WHEN :academic_yearSet THEN :academic_year ELSE `academic_year` END,
    `created_at` = CASE WHEN :created_atSet THEN :created_at ELSE `created_at` END,
    `updated_at` = CASE WHEN :updated_atSet THEN :updated_at ELSE `updated_at` END
WHERE
    `id` = :id