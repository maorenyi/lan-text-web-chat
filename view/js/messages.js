/**
 * messages.js - 消息处理和显示模块
 * 此文件负责消息的显示、进度条管理、文件预览和自动调整文本区域大小。
 * 处理文本消息、文件消息、状态消息的渲染，以及新消息提示功能。
 */
import { $, fmtBytes, timeString, dataUrlBytes, isoNow } from "./utils.js";
// 进度条隐藏定时器
let progressHideTimer = null;
// 新消息计数
let newMsgCount = 0;
/**
 * 确保进度条元素存在，如果不存在则创建
 * @returns {HTMLElement|null} 进度条元素或null
 */
function ensureProgress() {
  let box = $("uploadProgress");
  if (!box) {
    const controls = document.querySelector(".chat-controls");
    if (!controls) return null;
    box = document.createElement("div");
    box.id = "uploadProgress";
    box.className = "upload-progress";
    const track = document.createElement("div");
    track.className = "track";
    const bar = document.createElement("div");
    bar.className = "bar";
    track.appendChild(bar);
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = "0%";
    box.appendChild(track);
    box.appendChild(label);
    controls.appendChild(box);
  }
  return box;
}
/**
 * 设置进度条显示
 * @param {number} pct - 进度百分比 (0-100)
 * @param {string} text - 显示文本
 */
export function setProgress(pct, text) {
  const box = ensureProgress();
  if (!box) return;
  clearProgressTimer();
  const bar = box.querySelector(".bar");
  const label = box.querySelector(".label");
  const v = Math.max(0, Math.min(100, pct | 0));
  if (bar) bar.style.width = v + "%";
  if (label)
    label.textContent =
      typeof text === "string" && text.length ? text : v + "%";
  box.style.display = "inline-flex";
}
/**
 * 隐藏进度条
 * @param {number} delay - 延迟毫秒数
 * @param {string} finalText - 最终显示文本
 */
export function hideProgress(delay = 600, finalText) {
  const box = $("uploadProgress");
  if (!box) return;
  const bar = box.querySelector(".bar");
  const label = box.querySelector(".label");
  if (typeof finalText === "string" && label) label.textContent = finalText;
  clearProgressTimer();
  progressHideTimer = setTimeout(() => {
    if (!box) return;
    box.style.display = "none";
    if (bar) bar.style.width = "0%";
    if (label) label.textContent = "0%";
    progressHideTimer = null;
  }, delay);
}
/**
 * 清除进度条隐藏定时器
 */
function clearProgressTimer() {
  if (progressHideTimer) {
    clearTimeout(progressHideTimer);
    progressHideTimer = null;
  }
}
/**
 * 将base64字符串转换为UTF-8字符串
 * @param {string} b64 - base64编码字符串
 * @returns {string} UTF-8字符串
 */
function base64ToUtf8(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}
/**
 * 根据MIME类型创建媒体元素
 * @param {string} mime - MIME类型
 * @param {string} data - 数据URL
 * @returns {HTMLElement|null} 媒体元素或null
 */
function createMediaElement(mime, data) {
  const m = (mime || "").toLowerCase();
  if (m.startsWith("image/")) {
    const img = document.createElement("img");
    img.className = "chat-image";
    img.src = data;
    return img;
  }
  if (m.startsWith("video/")) {
    const v = document.createElement("video");
    v.className = "chat-media";
    v.src = data;
    v.controls = true;
    return v;
  }
  if (m.startsWith("audio/")) {
    const a = document.createElement("audio");
    a.className = "chat-media";
    a.src = data;
    a.controls = true;
    return a;
  }
  return null;
}
/**
 * 将消息节点添加到容器中
 * @param {HTMLElement} container - 消息容器
 * @param {HTMLElement} node - 消息节点
 */
function appendMessage(container, node) {
  const tip = document.getElementById("newMsgTip");
  if (tip) {
    // 将新消息插入到新消息提示之前
    container.insertBefore(node, tip);
  } else {
    container.appendChild(node);
  }
}
/**
 * 显示新消息提示
 */
function showNewMsgTip() {
  const tip = document.getElementById("newMsgTip");
  if (!tip) return;
  newMsgCount += 1;
  const label = tip.querySelector(".new-msg-tip-label");
  if (label) {
    // 根据新消息数量更新提示文本
    label.textContent =
      newMsgCount === 1 ? "new 新消息" : `new 新消息(${newMsgCount})`;
  }
  tip.style.display = "inline-flex";
}
/**
 * 隐藏新消息提示
 */
export function hideNewMsgTip() {
  const tip = document.getElementById("newMsgTip");
  if (!tip) return;
  newMsgCount = 0;
  tip.style.display = "none";
  const label = tip.querySelector(".new-msg-tip-label");
  if (label) label.textContent = "new 新消息";
}
/**
 * 添加消息到界面
 * @param {Object} m - 消息对象
 * @param {string} currentUsername - 当前用户名
 */
export function addMessage(m, currentUsername) {
  const el = $("messages");
  const threshold = 24;
  // 检查用户是否滚动到底部
  const wasAtBottom =
    el && el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
  const node =
    m.type === "status"
      ? buildStatusMessageNode(m)
      : buildChatMessageNode(m, currentUsername);
  appendMessage(el, node);
  if (wasAtBottom) {
    // 如果用户在底部，自动滚动到最新消息
    el.scrollTop = el.scrollHeight;
    hideNewMsgTip();
  } else {
    // 否则显示新消息提示
    showNewMsgTip();
  }
}
/**
 * 构建状态消息节点
 * @param {Object} m - 消息对象
 * @returns {HTMLElement} 状态消息节点
 */
function buildStatusMessageNode(m) {
  const div = document.createElement("div");
  div.className = "message status";
  div.textContent = m.text;
  div.appendChild(buildTimestampNode(m.ts));
  return div;
}
/**
 * 构建聊天消息节点
 * @param {Object} m - 消息对象
 * @param {string} currentUsername - 当前用户名
 * @returns {HTMLElement} 聊天消息节点
 */
function buildChatMessageNode(m, currentUsername) {
  const div = document.createElement("div");
  const isMe = m.username && currentUsername && m.username === currentUsername;
  // 根据消息类型和是否为自己发送设置CSS类
  div.className = "message " + (m.type || "text") + (isMe ? " me" : " other");
  if (m.username && !isMe) {
    // 为他人消息添加用户名显示
    const who = document.createElement("div");
    who.className = "who";
    who.textContent = m.username;
    div.appendChild(who);
  }
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (m.type === "text") {
    bubble.textContent = m.text;
  } else if (m.type === "file") {
    buildFileBubble(bubble, div, m);
  }
  bubble.appendChild(buildTimestampNode(m.ts));
  div.appendChild(bubble);
  return div;
}
/**
 * 构建时间戳节点
 * @param {string} ts - 时间戳
 * @returns {HTMLElement} 时间戳节点
 */
function buildTimestampNode(ts) {
  const node = document.createElement("div");
  node.className = "timestamp";
  node.textContent = timeString(ts);
  return node;
}
/**
 * 构建文件消息气泡
 * @param {HTMLElement} bubble - 气泡元素
 * @param {HTMLElement} container - 容器元素
 * @param {Object} m - 消息对象
 */
function buildFileBubble(bubble, container, m) {
  if (m.name) {
    // 显示文件名
    const fn = document.createElement("div");
    fn.className = "file-name";
    fn.textContent = m.name;
    bubble.appendChild(fn);
  }
  const mime = m.mime || "";
  const mediaEl = createMediaElement(mime, m.data);
  if (mediaEl) {
    // 根据媒体类型添加CSS类
    const lower = mime.toLowerCase();
    if (lower.startsWith("image/")) container.classList.add("file-image");
    if (lower.startsWith("video/")) container.classList.add("file-video");
    if (lower.startsWith("audio/")) container.classList.add("file-audio");
    bubble.appendChild(mediaEl);
    return;
  }
  if (mime === "text/plain" && m.data && m.data.startsWith("data:")) {
    try {
      const comma = m.data.indexOf(",");
      if (comma > -1) {
        const raw = base64ToUtf8(m.data.slice(comma + 1));
        // 显示文本文件预览
        const pre = document.createElement("div");
        pre.className = "file-preview-text";
        pre.textContent = raw.length > 400 ? raw.slice(0, 400) + "..." : raw;
        bubble.appendChild(pre);
        return;
      }
    } catch (_) {}
  }
  // 创建下载链接
  const a = document.createElement("a");
  a.className = "file-download";
  a.href = m.data;
  a.download = m.name || "download";
  const icon = document.createElement("span");
  icon.className = "icon icon-mask";
  icon.setAttribute("data-icon", "download");
  icon.setAttribute("aria-hidden", "true");
  a.appendChild(icon);
  const sizeVal = typeof m.size === "number" ? m.size : dataUrlBytes(m.data);
  a.appendChild(document.createTextNode(`下载文件(${fmtBytes(sizeVal)})`));
  bubble.appendChild(a);
}
/**
 * 显示状态消息
 * @param {string} text - 消息文本
 * @param {string} currentUsername - 当前用户名
 */
export function statusMessage(text, currentUsername) {
  return addMessage({ type: "status", text, ts: isoNow() }, currentUsername);
}
/**
 * 自动调整文本区域大小
 */
export function autoResizeTextarea() {
  const ta = $("messageInput");
  if (!ta) return;
  ta.style.height = "auto";
  ta.style.height = ta.scrollHeight + "px";
}
