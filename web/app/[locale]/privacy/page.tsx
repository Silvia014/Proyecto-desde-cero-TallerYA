import {notFound} from "next/navigation";
export default async function Privacy({params}:{params:Promise<{locale:string}>}){
  const {locale}=await params;
  if(locale!=="es" && locale!=="en") notFound();
  const en=locale==="en";
  return <main className="shell py-12">
    <h1 className="subhead">{en?"Privacy notice":"Aviso de privacidad"}</h1>
    <p>{en?"Development version. Use test data only. TallerYA stores the details you provide to manage your membership, workshop bookings and certificates. Optional email notices and aggregate navigation measurements use separate preferences.":"Versión de desarrollo. Usa únicamente datos de prueba. TallerYA conserva los datos que facilitas para gestionar tu membresía, reservas y certificados. Los avisos opcionales y la medición agregada de navegación tienen preferencias separadas."}</p>
  </main>;
}
