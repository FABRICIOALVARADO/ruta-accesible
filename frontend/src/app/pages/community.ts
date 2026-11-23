import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api, errorText } from '../core/api';
import { coordinates, dateLabel, nameFor } from '../core/format';
import type { BarrierReport, Config, Place, Point, ReportEvent } from '../core/models';
import { Notice, Session } from '../core/session';

@Component({imports:[ReactiveFormsModule,RouterLink],templateUrl:'./community.html'})
export class Community {
  readonly session=inject(Session);
  private api=inject(Api);
  private route=inject(ActivatedRoute);
  private notice=inject(Notice);
  readonly config=signal<Config|null>(null);
  readonly places=signal<Place[]>([]);
  readonly reports=signal<BarrierReport[]>([]);
  readonly open=signal<number|null>(null);
  readonly events=signal<ReportEvent[]>([]);
  readonly loadingHistory=signal(false);
  readonly busy=signal(false);
  readonly error=signal('');
  readonly marked=signal<Point|null>(null);
  readonly date=dateLabel;
  readonly form=inject(FormBuilder).nonNullable.group({
    place_id:0,location:['',Validators.maxLength(200)],type_id:['',Validators.required],
    title:['',[Validators.required,Validators.minLength(5),Validators.maxLength(120)]],
    description:['',[Validators.required,Validators.minLength(10),Validators.maxLength(1500)]],
  });

  constructor() {
    const params=this.route.snapshot.queryParamMap;
    const lat=params.get('lat'), lng=params.get('lng');
    const marked=lat!==null && lng!==null ? coordinates(lat+', '+lng) : undefined;
    if(marked) {
      this.marked.set(marked);
      this.form.controls.location.setValue('Punto marcado en el mapa');
    }
    Promise.all([this.api.config(),this.api.places(),this.session.ready()]).then(async ([config,places])=>{
      this.config.set(config);
      this.places.set(places);
      const id=Number(this.route.snapshot.queryParamMap.get('lugar'));
      if (places.some(place=>place.id===id)) this.form.controls.place_id.setValue(id);
      await this.refresh();
    }).catch(error=>this.error.set(errorText(error)));
  }

  async send() {
    const {title,description,type_id,place_id,location}=this.form.getRawValue();
    if (this.form.invalid || title.trim().length<5 || description.trim().length<10) {
      this.error.set('Selecciona el tipo. Escribe al menos cinco caracteres en el título y diez en la descripción.');
      return;
    }
    if ((!place_id || location.trim()) && location.trim().length<3) {
      this.error.set('Selecciona un lugar o escribe una dirección de referencia.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const point=this.marked();
      await this.api.report({title,description,type_id,place_id:place_id||null,location:location.trim()||null,...(point??{})});
      this.form.reset();
      this.marked.set(null);
      await this.refresh();
      this.notice.show('Reporte enviado.');
    } catch(error) { this.error.set(errorText(error)); }
    finally { this.busy.set(false); }
  }

  async history(id:number) {
    if (this.open()===id) { this.open.set(null); return; }
    this.open.set(id);
    this.events.set([]);
    this.loadingHistory.set(true);
    try {
      const events=await this.api.history(id);
      if (this.open()===id) this.events.set(events);
    } catch(error) { if (this.open()===id) this.error.set(errorText(error)); }
    finally { if (this.open()===id) this.loadingHistory.set(false); }
  }

  status(id:string) { return nameFor(this.config()?.catalogs.report_statuses,id); }
  returnPath() {
    const query=new URLSearchParams();
    const point=this.marked();
    const place=this.route.snapshot.queryParamMap.get('lugar');
    if(place)query.set('lugar',place);
    if(point){query.set('lat',String(point.lat));query.set('lng',String(point.lng));}
    return '/comunidad'+(query.size?'?'+query.toString():'');
  }
  type(id:string) { return nameFor(this.config()?.catalogs.report_types,id); }

  private async refresh() { if (this.session.user()) this.reports.set(await this.api.myReports()); }
}
