# 配置模块，负责加载全局配置、环境变量、常量定义、工具函数等。
# 提供统一的配置管理和工具函数，供整个应用使用。
from __future__ import annotations
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from server.constants import LOBBY_ID, NAME_PATTERN

# 项目根目录
BASE_DIR = Path(__file__).resolve().parent.parent
# 前端静态资源目录
VIEW_DIR = BASE_DIR / "view"
# JSON 序列化工具
jd = json.dumps

# 加载 .env 文件（从项目根目录）
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / '.env')
except ImportError:
    pass  # 如果没有安装 python-dotenv，跳过


# 全局配置项，包含跨域、消息体积限制和静态资源缓存
@dataclass(frozen=True)
class Settings:
    allow_origins: list[str]
    max_message_bytes: int
    max_messages: int
    static_cache_seconds: int
    storage_max_bytes: int
    storage_max_age_days: int
    room_deletion_delay: int


# 辅助函数：处理CORS源列表
def _get_cors_origins() -> list[str]:
    raw_cors = os.getenv("CORS_ORIGINS", "*")
    if raw_cors == "*":
        return ["*"]
    # 分割并清理每个源
    origins = [origin.strip() for origin in raw_cors.split(",")]
    # 过滤掉空字符串
    origins = [origin for origin in origins if origin]
    # 如果没有有效源，使用默认值
    return origins if origins else ["*"]


# 辅助函数：安全获取环境变量为整数
def _get_env_int(key: str, default: int, min_value: int = 0) -> int:
    """获取环境变量为整数，带错误处理和最小值限制"""
    value_str = os.getenv(key, str(default))
    try:
        value = int(value_str)
        return max(value, min_value)
    except ValueError:
        return default


# 加载环境变量配置，返回 Settings 实例
def _load_settings() -> Settings:
    # 处理 CORS_ORIGINS
    allow = _get_cors_origins()
    # 处理 MAX_MESSAGE_BYTES、MAX_MESSAGES 和 STATIC_CACHE_SECONDS
    max_bytes = _get_env_int("MAX_MESSAGE_BYTES", 16 * 1024 * 1024, 1)
    max_msgs = _get_env_int("MAX_MESSAGES", 100, 10)  # 默认100，最小10
    cache_seconds = _get_env_int("STATIC_CACHE_SECONDS", 86400, 0)
    storage_max_bytes = _get_env_int(
        "STORAGE_MAX_BYTES", 5 * 1024 * 1024, 1024 * 1024
    )  # 默认5MB，最小1MB
    storage_max_age_days = _get_env_int(
        "STORAGE_MAX_AGE_DAYS", 7, 1
    )  # 默认7天，最小1天
    room_deletion_delay = _get_env_int("ROOM_DELETION_DELAY", 60, 10)  # 默认60秒，最小10秒
    return Settings(
        allow_origins=allow,
        max_message_bytes=max_bytes,
        max_messages=max_msgs,
        static_cache_seconds=cache_seconds,
        storage_max_bytes=storage_max_bytes,
        storage_max_age_days=storage_max_age_days,
        room_deletion_delay=room_deletion_delay,
    )


# 全局配置实例
_settings = _load_settings()
# 允许跨域源列表
ALLOW_ORIGINS = _settings.allow_origins
# 单条消息最大字节数
MAX_MESSAGE_BYTES = _settings.max_message_bytes
# 消息窗口最大数量
MAX_MESSAGES = _settings.max_messages
# 静态资源缓存时长（秒）
STATIC_CACHE_SECONDS = _settings.static_cache_seconds
# localStorage最大存储字节数
STORAGE_MAX_BYTES = _settings.storage_max_bytes
# 存储数据最大年龄（天）
STORAGE_MAX_AGE_DAYS = _settings.storage_max_age_days
# 房间删除延迟时间（秒）
ROOM_DELETION_DELAY = _settings.room_deletion_delay


# 构造错误响应，返回标准 JSON 格式
def err(code: str, **kw):
    return jd({"type": "error", "code": code, **kw})


# JSON 解析工具，解析失败返回默认值
def jloads(s, default=None):
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return default


# 构造正常响应，返回标准 JSON 格式
def ok(t: str, **kw):
    return jd({"type": t, **kw})


# 获取当前 UTC 时间戳（ISO 格式，Z 结尾）
def utc_ts() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


# 导出符号列表，供其它模块引用
__all__ = [
    "ALLOW_ORIGINS",
    "VIEW_DIR",
    "LOBBY_ID",
    "MAX_MESSAGE_BYTES",
    "MAX_MESSAGES",
    "NAME_PATTERN",
    "STATIC_CACHE_SECONDS",
    "STORAGE_MAX_BYTES",
    "STORAGE_MAX_AGE_DAYS",
    "ROOM_DELETION_DELAY",
    "err",
    "jloads",
    "ok",
    "utc_ts",
]
