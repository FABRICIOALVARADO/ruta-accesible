import csv
from io import StringIO
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Request, Response

from .catalogs import CATALOGS
from .dependencies import Admin, Database, Member, OptionalUser
from .models import PlaceInput, ReportInput, ReportStatusInput, ReviewInput, SavedRouteInput
from .places import check_catalog, get_place, list_places, save_place

public = APIRouter(tags=["Directorio"])
personal = APIRouter(prefix="/me", tags=["Actividad personal"])
admin = APIRouter(prefix="/admin", tags=["Administración"])

REPORT_QUERY = """
SELECT r.*, e.status_id, p.name AS place_name, u.name AS author
FROM reports r JOIN users u ON u.id=r.user_id
JOIN report_events e ON e.id=(SELECT id FROM report_events WHERE report_id=r.id ORDER BY id DESC LIMIT 1)
LEFT JOIN places p ON p.id=r.place_id
"""


@public.get("/health")
def health(db: Database):
    db.execute("SELECT 1 FROM metadata").fetchone()
    return {"status": "ok", "backend": "FastAPI", "database": "SQLite"}


@public.get("/config")
def config(request: Request):
    settings = request.app.state.settings
    return {
        "maps_key": settings.maps_key,
        "map_id": settings.map_id,
        "catalogs": {
            table: [{"id": code, "name": label} for code, label in entries.items()]
            for table, entries in CATALOGS.items()
        },
    }


@public.get("/places")
def places(
    db: Database, q: Annotated[str, Query(max_length=120)] = "",
    district: Annotated[str, Query(max_length=40)] = "",
    category: Annotated[str, Query(max_length=40)] = "",
    facility: Annotated[list[str] | None, Query()] = None,
    verified: bool = False,
):
    return list_places(db, q, district, category, facility or [], verified)


@public.get("/places/{place_id}")
def place_detail(place_id: int, db: Database, user: OptionalUser):
    place = get_place(db, place_id)
    reviews = db.execute(
        "SELECT r.id, r.rating, r.comment, r.created_at, u.name AS author, "
        "CASE WHEN r.user_id=? THEN 1 ELSE 0 END AS mine "
        "FROM reviews r JOIN users u ON u.id=r.user_id WHERE r.place_id=? ORDER BY r.created_at DESC",
        (user["id"] if user else None, place_id),
    )
    return {"place": place, "reviews": [dict(row) for row in reviews]}


@public.put("/places/{place_id}/review", status_code=204)
def review(place_id: int, payload: ReviewInput, user: Member, db: Database):
    get_place(db, place_id)
    with db:
        db.execute(
            "INSERT INTO reviews(user_id, place_id, rating, comment) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(user_id, place_id) DO UPDATE SET rating=excluded.rating,comment=excluded.comment,"
            "created_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')",
            (user["id"], place_id, payload.rating, payload.comment),
        )


@public.delete("/places/{place_id}/review", status_code=204)
def delete_review(place_id: int, user: Member, db: Database):
    with db:
        db.execute("DELETE FROM reviews WHERE place_id=? AND user_id=?", (place_id, user["id"]))


@personal.get("/favorites")
def favorites(user: Member, db: Database):
    return [
        row["place_id"] for row in db.execute(
            "SELECT f.place_id FROM favorites f JOIN places p ON p.id=f.place_id "
            "WHERE f.user_id=? AND p.archived_at IS NULL ORDER BY f.place_id", (user["id"],),
        )
    ]


@personal.put("/favorites/{place_id}", status_code=204)
def add_favorite(place_id: int, user: Member, db: Database):
    get_place(db, place_id)
    with db:
        db.execute("INSERT OR IGNORE INTO favorites VALUES (?, ?)", (user["id"], place_id))


@personal.delete("/favorites/{place_id}", status_code=204)
def remove_favorite(place_id: int, user: Member, db: Database):
    with db:
        db.execute("DELETE FROM favorites WHERE user_id=? AND place_id=?", (user["id"], place_id))


@personal.get("/reports")
def my_reports(user: Member, db: Database):
    return [dict(row) for row in db.execute(REPORT_QUERY + " WHERE r.user_id=? ORDER BY r.id DESC", (user["id"],))]


@personal.post("/reports", status_code=201)
def create_report(payload: ReportInput, user: Member, db: Database):
    check_catalog("report_types", [payload.type_id])
    if payload.place_id:
        get_place(db, payload.place_id)
    with db:
        report_id = db.execute(
            "INSERT INTO reports(user_id, place_id, location, type_id, title, description) VALUES (?, ?, ?, ?, ?, ?)",
            (user["id"], payload.place_id, payload.location, payload.type_id, payload.title, payload.description),
        ).lastrowid
        db.execute("INSERT INTO report_events(report_id, status_id, actor_id) VALUES (?, 'pending', ?)", (report_id, user["id"]))
    return dict(db.execute(REPORT_QUERY + " WHERE r.id=?", (report_id,)).fetchone())


@personal.get("/reports/{report_id}/history")
def history(report_id: int, user: Member, db: Database):
    report = db.execute("SELECT user_id FROM reports WHERE id=?", (report_id,)).fetchone()
    if report is None or (report["user_id"] != user["id"] and user["role"] != "admin"):
        raise HTTPException(404, "El reporte no está disponible.")
    return [dict(row) for row in db.execute(
        "SELECT e.status_id, e.changed_at FROM report_events e WHERE e.report_id=? ORDER BY e.id", (report_id,),
    )]


@personal.get("/routes")
def saved_routes(user: Member, db: Database):
    return [dict(row) for row in db.execute("SELECT * FROM saved_routes WHERE user_id=? ORDER BY id DESC", (user["id"],))]


@personal.post("/routes", status_code=201)
def save_route(payload: SavedRouteInput, user: Member, db: Database):
    check_catalog("travel_modes", [payload.mode_id])
    with db:
        route_id = db.execute(
            "INSERT INTO saved_routes(user_id,name,origin,destination,mode_id) VALUES (?, ?, ?, ?, ?)",
            (user["id"], payload.name, payload.origin, payload.destination, payload.mode_id),
        ).lastrowid
    return dict(db.execute("SELECT * FROM saved_routes WHERE id=?", (route_id,)).fetchone())


@personal.delete("/routes/{route_id}", status_code=204)
def delete_route(route_id: int, user: Member, db: Database):
    with db:
        changed = db.execute("DELETE FROM saved_routes WHERE id=? AND user_id=?", (route_id, user["id"])).rowcount
        if not changed:
            raise HTTPException(404, "El recorrido no está disponible.")


@admin.get("/places")
def admin_places(user: Admin, db: Database):
    return list_places(db, include_archived=True)


@admin.post("/places", status_code=201)
def add_place(payload: PlaceInput, user: Admin, db: Database):
    return save_place(db, payload)


@admin.put("/places/{place_id}")
def edit_place(place_id: int, payload: PlaceInput, user: Admin, db: Database):
    return save_place(db, payload, place_id)


@admin.delete("/places/{place_id}", status_code=204)
def archive(place_id: int, user: Admin, db: Database):
    get_place(db, place_id, include_archived=True)
    with db:
        db.execute(
            "UPDATE places SET archived_at=COALESCE(archived_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE id=?",
            (place_id,),
        )


@admin.post("/places/{place_id}/restore", status_code=204)
def restore(place_id: int, user: Admin, db: Database):
    get_place(db, place_id, include_archived=True)
    with db:
        db.execute("UPDATE places SET archived_at=NULL WHERE id=?", (place_id,))


@admin.get("/reports")
def admin_reports(user: Admin, db: Database):
    return [dict(row) for row in db.execute(REPORT_QUERY + " ORDER BY r.id DESC")]


@admin.patch("/reports/{report_id}")
def change_report(report_id: int, payload: ReportStatusInput, user: Admin, db: Database):
    transitions = {"pending": {"reviewing"}, "reviewing": {"resolved"}, "resolved": {"reviewing"}}
    with db:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute(REPORT_QUERY + " WHERE r.id=?", (report_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "El reporte no existe.")
        current = row["status_id"]
        if payload.status_id != current:
            if payload.status_id not in transitions[current]:
                raise HTTPException(409, "El reporte debe pasar a revisión antes de resolverse.")
            db.execute(
                "INSERT INTO report_events(report_id, status_id, actor_id) VALUES (?, ?, ?)",
                (report_id, payload.status_id, user["id"]),
            )
        return dict(db.execute(REPORT_QUERY + " WHERE r.id=?", (report_id,)).fetchone())


@admin.get("/summary")
def summary(user: Admin, db: Database):
    return dict(db.execute(
        "SELECT (SELECT count(*) FROM places WHERE archived_at IS NULL) AS places,"
        "(SELECT count(*) FROM users) AS users,"
        "(SELECT count(*) FROM reports) AS reports,"
        "(SELECT count(*) FROM reviews) AS reviews,"
        "(SELECT count(*) FROM saved_routes) AS routes"
    ).fetchone())


@admin.get("/places.csv")
def export_places(user: Admin, db: Database):
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(("Nombre", "Categoría", "Distrito", "Dirección", "Facilidades", "Verificado"))

    def safe_cell(value: str) -> str:
        return "'" + value if value.lstrip().startswith(("=", "+", "-", "@")) else value

    for place in list_places(db):
        facilities = ", ".join(CATALOGS["facilities"][code] for code in place["facilities"])
        writer.writerow([safe_cell(value) for value in (
            place["name"], place["category"], place["district"], place["address"],
            facilities, "Sí" if place["verified_at"] else "No",
        )])
    return Response(
        content="\ufeff" + output.getvalue(), media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="lugares-ruta-accesible.csv"'},
    )
