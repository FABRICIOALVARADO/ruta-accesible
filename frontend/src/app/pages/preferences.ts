import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorText } from '../core/api';
import { MobilityApi, defaultProfile, type Profile } from '../core/mobility';
import { Notice, Session } from '../core/session';
import { ProfileFields } from '../shared/profile-fields';

@Component({
  imports:[RouterLink,ProfileFields],
  template:`
    <div class="container-xl page">
      <header class="page-title"><div class="kicker">MI CUENTA</div><h1>Preferencias de movilidad</h1>
        <p>El planificador aplica estos criterios al buscar alternativas.</p></header>
      @if(error()){<p class="alert alert-danger" role="alert">{{error()}}</p>}
      <section class="surface p-4 auth-card">
        @if(loading()){<p role="status" class="muted mb-0">Cargando preferencias…</p>}
        @else if(session.user()){
          <ra-profile-fields [value]="profile()" (update)="profile.set($event)" />
          <div class="d-flex gap-2 flex-wrap mt-4">
            <button type="button" class="btn btn-brand" [disabled]="busy()" (click)="save()">Guardar preferencias</button>
            <a class="btn btn-soft" routerLink="/mapa">Ir al mapa</a>
          </div>
        } @else {<p>Inicia sesión para guardar tus ajustes.</p>
          <a class="btn btn-brand" routerLink="/cuenta" [queryParams]="{volver:'/preferencias'}">Iniciar sesión</a>}
      </section>
    </div>
  `,
})
export class PreferencesPage {
  readonly session=inject(Session);
  private api=inject(MobilityApi);
  private notice=inject(Notice);
  readonly profile=signal<Profile>({...defaultProfile});
  readonly loading=signal(true);
  readonly busy=signal(false);
  readonly error=signal('');

  constructor() {
    this.session.ready().then(async()=>{ if(this.session.user()) this.profile.set(await this.api.profile()); })
      .catch(error=>this.error.set(errorText(error))).finally(()=>this.loading.set(false));
  }

  async save() {
    this.busy.set(true);
    this.error.set('');
    try {this.profile.set(await this.api.saveProfile(this.profile()));this.notice.show('Preferencias guardadas.');}
    catch(error){this.error.set(errorText(error));}
    finally{this.busy.set(false);}
  }
}
