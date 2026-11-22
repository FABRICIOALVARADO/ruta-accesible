import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { seedPlaces } from './seed.js';
import { hashPassword } from '../lib/security.js';
export function openDatabase(path=process.env.DATABASE_PATH || './data/ruta-accesible.db') {
 if(path!==':memory:') mkdirSync(dirname(resolve(path)),{recursive:true});
 const db=new DatabaseSync(path);
 db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
 if(!db.prepare('SELECT COUNT(*) AS n FROM places').get().n) {
  const insert=db.prepare('INSERT INTO places(name,category,district,address,description,lat,lng,image,ramp,bathroom,tactile,parking) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
  db.exec('BEGIN');
  try { for(const place of seedPlaces) insert.run(...place); db.exec('COMMIT'); } catch(e) {db.exec('ROLLBACK');throw e;}
 }
 if(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  if(process.env.ADMIN_PASSWORD.length<12) throw new Error('ADMIN_PASSWORD requiere al menos 12 caracteres.');
  const email=process.env.ADMIN_EMAIL.toLowerCase().trim();
  if(!db.prepare('SELECT id FROM users WHERE email=?').get(email)) db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'admin')").run('Administrador',email,hashPassword(process.env.ADMIN_PASSWORD));
 }
 return db;
}
