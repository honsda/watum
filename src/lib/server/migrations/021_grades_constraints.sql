-- Add CHECK constraints and a BEFORE INSERT/UPDATE trigger
-- to keep grades score columns valid and total_score consistent.

ALTER TABLE grades
  ADD CONSTRAINT chk_grades_assignment CHECK (assignment_score >= 0 AND assignment_score <= 100),
  ADD CONSTRAINT chk_grades_midterm   CHECK (midterm_score   >= 0 AND midterm_score   <= 100),
  ADD CONSTRAINT chk_grades_final     CHECK (final_score     >= 0 AND final_score     <= 100),
  ADD CONSTRAINT chk_grades_total     CHECK (total_score     >= 0 AND total_score     <= 100);

DELIMITER //

CREATE TRIGGER grades_bi_compute_total
BEFORE INSERT ON grades
FOR EACH ROW
BEGIN
  SET NEW.total_score = ROUND(NEW.assignment_score * 0.3 + NEW.midterm_score * 0.3 + NEW.final_score * 0.4, 2);
END //

CREATE TRIGGER grades_bu_compute_total
BEFORE UPDATE ON grades
FOR EACH ROW
BEGIN
  IF NOT (OLD.assignment_score <=> NEW.assignment_score)
     OR NOT (OLD.midterm_score   <=> NEW.midterm_score)
     OR NOT (OLD.final_score     <=> NEW.final_score) THEN
    SET NEW.total_score = ROUND(NEW.assignment_score * 0.3 + NEW.midterm_score * 0.3 + NEW.final_score * 0.4, 2);
  END IF;
END //

DELIMITER ;
