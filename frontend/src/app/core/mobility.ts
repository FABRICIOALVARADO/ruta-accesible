import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { Point } from './models';

export type Coordinate = [number, number];
export type Crossing = 'ramp' | 'level' | 'step' | 'unknown';
export type Surface = 'even' | 'rough' | 'unknown';
export type Quality = 'verified' | 'unknown' | 'demo';
export type Effect = 'hidden' | 'warning' | 'closed';
export interface Profile {
  avoid_stairs: boolean;
  avoid_rough: boolean;
  verified_only: boolean;
  max_slope: number | null;
  min_width: number | null;
}
export const defaultProfile: Profile = {
  avoid_stairs:true, avoid_rough:false, verified_only:false, max_slope:null, min_width:null,
};
export interface Junction extends Point { id:number; name:string; }
export interface FieldCheck {
  stairs:boolean|null; crossing:Crossing; surface:Surface; slope_percent:number|null;
  width_cm:number|null; notes:string; verified:boolean;
}
export interface Street extends Omit<FieldCheck,'verified'> {
  id:number; name:string; start:number; end:number; a:Coordinate; b:Coordinate;
  quality:Quality; checked_at:string|null; closed:boolean; alert_count:number; meters:number;
}
export interface Barrier extends Point {
  report_id:number; title:string; type_id:string; segment_id:number|null; segment_name:string|null;
  map_effect:Effect; status_id:'pending'|'reviewing'|'resolved'; reviewed_at:string|null;
}
export interface Network { junctions:Junction[]; segments:Street[]; barriers:Barrier[]; }
export interface Step extends Street { issues:string[]; }
export interface Candidate {
  meters:number; geometry:Coordinate[]; segments:Step[]; demonstration:boolean;
  unverified_count:number; barrier_count:number;
}
export interface Comparison {
  direct:Candidate|null;
  alternative:Candidate|null;
  reason:'ok'|'outside'|'same'|'disconnected';
  snap:{origin_m:number;destination_m:number}|null;
}
export interface Walk {
  id:number; name:string; description:string; origin:Junction; destination:Junction;
  state:'demo'|'verified'|'unavailable'; route:Candidate|null;
}
export interface Entrance {
  steps:number|null; door_cm:number|null; toilet:'yes'|'no'|'unknown'; entrance:Crossing;
  photo_url:string|null; notes:string; verified:boolean;
}
export interface Inspection extends Entrance { checked_at:string; }

export const qualityLabels:Record<Quality,string> = { verified:'Verificado', unknown:'Sin verificar', demo:'Demostración' };
export const crossingLabels:Record<Crossing,string> = { ramp:'Rampa o rebaje', level:'A nivel', step:'Con desnivel', unknown:'Sin revisar' };
export const surfaceLabels:Record<Surface,string> = { even:'Regular', rough:'Irregular', unknown:'Sin revisar' };
export const toiletLabels = {yes:'Adaptado',no:'Sin baño adaptado',unknown:'Sin confirmar'} as const;

@Injectable({providedIn:'root'})
export class MobilityApi {
  private http=inject(HttpClient);
  network() { return this.get<Network>('/map/network'); }
  compare(origin:Point,destination:Point,preferences:Profile) {
    return this.send<Comparison>('POST','/map/compare',{origin,destination,preferences});
  }
  walks() { return this.get<Walk[]>('/map/walks'); }
  entrance(place:number) { return this.get<Inspection|null>('/map/places/'+place+'/access'); }
  profile() { return this.get<Profile>('/map/preferences'); }
  saveProfile(value:Profile) { return this.send<Profile>('PUT','/map/preferences',value); }
  reports() { return this.get<Barrier[]>('/admin/map/reports'); }
  reviewReport(id:number,effect:Effect) { return this.send<unknown>('PUT','/admin/map/reports/'+id,{effect}); }
  junction(value:Omit<Junction,'id'>) { return this.send<Junction>('POST','/admin/map/junctions',value); }
  segment(value:{name:string;start_id:number;end_id:number}) { return this.send<{id:number}>('POST','/admin/map/segments',value); }
  inspect(id:number,value:FieldCheck) { return this.send<unknown>('POST','/admin/map/segments/'+id+'/checks',value); }
  inspectEntrance(id:number,value:Entrance) { return this.send<unknown>('PUT','/admin/map/places/'+id+'/access',value); }
  publishWalk(value:{name:string;description:string;start_id:number;end_id:number}) {
    return this.send<unknown>('POST','/admin/map/walks',value);
  }

  private get<T>(path:string) { return firstValueFrom(this.http.get<T>('/api'+path)); }
  private send<T>(method:string,path:string,body:unknown) {
    return firstValueFrom(this.http.request<T>(method,'/api'+path,{body}));
  }
}
