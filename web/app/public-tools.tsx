"use client";

import {useEffect, useRef, useState} from "react";
import type {Locale, Workshop} from "./shared";
import {dateOf, money} from "./shared";

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
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
    function scroll(){
      ref.current?.style.setProperty("transform", reduced.matches ? "" : `translateY(${Math.min(window.scrollY*.15,45)}px) rotate(-8deg)`);
    }
    window.addEventListener("scroll",scroll,{passive:true});
    reduced.addEventListener("change",scroll);
    scroll();
    return ()=>{window.removeEventListener("scroll",scroll);reduced.removeEventListener("change",scroll);};
  },[]);
  return <div aria-hidden="true" className="grid min-h-56 place-items-center overflow-hidden bg-lime-200">
    <div ref={ref} className="text-7xl leading-[.8] font-black tracking-tighter text-indigo-800 sm:text-9xl">Taller<br/>YA.</div>
  </div>;
}

export function Catalog({workshops,locale,learn}:{workshops:Workshop[];locale:Locale;learn:string}){
  const trackRef=useRef<HTMLDivElement>(null);
  function move(direction:number) {
    const track=trackRef.current;
    if(track) track.scrollBy({left:direction*track.clientWidth,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
  }
  if(!workshops.length) return <p>{locale==="es"?"Aún no hay talleres publicados.":"No workshops have been published yet."}</p>;
  return <>
    {workshops.length>1 && <div className="mb-4 flex gap-2">
      <button className="button" onClick={()=>move(-1)}>{locale==="es"?"Anterior":"Previous"}</button>
      <button className="button" onClick={()=>move(1)}>{locale==="es"?"Siguiente":"Next"}</button>
    </div>}
    <div ref={trackRef} tabIndex={0} className="grid snap-x grid-flow-col auto-cols-[min(100%,19rem)] gap-4 overflow-x-auto pb-4">
      {workshops.map(workshop=><article key={workshop.id} id={`taller-${workshop.id}`} className="panel snap-start">
        <h3 className="text-xl font-bold">{workshop[locale]}</h3>
        <p><time dateTime={new Date(workshop.starts*1000).toISOString()}>{dateOf(workshop.starts,locale)}</time> · {workshop.minutes/60} h</p>
        {workshop.venue && <p>{workshop.venue}</p>}
        <p className="mb-4">{money(workshop.price,workshop.currency,locale)} · {workshop.available} {locale==="es"?"plazas":"places"}</p>
        <a className="button" onClick={()=>track("booking_open",locale)} href={`${learn}?taller=${workshop.id}`}>
          {workshop.available ? (locale==="es"?"Reservar":"Book") : (locale==="es"?"Avisarme":"Notify me")}
        </a>
      </article>)}
    </div>
  </>;
}

export function TrackedLink({name,locale,href,children}:{name:string;locale:Locale;href:string;children:React.ReactNode}){
  return <a className="button" href={href} onClick={()=>track(name,locale)}>{children}</a>;
}
