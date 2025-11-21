# 定义所有 HTTP 和 WebSocket 路由，负责页面渲染、健康检查、配置查询、聊天室业务入口。
# 包含大厅和房间的WebSocket处理逻辑，以及静态资源服务。
from __future__ import annotations
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, Response
import logging
import os
from server.config import (
    VIEW_DIR,
    MAX_MESSAGE_BYTES,
    MAX_MESSAGES,
    STORAGE_MAX_BYTES,
    STORAGE_MAX_AGE_DAYS,
    jd,
    err,
    ok,
    jloads,
    utc_ts,
    NAME_PATTERN,
    STATIC_CACHE_SECONDS,
)
from server.rooms import RoomManager
from server.helpers import send_err, too_big, valid_name
from server.constants import CLOSE_POLICY, CLOSE_TOO_LARGE, ERROR_CODES

logger = logging.getLogger(__name__)


# 创建主路由对象，注册所有 HTTP 和 WebSocket 路由，负责页面渲染、健康检查、配置查询及聊天室核心业务。
def make_router(room_manager: RoomManager) -> APIRouter:
    router = APIRouter()

    # 首页路由，返回主页面 HTML，供前端入口加载。
    @router.get("/")
    async def homepage():
        return FileResponse(str(VIEW_DIR / "index.html"))

    # favicon 路由，返回网站图标，支持浏览器缓存。
    @router.get("/favicon.ico")
    async def favicon():
        p = str(VIEW_DIR / "icon" / "favicon.svg")
        cache_headers = {"Cache-Control": f"public, max-age={STATIC_CACHE_SECONDS}"}
        # 优先返回本地图标文件，否则返回 204 响应并禁止缓存。
        return (
            FileResponse(p, media_type="image/svg+xml", headers=cache_headers)
            if os.path.exists(p)
            else Response(
                status_code=204,
                headers={
                    "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
                },
            )
        )

    # 配置查询路由，前端初始化时获取消息长度、用户名规则、错误码等参数。
    @router.get("/config")
    async def get_config():
        return {
            "maxMessageBytes": MAX_MESSAGE_BYTES,
            "maxMessages": MAX_MESSAGES,
            "storageMaxBytes": STORAGE_MAX_BYTES,
            "storageMaxAgeDays": STORAGE_MAX_AGE_DAYS,
            "namePattern": NAME_PATTERN,
            "errorCodes": sorted(ERROR_CODES),
        }

    @router.websocket("/ws/lobby")
    async def lobby_ws(ws: WebSocket):
        await ws.accept()  # 接受 WebSocket 连接
        room_manager.lobby_clients.add(ws)  # 将客户端加入大厅连接集合
        try:
            await room_manager.broadcast_rooms()  # 初始广播所有房间列表
            while True:
                data = await ws.receive_text()  # 等待客户端消息
                if too_big(data):  # 消息过大则拒绝
                    await send_err(ws, "msg_too_large", close_code=CLOSE_TOO_LARGE)
                    return
                m = jloads(data, {})  # 解析 JSON 消息
                if not isinstance(m, dict):
                    m = {}
                t = m.get("type")  # 获取消息类型
                if t == "create":  # 创建房间请求
                    room_name = str(m.get("room", "")).strip()  # 获取并清理房间名
                    # 校验房间名合法性
                    if not room_name or not valid_name(room_name):
                        code = "bad_room"
                    else:
                        code = room_manager.create_error(room_name)  # 检查是否可创建
                    if code:  # 有错误则返回错误信息
                        if code == "bad_room":
                            await ws.send_text(err(code))
                        else:
                            await ws.send_text(err(code, room=room_name))
                        continue
                    room_manager.create(room_name)  # 创建房间
                    await ws.send_text(ok("created", room=room_name))  # 通知创建成功
                    await room_manager.broadcast_rooms()  # 广播最新房间列表
        except WebSocketDisconnect:
            logger.debug("Lobby websocket disconnected", exc_info=True)  # 连接断开日志
        finally:
            room_manager.lobby_clients.discard(ws)  # 移除断开连接的客户端

    @router.websocket("/ws/room/{room_id}")
    async def room_ws(websocket: WebSocket, room_id: str):
        await websocket.accept()  # 接受 WebSocket 连接
        if not valid_name(room_id):  # 校验房间名
            await send_err(websocket, "bad_room", close_code=CLOSE_POLICY)
            return
        r = await room_manager.ensure_room(room_id)  # 获取或创建房间对象
        try:
            raw_join = await websocket.receive_text()  # 等待用户首次加入消息
        except WebSocketDisconnect:
            logger.debug(
                "Room websocket closed before join: %s", room_id, exc_info=True
            )
            return
        if too_big(raw_join):  # 加入消息过大则拒绝
            await send_err(websocket, "msg_too_large", close_code=CLOSE_TOO_LARGE)
            return
        m = jloads(raw_join, {})  # 解析 JSON
        if not isinstance(m, dict):
            m = {}
        username = (
            m.get("username", "anonymous") if isinstance(m, dict) else "anonymous"
        )
        if not isinstance(username, str):
            username = "anonymous"
        username = (username or "").strip()  # 清理用户名
        if not valid_name(username):  # 校验用户名
            await send_err(websocket, "bad_username", close_code=CLOSE_POLICY)
            return
        r.connections[websocket] = username  # 记录连接与用户名
        # 如果有删除定时器，取消它
        if room_id in room_manager.deletion_timers:
            room_manager.deletion_timers[room_id].cancel()
            del room_manager.deletion_timers[room_id]
        # 发送房间切换消息给自己
        await websocket.send_text(jd({"type": "roomSwitch", "room": room_id}))
        await room_manager.announce_status(
            room_id, f"{username} 已加入", exclude=websocket
        )  # 广播加入状态
        await room_manager.announce_users(room_id)  # 广播当前用户列表
        try:
            while True:
                data = await websocket.receive_text()  # 等待用户消息
                if too_big(data):  # 消息过大则拒绝
                    await send_err(
                        websocket, "msg_too_large", close_code=CLOSE_TOO_LARGE
                    )
                    break
                parsed = jloads(data, None)  # 解析消息
                if not isinstance(parsed, dict):
                    parsed = {"type": "text", "text": data}  # 非 dict 默认文本消息
                if parsed.get("type") == "rename":  # 改名请求
                    newname = parsed.get("username", username)
                    if not isinstance(newname, str):
                        newname = username
                    newname = (newname or "").strip()
                    if not valid_name(newname):  # 新用户名不合法
                        try:
                            await websocket.send_text(err("bad_username"))
                        except Exception:
                            pass
                        continue
                    r.connections[websocket] = newname  # 更新用户名
                    await room_manager.announce_status(
                        room_id, f"{username} 改名为 {newname}"
                    )  # 广播改名
                    await room_manager.announce_users(room_id)  # 广播用户列表
                    username = newname
                    continue
                parsed["username"] = username  # 附加用户名
                parsed["ts"] = utc_ts()  # 附加时间戳
                msg_str = jd(parsed)  # 序列化消息
                await room_manager.broadcast_room(room_id, msg_str)  # 广播消息
        except WebSocketDisconnect:
            logger.debug(
                "Room websocket disconnected: %s", room_id, exc_info=True
            )  # 断开日志
        finally:
            r2 = room_manager.rooms.get(room_id)
            if r2 and websocket in r2.connections:
                left_user = r2.connections.get(websocket, username)
                await room_manager.user_left(
                    room_id, websocket, left_user
                )  # 通知用户离开

    # 返回注册完所有路由的 APIRouter 实例，供主应用挂载。
    return router
