import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read_env() -> dict[str, str]:
    """Lee la configuración local. Las variables del sistema tienen prioridad."""
    values: dict[str, str] = {}
    file = ROOT / ".env"
    if file.is_file():
        for raw in file.read_text(encoding="utf-8-sig").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", maxsplit=1)
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
                value = value[1:-1]
            values[key.strip()] = value
    return values | dict(os.environ)


@dataclass(frozen=True)
class Settings:
    database: Path = ROOT / "data" / "ruta-accesible-fastapi.db"
    legacy_database: Path | None = ROOT / "data" / "ruta-accesible.db"
    frontend: Path = ROOT / "frontend" / "dist" / "ruta-accesible" / "browser"
    maps_key: str = field(default="", repr=False)
    map_id: str = "DEMO_MAP_ID"
    admin_email: str = field(default="", repr=False)
    admin_password: str = field(default="", repr=False)
    app_origin: str = ""
    secure_cookie: bool = False

    @classmethod
    def from_env(cls) -> "Settings":
        env = read_env()
        legacy = env.get("LEGACY_DATABASE_PATH", "data/ruta-accesible.db")
        return cls(
            database=ROOT / env.get("FASTAPI_DATABASE_PATH", "data/ruta-accesible-fastapi.db"),
            legacy_database=ROOT / legacy if legacy else None,
            maps_key=env.get("GOOGLE_MAPS_API_KEY", "").strip(),
            map_id=env.get("GOOGLE_MAPS_MAP_ID", "").strip() or "DEMO_MAP_ID",
            admin_email=env.get("ADMIN_EMAIL", "").strip().casefold(),
            admin_password=env.get("ADMIN_PASSWORD", ""),
            app_origin=env.get("APP_ORIGIN", "").rstrip("/"),
            secure_cookie=env.get("NODE_ENV") == "production" or env.get("SECURE_COOKIE") == "1",
        )
