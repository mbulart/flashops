import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { ThemeService } from '../../core/services/theme.service';

type LoginMode = 'password' | 'token';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="login-page">
      <div class="login-card card shadow-sm">
        <div class="login-brand">
          @if (brandLogo()) {
            <img class="login-logo" [src]="brandLogo()" [alt]="appName()" />
          } @else {
            <span class="brand-mark-lg">{{ appShortName() }}</span>
          }
          <h1>{{ appName() }}</h1>
          <p>Opérations &amp; reporting</p>
        </div>

        @if (autoConnecting()) {
          <div class="text-center py-4">
            <span class="spinner-border login-spinner mb-3" role="status"></span>
            <p class="text-muted mb-0">Connexion en cours…</p>
          </div>
        } @else {
        <div class="login-mode nav nav-pills nav-fill mb-3" role="tablist">
          <button
            type="button"
            class="nav-link"
            [class.active]="mode() === 'password'"
            (click)="setMode('password')"
          >
            Email
          </button>
          <button
            type="button"
            class="nav-link"
            [class.active]="mode() === 'token'"
            (click)="setMode('token')"
          >
            Token d'accès
          </button>
        </div>

        @if (mode() === 'password') {
          <form (ngSubmit)="submitPassword()" #f="ngForm">
            <div class="mb-3">
              <label class="form-label" for="email">Email</label>
              <input
                id="email"
                type="email"
                class="form-control"
                name="email"
                [(ngModel)]="email"
                required
                autocomplete="username"
                placeholder="vous@entreprise.com"
              />
            </div>
            <div class="mb-4">
              <label class="form-label" for="password">Mot de passe</label>
              <input
                id="password"
                type="password"
                class="form-control"
                name="password"
                [(ngModel)]="password"
                required
                autocomplete="current-password"
              />
            </div>
            <button class="btn btn-primary w-100" type="submit" [disabled]="loading() || f.invalid">
              @if (loading()) {
                <span class="spinner-border spinner-border-sm me-2"></span>
              }
              Se connecter
            </button>
          </form>
        } @else {
          <form (ngSubmit)="submitToken()" #tokenForm="ngForm">
            <div class="mb-3">
              <label class="form-label" for="access-token">Token d'accès</label>
              <input
                id="access-token"
                type="password"
                class="form-control font-monospace"
                name="accessToken"
                [(ngModel)]="accessToken"
                required
                autocomplete="off"
                placeholder="Token d'accès"
              />
            </div>
            <button class="btn btn-primary w-100" type="submit" [disabled]="loading() || tokenForm.invalid">
              @if (loading()) {
                <span class="spinner-border spinner-border-sm me-2"></span>
              }
              Se connecter avec le token
            </button>
          </form>
        }
        }
        <a class="login-map-link" routerLink="/carte">Carte des agences</a>
      </div>
    </div>
  `,
  styles: `
    .login-mode .nav-link {
      font-size: 0.875rem;
    }
    .login-map-link {
      display: block;
      margin-top: 1.25rem;
      text-align: center;
      font-size: 0.8rem;
      color: var(--text-muted, #6b7280);
      text-decoration: none;
    }
    .login-map-link:hover {
      color: var(--text-primary, #111);
    }
  `,
})
export class LoginPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly appSettings = inject(AppSettingsService);
  private readonly theme = inject(ThemeService);

  readonly appName = computed(() => this.appSettings.settings().app_name);
  readonly appShortName = computed(() => this.appSettings.settings().app_short_name);
  readonly brandLogo = computed(() => {
    const settings = this.appSettings.settings();
    return this.theme.mode() === 'dark'
      ? settings.logo_dark || settings.logo_light
      : settings.logo_light || settings.logo_dark;
  });
  readonly loading = signal(false);
  readonly autoConnecting = signal(false);
  readonly mode = signal<LoginMode>('password');

  email = '';
  password = '';
  accessToken = '';

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token')?.trim();
    if (token) {
      this.accessToken = token;
      this.mode.set('token');
      this.autoConnecting.set(true);
      this.loginWithToken(true);
    }
  }

  setMode(next: LoginMode): void {
    this.mode.set(next);
  }

  submitPassword(): void {
    this.loading.set(true);
    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        this.toast.success('Connexion réussie');
        this.router.navigate(['/']);
      },
      error: (err: HttpErrorResponse) => {
        this.toast.error(this.loginErrorMessage(err));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  submitToken(): void {
    this.loginWithToken(false);
  }

  private loginErrorMessage(err: HttpErrorResponse): string {
    const api = typeof err.error?.error === 'string' ? err.error.error : '';
    if (err.status === 403) {
      if (api === 'inactive user') return 'Compte désactivé. Contactez un administrateur.';
      return api || 'Accès refusé (403). Redémarrez le backend Spring Boot si vous venez de le mettre à jour.';
    }
    if (err.status === 401) {
      return api === 'invalid credentials' ? 'Email ou mot de passe incorrect.' : api || 'Identifiants invalides.';
    }
    if (err.status === 0) {
      return 'API indisponible. Vérifiez que le backend tourne sur le port 8080.';
    }
    return api || 'Connexion impossible.';
  }

  private loginWithToken(fromUrl: boolean): void {
    const value = this.accessToken.trim();
    if (!value) {
      this.autoConnecting.set(false);
      return;
    }
    this.loading.set(true);
    this.auth.loginWithToken(value).subscribe({
      next: () => {
        if (!fromUrl) {
          this.toast.success('Connexion par token réussie');
        }
        void this.router.navigate(['/'], { replaceUrl: true });
      },
      error: (err) => {
        const message = err?.error?.error || 'Token invalide, révoqué ou serveur indisponible.';
        this.toast.error(message);
        this.autoConnecting.set(false);
        this.loading.set(false);
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true,
        });
      },
      complete: () => this.loading.set(false),
    });
  }
}
