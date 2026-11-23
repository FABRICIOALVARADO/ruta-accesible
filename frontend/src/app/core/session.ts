import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from './api';
import type { User } from './models';

@Injectable({providedIn: 'root'})
export class Notice {
  private timer?: ReturnType<typeof setTimeout>;
  readonly message = signal('');

  show(text: string) {
    clearTimeout(this.timer);
    this.message.set(text);
    this.timer = setTimeout(() => this.message.set(''), 3500);
  }
}

@Injectable({providedIn: 'root'})
export class Session {
  private api = inject(Api);
  private router = inject(Router);
  private notice = inject(Notice);
  private firstLoad?: Promise<void>;
  readonly user = signal<User | null>(null);
  readonly favorites = signal<ReadonlySet<number>>(new Set());
  readonly loading = signal(true);

  ready() {
    this.firstLoad ??= this.api.me().then(({user}) => this.accept(user))
      .catch(() => this.accept(null)).finally(() => this.loading.set(false));
    return this.firstLoad;
  }

  async accept(user: User | null) {
    this.favorites.set(new Set());
    this.user.set(user);
    if (user) {
      const ids = await this.api.favorites().catch(() => []);
      if (this.user()?.id === user.id) this.favorites.set(new Set(ids));
    }
  }

  requireLogin() {
    if (this.user()) return true;
    void this.router.navigate(['/cuenta'], {queryParams: {volver: this.router.url}});
    return false;
  }

  async toggleFavorite(id: number) {
    await this.ready();
    if (!this.requireLogin()) return;
    const adding = !this.favorites().has(id);
    await this.api.favorite(id, adding);
    this.favorites.update(previous => {
      const next = new Set(previous);
      if (adding) next.add(id); else next.delete(id);
      return next;
    });
    this.notice.show(adding ? 'Lugar guardado en favoritos.' : 'Lugar retirado de favoritos.');
  }
}
