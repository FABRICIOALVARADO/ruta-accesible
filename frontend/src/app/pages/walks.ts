import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorText } from '../core/api';
import { metersLabel } from '../core/format';
import { MobilityApi, type Walk } from '../core/mobility';

@Component({
  imports:[RouterLink],
  template:`
    <div class="container-xl page">
      <header class="page-title"><div class="kicker">RUTAS DE HUANCAYO</div><h1>Recorridos publicados</h1>
        <p>Consulta los tramos revisados y prueba el recorrido de demostración.</p></header>
      @if (error()) {<p class="alert alert-danger" role="alert">{{error()}}</p>}
      @else if (loading()) {<p role="status">Cargando recorridos…</p>}
      @else {
        @if (!verified()) {<p class="surface p-3">Aún no hay recorridos verificados de principio a fin. Puedes probar la comparación con la red de demostración.</p>}
        <div class="row g-3">
        @for (walk of walks();track walk.id) {
          <article class="col-md-6"><div class="surface p-4 h-100">
            <div class="tag-list mb-2"><span class="tag" [class.tag-green]="walk.state==='verified'" [class.tag-warn]="walk.state!=='verified'">{{labels[walk.state]}}</span>
              @if(walk.route){<span class="tag">{{meters(walk.route.meters)}} · {{walk.route.segments.length}} tramos</span>}</div>
            <h2 class="h4">{{walk.name}}</h2><p>{{walk.description}}</p>
            <p class="muted small">{{walk.origin.name}} → {{walk.destination.name}}</p>
            @if(walk.route) {
              <a class="btn btn-brand" routerLink="/mapa" [queryParams]="{origen:walk.origin.lat+','+walk.origin.lng,destino:walk.destination.lat+','+walk.destination.lng,verificada:walk.state==='verified'?1:null,demo:walk.state==='demo'?1:null}">Abrir recorrido en el mapa</a>
            } @else {<p class="small muted mb-0">No hay un paso que cumpla la revisión en este momento.</p>}
          </div></article>
        }
        </div>
      }
    </div>
  `,
})
export class WalksPage {
  readonly walks=signal<Walk[]>([]);
  readonly loading=signal(true);
  readonly error=signal('');
  readonly verified=computed(()=>this.walks().some(walk=>walk.state==='verified'));
  readonly labels={verified:'Verificado en campo',demo:'Demostración',unavailable:'Sin paso verificado'};
  readonly meters=metersLabel;

  constructor() {
    inject(MobilityApi).walks().then(result=>this.walks.set(result))
      .catch(error=>this.error.set(errorText(error))).finally(()=>this.loading.set(false));
  }
}
