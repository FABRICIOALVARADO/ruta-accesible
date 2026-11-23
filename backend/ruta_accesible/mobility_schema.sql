CREATE TABLE IF NOT EXISTS map_junctions (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    lat REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
    UNIQUE (lat, lng)
);

CREATE TABLE IF NOT EXISTS map_segments (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(name) BETWEEN 3 AND 120),
    start_id INTEGER NOT NULL REFERENCES map_junctions(id),
    end_id INTEGER NOT NULL REFERENCES map_junctions(id),
    is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
    CHECK (start_id < end_id),
    UNIQUE (start_id, end_id)
);

CREATE TABLE IF NOT EXISTS segment_checks (
    id INTEGER PRIMARY KEY,
    segment_id INTEGER NOT NULL REFERENCES map_segments(id),
    stairs INTEGER CHECK (stairs IN (0, 1)),
    crossing TEXT NOT NULL CHECK (crossing IN ('ramp', 'level', 'step', 'unknown')),
    surface TEXT NOT NULL CHECK (surface IN ('even', 'rough', 'unknown')),
    slope_percent REAL CHECK (slope_percent BETWEEN 0 AND 100),
    width_cm INTEGER CHECK (width_cm BETWEEN 20 AND 1000),
    notes TEXT NOT NULL DEFAULT '',
    verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
    checked_by INTEGER REFERENCES users(id),
    checked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    CHECK (verified = 0 OR (checked_by IS NOT NULL AND stairs IS NOT NULL AND crossing <> 'unknown'
        AND surface <> 'unknown' AND slope_percent IS NOT NULL AND width_cm IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_segment_checks_latest ON segment_checks(segment_id, id DESC);

CREATE TABLE IF NOT EXISTS report_locations (
    report_id INTEGER PRIMARY KEY REFERENCES reports(id) ON DELETE CASCADE,
    segment_id INTEGER REFERENCES map_segments(id),
    lat REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
    map_effect TEXT NOT NULL DEFAULT 'hidden' CHECK (map_effect IN ('hidden', 'warning', 'closed')),
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TEXT,
    CHECK (map_effect = 'hidden' OR reviewed_by IS NOT NULL),
    CHECK (map_effect <> 'closed' OR segment_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_report_locations_segment ON report_locations(segment_id);

CREATE TABLE IF NOT EXISTS place_access (
    place_id INTEGER PRIMARY KEY REFERENCES places(id) ON DELETE CASCADE,
    steps INTEGER CHECK (steps BETWEEN 0 AND 99),
    door_cm INTEGER CHECK (door_cm BETWEEN 20 AND 1000),
    toilet TEXT NOT NULL CHECK (toilet IN ('yes', 'no', 'unknown')),
    entrance TEXT NOT NULL CHECK (entrance IN ('ramp', 'level', 'step', 'unknown')),
    photo_url TEXT,
    notes TEXT NOT NULL DEFAULT '',
    verified INTEGER NOT NULL CHECK (verified IN (0, 1)),
    checked_by INTEGER NOT NULL REFERENCES users(id),
    checked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    CHECK (verified = 0 OR ((steps IS NOT NULL AND door_cm IS NOT NULL AND toilet <> 'unknown' AND entrance <> 'unknown')))
);

CREATE TABLE IF NOT EXISTS route_preferences (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    avoid_stairs INTEGER NOT NULL CHECK (avoid_stairs IN (0, 1)),
    avoid_rough INTEGER NOT NULL CHECK (avoid_rough IN (0, 1)),
    verified_only INTEGER NOT NULL CHECK (verified_only IN (0, 1)),
    max_slope REAL CHECK (max_slope BETWEEN 1 AND 100),
    min_width INTEGER CHECK (min_width BETWEEN 20 AND 1000)
);

CREATE TABLE IF NOT EXISTS curated_walks (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE CHECK (length(name) BETWEEN 3 AND 120),
    description TEXT NOT NULL CHECK (length(description) BETWEEN 8 AND 500),
    start_id INTEGER NOT NULL REFERENCES map_junctions(id),
    end_id INTEGER NOT NULL REFERENCES map_junctions(id),
    is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
    CHECK (start_id <> end_id)
);
