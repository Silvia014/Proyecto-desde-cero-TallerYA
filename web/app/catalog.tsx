"use client";

import {useRef,useState} from "react";
import type {Locale,Workshop} from "./shared";
import {dateOf,money} from "./shared";
import {track} from "./public-tools";

const illustrated:Record<string,string>={
  "Rug making":"rug", "Personal development":"people", "Clay hand-building":"bowl",
  "Handcrafted shoes":"shoes", "Handmade cups":"clay", "Botanical printing":"print",
  "Ceramics by hand":"clay",
};
const order=Object.keys(illustrated);
const normalize=(value:string)=>value.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase();
const illustration=(workshop:Workshop)=>illustrated[workshop.en];

export function Catalog({workshops,locale,learn,demo}:{workshops:Workshop[];locale:Locale;learn:string;demo:boolean}){
  const es=locale==="es";
  const t=(spanish:string,english:string)=>es?spanish:english;
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("");
  const [duration,setDuration]=useState("");
  const [sort,setSort]=useState("");
  const [selected,setSelected]=useState<Workshop|null>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  const opener=useRef<HTMLButtonElement>(null);
  const format=new Intl.NumberFormat(es?"es-CO":"en");
  const timeFormat=new Intl.DateTimeFormat(es?"es-CO":"en",{timeStyle:"short",timeZone:"America/Bogota"});
  const rank=(workshop:Workshop)=>order.includes(workshop.en)?order.indexOf(workshop.en):order.length;
  const entries=workshops.filter(workshop=>{
    const matches=normalize([workshop.es,workshop.en,workshop.venue,workshop.project?.[locale]].join(" ")).includes(normalize(query.trim()));
    const growth=workshop.en==="Personal development";
    return matches && (!category || (category==="growth")===growth) &&
      (!duration || (duration==="short"?workshop.minutes<=150:workshop.minutes>150));
  }).sort((a,b)=>sort
    ? a.currency.localeCompare(b.currency)||(sort==="low"?a.price-b.price:b.price-a.price)
    : rank(a)-rank(b)||a.starts-b.starts);

  function availability(workshop:Workshop){
    return t(`${workshop.available} plazas`,`${workshop.available} places`);
  }
  function price(workshop:Workshop){
    return workshop.currency==="COP" && workshop.price%100===0
      ? `${format.format(workshop.price/100)} COP`
      : money(workshop.price,workshop.currency,locale);
  }
  function detail(workshop:Workshop,trigger:HTMLButtonElement){
    opener.current=trigger;
    setSelected(workshop);
    dialog.current?.showModal();
  }
  function image(workshop:Workshop){
    return illustration(workshop) ? <img src={`/redesign/images/${illustration(workshop)}.webp`} alt=""/> : null;
  }

  return <>
    <div className="section-head">
      <h2>{t("Encuentra tu próximo taller","Find your next workshop")}</h2>
      {(demo || (workshops.length>0 && workshops.every(workshop=>workshop.sample))) && <p>{t("Catálogo de demostración","Demo catalogue")}</p>}
    </div>
    <form className="tools" role="search" onSubmit={event=>event.preventDefault()} onReset={()=>{setQuery("");setCategory("");setDuration("");setSort("");}}>
      <div className="find">
        <input type="search" value={query} onChange={event=>setQuery(event.target.value)} aria-label={t("Buscar talleres","Search workshops")} placeholder={t("Busca cerámica, alfombras, un barrio…","Search pottery, rugs or a neighbourhood…")}/>
        <button className="cta">{t("Buscar","Search")}</button>
      </div>
      <div className="filters">
        <select aria-label={t("Actividad","Activity")} value={category} onChange={event=>setCategory(event.target.value)}>
          <option value="">{t("Todas las actividades","All activities")}</option><option value="craft">{t("Arte y oficio","Arts and crafts")}</option><option value="growth">{t("Desarrollo personal","Personal development")}</option>
        </select>
        <select aria-label={t("Duración","Duration")} value={duration} onChange={event=>setDuration(event.target.value)}>
          <option value="">{t("Cualquier duración","Any duration")}</option><option value="short">{t("Hasta 2,5 h","Up to 2.5 h")}</option><option value="long">{t("Más de 2,5 h","Over 2.5 h")}</option>
        </select>
        <select aria-label={t("Ordenar por precio","Sort by price")} value={sort} onChange={event=>setSort(event.target.value)}>
          <option value="">{t("Selección TallerYA","TallerYA selection")}</option><option value="low">{t("Menor precio","Lowest price")}</option><option value="high">{t("Mayor precio","Highest price")}</option>
        </select>
        <button type="reset" className="reset">{t("Limpiar filtros","Clear filters")}</button>
      </div>
    </form>
    <p className="results" aria-live="polite">{entries.length} {entries.length===1?t("taller","workshop"):t("talleres","workshops")}</p>
    <div id="live-workshop-grid" className="grid">
      {entries.map(workshop=><article className="workshop" key={workshop.id} id={`taller-${workshop.id}`}>
        <div className="photo">{image(workshop)}</div>
        <div className="workshop-content">
          <p className="meta">{workshop.venue.replace(/^\[Demo\] /,"")} · {format.format(workshop.minutes/60)} h</p>
          <h3>{workshop[locale]}</h3>
          {workshop.project && <p className="project">{workshop.project[locale]}</p>}
          <div className="card-bottom"><span className="price">{price(workshop)}</span><button type="button" className="cta secondary" onClick={event=>detail(workshop,event.currentTarget)}>{t("Ver taller","View workshop")}</button></div>
          <p className="workshop-availability">{availability(workshop)}</p>
        </div>
      </article>)}
    </div>
    {!entries.length && <p className="empty">{workshops.length?t("No hay talleres que coincidan con estos filtros.","No workshops match these filters."):t("Aún no hay talleres publicados.","No workshops have been published yet.")}</p>}
    <dialog ref={dialog} aria-labelledby="live-detail-title" onClose={()=>opener.current?.focus()}>
      {selected && <>
        <div className="photo">{image(selected)}</div>
        <div className="detail-copy">
          <h2 id="live-detail-title">{selected[locale]}</h2>
          <p className="meta">{selected.venue.replace(/^\[Demo\] /,"")} · <time dateTime={new Date(selected.starts*1000).toISOString()}>{dateOf(selected.starts,locale)}</time> – <time dateTime={new Date((selected.starts+selected.minutes*60)*1000).toISOString()}>{timeFormat.format((selected.starts+selected.minutes*60)*1000)}</time></p>
          {selected.project && <p><strong>{t("Crearás","You’ll make")}</strong> · {selected.project[locale]}</p>}
          <p className="price">{price(selected)} · {availability(selected)}</p>
          <p className="muted">{t("Una plaza por persona. Learn muestra la disponibilidad actual.","One place per person. Learn shows current availability.")}</p>
          <div className="detail-actions">
            <a className="cta" onClick={()=>track("booking_open",locale)} href={`${learn}?taller=${selected.id}`}>{selected.available?t("Reservar","Book"):t("Avisarme","Notify me")}</a>
            <form method="dialog"><button className="cta secondary">{t("Cerrar","Close")}</button></form>
          </div>
        </div>
      </>}
    </dialog>
  </>;
}
