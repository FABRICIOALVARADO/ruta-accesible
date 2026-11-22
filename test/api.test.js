import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';
import { openDatabase } from '../db/database.js';
import { hashPassword } from '../lib/security.js';
import { Readable } from 'node:stream';
test('Flujo SQLite: cuentas, autorización, favoritos, reseñas, reportes, rutas y CRUD',async t=>{
 const db=openDatabase(':memory:');db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'admin')").run('Admin','admin@example.test',hashPassword('TestingAdmin123!'));
 const {server}=createApp({db});
 t.after(()=>{server.close();db.close();});
 // Exercise the real HTTP handler without requiring loopback sockets in restricted environments.
 async function request(path,method='GET',data,cookie,origin){return new Promise(resolve=>{const req=Readable.from(data?[JSON.stringify(data)]:[]);Object.assign(req,{url:path,method,headers:{host:'localhost',...(cookie?{cookie}:{}),...(origin?{origin}:{})},socket:{remoteAddress:'test-client'}});const headers={};const res={status:200,setHeader(k,v){headers[k.toLowerCase()]=v;},writeHead(s,h){this.status=s;for(const [k,v]of Object.entries(h))this.setHeader(k,v);},end(raw){resolve({status:this.status,data:JSON.parse(raw),cookie:headers['set-cookie']?.split(';')[0]});}};server.emit('request',req,res);});}
 assert.equal((await request('/api/health')).data.database,'SQLite');assert.equal((await request('/api/favorites')).status,401);
 assert.equal((await request('/api/auth/register','POST',[])).status,400);
 const registration=await request('/api/auth/register','POST',{name:'Fabri',email:'fabri@example.test',password:'Password123!'});assert.equal(registration.status,200);const member=registration.cookie;assert.equal(registration.data.user.role,'member');assert.equal(registration.data.user.password_hash,undefined);
 assert.equal((await request('/api/auth/register','POST',{name:'Otro',email:'fabri@example.test',password:'Password123!'})).status,409);
 assert.equal((await request('/api/auth/login','POST',{email:'fabri@example.test',password:'incorrecta'})).status,401);
 assert.equal((await request('/api/auth/me','GET',null,member)).data.user.name,'Fabri');
 assert.equal((await request('/api/places','POST',{},member)).status,403);
 const places=(await request('/api/places')).data.places;assert.equal(places.length,9);assert.ok(places.every(p=>p.is_demo===1&&p.verified===0));
 assert.ok((await request('/api/places?category=Parques&ramp=1')).data.places.every(p=>p.category==='Parques'&&p.ramp));
 await request('/api/favorites/1','POST',{},member);await request('/api/favorites/1','POST',{},member);assert.deepEqual((await request('/api/favorites','GET',null,member)).data.ids,[1]);
 assert.equal((await request('/api/favorites/99999','POST',{},member)).status,404);
 assert.equal((await request('/api/places/1/reviews','POST',{rating:6,comment:'Muy bueno'},member)).status,400);
 await request('/api/places/1/reviews','POST',{rating:4,comment:'Opinión de prueba.'},member);await request('/api/places/1/reviews','POST',{rating:5,comment:'Opinión actualizada.'},member);const detail=(await request('/api/places/1')).data;assert.equal(detail.reviews.length,1);assert.equal(detail.place.rating,5);
 const report=await request('/api/reports','POST',{place_id:1,title:'Acceso bloqueado',description:'Descripción para comprobar el flujo.',type:'Rampa bloqueada'},member);assert.equal(report.status,201);
 assert.equal((await request(`/api/reports/${report.data.id}`,'PATCH',{status:'Resuelto'},member)).status,403);
 const route=await request('/api/routes','POST',{name:'Visita al centro',origin:'Plaza Constitución',destination:'Huamanmarca',travel_mode:'WALKING'},member);assert.equal(route.status,201);
 const other=await request('/api/auth/register','POST',{name:'Otra persona',email:'other@example.test',password:'Password123!'});assert.equal((await request(`/api/routes/${route.data.id}`,'DELETE',null,other.cookie)).status,404);assert.equal((await request('/api/reports','GET',null,other.cookie)).data.reports.length,0);
 assert.equal((await request('/api/profile','PATCH',{name:'Nuevo'},member,'https://malicious.example')).status,403);
 const admin=(await request('/api/auth/login','POST',{email:'admin@example.test',password:'TestingAdmin123!'})).cookie;
 assert.equal((await request(`/api/reports/${report.data.id}`,'PATCH',{status:'Resuelto'},admin)).status,200);
 assert.equal((await request('/api/reports','GET',null,member)).data.reports[0].status,'Resuelto');
 const place={name:'Lugar de prueba',category:'Servicios',district:'Huancayo',address:'Calle prueba 123',description:'Un lugar de prueba para validar el CRUD.',lat:-12.07,lng:-75.21,image:'plaza',ramp:true,is_demo:true};const added=await request('/api/places','POST',place,admin);assert.equal(added.status,201);assert.equal((await request(`/api/places/${added.data.id}`,'PATCH',{...place,name:'Lugar actualizado'},admin)).status,200);assert.equal((await request(`/api/places/${added.data.id}`)).data.place.name,'Lugar actualizado');assert.equal((await request(`/api/places/${added.data.id}`,'DELETE',null,admin)).status,200);assert.equal((await request(`/api/places/${added.data.id}`)).status,404);
 const stats=(await request('/api/admin/stats','GET',null,admin)).data;assert.equal(stats.users,3);assert.equal(stats.reviews,1);
 await request(`/api/routes/${route.data.id}`,'DELETE',null,member);assert.equal((await request('/api/routes','GET',null,member)).data.routes.length,0);
 await request('/api/favorites/1','DELETE',null,member);assert.equal((await request('/api/favorites','GET',null,member)).data.ids.length,0);
 await request('/api/auth/logout','POST',{},member);assert.equal((await request('/api/favorites','GET',null,member)).status,401);
});
