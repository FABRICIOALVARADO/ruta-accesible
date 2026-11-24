import { Injectable, signal } from '@angular/core';
import { huancayoCenter, huancayoZoom, routeZoom, type MapViewport } from './map-viewport';
import type { Config, Mode, Place, Point } from './models';

export interface RouteResult { points: Point[]; meters: number; minutes: number | null; real: boolean; }
export interface MapHandle { update(places: Place[], route: RouteResult | null): void; close(): void; }
interface NativeRoutes {
  Route: { computeRoutes(options: object): Promise<{routes?: {
    path: (Point | {lat(): number; lng(): number})[]; durationMillis: number; distanceMeters: number;
  }[]}> };
}
type MapWindow = Window & { google?: typeof google; raMapReady?: () => void; gm_authFailure?: () => void; };
const center = {lat:-12.067, lng:-75.208};
const toPoint = ([lat,lng]: readonly [number,number]) => ({lat,lng});

@Injectable({providedIn:'root'})
export class Maps {
  private loading?: Promise<typeof google.maps>;
  readonly rejected = signal(false);

  private load(config: Config): Promise<typeof google.maps> {
    const target = window as MapWindow;
    this.loading ??= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = setTimeout(() => reject(new Error('No se pudo cargar Google Maps.')), 12000);
      target.raMapReady = () => {
        clearTimeout(timeout);
        if (target.google?.maps) resolve(target.google.maps);
        else reject(new Error('Google Maps no está disponible.'));
      };
      target.gm_authFailure = () => {
        clearTimeout(timeout);
        this.rejected.set(true);
        reject(new Error('Google Maps rechazó la configuración.'));
      };
      script.onerror = () => { clearTimeout(timeout); reject(new Error('Google Maps no respondió.')); };
      script.async = true;
      script.src = 'https://maps.googleapis.com/maps/api/js?' + new URLSearchParams({
        key:config.maps_key, callback:'raMapReady', v:'weekly', language:'es', region:'PE', loading:'async',
      });
      document.head.append(script);
    });
    return this.loading;
  }

  private async mapLibraries(config: Config) {
    const api = await this.load(config);
    return Promise.all([
      api.importLibrary('maps') as Promise<google.maps.MapsLibrary>,
      api.importLibrary('marker') as Promise<google.maps.MarkerLibrary>,
      api.importLibrary('core') as Promise<google.maps.CoreLibrary>,
    ]);
  }

  async open(root: HTMLElement, config: Config, navigate: (id: number) => void): Promise<MapHandle | null> {
    if (!config.maps_key || this.rejected()) return null;
    const [mapApi, markers, core] = await this.mapLibraries(config);
    if (!root.isConnected || this.rejected()) return null;
    const map = new mapApi.Map(root, {center,zoom:13,mapId:config.map_id,mapTypeControl:false,streetViewControl:false});
    let pins: google.maps.marker.AdvancedMarkerElement[] = [];
    let line: google.maps.Polyline | undefined;
    const clear = () => { for (const pin of pins) pin.map = null; line?.setMap(null); };
    return {
      close: clear,
      update(places, route) {
        clear();
        const points = route?.points ?? places;
        const toPoint = ({lat,lng}: Point) => ({lat,lng});
        if (route?.real && points.length) {
          line = new mapApi.Polyline({map,path:points,strokeColor:'#5734a9',strokeWeight:5,strokeOpacity:.9});
        }
        pins = route?.real ? [points[0], points[points.length-1]].filter(p=>p !== undefined)
          .map(position => new markers.AdvancedMarkerElement({map,position})) : places.map(place => {
            const marker = new markers.AdvancedMarkerElement({map,position:toPoint(place),title:place.name,gmpClickable:true});
            marker.addEventListener('gmp-click', () => navigate(place.id));
            return marker;
          });
        if (points.length >= 2) {
          const bounds = new core.LatLngBounds();
          points.forEach(point => bounds.extend(toPoint(point)));
          map.fitBounds(bounds, 40);
        } else {
          map.setCenter(points[0] ? toPoint(points[0]) : center);
          map.setZoom(points.length ? 15 : 13);
        }
      },
    };
  }

  async openMobility(root: HTMLElement, config: Config, pick: (point: Point) => void): Promise<MapViewport | null> {
    if (!config.maps_key || this.rejected()) return null;
    const [maps, markers, core] = await this.mapLibraries(config);
    if (!root.isConnected || this.rejected()) return null;

    const map = new maps.Map(root, {
      center: toPoint(huancayoCenter), zoom: huancayoZoom, mapId: config.map_id, disableDefaultUI: true,
      clickableIcons: false, gestureHandling: 'cooperative',
    });
    const layers: (() => void)[] = [];
    let fitted: google.maps.MapsEventListener | undefined;
    const click = map.addListener('click', (event: google.maps.MapMouseEvent) => {
      if (event.latLng) pick(event.latLng.toJSON());
    });
    const clear = () => {
      for (const remove of layers.splice(0)) remove();
    };

    return {
      clear,
      line({path,color,weight,opacity=1,dashed,select}) {
        const edge = new maps.Polyline({
          path: path.map(toPoint), map, strokeColor: color, strokeWeight: weight,
          strokeOpacity: dashed ? 0 : opacity, clickable: !!select,
          icons: dashed ? [{
            icon: {path:'M 0,-1 0,1',strokeColor:color,strokeOpacity:opacity,strokeWeight:weight,scale:2},
            repeat:'12px',
          }] : undefined,
        });
        const listener = select ? edge.addListener('click', select) : undefined;
        layers.push(() => { listener?.remove(); edge.setMap(null); });
      },
      dot({point,label,color,radius,select}) {
        const symbol = document.createElement('span');
        symbol.className = 'map-network-dot';
        symbol.style.backgroundColor = color;
        symbol.style.width = symbol.style.height = (radius * 2) + 'px';
        const marker = new markers.AdvancedMarkerElement({
          map, position:point, title:label, gmpClickable:!!select, anchorTop:'-50%', anchorLeft:'-50%',
        });
        marker.append(symbol);
        if (select) marker.addEventListener('gmp-click', select);
        layers.push(() => {
          if (select) marker.removeEventListener('gmp-click', select);
          marker.map = null;
        });
      },
      setPicking(active) { map.setOptions({draggableCursor:active ? 'crosshair' : 'grab'}); },
      fit(path) {
        fitted?.remove();
        if (!path.length) {
          map.setCenter(toPoint(huancayoCenter));
          map.setZoom(huancayoZoom);
          return;
        }
        const bounds = new core.LatLngBounds();
        path.forEach(point => bounds.extend(toPoint(point)));
        fitted = core.event.addListenerOnce(map,'idle',() => {
          if ((map.getZoom() ?? 0) > routeZoom) map.setZoom(routeZoom);
        });
        map.fitBounds(bounds, 36);
      },
      zoom(delta) { map.setZoom((map.getZoom() ?? huancayoZoom) + delta); },
      close() {
        clear();
        click.remove();
        fitted?.remove();
        core.event.clearInstanceListeners(map);
      },
    };
  }

  async plan(config: Config, origin: Point | string, destination: Point | string, mode: Mode): Promise<RouteResult | null> {
    if (!config.maps_key || this.rejected()) return null;
    const maps = await this.load(config);
    const {Route} = await maps.importLibrary('routes') as NativeRoutes;
    const {routes} = await Route.computeRoutes({
      origin,destination,travelMode:mode.toUpperCase(),fields:['path','durationMillis','distanceMeters'],
    });
    const result = routes?.[0];
    if (!result?.path?.length || !Number.isFinite(result.distanceMeters) || this.rejected()) return null;
    return {
      real:true, meters:result.distanceMeters,
      minutes:Number.isFinite(result.durationMillis) ? Math.ceil(result.durationMillis / 60000) : null,
      points:result.path.map(point => typeof point.lat === 'function' && typeof point.lng === 'function'
        ? {lat:point.lat(),lng:point.lng()} : point as Point),
    };
  }
}
