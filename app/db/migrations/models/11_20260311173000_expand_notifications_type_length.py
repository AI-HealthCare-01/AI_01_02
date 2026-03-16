from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE `notifications`
        MODIFY COLUMN `type` VARCHAR(32) NOT NULL DEFAULT 'SYSTEM'
        COMMENT 'SYSTEM: SYSTEM\\nHEALTH_ALERT: HEALTH_ALERT\\nREPORT_READY: REPORT_READY\\nGUIDE_READY: GUIDE_READY\\nMEDICATION_DDAY: MEDICATION_DDAY';
    """


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE `notifications`
        MODIFY COLUMN `type` VARCHAR(12) NOT NULL DEFAULT 'SYSTEM'
        COMMENT 'SYSTEM: SYSTEM\\nHEALTH_ALERT: HEALTH_ALERT\\nREPORT_READY: REPORT_READY';
    """
