import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AppSettings } from '../../core/models/api.models';
import { AdminService } from '../../core/services/admin.service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { BrandingImageFieldComponent } from './components/branding-image-field.component';

type SettingsTab = 'identity' | 'smtp' | 'change' | 'datetime';

@Component({
  selector: 'app-parametrages-system',
  standalone: true,
  imports: [CommonModule, FormsModule, SectionCardComponent, SkeletonComponent, BrandingImageFieldComponent],
  template: `
    <nav class="parametrages-inner-nav nav" aria-label="Réglages système">
      <button type="button" class="nav-link" [class.active]="tab() === 'identity'" (click)="tab.set('identity')">Identité</button>
      <button type="button" class="nav-link" [class.active]="tab() === 'smtp'" (click)="tab.set('smtp')">SMTP</button>
      <button type="button" class="nav-link" [class.active]="tab() === 'change'" (click)="tab.set('change')">Taux de change</button>
      <button type="button" class="nav-link" [class.active]="tab() === 'datetime'" (click)="tab.set('datetime')">Heure et date</button>
    </nav>

    @if (loading()) {
      <app-skeleton type="card" />
    } @else {
      <form (ngSubmit)="save()" #settingsForm="ngForm">
        @if (tab() === 'identity') {
          <app-section-card title="Identité de l'application">
            <div class="row g-3 parametrages-form-grid">
              <div class="col-md-6">
                <label class="form-label" for="sys-name">Nom complet</label>
                <input id="sys-name" class="form-control" name="appName" [(ngModel)]="form.app_name" required />
              </div>
              <div class="col-md-6">
                <label class="form-label" for="sys-short">Nom court</label>
                <input id="sys-short" class="form-control" name="appShort" [(ngModel)]="form.app_short_name" required />
              </div>
              <div class="col-md-6">
                <label class="form-label" for="sys-url">URL application</label>
                <input id="sys-url" class="form-control" name="appUrl" [(ngModel)]="form.app_url" />
              </div>
              <div class="col-md-6">
                <label class="form-label" for="sys-lang">Langue par défaut</label>
                <select id="sys-lang" class="form-select" name="lang" [(ngModel)]="form.default_language">
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div class="col-lg-4">
                <app-branding-image-field
                  label="Logo clair"
                  inputName="logoLight"
                  inputId="sys-logo-light"
                  [value]="form.logo_light"
                  (valueChange)="form.logo_light = $event"
                />
              </div>
              <div class="col-lg-4">
                <app-branding-image-field
                  label="Logo sombre"
                  inputName="logoDark"
                  inputId="sys-logo-dark"
                  [value]="form.logo_dark"
                  (valueChange)="form.logo_dark = $event"
                />
              </div>
              <div class="col-lg-4">
                <app-branding-image-field
                  label="Favicon"
                  inputName="favicon"
                  inputId="sys-favicon"
                  [value]="form.favicon"
                  (valueChange)="form.favicon = $event"
                />
              </div>
            </div>
          </app-section-card>
        }

        @if (tab() === 'smtp') {
          <app-section-card title="Serveur SMTP">
            <div class="row g-3 parametrages-form-grid">
              <div class="col-md-6">
                <label class="form-label" for="smtp-host">Hôte</label>
                <input id="smtp-host" class="form-control" name="smtpHost" [(ngModel)]="form.smtp_host" />
              </div>
              <div class="col-md-6">
                <label class="form-label" for="smtp-port">Port</label>
                <input id="smtp-port" type="number" class="form-control" name="smtpPort" [(ngModel)]="form.smtp_port" />
              </div>
              <div class="col-md-6">
                <label class="form-label" for="smtp-user">Utilisateur</label>
                <input id="smtp-user" class="form-control" name="smtpUser" [(ngModel)]="form.smtp_username" />
              </div>
              <div class="col-md-6">
                <label class="form-label" for="smtp-pass">
                  Mot de passe
                  @if (form.smtp_password_configured) {
                    <span class="text-muted fw-normal">(laisser vide pour conserver)</span>
                  }
                </label>
                <input id="smtp-pass" type="password" class="form-control" name="smtpPass" [(ngModel)]="smtpPassword" autocomplete="new-password" />
              </div>
              <div class="col-md-6">
                <label class="form-label" for="smtp-enc">Chiffrement</label>
                <select id="smtp-enc" class="form-select" name="smtpEnc" [(ngModel)]="form.smtp_encryption">
                  <option value="none">Aucun</option>
                  <option value="tls">TLS</option>
                  <option value="ssl">SSL</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label" for="smtp-from-email">Expéditeur (email)</label>
                <input id="smtp-from-email" class="form-control" name="smtpFromEmail" [(ngModel)]="form.smtp_from_email" />
              </div>
              <div class="col-md-6">
                <label class="form-label" for="smtp-from-name">Expéditeur (nom)</label>
                <input id="smtp-from-name" class="form-control" name="smtpFromName" [(ngModel)]="form.smtp_from_name" />
              </div>
              <div class="col-md-6">
                <label class="form-label" for="smtp-test-to">Destinataire test par défaut</label>
                <input id="smtp-test-to" class="form-control" name="smtpTestTo" [(ngModel)]="form.smtp_test_to" />
              </div>
              @if (auth.can('auth.parametres.ecrire')) {
                <div class="col-md-6 d-flex align-items-end justify-content-md-end">
                  <button type="button" class="btn btn-outline-secondary btn-sm" [disabled]="testingSmtp()" (click)="testSmtp()">
                    @if (testingSmtp()) {
                      <span class="spinner-border spinner-border-sm me-1"></span>
                    }
                    Envoyer un email de test
                  </button>
                </div>
              }
            </div>
          </app-section-card>
        }

        @if (tab() === 'change') {
          <app-section-card title="Taux de change">
            <p class="text-muted small mb-3">
              Ce taux sera utilisé pour les conversions monétaires dans les autres modules.
            </p>
            <div class="row g-3 parametrages-form-grid">
              <div class="col-md-6">
                <label class="form-label" for="sys-taux">1 USD = … CDF</label>
                <input
                  id="sys-taux"
                  type="number"
                  class="form-control"
                  name="tauxChange"
                  [(ngModel)]="form.taux_change_usd_cdf"
                  min="0"
                  step="0.000001"
                  required
                />
              </div>
              <div class="col-md-6">
                <label class="form-label" for="sys-delai">Délai traitement Approvisionnement VAS (heures)</label>
                <input
                  id="sys-delai"
                  type="number"
                  class="form-control"
                  name="delaiTraitement"
                  [(ngModel)]="form.delai_traitement_heures"
                  min="0.25"
                  step="0.25"
                  required
                />
              </div>
            </div>
          </app-section-card>
        }

        @if (tab() === 'datetime') {
          <app-section-card title="Fuseau horaire">
            <div class="row g-3 parametrages-form-grid">
              <div class="col-md-6">
                <label class="form-label" for="sys-tz">Fuseau</label>
                <select id="sys-tz" class="form-select" name="timezone" [(ngModel)]="form.timezone" required>
                  <option value="Africa/Kinshasa">Africa/Kinshasa (RDC — ouest)</option>
                  <option value="Africa/Lubumbashi">Africa/Lubumbashi (RDC — est)</option>
                  <option value="UTC">UTC</option>
                  <option value="Europe/Paris">Europe/Paris</option>
                </select>
              </div>
            </div>
          </app-section-card>
        }

        @if (auth.can('auth.parametres.ecrire')) {
          <div class="text-end mt-3">
            <button type="submit" class="btn btn-primary btn-sm" [disabled]="saving() || settingsForm.invalid">
              @if (saving()) {
                <span class="spinner-border spinner-border-sm me-1"></span>
              }
              Enregistrer
            </button>
          </div>
        }
      </form>
    }
  `,
})
export class ParametragesSystemPageComponent {
  readonly auth = inject(AuthService);
  private readonly admin = inject(AdminService);
  private readonly appSettings = inject(AppSettingsService);
  private readonly toast = inject(ToastService);

  readonly tab = signal<SettingsTab>('identity');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly testingSmtp = signal(false);

  form = this.emptySettings();
  smtpPassword = '';

  ngOnInit(): void {
    void this.load();
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      const payload: AppSettings = { ...this.form };
      if (this.smtpPassword.trim()) {
        payload.smtp_password = this.smtpPassword.trim();
      }
      const res = await firstValueFrom(this.admin.updateSettings(payload));
      this.form = this.normalizeForm(res.data);
      this.smtpPassword = '';
      this.appSettings.apply(res.data);
      this.toast.success('Paramètres enregistrés');
    } catch {
      this.toast.error('Enregistrement impossible');
    } finally {
      this.saving.set(false);
    }
  }

  async testSmtp(): Promise<void> {
    this.testingSmtp.set(true);
    try {
      const to = this.form.smtp_test_to?.trim();
      await firstValueFrom(this.admin.testSmtp(to || undefined));
      this.toast.success('Email de test envoyé');
    } catch {
      this.toast.error('Échec de l’envoi SMTP');
    } finally {
      this.testingSmtp.set(false);
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.admin.getSettings());
      this.form = this.normalizeForm(res.data);
    } catch {
      this.toast.error('Chargement des paramètres impossible');
    } finally {
      this.loading.set(false);
    }
  }

  private normalizeForm(data: AppSettings): AppSettings {
    return {
      ...data,
      timezone: data.timezone || 'Africa/Kinshasa',
      taux_change_usd_cdf: Number(data.taux_change_usd_cdf ?? 0),
      delai_traitement_heures: Number(data.delai_traitement_heures ?? 2),
    };
  }

  private emptySettings(): AppSettings {
    return {
      app_name: '',
      app_short_name: '',
      app_url: '',
      logo_light: '',
      logo_dark: '',
      favicon: '',
      default_language: 'fr',
      timezone: 'Africa/Kinshasa',
      smtp_host: '',
      smtp_port: 587,
      smtp_username: '',
      smtp_password_configured: false,
      smtp_encryption: 'tls',
      smtp_from_email: '',
      smtp_from_name: '',
      smtp_test_to: '',
      taux_change_usd_cdf: 0,
      delai_traitement_heures: 2,
    };
  }
}
