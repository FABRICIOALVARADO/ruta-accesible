import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, errorText } from '../core/api';
import type { Place } from '../core/models';
import { PlaceCard } from '../shared/place-card';

@Component({imports:[RouterLink,PlaceCard],templateUrl:'./home.html'})
export class Home {
  readonly places = signal<Place[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly photoError = signal(false);
  readonly shortcuts = [
    {icon:'⌖', title:'Explora el directorio', text:'Filtra por distrito y facilidades.', path:'/explorar'},
    {icon:'↝', title:'Compara recorridos', text:'Consulta las barreras de cada tramo.', path:'/mapa'},
    {icon:'⚑', title:'Reporta una barrera', text:'Indica un problema de acceso.', path:'/comunidad'},
  ];

  constructor() {
    inject(Api).places().then(data => this.places.set(data.slice(0,3)))
      .catch(error => this.error.set(errorText(error))).finally(() => this.loading.set(false));
  }
}
