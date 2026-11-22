import { openDatabase } from '../db/database.js';
const db=openDatabase();
console.log(`SQLite listo: ${db.prepare('SELECT COUNT(*) AS n FROM places').get().n} lugares de demostración.`);
db.close();
