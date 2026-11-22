export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const icons = {
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  diagonal:'<path d="M6 18 18 6M8 6h10v10"/>',
  pin:'<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  route:'<circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h10a3 3 0 0 0 0-6H7a3 3 0 0 1 0-6h10"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  heart:'<path d="M20.5 8.7C20.5 4 14.7 3 12 7c-2.7-4-8.5-3-8.5 1.7 0 4.2 8.5 9.9 8.5 9.9s8.5-5.7 8.5-9.9Z"/>',
  flag:'<path d="M5 22V3m0 1c6-4 8 4 14 0v11c-6 4-8-4-14 0"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h1m-1 6h1m-1 6h1"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  swap:'<path d="M4 7h16m-4-4 4 4-4 4m4 6H4m4-4-4 4 4 4"/>',
  person:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  star:'<path d="m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>',
  park:'<path d="m12 3 6 8h-3l5 6h-7v4h-2v-4H4l5-6H6l6-8Z"/>',
  culture:'<path d="m3 8 9-5 9 5H3Zm2 3v7m5-7v7m4-7v7m5-7v7M3 21h18"/>',
  health:'<path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6V4Z"/>',
  shop:'<path d="M5 8h14l1 13H4L5 8Z"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/>',
  cafe:'<path d="M4 8h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Zm13 1h2a2 2 0 0 1 0 4h-2M3 21h17M8 3v2m5-2v2"/>'
};
export const icon = name => '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[name] || icons.pin)+'</svg>';
export const features = {ramp:'Rampa',bathroom:'Baño adaptado',tactile:'Piso táctil',parking:'Estacionamiento'};
export const categoryIcons = {Cultura:'culture',Parques:'park',Salud:'health',Comercio:'shop',Gastronomía:'cafe',Servicios:'pin'};
export const modes = {WALKING:'A pie',DRIVING:'En auto',BICYCLING:'En bicicleta',TRANSIT:'Transporte público'};
export const districts = ['Huancayo','El Tambo','Chilca'];
export const reportTypes = ['Rampa bloqueada','Vereda dañada','Sin acceso','Información incorrecta','Otro'];
export const statuses = ['Pendiente','En revisión','Resuelto'];
export const pictures = {
  plaza:'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Plaza_Constituci%C3%B3n_-_Huancayo.jpg/960px-Plaza_Constituci%C3%B3n_-_Huancayo.jpg',
  park:'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ee/Parque_de_la_Identidad_Wanka%2C_Huancayo%2C_Per%C3%BA_01.jpg/960px-Parque_de_la_Identidad_Wanka%2C_Huancayo%2C_Per%C3%BA_01.jpg',
  city:'https://upload.wikimedia.org/wikipedia/commons/1/10/Huancayo_Peru.jpg'
};
export const normalize = value => String(value).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
export const options = (choices,current='') => choices.map(choice => '<option '+(String(choice)===String(current)?'selected':'')+'>'+esc(choice)+'</option>').join('');
export const placeOptions = (places,current='') => places.map(place => '<option value="'+place.id+'" '+(String(place.id)===String(current)?'selected':'')+'>'+esc(place.name)+'</option>').join('');
export const notice = (message,tone='') => '<p class="notice '+tone+'">'+esc(message)+'</p>';
export function dateLabel(date) {
  return new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeZone:'America/Lima'}).format(new Date(date));
}
export function mapsLink({origin='',destination='',travel_mode='WALKING'}={}) {
  const params = new URLSearchParams({ api:'1',destination,travelmode:{WALKING:'walking',DRIVING:'driving',BICYCLING:'bicycling',TRANSIT:'transit'}[travel_mode] || 'walking' });
  if (origin) params.set('origin',origin);
  return 'https://www.google.com/maps/dir/?'+params.toString();
}
export async function api(path,method='GET',data) {
  const response = await fetch('/api'+path,{method, ...(data===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})});
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'No se pudo completar la solicitud.');
  return payload;
}
