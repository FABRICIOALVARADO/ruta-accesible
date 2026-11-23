import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { Api, errorText } from '../core/api';
import { distance } from '../core/format';
import type { Config, Place, Point } from '../core/models';
import { PlaceCard } from '../shared/place-card';
import { MapCard } from '../shared/map-card';

@Component({imports:[ReactiveFormsModule,PlaceCard,MapCard],templateUrl:'./explore.html'})
export class Explore {
  private api=inject(Api);
  private destroy=inject(DestroyRef);
  readonly filters=inject(FormBuilder).nonNullable.group({q:'',category:'',district:'',verified:false});
  readonly tags=signal<ReadonlySet<string>>(new Set());
  readonly config=signal<Config | null>(null);
  readonly source=signal<Place[]>([]);
  readonly loading=signal(false);
  readonly error=signal('');
  readonly position=signal<Point | null>(null);
  readonly places=computed(() => {
    const position = this.position();
    return position ? [...this.source()].sort((a,b) => distance(a,position)-distance(b,position)) : this.source();
  });
  private revision=0;

  constructor() {
    this.filters.valueChanges.pipe(debounceTime(200),takeUntilDestroyed(this.destroy)).subscribe(() => this.search());
    this.api.config().then(config=>this.config.set(config)).catch(error=>this.error.set(errorText(error)));
    void this.search();
  }

  async search() {
    const revision=++this.revision;
    this.loading.set(true);
    this.error.set('');
    try {
      const places=await this.api.places({...this.filters.getRawValue(),facility:[...this.tags()]});
      if (revision===this.revision) this.source.set(places);
    } catch (error) { if (revision===this.revision) this.error.set(errorText(error)); }
    finally { if (revision===this.revision) this.loading.set(false); }
  }

  toggle(id: string) {
    const tags=new Set(this.tags());
    if (tags.has(id)) tags.delete(id); else tags.add(id);
    this.tags.set(tags);
    void this.search();
  }

  reset() { this.tags.set(new Set()); this.position.set(null); this.filters.reset(); }

  near() {
    if (!navigator.geolocation) { this.error.set('El navegador no permite acceder a tu ubicación.'); return; }
    navigator.geolocation.getCurrentPosition(
      ({coords}) => { this.position.set({lat:coords.latitude,lng:coords.longitude}); this.error.set(''); },
      () => this.error.set('No pudimos acceder a tu ubicación. Puedes buscar por distrito.'), {timeout:10000},
    );
  }
}
