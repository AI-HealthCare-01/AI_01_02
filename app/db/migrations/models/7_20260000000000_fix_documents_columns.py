from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE `documents` ADD COLUMN `temp_storage_key` VARCHAR(500) NOT NULL DEFAULT '';
        ALTER TABLE `documents` ADD COLUMN `disposed_at` DATETIME(6) NULL;
        ALTER TABLE `documents` ALTER COLUMN `file_path` SET DEFAULT '';
        UPDATE `documents` SET `temp_storage_key` = `file_path` WHERE `temp_storage_key` = '';
        ALTER TABLE `ocr_jobs`
            ADD COLUMN `raw_text` LONGTEXT NULL,
            ADD COLUMN `text_blocks_json` JSON NULL,
            ADD COLUMN `structured_result` JSON NULL,
            ADD COLUMN `confirmed_result` JSON NULL,
            ADD COLUMN `needs_user_review` TINYINT(1) NOT NULL DEFAULT 0;
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE `documents`
            DROP COLUMN IF EXISTS `temp_storage_key`,
            DROP COLUMN IF EXISTS `disposed_at`;
    """


MODELS_STATE = ""
