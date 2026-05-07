CREATE TABLE IF NOT EXISTS enrollment_policy (
  id TINYINT PRIMARY KEY,
  academic_year VARCHAR(32) NOT NULL,
  student_enrollment_requests_open BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
  updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO enrollment_policy (id, academic_year, student_enrollment_requests_open)
VALUES (1, '2025/2026', FALSE);
