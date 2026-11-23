import json
from sqlite3 import Connection, Row

from fastapi import HTTPException

from .catalogs import CATALOGS
from .database import assign_facilities, fold
from .models import PlaceInput

PLACE_QUERY = """
SELECT p.*, c.name AS category, d.name AS district,
       (SELECT json_group_array(facility_id) FROM place_facilities WHERE place_id=p.id) AS facilities,
       (SELECT count(*) FROM reviews WHERE place_id=p.id) AS review_count,
       (SELECT round(avg(rating),1) FROM reviews WHERE place_id=p.id) AS rating
FROM places p
JOIN categories c ON c.id=p.category_id
JOIN districts d ON d.id=p.district_id
"""


def as_place(row: Row) -> dict:
    place = dict(row)
    place["facilities"] = json.loads(place["facilities"])
    place["is_demo"] = bool(place["is_demo"])
    return place


def check_catalog(table: str, values: list[str] | set[str]) -> None:
    if any(code not in CATALOGS[table] for code in values):
        raise HTTPException(422, "Selecciona una opción válida del catálogo.")


def get_place(db: Connection, place_id: int, include_archived: bool = False) -> dict:
    condition = "p.id=?" if include_archived else "p.id=? AND p.archived_at IS NULL"
    row = db.execute(PLACE_QUERY + f" WHERE {condition}", (place_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "El lugar no está disponible.")
    return as_place(row)


def list_places(db: Connection, q="", district="", category="", facilities=(), verified=False, include_archived=False):
    conditions, parameters = [], []
    if not include_archived:
        conditions.append("p.archived_at IS NULL")
    if q.strip():
        conditions.append("instr(fold(p.name || ' ' || p.address || ' ' || d.name), ?) > 0")
        parameters.append(fold(q.strip()))
    if district:
        check_catalog("districts", [district])
        conditions.append("p.district_id=?")
        parameters.append(district)
    if category:
        check_catalog("categories", [category])
        conditions.append("p.category_id=?")
        parameters.append(category)
    if verified:
        conditions.append("p.verified_at IS NOT NULL")
    check_catalog("facilities", set(facilities))
    for facility in set(facilities):
        conditions.append("EXISTS (SELECT 1 FROM place_facilities WHERE place_id=p.id AND facility_id=?)")
        parameters.append(facility)
    where = " WHERE " + " AND ".join(conditions) if conditions else ""
    return [as_place(row) for row in db.execute(PLACE_QUERY + where + " ORDER BY p.id", parameters)]


def save_place(db: Connection, payload: PlaceInput, place_id: int | None = None) -> dict:
    check_catalog("districts", [payload.district_id])
    check_catalog("categories", [payload.category_id])
    check_catalog("facilities", payload.facilities)
    timestamp = "strftime('%Y-%m-%dT%H:%M:%fZ','now')"
    values = (
        payload.name, payload.category_id, payload.district_id, payload.address, payload.description,
        payload.lat, payload.lng, payload.image, payload.is_demo, payload.verified,
    )
    with db:
        if place_id is None:
            place_id = db.execute(
                "INSERT INTO places(name, category_id, district_id, address, description, lat, lng, image, is_demo, verified_at) "
                f"VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? THEN {timestamp} END)", values,
            ).lastrowid
        else:
            changed = db.execute(
                "UPDATE places SET name=?, category_id=?, district_id=?, address=?, description=?, lat=?, lng=?, "
                f"image=?, is_demo=?, verified_at=CASE WHEN ? THEN COALESCE(verified_at,{timestamp}) END WHERE id=?",
                (*values, place_id),
            ).rowcount
            if not changed:
                raise HTTPException(404, "El lugar no existe.")
            db.execute("DELETE FROM place_facilities WHERE place_id=?", (place_id,))
        assign_facilities(db, place_id, sorted(payload.facilities))
    return get_place(db, place_id, include_archived=True)
