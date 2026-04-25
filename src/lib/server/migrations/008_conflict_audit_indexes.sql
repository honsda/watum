CREATE INDEX idx_schedules_lecturer_day_time_id ON schedules(lecturer_id, day, start_time, end_time, id);
CREATE INDEX idx_enrollments_course_schedule_id ON enrollments(course_id, schedule_id, id);
CREATE INDEX idx_enrollments_class_room_schedule_id ON enrollments(class_room_id, schedule_id, id);
