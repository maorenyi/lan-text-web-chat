# 聊天房间与房间管理核心逻辑，负责多房间创建、用户进出、消息广播、状态同步等。
# 管理所有聊天室的生命周期和WebSocket连接。
from __future__ import annotations
from fastapi import WebSocket
import asyncio
import logging
from server.config import jd, utc_ts, ROOM_DELETION_DELAY

logger = logging.getLogger("lan-text-web-chat")


# 聊天房间对象，管理房间内所有连接
class Room:
    # 初始化房间，创建连接字典
    def __init__(self):
        self.connections: dict[WebSocket, str] = {}


# 房间管理器，负责房间的创建、删除、广播和用户管理
class RoomManager:
    # 初始化房间管理器，创建大厅房间和大厅用户集合
    def __init__(self, lobby_id: str):
        self.lobby_id = lobby_id
        self.rooms: dict[str, Room] = {lobby_id: Room()}
        self.lobby_clients: set[WebSocket] = set()
        self.deletion_timers: dict[str, asyncio.Handle] = {}
        # 房间删除延迟时间（秒）
        self.deletion_delay = ROOM_DELETION_DELAY

    # 判断房间是否存在
    def exists(self, room_id: str) -> bool:
        return room_id in self.rooms

    # 校验房间创建请求，返回错误码或 None
    def create_error(self, room_id: str) -> str | None:
        if not room_id:
            return "bad_room"
        if room_id == self.lobby_id:
            return "reserved"
        if self.exists(room_id):
            return "room_exists"
        return None

    # 创建新房间，成功返回 True
    def create(self, room_id: str) -> bool:
        if room_id == self.lobby_id or room_id in self.rooms:
            return False
        self.rooms[room_id] = Room()
        return True

    # 删除指定房间（不能删除大厅）
    def delete(self, room_id: str):
        if room_id != self.lobby_id and room_id in self.rooms:
            del self.rooms[room_id]

    # 延迟删除房间
    async def _delayed_delete(self, room_id: str):
        if room_id in self.deletion_timers:
            del self.deletion_timers[room_id]
        self.delete(room_id)
        await self.broadcast_rooms()

    # 获取所有非大厅房间列表
    def list_rooms(self) -> list[str]:
        return sorted([r for r in self.rooms if r != self.lobby_id])

    # 构造房间用户列表的 JSON 负载
    def users_payload(self, room_id: str) -> str:
        rr = self.rooms.get(room_id)
        lst = list(rr.connections.values()) if rr else []
        return jd({"type": "users", "list": lst})

    # 构造房间状态消息 JSON 负载
    def status(self, text: str) -> str:
        return jd({"type": "status", "text": text, "ts": utc_ts()})

    # 广播房间用户列表
    async def announce_users(self, room_id: str):
        await self.broadcast_room(room_id, self.users_payload(room_id))

    # 广播房间状态消息，可排除指定连接
    async def announce_status(
        self, room_id: str, text: str, exclude: WebSocket | None = None
    ):
        await self.broadcast_room(room_id, self.status(text), exclude=exclude)

    # 广播所有房间列表到大厅
    async def broadcast_rooms(self):
        msg = jd({"type": "rooms", "list": self.list_rooms()})
        stale = await self.send_multi(self.lobby_clients, msg)
        for ws in stale:
            self.lobby_clients.discard(ws)

    # 广播消息到指定房间，可排除某连接
    async def broadcast_room(
        self, room_id: str, message: str, exclude: WebSocket | None = None
    ):
        r = self.rooms.get(room_id)
        if not r:
            return
        conns = [c for c in r.connections if not (exclude is not None and c is exclude)]
        stale = await self.send_multi(conns, message)
        for ws in stale:
            r.connections.pop(ws, None)
        if not r.connections and room_id != self.lobby_id:
            if room_id not in self.deletion_timers:
                self.deletion_timers[room_id] = asyncio.get_event_loop().call_later(
                    self.deletion_delay, lambda: asyncio.create_task(self._delayed_delete(room_id))
                )

    # 安全发送文本消息到单个 WebSocket，失败自动关闭连接
    async def safe_send_text(self, ws: WebSocket, message: str) -> bool:
        try:
            await ws.send_text(message)
            return True
        except Exception as exc:
            logger.debug("WebSocket send failed: %s", exc)
            try:
                await ws.close()
            except Exception:
                pass
            return False

    # 批量发送消息到多个 WebSocket，返回失效连接列表
    async def send_multi(
        self, targets: list[WebSocket] | set[WebSocket], message: str
    ) -> list[WebSocket]:
        if not targets:
            return []
        sockets = list(targets)
        results = await asyncio.gather(
            *(self.safe_send_text(ws, message) for ws in sockets),
            return_exceptions=True,
        )
        stale: list[WebSocket] = []
        for ws, res in zip(sockets, results):
            if res is False or isinstance(res, Exception):
                stale.append(ws)
        return stale

    # 确保房间存在，不存在则自动创建并广播
    async def ensure_room(self, room_id: str) -> Room:
        r = self.rooms.get(room_id)
        if r:
            return r
        if room_id == self.lobby_id:
            self.rooms[self.lobby_id] = Room()
            return self.rooms[self.lobby_id]
        self.create(room_id)
        await self.broadcast_rooms()
        return self.rooms[room_id]

    # 用户离开房间，自动广播状态和用户列表，房间无人时自动删除
    async def user_left(self, room_id: str, ws: WebSocket, username: str):
        r = self.rooms.get(room_id)
        if not r:
            return
        r.connections.pop(ws, None)
        await self.announce_status(room_id, f"{username} 已离开")
        if r.connections:
            await self.announce_users(room_id)
            await self.broadcast_rooms()
