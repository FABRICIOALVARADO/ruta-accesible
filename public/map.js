import { esc, icon } from './ui.js';
const center = {lat:-12.067,lng:-75.208};
const bounds = {north:-12.025,south:-12.101,west:-75.248,east:-75.175};
let loader;
const project = point => ({
  x: (point.lng-bounds.west)/(bounds.east-bounds.west)*100,
  y: (bounds.north-point.lat)/(bounds.north-bounds.south)*100
});
const within = point => point.x>=3 && point.x<=97 && point.y>=4 && point.y<=96;
export function mapPanel(title='Mapa de Huancayo',route=false) {
  return '<aside id="map-panel" class="panel map-panel '+(route?'':'map-card')+'"><div class="map-head"><h3>'+esc(title)+'</h3><div class="map-tools"><button class="button subtle" data-action="recenter">'+icon('compass')+' Centrar</button></div></div><div class="map-frame"><div id="map-fallback" class="map-fallback" aria-label="Plano esquemático"></div><div id="map-google" class="map-google" aria-label="Mapa interactivo de Google" hidden></div></div><p class="map-bottom" id="map-status" aria-live="polite">Plano esquemático · ubicaciones referenciales</p></aside>';
}
function loadGoogle(key) {
  if (loader) return loader;
  loader = new Promise((resolve,reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(() => fail('Google Maps no respondió.','network'),12000);
    function fail(message,reason) { clearTimeout(timeout); reject(Object.assign(new Error(message),{reason})); }
    window.gm_authFailure = () => {
      fail('Google Maps rechazó la clave.','auth');
      window.dispatchEvent(new Event('ruta-maps-auth'));
    };
    window.rutaGoogleReady = () => { clearTimeout(timeout); resolve(window.google.maps); };
    const params = new URLSearchParams({key,v:'weekly',loading:'async',callback:'rutaGoogleReady',language:'es',region:'PE'});
    script.src = 'https://maps.googleapis.com/maps/api/js?'+params;
    script.async = true;
    script.onerror = () => fail('Google Maps no pudo cargarse.','network');
    document.head.append(script);
  });
  return loader;
}
export function createMap(config,places,selectPlace) {
  const frame = document.querySelector('#map-panel');
  const fallback = frame.querySelector('#map-fallback');
  const googleFrame = frame.querySelector('#map-google');
  const status = frame.querySelector('#map-status');
  const state = { map:null, pinClass:null, all:places, lines:[], markers:[], endpoints:[], path:null, selected:null };
  const current = () => frame.isConnected;
  function overview() {
    if (state.path?.length && state.map) {
      const area = new google.maps.LatLngBounds();
      state.path.forEach(point => area.extend(point));
      state.map.fitBounds(area,44);
    } else if(state.map) {
      state.map.setCenter(center);
      state.map.setZoom(13);
    }
  }
  function schematic() {
    const pins = [...state.all].reverse().map(place => {
      const p = project(place);
      if (!within(p)) return '';
      return '<button class="map-pin '+(place.id===state.selected?'active':'')+'" style="left:'+p.x+'%;top:'+p.y+'%" data-action="place" data-id="'+place.id+'" title="'+esc(place.name)+'" aria-label="'+esc(place.name)+'">'+icon('pin')+'</button>';
    }).join('');
    const points=state.endpoints.map(project);
    const line = points.length===2 && points.every(within) ? '<path d="M'+points[0].x+' '+points[0].y+'L'+points[1].x+' '+points[1].y+'" stroke="#603aa6" stroke-width="1" fill="none" stroke-dasharray="2 2"/>'+points.map(p=>'<circle cx="'+p.x+'" cy="'+p.y+'" r="1.2" fill="#603aa6" stroke="white" stroke-width=".5"/>').join('') : '';
    fallback.innerHTML='<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="blocks" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-24)"><rect x="1" y="1" width="7.2" height="7.2" rx=".9" fill="#dcd5ec"/></pattern></defs><rect width="100" height="100" fill="#f2edf8"/><path d="M0 9 26 1 58 12 80 38 98 83 78 100H14L3 78 13 53Z" fill="url(#blocks)"/><path d="M0 9C19 28 8 54 0 78" fill="none" stroke="#bcd6e7" stroke-width="2.2"/><path d="M22 0C38 19 29 48 54 100M0 47C28 42 64 40 95 28M21 92 93 60" fill="none" stroke="#fcfafc" stroke-width="2"/>'+line+'</svg>'+pins;
  }
  function updateMarkers() {
    schematic();
    if (!state.map || !state.pinClass) return;
    for (const marker of state.markers) marker.map=null;
    state.markers=state.all.map(place => {
      const marker = new state.pinClass({map:state.map,position:{lat:place.lat,lng:place.lng},title:place.name,gmpClickable:true});
      marker.addEventListener('gmp-click',() => selectPlace(place.id));
      return marker;
    });
  }
  function fallbackMode(message) {
    if (!current()) return;
    googleFrame.hidden=true;
    fallback.hidden=false;
    state.map=null;
    status.textContent=message;
  }
  const onAuthFailure=()=>fallbackMode('Google Maps rechazó la clave. Se muestra el plano esquemático.');
  window.addEventListener('ruta-maps-auth',onAuthFailure);
  const observer = new MutationObserver(()=>{if(!current()){observer.disconnect();window.removeEventListener('ruta-maps-auth',onAuthFailure);}});
  observer.observe(document.querySelector('main'),{childList:true});
  schematic();
  const ready = config.mapsKey ? loadGoogle(config.mapsKey).then(async maps => {
    const [{Map},{AdvancedMarkerElement}] = await Promise.all([maps.importLibrary('maps'),maps.importLibrary('marker')]);
    if (!current() || googleFrame.dataset.disabled) return null;
    googleFrame.hidden=false;
    fallback.hidden=true;
    const map = new Map(googleFrame,{center,zoom:13,mapId:config.mapId||'DEMO_MAP_ID',mapTypeControl:false,streetViewControl:false,fullscreenControl:true,gestureHandling:'cooperative'});
    state.map=map;
    state.pinClass=AdvancedMarkerElement;
    status.textContent='Google Maps · condiciones de accesibilidad según la ficha de cada lugar';
    updateMarkers();
    return map;
  }).catch(() => {fallbackMode('Google Maps no está disponible. Se muestra el plano esquemático.');return null;}) : Promise.resolve(null);
  return {
    setPlaces(list){state.all=list;updateMarkers();},
    select(id){state.selected=id;schematic();const place=state.all.find(p=>p.id===id);if(state.map&&place){state.map.panTo(place);state.map.setZoom(16);}},
    reset:overview,
    showEstimate(points){state.endpoints=points;schematic();},
    clearRoute(){state.endpoints=[];state.path=null;state.lines.forEach(line=>line.setMap(null));state.lines=[];schematic();overview();},
    async compute({origin,destination,travel_mode},isCurrent=()=>true) {
      const map=await ready;
      if (!map || !isCurrent()) return null;
      const {Route}=await google.maps.importLibrary('routes');
      const {routes}=await Route.computeRoutes({
        origin,destination,travelMode:travel_mode,
        fields:['path','distanceMeters','durationMillis'],
      });
      if (!routes?.length || !isCurrent() || !current()) return null;
      const route=routes[0];
      state.lines.forEach(line=>line.setMap(null));
      state.path=route.path;
      state.lines=route.createPolylines();
      for(const line of state.lines) line.setMap(map);
      overview();
      return {meters:route.distanceMeters,minutes:Math.ceil(route.durationMillis/60000)};
    }
  };
}
export function geoDistance(a,b) {
  const radians=angle=>angle*Math.PI/180;
  const h=Math.sin(radians(b.lat-a.lat)/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(radians(b.lng-a.lng)/2)**2;
  return Math.round(12742000*Math.asin(Math.min(1,Math.sqrt(h))));
}
export function coordinates(value) {
  const match=String(value).trim().match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat=Number(match[1]),lng=Number(match[2]);
  return Math.abs(lat)<=90 && Math.abs(lng)<=180 ? {lat,lng} : null;
}

