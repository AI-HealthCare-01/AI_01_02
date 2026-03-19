from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS `user_health_profiles` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `height_cm` DOUBLE NOT NULL,
    `weight_kg` DOUBLE NOT NULL,
    `drug_allergies` JSON NOT NULL,
    `exercise_frequency_per_week` INT NOT NULL,
    `pc_hours_per_day` INT NOT NULL,
    `smartphone_hours_per_day` INT NOT NULL,
    `caffeine_cups_per_day` INT NOT NULL,
    `smoking` INT NOT NULL,
    `alcohol_frequency_per_week` INT NOT NULL,
    `bed_time` VARCHAR(5) NOT NULL,
    `wake_time` VARCHAR(5) NOT NULL,
    `sleep_latency_minutes` INT NOT NULL,
    `night_awakenings_per_week` INT NOT NULL,
    `daytime_sleepiness` INT NOT NULL,
    `appetite_level` INT NOT NULL,
    `meal_regular` BOOL NOT NULL,
    `bmi` DOUBLE NOT NULL,
    `sleep_time_hours` DOUBLE NOT NULL,
    `caffeine_mg` INT NOT NULL,
    `digital_time_hours` INT NOT NULL,
    `weekly_refresh_weekday` INT,
    `weekly_refresh_time` VARCHAR(5),
    `weekly_adherence_rate` DOUBLE,
    `onboarding_completed_at` DATETIME(6),
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL UNIQUE,
    CONSTRAINT `fk_user_hea_users_1d1f8bd7` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    KEY `idx_user_health_user_id_145903` (`user_id`, `updated_at`)
) CHARACTER SET utf8mb4;
CREATE TABLE IF NOT EXISTS `documents` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `document_type` VARCHAR(14) NOT NULL COMMENT 'MEDICAL_RECORD: MEDICAL_RECORD\nPRESCRIPTION: PRESCRIPTION\nMEDICATION_BAG: MEDICATION_BAG',
    `file_name` VARCHAR(255) NOT NULL,
    `temp_storage_key` VARCHAR(500) NOT NULL,
    `file_size` BIGINT NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `uploaded_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `disposed_at` DATETIME(6),
    `user_id` BIGINT NOT NULL,
    CONSTRAINT `fk_document_users_a34eb111` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    KEY `idx_documents_user_id_9f90dd` (`user_id`, `uploaded_at`),
    KEY `idx_documents_documen_9db149` (`document_type`)
) CHARACTER SET utf8mb4;
        CREATE TABLE IF NOT EXISTS `ocr_jobs` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `status` VARCHAR(10) NOT NULL COMMENT 'QUEUED: QUEUED\nPROCESSING: PROCESSING\nSUCCEEDED: SUCCEEDED\nFAILED: FAILED' DEFAULT 'QUEUED',
    `retry_count` INT NOT NULL DEFAULT 0,
    `max_retries` INT NOT NULL DEFAULT 3,
    `failure_code` VARCHAR(24) COMMENT 'FILE_NOT_FOUND: FILE_NOT_FOUND\nINVALID_STATE_TRANSITION: INVALID_STATE_TRANSITION\nPROCESSING_ERROR: PROCESSING_ERROR',
    `error_message` LONGTEXT,
    `raw_text` LONGTEXT,
    `text_blocks_json` JSON,
    `structured_result` JSON,
    `confirmed_result` JSON,
    `needs_user_review` BOOL NOT NULL DEFAULT 0,
    `queued_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `started_at` DATETIME(6),
    `completed_at` DATETIME(6),
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `document_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    CONSTRAINT `fk_ocr_jobs_document_3e5e0a3f` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ocr_jobs_users_1ad1c7c0` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    KEY `idx_ocr_jobs_user_id_bb82c1` (`user_id`, `status`),
    KEY `idx_ocr_jobs_documen_09028c` (`document_id`, `created_at`),
    KEY `idx_ocr_jobs_status_d0c927` (`status`, `retry_count`)
) CHARACTER SET utf8mb4;
        CREATE TABLE IF NOT EXISTS `guide_jobs` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `status` VARCHAR(10) NOT NULL COMMENT 'QUEUED: QUEUED\nPROCESSING: PROCESSING\nSUCCEEDED: SUCCEEDED\nFAILED: FAILED' DEFAULT 'QUEUED',
    `retry_count` INT NOT NULL DEFAULT 0,
    `max_retries` INT NOT NULL DEFAULT 3,
    `failure_code` VARCHAR(24) COMMENT 'OCR_NOT_READY: OCR_NOT_READY\nOCR_RESULT_NOT_FOUND: OCR_RESULT_NOT_FOUND\nINVALID_STATE_TRANSITION: INVALID_STATE_TRANSITION\nPROCESSING_ERROR: PROCESSING_ERROR',
    `error_message` LONGTEXT,
    `queued_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `started_at` DATETIME(6),
    `completed_at` DATETIME(6),
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `ocr_job_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    CONSTRAINT `fk_guide_jo_ocr_jobs_779ac82c` FOREIGN KEY (`ocr_job_id`) REFERENCES `ocr_jobs` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_guide_jo_users_76b11744` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    KEY `idx_guide_jobs_user_id_087b6a` (`user_id`, `status`),
    KEY `idx_guide_jobs_ocr_job_6f8ec5` (`ocr_job_id`, `created_at`),
    KEY `idx_guide_jobs_status_428bbc` (`status`, `retry_count`)
) CHARACTER SET utf8mb4;
        CREATE TABLE IF NOT EXISTS `guide_results` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `medication_guidance` LONGTEXT NOT NULL,
    `lifestyle_guidance` LONGTEXT NOT NULL,
    `risk_level` VARCHAR(6) NOT NULL COMMENT 'LOW: LOW\nMEDIUM: MEDIUM\nHIGH: HIGH' DEFAULT 'MEDIUM',
    `safety_notice` LONGTEXT NOT NULL,
    `structured_data` JSON NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `job_id` BIGINT NOT NULL UNIQUE,
    CONSTRAINT `fk_guide_re_guide_jo_d9919dfe` FOREIGN KEY (`job_id`) REFERENCES `guide_jobs` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4;
        CREATE TABLE IF NOT EXISTS `user_notification_settings` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `home_schedule_enabled` BOOL NOT NULL DEFAULT 1,
    `meal_alarm_enabled` BOOL NOT NULL DEFAULT 1,
    `medication_alarm_enabled` BOOL NOT NULL DEFAULT 1,
    `exercise_alarm_enabled` BOOL NOT NULL DEFAULT 1,
    `sleep_alarm_enabled` BOOL NOT NULL DEFAULT 1,
    `medication_dday_alarm_enabled` BOOL NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL UNIQUE,
    CONSTRAINT `fk_user_not_users_327e7c2c` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    KEY `idx_user_notifi_user_id_59ed33` (`user_id`)
) CHARACTER SET utf8mb4;
        CREATE TABLE IF NOT EXISTS `medications` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `drug_code` VARCHAR(100) NOT NULL UNIQUE,
    `name_ko` VARCHAR(255) NOT NULL,
    `ingredient` VARCHAR(255),
    `aliases` JSON NOT NULL,
    `is_adhd_target` BOOL NOT NULL DEFAULT 1,
    `is_active` BOOL NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    KEY `idx_medications_name_ko_509872` (`name_ko`),
    KEY `idx_medications_is_acti_890dc6` (`is_active`)
) CHARACTER SET utf8mb4;
        CREATE TABLE IF NOT EXISTS `psych_drugs` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `ingredient_name` VARCHAR(255),
    `product_name` VARCHAR(255),
    `side_effects` LONGTEXT,
    `precautions` LONGTEXT,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    KEY `idx_psych_drugs_product_c9358b` (`product_name`),
    KEY `idx_psych_drugs_ingredi_3e0aee` (`ingredient_name`)
) CHARACTER SET utf8mb4;
        CREATE TABLE IF NOT EXISTS `medication_reminders` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `medication_name` VARCHAR(255) NOT NULL,
    `dose_text` VARCHAR(100),
    `schedule_times` JSON NOT NULL,
    `start_date` DATE,
    `end_date` DATE,
    `dispensed_date` DATE,
    `total_days` INT,
    `daily_intake_count` DECIMAL(6,2),
    `enabled` BOOL NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `medication_id` BIGINT,
    `user_id` BIGINT NOT NULL,
    CONSTRAINT `fk_medicati_medicati_f35abf09` FOREIGN KEY (`medication_id`) REFERENCES `medications` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_medicati_users_d1a04053` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    KEY `idx_medication__user_id_3bfdf0` (`user_id`, `enabled`),
    KEY `idx_medication__user_id_aea19a` (`user_id`, `medication_name`),
    KEY `idx_medication__user_id_0f3e76` (`user_id`, `medication_id`)
) CHARACTER SET utf8mb4;
        CREATE TABLE IF NOT EXISTS `schedule_items` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `category` VARCHAR(10) NOT NULL COMMENT 'MEDICATION: MEDICATION\nMEAL: MEAL\nEXERCISE: EXERCISE\nSLEEP: SLEEP',
    `title` VARCHAR(255) NOT NULL,
    `scheduled_at` DATETIME(6) NOT NULL,
    `status` VARCHAR(7) NOT NULL COMMENT 'PENDING: PENDING\nDONE: DONE\nSKIPPED: SKIPPED' DEFAULT 'PENDING',
    `completed_at` DATETIME(6),
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `reminder_id` BIGINT,
    `user_id` BIGINT NOT NULL,
    CONSTRAINT `fk_schedule_medicati_1fcc7557` FOREIGN KEY (`reminder_id`) REFERENCES `medication_reminders` (`id`) ON DELETE SET NULL,
    CONSTRAINT `fk_schedule_users_10b62b42` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    KEY `idx_schedule_it_user_id_b7a718` (`user_id`, `scheduled_at`),
    KEY `idx_schedule_it_user_id_ecdc80` (`user_id`, `status`),
    KEY `idx_schedule_it_reminde_e70810` (`reminder_id`)
) CHARACTER SET utf8mb4;
        CREATE TABLE IF NOT EXISTS `chat_sessions` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `title` VARCHAR(255),
    `status` VARCHAR(6) NOT NULL COMMENT 'ACTIVE: ACTIVE\nCLOSED: CLOSED' DEFAULT 'ACTIVE',
    `auto_close_after_minutes` SMALLINT NOT NULL DEFAULT 20,
    `last_activity_at` DATETIME(6),
    `deleted_at` DATETIME(6),
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL,
    CONSTRAINT `fk_chat_ses_users_520002c0` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    KEY `idx_chat_sessio_user_id_7189b8` (`user_id`, `status`),
    KEY `idx_chat_sessio_user_id_70980a` (`user_id`, `deleted_at`)
) CHARACTER SET utf8mb4;
        CREATE TABLE IF NOT EXISTS `chat_messages` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `role` VARCHAR(9) NOT NULL COMMENT 'USER: USER\nASSISTANT: ASSISTANT\nSYSTEM: SYSTEM',
    `status` VARCHAR(9) NOT NULL COMMENT 'PENDING: PENDING\nSTREAMING: STREAMING\nCOMPLETED: COMPLETED\nFAILED: FAILED\nCANCELLED: CANCELLED' DEFAULT 'PENDING',
    `content` LONGTEXT NOT NULL,
    `needs_clarification` BOOL NOT NULL DEFAULT 0,
    `intent_label` VARCHAR(20),
    `references_json` JSON NOT NULL,
    `retrieved_doc_ids` JSON NOT NULL,
    `guardrail_blocked` BOOL NOT NULL DEFAULT 0,
    `guardrail_reason` VARCHAR(200),
    `last_token_seq` INT NOT NULL DEFAULT 0,
    `prompt_version` VARCHAR(50),
    `model_version` VARCHAR(50),
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `session_id` BIGINT NOT NULL,
    CONSTRAINT `fk_chat_mes_chat_ses_0d4a2737` FOREIGN KEY (`session_id`) REFERENCES `chat_sessions` (`id`) ON DELETE CASCADE,
    KEY `idx_chat_messag_session_fb3c4b` (`session_id`, `created_at`),
    KEY `idx_chat_messag_session_2b6014` (`session_id`, `updated_at`),
    KEY `idx_chat_messag_session_298cb4` (`session_id`, `status`),
    KEY `idx_chat_messag_session_0d3acd` (`session_id`, `guardrail_blocked`)
) CHARACTER SET utf8mb4;
        CREATE TABLE IF NOT EXISTS `daily_diaries` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `date` DATE NOT NULL,
    `content` LONGTEXT NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL,
    UNIQUE KEY `uid_daily_diari_user_id_74bcb9` (`user_id`, `date`),
    CONSTRAINT `fk_daily_di_users_1a8416ba` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4;
        ALTER TABLE `notifications` MODIFY COLUMN `type` VARCHAR(15) NOT NULL COMMENT 'SYSTEM: SYSTEM\nHEALTH_ALERT: HEALTH_ALERT\nREPORT_READY: REPORT_READY\nGUIDE_READY: GUIDE_READY\nMEDICATION_DDAY: MEDICATION_DDAY' DEFAULT 'SYSTEM';
        ALTER TABLE `notifications` MODIFY COLUMN `type` VARCHAR(15) NOT NULL COMMENT 'SYSTEM: SYSTEM\nHEALTH_ALERT: HEALTH_ALERT\nREPORT_READY: REPORT_READY\nGUIDE_READY: GUIDE_READY\nMEDICATION_DDAY: MEDICATION_DDAY' DEFAULT 'SYSTEM';"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE `notifications` MODIFY COLUMN `type` VARCHAR(12) NOT NULL COMMENT 'SYSTEM: SYSTEM\nHEALTH_ALERT: HEALTH_ALERT\nREPORT_READY: REPORT_READY' DEFAULT 'SYSTEM';
        ALTER TABLE `notifications` MODIFY COLUMN `type` VARCHAR(12) NOT NULL COMMENT 'SYSTEM: SYSTEM\nHEALTH_ALERT: HEALTH_ALERT\nREPORT_READY: REPORT_READY' DEFAULT 'SYSTEM';
        DROP TABLE IF EXISTS `schedule_items`;
        DROP TABLE IF EXISTS `user_health_profiles`;
        DROP TABLE IF EXISTS `user_notification_settings`;
        DROP TABLE IF EXISTS `daily_diaries`;
        DROP TABLE IF EXISTS `guide_jobs`;
        DROP TABLE IF EXISTS `documents`;
        DROP TABLE IF EXISTS `medications`;
        DROP TABLE IF EXISTS `guide_results`;
        DROP TABLE IF EXISTS `medication_reminders`;
        DROP TABLE IF EXISTS `chat_messages`;
        DROP TABLE IF EXISTS `psych_drugs`;
        DROP TABLE IF EXISTS `chat_sessions`;
        DROP TABLE IF EXISTS `ocr_jobs`;"""


MODELS_STATE = (
    "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"
)
