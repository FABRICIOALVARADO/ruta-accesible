import type { Mode, Option, Point } from './models';

export const fold = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es').trim();
export const dateLabel = (value: string) => new Intl.DateTimeFormat('es-PE', {dateStyle:'medium',timeZone:'America/Lima'}).format(new Date(value));
export const nameFor = (catalog: Option[] | undefined, id: string) => catalog?.find(option => id === option.id)?.name ?? id;
export const facilities: Record<string, string> = {ramp: 'Rampa', bathroom: 'Baño adaptado', tactile: 'Piso táctil', parking: 'Estacionamiento accesible'};
export const metersLabel = (value: number) => value < 1000 ? Math.round(value) + ' m' : (value / 1000).toLocaleString('es-PE', {maximumFractionDigits: 2}) + ' km';

export function distance(a: Point, b: Point) {
  const radians = (angle: number) => angle * Math.PI / 180;
  const h = Math.sin(radians(b.lat - a.lat) / 2) ** 2 + Math.cos(radians(a.lat)) *
    Math.cos(radians(b.lat)) * Math.sin(radians(b.lng - a.lng) / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function coordinates(value: string): Point | undefined {
  const match = value.match(/^\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return;
  const lat = Number(match[1]), lng = Number(match[2]);
  if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return {lat, lng};
}

export function mapsLink(origin: string, destination: string, travelmode: Mode = 'walking') {
  const params = new URLSearchParams({api: '1', destination, travelmode});
  if (origin) params.set('origin',origin);
  return 'https://www.google.com/maps/dir/?' + params.toString();
}
