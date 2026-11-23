import secrets
import sqlite3
import time
from threading import Lock

from fastapi import APIRouter, HTTPException, Request, Response

from .dependencies import Database, Member, OptionalUser
from .models import Credentials, Profile, Registration
from .security import COOKIE_NAME, SESSION_SECONDS, hash_password, public_user, token_hash, verify_password

router = APIRouter(prefix="/auth", tags=["Cuenta"])
# Hace comparable el tiempo de comprobación para correos existentes e inexistentes.
DUMMY_HASH = hash_password(secrets.token_urlsafe(32))


class Attempts:
    def __init__(self) -> None:
        self.lock = Lock()
        self.entries: dict[tuple[str, str], tuple[int, float]] = {}

    def check(self, request: Request, action: str) -> None:
        now = time.monotonic()
        key = (request.client.host if request.client else "local", action)
        with self.lock:
            self.entries = {entry: data for entry, data in self.entries.items() if data[1] > now}
            count, expiry = self.entries.get(key, (0, now + 900))
            if count >= 30:
                raise HTTPException(429, "Demasiados intentos. Vuelve en 15 minutos.")
            self.entries[key] = (count + 1, expiry)


def start_session(request: Request, response: Response, db: sqlite3.Connection, user_id: int) -> None:
    token = secrets.token_urlsafe(32)
    now = int(time.time())
    previous = request.cookies.get(COOKIE_NAME)
    with db:
        db.execute("DELETE FROM sessions WHERE expires_at<=?", (now,))
        if previous:
            db.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash(previous),))
        db.execute("INSERT INTO sessions VALUES (?, ?, ?)", (token_hash(token), user_id, now + SESSION_SECONDS))
    response.set_cookie(
        COOKIE_NAME, token, max_age=SESSION_SECONDS, httponly=True, samesite="lax",
        secure=request.app.state.settings.secure_cookie,
    )


@router.get("/me")
def me(user: OptionalUser):
    return {"user": public_user(user) if user else None}


@router.post("/register", status_code=201)
def register(payload: Registration, request: Request, response: Response, db: Database):
    request.app.state.attempts.check(request, "register")
    try:
        with db:
            new_id = db.execute(
                "INSERT INTO users(name, email, password_hash) VALUES (?, ?, ?)",
                (payload.name, payload.email, hash_password(payload.password)),
            ).lastrowid
    except sqlite3.IntegrityError as error:
        raise HTTPException(409, "Ya existe una cuenta con este correo.") from error
    start_session(request, response, db, new_id)
    return {"user": public_user(db.execute("SELECT * FROM users WHERE id=?", (new_id,)).fetchone())}


@router.post("/login")
def login(payload: Credentials, request: Request, response: Response, db: Database):
    request.app.state.attempts.check(request, "login")
    user = db.execute("SELECT * FROM users WHERE email=?", (payload.email,)).fetchone()
    valid = verify_password(payload.password, user["password_hash"] if user else DUMMY_HASH)
    if user is None or not valid:
        raise HTTPException(401, "El correo o la contraseña son incorrectos.")
    start_session(request, response, db, user["id"])
    return {"user": public_user(user)}


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Database):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        with db:
            db.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash(token),))
    response.delete_cookie(COOKIE_NAME, httponly=True, samesite="lax", secure=request.app.state.settings.secure_cookie)


@router.patch("/profile")
def profile(payload: Profile, user: Member, db: Database):
    with db:
        db.execute("UPDATE users SET name=? WHERE id=?", (payload.name, user["id"]))
    return {"user": public_user(db.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone())}
