SELECT
    `id`,
    `enrollment_id`,
    `assignment_score`,
    `midterm_score`,
    `final_score`,
    `total_score`,
    `letter_grade`,
    `created_at`,
    `updated_at`
FROM grades
WHERE `id` = :id