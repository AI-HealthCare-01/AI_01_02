from datetime import datetime
from logging import Logger

from ai_worker.core import config
from ai_worker.tasks.guide import GuideQueueConsumer, process_guide_job
from ai_worker.tasks.ocr import OcrQueueConsumer, process_ocr_job


async def run_heartbeat(logger: Logger) -> None:
    logger.info("worker heartbeat at %s", datetime.now(tz=config.TIMEZONE).isoformat())
