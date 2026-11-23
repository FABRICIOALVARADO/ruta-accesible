import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, errorText } from '../core/api';
import { dateLabel, nameFor } from '../core/format';
import type { BarrierReport, Config, Place, Summary } from '../core/models';
import { Notice, Session } from '../core/session';

@Component({imports:[ReactiveFormsModule,RouterLink],templateUrl:'./admin.html'})
export class AdminPage {
  readonly session=inject(Session);
  private api=inject(Api);
  private notice=inject(Notice);
  readonly page=signal<'places'|'reports'>('places');
  readonly busy=signal(false);
  readonly loading=signal(true);
  readonly error=signal('');
  readonly formError=signal('');
  readonly config=signal<Config|null>(null);
  readonly places=signal<Place[]>([]);
  readonly reports=signal<BarrierReport[]>([]);
  readonly totals=signal<Summary|null>(null);
  readonly editing=signal(false);
  readonly placeId=signal<number|null>(null);
  readonly confirmation=signal<number|null>(null);
  readonly facilities=signal<ReadonlySet<string>>(new Set());
  readonly date=dateLabel;
  readonly metrics:{key:keyof Summary;label:string}[]=[
    {key:'places',label:'Lugares'},{key:'users',label:'Cuentas'},{key:'reports',label:'Reportes'},
    {key:'reviews',label:'Reseñas'},{key:'routes',label:'Recorridos'},
  ];
  readonly kinds=[
    {id:'plaza',name:'Plaza'},{id:'park',name:'Parque'},{id:'hill',name:'Mirador'},
    {id:'health',name:'Salud'},{id:'shop',name:'Comercio'},{id:'culture',name:'Cultura'},{id:'cafe',name:'Cafetería'},
  ];
  readonly form=inject(FormBuilder).nonNullable.group({
    name:['',[Validators.required,Validators.minLength(2),Validators.maxLength(120)]],
    address:['',[Validators.required,Validators.minLength(3),Validators.maxLength(200)]],
    description:['',[Validators.required,Validators.minLength(10),Validators.maxLength(1500)]],
    category_id:['service',Validators.required],district_id:['huancayo',Validators.required],image:'plaza',
    lat:[-12.067,[Validators.required,Validators.min(-90),Validators.max(90)]],
    lng:[-75.208,[Validators.required,Validators.min(-180),Validators.max(180)]],
    is_demo:true,verified:false,
  });

  constructor() {
    this.session.ready().then(async ()=>{
      if (this.session.user()?.role!=='admin') return;
      this.config.set(await this.api.config());
      await this.refresh();
    }).catch(error=>this.error.set(errorText(error))).finally(()=>this.loading.set(false));
  }

  edit(place?:Place) {
    this.placeId.set(place?.id ?? null);
    this.formError.set('');
    this.facilities.set(new Set(place?.facilities ?? []));
    const details=place ? {
      name:place.name,address:place.address,description:place.description,category_id:place.category_id,district_id:place.district_id,
      lat:place.lat,lng:place.lng,image:place.image,is_demo:place.is_demo,verified:!!place.verified_at,
    }:undefined;
    this.form.reset(details);
    this.verification();
    this.editing.set(true);
  }

  verification() {
    const verified=this.form.controls.verified;
    if (this.form.controls.is_demo.value) { verified.setValue(false); verified.disable(); }
    else verified.enable();
  }

  toggle(id:string) {
    const chosen=new Set(this.facilities());
    if (chosen.has(id)) chosen.delete(id); else chosen.add(id);
    this.facilities.set(chosen);
  }

  async save() {
    this.formError.set('');
    const values=this.form.getRawValue();
    if (this.form.invalid || values.name.trim().length<2 || values.address.trim().length<3 || values.description.trim().length<10) {
      this.formError.set('Revisa el nombre, la dirección, la descripción y las coordenadas.');
      return;
    }
    this.busy.set(true);
    try {
      await this.api.savePlace({...values,facilities:[...this.facilities()]},this.placeId());
      this.editing.set(false);
      await this.refresh();
      this.notice.show('Ficha guardada.');
    } catch(error) { (this.editing() ? this.formError : this.error).set(errorText(error)); }
    finally { this.busy.set(false); }
  }

  archive(id:number,restore:boolean) {
    return this.perform(async ()=>{
      if (restore) await this.api.restore(id); else await this.api.archive(id);
      this.confirmation.set(null);
      this.notice.show(restore ? 'Ficha restaurada.' : 'Ficha archivada.');
    });
  }

  update(item:BarrierReport) {
    return this.perform(async ()=>{
      await this.api.status(item.id,item.status_id==='reviewing' ? 'resolved' : 'reviewing');
      this.notice.show('Estado actualizado.');
    });
  }

  status(id:string) { return nameFor(this.config()?.catalogs.report_statuses,id); }

  private async refresh() {
    const [places,reports,totals]=await Promise.all([this.api.adminPlaces(),this.api.adminReports(),this.api.summary()]);
    this.places.set(places);
    this.reports.set(reports);
    this.totals.set(totals);
  }

  private async perform(task:()=>Promise<void>) {
    this.busy.set(true);
    this.error.set('');
    try { await task(); await this.refresh(); } catch(error) { this.error.set(errorText(error)); }
    finally { this.busy.set(false); }
  }
}
