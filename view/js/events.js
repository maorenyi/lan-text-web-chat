/**
 * events.js - UI事件处理模块
 * 此文件负责设置和处理各种UI事件监听器。
 * 包括按钮点击、键盘事件、文件选择等。
 */
import { LOBBY_ROOM, TEXT, errorText, MAX_MESSAGE_BYTES } from "./config.js";
import {
  $,
  on,
  getTheme,
  setTheme,
  utf8ByteLength,
  trimUtf8ToBytes,
  validName,
} from "./utils.js";
import {
  autoResizeTextarea,
  hideNewMsgTip,
  statusMessage,
} from "./messages.js";
import { ensureUsername } from "./user.js";
import { roomCodeValue } from "./room.js";
import { sendText, sendFile, handlePasteEvent } from "./sender.js";
import { setIsCreatingRoom } from "./state.js";
/**
 * 初始化所有UI事件监听器
 * @param {Object} transport - Transport实例
 */
export function initUIEvents(transport) {
  // 发送按钮点击
  on("sendBtn", "click", () => sendText(transport));
  // 主题切换按钮设置
  initThemeToggle();
  // 文件发送相关事件
  initFileEvents(transport);
  // 消息输入框事件
  initMessageInputEvents(transport);
  // 创建房间相关事件
  initRoomEvents(transport);
  // 消息容器滚动和新消息提示事件
  initMessageContainerEvents();
  // 离开房间按钮事件
  initLeaveRoomEvent(transport);
}
/**
 * 初始化主题切换功能
 */
function initThemeToggle() {
  const themeBtn = $("themeToggleBtn");
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
}
/**
 * 初始化文件发送相关事件
 * @param {Object} transport - Transport实例
 */
function initFileEvents(transport) {
  const fileInput = $("fileInput");
  on("sendFileBtn", "click", () => {
    // 确保用户名已设置
    if (!ensureUsername({ autoConfirm: false, transport })) return;
    fileInput && fileInput.click();
  });
  // 文件选择变化事件
  fileInput &&
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) sendFile(file, transport);
      // 清空文件输入框，允许重复选择同一文件
      e.target.value = "";
    });
}
/**
 * 初始化消息输入框事件
 * @param {Object} transport - Transport实例
 */
function initMessageInputEvents(transport) {
  const msgInputEl = $("messageInput");
  if (!msgInputEl) return;
  // 键盘事件处理
  msgInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      // Shift+Enter允许换行
      if (e.shiftKey) return;
      e.preventDefault();
      sendText(transport);
    }
  });
  // 粘贴事件处理，允许粘贴文件
  msgInputEl.addEventListener("paste", function (e) {
    handlePasteEvent(e, transport);
    if (e.defaultPrevented) e.stopPropagation();
    setTimeout(autoResizeTextarea, 0);
  });
  // 输入事件处理，实时限制消息长度
  msgInputEl.addEventListener("input", function () {
    const bytes = utf8ByteLength(msgInputEl.value);
    if (bytes > MAX_MESSAGE_BYTES) {
      // 截断超出长度的内容
      msgInputEl.value = trimUtf8ToBytes(msgInputEl.value, MAX_MESSAGE_BYTES);
    }
    // 自动调整文本框大小
    autoResizeTextarea();
  });
}
/**
 * 初始化房间相关事件
 * @param {Object} transport - Transport实例
 */
function initRoomEvents(transport) {
  // 创建房间按钮事件
  on("createRoomBtn", "click", () => {
    const roomName = roomCodeValue();
    // 确保用户名已设置
    if (!ensureUsername({ transport })) return;
    // 验证房间名称格式
    if (!validName(roomName)) {
      statusMessage(errorText("bad_room"));
      return;
    }
    // 设置正在创建房间的标志
    setIsCreatingRoom(true);
    // 连接大厅并请求创建房间
    transport.connectLobby();
    transport.requestCreate(roomName);
    // 清空房间名输入框
    const input = $("roomCode");
    if (input) input.value = "";
    // 创建请求发送后，让输入框失焦避免多次触发
    setTimeout(() => {
      if (input) input.blur();
    }, 0);
  });
}
/**
 * 初始化消息容器事件
 */
function initMessageContainerEvents() {
  const messagesEl = $("messages");
  if (!messagesEl) return;

  // 滚动事件处理，检测是否滚动到底部
  messagesEl.addEventListener("scroll", function () {
    const threshold = 24; // 底部阈值
    const atBottom =
      this.scrollTop + this.clientHeight >= this.scrollHeight - threshold;
    if (atBottom) hideNewMsgTip(); // 隐藏新消息提示
  });

  // 新消息提示点击事件
  const tip = $("newMsgTip");
  if (tip) {
    tip.addEventListener("click", () => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
      hideNewMsgTip();
    });
  }
}
/**
 * 初始化离开房间按钮事件
 * @param {Object} transport - Transport实例
 */
function initLeaveRoomEvent(transport) {
  const leaveBtn = $("leaveRoomBtn");
  if (leaveBtn)
    leaveBtn.addEventListener("click", () => transport.connectRoom(LOBBY_ROOM));
}
/**
 * 设置房间代码输入框的验证逻辑
 * 根据输入值实时更新输入框的样式（有效/无效）
 */
export function setupRoomCodeValidation() {
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
  // 绑定回车键事件，触发创建房间
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btn.click();
    }
  });
  // 初始应用验证
  apply();
}
