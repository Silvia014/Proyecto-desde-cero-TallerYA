export type Locale = "es" | "en";
export interface Workshop {
  id: number; es: string; en: string; starts: number; minutes: number;
  capacity: number; price: number; currency: string; available: number;
  teacher: number | null; published: boolean; venue: string;
  counts?: Record<string, number>;
}
export function dateOf(seconds: number, lang: Locale) {
  return new Intl.DateTimeFormat(lang === "es" ? "es-CO" : "en", {
    dateStyle:"medium", timeStyle:"short",timeZone:"America/Bogota",
  }).format(seconds * 1000);
}
export function money(cents:number, currency:string, lang:Locale) {
  return new Intl.NumberFormat(lang,{style:"currency",currency,currencyDisplay:"code"}).format(cents/100);
}
