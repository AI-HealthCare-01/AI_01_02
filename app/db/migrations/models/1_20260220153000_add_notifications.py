from tortoise import BaseDBAsyncClient

RUN_IN_TRANSACTION = True


async def upgrade(db: BaseDBAsyncClient) -> str:
    return """
        CREATE TABLE IF NOT EXISTS `notifications` (
    `id` BIGINT NOT NULL PRIMARY KEY AUTO_INCREMENT,
    `type` VARCHAR(12) NOT NULL DEFAULT 'SYSTEM' COMMENT 'SYSTEM: SYSTEM\nHEALTH_ALERT: HEALTH_ALERT\nREPORT_READY: REPORT_READY',
    `title` VARCHAR(100) NOT NULL,
    `message` LONGTEXT NOT NULL,
    `is_read` BOOL NOT NULL DEFAULT 0,
    `read_at` DATETIME(6),
    `payload` JSON NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `user_id` BIGINT NOT NULL,
    CONSTRAINT `fk_notifications_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) CHARACTER SET utf8mb4;
CREATE INDEX `idx_notifications_user_id_is_read` ON `notifications` (`user_id`, `is_read`);
CREATE INDEX `idx_notifications_user_id_created_at` ON `notifications` (`user_id`, `created_at`);"""


async def downgrade(db: BaseDBAsyncClient) -> str:
    return """
        DROP TABLE IF EXISTS `notifications`;"""


MODELS_STATE = (
    "eJztmm1P4zgQgP9KlE+ctIdoKNBFp5PSEpbe9mVVwt3uAorcxG0tEqcbOwvVqv/97Lw0if"
    "NCioC2q36hzXgmsZ+MZzxDf8mOa0GbHKrQQ+ZMPpd+yRg4kH0RRj5IMpjPEzkXUDC2A1WQ"
    "6IwJ9YBJmXQCbAKZyILE9NCcIhczKfZtmwtdkykiPE1EPkY/fGhQdwrpDHps4PaeiRG24B"
    "Mk8eX8wZggaFuZqSKLPzuQG3QxD2RdTC8DRf60sWG6tu/gRHm+oDMXr7QRplw6hRh6gEJ+"
    "e+r5fPp8dtE64xWFM01UwimmbCw4Ab5NU8utycB0MefHZkOCBU75U/5UGs2zZuv4tNliKs"
    "FMVpKzZbi8ZO2hYUBgoMvLYBxQEGoEGBNuP6FH+JRy8Doz4BXTS5kICNnERYQxsCqGsSCB"
    "mDjOK1F0wJNhQzyl3MGVk5MKZv+qo86VOjpgWn/w1bjMmUMfH0RDSjjGwSYg+dZYA2Kkvp"
    "sAG0dHNQAyrVKAwVgWIHsiheEezEL853o4KIaYMhFA3mC2wFsLmfSDZCNC77cTawVFvmo+"
    "aYeQH3Ya3kFf/Spy7fSG7YCCS+jUC+4S3KDNGPOQOXlIbX4uGAPz4RF4lpEbcRW3TDc/5C"
    "iOKAEYTANWfMV8fVESGbgUTZAJIkS5JJMZr0w1OKVJ3jzj3Mo+gZ4RpgxEDA8CS2Y6GbnJ"
    "pMyvDEDl+7VSVBtNf6Ms9VFRjo/PlKPj09ZJ8+zspHW0Slf5oaq81e5+4qkr4+TP57KAUW"
    "EM1rDvBJC7bNoAmzAHO7Z9v4AsX3+71rW+nKMeDZxL4ecdvtLUnn5lqD1tpJ9L6as7PNK+"
    "DEe6MdLUi2/nUvpKfklgV+rEdaU8rCtiVKeI2iUvpdjrVwb71JiESEgIi6p5jDp8KgkeKZ"
    "NdAVnBTde+6tXJ0FlEI73h4FOsLmbILNU4mOeDsuvaEOCSqJxYCWDHzOytyK6b1+qjbQ+H"
    "vQzadldkd9Nva8xnA85MCdFMPE6Aci48BeaAXjAaFDmwmGjKTCBqRXaH8ZcaeKPMtiV+2+"
    "1r17ra/5IhfKHqGh9RMo4bSw9OhdCwuon0X1e/kvil9H040MQD30pP/y7zOQGfugZ2Hw1g"
    "pZcdi2NR5hXOwcJ2i/ZE+SE8ZbKpQ7j818THJn9v0thHNkWYHPLH/p1Prlt1NM+UP8kRcs"
    "39k7V8hS20iSTKg8AQ24toB+/InoqCTeWWSpUJ9c/+KaPnC4AteYXvVgPkKtos7DzpS9eD"
    "aIo/w0WuCBDoRsXoTXSb7aO8jD0lliZe6IHHVdWZdiC2PLYoGGbtjnrdUS80ebmZLkAAtq"
    "D6j4GXV/18QW9f7e+L900V79AByF6nUFwZ7Ep9ky0Um3XqxGZ5mdjMVYkzQGbsGDAHhDy6"
    "XoG/lrMsMN1Nqg2lVauD0apoYbREsMHnGjRj/d1EqNRxTKXcMZWcY7IVW0VpuV5nLrHeME"
    "+5r/a0c4n/vcOXWngVfr6k13ZaA7N4bE0on4qQx8ijMwssiquHYkdN21TVDdvpthX8+Llf"
    "4DNnq4MG87ZxmSuWlLeC3W5u6kajTlhslEfFhuhviBjsEIZ+FkTG5/pnid07dtBWh6Ytbq"
    "BxNpaDCv4b/yzS2Gzfk8witQGhhu1Oi6BWt1WylvvO5IY7k/v+2O/aH5tbL3yxWcv9i93o"
    "iw0mv8ZvTVLllfh7DiH1ReaXn0fQXv08pLhvJ/6IZPved1n/bvn6Xbfl/zb/WsU="
)
