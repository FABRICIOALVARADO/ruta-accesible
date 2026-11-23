import hashlib
import hmac
import secrets
from typing import Any

COOKIE_NAME = "ruta_sid"
SESSION_SECONDS = 7 * 24 * 60 * 60


def hash_password(password: str, salt: str | None = None) -> str:
    # Conserva la compatibilidad con los hashes scrypt de la edición anterior.
    salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=salt.encode(), n=2**14, r=8, p=1, dklen=64)
    return f"{salt}:{digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        salt, _ = encoded.split(":", maxsplit=1)
        return hmac.compare_digest(hash_password(password, salt), encoded)
    except ValueError:
        return False


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def public_user(row: Any) -> dict:
    return {key: row[key] for key in ("id", "name", "email", "role")}
