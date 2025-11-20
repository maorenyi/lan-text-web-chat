# 应用主入口，负责创建 FastAPI 实例、挂载静态资源、注册路由和中间件。
# 这是应用的核心应用工厂函数。
from __future__ import annotations
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# 导入全局配置项和依赖模块
from server.config import ALLOW_ORIGINS, VIEW_DIR, LOBBY_ID, STATIC_CACHE_SECONDS
from server.rooms import RoomManager
from server.routes import make_router


# 静态资源缓存类，支持自定义 Cache-Control 响应头
class CachedStaticFiles(StaticFiles):
    def __init__(self, *args, cache_seconds: int = 0, **kwargs):
        super().__init__(*args, **kwargs)
        self._cache_header = (
            f"public, max-age={cache_seconds}" if cache_seconds > 0 else None
        )

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if self._cache_header and response.status_code < 400:
            response.headers.setdefault("Cache-Control", self._cache_header)
        return response


# 创建并配置 FastAPI 应用对象
def create_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOW_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.mount(
        "/view",
        CachedStaticFiles(
            directory=str(VIEW_DIR), html=True, cache_seconds=STATIC_CACHE_SECONDS
        ),
        name="view",
    )
    rm = RoomManager(LOBBY_ID)
    router = make_router(rm)
    app.include_router(router)
    return app


# 应用全局实例，供 uvicorn 启动
app = create_app()
