"use client";

import {useEffect, useRef, useState} from "react";
import type {Locale} from "./shared";

const consentKey = "tallerya-analytics";

export function track(name:string, locale:Locale) {
  if (localStorage.getItem(consentKey) === "yes") {
    void fetch("/api/telemetry",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({name,locale,consent:true}),keepalive:true}).catch(() => {});
  }
}

export function AnalyticsChoice({locale}:{locale:Locale}) {
  const [choice,setChoice] = useState<string | null>(null);
  const [ready,setReady] = useState(false);
  useEffect(() => {
    setChoice(localStorage.getItem(consentKey));
    setReady(true);
    track("catalog_view",locale);
  },[locale]);
  if (!ready) return null;
  function decide(value:string) {
    localStorage.setItem(consentKey,value);
    setChoice(value);
    if (value === "yes") track("catalog_view",locale);
  }
  return <details className="py-5" open={choice===null}>
    <summary className="cursor-pointer">{locale==="es"?"Preferencias de analítica":"Analytics preferences"}</summary>
    <p className="my-2">{locale==="es"?"Puedes autorizar recuentos de navegación sin guardar tu nombre ni correo.":"You can allow navigation counts that omit your name and email."}</p>
    <div className="flex gap-4">
      <button className="button" onClick={()=>decide("yes")} aria-pressed={choice==="yes"}>{locale==="es"?"Aceptar":"Allow"}</button>
      <button className="button" onClick={()=>decide("no")} aria-pressed={choice==="no"}>{locale==="es"?"Desactivar":"Disable"}</button>
    </div>
  </details>;
}

export function HeroPoster(){
  const ref=useRef<HTMLImageElement>(null);
  useEffect(()=>{
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
    function scroll(){
      ref.current?.style.setProperty("--shift", reduced.matches ? "0px" : Math.min(window.scrollY*.09,18)+"px");
    }
    window.addEventListener("scroll",scroll,{passive:true});
    reduced.addEventListener("change",scroll);
    scroll();
    return ()=>{window.removeEventListener("scroll",scroll);reduced.removeEventListener("change",scroll);};
  },[]);
  return <div className="hero-img">
    <img ref={ref} src="/redesign/images/rug.webp" alt="" fetchPriority="high"/>
  </div>;
}

export function WorkshopGallery({locale}:{locale:Locale}) {
  const gallery=useRef<HTMLElement>(null);
  useEffect(()=>{
    const motion=matchMedia("(prefers-reduced-motion: reduce)");
    let frame=0;
    function update(){
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        const element=gallery.current;
        if(!element) return;
        const offset=(window.innerHeight/2-element.getBoundingClientRect().top)*.065;
        element.style.setProperty("--gallery-shift",motion.matches?"0px":Math.max(-22,Math.min(22,offset))+"px");
      });
    }
    window.addEventListener("scroll",update,{passive:true});
    window.addEventListener("resize",update);
    motion.addEventListener("change",update);
    update();
    return ()=>{
      window.removeEventListener("scroll",update);
      window.removeEventListener("resize",update);
      motion.removeEventListener("change",update);
      cancelAnimationFrame(frame);
    };
  },[]);
  const captions = [
    ["rug","Manos tejiendo una alfombra","Hands tufting a rug"],
    ["clay","Una taza de arcilla en proceso","A clay cup taking shape"],
    ["shoes","Un zapato confeccionado a mano","A shoe being stitched by hand"],
  ];
  return <section ref={gallery} id="galeria" aria-labelledby="gallery-title" className="border-t border-sand py-10">
    <h2 id="gallery-title" className="subhead">{locale==="es"?"Galería de talleres":"Workshop gallery"}</h2>
    <p className="mb-5">{locale==="es"?"Imágenes generadas para ilustrar las actividades.":"Generated images illustrating the activities."}</p>
    <div className="grid gap-4 sm:grid-cols-3">
      {captions.map(([id,es,en])=><figure key={id}>
        <div className="gallery-photo">
          <img src={`/workshops/${id}.jpg`} alt={locale==="es"?es:en} width={724} height={724}/>
        </div>
        <figcaption className="mt-2">{locale==="es"?es:en}</figcaption>
      </figure>)}
    </div>
  </section>;
}

export function TrackedLink({name,locale,href,children,className="button"}:{name:string;locale:Locale;href:string;children:React.ReactNode;className?:string}){
  return <a className={className} href={href} onClick={()=>track(name,locale)}>{children}</a>;
}

export function LanguageSelector({locale}:{locale:Locale}) {
  return <select aria-label={locale==="es"?"Idioma":"Language"} value={locale}
    className="rounded border border-sand bg-white px-2 py-1 text-cocoa"
    onChange={event=>{
      const {pathname,search,hash}=window.location;
      window.location.assign(pathname.replace(/^\/(es|en)(?=\/|$)/,"/"+event.target.value)+search+hash);
    }}>
    <option value="es" lang="es">Español</option>
    <option value="en" lang="en">English</option>
  </select>;
}
