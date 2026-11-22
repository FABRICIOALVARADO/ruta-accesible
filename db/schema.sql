PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 80),
 email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','admin')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS places (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL CHECK(category IN ('Cultura','Parques','Salud','Comercio','Gastronom�a','Servicios')),
 district TEXT NOT NULL, address TEXT NOT NULL, description TEXT NOT NULL,
 lat REAL NOT NULL CHECK(lat BETWEEN -90 AND 90), lng REAL NOT NULL CHECK(lng BETWEEN -180 AND 180),
 image TEXT NOT NULL DEFAULT '', ramp INTEGER NOT NULL DEFAULT 0 CHECK(ramp IN (0,1)),
 bathroom INTEGER NOT NULL DEFAULT 0 CHECK(bathroom IN (0,1)), tactile INTEGER NOT NULL DEFAULT 0 CHECK(tactile IN (0,1)),
 parking INTEGER NOT NULL DEFAULT 0 CHECK(parking IN (0,1)),
 verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN (0,1)),
 is_demo INTEGER NOT NULL DEFAULT 1 CHECK(is_demo IN (0,1)),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS favorites (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
 PRIMARY KEY(user_id,place_id)
);
CREATE TABLE IF NOT EXISTS reviews (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
 rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), comment TEXT NOT NULL CHECK(length(comment) BETWEEN 5 AND 1000),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(user_id,place_id)
);
CREATE TABLE IF NOT EXISTS reports (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 place_id INTEGER REFERENCES places(id) ON DELETE SET NULL,
 title TEXT NOT NULL, description TEXT NOT NULL,
 type TEXT NOT NULL CHECK(type IN ('Rampa bloqueada','Vereda da�ada','Sin acceso','Informaci�n incorrecta','Otro')),
 status TEXT NOT NULL DEFAULT 'Pendiente' CHECK(status IN ('Pendiente','En revisi�n','Resuelto')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS saved_routes (
 id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL, origin TEXT NOT NULL, destination TEXT NOT NULL,
 travel_mode TEXT NOT NULL CHECK(travel_mode IN ('WALKING','DRIVING','BICYCLING','TRANSIT')),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_places_category ON places(category,district);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id,status);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_reviews_place ON reviews(place_id);
