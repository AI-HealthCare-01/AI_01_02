import asyncio
import json
import time
from collections.abc import Awaitable
from logging import Logger
from typing import Any, cast

from redis.asyncio import Redis
from redis.exceptions import RedisError
from redis.exceptions import TimeoutError as RedisTimeoutError

from ai_worker.core import config


def compute_retry_delay_seconds(retry_count: int, *, base: int, maximum: int) -> int:
    attempt = max(retry_count - 1, 0)
    delay = base * (2**attempt)
    return min(delay, maximum)


class QueueConsumer:
    def __init__(
        self,
        logger: Logger,
        *,
        queue_key: str,
        retry_queue_key: str,
        dead_letter_queue_key: str,
        block_timeout_seconds: int,
        retry_backoff_base_seconds: int,
        retry_backoff_max_seconds: int,
    ) -> None:
        self.logger = logger
        self._queue_key = queue_key
        self._retry_queue_key = retry_queue_key
        self._dead_letter_queue_key = dead_letter_queue_key
        self._block_timeout_seconds = block_timeout_seconds
        self._retry_backoff_base_seconds = retry_backoff_base_seconds
        self._retry_backoff_max_seconds = retry_backoff_max_seconds
        self.client = Redis(
            host=config.REDIS_HOST,
            port=config.REDIS_PORT,
            db=config.REDIS_DB,
            password=config.REDIS_PASSWORD,
            decode_responses=True,
            socket_connect_timeout=config.REDIS_SOCKET_TIMEOUT_SECONDS,
            socket_timeout=config.REDIS_SOCKET_TIMEOUT_SECONDS,
        )

    async def close(self) -> None:
        await self.client.aclose()

    async def pop_job_id(self) -> int | None:
        try:
            popped = await cast(
                Awaitable[list[Any] | None],
                self.client.blpop([self._queue_key], timeout=self._block_timeout_seconds),
            )
        except RedisTimeoutError:
            return None
        except RedisError:
            self.logger.warning("redis queue consume failed (%s)", self._queue_key)
            await asyncio.sleep(1)
            return None

        if popped is None:
            return None

        _, raw_job_id = popped
        try:
            return int(raw_job_id)
        except ValueError:
            self.logger.warning("invalid queue payload received: %s", raw_job_id)
            return None

    async def flush_due_retries(self, *, batch_size: int) -> int:
        now = int(time.time())
        moved = 0
        try:
            while moved < batch_size:
                members = await self.client.zrangebyscore(
                    self._retry_queue_key,
                    min="-inf",
                    max=now,
                    start=0,
                    num=batch_size - moved,
                )
                if not members:
                    break

                for member in members:
                    removed = await self.client.zrem(self._retry_queue_key, member)
                    if not removed:
                        continue
                    await cast(Awaitable[int], self.client.rpush(self._queue_key, member))
                    moved += 1
                    if moved >= batch_size:
                        break
        except RedisError:
            self.logger.warning("redis retry queue flush failed (%s)", self._retry_queue_key)
            return moved

        if moved:
            self.logger.info("moved %s retry jobs back to main queue (%s)", moved, self._queue_key)
        return moved

    async def schedule_retry(self, job_id: int, retry_count: int) -> None:
        delay_seconds = compute_retry_delay_seconds(
            retry_count, base=self._retry_backoff_base_seconds, maximum=self._retry_backoff_max_seconds
        )
        retry_at = int(time.time()) + delay_seconds
        try:
            await self.client.zadd(self._retry_queue_key, {str(job_id): retry_at})
            self.logger.warning(
                "job scheduled for retry (queue=%s job_id=%s retry_count=%s delay=%ss)",
                self._queue_key,
                job_id,
                retry_count,
                delay_seconds,
            )
        except RedisError:
            self.logger.warning("redis retry schedule failed (job_id=%s retry_count=%s)", job_id, retry_count)

    async def send_to_dead_letter(self, payload: dict[str, Any]) -> None:
        try:
            await cast(
                Awaitable[int],
                self.client.rpush(self._dead_letter_queue_key, json.dumps(payload, ensure_ascii=False)),
            )
        except RedisError:
            self.logger.warning("redis dead letter enqueue failed (payload=%s)", payload)
