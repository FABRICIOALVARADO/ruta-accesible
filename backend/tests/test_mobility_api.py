import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path

from fastapi.testclient import TestClient

from backend.ruta_accesible.config import ROOT, Settings
from backend.ruta_accesible.main import create_app


class MobilityApiTest(unittest.TestCase):
    def test_barrier_moderation_changes_the_map_and_comparison(self):
        with tempfile.TemporaryDirectory(dir=ROOT / "data") as folder, ExitStack() as stack:
            app = create_app(Settings(
                database=Path(folder) / "mapa.db", legacy_database=None,
                admin_email="admin@example.test", admin_password="PruebaAdminMapa123!",
            ))
            visitor = stack.enter_context(TestClient(app))
            admin = stack.enter_context(TestClient(app))
            network = visitor.get("/api/map/network").json()
            nodes = {node["id"]: node for node in network["junctions"]}

            def point(identifier):
                return {key: nodes[identifier][key] for key in ("lat", "lng")}

            plan = {"origin": point(1), "destination": point(4), "preferences": {"avoid_stairs": True}}
            result = visitor.post("/api/map/compare", json=plan)
            self.assertEqual(result.status_code, 200)
            first = result.json()["alternative"]["segments"][0]
            self.assertEqual(visitor.get("/api/map/walks").json()[0]["state"], "demo")
            self.assertEqual(visitor.post("/api/auth/register", json={
                "email": "vecino@example.test", "password": "PruebaVecino123!", "name": "Vecino Prueba",
            }).status_code, 201)
            self.assertEqual(visitor.put("/api/map/preferences", json={"avoid_stairs": True, "min_width": 80}).status_code, 200)
            self.assertEqual(visitor.get("/api/map/preferences").json()["min_width"], 80)

            report = visitor.post("/api/me/reports", json={
                "type_id": "blocked-ramp", "title": "Rampa bloqueada", "description": "Obstáculo de prueba en la rampa marcada.",
                "location": "Centro de Huancayo", "lat": (first["a"][0]+first["b"][0])/2, "lng": (first["a"][1]+first["b"][1])/2,
            })
            self.assertEqual(report.status_code, 201)
            report_id = report.json()["id"]
            address = f"/api/admin/map/reports/{report_id}"
            self.assertEqual(visitor.put(address, json={"effect": "closed"}).status_code, 403)
            self.assertEqual(visitor.get("/api/map/network").json()["barriers"], [])
            self.assertEqual(admin.post("/api/auth/login", json={
                "email": "admin@example.test", "password": "PruebaAdminMapa123!",
            }).status_code, 200)
            self.assertEqual(admin.put(address, json={"effect": "closed"}).status_code, 200)
            barrier = visitor.get("/api/map/network").json()["barriers"][0]
            self.assertEqual(barrier["segment_id"], first["id"])
            self.assertNotIn("user_id", barrier)
            after = visitor.post("/api/map/compare", json=plan).json()["alternative"]["segments"]
            self.assertNotIn(first["id"], [item["id"] for item in after])
            self.assertEqual(admin.patch(f"/api/admin/reports/{report_id}", json={"status_id":"resolved"}).status_code, 200)
            self.assertEqual(visitor.get("/api/map/network").json()["barriers"], [])

    def test_requires_real_and_complete_surveys_for_a_verified_route(self):
        with tempfile.TemporaryDirectory(dir=ROOT / "data") as folder:
            app = create_app(Settings(database=Path(folder)/"survey.db", legacy_database=None,
                                      admin_email="admin@example.test", admin_password="PruebaAdminMapa123!"))
            with TestClient(app) as client:
                self.assertEqual(client.post("/api/auth/login", json={"email":"admin@example.test","password":"PruebaAdminMapa123!"}).status_code, 200)
                self.assertEqual(client.post("/api/admin/map/segments/1/checks", json={"verified":True}).status_code, 422)
                survey = {"verified": True, "stairs": False, "crossing": "ramp", "surface": "even", "slope_percent": 3, "width_cm": 145}
                self.assertEqual(client.post("/api/admin/map/segments/1/checks", json=survey).status_code, 409)
                segment = client.post("/api/admin/map/segments", json={"name":"Tramo real de prueba","start_id":1,"end_id":4})
                self.assertEqual(segment.status_code, 201)
                walk = {"name":"Recorrido de prueba","start_id":1,"end_id":4,"description":"Comprobación de medidas de la ruta."}
                self.assertEqual(client.post("/api/admin/map/walks", json=walk).status_code, 409)
                self.assertEqual(client.post("/api/admin/map/segments/"+str(segment.json()["id"])+"/checks", json=survey).status_code, 201)
                self.assertEqual(client.post("/api/admin/map/walks", json=walk).status_code, 201)
                self.assertEqual(client.get("/api/map/walks").json()[0]["state"], "verified")
                self.assertEqual(client.put("/api/admin/map/places/1/access", json={"steps":0,"door_cm":120,"toilet":"unknown","entrance":"ramp","verified":False}).status_code, 200)
                self.assertEqual(client.get("/api/map/places/1/access").json()["door_cm"], 120)
