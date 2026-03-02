from __future__ import annotations

import asyncio
import logging
from collections.abc import Iterable

from ana.bus import MessageBus, OutboundMessage
from ana.channels.base import BaseChannel
from ana.runtime_log import log_event


class ChannelManager:
    def __init__(
        self,
        bus: MessageBus,
        channels: Iterable[BaseChannel],
        *,
        logger: logging.Logger | None = None,
    ):
        self.bus = bus
        self.channels = {channel.name: channel for channel in channels}
        self.logger = logger or logging.getLogger("ana.channels.manager")
        self._dispatcher: asyncio.Task[None] | None = None
        self._stopping = False

    async def start(self) -> None:
        self._stopping = False
        for channel in self.channels.values():
            try:
                await channel.start()
            except Exception as exc:
                log_event(
                    self.logger,
                    "channel_start_error",
                    level=logging.ERROR,
                    channel=channel.name,
                    error_type=type(exc).__name__,
                    error=str(exc),
                )
                raise
        self._dispatcher = asyncio.create_task(self._dispatch_loop(), name="ana.channel_dispatcher")

    async def stop(self) -> None:
        self._stopping = True
        if self._dispatcher is not None:
            self._dispatcher.cancel()
            try:
                await self._dispatcher
            except asyncio.CancelledError:
                pass
            self._dispatcher = None
        for channel in self.channels.values():
            await channel.stop()

    async def _dispatch_loop(self) -> None:
        while not self._stopping:
            try:
                outbound = await self.bus.next_outbound()
            except asyncio.CancelledError:
                break
            try:
                await self.dispatch_once(outbound)
            except Exception as exc:
                log_event(
                    self.logger,
                    "outbound_dispatch_error",
                    level=logging.ERROR,
                    channel=outbound.channel,
                    chat_id=outbound.chat_id,
                    content_len=len(str(outbound.content or "")),
                    error_type=type(exc).__name__,
                    error=str(exc),
                )

    async def dispatch_once(self, outbound: OutboundMessage) -> None:
        channel = self.channels.get(outbound.channel)
        if channel is None:
            return
        limit = _message_limit(outbound.channel)
        chunks = _split_message(outbound.content, limit=limit)
        for idx, chunk in enumerate(chunks):
            reply_to = outbound.reply_to if idx == 0 else None
            await channel.send(
                chat_id=outbound.chat_id,
                content=chunk,
                reply_to=reply_to,
                metadata=outbound.metadata,
            )


def _message_limit(channel: str) -> int:
    if channel == "discord":
        return 2000
    if channel == "telegram":
        return 4000
    return 4000


def _split_message(content: str, limit: int) -> list[str]:
    text = str(content or "")
    if not text:
        return [""]
    if len(text) <= limit:
        return [text]
    chunks: list[str] = []
    start = 0
    while start < len(text):
        chunks.append(text[start : start + limit])
        start += limit
    return chunks
