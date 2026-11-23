from dataclasses import asdict, dataclass
from heapq import heappop, heappush
from math import asin, cos, radians, sin, sqrt

Point = tuple[float, float]


@dataclass(frozen=True)
class Preferences:
    avoid_stairs: bool = True
    avoid_rough: bool = False
    verified_only: bool = False
    max_slope: float | None = None
    min_width: int | None = None


def metres(first: Point, second: Point) -> float:
    a, b = radians(first[0]), radians(second[0])
    delta = radians(second[1] - first[1])
    part = sin((b - a) / 2)**2 + cos(a) * cos(b) * sin(delta / 2)**2
    return 12742000 * asin(sqrt(min(1.0, max(0.0, part))))


@dataclass(frozen=True)
class Segment:
    id: int
    name: str
    start: int
    end: int
    a: Point
    b: Point
    quality: str
    stairs: bool | None
    crossing: str
    surface: str
    slope_percent: float | None
    width_cm: int | None
    notes: str
    checked_at: str | None
    closed: bool = False
    alert_count: int = 0

    @property
    def length(self) -> float:
        return metres(self.a, self.b)

    def issues(self, prefs: Preferences) -> list[str]:
        result = []
        if self.stairs or self.crossing == "step":
            result.append("escalones")
        if self.surface == "rough":
            result.append("vereda irregular")
        if prefs.max_slope is not None and self.slope_percent is not None and self.slope_percent > prefs.max_slope:
            result.append("pendiente mayor que tu preferencia")
        if prefs.min_width is not None and self.width_cm is not None and self.width_cm < prefs.min_width:
            result.append("paso más estrecho que tu preferencia")
        if self.alert_count:
            result.append("aviso activo")
        return result

    def compatible(self, prefs: Preferences) -> bool:
        if self.closed or prefs.verified_only and self.quality != "verified":
            return False
        if prefs.avoid_stairs and (self.stairs or self.crossing == "step"):
            return False
        if prefs.avoid_rough and self.surface == "rough":
            return False
        if prefs.max_slope is not None and self.slope_percent is not None and self.slope_percent > prefs.max_slope:
            return False
        if prefs.min_width is not None and self.width_cm is not None and self.width_cm < prefs.min_width:
            return False
        return True

    def public(self) -> dict:
        return asdict(self) | {"meters": round(self.length)}


def nearest_node(point: Point, nodes: dict[int, Point], max_gap: float = 80) -> tuple[int, float] | None:
    if not nodes:
        return None
    distance, node_id = min((metres(point, location), key) for key, location in nodes.items())
    return (node_id, distance) if distance <= max_gap else None


def shortest_path(segments: list[Segment], origin: int, destination: int, prefs: Preferences,
                  *, accessible: bool) -> list[tuple[Segment, Point, Point]] | None:
    graph: dict[int, list[tuple[int, Segment, float]]] = {}
    for segment in segments:
        if segment.closed or accessible and not segment.compatible(prefs):
            continue
        cost = segment.length
        if accessible:
            # Un aviso vigente o información incompleta hacen menos útil una cuadra
            # aunque la distancia sea menor. Una prohibición explícita se filtra arriba.
            if segment.quality == "unknown":
                cost += 160
            cost += 95 * segment.alert_count + 48 * len(segment.issues(prefs))
        graph.setdefault(segment.start, []).append((segment.end, segment, cost))
        graph.setdefault(segment.end, []).append((segment.start, segment, cost))

    best = {origin: 0.0}
    previous = {}
    queue = [(0.0, origin)]
    while queue:
        cost, node = heappop(queue)
        if cost > best[node]:
            continue
        if node == destination:
            break
        for neighbour, segment, weight in graph.get(node, ()):
            proposal = cost + weight
            if proposal < best.get(neighbour, float("inf")):
                best[neighbour] = proposal
                previous[neighbour] = (node, segment)
                heappush(queue, (proposal, neighbour))
    if destination not in best or origin == destination:
        return None
    route = []
    node = destination
    while node != origin:
        prior, segment = previous[node]
        forward = prior == segment.start
        route.append((segment, segment.a if forward else segment.b, segment.b if forward else segment.a))
        node = prior
    route.reverse()
    return route


def route_data(path: list[tuple[Segment, Point, Point]], prefs: Preferences) -> dict:
    steps = []
    for segment, a, b in path:
        steps.append(segment.public() | {"a": a, "b": b, "issues": segment.issues(prefs)})
    return {
        "meters": round(sum(segment.length for segment, _, _ in path)),
        "segments": steps,
        "geometry": [path[0][1]] + [end for _, _, end in path],
        "demonstration": any(item["quality"] == "demo" for item in steps),
        "unverified_count": sum(item["quality"] != "verified" for item in steps),
        "barrier_count": sum(bool(item["issues"]) for item in steps),
    }


def compare(segments: list[Segment], origin: int, destination: int, prefs: Preferences) -> dict:
    direct = shortest_path(segments, origin, destination, prefs, accessible=False)
    alternative = shortest_path(segments, origin, destination, prefs, accessible=True)
    return {"direct": route_data(direct, prefs) if direct else None,
            "alternative": route_data(alternative, prefs) if alternative else None}
