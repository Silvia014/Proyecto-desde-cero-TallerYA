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
