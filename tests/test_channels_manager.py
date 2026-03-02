from __future__ import annotations

import asyncio

from ana.bus import MessageBus, OutboundMessage
from ana.channels.base import BaseChannel
from ana.channels.manager import ChannelManager


class FakeChannel(BaseChannel):
    def __init__(self, name: str) -> None:
        self._name = name
        self.sent: list[tuple[str, str | None]] = []
        self.started = False
        self.stopped = False

    @property
    def name(self) -> str:
        return self._name

    async def start(self) -> None:
        self.started = True

    async def stop(self) -> None:
        self.stopped = True

    async def send(self, chat_id: str, content: str, reply_to: str | None = None, metadata: dict | None = None) -> None:
        self.sent.append((content, reply_to))


class FlakyChannel(FakeChannel):
    def __init__(self, name: str) -> None:
        super().__init__(name=name)
        self._calls = 0

    async def send(self, chat_id: str, content: str, reply_to: str | None = None, metadata: dict | None = None) -> None:
        self._calls += 1
        if self._calls == 1:
            raise RuntimeError("simulated send failure")
        await super().send(chat_id=chat_id, content=content, reply_to=reply_to, metadata=metadata)


def test_channel_manager_splits_discord_messages_and_keeps_reply_only_first_chunk() -> None:
    async def _run() -> None:
        bus = MessageBus()
        discord = FakeChannel("discord")
        manager = ChannelManager(bus=bus, channels=[discord])
        await manager.start()

        text = "x" * 4500
        await bus.publish_outbound(
            OutboundMessage(channel="discord", chat_id="c1", content=text, reply_to="m1")
        )

        await asyncio.sleep(0.05)
        await manager.stop()
        assert discord.started
        assert discord.stopped
        assert len(discord.sent) == 3
        assert len(discord.sent[0][0]) == 2000
        assert len(discord.sent[1][0]) == 2000
        assert len(discord.sent[2][0]) == 500
        assert discord.sent[0][1] == "m1"
        assert discord.sent[1][1] is None
        assert discord.sent[2][1] is None

    asyncio.run(_run())


def test_channel_manager_dispatcher_survives_send_error() -> None:
    async def _run() -> None:
        bus = MessageBus()
        channel = FlakyChannel("telegram")
        manager = ChannelManager(bus=bus, channels=[channel])
        await manager.start()

        await bus.publish_outbound(OutboundMessage(channel="telegram", chat_id="c1", content="first"))
        await bus.publish_outbound(OutboundMessage(channel="telegram", chat_id="c1", content="second"))

        await asyncio.sleep(0.05)
        await manager.stop()

        assert channel.sent == [("second", None)]

    asyncio.run(_run())
