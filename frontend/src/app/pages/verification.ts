import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api, errorText } from '../core/api';
import { dateLabel, coordinates } from '../core/format';
import {
  MobilityApi, crossingLabels, qualityLabels, surfaceLabels,
  type Network, type Barrier, type Effect, type FieldCheck, type Entrance,
} from '../core/mobility';
import type { Place } from '../core/models';
import { Notice, Session } from '../core/session';

const blankCheck:FieldCheck={stairs:null,crossing:'unknown',surface:'unknown',slope_percent:null,width_cm:null,notes:'',verified:false};
const blankEntrance:Entrance={steps:null,door_cm:null,toilet:'unknown',entrance:'unknown',photo_url:null,notes:'',verified:false};
const blankConnection={name:'',start_id:0,end_id:0};

@Component({imports:[FormsModule,RouterLink],templateUrl:'./verification.html'})
export class VerificationPage {
  readonly session=inject(Session);
  private formsApi=inject(MobilityApi);
  private api=inject(Api);
  private notice=inject(Notice);
  private route=inject(ActivatedRoute);
  readonly network=signal<Network|null>(null);
  readonly places=signal<Place[]>([]);
  readonly reports=signal<Barrier[]>([]);
  readonly busy=signal(false);
  readonly loading=signal(true);
  readonly error=signal('');
  readonly sections=[
    {id:'survey',name:'Tramos y cruces'},{id:'entrance',name:'Entradas de lugares'},
    {id:'reports',name:'Barreras para revisar'},{id:'publish',name:'Publicar recorridos'},
  ] as const;
  readonly section=signal<(typeof this.sections)[number]['id']>('survey');
  readonly effects={hidden:'Privado',warning:'Aviso en el mapa',closed:'Tramo cerrado'};
  readonly statuses={pending:'Pendiente',reviewing:'En revisión',resolved:'Resuelto'};
  readonly crossingOptions=Object.entries(crossingLabels);
  readonly surfaceOptions=Object.entries(surfaceLabels);
  readonly quality=qualityLabels;
  readonly date=dateLabel;
  selectedStreet=0;
  selectedPlace=0;
  check:FieldCheck={...blankCheck};
  entrance:Entrance={...blankEntrance};
  junction={name:'',coordinates:''};
  segment={...blankConnection};
  walk={...blankConnection,description:''};
  private entranceGeneration=0;

  constructor() {
    this.session.ready().then(async()=>{
      if(this.session.user()?.role!=='admin')return;
      await this.refresh();
      const id=Number(this.route.snapshot.queryParamMap.get('lugar'));
      if(id && this.places().some(place=>place.id===id)) {
        this.section.set('entrance');
        await this.selectPlace(id);
      }
    }).catch(error=>this.error.set(errorText(error))).finally(()=>this.loading.set(false));
  }

  selectStreet(id:number) {
    this.selectedStreet=id;
    const street=this.network()?.segments.find(item=>item.id===id);
    this.check=street? {
      stairs:street.stairs,crossing:street.crossing,surface:street.surface,
      slope_percent:street.slope_percent,width_cm:street.width_cm,notes:street.notes,verified:street.quality==='verified',
    } : {...blankCheck};
  }

  async selectPlace(id:number) {
    this.selectedPlace=id;
    const request=++this.entranceGeneration;
    this.entrance={...blankEntrance};
    if(!id)return;
    try{
      const result=await this.formsApi.entrance(id);
      if(result && request===this.entranceGeneration){
        const {steps,door_cm,toilet,entrance,photo_url,notes,verified}=result;
        this.entrance={steps,door_cm,toilet,entrance,photo_url,notes,verified:!!verified};
      }
    }catch(error){if(request===this.entranceGeneration)this.error.set(errorText(error));}
  }

  saveCheck() {
    if(!this.selectedStreet)return;
    return this.perform(()=>this.formsApi.inspect(this.selectedStreet,this.check),'Revisión del tramo guardada.');
  }

  saveEntrance() {
    if(!this.selectedPlace)return;
    return this.perform(()=>this.formsApi.inspectEntrance(this.selectedPlace,this.entrance),'Ficha de la entrada guardada.');
  }

  review(report:Barrier,effect:Effect) {
    return this.perform(()=>this.formsApi.reviewReport(report.report_id,effect),'Estado del aviso guardado.');
  }

  resolve(report:Barrier) {
    return this.perform(()=>this.api.status(report.report_id,'resolved'),'Barrera resuelta. El tramo vuelve al cálculo.');
  }

  addJunction() {
    const point=coordinates(this.junction.coordinates);
    if(!point || this.junction.name.trim().length<3) {
      this.error.set('Escribe un nombre y dos coordenadas válidas. Ejemplo: -12.0683, -75.2103.');
      return;
    }
    return this.perform(async()=>{
      await this.formsApi.junction({...point,name:this.junction.name});
      this.junction={name:'',coordinates:''};
    },'Punto registrado.');
  }

  addSegment() {
    return this.perform(async()=>{
      const result=await this.formsApi.segment(this.segment);
      this.segment={...blankConnection};
      this.selectedStreet=result.id;
      this.check={...blankCheck};
    },'Tramo registrado. Completa la revisión de campo.');
  }

  publish() {
    return this.perform(async()=>{
      await this.formsApi.publishWalk(this.walk);
      this.walk={...blankConnection,description:''};
    },'Recorrido publicado.');
  }

  private async refresh() {
    const [network, places, reports]=await Promise.all([this.formsApi.network(),this.api.places(),this.formsApi.reports()]);
    this.network.set(network);
    this.places.set(places);
    this.reports.set(reports);
  }

  private async perform(action:()=>Promise<unknown>, success:string) {
    this.busy.set(true);
    this.error.set('');
    try{ await action(); await this.refresh(); this.notice.show(success); }
    catch(error){ this.error.set(errorText(error)); }
    finally{ this.busy.set(false); }
  }
}
