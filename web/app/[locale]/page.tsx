import {notFound} from "next/navigation";
import type {Metadata} from "next";
import {AnalyticsChoice,Catalog,HeroPoster,TrackedLink} from "../public-tools";
import type {Workshop} from "../shared";

type Params = {params:Promise<{locale:string}>};

export async function generateMetadata({params}:Params):Promise<Metadata>{
  const {locale}=await params;
  return {robots:process.env.TALLERYA_DEMO==="1" ? {index:false,follow:false}:undefined,
    openGraph:{type:"website",siteName:"TallerYA",title:locale==="en"?"Hands-on workshops in Bogotá":"Talleres presenciales en Bogotá",locale:locale==="en"?"en_US":"es_CO"},
    metadataBase:process.env.TALLERYA_PUBLIC_URL ? new URL(process.env.TALLERYA_PUBLIC_URL) : undefined, title:locale==="en"?"TallerYA | Workshops in Bogotá":"TallerYA | Talleres en Bogotá",
    description:locale==="en"?"Find in-person workshops in Bogotá.":"Descubre talleres presenciales en Bogotá.",
    alternates:{canonical:"/"+locale,languages:{es:"/es",en:"/en","x-default":"/es"}}};
}

export default async function Landing({params}:Params){
  const {locale}=await params;
  if(locale!=="es" && locale!=="en") notFound();
  const t=(es:string,en:string)=>locale==="es"?es:en;
  let workshops: Workshop[]=[];
  let unavailable=false;
  try {
    const response=await fetch((process.env.TALLERYA_API ?? "http://127.0.0.1:8000")+"/workshops",{cache:"no-store"});
    if(!response.ok) throw new Error("Catalogue offline");
    workshops=await response.json();
  }catch{unavailable=true;}
  const videos=(process.env.TALLERYA_YOUTUBE_IDS ?? "").split(",").filter(id=>/^[\w-]{11}$/.test(id));
  const learn=(process.env.TALLERYA_LEARN_URL ?? "")+"/"+locale+"/learn";
  const isDemo=process.env.TALLERYA_DEMO==="1";
  const base=process.env.TALLERYA_PUBLIC_URL ?? "http://localhost:3000";
  const structured={
    "@context":"https://schema.org",
    "@graph":[
      {"@type":"WebSite",name:"TallerYA",url:new URL("/"+locale,base).href,inLanguage:locale,
        description:t("Talleres presenciales en Bogotá, Colombia.","In-person workshops in Bogotá, Colombia.")},
      ...(!isDemo ? workshops.filter(workshop=>workshop.venue).map(workshop=>({
        "@type":"Event",name:workshop[locale],startDate:new Date(workshop.starts*1000).toISOString(),
        endDate:new Date((workshop.starts+workshop.minutes*60)*1000).toISOString(),
        eventAttendanceMode:"https://schema.org/OfflineEventAttendanceMode",
        location:{"@type":"Place",name:workshop.venue,address:{"@type":"PostalAddress",addressLocality:"Bogotá",addressCountry:"CO"}},
        offers:{"@type":"Offer",price:workshop.price/100,priceCurrency:workshop.currency,
          url:new URL(learn+"?taller="+workshop.id,base).href,
          availability:"https://schema.org/"+(workshop.available>0?"InStock":"SoldOut")},
      })) : []),
    ],
  };
  return <div className="shell">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structured).replace(/</g,"\\u003c")}}/>
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-300 py-5">
      <a className="text-2xl font-black tracking-tight" href={`/${locale}`}>Taller<span className="text-indigo-800">YA</span></a>
      <nav className="flex flex-wrap items-center gap-4">
        <a href="#talleres">{t("Talleres","Workshops")}</a><a href="#como-funciona">{t("Cómo funciona","How it works")}</a><a href="#grabaciones">{t("Grabaciones","Recordings")}</a>
        <a href="/es" lang="es" aria-current={locale==="es"?"page":undefined}>Español</a>
        <a href="/en" lang="en" aria-current={locale==="en"?"page":undefined}>English</a>
        <TrackedLink name="learn_open" locale={locale} href={learn}>Learn TallerYA</TrackedLink>
      </nav>
    </header>
    <main>
      {isDemo && <p className="mt-4 rounded bg-amber-100 px-4 py-2 text-sm font-semibold">{t("Datos de prueba · Talleres y lugares ficticios","Demo data · Fictional workshops and venues")}</p>}
      <section className="hero-grid my-6 grid gap-7 rounded-2xl bg-indigo-950 p-6 text-white sm:p-10 md:grid-cols-[1.15fr_1fr]">
        <div className="space-y-5 py-7">
          <p className="font-bold text-lime-200">Bogotá, Colombia</p>
          <h1 className="max-w-[12ch] text-[clamp(2.75rem,7vw,6rem)] leading-[.94] font-black tracking-[-.075em]">{t("Aprende haciendo, en Bogotá.","Learn by doing, in Bogotá.")}</h1>
          <p className="max-w-lg text-lg">{t("Descubre talleres presenciales y conecta con los profesores que los imparten.","Discover in-person workshops and connect with the instructors who lead them.")}</p>
          <a className="inline-block rounded bg-lime-200 px-5 py-3 font-bold text-indigo-950 hover:bg-lime-100" href="#talleres">{t("Ver talleres","Browse workshops")}</a>
        </div><HeroPoster/>
      </section>
      <section id="talleres" className="border-t border-slate-300 py-10">
        <h2 className="subhead">{t("Próximos talleres","Upcoming workshops")}</h2>
        {unavailable ? <p>{t("El catálogo no está disponible en este momento.","The catalogue is temporarily unavailable.")}</p> : <Catalog workshops={workshops} locale={locale} learn={learn}/>}
      </section>
      <section id="como-funciona" className="bg-indigo-100 p-6 sm:p-9">
        <h2 className="subhead">{t("De la reserva al taller","From booking to workshop")}</h2>
        <ol className="grid list-inside list-decimal gap-5 sm:grid-cols-3">
          <li>{t("Elige un taller y revisa la fecha y el precio.","Choose a workshop and check its date and price.")}</li>
          <li>{t("Aparta tu plaza con una cuenta del Club TallerYA.","Hold a place with your Club TallerYA account.")}</li>
          <li>{t("Sigue las instrucciones de pago por WhatsApp para confirmar.","Follow the WhatsApp payment instructions to confirm.")}</li>
        </ol>
      </section>
      <section id="grabaciones" className="border-t border-slate-300 py-10">
        <h2 className="subhead">{t("Talleres grabados","Workshop recordings")}</h2>
        {videos.length ? <div className="grid gap-5 sm:grid-cols-2">{videos.map((id,index)=><iframe key={id} className="aspect-video w-full" loading="lazy" allowFullScreen title={`${t("Grabación","Recording")} ${index+1}`} src={`https://www.youtube-nocookie.com/embed/${id}`}/>)}</div>
          : <p>{t("Aún no hay grabaciones publicadas.","No recordings have been published yet.")}</p>}
      </section>
      <section className="bg-lime-200 p-6">
        <h2 className="subhead">Learn TallerYA</h2><p className="mb-4">{t("Reserva con el Club, consulta tus cursos o descarga tu certificado.","Book with the Club, see your courses or download your certificate.")}</p>
        <TrackedLink name="learn_open" locale={locale} href={learn}>{t("Entrar a Learn","Open Learn")}</TrackedLink>
      </section>
      <AnalyticsChoice locale={locale}/>
    </main>
  </div>;
}
