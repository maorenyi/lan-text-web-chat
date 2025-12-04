/**
 * msg-renderer.js - 消息渲染模块
 * 此文件负责构建各种类型的消息节点，包括状态消息、聊天消息和文件消息。
 */
import { fmtBytes, timeString, dataUrlBytes } from "./utils.js";
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
 * 获取MIME类型的媒体类型
 * @param {string} mime - MIME类型
 * @returns {string|null} 媒体类型 ('image', 'video', 'audio') 或 null
 */
function getMediaType(mime) {
  const m = (mime || "").toLowerCase();
  const match = m.match(/^(image|video|audio)\//);
  return match ? match[1] : null;
}
/**
 * 创建文件下载按钮
 * @param {string} href - 下载链接
 * @param {string} filename - 文件名
 * @param {number} size - 文件大小
 * @returns {HTMLElement} 下载按钮元素
 */
function createDownloadButton(href, filename, size) {
  const a = document.createElement("a");
  a.className = "btn btn-download";
  a.href = href;
  a.download = filename || "download";
  const icon = document.createElement("span");
  icon.className = "icon icon-mask";
  icon.setAttribute("data-icon", "download");
  icon.setAttribute("aria-hidden", "true");
  a.appendChild(icon);
  a.appendChild(document.createTextNode(`下载文件(${fmtBytes(size)})`));
  return a;
}
/**
 * 创建过期文件占位符
 * @param {number} size - 文件大小
 * @returns {HTMLElement} 占位符元素
 */
function createExpiredPlaceholder(size) {
  const placeholder = document.createElement("div");
  placeholder.className = "btn btn-expired";
  const icon = document.createElement("span");
  icon.className = "icon icon-mask";
  icon.setAttribute("data-icon", "file");
  icon.setAttribute("aria-hidden", "true");
  placeholder.appendChild(icon);
  const sizeText = size > 0 ? `(${fmtBytes(size)})` : "";
  placeholder.appendChild(document.createTextNode(`已过期${sizeText}`));
  return placeholder;
}
/**
 * 创建文本文件预览
 * @param {string} content - 文件内容
 * @returns {HTMLElement} 预览元素
 */
// 文本预览
function createTextPreview(content) {
  const pre = document.createElement("div");
  pre.className = "file-preview-text";
  pre.textContent =
    content.length > 200 ? content.slice(0, 200) + "..." : content;
  return pre;
}
/**
 * 根据MIME类型创建媒体元素
 * @param {string} mime - MIME类型
 * @param {string} data - 数据URL
 * @returns {HTMLElement|null} 媒体元素或null
 */
function createMediaElement(mime, data) {
  const mediaType = getMediaType(mime);
  if (!mediaType) return null;
  const el = document.createElement(mediaType === "image" ? "img" : mediaType);
  el.className = mediaType === "image" ? "chat-image" : "chat-media";
  el.src = data;
  if (mediaType !== "image") {
    el.controls = true;
  }
  return el;
}
/**
 * 将消息节点添加到容器中
 * @param {HTMLElement} container - 消息容器
 * @param {HTMLElement} node - 消息节点
 */
export function appendMessage(container, node) {
  const tip = document.getElementById("newMsgTip");
  if (tip) {
    // 将新消息插入到新消息提示之前
    container.insertBefore(node, tip);
  } else {
    container.appendChild(node);
  }
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
 * 构建状态消息节点
 * @param {Object} m - 消息对象
 * @returns {HTMLElement} 状态消息节点
 */
export function buildStatusMessageNode(m) {
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
export function buildChatMessageNode(m, currentUsername) {
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
 * 构建文件消息气泡
 * @param {HTMLElement} bubble - 气泡元素
 * @param {HTMLElement} container - 容器元素
 * @param {Object} m - 消息对象
 */
function buildFileBubble(bubble, container, m) {
  // 添加文件名（如果有）
  if (m.name) {
    const fn = document.createElement("div");
    fn.className = "file-name";
    fn.textContent = m.name;
    bubble.appendChild(fn);
  }
  const mime = m.mime || "";
  const hasData = m.data && m.data.startsWith("data:");
  if (!hasData) {
    // 无数据时显示过期占位符
    const sizeVal = typeof m.size === "number" ? m.size : 0;
    bubble.appendChild(createExpiredPlaceholder(sizeVal));
    return;
  }
  // 有数据时根据类型处理
  const mediaEl = createMediaElement(mime, m.data);
  if (mediaEl) {
    // 媒体文件：添加CSS类并显示
    const mediaType = getMediaType(mime);
    if (mediaType) container.classList.add(`file-${mediaType}`);
    bubble.appendChild(mediaEl);
    return;
  }
  if (mime === "text/plain") {
    // 文本文件：尝试显示预览并加下载按钮
    try {
      const comma = m.data.indexOf(",");
      if (comma > -1) {
        const raw = base64ToUtf8(m.data.slice(comma + 1));
        // 先插入文本预览
        bubble.appendChild(createTextPreview(raw));
        // 再插入下载按钮（在 timestamp 之前）
        const btn = createDownloadButton(
          m.data,
          m.name,
          typeof m.size === "number" ? m.size : dataUrlBytes(m.data)
        );
        btn.style.marginTop = "5px";
        bubble.appendChild(btn);
        return;
      }
    } catch (_) {}
  }
  // 其他文件：显示下载按钮
  const sizeVal = typeof m.size === "number" ? m.size : dataUrlBytes(m.data);
  bubble.appendChild(createDownloadButton(m.data, m.name, sizeVal));
}
