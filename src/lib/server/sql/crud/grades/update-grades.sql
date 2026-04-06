UPDATE grades
SET
    `id` = CASE WHEN :idSet THEN :id ELSE `id` END,
    `enrollment_id` = CASE WHEN :enrollment_idSet THEN :enrollment_id ELSE `enrollment_id` END,
    `assignment_score` = CASE WHEN :assignment_scoreSet THEN :assignment_score ELSE `assignment_score` END,
    `midterm_score` = CASE WHEN :midterm_scoreSet THEN :midterm_score ELSE `midterm_score` END,
    `final_score` = CASE WHEN :final_scoreSet THEN :final_score ELSE `final_score` END,
    `total_score` = CASE WHEN :total_scoreSet THEN :total_score ELSE `total_score` END,
    `letter_grade` = CASE WHEN :letter_gradeSet THEN :letter_grade ELSE `letter_grade` END,
    `created_at` = CASE WHEN :created_atSet THEN :created_at ELSE `created_at` END,
    `updated_at` = CASE WHEN :updated_atSet THEN :updated_at ELSE `updated_at` END
WHERE
    `id` = :id