"""
应用的常量和验证模式。

此模块定义了应用中使用的所有常量值，包括WebSocket关闭代码、
房间标识符、验证模式和错误代码定义。将这些常量集中管理确保
一致性并便于维护。
"""

from __future__ import annotations
import re

# 房间标识符
LOBBY_ID: str = "lobby"
"""
大厅的特殊房间ID，用户可以在此处查看可用房间并加入对话。
这是用户初始连接的默认房间。
"""

# WebSocket关闭代码（RFC 6455标准代码）
CLOSE_POLICY: int = 1008
"""
WebSocket关闭代码，表示违反策略。
当客户端行为违反应用规则时使用（例如，无效用户名）。
"""

CLOSE_TOO_LARGE: int = 1009
"""
WebSocket关闭代码，表示消息过大无法处理。
当客户端发送超过最大允许字节大小的消息时使用。
"""

# 名称验证模式
NAME_PATTERN: str = r"^[A-Za-z0-9_\-\u3400-\u9FFF\uF900-\uFAFF]{1,10}$"
"""
用于验证用户名的正则表达式模式。
允许字母数字字符、下划线、连字符和中日韩字符。
最大长度为10个字符，以防止滥用和UI问题。
"""

NAME_RE = re.compile(NAME_PATTERN)
"""
编译后的正则表达式对象，用于高效的名称验证。
由工具函数使用，以检查用户名是否匹配所需模式。
"""

# 用于客户端通信的错误代码
ERROR_CODES = {"bad_room", "room_exists", "reserved", "msg_too_large", "bad_username"}
"""
可以发送给客户端的有效错误代码集合。
每个代码对应特定的错误条件：
- bad_room: 尝试加入不存在的房间
- room_exists: 尝试创建已存在的房间
- reserved: 尝试使用保留的房间名称
- msg_too_large: 消息超过最大允许大小
- bad_username: 用户名未通过验证规则
"""

# 模块导出
__all__ = [
    "LOBBY_ID",
    "CLOSE_POLICY",
    "CLOSE_TOO_LARGE",
    "NAME_PATTERN",
    "NAME_RE",
    "ERROR_CODES",
]
"""
显式定义此模块的公共API。
只有这些符号在使用 'from constants import *' 时可用。
"""
