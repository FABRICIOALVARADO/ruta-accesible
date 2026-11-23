import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { BarrierReport, Config, Detail, Filters, Place, PlaceInput, ReportEvent, ReportInput, ReportStatus, SavedTrip, Summary, TripInput, User } from './models';

@Injectable({providedIn: 'root'})
export class Api {
  private http = inject(HttpClient);
  private configuration?: Promise<Config>;

  config() {
    this.configuration ??= this.get<Config>('/config').catch(error => {
      this.configuration = undefined;
      throw error;
    });
    return this.configuration;
  }

  places(filters: Filters = {}) {
    let params = new HttpParams();
    for (const key of ['q', 'district', 'category'] as const) {
      const value = filters[key];
      if (value) params = params.set(key, value);
    }
    for (const id of filters.facility ?? []) params = params.append('facility', id);
    if (filters.verified) params = params.set('verified', true);
    return firstValueFrom(this.http.get<Place[]>('/api/places', { params }));
  }

  detail(id: number) { return this.get<Detail>('/places/' + id); }
  me() { return this.get<{user: User | null}>('/auth/me'); }

  authenticate(values: {name: string; email: string; password: string}, register: boolean) {
    const {email, password} = values;
    return this.send<{user: User}>('POST', '/auth/' + (register ? 'register' : 'login'),
      register ? values : {email, password});
  }

  signOut() { return this.send<void>('POST', '/auth/logout'); }
  profile(name: string) { return this.send<{user: User}>('PATCH', '/auth/profile', {name}); }
  favorites() { return this.get<number[]>('/me/favorites'); }
  favorite(id: number, add: boolean) { return this.send<void>(add ? 'PUT' : 'DELETE', '/me/favorites/' + id); }
  review(id: number, score: number, comment: string) { return this.send<void>('PUT', '/places/' + id + '/review', {rating:score,comment}); }
  removeReview(id: number) { return this.send<void>('DELETE', '/places/' + id + '/review'); }
  myReports() { return this.get<BarrierReport[]>('/me/reports'); }
  report(values: ReportInput) { return this.send<BarrierReport>('POST', '/me/reports', values); }
  history(id: number) { return this.get<ReportEvent[]>('/me/reports/' + id + '/history'); }
  myTrips() { return this.get<SavedTrip[]>('/me/routes'); }
  saveTrip(values: TripInput) { return this.send<SavedTrip>('POST', '/me/routes', values); }
  removeTrip(id: number) { return this.send<void>('DELETE', '/me/routes/' + id); }
  adminPlaces() { return this.get<Place[]>('/admin/places'); }
  adminReports() { return this.get<BarrierReport[]>('/admin/reports'); }
  summary() { return this.get<Summary>('/admin/summary'); }
  savePlace(values: PlaceInput, id: number | null) {
    return this.send<Place>(id === null ? 'POST' : 'PUT', '/admin/places' + (id === null ? '' : '/' + id), values);
  }
  archive(id: number) { return this.send<void>('DELETE', '/admin/places/' + id); }
  restore(id: number) { return this.send<void>('POST', '/admin/places/' + id + '/restore'); }
  status(id: number, status_id: Exclude<ReportStatus,'pending'>) {
    return this.send<BarrierReport>('PATCH', '/admin/reports/' + id, {status_id});
  }

  private get<T>(path: string) { return firstValueFrom(this.http.get<T>('/api' + path)); }
  private send<T>(method: string, path: string, body?: unknown) {
    return firstValueFrom(this.http.request<T>(method, '/api' + path, {body}));
  }
}

export function errorText(error: unknown) {
  if (error instanceof HttpErrorResponse) {
    if (typeof error.error?.detail === 'string') return error.error.detail;
    if (!error.status) return 'No se pudo conectar a la API de Ruta Accesible.';
  }
  return 'No se pudo completar la acción. Intenta de nuevo.';
}
