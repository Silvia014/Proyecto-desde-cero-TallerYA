"use client";

import {useEffect,useState} from "react";
import type {FormEvent,ReactNode} from "react";
import {dateOf,money} from "../../shared";
import type {Locale,Workshop} from "../../shared";

type User={id:number;name:string;email:string;phone:string;notices:boolean;role:"student"|"teacher"|"manager"|"owner"};
type Booking={id:number;workshop:number;user:number;status:string;es:string;en:string;starts:number;minutes:number;contact?:{name:string;email:string;phone:string};deadline:number|null;has_certificate:boolean;refund:number;refunded:number};
type Settlement={currency:string;count:number;paid:number;refunded:number;tallerya:number;teacher:number};
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
  const [events,setEvents]=useState<EventCount[]>([]);
  const [workshop,setWorkshop]=useState<Workshop|null>(null);
  const [editing,setEditing]=useState<Workshop|null>(null);
  const [settlement,setSettlement]=useState<Settlement[]|null>(null);
  const isStaff=profile?.role==="owner" || profile?.role==="manager";
  const errors:Record<string,string>={
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
        const [all,counts,staffTeachers]=await Promise.all([
          request<Booking[]>("admin/bookings"), request<EventCount[]>("admin/telemetry"),
          request<Pick<User,"id"|"name">[]>("admin/teachers"),
        ]);
        setBookings(all);setEvents(counts);setTeachers(staffTeachers);
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
      capacity:Number(data.get("capacity")),currency:data.get("currency"),published:data.has("published"),
      teacher:Number(data.get("teacher"))||null};
    await request("admin/workshops"+(editing?"/"+editing.id:""),editing?"PUT":"POST",payload);
    setEditing(null);
    if(profile) await refresh(profile);
    setMessage(t("Curso guardado.","Workshop saved."));
  }

  const status:Record<string,string>={
    hold:t("Pendiente de envío de pago","Awaiting payment instructions"),payment:t("Pendiente de pago","Awaiting payment"),
    confirmed:t("Confirmada","Confirmed"),cancelled:t("Cancelada","Cancelled"),expired:t("Caducada","Expired"),
  };
  const learnPath=(language:string)=>`/${language}/learn${selected?`?taller=${selected}`:""}`;

  return <main className="shell py-8">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-3xl font-black">Learn TallerYA</h1>
      <nav className="flex flex-wrap gap-4">
        <a href={`/${locale}#talleres`}>{t("Catálogo","Catalogue")}</a>
        <a href={learnPath("es")} lang="es">Español</a><a href={learnPath("en")} lang="en">English</a>
      </nav>
    </header>
    {message && <p role="status" className="mb-4 rounded bg-lime-200 p-3">{message}</p>}
    {loading ? <p>{t("Cargando…","Loading…")}</p> : !profile ? title(register?t("Únete al Club TallerYA","Join Club TallerYA"):t("Iniciar sesión","Sign in"),
      <form className="max-w-md space-y-4" onSubmit={form(authenticate)}>
        {register && <><Field name="name" label={t("Nombre","Name")}/><Field name="phone" type="tel" label={t("Teléfono","Phone")}/></>}
        <Field name="email" type="email" label={t("Correo electrónico","Email")}/>
        <Field name="password" type="password" label={t("Contraseña (12 caracteres como mínimo)","Password (at least 12 characters)")}/>
        {register && <>
          <label className="block"><input name="privacy" type="checkbox" required/> {t("Acepto el","I accept the")} <a className="underline" href={`/${locale}/privacy`} target="_blank" rel="noreferrer">{t("aviso de privacidad","privacy notice")}</a></label>
          <label className="block"><input name="notices" type="checkbox"/> {t("Quiero recibir novedades y avisos de plazas.","I want news and availability notifications.")}</label>
        </>}
        <div className="flex flex-wrap gap-4"><button className="button">{register?t("Crear cuenta","Create account"):t("Entrar","Sign in")}</button>
          <button type="button" className="underline" onClick={()=>{setRegister(!register);setMessage("");}}>{register?t("Ya tengo cuenta","I have an account"):t("Crear cuenta","Create account")}</button></div>
      </form>) : <>
      <div className="flex items-center justify-between gap-4"><p>{profile.name}</p>
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
        {title(t("Mis reservas y certificados","My bookings and certificates"),bookings.map(booking=><article key={booking.id} className="border-t border-slate-200 py-3">
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
      {(isStaff || profile.role==="teacher") && title(t("Agenda de cursos","Workshop schedule"),agenda.map(item=><article key={item.id} className="border-t border-slate-200 py-3">
        <h3 className="font-bold">{item[locale]}</h3><p>{dateOf(item.starts,locale)} · {item.available}/{item.capacity} {t("plazas libres","places available")}</p>
        {item.counts && <p>{t("Pendientes","Pending")}: {(item.counts.hold??0)+(item.counts.payment??0)} · {t("Confirmadas","Confirmed")}: {item.counts.confirmed??0}</p>}
        {isStaff && <div className="mt-2 flex flex-wrap gap-2">
          <button className="button" onClick={()=>setEditing(item)}>{t("Editar","Edit")}</button>
          {button(t("Ver liquidación","View settlement"),async()=>setSettlement(await request<Settlement[]>(`admin/workshops/${item.id}/settlement`)))}
        </div>}
      </article>))}
      {isStaff && <>
        {settlement && title(t("Reparto antes de impuestos y gastos","Split before taxes and expenses"),
          settlement.length ? settlement.map(row=><p key={row.currency}>{row.count} {t("pagos","payments")} · {t("Cobrado","Paid")} {money(row.paid,row.currency,locale)} · {t("Reembolsado","Refunded")} {money(row.refunded,row.currency,locale)} · TallerYA {money(row.tallerya,row.currency,locale)} · {t("Profesor","Instructor")} {money(row.teacher,row.currency,locale)}</p>) : <p>{t("Sin cobros registrados.","No payments recorded.")}</p>)}
        {title(editing?t("Editar edición","Edit workshop"):t("Nueva edición","New workshop"),<form key={editing?.id??"new"} className="grid gap-3 sm:grid-cols-2" onSubmit={form(saveWorkshop)}>
          <Field name="es" label={t("Nombre en español","Spanish title")} value={editing?.es}/>
          <Field name="en" label={t("Nombre en inglés","English title")} value={editing?.en}/>
          <Field name="starts" type="datetime-local" label={t("Inicio en Bogotá","Start in Bogotá")} value={editing?new Date((editing.starts-18000)*1000).toISOString().slice(0,16):undefined}/>
          <Field name="hours" type="number" step="any" min={0.02} label={t("Duración en horas","Duration in hours")} value={editing?editing.minutes/60:undefined}/>
          <Field name="price" type="number" min={0.01} step=".01" label={t("Precio por persona","Price per person")} value={editing?editing.price/100:undefined}/>
          <Field name="capacity" type="number" min={1} label={t("Cupo máximo","Maximum capacity")} value={editing?.capacity}/>
          <label className="field">{t("Moneda","Currency")}<select name="currency" defaultValue={editing?.currency??"COP"}>{["COP","USD","EUR"].map(currency=><option key={currency}>{currency}</option>)}</select></label>
          <label className="field">{t("Profesor","Instructor")}<select name="teacher" defaultValue={editing?.teacher??""}><option value="">{t("Por asignar","Unassigned")}</option>{teachers.map(teacher=><option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label>
          <label><input type="checkbox" name="published" defaultChecked={editing?.published}/> {t("Publicar","Publish")}</label>
          <div className="flex flex-wrap gap-2"><button className="button">{t("Guardar","Save")}</button>
            {editing && <button type="button" className="underline" onClick={()=>setEditing(null)}>{t("Dejar de editar","Stop editing")}</button>}</div>
        </form>)}
        {title(t("Gestionar reservas","Manage bookings"),bookings.map(booking=><article key={booking.id} className="space-y-2 border-t border-slate-200 py-3">
          <h3 className="font-bold">#{booking.id} · {booking[locale]} · {status[booking.status]}</h3>
          {booking.contact && <p>{booking.contact.name} · {booking.contact.phone} · {booking.contact.email}</p>}
          {booking.status==="hold" && <form className="flex flex-wrap items-end gap-2" onSubmit={form(async data=>{
            const sent=await request<{deadline:number}>(`admin/bookings/${booking.id}/payment-sent`,"POST",{payment_url:data.get("url")});
            await refresh(profile);setMessage(t("Plazo de pago: ","Payment deadline: ")+dateOf(sent.deadline,locale));
          })}><Field name="url" type="url" label={t("Enlace enviado por WhatsApp","Link sent by WhatsApp")}/><button className="button">{t("Registrar envío","Record send")}</button></form>}
          {booking.status==="payment" && button(t("Registrar pago","Record payment"),async()=>{await request(`admin/bookings/${booking.id}/paid`,"POST");await refresh(profile);})}
          {booking.refund>0 && <form className="flex flex-wrap items-end gap-2" onSubmit={form(async data=>{
            await request(`admin/bookings/${booking.id}/refund`,"POST",{amount:Math.round(Number(data.get("amount"))*100)});await refresh(profile);
          })}><Field name="amount" type="number" step=".01" min={0.01} value={booking.refunded/100||undefined} label={t("Total reembolsado","Total refunded")}/><button className="button">{t("Registrar reembolso","Record refund")}</button></form>}
          {booking.status==="confirmed" && booking.starts+booking.minutes*60<=Date.now()/1000 && <form onSubmit={form(async data=>{
            await request(`admin/bookings/${booking.id}/certificate`,"PUT",data.get("pdf"));await refresh(profile);
            setMessage(t("Certificado guardado.","Certificate saved."));
          })}><label className="field">{t("Certificado en PDF","PDF certificate")}<input name="pdf" type="file" accept="application/pdf" required/></label><button className="button mt-2">{t("Publicar certificado","Publish certificate")}</button></form>}
        </article>))}
        {title(t("Analítica de los últimos 30 días","Analytics for the last 30 days"),
          events.length ? events.map(event=><p key={event.name+event.locale}>{event.name} ({event.locale}): {event.total}</p>) : <p>{t("Sin eventos registrados.","No events recorded.")}</p>)}
      </>}
      {profile.role==="owner" && title(t("Usuarios","Users"),users.filter(user=>user.role!=="owner").map(user=><article key={user.id} className="space-y-2 border-t border-slate-200 py-3">
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
      </article>))}
    </>}
  </main>;
}
