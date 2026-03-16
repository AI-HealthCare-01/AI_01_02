from tortoise import BaseDBAsyncClient


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS `user_notification_settings` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `home_schedule_enabled` BOOL NOT NULL DEFAULT 1,
    `meal_alarm_enabled` BOOL NOT NULL DEFAULT 1,
    `medication_alarm_enabled` BOOL NOT NULL DEFAULT 1,
    `exercise_alarm_enabled` BOOL NOT NULL DEFAULT 1,
    `sleep_alarm_enabled` BOOL NOT NULL DEFAULT 1,
    `medication_dday_alarm_enabled` BOOL NOT NULL DEFAULT 1,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL UNIQUE,
    CONSTRAINT `fk_user_notification_settings_users`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
CREATE INDEX `idx_user_notification_settings_user_id` ON `user_notification_settings` (`user_id`);"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS `user_notification_settings`;"""
