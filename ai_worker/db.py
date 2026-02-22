from tortoise import Tortoise

from app.db.databases import TORTOISE_ORM


async def initialize_database() -> None:
    await Tortoise.init(config=TORTOISE_ORM)


async def close_database() -> None:
    await Tortoise.close_connections()
