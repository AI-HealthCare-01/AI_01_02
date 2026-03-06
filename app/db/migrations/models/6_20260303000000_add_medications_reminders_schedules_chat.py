from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS `medications` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `drug_code` VARCHAR(100) NOT NULL UNIQUE,
    `name_ko` VARCHAR(255) NOT NULL,
    `ingredient` VARCHAR(255),
    `aliases` JSON NOT NULL,
    `is_adhd_target` BOOL NOT NULL DEFAULT 1,
    `is_active` BOOL NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) CHARACTER SET utf8mb4;
CREATE INDEX `idx_medications_name_ko` ON `medications` (`name_ko`);
CREATE INDEX `idx_medications_is_active` ON `medications` (`is_active`);
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
    `user_id` BIGINT NOT NULL,
    `medication_id` BIGINT,
    CONSTRAINT `fk_medication_reminders_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_medication_reminders_medications` FOREIGN KEY (`medication_id`) REFERENCES `medications` (`id`) ON DELETE SET NULL
) CHARACTER SET utf8mb4;
CREATE INDEX `idx_reminders_user_enabled` ON `medication_reminders` (`user_id`, `enabled`);
CREATE INDEX `idx_reminders_user_medication_name` ON `medication_reminders` (`user_id`, `medication_name`);
CREATE INDEX `idx_reminders_user_medication_id` ON `medication_reminders` (`user_id`, `medication_id`);
CREATE TABLE IF NOT EXISTS `schedule_items` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `category` VARCHAR(10) NOT NULL COMMENT 'MEDICATION: MEDICATION\nMEAL: MEAL\nSLEEP: SLEEP',
    `title` VARCHAR(255) NOT NULL,
    `scheduled_at` DATETIME(6) NOT NULL,
    `status` VARCHAR(7) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING: PENDING\nDONE: DONE\nSKIPPED: SKIPPED',
    `completed_at` DATETIME(6),
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL,
    `reminder_id` BIGINT,
    CONSTRAINT `fk_schedule_items_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_schedule_items_reminders` FOREIGN KEY (`reminder_id`) REFERENCES `medication_reminders` (`id`) ON DELETE SET NULL
) CHARACTER SET utf8mb4;
CREATE INDEX `idx_schedule_items_user_scheduled_at` ON `schedule_items` (`user_id`, `scheduled_at`);
CREATE INDEX `idx_schedule_items_user_status` ON `schedule_items` (`user_id`, `status`);
CREATE INDEX `idx_schedule_items_reminder_id` ON `schedule_items` (`reminder_id`);
CREATE TABLE IF NOT EXISTS `chat_sessions` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `title` VARCHAR(255),
    `status` VARCHAR(6) NOT NULL DEFAULT 'ACTIVE' COMMENT 'ACTIVE: ACTIVE\nCLOSED: CLOSED',
    `auto_close_after_minutes` SMALLINT NOT NULL DEFAULT 20,
    `last_activity_at` DATETIME(6),
    `deleted_at` DATETIME(6),
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL,
    CONSTRAINT `fk_chat_sessions_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4;
CREATE INDEX `idx_chat_sessions_user_status` ON `chat_sessions` (`user_id`, `status`);
CREATE INDEX `idx_chat_sessions_user_deleted_at` ON `chat_sessions` (`user_id`, `deleted_at`);
CREATE TABLE IF NOT EXISTS `chat_messages` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `role` VARCHAR(9) NOT NULL COMMENT 'USER: USER\nASSISTANT: ASSISTANT\nSYSTEM: SYSTEM',
    `status` VARCHAR(9) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING: PENDING\nSTREAMING: STREAMING\nCOMPLETED: COMPLETED\nFAILED: FAILED\nCANCELLED: CANCELLED',
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
    CONSTRAINT `fk_chat_messages_sessions` FOREIGN KEY (`session_id`) REFERENCES `chat_sessions` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4;
CREATE INDEX `idx_chat_messages_session_created_at` ON `chat_messages` (`session_id`, `created_at`);
CREATE INDEX `idx_chat_messages_session_updated_at` ON `chat_messages` (`session_id`, `updated_at`);
CREATE INDEX `idx_chat_messages_session_status` ON `chat_messages` (`session_id`, `status`);
CREATE INDEX `idx_chat_messages_session_guardrail` ON `chat_messages` (`session_id`, `guardrail_blocked`);"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS `chat_messages`;
DROP TABLE IF EXISTS `chat_sessions`;
DROP TABLE IF EXISTS `schedule_items`;
DROP TABLE IF EXISTS `medication_reminders`;
DROP TABLE IF EXISTS `medications`;"""


MODELS_STATE = ""
