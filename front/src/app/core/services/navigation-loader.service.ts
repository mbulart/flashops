import { Injectable, effect, inject, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationCancellationCode,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';

/** Overlay de navigation : logo Flash, fond flouté, écran verrouillé jusqu'à la page suivante. */
@Injectable({ providedIn: 'root' })
export class NavigationLoaderService {
  private readonly router = inject(Router);
  readonly visible = signal(false);
  /** La première navigation est le démarrage, déjà couvert par l'écran d'init. */
  private primed = false;
  private token = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      document.documentElement.classList.toggle('nav-locked', this.visible());
    });

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        if (!this.primed) return;
        if (this.path(event.url) === this.path(this.router.url)) return;
        this.show();
        return;
      }
      if (event instanceof NavigationEnd) {
        this.primed = true;
        this.hide();
        return;
      }
      if (event instanceof NavigationCancel) {
        if (
          event.code === NavigationCancellationCode.Redirect ||
          event.code === NavigationCancellationCode.SupersededByNewNavigation
        ) {
          return;
        }
        this.hide();
        return;
      }
      if (event instanceof NavigationError) {
        this.hide();
      }
    });
  }

  private show(): void {
    const token = ++this.token;
    this.visible.set(true);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (token !== this.token) return;
      this.visible.set(false);
      this.timer = null;
    }, 20_000);
  }

  private hide(): void {
    const token = this.token;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (token !== this.token) return;
        this.visible.set(false);
      });
    });
  }

  private path(url: string): string {
    const bare = url.split(/[?#]/)[0] || '/';
    if (bare.length > 1 && bare.endsWith('/')) return bare.slice(0, -1);
    return bare || '/';
  }
}
