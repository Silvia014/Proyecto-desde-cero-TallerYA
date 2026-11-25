import {notFound} from "next/navigation";
import {contactEmail,contactPhone,phoneHref} from "../../contact";

export default async function Privacy({params}:{params:Promise<{locale:string}>}){
  const {locale}=await params;
  if(locale!=="es" && locale!=="en") notFound();
  const en=locale==="en";
  const t=(es:string,english:string)=>en?english:es;
  return <main className="shell py-12">
    <h1 className="subhead">{t("Aviso de privacidad de TallerYA","TallerYA Privacy Notice")}</h1>
    <div className="max-w-3xl space-y-6">
      <section className="space-y-2">
        <h2 className="text-xl font-bold">{t("Contacto de TallerYA","Contact TallerYA")}</h2>
        <p>{t("TallerYA gestiona esta plataforma de talleres en Bogotá, Colombia.","TallerYA operates this workshop platform in Bogotá, Colombia.")}</p>
        <p><a className="underline" href={`mailto:${contactEmail}`}>{contactEmail}</a> · <a className="underline" href={phoneHref}>{contactPhone}</a></p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">{t("Datos y finalidades","Data and purposes")}</h2>
        <p>{t("Usamos tu nombre, correo, teléfono e idioma para gestionar tu cuenta, reservas, cancelaciones, pagos registrados y certificados. Guardamos el estado de la reserva, tus preferencias y la versión del aviso aceptada. Cuando nos das permiso, usamos tu correo para enviar avisos de plazas y novedades. También puedes optar por recuentos agregados de navegación.",
          "We use your name, email address, phone number and language to manage your account, bookings, cancellations, payment records and certificates. We keep booking status, preferences and the accepted notice version. With your permission, we use your email for availability alerts and updates. You can also opt into aggregate navigation counts.")}</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">{t("Acceso y conservación","Access and retention")}</h2>
        <p>{t("El personal autorizado de TallerYA accede a la información necesaria para gestionar tu reserva. Los servicios de alojamiento y almacenamiento procesan los datos para que funcione la plataforma. Los recuentos de navegación se conservan hasta 90 días. Los registros de cuenta y reserva se conservan según las necesidades de operación y las obligaciones aplicables.",
          "Authorized TallerYA staff access the information needed to manage your booking. Hosting and storage services process data to operate the platform. Navigation events are kept for up to 90 days. Account and booking records are retained for operational needs and applicable obligations.")}</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">{t("Tus derechos y preferencias","Your rights and preferences")}</h2>
        <p>{t("Contacta a TallerYA para consultar, corregir o solicitar la eliminación de tus datos o la revocación de tu autorización, según corresponda. Puedes cambiar los avisos opcionales en Learn y la analítica desde la portada. Los mensajes necesarios para una reserva se gestionan aparte.",
          "Contact TallerYA to access, correct or request deletion of your data or to withdraw permission where applicable. You can change optional notifications in Learn and analytics on the homepage. Messages needed to manage a booking are handled separately.")}</p>
      </section>
    </div>
  </main>;
}
