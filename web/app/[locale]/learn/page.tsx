import {notFound} from "next/navigation";
import Portal from "./portal";

export const metadata={robots:{index:false,follow:false}};
export default async function Learn({params,searchParams}:{
  params:Promise<{locale:string}>;
  searchParams:Promise<{taller?:string}>;
}){
  const {locale}=await params;
  if(locale!=="es" && locale!=="en") notFound();
  const {taller}=await searchParams;
  return <Portal locale={locale} selected={taller && /^\d+$/.test(taller)? Number(taller):undefined}/>;
}
