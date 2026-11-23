import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Profile } from '../core/mobility';

@Component({
  selector:'ra-profile-fields',
  imports:[FormsModule],
  template:`
    <fieldset class="vstack gap-2">
      <legend class="visually-hidden">Preferencias de movilidad</legend>
      <label class="mobility-check"><input class="form-check-input" type="checkbox" [checked]="value().avoid_stairs" (change)="change('avoid_stairs', $any($event.target).checked)"> Evitar escalones</label>
      <label class="mobility-check"><input class="form-check-input" type="checkbox" [checked]="value().avoid_rough" (change)="change('avoid_rough', $any($event.target).checked)"> Evitar superficie irregular</label>
      <label class="mobility-check"><input class="form-check-input" type="checkbox" [checked]="value().verified_only" (change)="change('verified_only', $any($event.target).checked)"> Solo tramos verificados</label>
      <div class="row g-2">
        <label class="col-sm-6 small fw-semibold">Pendiente máxima (%)
          <input type="number" class="form-control mt-1" min="1" max="100" step="0.1" placeholder="Sin límite" [ngModel]="value().max_slope" (ngModelChange)="change('max_slope',$event)" [ngModelOptions]="{standalone:true}">
        </label>
        <label class="col-sm-6 small fw-semibold">Ancho mínimo (cm)
          <input type="number" class="form-control mt-1" min="20" max="1000" step="1" placeholder="Sin límite" [ngModel]="value().min_width" (ngModelChange)="change('min_width',$event)" [ngModelOptions]="{standalone:true}">
        </label>
      </div>
    </fieldset>
  `,
})
export class ProfileFields {
  readonly value=input.required<Profile>();
  readonly update=output<Profile>();

  change<K extends keyof Profile>(field: K, value: Profile[K]) { this.update.emit({...this.value(),[field]:value}); }
}
