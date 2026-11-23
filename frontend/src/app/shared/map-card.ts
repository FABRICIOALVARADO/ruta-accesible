import { Component, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Maps, type MapHandle, type RouteResult } from '../core/maps';
import type { Config, Place, Point } from '../core/models';

const area = {north:-12.025,south:-12.101,west:-75.248,east:-75.175};
const pixel = ({lat,lng}:Point) => ({
  x:(lng-area.west)/(area.east-area.west)*100, y:(area.north-lat)/(area.north-area.south)*100,
});
const inside = ({x,y}:{x:number;y:number}) => x>=3 && x<=97 && y>=3 && y<=97;

@Component({selector:'ra-map-card',imports:[RouterLink],templateUrl:'./map-card.html'})
export class MapCard {
  readonly config = input<Config | null>(null);
  readonly places = input<Place[]>([]);
  readonly route = input<RouteResult | null>(null);
  readonly title = input('Mapa de Huancayo');
  readonly root = viewChild<ElementRef<HTMLDivElement>>('google');
  readonly maps = inject(Maps);
  private router = inject(Router);
  private handle = signal<MapHandle | null>(null);
  private failed = signal(false);
  readonly native = computed(() => !!this.handle() && !this.maps.rejected());
  readonly unavailable = computed(() => this.failed() || this.maps.rejected());
  readonly pins = computed(() => this.places().map(place => ({...pixel(place),id:place.id,name:place.name})).filter(inside));
  readonly line = computed(() => {
    const points = this.route()?.points.map(pixel) ?? [];
    return points.length === 2 && points.every(inside) ? points.map(p=>p.x+','+p.y).join(' ') : '';
  });

  constructor() {
    effect(onCleanup => {
      const element = this.root()?.nativeElement, config = this.config();
      if (!element || !config?.maps_key) return;
      let alive = true;
      let handle: MapHandle | null = null;
      this.maps.open(element,config,id=>void this.router.navigate(['/lugares',id])).then(map => {
        if (!alive) { map?.close(); return; }
        handle = map;
        this.handle.set(map);
      }).catch(() => { if (alive) this.failed.set(true); });
      onCleanup(() => { alive=false; handle?.close(); });
    });
    effect(() => this.handle()?.update(this.places(),this.route()));
  }
}
