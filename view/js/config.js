/**
 * config.js - 应用程序配置文件
 * 此文件包含应用程序的配置常量、文本字符串和服务器配置应用函数。
 * 定义了消息大小限制、房间名称、存储键、主题键、正则表达式等。
 * 提供了错误处理和服务器配置动态应用的工具函数。
 */

// 服务器消息限制字节数，设置为16MB
const SERVER_MESSAGE_LIMIT_BYTES = 16 * 1024 * 1024;
// 头部空间字节数，设置为16KB，用于预留空间
const HEADROOM_BYTES = 16 * 1024;
// 导出最大消息字节数，初始值等于服务器限制，可通过服务器配置修改
export let MAX_MESSAGE_BYTES = SERVER_MESSAGE_LIMIT_BYTES;
// 导出最大消息数量，可通过服务器配置修改（默认100条，适用于小团队）
export let MAX_MESSAGES = 100;
// 大厅房间的固定名称
export const LOBBY_ROOM = "lobby";
// 用户名在本地存储中的键名
export const STORAGE_KEY = "lanchat_username";
// 主题设置在本地存储中的键名
export const THEME_KEY = "lanchat_theme";
// 用户名正则表达式模式，支持中文、字母、数字、下划线、短横线，长度1-10位
export let NAME_PATTERN = "^[A-Za-z0-9_-\u3400-\u9FFF\uF900-\uFAFF]{1,10}$";
// 用户名规则描述字符串，用于错误提示
const NAME_RULE = "仅中文/字母/数字/下划线/短横线, 1-10位";
// 服务器错误代码数组，可通过服务器配置动态设置
export let SERVER_ERROR_CODES = [];
const COPY = Object.freeze({
  text: {
    // 提示用户输入用户名的文本
    enterUsername: "请输入用户名",
    // 明亮主题的显示名称
    themeLight: "明亮主题",
    // 暗黑主题的显示名称
    themeDark: "暗黑主题",
    // 发送消息失败时的提示文本
    sendFail: "连接未建立，发送失败",
    // 用户加入房间的提示消息，根据房间ID动态生成
    joined: (roomId) => (roomId === LOBBY_ROOM ? "已加入" : `已加入 ${roomId}`),
    // 文本过长的错误提示，显示当前字节数和上限
    textTooLong: (bytes, max, fmt) =>
      `文本过长(${fmt(bytes)}), 上限为 ${fmt(max)})`,
    // 文件过大的错误提示，显示最大MB数
    fileTooLarge: (maxMB) => `文件大小应≤${maxMB}MB`,
    // 消息过大的错误提示，显示JSON字节数和上限
    msgTooLarge: (jsonBytes, max, fmt) =>
      `消息过大(${fmt(jsonBytes)}), 上限为 ${fmt(max)})`,
    // 超出上限的通用提示
    exceedLimit: "超出上限",
    // 文件读取失败的提示
    readFail: "读取失败",
    // 大厅连接恢复的提示
    connectionLobbyRestored: "大厅连接已恢复",
    // 大厅连接重试的提示，显示重试秒数
    connectionLobbyRetry: (seconds) => `大厅连接中断，${seconds} 秒后重试...`,
    connectionRoomRestored: (roomId) =>
      roomId ? `${roomId} 房间连接已恢复` : "房间连接已恢复",
    connectionRoomRetry: (roomId, seconds) =>
      roomId
        ? `${roomId} 房间连接中断，${seconds} 秒后重试...`
        : `房间连接中断，${seconds} 秒后重试...`,
  },
  errors: {
    bad_room: `房间名不合法(${NAME_RULE})`,
    room_exists: "房间已存在",
    reserved: "房间名保留不可用",
    msg_too_large: "消息过大",
    bad_username: `用户名不合法(${NAME_RULE})`,
    ws_closed_1008: "协议/策略校验失败",
    ws_closed_1009: "消息尺寸超出限制",
  },
});
export const TEXT = COPY.text;
const ERROR_MAP = COPY.errors;
export const STRINGS = COPY;
/**
 * 根据错误代码获取对应的错误文本
 * @param {string} code - 错误代码字符串
 * @param {string} fallback - 默认的错误消息，当找不到对应错误时使用
 * @returns {string} 对应的错误文本或默认消息
 */
export function errorText(code, fallback = "发生错误") {
  // 如果没有错误代码，返回默认消息
  if (!code) return fallback;
  // 如果错误映射中有对应代码，返回映射的文本
  if (ERROR_MAP[code]) return ERROR_MAP[code];
  // 如果服务器错误代码数组包含此代码，返回默认消息加代码
  if (SERVER_ERROR_CODES.includes(code)) return `${fallback}(${code})`;
  // 否则返回默认消息
  return fallback;
}
/**
 * 计算允许的文件原始字节数
 * 基于最大消息字节数减去头部空间，然后除以base64编码开销(4/3)
 * @returns {number} 允许的文件字节数
 */
export function allowedFileOriginalBytes() {
  // 计算可用字节数，确保不小于0
  const avail = Math.max(0, MAX_MESSAGE_BYTES - HEADROOM_BYTES);
  // 返回可用字节数除以base64编码开销(4/3)，得到原始文件大小限制
  return Math.floor(avail / (4 / 3));
}
/**
 * 应用服务器发送的配置信息
 * 更新最大消息字节数、用户名模式和错误代码
 * @param {Object} cfg - 服务器配置对象
 */
export function applyServerConfig(cfg) {
  try {
    // 更新最大消息字节数，如果配置有效
    if (cfg && Number.isFinite(cfg.maxMessageBytes)) {
      MAX_MESSAGE_BYTES = cfg.maxMessageBytes;
    }
    // 更新最大消息数量，如果配置有效
    if (cfg && Number.isFinite(cfg.maxMessages) && cfg.maxMessages > 0) {
      MAX_MESSAGES = Math.max(10, Math.min(1000, cfg.maxMessages)); // 限制在10-1000之间
    }
    // 更新用户名正则表达式，如果配置有效
    if (
      cfg &&
      typeof cfg.namePattern === "string" &&
      cfg.namePattern.length > 0
    ) {
      try {
        // 验证正则表达式是否有效
        new RegExp(cfg.namePattern);
        NAME_PATTERN = cfg.namePattern;
      } catch (_) {
        // 如果正则无效，忽略更新
      }
    }
    // 更新服务器错误代码数组，如果配置有效
    if (cfg && Array.isArray(cfg.errorCodes)) {
      // 去重并设置错误代码
      SERVER_ERROR_CODES = [...new Set(cfg.errorCodes)];
      // 检查是否有缺失的错误文本映射
      const missing = SERVER_ERROR_CODES.filter((code) => !ERROR_MAP[code]);
      if (missing.length) {
        // 警告缺失的错误映射
        console.warn("Missing error text mappings for:", missing);
      }
    }
  } catch (_) {
    // 忽略配置应用过程中的任何错误
  }
}
