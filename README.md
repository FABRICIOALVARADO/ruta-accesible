# Ruta Accesible

Directorio de lugares de Huancayo, El Tambo y Chilca. Permite consultar rampas, baños adaptados y otras facilidades de acceso, planificar recorridos y reportar barreras. Las fichas iniciales incluyen datos de demostración que requieren verificación en campo.

## Empezar en Windows

Requisitos para compilar desde el código fuente: **Python 3.13** y **Node.js 24.15 o posterior de la serie 24**, o una versión compatible con Angular 22. Abre la carpeta del proyecto y ejecuta `iniciar.cmd`. También puedes abrir PowerShell en esa carpeta y usar:

```powershell
npm start
```

El script prepara `.venv`, compila Angular cuando falta el resultado y abre [http://127.0.0.1:3001](http://127.0.0.1:3001). Mantén la terminal abierta para usar la web. La primera instalación desde el código fuente requiere conexión a los registros de dependencias.

El paquete **Ruta-Accesible-Windows** de GitHub Actions trae Angular compilado y las dependencias de Python para Windows x64. Con Python 3.13 x64, basta extraer el ZIP y abrir `iniciar.cmd`.

### Configuración

Copia `.env.example` a `.env` en la raíz. Reinicia después de ajustar las variables que necesites.

| Variable | Uso |
| --- | --- |
| `PORT` | Puerto local. Por defecto, 3001. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Crean la cuenta administradora inicial. Usa un correo que todavía no esté registrado y una contraseña de al menos 12 caracteres. |
| `GOOGLE_MAPS_API_KEY` | Habilita el mapa de calles y el cálculo de rutas desde la web. Activa **Maps JavaScript API** y **Routes API** y restringe la clave al origen local en Google Cloud. |
| `GOOGLE_MAPS_MAP_ID` | Identificador de mapa de Google. El valor de prueba es `DEMO_MAP_ID`. |

Sin clave, el directorio conserva el plano esquemático. El planificador muestra una distancia en línea recta cuando conoce ambos puntos y ofrece un enlace a las indicaciones de Google Maps.

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `frontend/src/app/pages/` | Pantallas de inicio, directorio, fichas, recorridos, comunidad, cuenta y administración. |
| `frontend/src/app/core/` | Cliente HTTP, sesión, tipos y conexión con Google Maps. |
| `frontend/src/app/shared/` | Tarjetas de lugar y mapa que se usan en varias pantallas. |
| `backend/ruta_accesible/` | API con FastAPI, validaciones con Pydantic, autenticación y acceso a SQLite. |
| `backend/tests/`, `frontend/e2e/` | Pruebas de API y recorridos de usuario en Chromium. |

Angular usa TypeScript, plantillas HTML, CSS y Bootstrap. Se compila a JavaScript. FastAPI entrega los archivos compilados y responde a `/api` en el mismo puerto. La documentación de las rutas de la API está en [http://127.0.0.1:3001/docs](http://127.0.0.1:3001/docs).

### Base de datos

`backend/ruta_accesible/schema.sql` define el esquema. Los distritos, categorías, facilidades, tipos y estados de reporte y modos de transporte viven en catálogos. `place_facilities` relaciona lugares con sus facilidades y `favorites` relaciona usuarios con lugares. La calificación se calcula desde las reseñas. El estado vigente de cada reporte se obtiene de su último movimiento en `report_events`. Así se evita duplicar etiquetas, promedios y estados.

El archivo `data/ruta-accesible-fastapi.db` se inicializa en el primer arranque. Si existe `data/ruta-accesible.db` de la edición anterior, se importan los registros una vez y se conserva el archivo de origen. La migración mantiene usuarios, lugares, reseñas, favoritos, reportes y recorridos guardados. Las sesiones se vuelven a iniciar en la edición nueva.

## Pruebas

```powershell
python -m pip install -r backend/requirements-dev.txt
python -m unittest discover -s backend/tests -v
npm --prefix frontend install
npm --prefix frontend run build
npm --prefix frontend exec -- playwright install chromium
npm --prefix frontend run test:e2e
```

La compilación y las pruebas corren en GitHub Actions. El entorno de pruebas usa SQLite con datos separados de la instalación local.

Fotos de Huancayo en Wikimedia Commons: [vista de la ciudad](https://commons.wikimedia.org/wiki/File:Huancayo_Peru.jpg), [plaza Constitución](https://commons.wikimedia.org/wiki/File:Plaza_Constituci%C3%B3n_-_Huancayo.jpg) y [parque de la Identidad Wanka](https://commons.wikimedia.org/wiki/File:Parque_de_la_Identidad_Wanka,_Huancayo,_Per%C3%BA_01.jpg).
