import { Component, ElementRef, effect, inject, input, output, signal, viewChild } from '@angular/core';
import * as L from 'leaflet';
import { huancayoCenter, huancayoZoom, routeZoom, type MapViewport } from '../core/map-viewport';
import { Maps } from '../core/maps';
import type { Barrier, Candidate, Network, Street } from '../core/mobility';
import type { Config, Point } from '../core/models';

function openLeaflet(host: HTMLElement, pick: (point: Point) => void, tileError: (failed: boolean) => void): MapViewport {
  const map = L.map(host, {
    center:huancayoCenter, zoom:huancayoZoom, zoomControl:false, scrollWheelZoom:false,
  });
  map.attributionControl.setPrefix(false);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:19, attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).on('tileerror',()=>tileError(true)).on('tileload',()=>tileError(false)).addTo(map);
  L.control.scale({imperial:false,maxWidth:95}).addTo(map);
  map.on('click',event=>pick({lat:event.latlng.lat,lng:event.latlng.lng}));
  const layers = L.layerGroup().addTo(map);
  const observer = new ResizeObserver(()=>map.invalidateSize({pan:false}));
  observer.observe(host);
  return {
    clear() { layers.clearLayers(); },
    line({path,color,weight,opacity=1,dashed,select}) {
      const line = L.polyline(path,{color,weight,opacity,dashArray:dashed ? '5 7' : undefined,interactive:!!select});
      if (select) line.on('click',select);
      line.addTo(layers);
    },
    dot({point,radius,color,select}) {
      const dot = L.circleMarker([point.lat,point.lng],{
        radius,color:'#fff',weight:2,fillColor:color,fillOpacity:1,interactive:!!select,
      });
      if (select) dot.on('click',select);
      dot.addTo(layers);
    },
    setPicking(active) { host.style.cursor = active ? 'crosshair' : ''; },
    fit(path) {
      if (path.length) map.fitBounds(L.latLngBounds(path),{padding:[36,36],maxZoom:routeZoom,animate:false});
      else map.setView(huancayoCenter,huancayoZoom,{animate:false});
    },
    zoom(delta) { map.setZoom(map.getZoom()+delta,{animate:false}); },
    close() { observer.disconnect(); map.remove(); },
  };
}

@Component({
  selector:'ra-live-map',
  template:`
    <div class="live-map">
      <div #canvas class="live-map-canvas" role="region" aria-label="Mapa interactivo de Huancayo"></div>
      <div class="map-controls" aria-label="Controles del mapa">
        <button type="button" aria-label="Acercar mapa" title="Acercar" [disabled]="pending()" (click)="zoom(1)">+</button>
        <button type="button" aria-label="Alejar mapa" title="Alejar" [disabled]="pending()" (click)="zoom(-1)">−</button>
        <button type="button" aria-label="Centrar en el recorrido" title="Reencuadrar" [disabled]="pending()" (click)="center()">⌖</button>
      </div>
      @if (pending()) {<p class="map-offline" role="status">Cargando el mapa de Google…</p>}
      @else if (tileError()) {<p class="map-offline" role="status">Fondo de calles temporalmente no disponible.</p>}
      @else if (googleUnavailable()) {<p class="map-offline" role="status">Google Maps no pudo cargar. Vista de calles alternativa activa.</p>}
    </div>
  `,
})
export class LiveMap {
  readonly mapRoot = viewChild<ElementRef<HTMLDivElement>>('canvas');
  readonly config = input<Config|null>(null);
  readonly network = input<Network|null>(null);
  readonly route = input<Candidate|null>(null);
  readonly other = input<Candidate|null>(null);
  readonly origin = input<Point|null>(null);
  readonly destination = input<Point|null>(null);
  readonly report = input<Point|null>(null);
  readonly picking = input(false);
  readonly focus = input<Street|null>(null);
  readonly pick = output<Point>();
  readonly selectStreet = output<Street>();
  readonly selectBarrier = output<Barrier>();
  readonly tileError = signal(false);
  readonly pending = signal(false);
  readonly googleUnavailable = signal(false);

  private readonly maps = inject(Maps);
  private readonly viewport = signal<MapViewport|null>(null);
  private fitted: Candidate|null = null;

  constructor() {
    effect(onCleanup => {
      const root = this.mapRoot()?.nativeElement;
      const config = this.config();
      const rejected = this.maps.rejected();
      if (!root) return;

      const host = document.createElement('div');
      host.className = 'live-map-canvas';
      root.append(host);
      this.viewport.set(null);
      this.fitted = null;
      this.tileError.set(false);
      let viewport: MapViewport|null = null;
      let active = true;
      const pick = (point: Point) => this.pick.emit(point);
      const leaflet = () => {
        if (!active) return;
        host.replaceChildren();
        viewport = openLeaflet(host,pick,failed=>this.tileError.set(failed));
        this.viewport.set(viewport);
        this.googleUnavailable.set(!!config?.maps_key);
        this.pending.set(false);
      };
      onCleanup(() => {
        active = false;
        viewport?.close();
        host.remove();
      });

      if (!config?.maps_key || rejected) {
        leaflet();
        return;
      }
      this.pending.set(true);
      this.googleUnavailable.set(false);
      void this.maps.openMobility(host,config,pick).then(native => {
        if (!active) { native?.close(); return; }
        if (!native) { leaflet(); return; }
        viewport = native;
        this.viewport.set(viewport);
        this.pending.set(false);
      }).catch(leaflet);
    });
    effect(() => {
      const map = this.viewport();
      if (map) this.render(map);
    });
  }

  zoom(direction: number) { this.viewport()?.zoom(direction); }
  center() { this.viewport()?.fit(this.route()?.geometry ?? []); }

  private render(map: MapViewport) {
    const network = this.network(), route = this.route(), other = this.other(), focus = this.focus();
    const picking = this.picking();
    const onStreet = (edge: Street) => picking ? undefined : () => this.selectStreet.emit(edge);
    map.clear();
    map.setPicking(picking);

    for (const edge of network?.segments ?? []) {
      map.line({
        path:[edge.a,edge.b], color:edge.closed ? '#d00000' : edge.quality==='verified' ? '#635347' : '#796f66',
        weight:3, opacity:.68, dashed:edge.quality!=='verified', select:onStreet(edge),
      });
    }
    if (other?.geometry.length) {
      map.line({path:other.geometry,color:'#685b54',weight:5,dashed:true});
    }
    if (route?.geometry.length) {
      map.line({path:route.geometry,color:'#fff',opacity:.98,weight:10});
      for (const edge of route.segments) {
        const selected = edge.id===focus?.id;
        map.line({path:[edge.a,edge.b],color:selected ? '#370617' : '#9d0208',weight:selected ? 9 : 6,select:onStreet(edge)});
      }
      if (this.fitted!==route) map.fit(route.geometry);
    }
    this.fitted = route;
    for (const hazard of network?.barriers ?? []) {
      map.dot({point:hazard,color:'#d00000',radius:8,label:hazard.title,
        select:picking ? undefined : () => this.selectBarrier.emit(hazard)});
    }
    for (const [point,color,label] of [
      [this.origin(),'#03071e','Origen'], [this.destination(),'#9d0208','Destino'], [this.report(),'#dc2f02','Punto del reporte'],
    ] as const) {
      if (point) map.dot({point,color,radius:7,label});
    }
  }
}
