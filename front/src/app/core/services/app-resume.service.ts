import { ApplicationRef, DestroyRef, Injectable, NgZone, inject } from '@angular/core';
import { AppLoadingService } from './app-loading.service';
import { AuthService } from './auth.service';
import { RuntimeConfigService } from './runtime-config.service';

@Injectable({ providedIn: 'root' })
export class AppResumeService {
  private readonly loading = inject(AppLoadingService);
  private readonly auth = inject(AuthService);
  private readonly runtime = inject(RuntimeConfigService);
  private readonly appRef = inject(ApplicationRef);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private hiddenAt: number | null = null;
  private warming = false;
  private readonly idleMs = 20_000;

  init(): void {
    const wake = (): void => {
      const idle = this.hiddenAt !== null && Date.now() - this.hiddenAt >= this.idleMs;
      this.hiddenAt = null;
      this.zone.run(() => {
        if (idle) {
          this.loading.forceHide();
          document.getElementById('app-splash')?.remove();
        }
        this.appRef.tick();
      });
      if (idle) void this.warm();
    };

    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') {
        this.hiddenAt = Date.now();
        return;
      }
      if (document.visibilityState === 'visible') wake();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', wake);
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', wake);
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
    });
  }

  private async warm(): Promise<void> {
    if (this.warming) return;
    if (!this.auth.accessToken && !this.auth.refreshToken) return;
    this.warming = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    try {
      const base = this.runtime.apiUrl;
      if (base) {
        await fetch(`${base}/health`, { cache: 'no-store', signal: ctrl.signal }).catch(() => undefined);
      }
      await this.auth.warmSession();
    } finally {
      clearTimeout(timer);
      this.warming = false;
    }
  }
}
