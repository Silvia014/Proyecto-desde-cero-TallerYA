Actualiza el proyecto TallerYA con los siguientes requisitos. Revisa primero el repositorio y reutiliza la arquitectura, la autenticación y la base de datos existentes cuando sea posible. Implementa y verifica el flujo completo.

TallerYA es intermediaria. Los cursos los imparten formadores externos. La web, el Club, el flujo de reserva y los correos al usuario deben estar disponibles en español e inglés. Guarda el idioma elegido para las comunicaciones.

1. CURSOS Y AGENDA

Permite al gestor crear, editar y publicar cursos y vincularlos a un formador. Para cada edición, guarda el nombre del curso, la fecha y hora de inicio, la duración en horas, el precio y la moneda, y el cupo máximo. Muestra en la agenda del gestor las próximas ediciones, sus plazas libres, las reservas pendientes de pago y las confirmadas.

Cierra las nuevas reservas 24 horas antes de la hora de inicio y retira la edición del catálogo público. La URL directa también debe impedir nuevas reservas. Mantén la edición visible en el panel del gestor y en el historial de quienes ya reservaron.

2. CLUB TALLERYA Y DATOS DEL CLIENTE

Exige una cuenta activa del Club TallerYA y una sesión iniciada para reservar. Solicita nombre, teléfono y correo electrónico. Si el usuario ya los tiene en su perfil, precárgalos para que pueda revisarlos.

Exige la aceptación de la política de privacidad, con enlace al texto, y guarda la versión aceptada y la fecha. Incluye una casilla independiente, opcional y desmarcada por defecto para recibir novedades y avisos de disponibilidad de TallerYA por correo. El usuario puede cambiar esa preferencia en el Club. Los mensajes necesarios para gestionar una reserva, como su recepción o confirmación, se envían aunque el usuario no se suscriba a las novedades.

Cada reserva corresponde a una sola persona. Impide que una cuenta tenga más de una reserva activa para la misma edición. Conserva los datos de los socios y sus reservas en la base de datos y limita su acceso al propio socio y a los gestores autorizados.

3. RESERVA, WHATSAPP Y PAGO

Si queda cupo y la edición admite reservas, bloquea automáticamente una plaza y crea una reserva «Pendiente de envío de pago». Envía en ese momento un correo al alumno indicando que su plaza está apartada, que recibirá por WhatsApp un QR o enlace de pago y que tendrá 24 horas desde que reciba ese mensaje para pagar. Ese primer correo debe distinguir claramente entre plaza apartada y reserva confirmada.

Permite al gestor enviar el QR o enlace por WhatsApp y registrar el envío. Si existe una integración que confirma la entrega, inicia el plazo de 24 horas con la hora de entrega. Si el envío es manual o no hay confirmación de entrega, usa la hora de envío registrada y comunica la fecha y hora límite exactas al cliente. En ese caso, indica que el plazo se cuenta desde el envío.

Usa estos estados: pendiente de envío de pago, pendiente de pago, confirmada, cancelada y caducada. Las reservas pendientes y confirmadas ocupan una plaza. Al registrar un pago válido dentro del plazo, confirma la reserva y envía el correo definitivo. Si vence el plazo sin pago, caduca la reserva y libera la plaza automáticamente.

Calcula el cupo disponible en el servidor y haz atómica la operación de reservar para que dos personas no puedan quedarse con la última plaza. Tanto el catálogo como el panel deben reflejar el mismo cupo. Para esta primera versión, permite al gestor registrar el envío y el cobro manualmente si todavía no existe proveedor de WhatsApp o pasarela de pago.

4. CANCELACIONES Y AVISOS DE PLAZA LIBRE

Permite al alumno cancelar hasta 48 horas antes de la hora de inicio, inclusive. Una cancelación libera la plaza. Registra por separado el estado del reembolso si ya se había cobrado, según la política que defina TallerYA.

Cuando una edición pase de llena a tener plazas por una cancelación, envía un correo en el idioma elegido a las personas que hayan marcado interés en esa edición o se hayan apuntado a su lista de espera, siempre que mantengan activo el consentimiento para recibir esos avisos. Incluye un enlace a la edición. El aviso no asigna una plaza y solo se envía mientras siga abierto el plazo de reserva. Evita correos duplicados si el envío se reintenta.

5. COMISIÓN Y LIQUIDACIÓN

Muestra por edición cuántas reservas se han pagado, el total cobrado, los reembolsos registrados y el importe que corresponde a cada parte. Aplica un 20 % a TallerYA y un 80 % al formador sobre el importe cobrado menos los reembolsos. Por ejemplo, sobre 100 € de un pago sin reembolso, corresponden 20 € a TallerYA y 80 € al formador.

Usa importes en céntimos y un redondeo consistente. Registra el reparto por cobro y refleja cualquier ajuste posterior. Muestra por separado impuestos y comisiones de pasarela si se incorporan. Mientras esos conceptos no estén definidos, etiqueta los importes como «Reparto antes de impuestos y gastos».

6. VERIFICACIÓN

Prueba que un usuario sin cuenta no puede reservar, que el consentimiento opcional no bloquea la reserva, que dos solicitudes simultáneas no superan el aforo y que el primer correo no afirma que la reserva esté pagada ni confirmada. Comprueba que el plazo empieza con el WhatsApp, que una reserva impagada caduca y libera su plaza, que se respetan los cortes de 48 y 24 horas, que el aviso de plaza libre llega solo a interesados con consentimiento y que el reparto 20/80 cuadra con los cobros y reembolsos registrados.

7. PROFESORES Y ALUMNOS

Acceso para profesores. Cada profesor tiene su propia cuenta y un panel donde puede ver únicamente los cursos y las ediciones que tiene asignados. El gestor de TallerYA sigue creando los cursos y asignándoles un profesor.

Certificados en PDF. El alumno entra en el Club TallerYA, elige el curso que ha realizado y descarga su certificado cuando esté disponible. Solo puede acceder a sus propios certificados. La descarga requiere iniciar sesión, incluso si alguien comparte el enlace al PDF.

Deja documentada la configuración, las verificaciones realizadas y qué integraciones faltan para operar con correo, WhatsApp o pagos reales.