from dataclasses import asdict
from math import cos, hypot, radians
from sqlite3 import Connection, IntegrityError

from fastapi import APIRouter, HTTPException

from .dependencies import Admin, Database, Member
from .mobility_input import (
    CheckInput, CompareInput, EntranceInput, JunctionInput, MapEffectInput,
    PreferenceInput, SegmentInput, WalkInput,
)
from .routing import Point, Preferences, Segment, compare, metres, nearest_node, route_data, shortest_path

router = APIRouter(prefix="/map", tags=["Mapa de accesibilidad"])
admin = APIRouter(prefix="/admin/map", tags=["Verificación de campo"])

LOCATIONS = """
SELECT l.report_id,l.lat,l.lng,l.segment_id,l.map_effect,l.reviewed_at,
       r.title,r.type_id,s.name AS segment_name,e.status_id
FROM report_locations l
JOIN reports r ON r.id=l.report_id
JOIN report_events e ON e.id=(SELECT id FROM report_events WHERE report_id=r.id ORDER BY id DESC LIMIT 1)
LEFT JOIN map_segments s ON s.id=l.segment_id
"""


def active_barriers(db: Connection) -> list[dict]:
    return [dict(row) for row in db.execute(
        LOCATIONS + " WHERE l.map_effect != 'hidden' AND e.status_id != 'resolved' ORDER BY r.id DESC"
    )]


def segments(db: Connection, barriers: list[dict] | None = None) -> list[Segment]:
    barriers_by_segment: dict[int, list[str]] = {}
    for barrier in barriers if barriers is not None else active_barriers(db):
        if barrier["segment_id"] is not None:
            barriers_by_segment.setdefault(barrier["segment_id"], []).append(barrier["map_effect"])

    result = []
    rows = db.execute("""
        SELECT s.*, a.lat AS alat,a.lng AS alng,b.lat AS blat,b.lng AS blng,
               c.stairs,c.crossing,c.surface,c.slope_percent,c.width_cm,c.notes,c.checked_at,c.verified
        FROM map_segments s
        JOIN map_junctions a ON a.id=s.start_id JOIN map_junctions b ON b.id=s.end_id
        LEFT JOIN segment_checks c ON c.id=(SELECT id FROM segment_checks WHERE segment_id=s.id ORDER BY id DESC LIMIT 1)
        ORDER BY s.id
    """)
    for row in rows:
        effects = barriers_by_segment.get(row["id"], [])
        quality = "demo" if row["is_demo"] else "verified" if row["verified"] else "unknown"
        result.append(Segment(
            row["id"], row["name"], row["start_id"], row["end_id"], (row["alat"], row["alng"]),
            (row["blat"], row["blng"]), quality, None if row["stairs"] is None else bool(row["stairs"]),
            row["crossing"] or "unknown", row["surface"] or "unknown", row["slope_percent"], row["width_cm"],
            row["notes"] or "", None if quality == "demo" else row["checked_at"], "closed" in effects, len(effects),
        ))
    return result


def junctions(db: Connection) -> list[dict]:
    return [dict(row) for row in db.execute("SELECT id,name,lat,lng FROM map_junctions ORDER BY id")]


def near_segment(db: Connection, point: Point) -> int | None:
    """Relaciona un aviso con el tramo más cercano cuando está a 35 m o menos."""
    scale = cos(radians(point[0]))

    def xy(other):
        return ((other[1] - point[1]) * 111195 * scale, (other[0] - point[0]) * 111195)

    def gap(segment):
        ax, ay = xy(segment.a)
        bx, by = xy(segment.b)
        dx, dy = bx - ax, by - ay
        length_squared = dx**2 + dy**2
        t = max(0, min(1, -(ax * dx + ay * dy) / length_squared)) if length_squared else 0
        return hypot(ax + t * dx, ay + t * dy)

    closest = min(((gap(segment), segment.id) for segment in segments(db, [])), default=None)
    return closest[1] if closest and closest[0] <= 35 else None


def attach_report(db: Connection, report_id: int, lat: float, lng: float) -> None:
    db.execute(
        "INSERT INTO report_locations(report_id,segment_id,lat,lng) VALUES (?,?,?,?)",
        (report_id, near_segment(db, (lat, lng)), lat, lng),
    )


@router.get("/network")
def network(db: Database):
    barriers = active_barriers(db)
    return {"junctions": junctions(db), "segments": [item.public() for item in segments(db, barriers)], "barriers": barriers}


@router.post("/compare")
def compare_routes(payload: CompareInput, db: Database):
    network_segments = segments(db)
    nodes = {node["id"]: (node["lat"], node["lng"]) for node in junctions(db)}
    # Las pruebas usan su propia red. Si hay una red real conectada, tiene prioridad.
    origin = payload.origin.lat, payload.origin.lng
    destination = payload.destination.lat, payload.destination.lng
    prefs = Preferences(**payload.preferences.model_dump())
    real = [item for item in network_segments if item.quality != "demo"]
    pilot = [item for item in network_segments if item.quality == "demo"]
    response = {"direct": None, "alternative": None, "reason": "outside", "snap": None}
    for subset in (pilot,) if payload.demonstration else (real, pilot):
        connected = {node for item in subset for node in (item.start, item.end)}
        coverage = {node: nodes[node] for node in connected}
        start, end = nearest_node(origin, coverage), nearest_node(destination, coverage)
        if not start or not end:
            continue
        if start[0] == end[0]:
            response = response | {"reason": "same"}
            continue
        options = compare(subset, start[0], end[0], prefs)
        return options | {
            "reason": "ok" if options["direct"] else "disconnected",
            "snap": {"origin_m": round(start[1]), "destination_m": round(end[1])},
        }
    return response


@router.get("/walks")
def walks(db: Database):
    options = segments(db)
    nodes = {row["id"]: row for row in junctions(db)}
    result = []
    for row in db.execute("SELECT * FROM curated_walks ORDER BY is_demo,id"):
        record = dict(row)
        demo = bool(record["is_demo"])
        prefs = Preferences(avoid_rough=True, verified_only=not demo)
        available = [segment for segment in options if (segment.quality == "demo") == demo]
        route = shortest_path(available, record["start_id"], record["end_id"], prefs, accessible=True)
        result.append(record | {
            "origin": nodes[record["start_id"]], "destination": nodes[record["end_id"]],
            "route": route_data(route, prefs) if route else None,
            "state": "demo" if demo else "verified" if route else "unavailable",
        })
    return result


@router.get("/places/{place_id}/access")
def access(place_id: int, db: Database):
    row = db.execute(
        "SELECT a.steps,a.door_cm,a.toilet,a.entrance,a.photo_url,a.notes,a.verified,a.checked_at "
        "FROM place_access a JOIN places p ON p.id=a.place_id WHERE p.id=? AND p.archived_at IS NULL", (place_id,),
    ).fetchone()
    return dict(row) | {"verified": bool(row["verified"])} if row else None


@router.get("/preferences")
def get_preferences(user: Member, db: Database):
    row = db.execute(
        "SELECT avoid_stairs,avoid_rough,verified_only,max_slope,min_width FROM route_preferences WHERE user_id=?",
        (user["id"],),
    ).fetchone()
    return asdict(Preferences()) if row is None else PreferenceInput.model_validate(dict(row)).model_dump()


@router.put("/preferences")
def save_preferences(payload: PreferenceInput, user: Member, db: Database):
    values = payload.model_dump()
    with db:
        db.execute("""
        INSERT INTO route_preferences(user_id,avoid_stairs,avoid_rough,verified_only,max_slope,min_width)
        VALUES (:user_id,:avoid_stairs,:avoid_rough,:verified_only,:max_slope,:min_width)
        ON CONFLICT(user_id) DO UPDATE SET avoid_stairs=excluded.avoid_stairs,avoid_rough=excluded.avoid_rough,
        verified_only=excluded.verified_only,max_slope=excluded.max_slope,min_width=excluded.min_width
        """, values | {"user_id": user["id"]})
    return values


@admin.post("/junctions", status_code=201)
def add_junction(payload: JunctionInput, user: Admin, db: Database):
    if not (-12.25 <= payload.lat <= -11.90 and -75.40 <= payload.lng <= -74.99):
        raise HTTPException(422, "Registra puntos en Huancayo y su entorno urbano.")
    try:
        with db:
            record = db.execute(
                "INSERT INTO map_junctions(name,lat,lng) VALUES (?,?,?) RETURNING id,name,lat,lng",
                (payload.name, round(payload.lat, 7), round(payload.lng, 7)),
            ).fetchone()
    except IntegrityError as error:
        raise HTTPException(409, "Ya hay un punto en esas coordenadas.") from error
    return dict(record)


@admin.post("/segments", status_code=201)
def add_segment(payload: SegmentInput, user: Admin, db: Database):
    start, end = sorted((payload.start_id, payload.end_id))
    nodes = db.execute("SELECT lat,lng FROM map_junctions WHERE id IN (?,?) ORDER BY id", (start, end)).fetchall()
    if len(nodes) != 2:
        raise HTTPException(404, "No encontramos ambos puntos.")
    length = metres(tuple(nodes[0]), tuple(nodes[1]))
    if not 1 <= length <= 1000:
        raise HTTPException(422, "Agrega tramos de entre 1 y 1.000 m.")
    try:
        with db:
            identifier = db.execute(
                "INSERT INTO map_segments(name,start_id,end_id) VALUES (?,?,?)", (payload.name, start, end),
            ).lastrowid
    except IntegrityError as error:
        raise HTTPException(409, "Ya existe un tramo entre esos puntos.") from error
    return {"id": identifier}


@admin.post("/segments/{segment_id}/checks", status_code=201)
def inspect_segment(segment_id: int, payload: CheckInput, user: Admin, db: Database):
    segment = db.execute("SELECT is_demo FROM map_segments WHERE id=?", (segment_id,)).fetchone()
    if segment is None:
        raise HTTPException(404, "El tramo no existe.")
    if segment["is_demo"] and payload.verified:
        raise HTTPException(409, "Crea un tramo real para registrar una revisión de campo.")
    with db:
        db.execute("""
        INSERT INTO segment_checks(segment_id,stairs,crossing,surface,slope_percent,width_cm,notes,verified,checked_by)
        VALUES (:segment_id,:stairs,:crossing,:surface,:slope_percent,:width_cm,:notes,:verified,:checked_by)
        """, payload.model_dump() | {"segment_id": segment_id, "checked_by": user["id"]})
    return {"id": segment_id}


@admin.get("/reports")
def map_reports(user: Admin, db: Database):
    return [dict(row) for row in db.execute(LOCATIONS + " ORDER BY r.id DESC")]


@admin.put("/reports/{report_id}")
def review_barrier(report_id: int, payload: MapEffectInput, user: Admin, db: Database):
    with db:
        db.execute("BEGIN IMMEDIATE")
        report = db.execute(LOCATIONS + " WHERE r.id=?", (report_id,)).fetchone()
        if report is None:
            raise HTTPException(404, "No encontramos un reporte con ubicación.")
        if payload.effect != "hidden" and report["status_id"] == "resolved":
            raise HTTPException(409, "Reabre el reporte desde Administración para publicar un aviso vigente.")
        if payload.effect == "closed" and report["segment_id"] is None:
            raise HTTPException(409, "El aviso está fuera de los tramos registrados. Puedes mostrarlo como advertencia.")
        if payload.effect != "hidden" and report["status_id"] == "pending":
            db.execute("INSERT INTO report_events(report_id,status_id,actor_id) VALUES (?,'reviewing',?)", (report_id, user["id"]))
        db.execute(
            "UPDATE report_locations SET map_effect=?,reviewed_by=?,reviewed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE report_id=?",
            (payload.effect, user["id"], report_id),
        )
    return {"effect": payload.effect}


@admin.put("/places/{place_id}/access")
def review_access(place_id: int, payload: EntranceInput, user: Admin, db: Database):
    place = db.execute("SELECT is_demo FROM places WHERE id=? AND archived_at IS NULL", (place_id,)).fetchone()
    if not place:
        raise HTTPException(404, "El lugar no está disponible.")
    if place["is_demo"] and payload.verified:
        raise HTTPException(409, "Primero publica la ficha como un lugar real en Administración.")
    with db:
        db.execute("""
        INSERT INTO place_access(place_id,steps,door_cm,toilet,entrance,photo_url,notes,verified,checked_by)
        VALUES (:place_id,:steps,:door_cm,:toilet,:entrance,:photo_url,:notes,:verified,:checked_by)
        ON CONFLICT(place_id) DO UPDATE SET steps=excluded.steps,door_cm=excluded.door_cm,toilet=excluded.toilet,
        entrance=excluded.entrance,photo_url=excluded.photo_url,notes=excluded.notes,verified=excluded.verified,
        checked_by=excluded.checked_by,checked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
        """, payload.model_dump() | {"place_id": place_id, "checked_by": user["id"]})
    return {"id": place_id}


@admin.post("/walks", status_code=201)
def publish_walk(payload: WalkInput, user: Admin, db: Database):
    with db:
        db.execute("BEGIN IMMEDIATE")
        route = shortest_path(segments(db), payload.start_id, payload.end_id,
                              Preferences(verified_only=True, avoid_rough=True), accessible=True)
        if not route:
            raise HTTPException(409, "Conecta los puntos mediante tramos verificados y sin cierres antes de publicar.")
        try:
            result = db.execute(
                "INSERT INTO curated_walks(name,description,start_id,end_id) VALUES (?,?,?,?)",
                (payload.name, payload.description, payload.start_id, payload.end_id),
            )
        except IntegrityError as error:
            raise HTTPException(409, "Ya existe un recorrido con ese nombre.") from error
        return {"id": result.lastrowid}
