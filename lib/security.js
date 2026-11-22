import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
export function hashPassword(password) {
 const salt=randomBytes(16).toString('hex');
 return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;
}
export function verifyPassword(password,encoded) {
 const [salt,hash]=encoded.split(':');
 const actual=scryptSync(password,salt,64), expected=Buffer.from(hash,'hex');
 return expected.length===actual.length && timingSafeEqual(actual,expected);
}
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export const publicUser = user => user ? {id:user.id,name:user.name,email:user.email,role:user.role} : null;
