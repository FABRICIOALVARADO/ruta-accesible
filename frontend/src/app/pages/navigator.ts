import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api, errorText } from '../core/api';
import { coordinates, dateLabel, fold, mapsLink, metersLabel } from '../core/format';
import {
  MobilityApi, type Barrier, type Candidate, type Comparison, type Network, type Profile, type Street,
  crossingLabels, qualityLabels, surfaceLabels, defaultProfile,
} from '../core/mobility';
import type { Place, Point } from '../core/models';
import { Notice, Session } from '../core/session';
import { LiveMap } from '../shared/live-map';
import { ProfileFields } from '../shared/profile-fields';

type Choice = 'alternative'|'direct';
type Picking = 'origin'|'destination'|'report'|null;

@Component({
  imports:[ReactiveFormsModule,RouterLink,LiveMap,ProfileFields],
  templateUrl:'./navigator.html',
})
export class NavigatorPage {
  private api=inject(Api);
  private mobility=inject(MobilityApi);
  private notice=inject(Notice);
  private router=inject(Router);
  private query=inject(ActivatedRoute);
  readonly session=inject(Session);
  readonly form=inject(FormBuilder).nonNullable.group({origin:'',destination:''});
  readonly network=signal<Network|null>(null);
  readonly places=signal<Place[]>([]);
  readonly profile=signal<Profile>({...defaultProfile});
  readonly comparison=signal<Comparison|null>(null);
  readonly choice=signal<Choice>('alternative');
  readonly active=computed(()=>this.comparison()?.[this.choice()]??null);
  readonly other=computed(()=>this.comparison()?.[this.choice()==='direct'?'alternative':'direct']??null);
  readonly origin=signal<Point|null>(null);
  readonly destination=signal<Point|null>(null);
  readonly report=signal<Point|null>(null);
  readonly picking=signal<Picking>(null);
  readonly focused=signal<Street|null>(null);
  readonly barrier=signal<Barrier|null>(null);
  readonly loading=signal(true);
  readonly busy=signal(false);
  readonly error=signal('');
  readonly google=signal('');
  readonly meters=metersLabel;
  readonly date=dateLabel;
  readonly quality=qualityLabels;
  readonly crossings=crossingLabels;
  readonly surfaces=surfaceLabels;
  private generation=0;
  readonly points=computed(()=>{
    const unique=new Map<string,{name:string;lat:number;lng:number}>();
    for(const item of this.places()) unique.set(fold(item.name),item);
    for(const item of this.network()?.junctions??[]) unique.set(fold(item.name),item);
    return [...unique.values()];
  });

  constructor() {
    const origin=this.query.snapshot.queryParamMap.get('origen') ?? '';
    const destination=this.query.snapshot.queryParamMap.get('destino') ?? '';
    const verified=this.query.snapshot.queryParamMap.get('verificada')==='1';
    this.form.reset({origin,destination});
    this.form.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(()=>this.invalidate());
    Promise.all([this.mobility.network(),this.api.places(),this.session.ready()]).then(async ([graph,places])=>{
      this.network.set(graph);
      this.places.set(places);
      const saved=this.session.user() ? await this.mobility.profile().catch(()=>defaultProfile) : defaultProfile;
      this.profile.set(verified ? {...saved,verified_only:true} : saved);
      this.updateMarkers();
      if(origin && destination) await this.search();
    }).catch(error=>this.error.set(errorText(error))).finally(()=>this.loading.set(false));
  }

  private point(value:string):Point|null {
    const match=coordinates(value)??this.points().find(item=>fold(item.name)===fold(value));
    return match ? {lat:match.lat,lng:match.lng} : null;
  }

  private updateMarkers() {
    const {origin,destination}=this.form.getRawValue();
    this.origin.set(this.point(origin));
    this.destination.set(this.point(destination));
  }

  private invalidate() {
    ++this.generation;
    this.updateMarkers();
    this.comparison.set(null);
    this.focused.set(null);
    this.google.set('');
    this.busy.set(false);
  }

  updateProfile(value:Profile) { this.profile.set(value); this.invalidate(); }

  demo() {
    this.profile.set({...defaultProfile});
    this.form.setValue({origin:'Plaza Constitución',destination:'Plaza de Huamanmarca'});
    void this.search();
  }

  swap() {
    const {origin,destination}=this.form.getRawValue();
    this.form.setValue({origin:destination,destination:origin});
  }

  locate() {
    if (!navigator.geolocation) { this.error.set('La ubicación no está disponible en este navegador.'); return; }
    navigator.geolocation.getCurrentPosition(
      ({coords})=>this.form.controls.origin.setValue(coords.latitude.toFixed(6)+', '+coords.longitude.toFixed(6)),
      ()=>this.error.set('No pudimos obtener tu ubicación. Puedes marcar el origen en el mapa.'), {timeout:10000},
    );
  }

  selectOnMap(point:Point) {
    const action=this.picking();
    if(!action) return;
    if(action==='report') this.report.set(point);
    else this.form.controls[action].setValue(point.lat.toFixed(6)+', '+point.lng.toFixed(6));
    this.picking.set(null);
  }

  showStreet(street:Street) { this.focused.set(street); this.barrier.set(null); }
  showBarrier(barrier:Barrier) { this.barrier.set(barrier); this.focused.set(null); }

  submitReport() {
    const point=this.report();
    if(!point) return;
    void this.router.navigate(['/comunidad'],{queryParams:{lat:point.lat.toFixed(6),lng:point.lng.toFixed(6)}});
  }

  async refresh() {
    try {
      this.network.set(await this.mobility.network());
      if(this.comparison()) await this.search();
      this.notice.show('Mapa actualizado.');
    } catch(error) { this.error.set(errorText(error)); }
  }

  async search() {
    this.error.set('');
    const a=this.origin(), b=this.destination();
    if(!a || !b) { this.error.set('Elige dos lugares del directorio o marca los puntos en el mapa.'); return; }
    const revision=++this.generation;
    this.busy.set(true);
    this.focused.set(null);
    this.google.set(mapsLink(a.lat+','+a.lng,b.lat+','+b.lng));
    try {
      const result=await this.mobility.compare(a,b,this.profile());
      if(revision!==this.generation) return;
      this.comparison.set(result);
      this.choice.set(result.alternative ? 'alternative' : 'direct');
    } catch(error) {
      if(revision===this.generation) this.error.set(errorText(error));
    } finally { if(revision===this.generation) this.busy.set(false); }
  }

  choose(choice:Choice) { this.choice.set(choice); this.focused.set(null); this.barrier.set(null); }

  title(route:Candidate) {
    if(route.demonstration) return 'Datos de demostración';
    return route.unverified_count ? 'Incluye tramos sin verificar' : 'Tramos verificados';
  }
}
