/**
 * panels.js - 面板管理模块
 * 此文件负责用户列表、房间列表、按钮状态等UI面板的渲染和更新。
 * 处理在线用户显示、房间列表展示、离开房间按钮状态等功能。
 */
import { $ } from "./utils.js";
import { allowedFileOriginalBytes } from "./config.js";
import { hideNewMsgTip } from "./messages.js";
/**
 * 渲染用户列表
 * @param {string[]} list - 用户名列表
 * @param {string} currentUsername - 当前用户名
 */
export function renderUserList(list, currentUsername) {
  const ul = $("onlineUsers");
  const header = document.querySelector(".user-list-header");
  if (header) header.textContent = `在线用户(${list.length})`;
  if (!ul) return;
  ul.innerHTML = "";
  const frag = document.createDocumentFragment();
  list.forEach((n) => {
    const li = document.createElement("li");
    li.textContent = n;
    // 为当前用户添加特殊样式
    if (n === currentUsername) li.classList.add("me");
    frag.appendChild(li);
  });
  ul.appendChild(frag);
}
/**
 * 渲染房间列表
 * @param {string[]} list - 房间名列表
 * @param {string} currentRoom - 当前房间名
 * @param {Function} onClick - 点击房间时的回调函数
 */
export function renderRoomList(list, currentRoom, onClick) {
  const ul = $("roomList");
  const headerTitle = document.querySelector(".room-list-title");
  if (headerTitle) headerTitle.textContent = `房间(${list.length})`;
  if (!ul) return;
  ul.innerHTML = "";
  const frag = document.createDocumentFragment();
  list.forEach((r) => {
    const li = document.createElement("li");
    li.textContent = r;
    // 为当前房间添加激活样式
    if (r === currentRoom) li.classList.add("active");
    // 绑定点击事件
    li.addEventListener("click", () => onClick && onClick(r));
    frag.appendChild(li);
  });
  ul.appendChild(frag);
}
/**
 * 更新离开房间按钮状态
 * @param {string} currentRoom - 当前房间名
 * @param {string} lobbyId - 大厅ID
 */
export function updateLeaveButton(currentRoom, lobbyId) {
  const btn = $("leaveRoomBtn");
  if (!btn) return;
  btn.style.display =
    currentRoom && currentRoom !== lobbyId ? "inline-flex" : "none";
}
/**
 * 更新发送文件按钮标签
 */
export function updateSendFileLabel() {
  const b = $("sendFileBtn");
  if (!b) return;
  const limitMB = Math.round(allowedFileOriginalBytes() / (1024 * 1024));
  const nodes = Array.from(b.childNodes);
  nodes.forEach((n) => {
    if (n.nodeType === 3 && n.textContent.trim().length > 0) b.removeChild(n);
  });
  b.appendChild(document.createTextNode(`发送文件(≤${limitMB}MB)`));
}
/**
 * 重置房间视图
 * @param {string} roomId - 房间ID
 * @param {string} lobbyId - 大厅ID
 * @param {string} currentUsername - 当前用户名
 * @param {Object} options - 选项对象
 * @param {boolean} options.clearMessages - 是否清除消息
 */
export function resetRoomView(
  roomId,
  lobbyId,
  currentUsername,
  { clearMessages = false } = {}
) {
  if (clearMessages) {
    const msg = $("messages");
    if (msg) {
      // 清除所有消息，但保留新消息提示
      Array.from(msg.children).forEach((child) => {
        if (child.id === "newMsgTip") return;
        if (child.classList && child.classList.contains("message")) {
          child.remove();
        }
      });
      hideNewMsgTip();
    }
  }
  // 重置用户列表为空
  renderUserList([], currentUsername);
  // 更新离开按钮状态
  updateLeaveButton(roomId, lobbyId);
}
