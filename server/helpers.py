"""
应用的工具函数。

此模块提供错误处理、消息验证和WebSocket通信的工具函数。
这些函数在整个应用中使用，以确保一致的错误响应和数据验证。
"""

from __future__ import annotations
import logging
from fastapi import WebSocket
from server.config import err, MAX_MESSAGE_BYTES
from server.constants import NAME_RE

logger = logging.getLogger(__name__)


async def send_err(ws: WebSocket, code: str, close_code: int | None = None) -> None:
    """
    向WebSocket客户端发送错误消息，并可选地关闭连接。

    此函数提供向客户端发送错误消息的标准化方式，并在必要时处理连接关闭。
    它包含错误处理，以防止WebSocket已关闭或处于无效状态时引发异常。

    参数:
        ws: 要发送错误的WebSocket连接
        code: 错误代码字符串（将转换为JSON错误格式）
        close_code: 可选的WebSocket关闭代码，用于关闭连接时

    注意:
        发送或关闭期间的异常会被记录但不会重新引发，以防止错误处理代码中的级联失败。
    """
    try:
        await ws.send_text(err(code))
    except Exception as exc:
        logger.debug("send_err 发送消息失败: %s", exc)
    if close_code is not None:
        try:
            await ws.close(code=close_code, reason=code)
        except Exception as exc:
            logger.debug("send_err 关闭WebSocket失败: %s", exc)


def too_big(s: str, limit: int = MAX_MESSAGE_BYTES) -> bool:
    """
    检查字符串是否超过最大允许字节大小。

    此函数通过检查UTF-8编码的字节长度来验证消息大小。
    这对于防止内存耗尽和确保消息适合WebSocket帧限制很重要。

    参数:
        s: 要检查的字符串
        limit: 最大允许字节数（默认为config中的MAX_MESSAGE_BYTES）

    返回:
        如果字符串的字节长度超过限制则返回True，否则返回False
    """
    return len(s.encode("utf-8")) > limit


def valid_name(name: str) -> bool:
    """
    根据应用规则验证用户名。

    此函数对用户名执行全面验证，包括类型检查、空白字符修剪、
    空值检查和针对配置的名称验证模式的正则表达式匹配。

    参数:
        name: 要验证的名称字符串

    返回:
        如果名称有效则返回True，否则返回False

    验证规则:
        - 必须是字符串
        - 修剪空白字符后不能为空
        - 必须匹配constants中的NAME_RE正则表达式模式
    """
    if not isinstance(name, str):
        return False
    name = name.strip()
    if not name:
        return False
    return bool(NAME_RE.match(name))
