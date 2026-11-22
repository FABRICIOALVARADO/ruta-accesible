import {api,esc,icon,features,normalize,modes,notice} from './ui.js';
import {createMap,coordinates,geoDistance} from './map.js';
import * as view from './views.js';
const main=document.querySelector('main');
const dialog=document.querySelector('#dialog');
const content=dialog.querySelector('.dialog-content');
const account=document.querySelector('#account');
const toast=document.querySelector('#toast');
const nav=document.querySelector('#primary-nav');
const menu=document.querySelector('#menu');
const initialFilters=()=>({q:'',category:'',district:'',verified:false,...Object.fromEntries(Object.keys(features).map(key=>[key,false]))});
const state={
  config:{categories:[]},places:[],user:null,favorites:new Set(),reports:[],routes:[],users:[],stats:null,
  filters:initialFilters(),route:{origin:'',destination:'',travel_mode:'WALKING'},adminTab:'Lugares',page:'inicio'
};
let map=null,routeRun=0,toaster,detailId=null,afterLogin=null,lastFocus=null;
const pages={inicio:view.home,explorar:view.explore,rutas:view.routeView,comunidad:view.community,cuenta:view.account,admin:view.admin,guia:view.guide,acerca:view.about};

function announce(message) {
  toast.textContent=message;
  clearTimeout(toaster);
  toaster=setTimeout(()=>toast.textContent='',3900);
}
function render() {
  routeRun++;
  const hash=location.hash.slice(1);
  if (Object.hasOwn(pages,hash) || !hash) state.page=hash||'inicio';
  main.innerHTML=pages[state.page](state);
  map=null;
  for (const anchor of nav.querySelectorAll('a')) {
    if (anchor.hash==='#'+state.page) anchor.setAttribute('aria-current','page');
    else anchor.removeAttribute('aria-current');
  }
  document.querySelector('#admin-nav').hidden=state.user?.role!=='admin';
  account.innerHTML=state.user?view.link('Mi cuenta','#cuenta','subtle','person'):view.button('Entrar','login','','person');
  if(state.page==='explorar') {
    map=createMap(state.config,[],showPlace);
    applyFilters();
  }
  if(state.page==='rutas') map=createMap(state.config,[],showPlace);
}
function applyFilters() {
  const {q,category,district,...flags}=state.filters;
  const filtered=state.places.filter(p=>
    (!q || normalize(p.name+' '+p.address+' '+p.district).includes(normalize(q))) &&
    (!category || category===p.category) && (!district || district===p.district) &&
    Object.keys(flags).every(flag=>!flags[flag]||p[flag])
  );
  document.querySelector('#result-count').textContent=filtered.length===1?'1 lugar encontrado':filtered.length+' lugares encontrados';
  document.querySelector('#results').innerHTML=filtered.length?filtered.map(p=>view.card(p,state.favorites.has(p.id))).join(''):view.empty('Sin coincidencias','Prueba con otro nombre o quita algún filtro.');
  map?.setPlaces(filtered);
}
async function loadAuthed() {
  if(!state.user) {
    state.favorites=new Set();
    state.reports=[];state.routes=[];state.users=[];state.stats=null;
    return;
  }
  const [{ids},{reports},{routes}]=await Promise.all([api('/favorites'),api('/reports'),api('/routes')]);
  state.favorites=new Set(ids);
  state.reports=reports;
  state.routes=routes;
  if(state.user.role==='admin') {
    const [{users},stats]=await Promise.all([api('/admin/users'),api('/admin/stats')]);
    state.users=users;
    state.stats=stats;
  }
}
function go(page) {
  if(location.hash==='#'+page){render();window.scrollTo({top:0});}
  else location.hash=page;
}
function openDialog(title,body) {
  content.innerHTML='<div class="dialog-top"><h2 id="dialog-title">'+esc(title)+'</h2><button class="icon-button" aria-label="Cerrar" data-action="close">'+icon('close')+'</button></div>'+body;
  dialog.setAttribute('aria-labelledby','dialog-title');
  if(!dialog.open) {
    lastFocus=document.activeElement;
    dialog.showModal();
  }
  (content.querySelector('form input, form select, form textarea')||content.querySelector('button')).focus();
}
dialog.addEventListener('close',()=>{
  detailId=null;
  afterLogin=null;
  if(lastFocus?.isConnected) lastFocus.focus();
});
function authDialog(register=false) {
  detailId=null;
  const title=register?'Crea tu cuenta':'Iniciar sesión';
  openDialog(title,'<div class="stack"><form class="stack" data-form="'+(register?'register':'login')+'">'+(register?view.field('Nombre','name',{autocomplete:'name',min:2,max:80}):'')+view.field('Correo','email',{type:'email',autocomplete:'email',max:160})+view.field('Contraseña','password',{type:'password',autocomplete:register?'new-password':'current-password',min:8,max:128})+view.submit(register?'Registrarme':'Entrar')+'</form>'+view.button(register?'Ya tengo una cuenta':'Crear una cuenta',register?'login':'register','outline')+'</div>');
}
function requireUser(continuation) {
  if(state.user) return true;
  afterLogin=continuation;
  authDialog();
  return false;
}
async function showPlace(id) {
  try {
    const {place,reviews}=await api('/places/'+id);
    map?.select(id);
    openDialog(place.name,view.placeDetail(place,reviews,state.favorites.has(id)));
    detailId=id;
  } catch(error){announce(error.message);}
}
async function favorite(id) {
  if(!requireUser(()=>favorite(id)))return;
  const saved=state.favorites.has(id);
  await api('/favorites/'+id,saved?'DELETE':'POST');
  if(saved)state.favorites.delete(id);else state.favorites.add(id);
  const wasOpen=dialog.open&&detailId===id;
  if(state.page==='explorar')applyFilters();else render();
  if(wasOpen)await showPlace(id);
  announce(saved?'Lugar quitado de favoritos.':'Lugar guardado en favoritos.');
}
function updateRoute(form=document.querySelector('#plan-form')) {
  if(!form)return state.route;
  const data=new FormData(form);
  state.route={origin:data.get('origin').trim(),destination:data.get('destination').trim(),travel_mode:data.get('travel_mode')};
  return state.route;
}
function clearPlan() {
  routeRun++;
  map?.clearRoute();
  const result=document.querySelector('#route-result');
  if(result)result.innerHTML='';
}
function placePoint(value) {
  const place=state.places.find(p=>normalize(value)===normalize(p.name));
  return place?{lat:place.lat,lng:place.lng}:coordinates(value);
}
function routeInput(value) {return placePoint(value)||value+', Huancayo, Junín, Perú';}
function externalRoute(route) {
  const external=value=>{const p=placePoint(value);return p?p.lat+','+p.lng:value+', Huancayo, Junín, Perú';};
  return view.externalMaps({...route,origin:external(route.origin),destination:external(route.destination)});
}
function metersLabel(meters) {
  if (!Number.isFinite(meters)) return 'Distancia sin datos';
  return meters<1000?meters+' m':new Intl.NumberFormat('es-PE',{maximumFractionDigits:2}).format(meters/1000)+' km';
}
async function calculateRoute(form) {
  const r=updateRoute(form);
  clearPlan();
  const result=document.querySelector('#route-result');
  if(normalize(r.origin)===normalize(r.destination)) {
    result.innerHTML=notice('Elige un destino diferente al origen.','warn');
    return;
  }
  const id=++routeRun;
  const active=()=>id===routeRun&&result.isConnected;
  result.innerHTML=notice('Calculando recorrido…')+externalRoute(r);
  let computed;
  try { computed=await map.compute({...r,origin:routeInput(r.origin),destination:routeInput(r.destination)},active); }
  catch { computed=null; }
  if(!active()) return;
  if(computed) {
    const duration=Number.isFinite(computed.minutes)?computed.minutes+' min aprox.':'Tiempo sin datos';
    result.innerHTML='<div class="plan-result"><strong>'+metersLabel(computed.meters)+' · '+duration+'</strong><p>'+modes[r.travel_mode]+' · Google Maps</p></div>'+externalRoute(r);
    return;
  }
  const a=placePoint(r.origin),b=placePoint(r.destination);
  const fallback=state.config.mapsKey?'No se pudo calcular el recorrido aquí. Puedes consultarlo en Google Maps.':'Abre Google Maps para ver el recorrido por calles.';
  const estimate=a&&b?'<div class="plan-result"><strong>'+metersLabel(geoDistance(a,b))+'</strong><p>Distancia aproximada en línea recta.</p></div>':'';
  if(a&&b)map.showEstimate([a,b]);
  result.innerHTML=estimate+notice(fallback)+externalRoute(r);
}
function routeTo(place) {
  state.route.destination=place.name;
  dialog.close();
  go('rutas');
}
function report(id) {
  if(!requireUser(()=>report(id)))return;
  detailId=null;
  openDialog('Reportar una barrera',view.reportForm(state,id));
}
function review(id) {
  if(!requireUser(()=>review(id)))return;
  detailId=null;
  openDialog('Escribe una reseña','<form data-form="review" data-id="'+id+'" class="stack">'+view.select('Valoración','rating',[5,4,3,2,1].map(n=>'<option value="'+n+'">'+n+' de 5</option>').join(''))+view.area('Tu experiencia', 'comment',1000)+view.submit('Publicar reseña')+'</form>');
}
function saveRoute() {
  const form=document.querySelector('#plan-form');
  if(!form?.reportValidity())return;
  const route={...updateRoute(form)};
  if(normalize(route.origin)===normalize(route.destination))return announce('El origen y el destino deben ser distintos.');
  if(!requireUser(saveRoute))return;
  openDialog('Guardar recorrido','<form class="stack" data-form="save-route">'+view.field('Nombre del recorrido','name',{min:2,max:120,value:route.destination.slice(0,120)})+view.submit('Guardar recorrido')+'</form>');
}
const preferencesKey='ruta-accesible-preferencias';
function readPreferences(){
  try{return JSON.parse(localStorage.getItem(preferencesKey)||'{}')||{};} catch{return {};}
}
function setPreferences(p){
  document.documentElement.dataset.text=p.large?'large':'normal';
  document.documentElement.dataset.contrast=p.contrast?'high':'normal';
}
function preferences(){
  const p=readPreferences();
  openDialog('Preferencias de lectura','<form class="stack" data-form="preferences">'+view.check('Texto más grande','large',p.large)+view.check('Contraste alto','contrast',p.contrast)+view.submit('Aplicar')+'</form>');
}
function confirmDialog(title,message,form,id) {
  openDialog(title,'<form class="stack" data-form="'+form+'" data-id="'+id+'"><p>'+esc(message)+'</p><div class="actions"><button class="button danger" type="submit">Eliminar</button>'+view.button('Cancelar','close','outline')+'</div></form>');
}

const actions={
  login:()=>authDialog(),register:()=>authDialog(true),close:()=>dialog.close(),preferences,
  place:id=>showPlace(Number(id)),favorite:id=>favorite(Number(id)),review:id=>review(Number(id)),report:id=>report(id?Number(id):undefined),
  'to-place':id=>{const p=state.places.find(place=>place.id===Number(id));if(p)routeTo(p);},
  'clear-filters':()=>{state.filters=initialFilters();render();document.querySelector('[name=q]').focus();},
  'jump-map':()=>document.querySelector('#map-panel')?.scrollIntoView({block:'start'}),
  recenter:()=>map?.reset(),swap:()=>{
    const form=document.querySelector('#plan-form');
    [form.elements.origin.value,form.elements.destination.value]=[form.elements.destination.value,form.elements.origin.value];
    updateRoute(form);clearPlan();
  },
  geolocate:()=>{
    if(!navigator.geolocation)return announce('Tu navegador no ofrece ubicación.');
    navigator.geolocation.getCurrentPosition(({coords})=>{
      const form=document.querySelector('#plan-form');
      if(!form)return;
      form.elements.origin.value=coords.latitude.toFixed(6)+', '+coords.longitude.toFixed(6);
      updateRoute(form);clearPlan();announce('Ubicación añadida al origen.');
    },()=>announce('No se pudo obtener tu ubicación. Escribe el origen para continuar.'),{timeout:10000});
  },
  'save-route':saveRoute,
  'load-route':id=>{const r=state.routes.find(item=>item.id===Number(id));if(!r)return;state.route={origin:r.origin,destination:r.destination,travel_mode:r.travel_mode};render();document.querySelector('#plan-form').requestSubmit();},
  'delete-route':id=>confirmDialog('Quitar recorrido','El recorrido se eliminará de tu lista.','route-delete',id),
  'edit-profile':()=>openDialog('Editar perfil','<form class="stack" data-form="profile">'+view.field('Nombre','name',{value:state.user.name,min:2,max:80})+view.submit('Guardar cambios')+'</form>'),
  logout:async()=>{await api('/auth/logout','POST');state.user=null;await loadAuthed();go('inicio');announce('Sesión cerrada.');},
  'admin-tab':tab=>{state.adminTab=tab;render();main.querySelector('[data-action=admin-tab][aria-pressed=true]')?.focus();},
  'edit-place':id=>{const p=state.places.find(place=>place.id===Number(id));openDialog(p?'Editar lugar':'Crear lugar',view.placeForm(state,p));},
  'delete-place':id=>confirmDialog('Eliminar lugar','Se quitará la ficha del directorio junto con sus reseñas y favoritos.','place-delete',id)
};
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]');
  if(!target || !Object.hasOwn(actions,target.dataset.action))return;
  event.preventDefault();
  if(target.tagName==='BUTTON')target.disabled=true;
  try{await actions[target.dataset.action](target.dataset.id);}catch(error){announce(error.message);}
  finally{target.disabled=false;}
});
main.addEventListener('input',event=>{
  const form=event.target.form;
  if(form?.id==='filters') {
    state.filters[event.target.name]=event.target.type==='checkbox'?event.target.checked:event.target.value;
    applyFilters();
  }
  if(form?.id==='plan-form'){updateRoute(form);clearPlan();}
});
async function updatePlaces(){state.places=(await api('/places')).places;}
const submitActions={
  async login(data) { const next=afterLogin;state.user=(await api('/auth/login','POST',data)).user;await loadAuthed();dialog.close();render();await next?.();announce('Sesión iniciada.'); },
  async register(data) { const next=afterLogin;state.user=(await api('/auth/register','POST',data)).user;await loadAuthed();dialog.close();render();await next?.();announce('Cuenta creada.'); },
  async profile(data) { state.user=(await api('/profile','PATCH',data)).user;dialog.close();render();announce('Perfil actualizado.'); },
  async preferences(data) {const p={large:data.large==='on',contrast:data.contrast==='on'};setPreferences(p);try{localStorage.setItem(preferencesKey,JSON.stringify(p));}catch{}dialog.close();announce('Preferencias aplicadas.');},
  async report(data) { await api('/reports','POST',{...data,place_id:Number(data.place_id)||null});await loadAuthed();dialog.close();go('comunidad');announce('Reporte enviado.'); },
  async review(data,id) { await api('/places/'+id+'/reviews','POST',{...data,rating:Number(data.rating)});await updatePlaces();render();await showPlace(Number(id));announce('Reseña publicada.'); },
  async 'save-route'(data) {await api('/routes','POST',{...state.route,name:data.name});await loadAuthed();dialog.close();render();announce('Recorrido guardado.');},
  async 'route-delete'(_,id) {await api('/routes/'+id,'DELETE');await loadAuthed();dialog.close();render();announce('Recorrido eliminado.');},
  async 'place-edit'(data,id) {
    const values={...data,lat:Number(data.lat),lng:Number(data.lng)};
    for(const key of [...Object.keys(features),'verified','is_demo'])values[key]=data[key]==='on';
    await api('/places'+(id?'/'+id:''),id?'PATCH':'POST',values);await updatePlaces();await loadAuthed();dialog.close();render();announce('Ficha guardada.');
  },
  async 'place-delete'(_,id) {await api('/places/'+id,'DELETE');await updatePlaces();await loadAuthed();dialog.close();render();announce('Ficha eliminada.');},
  async 'report-status'(data,id) {await api('/reports/'+id,'PATCH',data);await loadAuthed();render();announce('Estado actualizado.');},
  async 'user-role'(data,id) {await api('/admin/users/'+id,'PATCH',data);await loadAuthed();render();announce('Rol actualizado.');}
};
document.addEventListener('submit',async event=>{
  const form=event.target;
  if(form.id==='filters'){event.preventDefault();return;}
  if(form.id==='plan-form'){event.preventDefault();await calculateRoute(form);return;}
  const key=form.dataset.form;
  if(!Object.hasOwn(submitActions,key))return;
  event.preventDefault();
  const submit=form.querySelector('button[type=submit]');
  if(submit)submit.disabled=true;
  form.querySelector('.form-error')?.remove();
  try{await submitActions[key](Object.fromEntries(new FormData(form)),form.dataset.id);}
  catch(error){
    if(form.isConnected)form.insertAdjacentHTML('beforeend','<div class="form-error" role="alert">'+notice(error.message,'error')+'</div>');
    else announce(error.message);
  }finally{if(submit)submit.disabled=false;}
});
menu.addEventListener('click',()=>menu.setAttribute('aria-expanded',nav.classList.toggle('open')));
window.addEventListener('hashchange',()=>{
  if(!Object.hasOwn(pages,location.hash.slice(1))&&location.hash)return;
  nav.classList.remove('open');menu.setAttribute('aria-expanded','false');
  render();window.scrollTo({top:0});main.focus({preventScroll:true});
});
window.addEventListener('unhandledrejection',event=>announce(event.reason?.message||'Ocurrió un error.'));
setPreferences(readPreferences());
try {
  const [config,{places},{user}]=await Promise.all([api('/config'),api('/places'),api('/auth/me')]);
  Object.assign(state,{config,places,user});
  await loadAuthed();
  render();
} catch(error) {
  main.innerHTML=view.wrap(view.empty('No se pudo cargar Ruta Accesible',error.message,view.link('Volver a intentar','/')));
}

