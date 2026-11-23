import os
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path

from fastapi.testclient import TestClient

from backend.ruta_accesible.config import ROOT, Settings
from backend.ruta_accesible.main import create_app


class FlowTest(unittest.TestCase):
    def test_complete_member_and_admin_flow(self):
        with tempfile.TemporaryDirectory(dir=ROOT / "data") as directory, ExitStack() as stack:
            path = Path(directory)
            (path / "index.html").write_text("<h1>Ruta Accesible</h1>", encoding="utf-8")
            settings = Settings(
                database=path / "prueba.db", legacy_database=None, frontend=path,
                admin_email="admin@example.test", admin_password="PruebaLocal123!",
            )
            app = create_app(settings)
            member = stack.enter_context(TestClient(app))
            stranger = TestClient(app)
            administrator = TestClient(app)

            self.assertEqual(member.get("/api/health").json()["backend"], "FastAPI")
            self.assertIn("Ruta Accesible", member.get("/explorar").text)
            self.assertEqual(member.get("/api/no-existe").status_code, 404)
            places = member.get("/api/places", params={"q": "constitucion", "facility": "ramp"}).json()
            self.assertEqual(len(places), 1)
            place = places[0]["id"]

            self.assertEqual(member.get("/api/me/favorites").status_code, 401)
            self.assertEqual(member.post("/api/auth/register", json={"name": "a", "email": "x", "password": "x"}).status_code, 422)
            account = {"name": "Fabricio", "email": "fabricio@example.test", "password": "PruebaCuenta123!"}
            self.assertEqual(member.post("/api/auth/register", json=account).status_code, 201)
            self.assertEqual(member.post("/api/auth/register", json=account).status_code, 409)
            self.assertEqual(member.post("/api/auth/logout", headers={"origin": "https://other.example"}).status_code, 403)
            self.assertEqual(member.put(f"/api/me/favorites/{place}").status_code, 204)
            self.assertEqual(member.put(f"/api/me/favorites/{place}").status_code, 204)
            self.assertEqual(member.get("/api/me/favorites").json(), [place])
            self.assertEqual(member.put(f"/api/places/{place}/review", json={"rating": 8, "comment": "Buen lugar"}).status_code, 422)
            for rating in [4, 5]:
                self.assertEqual(member.put(f"/api/places/{place}/review", json={"rating": rating, "comment": "Buen lugar"}).status_code, 204)
            detail = member.get(f"/api/places/{place}").json()
            self.assertEqual(len(detail["reviews"]), 1)
            self.assertEqual(detail["place"]["rating"], 5)
            self.assertNotIn("email", detail["reviews"][0])

            report = member.post("/api/me/reports", json={
                "title": "Rampa bloqueada", "description": "Observación de prueba para la rampa.",
                "place_id": place, "type_id": "blocked-ramp",
            })
            self.assertEqual(report.status_code, 201)
            report_id = report.json()["id"]
            route = member.post("/api/me/routes", json={
                "name": "Visita de prueba", "origin": "Plaza Constitución", "destination": "Parque Identidad", "mode_id": "walking",
            })
            self.assertEqual(route.status_code, 201)
            self.assertEqual(member.get("/api/admin/places").status_code, 403)
            self.assertEqual(stranger.post("/api/auth/register", json=account | {"email": "otra@example.test"}).status_code, 201)
            self.assertEqual(stranger.get(f"/api/me/reports/{report_id}/history").status_code, 404)
            self.assertEqual(stranger.delete(f"/api/me/routes/{route.json()['id']}").status_code, 404)

            self.assertEqual(administrator.post("/api/auth/login", json={
                "email": "admin@example.test", "password": "PruebaLocal123!",
            }).status_code, 200)
            for status, code in [("resolved", 409), ("reviewing", 200), ("resolved", 200)]:
                self.assertEqual(administrator.patch(f"/api/admin/reports/{report_id}", json={"status_id": status}).status_code, code)
            history = member.get(f"/api/me/reports/{report_id}/history").json()
            self.assertEqual([item["status_id"] for item in history], ["pending", "reviewing", "resolved"])

            payload = {
                "name": "Punto de control", "address": "Av. Prueba 123", "district_id": "huancayo",
                "category_id": "service", "description": "Lugar nuevo para probar el mantenimiento del catálogo.",
                "lat": -12.07, "lng": -75.21, "is_demo": True, "facilities": ["ramp", "tactile"],
            }
            added = administrator.post("/api/admin/places", json=payload)
            self.assertEqual(added.status_code, 201)
            added_id = added.json()["id"]
            self.assertEqual(administrator.put(f"/api/admin/places/{added_id}", json=payload | {"name": "Punto revisado"}).status_code, 200)
            self.assertEqual(administrator.delete(f"/api/admin/places/{added_id}").status_code, 204)
            self.assertEqual(member.get(f"/api/places/{added_id}").status_code, 404)
            self.assertEqual(administrator.post(f"/api/admin/places/{added_id}/restore").status_code, 204)
            self.assertEqual(member.get(f"/api/places/{added_id}").json()["place"]["name"], "Punto revisado")
            self.assertIn("Punto revisado", administrator.get("/api/admin/places.csv").text)
            self.assertEqual(member.post("/api/auth/logout").status_code, 204)
            self.assertEqual(member.get("/api/me/favorites").status_code, 401)


if __name__ == "__main__":
    unittest.main()
