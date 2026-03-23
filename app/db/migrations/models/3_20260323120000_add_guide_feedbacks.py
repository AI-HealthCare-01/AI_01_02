from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS `guide_feedbacks` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `rating` SMALLINT NOT NULL CHECK (`rating` BETWEEN 1 AND 5),
    `is_helpful` BOOL NOT NULL,
    `comment` TEXT,
    `prompt_version` VARCHAR(20) NOT NULL DEFAULT '',
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `guide_job_id` BIGINT NOT NULL,
    `user_id` BIGINT NOT NULL,
    CONSTRAINT `fk_guide_fb_guide_job` FOREIGN KEY (`guide_job_id`) REFERENCES `guide_jobs` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_guide_fb_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
    UNIQUE KEY `uq_guide_fb_job_user` (`guide_job_id`, `user_id`),
    KEY `idx_guide_fb_version_helpful` (`prompt_version`, `is_helpful`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS `guide_feedbacks`;"""
