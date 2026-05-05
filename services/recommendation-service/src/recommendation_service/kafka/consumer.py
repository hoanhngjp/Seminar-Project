import asyncio
import json
import logging

from aiokafka import AIOKafkaConsumer

from recommendation_service.core.config import settings
from recommendation_service.kafka.handlers import (
    handle_preferences_updated,
    handle_song_played,
    handle_song_skipped,
)

logger = logging.getLogger(__name__)

HANDLERS = {
    "Song_Played": handle_song_played,
    "Song_Skipped": handle_song_skipped,
    "User_Preferences_Updated": handle_preferences_updated,
}
MAX_RETRIES = 3


async def start_consumer(app) -> asyncio.Task:
    task = asyncio.create_task(_consumer_loop(app))
    return task


async def stop_consumer(task: asyncio.Task) -> None:
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


async def _consumer_loop(app) -> None:
    consumer = AIOKafkaConsumer(
        *settings.kafka_topics,
        bootstrap_servers=settings.kafka_bootstrap_servers,
        group_id=settings.kafka_consumer_group_id,
        auto_offset_reset="earliest",
        enable_auto_commit=False,  # manual commit — MUST be False
    )

    try:
        await consumer.start()
        logger.info(
            "kafka_consumer_started topics=%s group=%s",
            settings.kafka_topics,
            settings.kafka_consumer_group_id,
        )
    except Exception as exc:
        logger.error("kafka_consumer_start_failed error=%s", str(exc))
        return

    try:
        async for msg in consumer:
            topic = msg.topic
            event_id = msg.key.decode() if msg.key else None

            # 1. Idempotency check BEFORE processing
            if event_id:
                is_new = await app.state.redis.set(
                    f"rec:idempotency:{event_id}", "1", ex=86400, nx=True
                )
                if not is_new:
                    logger.warning(
                        "duplicate_event_skipped event_id=%s topic=%s", event_id, topic
                    )
                    await consumer.commit()
                    continue

            # 2. Process with retry + exponential backoff
            try:
                payload = json.loads(msg.value.decode())
            except json.JSONDecodeError as exc:
                logger.error("kafka_invalid_json topic=%s error=%s", topic, str(exc))
                await consumer.commit()
                continue

            handler = HANDLERS.get(topic)
            if handler:
                await _process_with_retry(handler, payload, app.state.redis, event_id, topic)

            # 3. Commit ONLY after successful processing
            await consumer.commit()

    except asyncio.CancelledError:
        logger.info("kafka_consumer_stopping")
    finally:
        await consumer.stop()
        logger.info("kafka_consumer_stopped")


async def _process_with_retry(handler, payload: dict, redis, event_id: str | None, topic: str) -> None:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            await handler(payload, redis)
            return
        except Exception as exc:
            if attempt == MAX_RETRIES:
                logger.error(
                    "event_processing_failed_dlq topic=%s event_id=%s error=%s attempt=%d",
                    topic, event_id, str(exc), attempt,
                )
                # TODO: send to {topic}.DLQ via aiokafka producer
                return
            delay = 2 ** (attempt - 1)  # 1s → 2s → 4s
            logger.warning(
                "event_processing_retry topic=%s attempt=%d delay_s=%d",
                topic, attempt, delay,
            )
            await asyncio.sleep(delay)
