# Ruta Accesible

¿Cómo llegar de la plaza Constitución a Huamanmarca si necesitas evitar los escalones? Ruta Accesible permite comparar el camino más corto con otro que toma en cuenta el ancho de las veredas, la pendiente y las barreras registradas. El directorio reúne lugares de Huancayo, El Tambo y Chilca.

## Abrir el proyecto en Windows

Con **Python 3.13 x64**, descarga el paquete **Ruta-Accesible-Windows** de una [compilación de la rama principal](https://github.com/FABRICIOALVARADO/ruta-accesible/actions/workflows/verificar.yml?query=branch%3Amain). Extrae el ZIP y haz doble clic en `iniciar.cmd`. Deja abierta la terminal mientras uses la página. [Abrir el mapa local](http://127.0.0.1:3001/mapa).

Si descargaste el código fuente, instala también **Node.js 24.15 o posterior de la serie 24**. Desde la carpeta donde está este README, ejecuta lo siguiente en PowerShell.

```powershell
.\iniciar.cmd
```

El primer arranque desde el código fuente descarga las dependencias y compila Angular. En el paquete de Windows, la interfaz ya viene compilada. También puedes arrancar el proyecto con `npm start`.

## Un recorrido por el centro

En **Mapa**, pulsa **Probar Plaza Constitución → Huamanmarca**. Cambia entre **Menos barreras registradas** y **Más corto en la red**. En **Cuadra por cuadra**, selecciona un tramo para ver los escalones, el ancho y la pendiente.

El ejemplo usa mediciones simuladas. Las fichas distinguen los tramos de demostración de los revisados en campo. Para comunicar un obstáculo, pulsa **Marcar barrera**, señala el punto y completa el reporte. Un administrador puede revisarlo y cerrar ese tramo hasta que vuelva a estar disponible.

## Google Maps y configuración local

La pestaña **Google Maps** abre el centro de Huancayo con conexión a internet. **Rutas y barreras** muestra el trazado calculado por el proyecto. Para dibujarlo sobre las calles de Google, copia `.env.example` a `.env`, configura tu clave y reinicia la aplicación. Con la configuración inicial, esa capa usa OpenStreetMap. [Configuración de Maps JavaScript](https://developers.google.com/maps/documentation/javascript/get-api-key?hl=es).

| Variable | Uso |
| --- | --- |
| `GOOGLE_MAPS_API_KEY` | Clave de Maps JavaScript para el navegador. Restringe los sitios permitidos al origen que uses, como `http://127.0.0.1:3001/*`. El planificador de indicaciones de Google también usa Routes API. |
| `GOOGLE_MAPS_MAP_ID` | Identificador de mapa. Para pruebas se incluye `DEMO_MAP_ID`. |
| `PORT` | Puerto de la web. Por defecto se usa el 3001. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Cuenta inicial de administración. Usa un correo sin registrar y una contraseña de al menos 12 caracteres. |

## Código y datos

- `frontend/src/app/` contiene las pantallas de Angular en TypeScript. Las plantillas y los estilos usan HTML, CSS y Bootstrap.
- `backend/ruta_accesible/` contiene la API de FastAPI. El cálculo de recorridos está en `routing.py`. Usa Dijkstra sobre los tramos registrados y aplica las preferencias de movilidad al comparar alternativas. [API local](http://127.0.0.1:3001/docs).
- `schema.sql` y `mobility_schema.sql`, dentro del backend, definen el directorio, los usuarios, los cruces y las revisiones de los tramos. Los datos se guardan en `data/ruta-accesible-fastapi.db`. En el primer arranque se importan los registros si hay una base anterior en `data/ruta-accesible.db`.

## Pruebas

Desde la raíz, con el entorno de Python activo, puedes ejecutar las mismas pruebas de API y navegador que utiliza GitHub Actions.

```powershell
python -m pip install -r backend/requirements-dev.txt
python -m unittest discover -s backend/tests -v
npm --prefix frontend install
npm --prefix frontend run build
npm --prefix frontend exec -- playwright install chromium
npm --prefix frontend run test:e2e
```

Fotografías en Wikimedia Commons · [Huancayo](https://commons.wikimedia.org/wiki/File:Huancayo_Peru.jpg) · [Plaza Constitución](https://commons.wikimedia.org/wiki/File:Plaza_Constituci%C3%B3n_-_Huancayo.jpg) · [Parque de la Identidad Wanka](https://commons.wikimedia.org/wiki/File:Parque_de_la_Identidad_Wanka,_Huancayo,_Per%C3%BA_01.jpg).
