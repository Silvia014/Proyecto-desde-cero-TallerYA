# TallerYA

MVP bilingüe para publicar talleres presenciales en Bogotá, recibir reservas y gestionar Learn TallerYA. El servicio FastAPI usa Pydantic, JWT con Argon2 y SQLite. Pandas genera la liquidación por moneda. El frontend usa Node.js, Next.js, TypeScript y Tailwind CSS. Los archivos estáticos de la primera propuesta siguen disponibles en la raíz.

## Arranque local

Usa Python 3.11 o posterior y Node.js 22 o posterior. Desde la raíz del repositorio:

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r api/requirements.txt
export TALLERYA_JWT_SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
python -m api.owner
python -m uvicorn api.main:app --port 8000
```

El comando interactivo crea el único dueño. En otra terminal:

```sh
cd web
npm ci
npm run dev
```

Abre `http://localhost:3000/es` o `/en`. El portal está en `/es/learn` y `/en/learn`. Crea una cuenta de estudiante de prueba e inicia sesión como dueño para elevar una cuenta a profesor o gestor. Para editar talleres, usa la agenda de Learn. Las fechas del formulario se interpretan en Bogotá.

## Verificación

```sh
python -m pytest -q api/tests
cd web
npm run build
npm test
```

Las pruebas de integración de FastAPI usan una base temporal. Cubren concurrencia de la última plaza, autorización, cortes, caducidad, cancelación, avisos con consentimiento, liquidación, certificados, revocación de sesiones y analítica.

## Configuración

- `TALLERYA_DB`: ruta persistente para SQLite. El MVP utiliza un volumen compartido por el proceso de la API y el proceso de tareas.
- `TALLERYA_JWT_SECRET`: secreto de al menos 32 caracteres. Mantén el mismo valor entre reinicios.
- `TALLERYA_API`: URL interna de FastAPI vista por Next.js. Por defecto es `http://127.0.0.1:8000`.
- `TALLERYA_PUBLIC_URL`: URL HTTPS principal para el sitemap, los idiomas y los enlaces de correo. Configúrala en ambos servicios.
- `TALLERYA_LEARN_URL`: origen HTTPS para Learn cuando tenga su subdominio. En desarrollo se usan rutas locales.
- `TALLERYA_YOUTUBE_IDS`: identificadores de vídeos verificados separados por comas.
- `TALLERYA_SMTP_HOST`, `TALLERYA_SMTP_PORT`, `TALLERYA_SMTP_USER` y `TALLERYA_SMTP_PASSWORD`: credenciales de correo. Programa `python -m api.jobs` cada minuto con las variables de la API. Sin SMTP, la cola de correo permanece en SQLite.

## Operación y decisiones del MVP

- El gestor envía el enlace o QR por WhatsApp y registra el envío y el cobro en Learn. El plazo se calcula desde el envío registrado. A quien envíe el WhatsApp se le muestra el vencimiento para que lo comunique. El sistema exige poder dar las 24 horas completas antes del inicio. Si no se registró un envío cuando quedan menos de 24 horas, la plaza apartada caduca. Las reservas pendientes de pago vencen automáticamente al terminar su plazo.
- El gestor publica los PDF una vez finalizada la edición. Están disponibles para el titular de la reserva confirmada.
- Las liquidaciones aplican 20 % para TallerYA y 80 % para el formador tras reembolsos, con redondeo por cobro. La política de devolución real está pendiente. El borrado por el dueño anonimiza la cuenta y conserva los registros financieros.
- La analítica guarda recuentos agregables por evento e idioma tras el consentimiento separado. Los eventos se conservan hasta 90 días con el trabajo programado. El panel muestra los últimos 30 días. Los clics se pueden repetir y los recuentos no equivalen a usuarios únicos.
- Antes de publicar, configura los dominios, los enlaces de YouTube, el correo real y la política de privacidad definitiva. Configura protección de acceso y límites de tráfico en producción, copias de seguridad y monitorización. El MVP permite gestión manual de WhatsApp y pagos.

## Docker Compose y datos de prueba

El proyecto incluye imágenes para FastAPI, Next.js, el trabajo periódico y Playwright. SQLite se guarda en un volumen y FastAPI queda en la red interna. El sitio se expone en `http://localhost:3000`.

Para levantar una instancia demo separada de los datos reales:

```sh
export TALLERYA_JWT_SECRET="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
export TALLERYA_DEMO=1
docker compose -p tallerya-demo up --build -d --wait
```

El modo demo carga talleres y ubicaciones ficticias de Bogotá, inscripciones, pagos y un PDF de muestra. Las cuentas de prueba son `owner@example.com`, `teacher@example.com` y `student@example.com`, todas con contraseña `Demo-TallerYA-5678`. Usa este modo solo en un entorno aislado. La portada demo lleva `noindex` y queda fuera del sitemap. Para el entorno real usa otro proyecto de Compose, `TALLERYA_DEMO=0` y un volumen vacío. Crea al dueño con `docker compose exec api python -m api.owner`.

## Pruebas E2E y visuales

Desde `web/`, instala Chromium con `npx playwright install chromium` y ejecuta `npm run test:e2e` apuntando a una instancia demo en `http://localhost:3000`. Puedes cambiar la URL con `PLAYWRIGHT_BASE_URL`. Las pruebas comprueban español e inglés, el catálogo con ubicaciones, el backoffice y la descarga del PDF. Las capturas comparan escritorio, móvil y la tabla de ganancias.

Playwright mantiene las referencias visuales por sistema operativo. La primera vez que las generes en Linux, revísalas antes de guardarlas. Con la instancia demo iniciada:

```sh
docker compose -p tallerya-demo --profile test build playwright
docker compose -p tallerya-demo --profile test run --rm \
  -v "$PWD/web/tests:/app/tests" playwright npx playwright test --update-snapshots
docker compose -p tallerya-demo --profile test run --rm \
  -v "$PWD/web/tests:/app/tests" playwright
```

Para cambios de producto, añade primero los casos de Playwright en `web/tests/`, comprueba que fallen por la conducta que falta y luego implementa el cambio. Si cambia el diseño, revisa la diferencia visual antes de actualizar una referencia.

## PostgreSQL local y Supabase

Compose incluye la web, FastAPI, el proceso de correo y vencimientos y Playwright (perfil `test`). Para añadir PostgreSQL en local, usa una contraseña de desarrollo alfanumérica y la configuración adicional:

```sh
export TALLERYA_LOCAL_DB_PASSWORD=soloParaDesarrollo42
export TALLERYA_JWT_SECRET="$(openssl rand -hex 32)"
export TALLERYA_DEMO=1
export TALLERYA_TEST_ORIGIN=http://web:3000
export COMPOSE_FILE=compose.yaml:compose.postgres.yaml
docker compose up --build --wait
docker compose --profile test run --rm --build playwright
```

El contenedor de PostgreSQL aplica la migración inicial cuando crea su volumen. La demo contiene talleres y ubicaciones inventados. Usa otra base y desactiva `TALLERYA_DEMO` para producción.

Para Supabase alojado, aplica el archivo de `supabase/migrations/` como migración SQL de un proyecto propio. Configura `TALLERYA_DATABASE_URL` en FastAPI y en jobs con la cadena del panel Connect, usando conexión directa o el pooler de sesión y TLS. Usa el Compose principal sin el fichero adicional. La conexión queda en el servidor y las tablas viven en el esquema privado `tallerya` con RLS. FastAPI mantiene el JWT y comprueba los permisos de cada operación. La migración inicial crea un esquema vacío. La transferencia de datos históricos de SQLite se trata por separado.

La CI prepara una base independiente llamada `tallerya_test`, ejecuta pytest en SQLite y PostgreSQL y usa Playwright en Chromium con referencias visuales Linux. El acuerdo de aforo se serializa dentro de una transacción mediante el bloqueo del motor en SQLite y un advisory lock transaccional en PostgreSQL.

## Access to Learn TallerYA

The student, teacher and superadmin use the same sign-in page. Learn opens the dashboard assigned to the account. In local Docker development, open `http://localhost:3000/en/learn` or `http://localhost:3000/es/learn`. Use the demo accounts above to try each role. In a real environment, create the owner once with `docker compose exec api python -m api.owner`. The owner can assign the teacher role to a registered user. Set `TALLERYA_LEARN_URL` to the Learn subdomain once it is deployed.

The local demo runs with either SQLite or local PostgreSQL. A hosted Supabase project is only needed if you choose Supabase for the hosted database. Use a dedicated TallerYA project, apply the SQL migration, and set the connection string on the server.
