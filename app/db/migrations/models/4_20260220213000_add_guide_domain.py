from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS `guide_jobs` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `status` VARCHAR(10) NOT NULL DEFAULT 'QUEUED' COMMENT 'QUEUED: QUEUED\nPROCESSING: PROCESSING\nSUCCEEDED: SUCCEEDED\nFAILED: FAILED',
    `retry_count` INT NOT NULL DEFAULT 0,
    `max_retries` INT NOT NULL DEFAULT 3,
    `failure_code` VARCHAR(24) COMMENT 'OCR_NOT_READY: OCR_NOT_READY\nOCR_RESULT_NOT_FOUND: OCR_RESULT_NOT_FOUND\nINVALID_STATE_TRANSITION: INVALID_STATE_TRANSITION\nPROCESSING_ERROR: PROCESSING_ERROR',
    `error_message` LONGTEXT,
    `queued_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `started_at` DATETIME(6),
    `completed_at` DATETIME(6),
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL,
    `ocr_job_id` BIGINT NOT NULL,
    CONSTRAINT `fk_guide_jobs_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_guide_jobs_ocr_jobs` FOREIGN KEY (`ocr_job_id`) REFERENCES `ocr_jobs` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4;
CREATE INDEX `idx_guide_jobs_user_id_status` ON `guide_jobs` (`user_id`, `status`);
CREATE INDEX `idx_guide_jobs_ocr_job_id_created_at` ON `guide_jobs` (`ocr_job_id`, `created_at`);
CREATE INDEX `idx_guide_jobs_status_retry_count` ON `guide_jobs` (`status`, `retry_count`);
CREATE TABLE IF NOT EXISTS `guide_results` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `medication_guidance` LONGTEXT NOT NULL,
    `lifestyle_guidance` LONGTEXT NOT NULL,
    `risk_level` VARCHAR(6) NOT NULL DEFAULT 'MEDIUM' COMMENT 'LOW: LOW\nMEDIUM: MEDIUM\nHIGH: HIGH',
    `safety_notice` LONGTEXT NOT NULL,
    `structured_data` JSON NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `job_id` BIGINT NOT NULL UNIQUE,
    CONSTRAINT `fk_guide_results_guide_jobs` FOREIGN KEY (`job_id`) REFERENCES `guide_jobs` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS `guide_results`;
DROP TABLE IF EXISTS `guide_jobs`;"""


MODELS_STATE = ""
