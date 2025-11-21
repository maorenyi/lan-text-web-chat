/**
 * main.js - 应用程序主协调器
 * 此文件是应用程序的核心协调器，负责导入各个模块并启动应用。
 * 管理Transport实例和各个模块之间的通信。
 */
import { STORAGE_MAX_AGE_DAYS, LOBBY_ROOM, TEXT, errorText, STORAGE_KEY_LAST_ROOM } from "./config.js";
import { addMessage, statusMessage } from "./messages.js";
import { renderUserList, renderRoomList } from "./ui-panels.js";
import { Transport } from "./transport.js";
import { cleanupExpiredData, cleanupNonExistentRooms } from "./storage.js";
// 导入状态管理
import {
  getUsername,
  addCurrentRoomMessage,
  setExistingRooms,
  getExistingRooms,
} from "./state.js";
// 导入各个功能模块
import { initUserEvents } from "./user.js";
import {
  loadRoomHistory,
  saveCurrentRoomMessages,
  addMessageToCurrentRoom,
  handleRoomSwitch,
} from "./room.js";
import { resetRoomView } from "./ui-panels.js";
import { handleConnectionEvent } from "./state.js";
import { initUIEvents, setupRoomCodeValidation } from "./events.js";
import { init } from "./init.js";
// 创建Transport实例，配置各种事件处理器
const transport = new Transport(getUsername, {
  opened: (roomId) => {
    // 先加载房间的历史消息
    loadRoomHistory(roomId);
    // 创建加入消息并显示
    const joinMessage = {
      type: "status",
      text: TEXT.joined(roomId),
      ts: new Date().toISOString(),
    };
    statusMessage(joinMessage.text);
    // 将加入消息添加到当前房间消息历史并保存
    addMessageToCurrentRoom(joinMessage, roomId);
  },
  closed: () => {
    // 房间连接关闭时重置房间视图
    resetRoomView(transport.currentRoom, LOBBY_ROOM, getUsername());
  },
  message: (m) => {
    // 处理房间切换消息
    if (m.type === "roomSwitch") {
      transport.currentRoom = m.room;
      try {
        localStorage.setItem(STORAGE_KEY_LAST_ROOM, m.room);
      } catch (_) {}
      if (typeof transport.handlers["roomSwitch"] === "function") {
        transport.handlers["roomSwitch"](m.room);
      }
      return;
    }
    // 只处理聊天消息（文本、文件、状态）
    if (m.type === "text" || m.type === "file" || m.type === "status") {
      // 收到服务器回显的消息时显示
      addMessage(m, getUsername());
      // 添加到当前房间消息历史
      addCurrentRoomMessage(m);
      // 保存到localStorage（内部会过滤和处理消息）
      try {
        saveCurrentRoomMessages(transport.currentRoom);
      } catch (error) {
        if (error.name === "QuotaExceededError") {
          // 存储空间不足，进行渐进式清理策略
          console.warn("存储空间不足，开始渐进式清理策略");
          // 1. 清理不存在的房间数据
          try {
            cleanupNonExistentRooms(getExistingRooms(), transport.currentRoom);
            // 重新尝试保存
            try {
              saveCurrentRoomMessages(transport.currentRoom);
              return;
            } catch (retryError) {
              // 仍然失败，继续下一级清理
            }
          } catch (cleanupError) {
            console.warn("清理不存在房间数据失败:", cleanupError);
          }
          // 2. 渐进式清理过期数据，从1/2最大年龄开始，每次减半
          let ageDivider = 2; // 从1/2开始
          let success = false;
          while (!success && ageDivider <= 128) {
            // 最多尝试到1/128，避免无限循环
            try {
              const maxAge = STORAGE_MAX_AGE_DAYS / ageDivider;
              cleanupExpiredData(maxAge);
              console.log(`清理超过 ${maxAge} 天的过期数据`);
              // 重新尝试保存
              try {
                saveCurrentRoomMessages(transport.currentRoom);
                success = true;
                console.log(`清理到 ${maxAge} 天后保存成功`);
              } catch (retryError) {
                // 仍然失败，继续减小年龄限制
                ageDivider *= 2; // 减半年龄限制
              }
            } catch (cleanupError) {
              console.warn(
                `清理 ${STORAGE_MAX_AGE_DAYS / ageDivider} 天过期数据失败:`,
                cleanupError
              );
              ageDivider *= 2; // 减半年龄限制
            }
          }
          // 如果所有清理都失败，记录错误但不清空当前房间数据
          if (!success) {
            console.warn("所有清理策略都失败，无法保存消息");
          }
        }
      }
    }
  },
  users: (list) => renderUserList(list || [], getUsername()), // 更新用户列表
  rooms: (list) => {
    // 更新存在的房间列表
    setExistingRooms([LOBBY_ROOM, ...list]);
    // 清理不存在的房间数据
    cleanupNonExistentRooms(getExistingRooms(), transport.currentRoom);
    // 更新房间列表显示，并绑定点击事件
    renderRoomList(list, transport.currentRoom, (r) => transport.joinRoom(r));
  },
  roomSwitch: (roomId) => {
    // 切换房间时清除当前消息并重新渲染新房间的历史消息
    handleRoomSwitch(roomId);
    // 更新房间列表高亮
    renderRoomList(getExistingRooms().filter(r => r !== LOBBY_ROOM), transport.currentRoom, (r) => transport.joinRoom(r));
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
// 启动应用程序
init(transport);
initUserEvents(transport);
initUIEvents(transport);
setupRoomCodeValidation();
