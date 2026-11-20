import { portalUrl, recordings, workshops } from './config.js';

const isEnglish = document.documentElement.lang === 'en';
const portal = document.querySelector('#portal');
if (portalUrl && URL.canParse(portalUrl) && new URL(portalUrl).protocol === 'https:') {
  portal.href = portalUrl;
  portal.hidden = false;
  document.querySelector('#portal-pending').hidden = true;
}

const list = document.querySelector('#recordings');
for (const recording of recordings) {
  if (!/^[a-zA-Z0-9_-]{11}$/.test(recording.id) || !recording.es || !recording.en) continue;
  const title = isEnglish ? recording.en : recording.es;
  const card = document.createElement('article');
  const heading = document.createElement('h3');
  heading.textContent = title;
  const player = document.createElement('iframe');
  player.title = title;
  player.src = 'https://www.youtube-nocookie.com/embed/' + recording.id;
  player.loading = 'lazy';
  player.allowFullscreen = true;
  const link = document.createElement('a');
  link.href = 'https://www.youtube.com/watch?v=' + recording.id;
  link.textContent = isEnglish ? 'Watch on YouTube' : 'Ver en YouTube';
  card.append(player, heading, link);
  list.append(card);
}
document.querySelector('#no-recordings').hidden = list.childElementCount > 0;

const workshopList = document.querySelector('#workshops');
const locale = isEnglish ? 'en-CO' : 'es-CO';
const dateFormat = new Intl.DateTimeFormat(locale, {
  dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Bogota',
});
const priceFormat = new Intl.NumberFormat(locale, {
  style: 'currency', currency: 'COP', currencyDisplay: 'code',
});
const openingWindow = Date.now() + 24 * 60 * 60 * 1000;
const upcoming = workshops.filter(workshop => (
  Date.parse(workshop.startsAt) >= openingWindow && workshop.es && workshop.en
)).sort((first, second) => Date.parse(first.startsAt) - Date.parse(second.startsAt));

for (const workshop of upcoming) {
  const card = document.createElement('article');
  const heading = document.createElement('h3');
  heading.textContent = isEnglish ? workshop.en : workshop.es;
  const time = document.createElement('time');
  time.dateTime = workshop.startsAt;
  time.textContent = dateFormat.format(new Date(workshop.startsAt));
  const details = document.createElement('p');
  details.textContent = [
    new Intl.NumberFormat(locale, { style: 'unit', unit: 'hour', unitDisplay: 'long' }).format(workshop.hours),
    priceFormat.format(workshop.priceCOP),
  ].join(' · ');
  const availability = document.createElement('p');
  const hasPlaces = Number.isInteger(workshop.available) && workshop.available > 0;
  availability.textContent = hasPlaces
    ? (isEnglish ? 'Places available' : 'Plazas disponibles')
    : (isEnglish ? 'No places available' : 'Sin plazas disponibles');
  card.append(heading, time, details, availability);
  if (hasPlaces && URL.canParse(workshop.bookingUrl) && new URL(workshop.bookingUrl).protocol === 'https:') {
    const booking = document.createElement('a');
    booking.className = 'button';
    booking.href = workshop.bookingUrl;
    booking.textContent = isEnglish ? 'Book a place' : 'Reservar plaza';
    card.append(booking);
  }
  workshopList.append(card);
}
document.querySelector('#no-workshops').hidden = workshopList.childElementCount > 0;

// Both languages use the same section IDs, so the switch can preserve position.
const languageLinks = document.querySelectorAll('.languages a');
function updateLanguageLinks() {
  for (const link of languageLinks) {
    link.hash = window.location.hash;
  }
}
updateLanguageLinks();
window.addEventListener('hashchange', updateLanguageLinks);
