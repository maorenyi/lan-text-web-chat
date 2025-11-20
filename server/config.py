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


# 全局配置项，包含跨域、消息体积限制和静态资源缓存
@dataclass(frozen=True)
class Settings:
    allow_origins: list[str]
    max_message_bytes: int
    static_cache_seconds: int


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
    # 处理 MAX_MESSAGE_BYTES 和 STATIC_CACHE_SECONDS
    max_bytes = _get_env_int("MAX_MESSAGE_BYTES", 16 * 1024 * 1024, 1)
    cache_seconds = _get_env_int("STATIC_CACHE_SECONDS", 86400, 0)
    return Settings(
        allow_origins=allow,
        max_message_bytes=max_bytes,
        static_cache_seconds=cache_seconds,
    )


# 全局配置实例
_settings = _load_settings()
# 允许跨域源列表
ALLOW_ORIGINS = _settings.allow_origins
# 单条消息最大字节数
MAX_MESSAGE_BYTES = _settings.max_message_bytes
# 静态资源缓存时长（秒）
STATIC_CACHE_SECONDS = _settings.static_cache_seconds


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
    "NAME_PATTERN",
    "STATIC_CACHE_SECONDS",
    "err",
    "jloads",
    "ok",
    "utc_ts",
]
