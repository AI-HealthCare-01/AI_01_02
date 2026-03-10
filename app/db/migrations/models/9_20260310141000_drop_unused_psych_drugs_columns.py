from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE `psych_drugs`
        DROP COLUMN `dosage`,
        DROP COLUMN `usage`,
        DROP COLUMN `efficacy`,
        DROP COLUMN `contraindications`,
        DROP COLUMN `cautious_patients`;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE `psych_drugs`
        ADD COLUMN `dosage` VARCHAR(255) NULL,
        ADD COLUMN `usage` LONGTEXT NULL,
        ADD COLUMN `efficacy` LONGTEXT NULL,
        ADD COLUMN `contraindications` LONGTEXT NULL,
        ADD COLUMN `cautious_patients` LONGTEXT NULL;"""


MODELS_STATE = ""
