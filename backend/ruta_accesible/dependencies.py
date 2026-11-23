import time
from contextlib import closing
from sqlite3 import Connection, Row
from typing import Annotated, Iterator

from fastapi import Depends, HTTPException, Request

from .database import connect
from .security import COOKIE_NAME, token_hash


def get_db(request: Request) -> Iterator[Connection]:
    with closing(connect(request.app.state.settings.database)) as db:
        yield db


Database = Annotated[Connection, Depends(get_db)]


def current_user(request: Request, db: Database) -> Row | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    return db.execute(
        "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id "
        "WHERE s.token_hash=? AND s.expires_at>?",
        (token_hash(token), int(time.time())),
    ).fetchone()


def require_user(user: Annotated[Row | None, Depends(current_user)]) -> Row:
    if user is None:
        raise HTTPException(401, "Inicia sesión para continuar.")
    return user


def require_admin(user: Annotated[Row, Depends(require_user)]) -> Row:
    if user["role"] != "admin":
        raise HTTPException(403, "Esta acción requiere un administrador.")
    return user


OptionalUser = Annotated[Row | None, Depends(current_user)]
Member = Annotated[Row, Depends(require_user)]
Admin = Annotated[Row, Depends(require_admin)]
