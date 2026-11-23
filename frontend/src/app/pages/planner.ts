import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api, errorText } from '../core/api';
import { coordinates, distance, fold, mapsLink, metersLabel, nameFor } from '../core/format';
import { Maps, type RouteResult } from '../core/maps';
import type { Config, Mode, Place, SavedTrip } from '../core/models';
import { Notice, Session } from '../core/session';
import { MapCard } from '../shared/map-card';

@Component({imports:[ReactiveFormsModule,RouterLink,MapCard],templateUrl:'./planner.html'})
export class Planner {
  readonly session=inject(Session);
  private api=inject(Api);
  private maps=inject(Maps);
  private notice=inject(Notice);
  private route=inject(ActivatedRoute);
  private forms=inject(FormBuilder).nonNullable;
  readonly config=signal<Config|null>(null);
  readonly places=signal<Place[]>([]);
  readonly saved=signal<SavedTrip[]>([]);
  readonly result=signal<RouteResult|null>(null);
  readonly google=signal('');
  readonly saving=signal(false);
  readonly computing=signal(false);
  readonly busy=signal(false);
  readonly error=signal('');
  readonly meters=metersLabel;
  readonly form=this.forms.group({
    origin:['',[Validators.required,Validators.minLength(3),Validators.maxLength(200)]],
    destination:['',[Validators.required,Validators.minLength(3),Validators.maxLength(200)]],
    mode_id:this.forms.control<Mode>('walking'),
  });
  readonly saveForm=this.forms.group({name:['',[Validators.required,Validators.minLength(2),Validators.maxLength(120)]]});
  private revision=0;

  constructor() {
    const destination=this.route.snapshot.queryParamMap.get('destino');
    if (destination) this.form.controls.destination.setValue(destination.slice(0,200));
    this.form.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(()=>{
      ++this.revision;
      this.result.set(null);
      this.google.set('');
      this.computing.set(false);
    });
    Promise.all([this.api.config(),this.api.places(),this.session.ready()]).then(async ([config,places])=>{
      this.config.set(config);
      this.places.set(places);
      await this.refresh();
    }).catch(error=>this.error.set(errorText(error)));
  }

  private point(text:string) {
    return coordinates(text) ?? this.places().find(place=>fold(place.name)===fold(text));
  }

  private location(text:string) {
    const point=this.point(text);
    return point ? {lat:point.lat,lng:point.lng} : text+', Huancayo, Junín, Perú';
  }

  private valid() {
    const {origin,destination,mode_id}=this.form.getRawValue();
    if (this.form.invalid || origin.trim().length < 3 || destination.trim().length < 3) {
      this.error.set('Completa el origen y el destino con al menos tres caracteres.');
      return null;
    }
    if (fold(origin)===fold(destination)) { this.error.set('Selecciona dos puntos diferentes.'); return null; }
    this.error.set('');
    return {origin:origin.trim(),destination:destination.trim(),mode_id};
  }

  async plan() {
    const values=this.valid();
    if (!values) return;
    const revision=++this.revision;
    this.computing.set(true);
    const origin=this.location(values.origin), destination=this.location(values.destination);
    const address=(point:typeof origin)=>typeof point==='string' ? point : point.lat+','+point.lng;
    this.google.set(mapsLink(address(origin),address(destination),values.mode_id));
    let result:RouteResult|null=null;
    const config=this.config();
    try { if (config) result=await this.maps.plan(config,origin,destination,values.mode_id); } catch { /* Las indicaciones externas siguen disponibles. */ }
    if (revision!==this.revision) return;
    if (!result && typeof origin!=='string' && typeof destination!=='string') {
      result={real:false,minutes:null,meters:distance(origin,destination),points:[origin,destination]};
    }
    this.result.set(result);
    this.computing.set(false);
    if (!result) this.notice.show('Puedes consultar indicaciones en Google Maps.');
  }

  swap() {
    const {origin,destination}=this.form.getRawValue();
    this.form.patchValue({origin:destination,destination:origin});
  }

  locate() {
    if (!navigator.geolocation) { this.error.set('Tu navegador no ofrece acceso a la ubicación.'); return; }
    navigator.geolocation.getCurrentPosition(
      ({coords})=>this.form.controls.origin.setValue(coords.latitude.toFixed(6)+', '+coords.longitude.toFixed(6)),
      ()=>this.error.set('No pudimos acceder a tu ubicación. Escribe un punto de partida.'), {timeout:10000},
    );
  }

  showForm() {
    const values=this.valid();
    if (!values || !this.session.requireLogin()) return;
    this.saveForm.reset({name:values.destination.slice(0,120)});
    this.saving.set(true);
  }

  async save() {
    const values=this.valid(), name=this.saveForm.controls.name.value.trim();
    if (!values || this.saveForm.invalid || name.length<2) return;
    await this.perform(async ()=>{
      await this.api.saveTrip({...values,name});
      this.saving.set(false);
      this.notice.show('Recorrido guardado.');
    });
  }

  load(item:SavedTrip) {
    this.form.setValue({origin:item.origin,destination:item.destination,mode_id:item.mode_id});
    void this.plan();
  }

  remove(id:number) { return this.perform(()=>this.api.removeTrip(id)); }

  mode(id:string) { return nameFor(this.config()?.catalogs.travel_modes,id); }

  private async refresh() {
    if (this.session.user()) this.saved.set(await this.api.myTrips());
  }

  private async perform(task:()=>Promise<void>) {
    this.busy.set(true);
    this.error.set('');
    try { await task(); await this.refresh(); } catch(error) { this.error.set(errorText(error)); }
    finally { this.busy.set(false); }
  }
}
