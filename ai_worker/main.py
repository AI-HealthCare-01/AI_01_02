import asyncio
import signal
import time
from contextlib import suppress

from ai_worker.core import config, default_logger
from ai_worker.db import close_database, initialize_database
from ai_worker.tasks import GuideQueueConsumer, OcrQueueConsumer, process_guide_job, process_ocr_job, run_heartbeat


class Worker:
    def __init__(self, interval_seconds: int = config.HEARTBEAT_INTERVAL_SECONDS) -> None:
        self.interval_seconds = interval_seconds
        self._stop_event = asyncio.Event()

    def request_shutdown(self) -> None:
        if self._stop_event.is_set():
            return
        default_logger.info("shutdown signal received")
        self._stop_event.set()

    async def run(self) -> None:
        default_logger.info("ai worker started (timezone=%s)", config.TIMEZONE)
        await initialize_database()
        ocr_queue_consumer = OcrQueueConsumer(default_logger)
        guide_queue_consumer = GuideQueueConsumer(default_logger)
        next_heartbeat_at = time.monotonic()
        try:
            while not self._stop_event.is_set():
                now = time.monotonic()
                if now >= next_heartbeat_at:
                    await run_heartbeat(default_logger)
                    next_heartbeat_at = now + self.interval_seconds

                await ocr_queue_consumer.flush_due_retries(batch_size=config.OCR_RETRY_RELEASE_BATCH_SIZE)
                await guide_queue_consumer.flush_due_retries(batch_size=config.GUIDE_RETRY_RELEASE_BATCH_SIZE)
                ocr_job_id = await ocr_queue_consumer.pop_job_id()
                if ocr_job_id is not None:
                    await process_ocr_job(
                        job_id=ocr_job_id,
                        logger=default_logger,
                        schedule_retry=ocr_queue_consumer.schedule_retry,
                        send_to_dead_letter=ocr_queue_consumer.send_to_dead_letter,
                    )
                    continue

                guide_job_id = await guide_queue_consumer.pop_job_id()
                if guide_job_id is None:
                    continue
                await process_guide_job(
                    job_id=guide_job_id,
                    logger=default_logger,
                    schedule_retry=guide_queue_consumer.schedule_retry,
                    send_to_dead_letter=guide_queue_consumer.send_to_dead_letter,
                )
        finally:
            await ocr_queue_consumer.close()
            await guide_queue_consumer.close()
            await close_database()
            default_logger.info("ai worker stopped")


async def main() -> None:
    worker = Worker()
    loop = asyncio.get_running_loop()
    for sig in (getattr(signal, "SIGINT", None), getattr(signal, "SIGTERM", None)):
        if sig is None:
            continue
        with suppress(NotImplementedError):
            loop.add_signal_handler(sig, worker.request_shutdown)
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
