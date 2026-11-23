PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS districts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS facilities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS report_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS report_statuses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS travel_modes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 80),
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member', 'admin')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS places (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 120),
    category_id TEXT NOT NULL REFERENCES categories(id),
    district_id TEXT NOT NULL REFERENCES districts(id),
    address TEXT NOT NULL CHECK(length(address) BETWEEN 3 AND 200),
    description TEXT NOT NULL CHECK(length(description) BETWEEN 10 AND 1500),
    lat REAL NOT NULL CHECK(lat BETWEEN -90 AND 90),
    lng REAL NOT NULL CHECK(lng BETWEEN -180 AND 180),
    image TEXT NOT NULL DEFAULT 'plaza' CHECK(image IN ('plaza','park','hill','shop','health','culture','cafe')),
    is_demo INTEGER NOT NULL DEFAULT 1 CHECK(is_demo IN (0, 1)),
    verified_at TEXT,
    archived_at TEXT,
    CHECK(is_demo = 0 OR verified_at IS NULL)
);
CREATE TABLE IF NOT EXISTS place_facilities (
    place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    facility_id TEXT NOT NULL REFERENCES facilities(id),
    PRIMARY KEY(place_id, facility_id)
);
CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    PRIMARY KEY(user_id, place_id)
);
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL CHECK(length(comment) BETWEEN 5 AND 1000),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(user_id, place_id)
);
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    place_id INTEGER REFERENCES places(id),
    location TEXT CHECK(length(location) BETWEEN 3 AND 200),
    type_id TEXT NOT NULL REFERENCES report_types(id),
    title TEXT NOT NULL CHECK(length(title) BETWEEN 5 AND 120),
    description TEXT NOT NULL CHECK(length(description) BETWEEN 10 AND 1500),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    CHECK(place_id IS NOT NULL OR location IS NOT NULL)
);
-- El estado actual se obtiene del último movimiento del reporte.
CREATE TABLE IF NOT EXISTS report_events (
    id INTEGER PRIMARY KEY,
    report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    status_id TEXT NOT NULL REFERENCES report_statuses(id),
    actor_id INTEGER NOT NULL REFERENCES users(id),
    changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS saved_routes (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 120),
    origin TEXT NOT NULL CHECK(length(origin) BETWEEN 3 AND 200),
    destination TEXT NOT NULL CHECK(length(destination) BETWEEN 3 AND 200),
    mode_id TEXT NOT NULL REFERENCES travel_modes(id),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_places_catalog ON places(district_id, category_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_reviews_place ON reviews(place_id);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_report_events_latest ON report_events(report_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_routes_user ON saved_routes(user_id);
