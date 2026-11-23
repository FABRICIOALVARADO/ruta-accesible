from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse

from .auth import Attempts, router as auth
from .config import Settings
from .database import initialize
from .routes import admin, personal, public


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        initialize(settings)
        yield

    app = FastAPI(
        title="Ruta Accesible", version="3.0.0",
        description="API de lugares, recorridos y reportes de accesibilidad en Huancayo.",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.attempts = Attempts()

    @app.exception_handler(RequestValidationError)
    async def invalid_input(request: Request, error: RequestValidationError):
        fields = [
            {"field": ".".join(str(part) for part in item["loc"][1:]) or "formulario", "message": item["msg"]}
            for item in error.errors()
        ]
        return JSONResponse({"detail": "Revisa los campos del formulario.", "fields": fields}, status_code=422)

    @app.middleware("http")
    async def protect_same_origin(request, call_next):
        if request.url.path.startswith("/api/") and request.method not in ("GET", "HEAD", "OPTIONS"):
            origin = request.headers.get("origin")
            expected = settings.app_origin or str(request.base_url).rstrip("/")
            if (origin and origin != expected) or request.headers.get("sec-fetch-site") == "cross-site":
                return JSONResponse({"detail": "Origen de solicitud no permitido."}, status_code=403)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Frame-Options"] = "DENY"
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    for router in (auth, public, personal, admin):
        app.include_router(router, prefix="/api")

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404, "La ruta de API no existe.")
        root = settings.frontend.resolve()
        file = (root / path).resolve()
        if not file.is_relative_to(root):
            raise HTTPException(404)
        if file.is_file():
            return FileResponse(file, headers={"Cache-Control": "no-cache"} if file.suffix == ".html" else {})
        if "." in file.name:
            raise HTTPException(404)
        index = root / "index.html"
        if not index.is_file():
            return HTMLResponse(
                "<!doctype html><html lang='es'><meta charset='utf-8'><title>Ruta Accesible</title>"
                "<h1>La API está funcionando</h1><p>Compila Angular con <code>npm run build</code>."
                " Puedes revisar los servicios en <a href='/docs'>la documentación de la API</a>.</p></html>",
                status_code=503,
            )
        return FileResponse(index, headers={"Cache-Control": "no-cache"})

    return app


app = create_app()
