/**
 * utils.js - 工具函数模块
 * 此文件包含通用的工具函数，包括DOM操作、WebSocket处理、数据格式化、
 * 主题管理、验证函数等。提供应用程序各模块共享的辅助功能。
 */
import { THEME_KEY, NAME_PATTERN } from "./config.js";
/**
 * 根据ID获取DOM元素
 * @param {string} id - 元素ID
 * @returns {HTMLElement|null} DOM元素或null
 */
export const $ = (id) => document.getElementById(id);
/**
 * 获取ISO格式的当前时间字符串
 * @returns {string} ISO时间字符串
 */
export const isoNow = () => new Date().toISOString();
/**
 * 根据当前协议确定WebSocket协议
 * @returns {string} WebSocket协议 ('ws' 或 'wss')
 */
const wsProto = () => (location.protocol === "https:" ? "wss" : "ws");
/**
 * 构建WebSocket URL
 * @param {string} path - WebSocket路径
 * @returns {string} 完整的WebSocket URL
 */
export const wsUrl = (path) => `${wsProto()}://${location.host}${path}`;
/**
 * 检查WebSocket是否打开
 * @param {WebSocket} ws - WebSocket实例
 * @returns {boolean} WebSocket是否打开
 */
export const wsOpen = (ws) => !!ws && ws.readyState === WebSocket.OPEN;
/**
 * 通过WebSocket发送对象数据
 * @param {WebSocket} ws - WebSocket实例
 * @param {Object} obj - 要发送的对象
 */
export const wsSend = (ws, obj) => {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
};
/**
 * 格式化时间字符串
 * @param {string|Date} ts - 时间戳或日期对象
 * @returns {string} 格式化的时间字符串 (HH:MM)
 */
export const timeString = (ts) => {
  const d = ts ? new Date(ts) : new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
/**
 * 格式化字节数为可读字符串
 * @param {number} n - 字节数
 * @returns {string} 格式化的字节字符串
 */
export const fmtBytes = (n) => {
  if (!n || n <= 0) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0,
    v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10) + " " + u[i];
};
/**
 * 计算data URL的字节数
 * @param {string} s - data URL字符串
 * @returns {number} 字节数
 */
export const dataUrlBytes = (s) => {
  if (!s) return 0;
  const i = s.indexOf(",");
  if (i < 0) return 0;
  const l = s.length - i - 1;
  let pad = 0;
  if (s.endsWith("==")) pad = 2;
  else if (s.endsWith("=")) pad = 1;
  return Math.max(0, Math.floor((l * 3) / 4 - pad));
};
/**
 * UTF-8编码器实例
 */
const utf8Encoder = new TextEncoder();
/**
 * 计算字符串的UTF-8字节长度
 * @param {string} s - 输入字符串
 * @returns {number} UTF-8字节长度
 */
export const utf8ByteLength = (s) => utf8Encoder.encode(s).length;
/**
 * 安全地按代码单元切片字符串，避免截断代理对
 * @param {string} s - 输入字符串
 * @param {number} end - 结束位置
 * @returns {string} 切片后的字符串
 */
function safeSliceByCodeUnit(s, end) {
  if (end > 0) {
    const c = s.charCodeAt(end - 1);
    if (c >= 0xd800 && c <= 0xdbff) end -= 1;
  }
  return s.slice(0, end);
}
/**
 * 将字符串按UTF-8字节数截断到指定长度
 * @param {string} s - 输入字符串
 * @param {number} limit - 字节限制
 * @returns {string} 截断后的字符串
 */
export function trimUtf8ToBytes(s, limit) {
  if (utf8ByteLength(s) <= limit) return s;
  let lo = 0,
    hi = s.length;
  while (lo < hi) {
    const mid = ((lo + hi + 1) / 2) | 0;
    const chunk = s.slice(0, mid);
    if (utf8ByteLength(chunk) <= limit) lo = mid;
    else hi = mid - 1;
  }
  return safeSliceByCodeUnit(s, lo);
}
/**
 * 为元素添加事件监听器
 * @param {string} id - 元素ID
 * @param {string} evt - 事件类型
 * @param {Function} fn - 事件处理函数
 * @returns {HTMLElement|null} 元素或null
 */
export const on = (id, evt, fn) => {
  const el = $(id);
  if (el) el.addEventListener(evt, fn);
  return el;
};
/**
 * 应用主题样式
 * @param {string} theme - 主题名称 ('light' 或 'dark')
 * @param {Object} labels - 主题标签对象
 */
export function applyTheme(theme, labels) {
  const dark = theme === "dark";
  document.body.classList.toggle("theme-dark", dark);
  const btn = $("themeToggleBtn");
  if (btn) {
    if (labels && labels.themeLight && labels.themeDark) {
      btn.title = dark ? labels.themeLight : labels.themeDark;
    }
    btn.setAttribute("aria-checked", dark ? "true" : "false");
  }
}
/**
 * 获取当前主题
 * @returns {string} 主题名称
 */
export function getTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "light";
  } catch (_) {
    return "light";
  }
}
/**
 * 设置主题
 * @param {string} theme - 主题名称
 * @param {Object} labels - 主题标签对象
 */
export function setTheme(theme, labels) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (_) {}
  applyTheme(theme, labels);
}
/**
 * 验证名称是否有效
 * @param {string} name - 要验证的名称
 * @returns {boolean} 名称是否有效
 */
export function validName(name) {
  try {
    if (typeof name !== "string") return false;
    const re = new RegExp(NAME_PATTERN);
    return re.test(name);
  } catch (_) {
    return false;
  }
}
