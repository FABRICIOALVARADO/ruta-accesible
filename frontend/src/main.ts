import { provideHttpClient } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { App } from './app/app';

bootstrapApplication(App, {providers: [
  provideHttpClient(),
  provideRouter([
    {path:'', pathMatch:'full', title:'Ruta Accesible · Huancayo', loadComponent:() => import('./app/pages/home').then(m=>m.Home)},
    {path:'explorar', title:'Explorar · Ruta Accesible', loadComponent:() => import('./app/pages/explore').then(m=>m.Explore)},
    {path:'lugares/:id', title:'Ficha del lugar', loadComponent:() => import('./app/pages/detail').then(m=>m.PlaceDetail)},
    {path:'rutas', title:'Planificar · Ruta Accesible', loadComponent:() => import('./app/pages/planner').then(m=>m.Planner)},
    {path:'comunidad', title:'Comunidad · Ruta Accesible', loadComponent:() => import('./app/pages/community').then(m=>m.Community)},
    {path:'cuenta', title:'Mi cuenta · Ruta Accesible', loadComponent:() => import('./app/pages/account').then(m=>m.Account)},
    {path:'administrar', title:'Panel de gestión', loadComponent:() => import('./app/pages/admin').then(m=>m.AdminPage)},
    {path:'**', redirectTo:''},
  ], withInMemoryScrolling({scrollPositionRestoration: 'enabled'})),
]}).catch(error => console.error('No se pudo iniciar Ruta Accesible.',error));
