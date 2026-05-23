/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.11.14-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: coolify.bumimas12.web.id    Database: projectbasdat2
-- ------------------------------------------------------
-- Server version	11.8.6-MariaDB-ubu2404

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `class_rooms`
--

DROP TABLE IF EXISTS `class_rooms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `class_rooms` (
  `id` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `class_room_type` enum('REGULER','LAB_KOMPUTER','LAB_BAHASA','AUDITORIUM') NOT NULL,
  `capacity` int(11) NOT NULL,
  `has_projector` tinyint(1) DEFAULT 0,
  `has_ac` tinyint(1) DEFAULT 0,
  `created_at` timestamp(3) NULL DEFAULT current_timestamp(3),
  `updated_at` timestamp(3) NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
  `audit_sk` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `audit_sk` (`audit_sk`),
  FULLTEXT KEY `idx_class_rooms_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=71637 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `courses`
--

DROP TABLE IF EXISTS `courses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `courses` (
  `id` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `credits` int(11) NOT NULL,
  `study_program_id` varchar(16) NOT NULL,
  `lecturer_id` varchar(64) NOT NULL,
  `created_at` timestamp(3) NULL DEFAULT current_timestamp(3),
  `updated_at` timestamp(3) NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
  `audit_sk` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `lecturer_audit_sk` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `audit_sk` (`audit_sk`),
  KEY `idx_courses_name_id` (`name`,`id`),
  KEY `idx_courses_study_program_name_id` (`study_program_id`,`name`,`id`),
  KEY `idx_courses_lecturer_name_id` (`lecturer_id`,`name`,`id`),
  KEY `idx_courses_lecturer_audit_scan` (`lecturer_audit_sk`,`audit_sk`),
  KEY `idx_courses_study_program` (`study_program_id`),
  KEY `idx_courses_lecturer` (`lecturer_id`),
  FULLTEXT KEY `idx_courses_name` (`name`),
  CONSTRAINT `courses_ibfk_1` FOREIGN KEY (`study_program_id`) REFERENCES `study_programs` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT `courses_ibfk_2` FOREIGN KEY (`lecturer_id`) REFERENCES `lecturers` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `enrollments`
--

DROP TABLE IF EXISTS `enrollments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `enrollments` (
  `id` varchar(64) NOT NULL,
  `student_id` varchar(64) NOT NULL,
  `course_id` varchar(64) NOT NULL,
  `class_room_id` varchar(64) NOT NULL,
  `schedule_id` varchar(64) NOT NULL,
  `semester` varchar(32) NOT NULL,
  `academic_year` varchar(32) NOT NULL,
  `created_at` timestamp(3) NULL DEFAULT current_timestamp(3),
  `updated_at` timestamp(3) NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
  `audit_sk` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `student_audit_sk` bigint(20) unsigned NOT NULL,
  `course_audit_sk` bigint(20) unsigned NOT NULL,
  `lecturer_audit_sk` bigint(20) unsigned NOT NULL,
  `class_room_audit_sk` bigint(20) unsigned NOT NULL,
  `schedule_audit_sk` bigint(20) unsigned NOT NULL,
  `schedule_day` enum('SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU') DEFAULT NULL,
  `schedule_start_time` time DEFAULT NULL,
  `schedule_end_time` time DEFAULT NULL,
  `academic_year_start` smallint(5) unsigned NOT NULL,
  `semester_sort` tinyint(3) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `audit_sk` (`audit_sk`),
  UNIQUE KEY `enrollments_student_course_term_key` (`student_id`,`course_id`,`semester`,`academic_year`),
  KEY `idx_enrollments_semester_year` (`semester`,`academic_year`),
  KEY `idx_enrollments_student_schedule` (`student_id`,`schedule_id`),
  KEY `idx_enrollments_student_id_id` (`student_id`,`id`),
  KEY `idx_enrollments_academic_year_id` (`academic_year`,`id`),
  KEY `idx_enrollments_course_schedule_id` (`course_id`,`schedule_id`,`id`),
  KEY `idx_enrollments_class_room_schedule_id` (`class_room_id`,`schedule_id`,`id`),
  KEY `idx_enrollments_room_conflict` (`class_room_audit_sk`,`academic_year_start`,`semester_sort`,`schedule_day`,`schedule_start_time`,`schedule_end_time`,`course_id`,`audit_sk`,`schedule_audit_sk`),
  KEY `idx_enrollments_student_conflict` (`student_audit_sk`,`academic_year_start`,`semester_sort`,`schedule_day`,`schedule_start_time`,`schedule_end_time`,`course_id`,`audit_sk`,`schedule_audit_sk`),
  KEY `idx_enrollments_course_lecturer` (`course_id`,`lecturer_audit_sk`),
  KEY `idx_enrollments_lecturer_conflict` (`lecturer_audit_sk`,`academic_year_start`,`semester_sort`,`schedule_day`,`schedule_start_time`,`schedule_end_time`,`course_id`,`audit_sk`,`schedule_audit_sk`),
  KEY `idx_enrollments_student` (`student_id`),
  KEY `idx_enrollments_course` (`course_id`),
  KEY `idx_enrollments_class_room` (`class_room_id`),
  KEY `idx_enrollments_schedule` (`schedule_id`),
  KEY `idx_enrollments_class_room_term_schedule_id` (`class_room_id`,`academic_year`,`semester`,`schedule_id`,`id`),
  KEY `idx_enrollments_student_term_schedule_id` (`student_id`,`academic_year`,`semester`,`schedule_id`,`id`),
  KEY `idx_enrollments_course_term_schedule_id` (`course_id`,`academic_year`,`semester`,`schedule_id`,`id`),
  CONSTRAINT `enrollments_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT `enrollments_ibfk_2` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT `enrollments_ibfk_3` FOREIGN KEY (`class_room_id`) REFERENCES `class_rooms` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT `enrollments_ibfk_4` FOREIGN KEY (`schedule_id`) REFERENCES `schedules` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2750780 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `faculties`
--

DROP TABLE IF EXISTS `faculties`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `faculties` (
  `id` varchar(16) NOT NULL,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp(3) NULL DEFAULT current_timestamp(3),
  `updated_at` timestamp(3) NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  FULLTEXT KEY `idx_faculties_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `grades`
--

DROP TABLE IF EXISTS `grades`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `grades` (
  `id` varchar(64) NOT NULL,
  `enrollment_id` varchar(64) NOT NULL,
  `assignment_score` float DEFAULT NULL,
  `midterm_score` float DEFAULT NULL,
  `final_score` float DEFAULT NULL,
  `total_score` float DEFAULT NULL,
  `letter_grade` varchar(8) DEFAULT NULL,
  `created_at` timestamp(3) NULL DEFAULT current_timestamp(3),
  `updated_at` timestamp(3) NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `enrollment_id` (`enrollment_id`),
  KEY `idx_grades_letter_grade_id` (`letter_grade`,`id`),
  KEY `idx_grades_total_score_id` (`total_score`,`id`),
  KEY `idx_grades_enrollment` (`enrollment_id`),
  CONSTRAINT `grades_ibfk_1` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lecturers`
--

DROP TABLE IF EXISTS `lecturers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lecturers` (
  `id` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `created_at` timestamp(3) NULL DEFAULT current_timestamp(3),
  `updated_at` timestamp(3) NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
  `audit_sk` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `audit_sk` (`audit_sk`),
  KEY `idx_lecturers_name_id` (`name`,`id`),
  FULLTEXT KEY `idx_lecturers_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=252 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `refresh_tokens`
--

DROP TABLE IF EXISTS `refresh_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `refresh_tokens` (
  `id` varchar(64) NOT NULL,
  `user_id` varchar(64) NOT NULL,
  `token_hash` varchar(255) NOT NULL,
  `context_binding` varchar(255) NOT NULL,
  `expires_at` timestamp(3) NOT NULL,
  `created_at` timestamp(3) NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `idx_refresh_tokens_expires` (`expires_at`),
  KEY `idx_refresh_tokens_user_context` (`user_id`,`context_binding`),
  KEY `idx_refresh_tokens_user` (`user_id`),
  CONSTRAINT `refresh_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `schedules`
--

DROP TABLE IF EXISTS `schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `schedules` (
  `id` varchar(64) NOT NULL,
  `class_room_id` varchar(64) NOT NULL,
  `day` enum('SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU') NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `lecturer_id` varchar(64) DEFAULT NULL,
  `created_at` timestamp(3) NULL DEFAULT current_timestamp(3),
  `updated_at` timestamp(3) NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
  `audit_sk` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `audit_sk` (`audit_sk`),
  KEY `idx_schedules_room_day_time` (`class_room_id`,`day`,`start_time`,`end_time`),
  KEY `idx_schedules_day_start_id` (`day`,`start_time`,`id`),
  KEY `idx_schedules_lecturer_day_time_id` (`lecturer_id`,`day`,`start_time`,`end_time`,`id`),
  KEY `idx_schedules_class_room` (`class_room_id`),
  KEY `idx_schedules_lecturer` (`lecturer_id`),
  KEY `idx_schedules_day` (`day`),
  CONSTRAINT `schedules_ibfk_1` FOREIGN KEY (`class_room_id`) REFERENCES `class_rooms` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT `schedules_ibfk_2` FOREIGN KEY (`lecturer_id`) REFERENCES `lecturers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2750780 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `schema_migrations`
--

DROP TABLE IF EXISTS `schema_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_migrations` (
  `id` varchar(255) NOT NULL,
  `applied_at` timestamp(3) NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `students`
--

DROP TABLE IF EXISTS `students`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `students` (
  `id` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `year_admitted` int(11) NOT NULL,
  `study_program_id` varchar(16) NOT NULL,
  `created_at` timestamp(3) NULL DEFAULT current_timestamp(3),
  `updated_at` timestamp(3) NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
  `audit_sk` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `audit_sk` (`audit_sk`),
  KEY `idx_students_study_program` (`study_program_id`),
  KEY `idx_students_name_id` (`name`,`id`),
  FULLTEXT KEY `idx_students_name` (`name`),
  CONSTRAINT `students_ibfk_1` FOREIGN KEY (`study_program_id`) REFERENCES `study_programs` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1250355 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `study_programs`
--

DROP TABLE IF EXISTS `study_programs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `study_programs` (
  `id` varchar(16) NOT NULL,
  `name` varchar(255) NOT NULL,
  `head` varchar(255) NOT NULL,
  `faculty_id` varchar(16) NOT NULL,
  `created_at` timestamp(3) NULL DEFAULT current_timestamp(3),
  `updated_at` timestamp(3) NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `idx_study_programs_faculty_name_id` (`faculty_id`,`name`,`id`),
  KEY `idx_study_programs_faculty` (`faculty_id`),
  FULLTEXT KEY `idx_study_programs_name` (`name`),
  CONSTRAINT `study_programs_ibfk_1` FOREIGN KEY (`faculty_id`) REFERENCES `faculties` (`id`) ON DELETE NO ACTION ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(64) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('ADMIN','STUDENT','LECTURER') NOT NULL,
  `student_id` varchar(64) DEFAULT NULL,
  `lecturer_id` varchar(64) DEFAULT NULL,
  `created_at` timestamp(3) NULL DEFAULT current_timestamp(3),
  `updated_at` timestamp(3) NULL DEFAULT current_timestamp(3) ON UPDATE current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `student_id` (`student_id`),
  UNIQUE KEY `lecturer_id` (`lecturer_id`),
  KEY `idx_users_student` (`student_id`),
  KEY `idx_users_lecturer` (`lecturer_id`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `users_ibfk_2` FOREIGN KEY (`lecturer_id`) REFERENCES `lecturers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-05 13:49:09
