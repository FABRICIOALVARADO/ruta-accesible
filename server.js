import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { openDatabase } from './db/database.js';
import { hashPassword, verifyPassword, tokenHash, publicUser } from './lib/security.js';

const root=fileURLToPath(new URL('./public/',import.meta.url));
const categories=['Cultura','Parques','Salud','Comercio','Gastronomía','Servicios'];
const modes=['WALKING','DRIVING','BICYCLING','TRANSIT'];
class ApiError extends Error { constructor(status,message){super(message);this.status=status;} }
function text(value,min=1,max=1000){if(typeof value!=='string'||value.trim().length<min||value.trim().length>max) throw new ApiError(400,`Completa los campos con entre ${min} y ${max} caracteres.`);return value.trim();}
function choice(value,list){if(!list.includes(value))throw new ApiError(400,'Selecciona una opción válida.');return value;}
function number(value,min,max){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new ApiError(400,'Número fuera del rango permitido.');return value;}
async function body(req){let data='';for await(const part of req){data+=part;if(Buffer.byteLength(data)>20_000)throw new ApiError(413,'Solicitud demasiado grande.');}try{return JSON.parse(data||'{}');}catch{throw new ApiError(400,'JSON inválido.');}}
const placeSelect=`SELECT p.*, COALESCE((SELECT ROUND(AVG(rating),1) FROM reviews WHERE place_id=p.id),0) AS rating, (SELECT COUNT(*) FROM reviews WHERE place_id=p.id) AS review_count FROM places p`;

export function createApp({db=openDatabase(),mapsKey=process.env.GOOGLE_MAPS_API_KEY||''}={}) {
 const attempts=new Map();
 function rateLimit(req){const key=req.socket.remoteAddress;const now=Date.now();for(const [ip,value] of attempts)if(now>value.until)attempts.delete(ip);const slot=attempts.get(key)||{n:0,until:now+15*60_000};slot.n++;attempts.set(key,slot);if(slot.n>30)throw new ApiError(429,'Demasiados intentos. Vuelve a intentarlo en 15 minutos.');}
 function userFor(req){const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('sid='))?.slice(4);if(!token)return null;return db.prepare('SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?').get(tokenHash(token),Date.now())||null;}
 function auth(req,admin=false){const user=userFor(req);if(!user)throw new ApiError(401,'Inicia sesión para continuar.');if(admin&&user.role!=='admin')throw new ApiError(403,'Solo el administrador puede realizar esta acción.');return user;}
 function login(res,user){const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(tokenHash(token),user.id,Date.now()+7*86400_000);res.setHeader('Set-Cookie',`sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.NODE_ENV==='production'?'; Secure':''}`);}
 function placeExists(id){if(!db.prepare('SELECT id FROM places WHERE id=?').get(id))throw new ApiError(404,'Lugar no encontrado.');}
 function placeData(b){return [text(b.name,2,120),choice(b.category,categories),choice(b.district,['Huancayo','El Tambo','Chilca']),text(b.address,3,200),text(b.description,10,1500),number(b.lat,-90,90),number(b.lng,-180,180),choice(b.image||'plaza',['plaza','park','hill','shop','health','culture','cafe']),...['ramp','bathroom','tactile','parking','verified','is_demo'].map(k=>b[k]===true||b[k]===1?1:0)];}
 const server=http.createServer(async(req,res)=>{
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
  try {
   const url=new URL(req.url,'http://localhost'); const path=url.pathname;const method=req.method;
   if(path.startsWith('/api/')){
    if(!['GET','HEAD'].includes(method)&&req.headers.origin&&req.headers.origin!==(process.env.APP_ORIGIN||`${process.env.NODE_ENV==='production'?'https':'http'}://${req.headers.host}`))throw new ApiError(403,'Origen de solicitud no permitido.');
    if(path==='/api/health'&&method==='GET')return json(200,{ok:true,database:'SQLite'});
    if(path==='/api/config'&&method==='GET')return json(200,{mapsKey,mapId:process.env.GOOGLE_MAPS_MAP_ID||'DEMO_MAP_ID',categories,hasAdmin:!!db.prepare("SELECT id FROM users WHERE role='admin'").get()});
    if(path==='/api/auth/me'&&method==='GET')return json(200,{user:publicUser(userFor(req))});
    if(['/api/auth/register','/api/auth/login'].includes(path)&&method==='POST'){
     rateLimit(req);const b=await body(req),email=text(b.email,5,160).toLowerCase(),password=text(b.password,8,128);
     if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new ApiError(400,'Escribe un correo válido.');
     let user;
     if(path.endsWith('register')){const name=text(b.name,2,80);if(db.prepare('SELECT id FROM users WHERE email=?').get(email))throw new ApiError(409,'Este correo ya está registrado.');const result=db.prepare('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)').run(name,email,hashPassword(password));user=db.prepare('SELECT * FROM users WHERE id=?').get(result.lastInsertRowid);}
     else {user=db.prepare('SELECT * FROM users WHERE email=?').get(email);if(!user||!verifyPassword(password,user.password_hash))throw new ApiError(401,'Correo o contraseña incorrectos.');}
     login(res,user);return json(200,{user:publicUser(user)});
    }
    if(path==='/api/auth/logout'&&method==='POST'){const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('sid='))?.slice(4);if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(token));res.setHeader('Set-Cookie','sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return json(200,{ok:true});}
    if(path==='/api/profile'&&method==='PATCH'){const user=auth(req),b=await body(req);db.prepare('UPDATE users SET name=? WHERE id=?').run(text(b.name,2,80),user.id);return json(200,{user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(user.id))});}
    if(path==='/api/places'&&method==='GET'){let places=db.prepare(placeSelect+' ORDER BY p.id').all();const q=(url.searchParams.get('q')||'').toLocaleLowerCase('es');if(q)places=places.filter(p=>`${p.name} ${p.address} ${p.district}`.toLocaleLowerCase('es').includes(q));for(const key of ['category','district'])if(url.searchParams.get(key))places=places.filter(p=>p[key]===url.searchParams.get(key));for(const key of ['ramp','bathroom','tactile','parking','verified'])if(url.searchParams.get(key)==='1')places=places.filter(p=>p[key]);return json(200,{places});}
    const placeMatch=path.match(/^\/api\/places\/(\d+)$/);
    if(placeMatch&&method==='GET'){const place=db.prepare(placeSelect+' WHERE p.id=?').get(Number(placeMatch[1]));if(!place)throw new ApiError(404,'Lugar no encontrado.');const reviews=db.prepare('SELECT r.id,r.rating,r.comment,r.created_at,u.name FROM reviews r JOIN users u ON r.user_id=u.id WHERE r.place_id=? ORDER BY r.id DESC').all(place.id);return json(200,{place,reviews});}
    if(path==='/api/places'&&method==='POST'){auth(req,true);const values=placeData(await body(req));const result=db.prepare('INSERT INTO places(name,category,district,address,description,lat,lng,image,ramp,bathroom,tactile,parking,verified,is_demo) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...values);return json(201,{id:Number(result.lastInsertRowid)});}
    if(placeMatch&&['PATCH','DELETE'].includes(method)){auth(req,true);const id=Number(placeMatch[1]);placeExists(id);if(method==='DELETE')db.prepare('DELETE FROM places WHERE id=?').run(id);else db.prepare('UPDATE places SET name=?,category=?,district=?,address=?,description=?,lat=?,lng=?,image=?,ramp=?,bathroom=?,tactile=?,parking=?,verified=?,is_demo=? WHERE id=?').run(...placeData(await body(req)),id);return json(200,{ok:true});}
    if(path==='/api/favorites'&&method==='GET'){const user=auth(req);return json(200,{ids:db.prepare('SELECT place_id FROM favorites WHERE user_id=?').all(user.id).map(x=>x.place_id)});}
    const favoriteMatch=path.match(/^\/api\/favorites\/(\d+)$/);
    if(favoriteMatch&&['POST','DELETE'].includes(method)){const user=auth(req),id=Number(favoriteMatch[1]);placeExists(id);if(method==='POST')db.prepare('INSERT OR IGNORE INTO favorites VALUES(?,?)').run(user.id,id);else db.prepare('DELETE FROM favorites WHERE user_id=? AND place_id=?').run(user.id,id);return json(200,{ok:true});}
    const reviewMatch=path.match(/^\/api\/places\/(\d+)\/reviews$/);
    if(reviewMatch&&method==='POST'){const user=auth(req),id=Number(reviewMatch[1]),b=await body(req);placeExists(id);const rating=number(b.rating,1,5);if(!Number.isInteger(rating))throw new ApiError(400,'La valoración debe ser entera.');db.prepare("INSERT INTO reviews(user_id,place_id,rating,comment) VALUES(?,?,?,?) ON CONFLICT(user_id,place_id) DO UPDATE SET rating=excluded.rating,comment=excluded.comment,created_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')").run(user.id,id,rating,text(b.comment,5,1000));return json(201,{ok:true});}
    if(path==='/api/reports'&&method==='GET'){const user=auth(req);return json(200,{reports:db.prepare(`SELECT r.*,p.name AS place_name,u.name AS author FROM reports r LEFT JOIN places p ON r.place_id=p.id JOIN users u ON r.user_id=u.id ${user.role==='admin'?'':'WHERE r.user_id=?'} ORDER BY r.id DESC`).all(...(user.role==='admin'?[]:[user.id]))});}
    if(path==='/api/reports'&&method==='POST'){const user=auth(req),b=await body(req);const placeId=b.place_id?number(b.place_id,1,1e9):null;if(placeId)placeExists(placeId);const result=db.prepare('INSERT INTO reports(user_id,place_id,title,description,type) VALUES(?,?,?,?,?)').run(user.id,placeId,text(b.title,5,120),text(b.description,10,1500),choice(b.type,['Rampa bloqueada','Vereda dañada','Sin acceso','Información incorrecta','Otro']));return json(201,{id:Number(result.lastInsertRowid)});}
    const reportMatch=path.match(/^\/api\/reports\/(\d+)$/);
    if(reportMatch&&method==='PATCH'){auth(req,true);const b=await body(req);const result=db.prepare('UPDATE reports SET status=? WHERE id=?').run(choice(b.status,['Pendiente','En revisión','Resuelto']),Number(reportMatch[1]));if(!result.changes)throw new ApiError(404,'Reporte no encontrado.');return json(200,{ok:true});}
    if(path==='/api/routes'&&method==='GET'){const user=auth(req);return json(200,{routes:db.prepare('SELECT * FROM saved_routes WHERE user_id=? ORDER BY id DESC').all(user.id)});}
    if(path==='/api/routes'&&method==='POST'){const user=auth(req),b=await body(req);const result=db.prepare('INSERT INTO saved_routes(user_id,name,origin,destination,travel_mode) VALUES(?,?,?,?,?)').run(user.id,text(b.name,2,120),text(b.origin,3,200),text(b.destination,3,200),choice(b.travel_mode,modes));return json(201,{id:Number(result.lastInsertRowid)});}
    const routeMatch=path.match(/^\/api\/routes\/(\d+)$/);
    if(routeMatch&&method==='DELETE'){const user=auth(req);const r=db.prepare('DELETE FROM saved_routes WHERE id=? AND user_id=?').run(Number(routeMatch[1]),user.id);if(!r.changes)throw new ApiError(404,'Recorrido no encontrado.');return json(200,{ok:true});}
    if(path==='/api/admin/stats'&&method==='GET'){auth(req,true);const count=table=>db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;return json(200,{places:count('places'),users:count('users'),reports:count('reports'),reviews:count('reviews'),routes:count('saved_routes'),statuses:db.prepare('SELECT status,COUNT(*) AS total FROM reports GROUP BY status').all()});}
    if(path==='/api/admin/users'&&method==='GET'){auth(req,true);return json(200,{users:db.prepare('SELECT id,name,email,role,created_at FROM users ORDER BY id DESC').all()});}
    const userMatch=path.match(/^\/api\/admin\/users\/(\d+)$/);
    if(userMatch&&method==='PATCH'){const current=auth(req,true),id=Number(userMatch[1]),b=await body(req);if(current.id===id)throw new ApiError(400,'No puedes cambiar tu propio rol.');const r=db.prepare('UPDATE users SET role=? WHERE id=?').run(choice(b.role,['admin','member']),id);if(!r.changes)throw new ApiError(404,'Usuario no encontrado.');return json(200,{ok:true});}
    if(path==='/api/admin/export'&&method==='GET'){auth(req,true);const rows=db.prepare(placeSelect).all();const columns=['id','name','category','district','address','lat','lng','ramp','bathroom','tactile','parking','verified','is_demo'];const cell=v=>'"'+String(/^[=+\-@]/.test(String(v))?"'"+v:v).replaceAll('"','""')+'"';const csv=[columns.join(','),...rows.map(row=>columns.map(c=>cell(row[c])).join(','))].join('\r\n');res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="lugares-ruta-accesible.csv"','Cache-Control':'no-store'});return res.end('\uFEFF'+csv);}
    throw new ApiError(404,'Recurso no encontrado.');
   }
   if(!['GET','HEAD'].includes(method))throw new ApiError(405,'Método no permitido.');
   const file=resolve(root,'.'+decodeURIComponent(path==='/'?'/index.html':path));if(!file.startsWith(root.endsWith(sep)?root:root+sep))throw new ApiError(403,'Acceso no permitido.');
   const info=await stat(file).catch(()=>null);if(!info?.isFile())throw new ApiError(404,'Archivo no encontrado.');
   const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'}[extname(file)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':mime+'; charset=utf-8','Cache-Control':'no-cache'});res.end(method==='HEAD'?undefined:await readFile(file));
  } catch(error) { if(!error.status)console.error(error);json(error.status||500,{error:error.status?error.message:'Ocurrió un error. Inténtalo nuevamente.'}); }
 });
 return {server,db};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {server}=createApp();const port=Number(process.env.PORT)||3000,host=process.env.HOST||'127.0.0.1';
 server.listen(port,host,()=>console.log(`Proyecto Final · Ruta Accesible → http://${host}:${port}`));
}
