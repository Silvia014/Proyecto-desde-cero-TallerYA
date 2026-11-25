"use client";

import {useEffect,useState} from "react";
import type {FormEvent,ReactNode} from "react";
import {LanguageSelector} from "../../public-tools";
import {dateOf,money} from "../../shared";
import type {Locale,Workshop} from "../../shared";

type User={id:number;name:string;email:string;phone:string;notices:boolean;role:"student"|"teacher"|"manager"|"owner"};
type Booking={id:number;workshop:number;user:number;status:string;es:string;en:string;starts:number;minutes:number;contact?:{name:string;email:string;phone:string};deadline:number|null;has_certificate:boolean;refund:number;refunded:number;paid:number;price:number;currency:string};
type Settlement={currency:string;count:number;paid:number;refunded:number;tallerya:number;teacher:number};
type Overview={
  popular:{id:number;es:string;en:string;registrations:number;confirmed:number}[];
  earnings:{currency:string;payments:number;paid:number;refunded:number;tallerya:number;teacher:number}[];
};
type EventCount={name:string;locale:string;total:number};

async function request<T>(path:string,method="GET",data?:unknown):Promise<T>{
  const isPdf=data instanceof File;
  const response=await fetch("/api/"+path,{method,cache:"no-store",
    headers:data===undefined?undefined:{"content-type":isPdf?"application/pdf":"application/json"},
    body:data===undefined?undefined:isPdf?data:JSON.stringify(data)});
  if(!response.ok){
    const result=await response.json().catch(()=>null);
    throw new Error(typeof result?.detail==="string"?result.detail:"request_failed");
  }
  return (response.status===204 ? undefined : await response.json()) as T;
}

function Field({name,label,type="text",value,required=true,min,max,step}:{
  name:string;label:string;type?:string;value?:string|number;required?:boolean;min?:number;max?:number;step?:string;
}){
  return <label className="field">{label}<input name={name} type={type} defaultValue={value} required={required}
    minLength={type==="password"?12:undefined} min={min} max={max} step={step}/></label>;
}

function PasswordField({locale,register}:{locale:Locale;register:boolean}) {
  const [visible,setVisible]=useState(false);
  const es=locale==="es";
  const label=visible?(es?"Ocultar contraseña":"Hide password"):(es?"Mostrar contraseña":"Show password");
  return <div className="field">
    <label htmlFor="learn-password">{es?"Contraseña (12 caracteres como mínimo)":"Password (at least 12 characters)"}</label>
    <div className="relative">
      <input id="learn-password" name="password" type={visible?"text":"password"} required minLength={12}
        autoComplete={register?"new-password":"current-password"} className="w-full" style={{paddingRight:"3rem"}}/>
      <button type="button" aria-label={label} aria-controls="learn-password" title={label}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-cocoa" onClick={()=>setVisible(!visible)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/>
          <circle cx="12" cy="12" r="2.5"/>
          {visible && <path d="m3 3 18 18"/>}
        </svg>
      </button>
    </div>
  </div>;
}

export default function Portal({locale,selected}:{locale:Locale;selected?:number}){
  const t=(es:string,en:string)=>locale==="es"?es:en;
  const [profile,setProfile]=useState<User|null>(null);
  const [register,setRegister]=useState(false);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const [agenda,setAgenda]=useState<Workshop[]>([]);
  const [bookings,setBookings]=useState<Booking[]>([]);
  const [users,setUsers]=useState<User[]>([]);
  const [teachers,setTeachers]=useState<Pick<User,"id"|"name">[]>([]);
  const [overview,setOverview]=useState<Overview|null>(null);
  const [certificateBooking,setCertificateBooking]=useState("");
  const [events,setEvents]=useState<EventCount[]>([]);
  const [workshop,setWorkshop]=useState<Workshop|null>(null);
  const [registrationSearch,setRegistrationSearch]=useState("");
  const [moving,setMoving]=useState<number|null>(null);
  const [editing,setEditing]=useState<Workshop|null>(null);
  const [settlement,setSettlement]=useState<Settlement[]|null>(null);
  const isStaff=profile?.role==="owner" || profile?.role==="manager";
  const errors:Record<string,string>={
    booking_move_requires_unpaid_hold:t("Solo se pueden cambiar de edición las reservas sin instrucciones de pago.","Only bookings awaiting payment instructions can be moved."),
    booking_move_requires_same_price:t("La otra edición debe tener el mismo precio y moneda.","The other workshop must have the same price and currency."),
    booking_remove_requires_inactive_unpaid:t("Solo se pueden retirar inscripciones canceladas o vencidas sin cobros.","Only cancelled or expired registrations without a payment can be removed."),
    invalid_credentials:t("Correo o contraseña incorrectos.","Incorrect email or password."),
    existing_booking:t("Ya tienes una reserva activa para esta edición.","You already have an active booking."),
    sold_out:t("No quedan plazas.","No places remain."),
    cancellation_closed:t("El plazo de cancelación ya terminó.","The cancellation period has ended."),
    booking_closed:t("La edición ya no admite reservas.","This edition is closed for booking."),
    insufficient_time_for_payment:t("Quedan menos de 24 horas para el inicio.","The workshop starts in less than 24 hours."),
    email_in_use:t("El correo ya está registrado.","That email is already registered."),
  };
  function report(error:unknown){
    setMessage(errors[error instanceof Error?error.message:""] ?? t("No se pudo completar la operación.","The request could not be completed."));
  }

  async function refresh(user:User) {
    if(user.role==="student"){
      setBookings(await request<Booking[]>("me/bookings"));
    }else{
      setAgenda(await request<Workshop[]>("admin/workshops"));
      if(user.role==="owner" || user.role==="manager"){
        const [all,counts,staffTeachers,summary]=await Promise.all([
          request<Booking[]>("admin/bookings"), request<EventCount[]>("admin/telemetry"),
          request<Pick<User,"id"|"name">[]>("admin/teachers"),request<Overview>("admin/overview"),
        ]);
        setBookings(all);setEvents(counts);setTeachers(staffTeachers);setOverview(summary);
      }
      if(user.role==="owner") setUsers(await request<User[]>("admin/users"));
    }
  }

  useEffect(()=>{
    request<User>("me").then(user=>{setProfile(user);return refresh(user);}).catch(()=>{}).finally(()=>setLoading(false));
    if(selected) request<Workshop>("workshops/"+selected).then(setWorkshop).catch(()=>setWorkshop(null));
  },[selected]);

  async function run(operation:()=>Promise<void>){
    setMessage("");
    try { await operation(); } catch(error){report(error);}
  }

  function form(handler:(data:FormData)=>Promise<void>){
    return (event:FormEvent<HTMLFormElement>)=>{
      event.preventDefault();
      const data=new FormData(event.currentTarget);
      void run(()=>handler(data));
    };
  }

  function button(label:string,handler:()=>Promise<void>){
    return <button className="button" onClick={()=>void run(handler)}>{label}</button>;
  }

  function title(text:string,children:ReactNode){
    return <section className="panel my-5 space-y-4"><h2 className="subhead">{text}</h2>{children}</section>;
  }

  async function authenticate(data:FormData){
    const credentials={email:data.get("email"),password:data.get("password")};
    if(register) await request("register","POST",{...credentials,name:data.get("name"),phone:data.get("phone"),
      locale,privacy:data.has("privacy"),notices:data.has("notices")});
    const {user}=await request<{user:User}>("login","POST",credentials);
    setProfile(user);
    await refresh(user);
  }

  async function saveWorkshop(data:FormData){
    const payload={es:data.get("es"),en:data.get("en"),starts:data.get("starts")+"-05:00",
      minutes:Math.round(Number(data.get("hours"))*60),price:Math.round(Number(data.get("price"))*100),
      capacity:Number(data.get("capacity")),venue:data.get("venue"),currency:data.get("currency"),published:data.has("published"),
      teacher:Number(data.get("teacher"))||null};
    await request("admin/workshops"+(editing?"/"+editing.id:""),editing?"PUT":"POST",payload);
    setEditing(null);
    if(profile) await refresh(profile);
    setMessage(t("Curso guardado.","Workshop saved."));
  }

  const search = registrationSearch.trim().toLocaleLowerCase(locale);
  const registrations = bookings.filter(item => [
    item[locale], item.contact?.name, item.contact?.email, item.contact?.phone,
  ].some(value=>value?.toLocaleLowerCase(locale).includes(search)));

  const status:Record<string,string>={
    hold:t("Pendiente de envío de pago","Awaiting payment instructions"),payment:t("Pendiente de pago","Awaiting payment"),
    confirmed:t("Confirmada","Confirmed"),cancelled:t("Cancelada","Cancelled"),expired:t("Caducada","Expired"),
  };

  return <main className="shell py-8">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-3xl font-black">Learn TallerYA</h1>
      <nav className="flex flex-wrap gap-4">
        <a href={`/${locale}#talleres`}>{t("Catálogo","Catalogue")}</a>
        <LanguageSelector locale={locale}/>
      </nav>
    </header>
    {message && <p role="status" className="mb-4 rounded bg-peach p-3">{message}</p>}
    {loading ? <p>{t("Cargando…","Loading…")}</p> : !profile ? title(register?t("Únete al Club TallerYA","Join Club TallerYA"):t("Iniciar sesión","Sign in"),
      <form className="max-w-md space-y-4" onSubmit={form(authenticate)}>
        {register && <><Field name="name" label={t("Nombre","Name")}/><Field name="phone" type="tel" label={t("Teléfono","Phone")}/></>}
        <Field name="email" type="email" label={t("Correo electrónico","Email")}/>
        <PasswordField key={String(register)} locale={locale} register={register}/>
        {register && <>
          <label className="block"><input name="privacy" type="checkbox" required/> {t("Acepto el","I accept the")} <a className="underline" href={`/${locale}/privacy`} target="_blank" rel="noreferrer">{t("aviso de privacidad","privacy notice")}</a></label>
          <label className="block"><input name="notices" type="checkbox"/> {t("Quiero recibir novedades y avisos de plazas.","I want news and availability notifications.")}</label>
        </>}
        <div className="flex flex-wrap gap-4"><button className="button">{register?t("Crear cuenta","Create account"):t("Entrar","Sign in")}</button>
          <button type="button" className="underline" onClick={()=>{setRegister(!register);setMessage("");}}>{register?t("Ya tengo cuenta","I have an account"):t("Crear cuenta","Create account")}</button></div>
      </form>) : <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p>{profile.name} · {({owner:"Superadmin",teacher:t("Profesor","Teacher"),manager:t("Gestor","Manager"),student:t("Estudiante","Student")})[profile.role]}</p>
        {isStaff && <nav className="flex flex-wrap gap-3" aria-label={t("Panel de gestión","Management dashboard")}>
          <a className="underline" href="#workshop-admin">{t("Talleres","Workshops")}</a>
          <a className="underline" href="#booking-admin">{t("Todas las inscripciones","All registrations")}</a>
          {profile.role==="owner" && <a className="underline" href="#user-admin">{t("Usuarios","Users")}</a>}
        </nav>}
        {button(t("Cerrar sesión","Sign out"),async()=>{await request("logout","POST");setProfile(null);setBookings([]);})}</div>
      {profile.role==="student" && <>
        {selected && title(workshop?.[locale] ?? t("Taller no disponible","Workshop not available"),workshop && <>
          <p>{dateOf(workshop.starts,locale)} · {money(workshop.price,workshop.currency,locale)}</p>
          <p>{profile.name} · {profile.phone} · {profile.email}</p>
          {workshop.available>0 ? button(t("Apartar una plaza","Hold one place"),async()=>{
            await request(`workshops/${selected}/book`,"POST");await refresh(profile);
            setMessage(t("Plaza apartada. Recibirás las instrucciones de pago por WhatsApp.","Place held. You will receive payment instructions via WhatsApp."));
          }) : button(t("Marcar interés","Register interest"),async()=>{
            await request(`workshops/${selected}/interest`,"POST");
            setMessage(profile.notices?t("Te avisaremos por correo si se libera una plaza.","We’ll email you if a place opens."):t("Interés guardado. Activa los avisos si quieres recibir un correo.","Interest saved. Enable notifications to receive email."));
          })}
        </>)}
        {title(t("Mis reservas y certificados","My bookings and certificates"),bookings.map(booking=><article key={booking.id} className="border-t border-sand/60 py-3">
          <h3 className="font-bold">{booking[locale]}</h3><p>{status[booking.status]} · {dateOf(booking.starts,locale)}</p>
          {booking.status==="payment" && booking.deadline && <p>{t("Paga antes de","Pay before")} {dateOf(booking.deadline,locale)}</p>}
          {booking.has_certificate && <a className="button mt-2" href={`/api/me/bookings/${booking.id}/certificate`}>{t("Descargar certificado PDF","Download PDF certificate")}</a>}
          {["hold","payment","confirmed"].includes(booking.status) && Date.now()/1000<=booking.starts-172800 &&
            <div className="mt-2">{button(t("Cancelar reserva","Cancel booking"),async()=>{
              if(confirm(t("¿Cancelar esta reserva?","Cancel this booking?"))){
                await request(`me/bookings/${booking.id}/cancel`,"POST");await refresh(profile);
              }
            })}</div>}
        </article>))}
        {title(t("Preferencias","Preferences"),<label className="block"><input type="checkbox" checked={profile.notices}
          onChange={event=>{const notices=event.target.checked;void run(async()=>{
            await request("me/preferences","PUT",{notices});setProfile({...profile,notices});
          });}}/> {t("Recibir novedades y avisos de plazas","Receive news and availability notices")}</label>)}
      </>}
      {(isStaff || profile.role==="teacher") && title(t("Agenda de cursos","Workshop schedule"),<div id="workshop-admin">{agenda.map(item=><article key={item.id} className="border-t border-sand/60 py-3">
        <h3 className="font-bold">{item[locale]}</h3><p>{dateOf(item.starts,locale)} · {item.available}/{item.capacity} {t("plazas libres","places available")}</p>
        {item.counts && <p>{t("Pendientes","Pending")}: {(item.counts.hold??0)+(item.counts.payment??0)} · {t("Confirmadas","Confirmed")}: {item.counts.confirmed??0}</p>}
        {isStaff && <div className="mt-2 flex flex-wrap gap-2">
          <button className="button" onClick={()=>{setEditing(item);requestAnimationFrame(()=>document.getElementById("workshop-editor")?.scrollIntoView());}}>{t("Editar","Edit")}</button>
          {profile.role==="owner" && item.published && button(t("Archivar taller","Archive workshop"),async()=>{
            if(confirm(t("¿Retirar el taller del catálogo? Se conservarán sus inscripciones.","Remove this workshop from the catalogue? Its registrations will be kept."))){
              await request(`admin/workshops/${item.id}/archive`,"POST");await refresh(profile);
            }
          })}
          {button(t("Ver liquidación","View settlement"),async()=>setSettlement(await request<Settlement[]>(`admin/workshops/${item.id}/settlement`)))}
        </div>}
      </article>)}</div>)}
      {isStaff && <>
        {overview && title(t("Talleres populares","Popular workshops"),<div className="overflow-x-auto">
          <table aria-label={t("Talleres populares","Popular workshops")} className="w-full text-left">
            <thead><tr><th>{t("Taller","Workshop")}</th><th>{t("Inscripciones","Registrations")}</th><th>{t("Confirmadas","Confirmed")}</th></tr></thead>
            <tbody>{overview.popular.map(row=><tr key={row.id} className="border-t border-sand/60"><th scope="row" className="py-2">{row[locale]}</th><td>{row.registrations}</td><td>{row.confirmed}</td></tr>)}</tbody>
          </table></div>)}
        {overview && title(t("Panel de ganancias","Earnings dashboard"),<>
          <p>{t("Reparto antes de impuestos y gastos","Split before taxes and expenses")}</p>
          <div className="overflow-x-auto"><table aria-label={t("Panel de ganancias","Earnings dashboard")} className="w-full min-w-[35rem] text-left">
            <thead><tr><th>{t("Moneda","Currency")}</th><th>{t("Cobrado","Paid")}</th><th>{t("Reembolsado","Refunded")}</th><th>TallerYA · 20%</th><th>{t("Formador · 80%","Instructor · 80%")}</th></tr></thead>
            <tbody>{overview.earnings.map(row=><tr key={row.currency} className="border-t border-sand/60"><th scope="row" className="py-2">{row.currency}</th>
              {[row.paid,row.refunded,row.tallerya,row.teacher].map((amount,index)=><td key={index}>{money(amount,row.currency,locale)}</td>)}</tr>)}</tbody>
          </table></div>
        </>)}
        {settlement && title(t("Reparto antes de impuestos y gastos","Split before taxes and expenses"),
          settlement.length ? settlement.map(row=><p key={row.currency}>{row.count} {t("pagos","payments")} · {t("Cobrado","Paid")} {money(row.paid,row.currency,locale)} · {t("Reembolsado","Refunded")} {money(row.refunded,row.currency,locale)} · TallerYA {money(row.tallerya,row.currency,locale)} · {t("Profesor","Instructor")} {money(row.teacher,row.currency,locale)}</p>) : <p>{t("Sin cobros registrados.","No payments recorded.")}</p>)}
        {title(editing?t("Editar edición","Edit workshop"):t("Nueva edición","New workshop"),<form id="workshop-editor" key={editing?.id??"new"} className="grid gap-3 sm:grid-cols-2" onSubmit={form(saveWorkshop)}>
          <Field name="es" label={t("Nombre en español","Spanish title")} value={editing?.es}/>
          <Field name="en" label={t("Nombre en inglés","English title")} value={editing?.en}/>
          <Field name="starts" type="datetime-local" label={t("Inicio en Bogotá","Start in Bogotá")} value={editing?new Date((editing.starts-18000)*1000).toISOString().slice(0,16):undefined}/>
          <Field name="hours" type="number" step="any" min={0.02} label={t("Duración en horas","Duration in hours")} value={editing?editing.minutes/60:undefined}/>
          <Field name="price" type="number" min={0.01} step=".01" label={t("Precio por persona","Price per person")} value={editing?editing.price/100:undefined}/>
          <Field name="venue" label={t("Lugar o dirección en Bogotá","Venue or address in Bogotá")} value={editing?.venue}/>
          <Field name="capacity" type="number" min={1} label={t("Cupo máximo","Maximum capacity")} value={editing?.capacity}/>
          <label className="field">{t("Moneda","Currency")}<select name="currency" defaultValue={editing?.currency??"COP"}>{["COP","USD","EUR"].map(currency=><option key={currency}>{currency}</option>)}</select></label>
          <label className="field">{t("Profesor","Instructor")}<select name="teacher" defaultValue={editing?.teacher??""}><option value="">{t("Por asignar","Unassigned")}</option>{teachers.map(teacher=><option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label>
          <label><input type="checkbox" name="published" defaultChecked={editing?.published}/> {t("Publicar","Publish")}</label>
          <div className="flex flex-wrap gap-2"><button className="button">{t("Guardar","Save")}</button>
            {editing && <button type="button" className="underline" onClick={()=>setEditing(null)}>{t("Dejar de editar","Stop editing")}</button>}</div>
        </form>)}
        {title(t("Gestionar inscripciones","Manage registrations"),<div id="booking-admin">
          <label className="field max-w-md">{t("Buscar inscripciones","Search registrations")}
            <input type="search" value={registrationSearch} onChange={event=>setRegistrationSearch(event.target.value)}/>
          </label>
          {!registrations.length && <p>{t("No hay inscripciones que coincidan.","No matching registrations.")}</p>}
          {registrations.map(booking=><article key={booking.id} className="space-y-2 border-t border-sand/60 py-3">
          <h3 className="font-bold">#{booking.id} · {booking[locale]} · {status[booking.status]}</h3>
          {booking.contact && <p>{booking.contact.name} · {booking.contact.phone} · {booking.contact.email}</p>}
          {profile.role==="owner" && <div className="flex flex-wrap gap-2">
            {booking.status==="hold" && <button className="button" onClick={()=>setMoving(moving===booking.id?null:booking.id)}>{t("Cambiar de edición","Move registration")}</button>}
            {["hold","payment","confirmed"].includes(booking.status) && button(t("Cancelar inscripción","Cancel registration"),async()=>{
              if(confirm(t("¿Cancelar esta inscripción?","Cancel this registration?"))){
                await request(`admin/bookings/${booking.id}/cancel`,"POST");await refresh(profile);
              }
            })}
            {["cancelled","expired"].includes(booking.status) && booking.paid===0 && button(t("Retirar inscripción","Remove registration"),async()=>{
              if(confirm(t("¿Retirar esta inscripción del listado?","Remove this registration from the list?"))){
                await request(`admin/bookings/${booking.id}`,"DELETE");await refresh(profile);
              }
            })}
          </div>}
          {moving===booking.id && booking.status==="hold" && <form className="flex flex-wrap items-end gap-2" onSubmit={form(async data=>{
            await request(`admin/bookings/${booking.id}`,"PUT",{workshop:Number(data.get("workshop"))});
            setMoving(null);await refresh(profile);
          })}>
            <label className="field">{t("Nueva edición","New workshop")}<select name="workshop" required>
              <option value="">{t("Seleccionar","Select")}</option>
              {agenda.filter(item=>item.id!==booking.workshop && item.published && item.available>0 && item.starts>=Date.now()/1000+86400 &&
                item.price===booking.price && item.currency===booking.currency).map(item=>
                <option key={item.id} value={item.id}>{item[locale]} · {dateOf(item.starts,locale)}</option>)}
            </select></label><button className="button">{t("Guardar cambio","Save change")}</button>
          </form>}
          {booking.status==="hold" && <form className="flex flex-wrap items-end gap-2" onSubmit={form(async data=>{
            const sent=await request<{deadline:number}>(`admin/bookings/${booking.id}/payment-sent`,"POST",{payment_url:data.get("url")});
            await refresh(profile);setMessage(t("Plazo de pago: ","Payment deadline: ")+dateOf(sent.deadline,locale));
          })}><Field name="url" type="url" label={t("Enlace enviado por WhatsApp","Link sent by WhatsApp")}/><button className="button">{t("Registrar envío","Record send")}</button></form>}
          {booking.status==="payment" && button(t("Registrar pago","Record payment"),async()=>{await request(`admin/bookings/${booking.id}/paid`,"POST");await refresh(profile);})}
          {booking.refund>0 && <form className="flex flex-wrap items-end gap-2" onSubmit={form(async data=>{
            await request(`admin/bookings/${booking.id}/refund`,"POST",{amount:Math.round(Number(data.get("amount"))*100)});await refresh(profile);
          })}><Field name="amount" type="number" step=".01" min={0.01} value={booking.refunded/100||undefined} label={t("Total reembolsado","Total refunded")}/><button className="button">{t("Registrar reembolso","Record refund")}</button></form>}
        </article>)}</div>)}
        {title(t("Certificados PDF","PDF certificates"),<form className="flex flex-wrap items-end gap-3" onSubmit={form(async data=>{
          await request(`admin/bookings/${certificateBooking}/certificate`,"PUT",data.get("pdf"));
          await refresh(profile);
          setMessage(t("Certificado guardado.","Certificate saved."));
        })}>
          <label className="field">{t("Inscripción finalizada","Completed registration")}
            <select required value={certificateBooking} onChange={event=>setCertificateBooking(event.target.value)}>
              <option value="">{t("Seleccionar","Select")}</option>
              {bookings.filter(booking=>booking.status==="confirmed" && booking.starts+booking.minutes*60<=Date.now()/1000)
                .map(booking=><option key={booking.id} value={booking.id}>{booking[locale]} · {booking.contact?.name} {booking.has_certificate?t("(publicado)","(published)"):""}</option>)}
            </select>
          </label>
          <label className="field">{t("Certificado en PDF","PDF certificate")}<input name="pdf" type="file" accept="application/pdf" required/></label>
          <button className="button">{t("Publicar certificado","Publish certificate")}</button>
        </form>)}
        {title(t("Analítica de los últimos 30 días","Analytics for the last 30 days"),
          events.length ? events.map(event=><p key={event.name+event.locale}>{event.name} ({event.locale}): {event.total}</p>) : <p>{t("Sin eventos registrados.","No events recorded.")}</p>)}
      </>}
      {profile.role==="owner" && title(t("Usuarios","Users"),<div id="user-admin">{users.filter(user=>user.role!=="owner").map(user=><article key={user.id} className="space-y-2 border-t border-sand/60 py-3">
        <h3 className="font-bold">{user.name} · {user.email}</h3>
        <form className="flex flex-wrap items-end gap-2" onSubmit={form(async data=>{
          await request(`admin/users/${user.id}/role`,"PUT",{role:data.get("role")});await refresh(profile);
        })}><label className="field">{t("Rol","Role")}<select name="role" defaultValue={user.role} key={user.role}>
          <option value="student">{t("Estudiante","Student")}</option><option value="teacher">{t("Profesor","Instructor")}</option><option value="manager">{t("Gestor","Manager")}</option>
        </select></label><button className="button">{t("Guardar rol","Save role")}</button></form>
        <form className="flex flex-wrap items-end gap-2" onSubmit={form(async data=>{
          await request(`admin/users/${user.id}/password`,"PUT",{password:data.get("password")});
          setMessage(t("Contraseña cambiada. Las sesiones anteriores se han cerrado.","Password changed. Previous sessions have been signed out."));
        })}><Field name="password" type="password" label={t("Nueva contraseña","New password")}/><button className="button">{t("Cambiar contraseña","Change password")}</button></form>
        {button(t("Eliminar usuario","Delete user"),async()=>{
          if(confirm(t("¿Eliminar este usuario?","Delete this user?"))){await request(`admin/users/${user.id}`,"DELETE");await refresh(profile);}
        })}
      </article>)}</div>)}
    </>}
  </main>;
}
