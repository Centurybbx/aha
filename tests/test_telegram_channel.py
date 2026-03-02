from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any

from ana.bus import MessageBus
from ana.channels.telegram import TelegramChannel


class FakeBot:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def send_message(self, **kwargs: Any) -> None:
        self.calls.append(kwargs)
        if "reply_parameters" in kwargs:
            raise TypeError("send_message() got an unexpected keyword argument 'reply_parameters'")


def test_telegram_send_fallback_to_reply_to_message_id_on_type_error() -> None:
    async def _run() -> None:
        channel = TelegramChannel(token="t", bus=MessageBus())
        fake_bot = FakeBot()
        channel._app = SimpleNamespace(bot=fake_bot)

        await channel.send(chat_id="123", content="hello", reply_to="9")

        assert len(fake_bot.calls) == 2
        assert fake_bot.calls[0]["chat_id"] == 123
        assert fake_bot.calls[0]["reply_parameters"] == {"message_id": 9}
        assert fake_bot.calls[1]["chat_id"] == 123
        assert fake_bot.calls[1]["reply_to_message_id"] == 9

    asyncio.run(_run())


def test_telegram_send_ignores_invalid_reply_target() -> None:
    async def _run() -> None:
        channel = TelegramChannel(token="t", bus=MessageBus())
        fake_bot = FakeBot()
        channel._app = SimpleNamespace(bot=fake_bot)

        await channel.send(chat_id="123", content="hello", reply_to="not-int")

        assert len(fake_bot.calls) == 1
        assert fake_bot.calls[0]["chat_id"] == 123
        assert "reply_to_message_id" not in fake_bot.calls[0]
        assert "reply_parameters" not in fake_bot.calls[0]

    asyncio.run(_run())
