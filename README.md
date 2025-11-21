# 💬 局域网文字聊天 web 应用

![light](screenshots/light.png)
![dark](screenshots/dark.png)

## 环境配置

### 🖥️ 系统要求

- Python 3.8+
- 支持 WebSocket 的现代浏览器

### 📦 安装依赖

1. 创建 Python 虚拟环境：

   ```bash
   python -m venv venv
   ```

2. 激活 Python 虚拟环境：

   ```bash
   venv\Scripts\activate
   ```

3. 在激活的虚拟环境中安装依赖：

   ```bash
   pip install -r server/requirements.txt
   ```

   > **注意**：必须在虚拟环境激活状态下安装依赖，确保包安装到虚拟环境中而不是全局 Python 环境。

### ⚙️ 环境变量配置（可选）

在项目根目录创建 `.env` 文件来配置环境变量：

```text
# 允许的跨域源，默认为 *
CORS_ORIGINS=*

# 单条消息最大字节数，默认为 16777216 (16MB)
MAX_MESSAGE_BYTES=16777216

# 消息窗口最大数量，默认为 100
MAX_MESSAGES=100

# 静态资源缓存时间（秒），默认为 86400 (24小时)
STATIC_CACHE_SECONDS=86400

# 本地存储最大字节数，默认为 5242880 (5MB)
STORAGE_MAX_BYTES=5242880

# 存储数据最大年龄（天），默认为 7
STORAGE_MAX_AGE_DAYS=7

# 房间删除延迟时间（秒），默认为 60
ROOM_DELETION_DELAY=60
```

## 🚀 如何启动

1. 激活虚拟环境（未激活）：

   ```bash
   venv\Scripts\activate
   ```

2. 根目录运行主程序：

   ```bash
   python -m server.main
   ```

   开发环境启动（支持自动重载）：

   ```bash
   uvicorn server.app:app --host 0.0.0.0 --port 12345 --reload
   ```

3. 打开浏览器访问 `http://localhost:12345` 或 `http://127.0.0.1:12345`

服务器将在 `0.0.0.0:12345` 上启动，支持局域网访问。

## 📋 使用说明

### 基本操作

1. **设置用户名**：首次访问时输入用户名（1-10 个字符）
2. **加入聊天**：自动加入默认大厅，或创建/加入其他房间
3. **发送消息**：在输入框输入文字，按 Enter 发送
4. **发送文件**：点击"发送文件"按钮选择文件
5. **切换主题**：点击右上角主题切换按钮
6. **房间管理**：创建房间后输入框自动清空，页面刷新后自动重连上次房间

### 快捷键

- **Enter**：发送消息
- **Shift+Enter**：换行
- **Ctrl+V**：粘贴文件

### 数据存储

- 聊天记录保存在浏览器本地存储中
- 自动清理过期数据（默认 7 天）
- 智能管理存储空间，避免超出浏览器限制

### 网络要求

- 支持局域网部署，无需互联网连接
- 所有参与者需要在同一网络环境下
- 服务器运行后，其他设备可通过 IP 地址访问

## ✨ 支持的功能

- 💬 **实时文字聊天**：基于 WebSocket 的实时文本消息传输
- 🏠 **多房间支持**：创建和加入不同的聊天房间
- 👥 **在线用户**：实时显示房间内的在线用户
- 📁 **文件传输**：支持在聊天中发送小文件
- 🌙 **主题切换**：支持明暗主题切换
- 💾 **消息历史**：本地存储少量聊天记录
- 🧹 **自动清理**：自动清理过期数据和无效房间数据
- ⏰ **房间管理**：房间无人时延迟自动删除（默认60秒）
- 🔄 **自动重连**：页面刷新后自动重连上次房间

## 📂 文件夹结构

```text
lan-text-web-chat/
├── README.md                # 项目说明文档
├── screenshots/             # 应用截图
├── server/                  # 后端服务器代码
│   ├── app.py               # FastAPI应用工厂
│   ├── config.py            # 配置文件和工具函数
│   ├── constants.py         # 常量定义和验证规则
│   ├── helpers.py           # 辅助函数
│   ├── logging_setup.py     # 日志配置
│   ├── main.py              # 应用启动入口
│   ├── requirements.txt     # Python依赖列表
│   ├── rooms.py             # 房间管理逻辑
│   └── routes.py            # HTTP和WebSocket路由定义
└── view/                    # 前端静态资源
    ├── index.html           # 主页面HTML
    ├── icon/                # 图标资源
    ├── js/                  # JavaScript模块
    │   ├── config.js        # 前端配置和文本常量
    │   ├── events.js        # UI事件处理
    │   ├── init.js          # 应用初始化
    │   ├── main.js          # 主入口和协调器
    │   ├── msg-renderer.js  # 消息渲染
    │   ├── messages.js      # 消息处理和显示
    │   ├── room.js          # 房间管理
    │   ├── sender.js        # 消息发送
    │   ├── state.js         # 全局状态管理
    │   ├── storage.js       # 本地存储管理
    │   ├── transport.js     # WebSocket通信
    │   ├── ui-panels.js     # UI面板管理
    │   ├── user.js          # 用户管理
    │   └── utils.js         # 工具函数
    └── style/               # CSS样式文件
        ├── base.css         # 基础样式
        ├── components.css   # 组件样式
        ├── controls.css     # 控制元素样式
        ├── index.css        # 主样式入口
        ├── layout.css       # 布局样式
        └── vars.css         # CSS变量定义
```

## 🔧 部署

### 生产部署

推荐使用反向代理（如 Nginx）进行生产部署：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:12345;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
