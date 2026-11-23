import { AfterViewInit, Component, ElementRef, OnDestroy, effect, input, output, signal, viewChild } from '@angular/core';
import * as L from 'leaflet';
import type { Barrier, Candidate, Coordinate, Network, Street } from '../core/mobility';
import type { Point } from '../core/models';

const huancayo: Coordinate = [-12.0697,-75.2101];
const pinKind = {origin:'#3c2d94',destination:'#24614e',report:'#ad3e37'};

@Component({
  selector:'ra-live-map',
  template:`
    <div class="live-map" [class.is-picking]="picking()">
      <div #canvas class="live-map-canvas" role="region" aria-label="Mapa interactivo de Huancayo"></div>
      <div class="map-controls" aria-label="Controles del mapa">
        <button type="button" aria-label="Acercar mapa" title="Acercar" (click)="zoom(1)">+</button>
        <button type="button" aria-label="Alejar mapa" title="Alejar" (click)="zoom(-1)">−</button>
        <button type="button" aria-label="Centrar en el recorrido" title="Reencuadrar" (click)="center()">⌖</button>
      </div>
      @if (tileError()) {<p class="map-offline" role="status">Fondo de calles temporalmente no disponible.</p>}
    </div>
  `,
})
export class LiveMap implements AfterViewInit, OnDestroy {
  readonly mapRoot=viewChild.required<ElementRef<HTMLDivElement>>('canvas');
  readonly network=input<Network|null>(null);
  readonly route=input<Candidate|null>(null);
  readonly other=input<Candidate|null>(null);
  readonly origin=input<Point|null>(null);
  readonly destination=input<Point|null>(null);
  readonly report=input<Point|null>(null);
  readonly picking=input(false);
  readonly focus=input<Street|null>(null);
  readonly pick=output<Point>();
  readonly selectStreet=output<Street>();
  readonly selectBarrier=output<Barrier>();
  readonly tileError=signal(false);
  private map=signal<L.Map|null>(null);
  private layer?:L.LayerGroup;
  private fitted:Candidate|null=null;
  private observer?:ResizeObserver;

  constructor() {
    effect(() => this.render(this.map(), this.network(), this.route(), this.other(), this.focus(),
      this.origin(), this.destination(), this.report()));
  }

  ngAfterViewInit() {
    const surface=this.mapRoot().nativeElement;
    const map=L.map(surface,{center:huancayo,zoom:16,zoomControl:false,scrollWheelZoom:false,attributionControl:true,preferCanvas:false});
    map.attributionControl.setPrefix(false);
    const layer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });
    layer.on('tileerror',()=>this.tileError.set(true)).on('tileload',()=>this.tileError.set(false));
    layer.addTo(map);
    L.control.scale({imperial:false,maxWidth:95}).addTo(map);
    map.on('click',event=>this.pick.emit({lat:event.latlng.lat,lng:event.latlng.lng}));
    this.layer=L.layerGroup().addTo(map);
    this.observer=new ResizeObserver(()=>map.invalidateSize({pan:false}));
    this.observer.observe(surface);
    this.map.set(map);
  }

  ngOnDestroy() { this.observer?.disconnect(); this.map()?.remove(); }

  zoom(direction:number) {
    const current=this.map();
    if (current) current.setZoom(current.getZoom()+direction,{animate:false});
  }

  center() {
    const map=this.map();
    if (!map) return;
    const chosen=this.route();
    if (chosen) map.fitBounds(L.latLngBounds(chosen.geometry),{padding:[30,30],maxZoom:17,animate:false});
    else map.setView(huancayo,16,{animate:false});
  }

  private render(map:L.Map|null,network:Network|null,route:Candidate|null,other:Candidate|null,focus:Street|null,
                 origin:Point|null,destination:Point|null,report:Point|null) {
    const layer=this.layer;
    if (!map || !layer) return;
    layer.clearLayers();
    for (const edge of network?.segments ?? []) {
      const color=edge.closed ? '#a93730' : edge.quality==='verified' ? '#397664' : '#5c586a';
      L.polyline([edge.a,edge.b],{color,opacity:.68,weight:3,dashArray:edge.quality==='verified' ? undefined : '4 6'})
        .on('click',()=>this.selectStreet.emit(edge)).addTo(layer);
    }
    if (other && other.geometry.length) {
      L.polyline(other.geometry,{color:'#747387',weight:5,dashArray:'5 8',interactive:false}).addTo(layer);
    }
    if (route && route.geometry.length) {
      L.polyline(route.geometry,{color:'#fff',opacity:.98,weight:10,interactive:false}).addTo(layer);
      for (const edge of route.segments) {
        L.polyline([edge.a,edge.b],{color:edge.id===focus?.id ? '#291b64' : '#613ad6',weight:edge.id===focus?.id ? 9 : 6})
          .on('click',()=>this.selectStreet.emit(edge)).addTo(layer);
      }
      if (this.fitted!==route) {
        map.fitBounds(L.latLngBounds(route.geometry),{padding:[36,36],maxZoom:17,animate:false});
        this.fitted=route;
      }
    } else { this.fitted=null; }
    for (const hazard of network?.barriers ?? []) {
      L.circleMarker([hazard.lat,hazard.lng],{radius:8,color:'#fff',weight:2,fillColor:'#b94332',fillOpacity:1})
        .on('click',()=>this.selectBarrier.emit(hazard)).addTo(layer);
    }
    for (const [point,color] of [[origin,pinKind.origin],[destination,pinKind.destination],[report,pinKind.report]] as const) {
      if (!point) continue;
      L.circleMarker([point.lat,point.lng],{radius:7,weight:3,color:'#fff',fillColor:color,fillOpacity:1,interactive:false}).addTo(layer);
    }
  }
}
