"""
应用的日志配置。

此模块提供集中式日志设置，支持环境变量配置。
它支持可配置的日志级别和格式，并处理现有记录器的初始设置和运行时级别更改。
"""

from __future__ import annotations
import logging
import os

# 从环境变量获取默认日志配置
DEFAULT_LOG_FORMAT = os.getenv(
    "LOG_FORMAT", "%(asctime)s %(levelname)s %(name)s: %(message)s"
)
"""
默认日志消息格式字符串。
包含时间戳、日志级别、记录器名称和消息。
可以通过LOG_FORMAT环境变量覆盖。
"""

DEFAULT_LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
"""
默认日志级别字符串（例如，"DEBUG"、"INFO"、"WARNING"、"ERROR"）。
如果未设置LOG_LEVEL环境变量，则默认为"INFO"。
转换为大写以与logging模块常量保持一致。
"""


def _resolve_level(value: str) -> int:
    """
    将字符串日志级别名称转换为其数字logging常量。

    此函数安全地将日志级别名称解析为其整数值，
    如果提供的级别名称无效，则回退到INFO级别。

    参数:
        value: 日志级别的字符串表示（例如，"DEBUG"、"INFO"）

    返回:
        logging模块中的整数日志级别常量

    示例:
        >>> _resolve_level("DEBUG")
        10
        >>> _resolve_level("INVALID")
        20  # 回退到INFO
    """
    return getattr(logging, value, logging.INFO)


def configure_logging() -> None:
    """
    配置应用的日志系统。

    此函数使用配置的级别和格式设置日志。
    如果日志已配置（根记录器有处理程序），则更新现有处理程序的日志级别。
    否则，执行基本配置。

    该函数处理以下情况：
    - 不存在处理程序时的初始设置
    - 处理程序已存在时的运行时日志级别更改

    注意:
        此函数修改根记录器及其所有处理程序。
        应在应用启动早期调用。
    """
    level = _resolve_level(DEFAULT_LOG_LEVEL)
    root = logging.getLogger()
    if root.handlers:
        # 日志已配置，只更新级别
        root.setLevel(level)
        for handler in root.handlers:
            handler.setLevel(level)
        return
    # 初始日志设置
    logging.basicConfig(level=level, format=DEFAULT_LOG_FORMAT)
