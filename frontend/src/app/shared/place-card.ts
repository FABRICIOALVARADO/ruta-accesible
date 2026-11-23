import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorText } from '../core/api';
import { facilities } from '../core/format';
import type { Place } from '../core/models';
import { Notice, Session } from '../core/session';

const photos: Record<string, {url:string; credit:string; source:string}> = {
  'Plaza Constitución': {
    url:'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/98/Plaza_Constituci%C3%B3n_-_Huancayo.jpg/960px-Plaza_Constituci%C3%B3n_-_Huancayo.jpg',
    credit:'Fioretcl', source:'https://commons.wikimedia.org/wiki/File:Plaza_Constituci%C3%B3n_-_Huancayo.jpg',
  },
  'Parque de la Identidad Wanka': {
    url:'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ee/Parque_de_la_Identidad_Wanka%2C_Huancayo%2C_Per%C3%BA_01.jpg/960px-Parque_de_la_Identidad_Wanka%2C_Huancayo%2C_Per%C3%BA_01.jpg',
    credit:'Ibrehaut', source:'https://commons.wikimedia.org/wiki/File:Parque_de_la_Identidad_Wanka,_Huancayo,_Per%C3%BA_01.jpg',
  },
};

@Component({
  selector:'ra-place-card',
  imports:[RouterLink],
  templateUrl:'./place-card.html',
})
export class PlaceCard {
  readonly place = input.required<Place>();
  private session = inject(Session);
  private notice = inject(Notice);
  readonly names = facilities;
  readonly busy = signal(false);
  readonly photoFailed = signal(false);
  readonly photo = computed(() => photos[this.place().name]);
  readonly saved = computed(() => this.session.favorites().has(this.place().id));

  async toggle() {
    this.busy.set(true);
    try { await this.session.toggleFavorite(this.place().id); }
    catch (error) { this.notice.show(errorText(error)); }
    finally { this.busy.set(false); }
  }
}
