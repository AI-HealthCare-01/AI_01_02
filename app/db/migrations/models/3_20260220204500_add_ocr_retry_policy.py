from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE `ocr_jobs`
    ADD `retry_count` INT NOT NULL DEFAULT 0,
    ADD `max_retries` INT NOT NULL DEFAULT 3,
    ADD `failure_code` VARCHAR(24) COMMENT 'FILE_NOT_FOUND: FILE_NOT_FOUND\nINVALID_STATE_TRANSITION: INVALID_STATE_TRANSITION\nPROCESSING_ERROR: PROCESSING_ERROR';
CREATE INDEX `idx_ocr_jobs_status_retry_count` ON `ocr_jobs` (`status`, `retry_count`);"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP INDEX `idx_ocr_jobs_status_retry_count` ON `ocr_jobs`;
ALTER TABLE `ocr_jobs`
    DROP COLUMN `failure_code`,
    DROP COLUMN `max_retries`,
    DROP COLUMN `retry_count`;"""


MODELS_STATE = ""
