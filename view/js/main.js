/**
 * main.js - 应用程序主文件
 * 此文件是应用程序的核心逻辑，处理用户界面交互、WebSocket连接、消息发送和接收。
 * 管理用户名确认、房间连接、文件发送、主题切换等功能。
 * 协调各个模块之间的通信和状态管理。
 */
import {
  STORAGE_KEY,
  LOBBY_ROOM,
  MAX_MESSAGE_BYTES,
  allowedFileOriginalBytes,
  TEXT,
  applyServerConfig,
  errorText,
} from "./config.js";
import {
  $,
  fmtBytes,
  utf8ByteLength,
  trimUtf8ToBytes,
  wsSend,
  on,
  applyTheme,
  getTheme,
  setTheme,
  validName,
} from "./utils.js";
import {
  addMessage,
  hideNewMsgTip,
  setProgress,
  hideProgress,
  statusMessage,
  autoResizeTextarea,
} from "./messages.js";
import {
  renderUserList,
  renderRoomList,
  updateLeaveButton,
  updateSendFileLabel,
  resetRoomView,
} from "./panels.js";
import { Transport } from "./transport.js";
// 当前用户名，全局状态变量
let username = "";
// DOM元素缓存，用于提高查询性能
const domCache = {};
/**
 * 获取DOM元素，如果缓存中没有则从文档中查找并缓存
 * @param {string} id - 元素ID
 * @returns {HTMLElement|null} DOM元素或null
 */
const getEl = (id) => {
  if (!domCache[id]) domCache[id] = document.getElementById(id);
  return domCache[id];
};
/**
 * 刷新DOM元素缓存，重新从文档中查找元素
 * @param {string} id - 元素ID
 * @returns {HTMLElement|null} DOM元素或null
 */
const refreshEl = (id) => {
  domCache[id] = document.getElementById(id);
  return domCache[id];
};
/**
 * 将毫秒数转换为秒数，至少为1秒
 * @param {number} ms - 毫秒数
 * @returns {number} 秒数
 */
const secondsFromMs = (ms) => Math.max(1, Math.round((ms || 0) / 1000));
// 上次连接范围，用于管理连接状态显示
let lastConnectionScope = null;
/**
 * 显示连接状态信息
 * @param {string} text - 要显示的文本
 * @param {string} scope - 连接范围 ('lobby' 或 'room')
 */
function showConnectionStatus(text, scope) {
  const el = document.getElementById("connectionStatus");
  if (!el) return;
  if (
    scope === "lobby" ||
    !lastConnectionScope ||
    lastConnectionScope !== "lobby"
  ) {
    el.textContent = text;
    el.hidden = false;
    el.classList.add("is-visible");
    lastConnectionScope = scope;
  }
}
/**
 * 隐藏连接状态信息
 * @param {string} scope - 连接范围 ('lobby' 或 'room')
 */
function hideConnectionStatus(scope) {
  const el = document.getElementById("connectionStatus");
  if (!el) return;
  if (scope === lastConnectionScope) {
    el.textContent = "";
    el.hidden = true;
    el.classList.remove("is-visible");
    lastConnectionScope = null;
  }
}
/**
 * 处理连接状态变化事件
 * 根据事件状态显示或隐藏连接状态信息
 * @param {Object} evt - 连接事件对象，包含state、scope、delay等属性
 */
function handleConnectionEvent(evt) {
  if (!evt || !evt.state) return;
  // 如果正在重连，显示重连提示
  if (evt.state === "reconnecting") {
    const scope = evt.scope === "lobby" ? "lobby" : "room";
    showConnectionStatus(
      `${scope === "lobby" ? "大厅" : "房间"}连接中断，${secondsFromMs(
        evt.delay
      )}秒后重试...`,
      scope
    );
    return;
  }
  // 如果连接成功，隐藏状态信息
  if (evt.state === "connected") {
    hideConnectionStatus(evt.scope);
  }
}
/**
 * 确保用户名已设置，如果未设置则尝试自动确认或提示用户输入
 * @param {Object} options - 配置选项
 * @param {boolean} options.autoConfirm - 是否自动确认用户名（默认为true）
 * @returns {boolean} 如果用户名已设置返回true，否则返回false
 */
function ensureUsername({ autoConfirm = true } = {}) {
  // 如果用户名已存在，直接返回true
  if (username) return true;
  // 获取用户名输入框的值
  const el = getEl("username");
  const val = (el && el.value ? el.value : "").trim();
  // 如果启用自动确认且有值，则确认用户名
  if (autoConfirm && val) {
    confirmUsername();
    return true;
  }
  // 显示提示信息并聚焦输入框
  statusMessage(TEXT.enterUsername);
  if (el) el.focus();
  return false;
}
function getUsername() {
  return username;
}
function roomCodeValue() {
  const el = getEl("roomCode");
  return el ? el.value.trim() : "";
}
function isRoomOpen() {
  return (
    transport &&
    transport.roomWs &&
    transport.roomWs.readyState === WebSocket.OPEN
  );
}
// 创建Transport实例，配置各种事件处理器
const transport = new Transport(getUsername, {
  opened: (roomId) => {
    // 房间连接成功时显示加入消息
    statusMessage(TEXT.joined(roomId));
  },
  closed: () => {
    // 房间连接关闭时重置房间视图
    resetRoomView(transport.currentRoom, LOBBY_ROOM, username, {
      clearMessages: false,
    });
  },
  message: (m) => addMessage(m, username), // 收到消息时添加到界面
  users: (list) => renderUserList(list || [], username), // 更新用户列表
  rooms: (list) => {
    // 更新房间列表，并绑定点击事件
    renderRoomList(list, transport.currentRoom, (r) => transport.joinRoom(r));
  },
  roomSwitch: (roomId) => {
    // 切换房间时重置视图并清除消息
    resetRoomView(roomId, LOBBY_ROOM, username, { clearMessages: true });
    hideNewMsgTip();
  },
  sendFail: () => statusMessage(TEXT.sendFail), // 发送失败时显示提示
  error: (m) => {
    // 处理错误消息
    const msg =
      m && (m.text || m.code) ? m.text || errorText(m.code) : "发生错误";
    statusMessage(msg);
  },
  connection: handleConnectionEvent, // 处理连接状态变化
});
/**
 * 确认并设置用户名，执行验证并处理连接逻辑
 * 如果用户名有效且改变，则更新全局状态并连接到聊天系统
 */
function confirmUsername() {
  // 获取并清理用户名输入
  const input = getEl("username");
  const newName = input.value.trim();
  // 检查用户名是否为空
  if (!newName) {
    statusMessage(TEXT.enterUsername);
    try {
      input.focus();
    } catch (_) {}
  }
  // 检查用户名格式是否有效
  else if (!validName(newName)) {
    statusMessage(errorText("bad_username"));
    try {
      input.focus();
    } catch (_) {}
  }
  // 如果用户名改变，更新状态并连接
  else if (newName !== username) {
    username = newName;
    // 保存到本地存储
    try {
      localStorage.setItem(STORAGE_KEY, username);
    } catch (_) {}
    // 如果房间连接已打开，发送重命名消息
    if (
      transport &&
      transport.roomWs &&
      transport.roomWs.readyState === WebSocket.OPEN
    ) {
      wsSend(transport.roomWs, { type: "rename", username });
    } else {
      // 否则连接大厅和默认房间
      transport.connectLobby();
      transport.connectRoom(LOBBY_ROOM);
    }
  }
}
/**
 * 发送文本消息，执行验证并通过WebSocket发送
 * 检查用户名、连接状态、消息长度等条件
 */
function sendText() {
  // 获取消息输入框的值
  const input = getEl("messageInput");
  const v = input.value.trim();
  // 确保用户名已设置
  if (!ensureUsername({ autoConfirm: false })) return;
  // 检查房间连接是否打开
  if (!isRoomOpen()) {
    statusMessage(TEXT.sendFail);
    return;
  }
  // 检查消息是否为空
  if (!v) return;
  // 检查消息字节长度是否超过限制
  const bytes = utf8ByteLength(v);
  if (bytes > MAX_MESSAGE_BYTES) {
    statusMessage(TEXT.textTooLong(bytes, MAX_MESSAGE_BYTES, fmtBytes));
    return;
  }
  // 构建并发送消息
  const msg = { type: "text", text: v };
  transport.send(msg);
  // 延迟清除输入框，确保消息发送成功
  const clearIfOpen = () => {
    if (transport.roomWs && transport.roomWs.readyState === WebSocket.OPEN) {
      input.value = "";
      autoResizeTextarea();
      return true;
    }
    return false;
  };
  if (!clearIfOpen()) setTimeout(clearIfOpen, 400);
}
/**
 * 发送文件消息，使用FileReader读取文件并通过WebSocket发送
 * 执行文件大小验证和进度显示
 * @param {File} file - 要发送的文件对象
 */
function sendFile(file) {
  // 检查文件是否存在
  if (!file) return;
  // 确保用户名已设置
  if (!ensureUsername({ autoConfirm: false })) return;
  // 检查房间连接是否打开
  if (!isRoomOpen()) {
    statusMessage(TEXT.sendFail);
    return;
  }
  // 检查文件大小是否超过限制
  const allowed = allowedFileOriginalBytes();
  if (typeof file.size === "number" && file.size > allowed) {
    const maxMB = Math.round(allowed / (1024 * 1024));
    statusMessage(TEXT.fileTooLarge(maxMB));
    return;
  }
  // 创建FileReader实例
  const reader = new FileReader();
  // 开始读取时显示进度
  reader.onloadstart = () => setProgress(1, "1%...");
  // 读取进度更新
  reader.onprogress = (e) => {
    if (e && e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      setProgress(pct, pct + "%...");
    }
  };
  // 文件读取完成，构建消息并发送
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const msg = {
      type: "file",
      name: file.name,
      mime: file.type || "",
      size: typeof file.size === "number" ? file.size : undefined,
      data: dataUrl,
    };
    // 检查消息总大小是否超过限制
    const jsonBytes = utf8ByteLength(JSON.stringify(msg));
    if (jsonBytes > MAX_MESSAGE_BYTES) {
      hideProgress(1200, TEXT.exceedLimit);
      statusMessage(TEXT.msgTooLarge(jsonBytes, MAX_MESSAGE_BYTES, fmtBytes));
      return;
    }
    // 显示发送进度并发送消息
    setProgress(100, "发送中...");
    transport.send(msg);
    hideProgress(800);
  };
  // 读取失败时隐藏进度
  reader.onerror = () => {
    hideProgress(1200, TEXT.readFail);
  };
  // 开始读取文件为Data URL
  reader.readAsDataURL(file);
}
/**
 * 处理粘贴事件，检查剪贴板中是否有文件，如果有则发送文件
 * @param {ClipboardEvent} ev - 粘贴事件对象
 */
function handlePasteEvent(ev) {
  // 获取剪贴板数据项
  const items = ev.clipboardData && ev.clipboardData.items;
  if (!items) return;
  // 检查WebSocket连接状态
  const connected =
    transport &&
    transport.roomWs &&
    transport.roomWs.readyState === WebSocket.OPEN;
  // 遍历剪贴板项，查找文件
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it && it.kind === "file") {
      const file = it.getAsFile();
      if (file) {
        // 确保用户名已设置
        if (!ensureUsername({ autoConfirm: false })) return;
        // 检查连接状态
        if (!connected) {
          statusMessage(TEXT.sendFail);
          return;
        }
        // 阻止默认行为，发送文件
        ev.preventDefault();
        sendFile(file);
        setTimeout(autoResizeTextarea, 50);
        return;
      }
    }
  }
}
/**
 * 初始化应用程序，设置主题、约束条件、事件监听器等
 * 这是应用程序启动时的主要入口函数
 */
function init() {
  // 应用当前主题设置
  applyTheme(getTheme(), TEXT);
  // 更新发送文件按钮标签
  updateSendFileLabel();
  // 刷新消息输入框元素缓存
  const msgInputEl = refreshEl("messageInput");
  /**
   * 应用约束条件，包括最大长度和文件大小限制
   * 设置输入框的maxlength属性和验证逻辑
   */
  function applyConstraints() {
    // 设置消息输入框的最大长度
    const msgInputEl2 = getEl("messageInput");
    if (msgInputEl2)
      msgInputEl2.setAttribute("maxlength", String(MAX_MESSAGE_BYTES));
    // 更新文件大小限制显示
    updateSendFileLabel();
    // 设置房间代码验证
    setupRoomCodeValidation();
    // 设置用户名和房间代码输入框的最大长度为10
    ["username", "roomCode"].forEach((id) => {
      const el = $(id);
      if (el) el.setAttribute("maxlength", "10");
    });
  }
  // 从服务器获取配置并应用约束条件
  fetch("/config")
    .then((r) => r.json())
    .then((cfg) => {
      // 应用服务器配置
      applyServerConfig(cfg);
      applyConstraints();
    })
    .catch(() => {
      // 如果获取配置失败，仍应用默认约束
      applyConstraints();
    });
  // 尝试从本地存储加载保存的用户名
  let saved = "";
  try {
    saved = localStorage.getItem(STORAGE_KEY) || "";
  } catch (_) {}
  const usernameInput = refreshEl("username");
  if (saved) {
    // 如果有保存的用户名，设置并连接
    username = saved;
    if (usernameInput) usernameInput.value = saved;
    transport.connectLobby();
    transport.connectRoom(LOBBY_ROOM);
  }
  // 如果没有用户名，显示提示
  if (!username) {
    statusMessage(TEXT.enterUsername);
    if (usernameInput) usernameInput.focus();
  }
  // 设置事件监听器
  // 用户名输入框回车键确认
  on("username", "keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmUsername();
    }
  });
  // 确认用户名按钮点击
  on("confirmUsernameBtn", "click", () => {
    confirmUsername();
  });
  // 发送按钮点击
  on("sendBtn", "click", sendText);
  // 主题切换按钮设置
  const themeBtn = refreshEl("themeToggleBtn");
  if (themeBtn) {
    // 定义主题切换函数
    const toggle = () => {
      const next = getTheme() === "dark" ? "light" : "dark";
      setTheme(next, TEXT);
    };
    // 绑定点击和键盘事件
    themeBtn.addEventListener("click", toggle);
    themeBtn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  }
  // 消息输入框事件处理
  msgInputEl &&
    msgInputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        // Shift+Enter允许换行
        if (e.shiftKey) return;
        e.preventDefault();
        sendText();
      }
    });
  // 文件发送按钮设置
  const fileInput = refreshEl("fileInput");
  on("sendFileBtn", "click", () => {
    // 确保用户名已设置
    if (!ensureUsername({ autoConfirm: false })) return;
    fileInput && fileInput.click();
  });
  // 文件选择变化事件
  fileInput &&
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) sendFile(file);
      // 清空文件输入框，允许重复选择同一文件
      e.target.value = "";
    });
  // 粘贴事件处理，允许粘贴文件
  msgInputEl &&
    msgInputEl.addEventListener("paste", function (e) {
      handlePasteEvent(e);
      if (e.defaultPrevented) e.stopPropagation();
      setTimeout(autoResizeTextarea, 0);
    });
  // 输入事件处理，实时限制消息长度
  msgInputEl &&
    msgInputEl.addEventListener("input", function () {
      if (msgInputEl) {
        const bytes = utf8ByteLength(msgInputEl.value);
        if (bytes > MAX_MESSAGE_BYTES) {
          // 截断超出长度的内容
          msgInputEl.value = trimUtf8ToBytes(
            msgInputEl.value,
            MAX_MESSAGE_BYTES
          );
        }
      }
      // 自动调整文本框大小
      autoResizeTextarea();
    });
  // 初始调整文本框大小
  setTimeout(autoResizeTextarea, 0);
  // 创建房间按钮事件
  on("createRoomBtn", "click", () => {
    const roomName = roomCodeValue();
    // 确保用户名已设置
    if (!ensureUsername()) return;
    // 验证房间名称格式
    if (!validName(roomName)) {
      statusMessage(errorText("bad_room"));
      return;
    }
    // 连接大厅并请求创建房间
    transport.connectLobby();
    transport.requestCreate(roomName);
  });
  // 离开房间按钮设置
  const leaveBtn = refreshEl("leaveRoomBtn");
  if (leaveBtn)
    leaveBtn.addEventListener("click", () => transport.connectRoom(LOBBY_ROOM));
  // 更新离开按钮状态
  updateLeaveButton(transport.currentRoom, LOBBY_ROOM);
  // 消息容器滚动和新消息提示设置
  const messagesEl = refreshEl("messages");
  if (messagesEl) {
    // 添加新消息提示元素
    const tip = refreshEl("newMsgTip");
    if (tip) messagesEl.appendChild(tip);
    // 滚动事件处理，检测是否滚动到底部
    messagesEl.addEventListener("scroll", function () {
      const threshold = 24; // 底部阈值
      const atBottom =
        this.scrollTop + this.clientHeight >= this.scrollHeight - threshold;
      if (atBottom) hideNewMsgTip(); // 隐藏新消息提示
    });
    // 新消息提示点击事件，滚动到底部
    if (tip) {
      tip.addEventListener("click", () => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
        hideNewMsgTip();
      });
    }
  }
}
/**
 * 设置房间代码输入框的验证逻辑
 * 根据输入值实时更新输入框的样式（有效/无效）
 */
function setupRoomCodeValidation() {
  const input = $("roomCode");
  const btn = $("createRoomBtn");
  if (!input || !btn) return;
  // 定义验证应用函数
  const apply = () => {
    const v = roomCodeValue();
    const ok = validName(v);
    // 根据验证结果切换CSS类
    input.classList.toggle("invalid", !ok && v.length > 0);
  };
  // 绑定输入事件进行实时验证
  input.addEventListener("input", apply);
  // 初始应用验证
  apply();
}
init();
