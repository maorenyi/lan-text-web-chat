/**
 * init.js - 应用初始化模块
 * 此文件负责应用程序的启动和初始化逻辑。
 * 处理配置获取、约束应用、主题设置等。
 */
import { applyServerConfig, TEXT } from "./config.js";
import { applyTheme, getTheme } from "./utils.js";
import { updateSendFileLabel, updateLeaveButton } from "./ui-panels.js";
import { loadSavedUsername } from "./user.js";
import { cleanupExpiredData } from "./storage.js";
import { setUsername } from "./state.js";
import { statusMessage } from "./messages.js";
import { setupRoomCodeValidation } from "./events.js";
import { STORAGE_KEY_LAST_ROOM } from "./config.js";
/**
 * 初始化应用程序，设置主题、约束条件、事件监听器等
 * 这是应用程序启动时的主要入口函数
 * @param {Object} transport - Transport实例
 */
export function init(transport) {
  // 应用当前主题设置
  applyTheme(getTheme(), TEXT);
  // 更新发送文件按钮标签
  updateSendFileLabel();
  // 从服务器获取配置并应用约束条件
  fetch("/config")
    .then((r) => r.json())
    .then((cfg) => {
      // 应用服务器配置
      applyServerConfig(cfg);
      applyConstraints();
      // 初始化时清理过期数据
      setTimeout(() => {
        cleanupExpiredData();
      }, 1000); // 延迟1秒执行，避免影响页面加载
      // 设置定时清理，每12小时清理一次过期数据
      setInterval(() => {
        cleanupExpiredData();
      }, 12 * 60 * 60 * 1000); // 12小时
    })
    .catch(() => {
      // 如果获取配置失败，仍应用默认约束
      applyConstraints();
    });
  // 尝试从本地存储加载保存的用户名
  let saved = loadSavedUsername();
  const usernameInput = document.getElementById("username");
  if (saved) {
    // 如果有保存的用户名，设置并连接
    setUsername(saved);
    if (usernameInput) usernameInput.value = saved;
    transport.connectLobby();
    // 尝试连接上次房间，如果没有则连接大厅
    let lastRoom = null;
    try {
      lastRoom = localStorage.getItem(STORAGE_KEY_LAST_ROOM);
    } catch (_) {}
    if (lastRoom && lastRoom !== "lobby") {
      transport.connectRoom(lastRoom);
    } else {
      transport.connectRoom("lobby");
    }
  }
  // 如果没有用户名，显示提示
  if (!saved) {
    statusMessage(TEXT.enterUsername);
    if (usernameInput) usernameInput.focus();
  }
  // 更新离开按钮状态，初始为lobby
  updateLeaveButton("lobby", "lobby");
}
/**
 * 应用约束条件，包括文件大小限制
 * 设置验证逻辑
 */
function applyConstraints() {
  // 更新文件大小限制显示
  updateSendFileLabel();
  // 设置房间代码验证
  setupRoomCodeValidation();
  // 设置用户名和房间代码输入框的最大长度为10
  ["username", "roomCode"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute("maxlength", "10");
  });
}
