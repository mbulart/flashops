import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppSettingsService } from '../../core/services/app-settings.service';

@Component({
  selector: 'app-onboarding-landing',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="public-page">
      <nav class="public-nav">
        <a routerLink="/devenir-distributeur" class="brand" aria-label="Flash">
          <img [src]="logoUrl()" alt="Flash" class="brand-logo" />
        </a>
        <a routerLink="/devenir-distributeur/suivi" class="btn btn-outline-dark btn-sm">
          Suivre ma candidature
        </a>
      </nav>

      <section class="hero">
        <h1>Devenir distributeur Flash</h1>
        <a routerLink="/devenir-distributeur/candidature" class="btn btn-primary btn-lg">
          Commencer
        </a>
      </section>
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: linear-gradient(140deg, #fff 55%, #fff7cc);
      color: #191919;
    }
    .public-page {
      max-width: 1120px;
      margin: auto;
      padding: 1.25rem 2rem 4rem;
    }
    .public-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      text-decoration: none;
    }
    .brand-logo {
      height: 2.4rem;
      width: auto;
      display: block;
      object-fit: contain;
    }
    .hero {
      min-height: calc(100vh - 7rem);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      gap: 1.75rem;
      max-width: 42rem;
    }
    h1 {
      font-size: clamp(2.4rem, 6vw, 4.2rem);
      line-height: 1.02;
      margin: 0;
      letter-spacing: -0.045em;
      font-weight: 800;
    }
    @media (max-width: 760px) {
      .public-page {
        padding: 1rem;
      }
      .hero {
        min-height: calc(100vh - 5.5rem);
        padding: 3rem 0;
      }
      .brand-logo {
        height: 2rem;
      }
    }
  `,
})
export class OnboardingLandingPageComponent {
  private readonly appSettings = inject(AppSettingsService);

  readonly logoUrl = computed(
    () => this.appSettings.settings().logo_light || '/branding/logo-light1.png'
  );
}
