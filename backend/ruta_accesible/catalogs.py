CATALOGS = {
    "districts": {"huancayo": "Huancayo", "tambo": "El Tambo", "chilca": "Chilca"},
    "categories": {
        "culture": "Cultura", "park": "Parques", "health": "Salud",
        "shop": "Comercio", "cafe": "Gastronomía", "service": "Servicios",
    },
    "facilities": {
        "ramp": "Rampa", "bathroom": "Baño adaptado",
        "tactile": "Piso táctil", "parking": "Estacionamiento accesible",
    },
    "report_types": {
        "blocked-ramp": "Rampa bloqueada", "bad-sidewalk": "Vereda dañada",
        "no-access": "Sin acceso", "incorrect-data": "Información incorrecta", "other": "Otro",
    },
    "report_statuses": {"pending": "Pendiente", "reviewing": "En revisión", "resolved": "Resuelto"},
    "travel_modes": {
        "walking": "A pie", "driving": "En auto", "bicycling": "Bicicleta", "transit": "Transporte público",
    },
}

DEMO_PLACES = [
    ("Plaza Constitución", "culture", "huancayo", "Jr. Puno y Calle Real",
     "El punto de encuentro de la ciudad. Descubre el centro histórico y planifica tu visita.",
     -12.0683, -75.2103, "plaza", ("ramp",)),
    ("Parque de la Identidad Wanka", "park", "huancayo", "Av. San Carlos",
     "Arte, piedra y tradición wanka en un espacio para recorrer con calma.",
     -12.0528, -75.1922, "park", ("ramp", "bathroom")),
    ("Cerrito de la Libertad", "park", "huancayo", "Av. Giráldez, zona alta",
     "Una mirada diferente al valle del Mantaro. Consulta las condiciones del acceso antes de salir.",
     -12.0709, -75.1920, "hill", ("parking",)),
    ("Real Plaza Huancayo", "shop", "huancayo", "Av. Ferrocarril",
     "Un punto de referencia para organizar compras y encuentros en el centro de la ciudad.",
     -12.0655, -75.2111, "shop", ("ramp", "bathroom", "parking")),
    ("Hospital Daniel Alcides Carrión", "health", "huancayo", "Av. Daniel Alcides Carrión",
     "Referencia de salud. Confirma directamente la entrada y servicios disponibles.",
     -12.0858, -75.2168, "health", ("ramp", "bathroom", "parking")),
    ("Plaza de Huamanmarca", "culture", "huancayo", "Calle Real y Jr. Loreto",
     "Un espacio cívico para conocer la historia y el movimiento de Huancayo.",
     -12.0717, -75.2095, "plaza", ("ramp",)),
    ("Parque de los Sombreros", "park", "tambo", "Zona urbana de El Tambo",
     "Un espacio inspirado en la identidad del valle. Consulta la ficha antes de visitarlo.",
     -12.0380, -75.2310, "park", ("ramp",)),
    ("Centro cultural del valle", "culture", "chilca", "Zona central de Chilca",
     "Lugar ficticio para demostrar búsqueda y consulta de espacios culturales.",
     -12.0910, -75.2010, "culture", ("ramp", "bathroom", "tactile")),
    ("Café del Mantaro", "cafe", "huancayo", "Centro de Huancayo",
     "Establecimiento ficticio para demostrar reseñas y criterios de accesibilidad.",
     -12.0661, -75.2070, "cafe", ("ramp", "bathroom")),
]
