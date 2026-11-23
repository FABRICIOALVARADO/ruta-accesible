import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
import webbrowser

from backend.ruta_accesible.config import ROOT, Settings, read_env


def run(*args: str, cwd=ROOT) -> None:
    subprocess.run(args, cwd=cwd, check=True)


def prepare() -> str:
    if sys.version_info < (3, 11):
        raise RuntimeError("Instala Python 3.13 para ejecutar el proyecto.")
    env = ROOT / ".venv"
    python = env / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not python.is_file():
        print("Creando el entorno de Python…", flush=True)
        run(sys.executable, "-m", "venv", str(env))

    requirements = ROOT / "backend" / "requirements.txt"
    stamp = env / "ruta-requisitos"
    digest = hashlib.sha256(requirements.read_bytes()).hexdigest()
    if not stamp.is_file() or stamp.read_text(encoding="utf-8") != digest:
        print("Preparando las dependencias de FastAPI…", flush=True)
        options = []
        wheels = ROOT / "paquetes-windows"
        if wheels.is_dir() and os.name == "nt" and sys.version_info[:2] == (3, 13):
            options = ["--no-index", "--find-links", str(wheels)]
        run(str(python), "-m", "pip", "install", "--disable-pip-version-check", *options, "-r", str(requirements))
        stamp.write_text(digest, encoding="utf-8")

    frontend = ROOT / "frontend"
    if not (Settings.from_env().frontend / "index.html").is_file():
        npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
        if not npm:
            raise RuntimeError("Instala Node.js 24.15 o superior de la serie 24 para compilar Angular.")
        print("Compilando Angular…", flush=True)
        install = "ci" if (frontend / "package-lock.json").is_file() else "install"
        run(npm, install, "--no-audit", "--no-fund", cwd=frontend)
        run(npm, "run", "build", cwd=frontend)
    return str(python)


def start(python: str, open_browser: bool) -> None:
    port = int(read_env().get("PORT", "3001"))
    if not 1024 <= port <= 65535:
        raise ValueError("Indica un puerto entre 1024 y 65535 en .env.")
    url = f"http://127.0.0.1:{port}"
    # La comprobación es local y evita enviar la solicitud a un proxy.
    client = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    print(f"Iniciando Ruta Accesible en {url}", flush=True)
    with subprocess.Popen(
        [python, "-m", "uvicorn", "backend.ruta_accesible.main:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=ROOT,
    ) as server:
        try:
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline and server.poll() is None:
                try:
                    with client.open(url + "/api/health", timeout=1) as response:
                        healthy = json.load(response).get("backend") == "FastAPI"
                    with client.open(url + "/", timeout=1) as response:
                        frontend_ready = b"<ra-root" in response.read() and response.status == 200
                    if healthy and frontend_ready and server.poll() is None:
                        print(f"Ruta Accesible lista: {url}", flush=True)
                        if open_browser:
                            webbrowser.open(url, new=2)
                        break
                except (OSError, ValueError):
                    pass
                time.sleep(.4)
            else:
                raise RuntimeError(f"No se pudo iniciar el servidor. Revisa si el puerto {port} está ocupado.")
            server.wait()
            if server.returncode:
                raise RuntimeError("El servidor terminó con un error. Revisa el mensaje anterior.")
        finally:
            if server.poll() is None:
                server.terminate()


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepara y abre Ruta Accesible.")
    parser.add_argument("--solo-preparar", action="store_true")
    parser.add_argument("--sin-navegador", action="store_true")
    args = parser.parse_args()
    try:
        python = prepare()
        if not args.solo_preparar:
            start(python, not args.sin_navegador)
    except KeyboardInterrupt:
        return 0
    except (OSError, RuntimeError, ValueError, subprocess.CalledProcessError) as error:
        print(f"No se pudo iniciar Ruta Accesible: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
