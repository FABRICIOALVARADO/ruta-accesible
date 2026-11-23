import { Injectable, signal } from '@angular/core';
import type { Config, Mode, Place, Point } from './models';

export interface RouteResult { points: Point[]; meters: number; minutes: number | null; real: boolean; }
export interface MapHandle { update(places: Place[], route: RouteResult | null): void; close(): void; }
interface MapObject { setCenter(point: Point): void; setZoom(zoom:number): void; fitBounds(bounds: Bounds, padding:number): void; }
interface Bounds { extend(point: Point): void; }
interface Marker { map: MapObject | null; addEventListener(type: string, callback: () => void): void; }
interface Line { setMap(value: MapObject | null): void; }
interface NativeRoutes {
  Route: { computeRoutes(options: object): Promise<{routes?: {
    path: (Point | {lat(): number; lng(): number})[]; durationMillis: number; distanceMeters: number;
  }[]}> };
}
interface Google { importLibrary(name: string): Promise<unknown>; }
type MapWindow = Window & { google?: { maps: Google }; raMapReady?: () => void; gm_authFailure?: () => void; };
const center = {lat:-12.067, lng:-75.208};

@Injectable({providedIn:'root'})
export class Maps {
  private loading?: Promise<Google>;
  readonly rejected = signal(false);

  private load(config: Config): Promise<Google> {
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

  async open(root: HTMLElement, config: Config, navigate: (id: number) => void): Promise<MapHandle | null> {
    if (!config.maps_key || this.rejected()) return null;
    const api = await this.load(config);
    const [mapApi, markers, core] = await Promise.all([
      api.importLibrary('maps') as Promise<{Map: new (element: HTMLElement, options: object) => MapObject; Polyline: new (options: object)=>Line}>,
      api.importLibrary('marker') as Promise<{AdvancedMarkerElement: new (options: object) => Marker}>,
      api.importLibrary('core') as Promise<{LatLngBounds: new () => Bounds}>,
    ]);
    if (!root.isConnected || this.rejected()) return null;
    const map = new mapApi.Map(root, {center,zoom:13,mapId:config.map_id,mapTypeControl:false,streetViewControl:false});
    let pins: Marker[] = [];
    let line: Line | undefined;
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
