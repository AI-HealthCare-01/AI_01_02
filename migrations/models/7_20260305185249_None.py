from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS `aerich` (
    `id` INT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `version` VARCHAR(255) NOT NULL,
    `app` VARCHAR(100) NOT NULL,
    `content` JSON NOT NULL
) CHARACTER SET utf8mb4;
CREATE TABLE IF NOT EXISTS `users` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `email` VARCHAR(40) NOT NULL,
    `hashed_password` VARCHAR(128) NOT NULL,
    `name` VARCHAR(20) NOT NULL,
    `gender` VARCHAR(6) NOT NULL COMMENT 'MALE: MALE\nFEMALE: FEMALE',
    `birthday` DATE NOT NULL,
    `phone_number` VARCHAR(11) NOT NULL,
    `is_active` BOOL NOT NULL DEFAULT 1,
    `is_admin` BOOL NOT NULL DEFAULT 0,
    `last_login` DATETIME(6),
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) CHARACTER SET utf8mb4;
CREATE TABLE IF NOT EXISTS `documents` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `document_type` VARCHAR(14) NOT NULL COMMENT 'MEDICAL_RECORD: MEDICAL_RECORD\nPRESCRIPTION: PRESCRIPTION\nMEDICATION_BAG: MEDICATION_BAG',
    `file_name` VARCHAR(255) NOT NULL,
    `temp_storage_key` VARCHAR(500) NOT NULL,
    `file_size` BIGINT NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `uploaded_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
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
CREATE TABLE IF NOT EXISTS `notifications` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `type` VARCHAR(12) NOT NULL COMMENT 'SYSTEM: SYSTEM\nHEALTH_ALERT: HEALTH_ALERT\nREPORT_READY: REPORT_READY\nGUIDE_READY: GUIDE_READY' DEFAULT 'SYSTEM',
    `title` VARCHAR(100) NOT NULL,
    `message` LONGTEXT NOT NULL,
    `is_read` BOOL NOT NULL DEFAULT 0,
    `read_at` DATETIME(6),
    `payload` JSON NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL,
    CONSTRAINT `fk_notifica_users_ca29871f` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    KEY `idx_notificatio_user_id_46dd57` (`user_id`, `is_read`),
    KEY `idx_notificatio_user_id_8d780e` (`user_id`, `created_at`)
) CHARACTER SET utf8mb4;
CREATE TABLE IF NOT EXISTS `health_profiles` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `basic_info` JSON NOT NULL,
    `lifestyle_input` JSON NOT NULL,
    `sleep_input` JSON NOT NULL,
    `nutrition_input` JSON NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL UNIQUE,
    CONSTRAINT `fk_health_p_users_35ba10a2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
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
    `category` VARCHAR(10) NOT NULL COMMENT 'MEDICATION: MEDICATION\nMEAL: MEAL\nSLEEP: SLEEP',
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
) CHARACTER SET utf8mb4;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        """


MODELS_STATE = (
    "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"
    "UJADIdNdZ3c+4TTKTA1gfTI0z+//Z/N2TmYg=="
)
