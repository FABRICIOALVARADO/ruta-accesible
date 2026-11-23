import re
import sqlite3
import unicodedata
from contextlib import closing
from pathlib import Path

from .catalogs import CATALOGS, DEMO_PLACES
from .config import Settings
from .security import hash_password

SCHEMA = Path(__file__).with_name("schema.sql")


def fold(value: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", value.casefold()) if not unicodedata.combining(c))


def connect(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(path, check_same_thread=False, timeout=8)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.create_function("fold", 1, fold, deterministic=True)
    return connection


def seed_catalogs(db: sqlite3.Connection) -> None:
    for table, options in CATALOGS.items():
        db.executemany(f"INSERT OR IGNORE INTO {table}(id, name) VALUES (?, ?)", options.items())


def seed_places(db: sqlite3.Connection) -> None:
    for *values, facilities in DEMO_PLACES:
        place_id = db.execute(
            "INSERT INTO places(name, category_id, district_id, address, description, lat, lng, image) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)", values
        ).lastrowid
        assign_facilities(db, place_id, facilities)


def assign_facilities(db: sqlite3.Connection, place_id: int, facilities) -> None:
    db.executemany(
        "INSERT INTO place_facilities(place_id, facility_id) VALUES (?, ?)",
        ((place_id, facility) for facility in facilities),
    )


def import_legacy(db: sqlite3.Connection, source: Path) -> None:
    """Importa la edición Node en una sola transacción y conserva los identificadores."""
    requested_columns = {
        "users": "id, name, email, password_hash, role, created_at",
        "favorites": "user_id, place_id",
        "reviews": "id, user_id, place_id, rating, comment, created_at",
    }
    labels = {table: {name: code for code, name in entries.items()} for table, entries in CATALOGS.items()}
    with closing(sqlite3.connect(source.resolve().as_uri() + "?mode=ro", uri=True)) as old:
        old.row_factory = sqlite3.Row
        old.execute("BEGIN")
        for row in old.execute("SELECT * FROM places"):
            verified_at = row["created_at"] if row["verified"] and not row["is_demo"] else None
            db.execute(
                "INSERT INTO places(id, name, category_id, district_id, address, description, lat, lng, image, is_demo, verified_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (row["id"], row["name"], labels["categories"][row["category"]],
                 labels["districts"][row["district"]], row["address"], row["description"], row["lat"], row["lng"],
                 row["image"] or "plaza", row["is_demo"], verified_at),
            )
            assign_facilities(db, row["id"], (name for name in CATALOGS["facilities"] if row[name]))
        for table, columns in requested_columns.items():
            rows = old.execute(f"SELECT {columns} FROM {table}").fetchall()
            marks = ", ".join("?" for _ in columns.split(","))
            db.executemany(f"INSERT INTO {table}({columns}) VALUES ({marks})", rows)
        for row in old.execute("SELECT * FROM reports"):
            db.execute(
                "INSERT INTO reports(id, user_id, place_id, location, type_id, title, description, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (row["id"], row["user_id"], row["place_id"], None if row["place_id"] else "Sin ubicación registrada",
                 labels["report_types"][row["type"]], row["title"], row["description"], row["created_at"]),
            )
            db.execute(
                "INSERT INTO report_events(report_id, status_id, actor_id, changed_at) VALUES (?, ?, ?, ?)",
                (row["id"], labels["report_statuses"][row["status"]], row["user_id"], row["created_at"]),
            )
        for row in old.execute("SELECT * FROM saved_routes"):
            db.execute(
                "INSERT INTO saved_routes(id, user_id, name, origin, destination, mode_id, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (row["id"], row["user_id"], row["name"], row["origin"], row["destination"],
                 row["travel_mode"].lower(), row["created_at"]),
            )


def initialize(settings: Settings) -> None:
    path, legacy = settings.database, settings.legacy_database
    if legacy and path.resolve() == legacy.resolve():
        raise ValueError("La base nueva debe tener un archivo distinto a la base de la versión Node.")
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(connect(path)) as db:
        db.execute("PRAGMA journal_mode = WAL")
        db.executescript(SCHEMA.read_text(encoding="utf-8"))
        with db:
            db.execute("BEGIN IMMEDIATE")
            seed_catalogs(db)
            if db.execute("SELECT 1 FROM metadata WHERE key='initialized'").fetchone() is None:
                if legacy and legacy.is_file():
                    import_legacy(db, legacy)
                    source = "legacy"
                else:
                    seed_places(db)
                    source = "demo"
                db.execute("INSERT INTO metadata VALUES ('initialized', ?)", (source,))
            if settings.admin_email or settings.admin_password:
                if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", settings.admin_email) or len(settings.admin_password) < 12:
                    raise ValueError("Configura ADMIN_EMAIL y ADMIN_PASSWORD (al menos 12 caracteres).")
                if db.execute("SELECT 1 FROM users WHERE email=?", (settings.admin_email,)).fetchone() is None:
                    db.execute(
                        "INSERT INTO users(name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
                        ("Administrador", settings.admin_email, hash_password(settings.admin_password)),
                    )
