# Ruta Accesible

Mapa y directorio de Huancayo, El Tambo y Chilca. Permite comparar recorridos según las barreras registradas, consultar las condiciones de cada cuadra y reportar obstáculos con su ubicación.

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
| `GOOGLE_MAPS_API_KEY` | Activa el fondo de Google Maps para la capa de rutas y barreras. Habilita **Maps JavaScript API** y limita la clave a los sitios autorizados, por ejemplo `http://127.0.0.1:3001/*`. Para el cálculo de indicaciones externas dentro del planificador clásico, habilita también **Routes API**. |
| `GOOGLE_MAPS_MAP_ID` | Identificador de mapa de Google. El valor de prueba es `DEMO_MAP_ID`. |

En **Mapa → Google Maps** puedes explorar las calles del centro de Huancayo sin configurar una clave. Con una clave de Maps JavaScript activa, **Rutas y barreras** dibuja los tramos y avisos directamente sobre Google Maps. Si la clave está vacía o el servicio falla, esa vista usa Leaflet y OpenStreetMap. Los recorridos y avisos se calculan con la red y los reportes de SQLite. [Configurar la API de Google Maps](https://developers.google.com/maps/documentation/javascript/get-api-key?hl=es).

## Usar el mapa

En **Mapa**, selecciona un origen y destino del directorio o márcalos sobre el mapa. Pulsa **Comparar recorridos** para centrar **Rutas y barreras** en el resultado. La primera opción prioriza las preferencias de movilidad y la segunda muestra el camino más corto dentro de la red registrada. Los botones de **Cuadra por cuadra** muestran accesos, medidas y avisos.

**Probar Plaza Constitución → Huamanmarca** carga una red de demostración. Sus condiciones son simuladas. Los recorridos reales cubren solo los tramos incorporados y revisados en campo. El estado de cada tramo indica cuánto se conoce de él. El mapa informa cuando un punto queda fuera de cobertura.

Un reporte marcado en el mapa aparece en **Administración → Verificación de campo**. Desde ahí se puede publicar una advertencia o cerrar el tramo asociado. El cierre se aplica al cálculo hasta que se retira o se resuelve el reporte. En el mismo panel se pueden registrar puntos, medir tramos y entradas, y publicar recorridos que conecten tramos verificados.

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

`backend/ruta_accesible/schema.sql` define el directorio y la actividad de usuarios. `mobility_schema.sql` agrega puntos, tramos, revisiones de campo, ubicación de reportes y preferencias. Cada tramo conecta dos puntos. Sus mediciones se guardan por revisión, y el cálculo usa la última. Las barreras activas se obtienen del último movimiento de cada reporte en `report_events`.

FastAPI calcula ambos recorridos con Dijkstra. Para la alternativa descarta cierres y condiciones incompatibles con los filtros, y penaliza los avisos activos y la información incompleta. El resultado diferencia tramos verificados, sin revisar y de demostración. El cálculo usa la longitud de los segmentos registrados y avisa si el origen o destino quedan separados de la red.

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
