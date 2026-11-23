import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Notice, Session } from './core/session';

@Component({
  selector:'ra-root',
  imports:[RouterLink,RouterLinkActive,RouterOutlet],
  templateUrl:'./app.html',
})
export class App {
  readonly session = inject(Session);
  readonly notice = inject(Notice);
  readonly menu = signal(false);
  readonly reading = signal(false);

  constructor() {
    void this.session.ready();
    try { this.setReading(localStorage.getItem('ra-lectura') === 'on'); } catch { /* Preferencia opcional. */ }
  }

  toggleMenu() { this.menu.update(open => !open); }

  toggleReading() {
    const enabled = !this.reading();
    this.setReading(enabled);
    try { localStorage.setItem('ra-lectura', enabled ? 'on' : 'off'); } catch { /* El cambio sigue activo. */ }
  }

  private setReading(value: boolean) {
    this.reading.set(value);
    document.documentElement.classList.toggle('reading',value);
  }
}
