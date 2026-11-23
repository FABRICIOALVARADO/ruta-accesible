from sqlite3 import Connection

# Coordenadas aproximadas y condiciones ficticias para demostrar el algoritmo.
# Esta red no describe las veredas reales de Huancayo.
NODES = [
    (1, "Plaza Constitución", -12.0683, -75.2103),
    (2, "Cruce norte de prueba", -12.0695, -75.21002),
    (3, "Cruce sur de prueba", -12.0707, -75.2098),
    (4, "Plaza de Huamanmarca", -12.0717, -75.2095),
    (5, "Paso lateral norte de prueba", -12.06847, -75.2114),
    (6, "Paso lateral sur de prueba", -12.07065, -75.21081),
    (7, "Llegada lateral de prueba", -12.07172, -75.21046),
]
SEGMENTS = [
    (1, "Cuadra central norte", 1, 2, 0, "ramp", "even", 3.1, 145),
    (2, "Paso central con escalones", 2, 3, 1, "step", "even", 7.2, 105),
    (3, "Llegada central", 3, 4, 0, "level", "even", 2.7, 160),
    (4, "Desvío norte", 1, 5, 0, "ramp", "even", 2.1, 155),
    (5, "Paso lateral continuo", 5, 6, 0, "level", "even", 3.5, 160),
    (6, "Cuadra lateral sur", 6, 7, 0, "level", "even", 2.8, 135),
    (7, "Cruce junto a Huamanmarca", 4, 7, 0, "ramp", "even", 2.9, 150),
    (8, "Conexión lateral", 2, 6, 0, "ramp", "rough", 6.9, 105),
    (9, "Cruce diagonal de prueba", 3, 5, 0, "ramp", "rough", 5.5, 110),
]


def seed_pilot(db: Connection) -> None:
    if db.execute("SELECT 1 FROM metadata WHERE key='pilot-v1'").fetchone():
        return
    db.executemany("INSERT INTO map_junctions(id,name,lat,lng) VALUES (?,?,?,?)", NODES)
    for identifier, name, start, end, stairs, crossing, surface, slope, width in SEGMENTS:
        db.execute("INSERT INTO map_segments VALUES (?,?,?,?,1)", (identifier, name, start, end))
        db.execute(
            "INSERT INTO segment_checks(segment_id,stairs,crossing,surface,slope_percent,width_cm,notes) "
            "VALUES (?,?,?,?,?,?,?)",
            (identifier, stairs, crossing, surface, slope, width, "Condiciones simuladas para probar la comparación."),
        )
    db.execute(
        "INSERT INTO curated_walks(name,description,start_id,end_id,is_demo) VALUES (?,?,1,4,1)",
        ("Del centro a Huamanmarca", "Compara un paso con escalones y un desvío en la red de demostración."),
    )
    db.execute("INSERT INTO metadata VALUES ('pilot-v1','ready')")
