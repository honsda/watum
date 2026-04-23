CREATE INDEX idx_schedules_room_day_time ON schedules(class_room_id, day, start_time, end_time);
CREATE INDEX idx_enrollments_student_schedule ON enrollments(student_id, schedule_id);
