import { Component, inject } from '@angular/core';
import { AppLoadingService } from '../../../core/services/app-loading.service';
import { NavigationLoaderService } from '../../../core/services/navigation-loader.service';

@Component({
  selector: 'app-global-loader',
  standalone: true,
  template: `
    @if (loading.visible()) {
      <div class="global-loader" role="status" aria-live="polite" aria-busy="true">
        <img
          class="global-loader__logo flash-brand-pulse brand-logo--light"
          src="branding/logo-light1.png"
          width="120"
          height="120"
          alt=""
        />
        <img
          class="global-loader__logo flash-brand-pulse brand-logo--dark"
          src="branding/logo-dark1.png"
          width="120"
          height="120"
          alt=""
        />
        <p class="global-loader__text">{{ loading.message() }}</p>
      </div>
    } @else if (nav.visible()) {
      <div class="nav-loader" role="status" aria-live="polite" aria-busy="true" aria-label="Chargement">
        <img
          class="nav-loader__logo flash-brand-pulse brand-logo--light"
          src="branding/logo-light1.png"
          width="96"
          height="96"
          alt=""
        />
        <img
          class="nav-loader__logo flash-brand-pulse brand-logo--dark"
          src="branding/logo-dark1.png"
          width="96"
          height="96"
          alt=""
        />
      </div>
    }
  `,
  styles: `
    .global-loader {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      background: var(--app-bg, #f1f3f5);
      color: var(--text-muted, #6b7280);
    }

    .global-loader__logo {
      width: var(--logo-splash, 7.5rem);
      height: var(--logo-splash, 7.5rem);
      object-fit: contain;
    }

    .global-loader__text {
      margin: 0;
      font-size: var(--font-size-body, 1.0625rem);
      font-weight: 500;
      letter-spacing: var(--letter-spacing-body, -0.022em);
    }

    .nav-loader {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in srgb, var(--app-bg, #f1f3f5) 42%, transparent);
      backdrop-filter: blur(7px);
      -webkit-backdrop-filter: blur(7px);
      pointer-events: auto;
      cursor: progress;
    }

    :host-context([data-bs-theme='dark']) .nav-loader {
      background: color-mix(in srgb, #141414 55%, transparent);
    }

    .nav-loader__logo {
      width: 6rem;
      height: 6rem;
      object-fit: contain;
    }
  `,
})
export class GlobalLoaderComponent {
  readonly loading = inject(AppLoadingService);
  readonly nav = inject(NavigationLoaderService);
}
