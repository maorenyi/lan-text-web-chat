# 项目启动入口，负责初始化日志、启动 FastAPI 服务。
# 当直接运行此文件时，会启动应用服务器。
from __future__ import annotations
import uvicorn
from server.app import app
from server.logging_setup import configure_logging

# 仅在直接运行 main.py 时执行启动流程
if __name__ == "__main__":
    # 初始化日志配置（支持环境变量自定义格式和等级）
    configure_logging()
    # 启动 uvicorn 服务，监听 0.0.0.0:12345，关闭热重载
    uvicorn.run(app, host="0.0.0.0", port=12345, reload=False)
