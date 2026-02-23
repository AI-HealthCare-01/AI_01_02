from collections.abc import Awaitable
from typing import cast

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core import config


class OcrQueuePublisher:
    def _create_client(self) -> Redis:
        return Redis(
            host=config.REDIS_HOST,
            port=config.REDIS_PORT,
            db=config.REDIS_DB,
            password=config.REDIS_PASSWORD,
            decode_responses=True,
            socket_connect_timeout=config.REDIS_SOCKET_TIMEOUT_SECONDS,
            socket_timeout=config.REDIS_SOCKET_TIMEOUT_SECONDS,
        )

    async def enqueue_job(self, job_id: int) -> None:
        client = self._create_client()
        try:
            await cast(Awaitable[int], client.rpush(config.OCR_QUEUE_KEY, str(job_id)))
        except RedisError as err:
            raise RuntimeError("Failed to enqueue OCR job.") from err
        finally:
            await client.aclose()
