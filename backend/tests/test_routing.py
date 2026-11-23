import unittest
from dataclasses import replace

from backend.ruta_accesible.pilot_data import NODES, SEGMENTS
from backend.ruta_accesible.routing import Preferences, Segment, compare, nearest_node


class RoutingTest(unittest.TestCase):
    def setUp(self):
        self.nodes = {key: (lat, lng) for key, _, lat, lng in NODES}
        self.network = [Segment(
            key, name, a, b, self.nodes[a], self.nodes[b],
            "demo", bool(stairs), crossing, surface, slope, width, "", None,
        ) for key,name,a,b,stairs,crossing,surface,slope,width in SEGMENTS]

    def test_avoids_steps_and_replans_when_segment_closes(self):
        options = compare(self.network, 1, 4, Preferences())
        self.assertIn(2, [item["id"] for item in options["direct"]["segments"]])
        choice = options["alternative"]
        self.assertTrue(choice["demonstration"])
        self.assertTrue(choice["unverified_count"])
        self.assertNotIn(2, [item["id"] for item in choice["segments"]])
        first_id = choice["segments"][0]["id"]
        blocked = [replace(segment,closed=True) if segment.id == first_id else segment for segment in self.network]
        after = compare(blocked, 1, 4, Preferences())["alternative"]
        self.assertIsNotNone(after)
        self.assertNotIn(first_id, [item["id"] for item in after["segments"]])

    def test_strict_profile_excludes_demo_and_outside_coverage(self):
        options = compare(self.network, 1, 4, Preferences(verified_only=True))
        self.assertIsNone(options["alternative"])
        self.assertIsNotNone(options["direct"])
        self.assertIsNone(nearest_node((-12.16, -75.25), self.nodes))
        self.assertEqual(nearest_node(self.nodes[1],self.nodes), (1, 0.0))
