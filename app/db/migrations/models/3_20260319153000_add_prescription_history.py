from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS `prescription_histories` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `source_ocr_job_id` BIGINT NOT NULL UNIQUE,
    `prescribed_date` DATE NOT NULL,
    `days_supply` INT NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL,
    CONSTRAINT `fk_prescrip_users_1f7796a1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    KEY `idx_prescrip_user_id_2ec0f5` (`user_id`, `start_date`, `end_date`),
    KEY `idx_prescrip_user_id_b6638c` (`user_id`, `prescribed_date`)
) CHARACTER SET utf8mb4;
        CREATE TABLE IF NOT EXISTS `prescription_medications` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `medication_name` VARCHAR(255) NOT NULL,
    `dose` DOUBLE,
    `frequency_per_day` INT,
    `dosage_per_once` INT,
    `schedule_times` JSON NOT NULL,
    `administration_timing` VARCHAR(100),
    `dispensed_date` DATE,
    `total_days` INT,
    `start_date` DATE,
    `end_date` DATE,
    `raw_payload` JSON NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `prescription_id` BIGINT NOT NULL,
    CONSTRAINT `fk_prescrip_prescrip_20f7b8f8` FOREIGN KEY (`prescription_id`) REFERENCES `prescription_histories` (`id`) ON DELETE CASCADE,
    KEY `idx_prescrip_prescri_664f2b` (`prescription_id`, `medication_name`),
    KEY `idx_prescrip_start_d_3cfab3` (`start_date`, `end_date`)
) CHARACTER SET utf8mb4;
        ALTER TABLE `schedule_items` ADD COLUMN `medication_name` VARCHAR(255);
        ALTER TABLE `schedule_items` ADD KEY `idx_schedule_it_user_id_fa0d97` (`user_id`, `medication_name`);"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        ALTER TABLE `schedule_items` DROP INDEX `idx_schedule_it_user_id_fa0d97`;
        ALTER TABLE `schedule_items` DROP COLUMN `medication_name`;
        DROP TABLE IF EXISTS `prescription_medications`;
        DROP TABLE IF EXISTS `prescription_histories`;"""
