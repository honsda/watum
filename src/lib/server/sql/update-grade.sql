UPDATE grades
SET assignment_score = :assignment_score,
    midterm_score = :midterm_score,
    final_score = :final_score,
    total_score = :total_score,
    letter_grade = :letter_grade
WHERE id = :id