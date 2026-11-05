import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User } from '../../../core/models/api.models';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-profile-account-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (open) {
      <div class="profile-modal-backdrop">
        <div
          class="profile-modal card shadow-lg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-account-title"
          (click)="$event.stopPropagation()"
        >
          <div class="card-header profile-modal__header">
            <h2 id="profile-account-title" class="h5 mb-0">Modifier les informations du compte</h2>
            <button type="button" class="btn btn-icon btn-sm" (click)="close.emit()" aria-label="Fermer">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          <div class="card-body">
            <form autocomplete="off" (ngSubmit)="submit()">
              <p class="profile-modal__section-label">Identité</p>
              <div class="mb-3">
                <label class="form-label" for="profile-full-name">Nom affiché</label>
                <input
                  id="profile-full-name"
                  type="text"
                  class="form-control"
                  name="fullName"
                  [(ngModel)]="fullName"
                  required
                  autocomplete="off"
                />
              </div>
              <div class="mb-4">
                <label class="form-label" for="profile-email">Adresse e-mail</label>
                <input
                  id="profile-email"
                  type="email"
                  class="form-control"
                  name="email"
                  [(ngModel)]="email"
                  required
                  autocomplete="off"
                />
              </div>
            </form>

            <hr class="my-3" />

            <form autocomplete="off" (ngSubmit)="submit()">
              <p class="profile-modal__section-label">Mot de passe</p>
              <p class="form-text mb-3">Renseignez les champs ci-dessous uniquement si vous souhaitez le changer.</p>
              <div class="mb-3">
                <label class="form-label" for="current-password">Mot de passe actuel</label>
                <input
                  id="current-password"
                  type="password"
                  class="form-control"
                  name="profileCurrentPassword"
                  #currentPasswordInput
                  [(ngModel)]="currentPassword"
                  autocomplete="off"
                />
              </div>
              <div class="mb-3">
                <label class="form-label" for="new-password">Nouveau mot de passe</label>
                <input
                  id="new-password"
                  type="password"
                  class="form-control"
                  name="profileNewPassword"
                  #newPasswordInput
                  [(ngModel)]="newPassword"
                  minlength="8"
                  autocomplete="new-password"
                />
              </div>
              <div class="mb-4">
                <label class="form-label" for="confirm-password">Confirmer le mot de passe</label>
                <input
                  id="confirm-password"
                  type="password"
                  class="form-control"
                  name="profileConfirmPassword"
                  #confirmPasswordInput
                  [(ngModel)]="confirmPassword"
                  autocomplete="new-password"
                />
              </div>

              <div class="d-flex gap-2 justify-content-end">
                <button type="button" class="btn btn-outline-secondary" (click)="close.emit()" [disabled]="saving()">
                  Annuler
                </button>
                <button type="submit" class="btn btn-primary" [disabled]="saving() || !canSubmit()">
                  @if (saving()) {
                    <span class="spinner-border spinner-border-sm me-2"></span>
                  }
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .profile-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1055;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: rgba(17, 17, 17, 0.45);
      backdrop-filter: blur(4px);
    }

    .profile-modal {
      width: min(100%, 32rem);
      max-height: min(92vh, 40rem);
      border: 1px solid var(--card-border);
      border-radius: var(--flash-radius, 0.75rem);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .profile-modal .card-body {
      overflow-y: auto;
    }

    .profile-modal__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      background: var(--card-bg);
      border-bottom: 1px solid var(--card-border);
      flex-shrink: 0;
    }

    .profile-modal__section-label {
      margin: 0 0 0.75rem;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-muted);
    }
  `,
})
export class ProfileAccountModalComponent implements OnChanges {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  @Input({ required: true }) open = false;
  @Input() user: User | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly saving = signal(false);

  @ViewChild('currentPasswordInput') currentPasswordInput?: ElementRef<HTMLInputElement>;
  @ViewChild('newPasswordInput') newPasswordInput?: ElementRef<HTMLInputElement>;
  @ViewChild('confirmPasswordInput') confirmPasswordInput?: ElementRef<HTMLInputElement>;

  fullName = '';
  email = '';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true && this.user) {
      this.fullName = this.user.full_name?.trim() || '';
      this.email = this.user.email?.trim() || '';
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
    }
  }

  private profileDirty(): boolean {
    if (!this.user) return false;
    const name = this.fullName.trim();
    const mail = this.email.trim().toLowerCase();
    const prevName = (this.user.full_name || '').trim();
    const prevMail = (this.user.email || '').trim().toLowerCase();
    return name !== prevName || mail !== prevMail;
  }

  private readInput(
    ref: ElementRef<HTMLInputElement> | undefined,
    fallback: string,
    elementId: string
  ): string {
    const fromRef = ref?.nativeElement?.value;
    if (typeof fromRef === 'string' && fromRef.length > 0) return fromRef;
    const fromDom = (document.getElementById(elementId) as HTMLInputElement | null)?.value;
    if (typeof fromDom === 'string' && fromDom.length > 0) return fromDom;
    return fallback;
  }

  private syncPasswordsFromDom(): void {
    this.currentPassword = this.readInput(
      this.currentPasswordInput,
      this.currentPassword,
      'current-password'
    );
    this.newPassword = this.readInput(this.newPasswordInput, this.newPassword, 'new-password');
    this.confirmPassword = this.readInput(
      this.confirmPasswordInput,
      this.confirmPassword,
      'confirm-password'
    );
  }

  private passwordTouched(): boolean {
    return !!(
      this.readInput(this.currentPasswordInput, this.currentPassword, 'current-password') ||
      this.readInput(this.newPasswordInput, this.newPassword, 'new-password') ||
      this.readInput(this.confirmPasswordInput, this.confirmPassword, 'confirm-password')
    );
  }

  canSubmit(): boolean {
    const name = this.fullName.trim();
    const mail = this.email.trim();
    if (!name || !mail.includes('@')) return false;
    if (!this.profileDirty() && !this.passwordTouched()) return false;
    if (!this.passwordTouched()) return true;
    const current = this.readInput(
      this.currentPasswordInput,
      this.currentPassword,
      'current-password'
    );
    const next = this.readInput(this.newPasswordInput, this.newPassword, 'new-password');
    const confirm = this.readInput(
      this.confirmPasswordInput,
      this.confirmPassword,
      'confirm-password'
    );
    return !!current && next.length >= 8 && next === confirm;
  }

  submit(): void {
    this.syncPasswordsFromDom();
    if (!this.canSubmit() || this.saving() || !this.user) return;
    void this.runSubmit();
  }

  private async runSubmit(): Promise<void> {
    this.syncPasswordsFromDom();
    const currentPwd = this.currentPassword;
    const newPwd = this.newPassword;
    const profileDirty = this.profileDirty();
    this.saving.set(true);
    try {
      const ready = await this.auth.ensureAccessForWrite();
      if (!ready) {
        this.toast.warning('Session expirée. Reconnectez-vous.');
        this.auth.logout();
        return;
      }
      if (profileDirty) {
        await firstValueFrom(
          this.auth.updateProfile(this.email.trim(), this.fullName.trim())
        );
      }
      let passwordChanged = false;
      if (currentPwd || newPwd) {
        const pwdRes = await firstValueFrom(this.auth.changePassword(currentPwd, newPwd));
        passwordChanged = !!pwdRes.logout_required || !!pwdRes.sessions_revoked;
      }
      if (passwordChanged) {
        this.toast.success(
          'Mot de passe mis à jour. Toutes les sessions ont été fermées — reconnectez-vous.'
        );
        this.close.emit();
        this.auth.logout();
        return;
      }
      this.toast.success('Compte mis à jour');
      this.saved.emit();
      this.close.emit();
    } catch (err: unknown) {
      this.handleSubmitError(err);
    } finally {
      this.saving.set(false);
    }
  }

  private handleSubmitError(err: unknown): void {
    const httpErr = err instanceof HttpErrorResponse ? err : null;
    const msg =
      typeof httpErr?.error?.error === 'string' ? httpErr.error.error : '';
    if (msg === 'email already used') {
      this.toast.error('Cette adresse e-mail est déjà utilisée.');
    } else if (msg === 'invalid email') {
      this.toast.error('Adresse e-mail invalide.');
    } else if (msg === 'invalid full name') {
      this.toast.error('Nom affiché invalide.');
    } else if (msg === 'invalid current password') {
      this.toast.error('Mot de passe actuel incorrect.');
    } else if (msg === 'password too short') {
      this.toast.error('Le nouveau mot de passe est trop court.');
    } else if (httpErr?.status === 401 || httpErr?.status === 403) {
      this.toast.warning('Session expirée ou invalide. Reconnectez-vous.');
      this.auth.logout();
    } else if (err instanceof Error && err.message === 'missing access token') {
      this.toast.warning('Session expirée. Reconnectez-vous.');
      this.auth.logout();
    } else {
      this.toast.error('Mise à jour impossible.');
    }
  }
}
