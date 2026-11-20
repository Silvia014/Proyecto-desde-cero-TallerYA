# TallerYA

Primera versión local de la landing bilingüe para talleres presenciales en Bogotá.

## Vista local

Desde esta carpeta, ejecuta `python3 -m http.server 8000` y abre http://localhost:8000. El contenido en inglés está en `/en/`.

## Contenido y dominio

- Completa `recordings` en `config.js` con el identificador de cada vídeo de YouTube y sus títulos en español e inglés.
- Completa `portalUrl` con la URL HTTPS definitiva de Learn TallerYA cuando esté disponible. Queda pendiente confirmar la extensión del dominio principal y configurar su subdominio `learn`.
- Configura la lista `workshops` en `config.js` para ver fichas con fecha, duración y precio en COP. El catálogo estático oculta ediciones cuando faltan menos de 24 horas. La disponibilidad efectiva y la confirmación deben venir del sistema de reservas, pendiente de conectar.

## Requisito del portal Learn

El dueño será el único superadministrador. Solo ese rol podrá iniciar el restablecimiento de contraseñas y eliminar usuarios. Los profesores acceden a sus propios cursos y los estudiantes a sus propios certificados. Esta entrega documenta los permisos del portal. Su implementación requiere el repositorio o servicio donde se construya Learn.
