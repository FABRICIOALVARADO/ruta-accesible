import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Api, errorText } from '../core/api';
import { dateLabel, facilities, mapsLink } from '../core/format';
import { MobilityApi, crossingLabels, toiletLabels, type Inspection } from '../core/mobility';
import type { Detail, Place } from '../core/models';
import { Notice, Session } from '../core/session';

@Component({imports:[ReactiveFormsModule,RouterLink],templateUrl:'./detail.html'})
export class PlaceDetail {
  private api=inject(Api);
  private mobility=inject(MobilityApi);
  private router=inject(ActivatedRoute);
  private notice=inject(Notice);
  readonly session=inject(Session);
  readonly info=signal<Detail | null>(null);
  readonly entrance=signal<Inspection|null>(null);
  readonly crossings=crossingLabels;
  readonly toilets=toiletLabels;
  readonly pictureFailed=signal(false);
  readonly pending=signal(true);
  readonly busy=signal(false);
  readonly error=signal('');
  readonly keys=Object.entries(facilities);
  readonly date=dateLabel;
  readonly form=inject(FormBuilder).nonNullable.group({
    rating:5,comment:['',[Validators.required, Validators.minLength(5), Validators.maxLength(1000)]],
  });
  private revision=0;

  constructor() {
    this.router.paramMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(params => {
      this.info.set(null);
      this.entrance.set(null);
      this.pictureFailed.set(false);
      this.pending.set(true);
      this.error.set('');
      const id=Number(params.get('id'));
      if (!Number.isSafeInteger(id) || id<=0) { ++this.revision; this.error.set('El lugar no está disponible.'); this.pending.set(false); }
      else void this.load(id);
    });
  }

  private async load(id: number) {
    const revision=++this.revision;
    try {
      const [result,entrance]=await Promise.all([this.api.detail(id),this.mobility.entrance(id).catch(()=>null)]);
      if (revision!==this.revision) return;
      this.info.set(result);
      this.entrance.set(entrance);
      const mine=result.reviews.find(item=>item.mine);
      this.form.reset({rating:mine?.rating ?? 5,comment:mine?.comment ?? ''});
    } catch (error) { if (revision===this.revision) this.error.set(errorText(error)); }
    finally { if (revision===this.revision) this.pending.set(false); }
  }

  google(place: Place) { return mapsLink('', place.lat+','+place.lng); }

  favorite(id: number) { return this.perform(()=>this.session.toggleFavorite(id)); }

  save(id: number) {
    const {rating,comment}=this.form.getRawValue();
    if (comment.trim().length < 5) { this.error.set('Escribe al menos cinco caracteres.'); return; }
    return this.perform(async () => { await this.api.review(id,rating,comment); await this.load(id); this.notice.show('Reseña guardada.'); });
  }

  remove(id: number) {
    return this.perform(async () => { await this.api.removeReview(id); await this.load(id); this.notice.show('Reseña retirada.'); });
  }

  private async perform(action: () => Promise<void>) {
    this.busy.set(true);
    this.error.set('');
    try { await action(); } catch (error) { this.error.set(errorText(error)); }
    finally { this.busy.set(false); }
  }
}
