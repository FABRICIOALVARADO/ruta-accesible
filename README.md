# Proyecto Final · Ruta Accesible

Aplicación web de Programación Web para explorar Huancayo, El Tambo y Chilca con información sobre rampas, baños adaptados, piso táctil y estacionamiento. Los datos iniciales están marcados como ejemplos.

## Iniciar en Windows

1. Instala [Node.js 24 o superior](https://nodejs.org/).
2. Descarga el proyecto desde **Code → Download ZIP** en GitHub, o clónalo con Git.
3. Abre una terminal en la carpeta que contiene `package.json` y ejecuta:

   ```powershell
   npm install
   npm start
   ```

4. Abre [http://127.0.0.1:3000](http://127.0.0.1:3000). Mantén la terminal abierta mientras usas la aplicación.

SQLite se crea y carga las nueve fichas de ejemplo en el primer arranque. No necesitas instalar SQLite ni otro servidor de base de datos. El archivo local se guarda en `data/ruta-accesible.db`.

Si el puerto 3000 está ocupado, pon, por ejemplo, `PORT=3001` en tu archivo `.env` y abre el puerto que indique la terminal.

## Configurar Google Maps y administración

Copia el archivo de ejemplo y abre la copia:

```powershell
Copy-Item .env.example .env
notepad .env
```

- **Google Maps.** En tu proyecto de Google Cloud, vincula una cuenta de facturación y habilita **Maps JavaScript API** y **Routes API**. Crea una clave de navegador y configúrala como `GOOGLE_MAPS_API_KEY`. Limita la clave a esas dos API y a los sitios donde vas a usarla, por ejemplo `http://127.0.0.1:3000/*` para pruebas locales. Puedes indicar tu ID de mapa en `GOOGLE_MAPS_MAP_ID`. [Documentación oficial](https://developers.google.com/maps/documentation/javascript/routes/start).
- **Administrador.** Antes de registrar esa dirección como miembro, completa `ADMIN_EMAIL` y `ADMIN_PASSWORD` con tu correo y una contraseña de al menos 12 caracteres. Reinicia, entra con esas credenciales y abre **Administrar**. Si ya tienes una cuenta de miembro, elige otra dirección para crear la primera cuenta administradora.
- Guarda el archivo y reinicia con `Ctrl+C` y `npm start`. El archivo `.env` y la base de datos local se excluyen de Git.

Sin clave puedes buscar lugares, marcar favoritos, enviar reportes, guardar recorridos y abrir indicaciones en Google Maps. El plano esquemático y la distancia en línea recta son referencias; las vías reales, la duración y el trazado dentro de la web requieren la integración activa. Una ruta de Google Maps no certifica la accesibilidad del trayecto.

## Qué probar para la exposición

| Apartado | Prueba |
| --- | --- |
| Explorar | Busca «Identidad», filtra por rampa y abre la ficha del parque. |
| Rutas | Usa Plaza Constitución como origen y Parque de la Identidad Wanka como destino. Calcula y guarda el recorrido desde tu cuenta. |
| Mi cuenta | Regístrate, añade un favorito y comprueba que se mantenga al volver a entrar. |
| Comunidad | Envía un reporte de rampa bloqueada y revisa su estado. |
| Administrar | Crea o actualiza un lugar, cambia el estado del reporte y exporta el directorio en CSV. |
| Guía | Consulta qué observar en una ficha de accesibilidad y prueba el control **Aa** para cambiar tamaño de texto y contraste. |

## Arquitectura y datos

- `public/` contiene la interfaz adaptable, las funciones de búsqueda y la integración de mapas.
- `server.js` sirve la aplicación y su API. Usa sesiones con cookies HttpOnly y contraseñas protegidas mediante scrypt.
- `db/schema.sql` define las tablas de usuarios, sesiones, lugares, favoritos, reseñas, reportes y recorridos guardados. Las relaciones usan claves foráneas y el catálogo de demostración se carga una sola vez.
- `npm test` verifica el registro, las sesiones, la separación de cuentas, los permisos de administrador, las reseñas, los reportes, los favoritos y el CRUD de lugares.

Fotografías de Wikimedia Commons. Consulta autoría y licencia en [Huancayo Perú](https://commons.wikimedia.org/wiki/File:Huancayo_Peru.jpg), [Plaza Constitución](https://commons.wikimedia.org/wiki/File:Plaza_Constituci%C3%B3n_-_Huancayo.jpg) y [Parque de la Identidad Wanka](https://commons.wikimedia.org/wiki/File:Parque_de_la_Identidad_Wanka,_Huancayo,_Per%C3%BA_01.jpg).

