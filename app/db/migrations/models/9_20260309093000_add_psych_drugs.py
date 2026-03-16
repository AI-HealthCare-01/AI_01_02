from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS `psych_drugs` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `ingredient_name` VARCHAR(255),
    `product_name` VARCHAR(255),
    `dosage` VARCHAR(255),
    `usage` LONGTEXT,
    `efficacy` LONGTEXT,
    `side_effects` LONGTEXT,
    `precautions` LONGTEXT,
    `contraindications` LONGTEXT,
    `cautious_patients` LONGTEXT,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) CHARACTER SET utf8mb4;
CREATE INDEX `idx_psych_drugs_product_name` ON `psych_drugs` (`product_name`);
CREATE INDEX `idx_psych_drugs_ingredient_name` ON `psych_drugs` (`ingredient_name`);"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS `psych_drugs`;"""


MODELS_STATE = ""
