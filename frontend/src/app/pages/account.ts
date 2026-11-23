import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api, errorText } from '../core/api';
import type { Place } from '../core/models';
import { Notice, Session } from '../core/session';
import { PlaceCard } from '../shared/place-card';

@Component({imports:[ReactiveFormsModule,RouterLink,PlaceCard],templateUrl:'./account.html'})
export class Account {
  readonly session=inject(Session);
  private api=inject(Api);
  private router=inject(Router);
  private route=inject(ActivatedRoute);
  private notice=inject(Notice);
  private forms=inject(FormBuilder).nonNullable;
  readonly creating=signal(false);
  readonly visible=signal(false);
  readonly attempted=signal(false);
  readonly busy=signal(false);
  readonly error=signal('');
  readonly places=signal<Place[]>([]);
  readonly favorites=computed(()=>this.places().filter(place=>this.session.favorites().has(place.id)));
  readonly profile=this.forms.group({name:['',[Validators.required,Validators.minLength(2),Validators.maxLength(80)]]});
  readonly form=this.forms.group({
    name:'', email:['',[Validators.required,Validators.email,Validators.maxLength(160)]],
    password:['',[Validators.required,Validators.minLength(8),Validators.maxLength(128)]],
  });

  constructor() { void this.session.ready().then(()=>this.refresh()); }

  switchMode() {
    this.creating.update(value=>!value);
    this.form.controls.name.setValidators(this.creating() ? [Validators.required,Validators.minLength(2),Validators.maxLength(80)] : []);
    this.form.controls.name.updateValueAndValidity();
    this.attempted.set(false);
    this.error.set('');
  }

  togglePassword() { this.visible.update(value=>!value); }

  login() {
    this.attempted.set(true);
    if (this.form.invalid) return;
    return this.perform(async () => {
      const {user}=await this.api.authenticate(this.form.getRawValue(),this.creating());
      await this.session.accept(user);
      this.form.reset();
      this.notice.show(this.creating() ? 'Cuenta creada.' : 'Sesión iniciada.');
      const target=this.route.snapshot.queryParamMap.get('volver');
      if (target && /^\/(explorar|lugares\/\d+|rutas|comunidad|administrar)(?:[?#]|$)/.test(target)) await this.router.navigateByUrl(target);
      else await this.refresh();
    });
  }

  saveProfile() {
    if (this.profile.invalid) return;
    return this.perform(async ()=>{
      const {user}=await this.api.profile(this.profile.getRawValue().name);
      this.session.user.set(user);
      this.notice.show('Perfil actualizado.');
    });
  }

  logout() {
    return this.perform(async () => {
      await this.api.signOut();
      await this.session.accept(null);
      if (this.creating()) this.switchMode();
      this.notice.show('Sesión cerrada.');
    });
  }

  private async refresh() {
    const user=this.session.user();
    if (!user) return;
    this.profile.reset({name:user.name});
    try { this.places.set(await this.api.places()); } catch (error) { this.error.set(errorText(error)); }
  }

  private async perform(task:()=>Promise<void>) {
    this.busy.set(true);
    this.error.set('');
    try { await task(); } catch (error) { this.error.set(errorText(error)); }
    finally { this.busy.set(false); }
  }
}
