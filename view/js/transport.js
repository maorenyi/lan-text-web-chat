/**
 * transport.js - WebSocket传输层模块
 * 此文件实现WebSocket连接管理，包括大厅连接、房间连接、自动重连、消息发送等。
 * 处理连接状态、错误处理和事件分发，为应用程序提供可靠的网络通信。
 */
import { wsUrl, wsOpen, wsSend } from "./utils.js";
// 重连基础延迟毫秒数
const RETRY_BASE_MS = 1000;
// 重连最大延迟毫秒数
const RETRY_MAX_MS = 8000;
/**
 * WebSocket传输管理类
 * 负责管理大厅和房间的WebSocket连接，处理自动重连和消息传递
 */
export class Transport {
  /**
   * 构造函数
   * @param {Function} getUsername - 获取用户名的函数
   * @param {Object} handlers - 事件处理器对象
   */
  constructor(getUsername, handlers = {}) {
    this.getUsername = getUsername;
    this.handlers = handlers;
    this.lobbyWs = null;
    this.roomWs = null;
    this.currentRoom = "";
    this._lobbyRetry = RETRY_BASE_MS;
    this._roomRetry = RETRY_BASE_MS;
    this._lobbyTimer = null;
    this._roomTimer = null;
    this._roomManualClose = false;
  }
  /**
   * 添加事件处理器
   * @param {string} evt - 事件名
   * @param {Function} fn - 事件处理函数
   * @returns {Transport} 返回自身以支持链式调用
   */
  on(evt, fn) {
    this.handlers[evt] = fn;
    return this;
  }
  /**
   * 触发事件
   * @param {string} evt - 事件名
   * @param {...*} args - 事件参数
   * @private
   */
  _emit(evt, ...args) {
    if (typeof this.handlers[evt] === "function") this.handlers[evt](...args);
  }
  /**
   * 连接到大厅
   */
  connectLobby() {
    if (wsOpen(this.lobbyWs)) return;
    this._clearLobbyTimer();
    this._openLobbySocket();
  }
  /**
   * 连接到房间
   * @param {string} roomId - 房间ID
   */
  connectRoom(roomId) {
    if (!this.getUsername()) return;
    if (wsOpen(this.roomWs)) {
      if (this.currentRoom === roomId) return;
      this._roomManualClose = true;
      this.roomWs.close();
      this.currentRoom = roomId;
      return;
    }
    this.currentRoom = roomId;
    this._emit("roomSwitch", roomId);
    this._clearRoomTimer();
    this._openRoomSocket(roomId);
  }
  /**
   * 加入房间
   * @param {string} roomId - 房间ID
   */
  joinRoom(roomId) {
    if (!roomId) return;
    this.connectRoom(roomId);
  }
  /**
   * 请求创建房间
   * @param {string} room - 房间名
   */
  requestCreate(room) {
    if (!wsOpen(this.lobbyWs)) this.connectLobby();
    const sock = this.lobbyWs;
    if (wsOpen(sock)) wsSend(sock, { type: "create", room });
    else if (sock) {
      const onOpen = () => {
        sock.removeEventListener("open", onOpen);
        wsSend(sock, { type: "create", room });
      };
      sock.addEventListener("open", onOpen);
    }
  }
  /**
   * 发送消息
   * @param {Object} payload - 消息负载
   */
  send(payload) {
    if (wsOpen(this.roomWs)) wsSend(this.roomWs, payload);
    else this._emit("sendFail");
  }
  /**
   * 打开大厅WebSocket连接
   * @private
   */
  _openLobbySocket() {
    this.lobbyWs = new WebSocket(wsUrl("/ws/lobby"));
    this.lobbyWs.addEventListener("open", () => {
      // 重置重连延迟
      this._lobbyRetry = RETRY_BASE_MS;
      this._emitConnection("lobby", "connected");
    });
    this.lobbyWs.addEventListener("message", (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.type === "error") {
          this._emit("error", m);
          return;
        }
        if (m.type === "rooms") {
          // 更新房间列表
          this._emit("rooms", m.list || []);
          return;
        }
        if (m.type === "created" && m.room) {
          // 房间创建成功，连接到新房间
          this.connectRoom(m.room);
          return;
        }
      } catch (_) {}
    });
    this.lobbyWs.addEventListener("close", () => {
      this.lobbyWs = null;
      this._scheduleLobbyReconnect();
    });
  }
  /**
   * 打开房间WebSocket连接
   * @param {string} roomId - 房间ID
   * @private
   */
  _openRoomSocket(roomId) {
    this.roomWs = new WebSocket(
      wsUrl(`/ws/room/${encodeURIComponent(roomId)}`)
    );
    this.roomWs.addEventListener("open", () => {
      // 重置重连延迟
      this._roomRetry = RETRY_BASE_MS;
      const username = this.getUsername();
      if (username) {
        // 发送用户名进行身份验证
        wsSend(this.roomWs, { username });
        this._emit("opened", roomId);
        this._emitConnection("room", "connected", { roomId });
      } else {
        // 没有用户名则关闭连接
        this.roomWs.close();
      }
    });
    this.roomWs.addEventListener("message", (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.type === "error") {
          this._emit("error", m);
          return;
        }
        if (m.type === "users") {
          // 更新用户列表
          this._emit("users", m.list || []);
          return;
        }
        // 转发消息到上层
        this._emit("message", m);
      } catch (_) {}
    });
    this.roomWs.addEventListener("close", (ev) => {
      this.roomWs = null;
      this._emit("closed");
      if (ev && typeof ev.code === "number") {
        // 处理特定的关闭代码
        if (ev.code === 1008)
          this._emit("error", {
            code: "ws_closed_1008",
            text: ev.reason || "",
          });
        else if (ev.code === 1009)
          this._emit("error", {
            code: "ws_closed_1009",
            text: ev.reason || "",
          });
      }
      const manual = this._roomManualClose;
      this._roomManualClose = false;
      if (manual && this.currentRoom) {
        // 手动关闭后重新连接
        this._emit("roomSwitch", this.currentRoom);
        this._clearRoomTimer();
        this._openRoomSocket(this.currentRoom);
        return;
      }
      const shouldRetry =
        !manual && (!ev || (ev.code !== 1008 && ev.code !== 1009));
      if (shouldRetry && this.currentRoom) {
        this._scheduleRoomReconnect(this.currentRoom);
      }
    });
  }
  /**
   * 调度大厅重连
   * @private
   */
  _scheduleLobbyReconnect() {
    if (this._lobbyTimer || wsOpen(this.lobbyWs)) return;
    this._emitConnection("lobby", "reconnecting", { delay: this._lobbyRetry });
    this._lobbyTimer = setTimeout(() => {
      this._lobbyTimer = null;
      this._lobbyRetry = Math.min(this._lobbyRetry * 2, RETRY_MAX_MS);
      this._openLobbySocket();
    }, this._lobbyRetry);
  }
  /**
   * 调度房间重连
   * @param {string} roomId - 房间ID
   * @private
   */
  _scheduleRoomReconnect(roomId) {
    if (this._roomTimer || wsOpen(this.roomWs) || !roomId) return;
    this._emitConnection("room", "reconnecting", {
      delay: this._roomRetry,
      roomId,
    });
    this._roomTimer = setTimeout(() => {
      this._roomTimer = null;
      this._roomRetry = Math.min(this._roomRetry * 2, RETRY_MAX_MS);
      if (this.getUsername()) {
        this._openRoomSocket(roomId);
      }
    }, this._roomRetry);
  }
  /**
   * 清除大厅重连定时器
   * @private
   */
  _clearLobbyTimer() {
    if (this._lobbyTimer) {
      clearTimeout(this._lobbyTimer);
      this._lobbyTimer = null;
    }
  }
  /**
   * 清除房间重连定时器
   * @private
   */
  _clearRoomTimer() {
    if (this._roomTimer) {
      clearTimeout(this._roomTimer);
      this._roomTimer = null;
    }
  }
  /**
   * 触发连接事件
   * @param {string} scope - 连接范围 ('lobby' 或 'room')
   * @param {string} state - 连接状态
   * @param {Object} payload - 额外负载
   * @private
   */
  _emitConnection(scope, state, payload = {}) {
    this._emit("connection", { scope, state, ...payload });
  }
}
