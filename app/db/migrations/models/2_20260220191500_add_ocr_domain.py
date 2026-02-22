from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS `documents` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `document_type` VARCHAR(14) NOT NULL COMMENT 'MEDICAL_RECORD: MEDICAL_RECORD\nPRESCRIPTION: PRESCRIPTION\nMEDICATION_BAG: MEDICATION_BAG',
    `file_name` VARCHAR(255) NOT NULL,
    `file_path` VARCHAR(500) NOT NULL,
    `file_size` BIGINT NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `uploaded_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL,
    CONSTRAINT `fk_documents_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4;
CREATE INDEX `idx_documents_user_id_uploaded_at` ON `documents` (`user_id`, `uploaded_at`);
CREATE INDEX `idx_documents_document_type` ON `documents` (`document_type`);
CREATE TABLE IF NOT EXISTS `ocr_jobs` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `status` VARCHAR(10) NOT NULL DEFAULT 'QUEUED' COMMENT 'QUEUED: QUEUED\nPROCESSING: PROCESSING\nSUCCEEDED: SUCCEEDED\nFAILED: FAILED',
    `error_message` LONGTEXT,
    `queued_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `started_at` DATETIME(6),
    `completed_at` DATETIME(6),
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL,
    `document_id` BIGINT NOT NULL,
    CONSTRAINT `fk_ocr_jobs_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ocr_jobs_documents` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4;
CREATE INDEX `idx_ocr_jobs_user_id_status` ON `ocr_jobs` (`user_id`, `status`);
CREATE INDEX `idx_ocr_jobs_document_id_created_at` ON `ocr_jobs` (`document_id`, `created_at`);
CREATE TABLE IF NOT EXISTS `ocr_results` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `extracted_text` LONGTEXT NOT NULL,
    `structured_data` JSON NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `job_id` BIGINT NOT NULL UNIQUE,
    CONSTRAINT `fk_ocr_results_ocr_jobs` FOREIGN KEY (`job_id`) REFERENCES `ocr_jobs` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS `ocr_results`;
DROP TABLE IF EXISTS `ocr_jobs`;
DROP TABLE IF EXISTS `documents`;"""


MODELS_STATE = ""
