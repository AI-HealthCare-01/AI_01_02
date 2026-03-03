from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS `user_health_profiles` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `height_cm` DOUBLE NOT NULL,
    `weight_kg` DOUBLE NOT NULL,
    `drug_allergies` JSON NOT NULL,
    `exercise_frequency_per_week` INT NOT NULL,
    `pc_hours_per_day` INT NOT NULL,
    `smartphone_hours_per_day` INT NOT NULL,
    `caffeine_cups_per_day` INT NOT NULL,
    `smoking` INT NOT NULL,
    `alcohol_frequency_per_week` INT NOT NULL,
    `bed_time` VARCHAR(5) NOT NULL,
    `wake_time` VARCHAR(5) NOT NULL,
    `sleep_latency_minutes` INT NOT NULL,
    `night_awakenings_per_week` INT NOT NULL,
    `daytime_sleepiness` INT NOT NULL,
    `appetite_level` INT NOT NULL,
    `meal_regular` BOOL NOT NULL,
    `bmi` DOUBLE NOT NULL,
    `sleep_time_hours` DOUBLE NOT NULL,
    `caffeine_mg` INT NOT NULL,
    `digital_time_hours` INT NOT NULL,
    `weekly_refresh_weekday` INT,
    `weekly_refresh_time` VARCHAR(5),
    `weekly_adherence_rate` DOUBLE,
    `onboarding_completed_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL UNIQUE,
    CONSTRAINT `fk_user_health_profiles_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4;
CREATE INDEX `idx_user_health_profiles_user_id_updated_at` ON `user_health_profiles` (`user_id`, `updated_at`);"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS `user_health_profiles`;"""


MODELS_STATE = ""
