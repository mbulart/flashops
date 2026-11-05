import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminRole, AdminUserInput, ResponsableZoneRef } from '../../../core/models/api.models';
import { AgenceAdmin } from '../../../core/models/agences.models';

@Component({
  selector: 'app-user-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (open) {
      <div class="parametrages-modal-backdrop" (click)="onBackdropClick()">
        <div
          class="parametrages-modal card shadow-lg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-form-title"
          (click)="$event.stopPropagation()"
        >
          <div class="card-header parametrages-modal__header">
            <h2 id="user-form-title" class="h6 mb-0">{{ editingId ? 'Modifier l’utilisateur' : 'Nouvel utilisateur' }}</h2>
            <button type="button" class="btn btn-icon btn-sm" (click)="cancel.emit()" aria-label="Fermer">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          <form class="card-body" (ngSubmit)="submit()" #f="ngForm">
            <div class="row g-3 parametrages-form-grid">
              <div class="col-md-6">
                <label class="form-label" for="uf-name">Nom complet</label>
                <input id="uf-name" class="form-control" name="fullName" [(ngModel)]="form.full_name" required />
              </div>
              <div class="col-md-6">
                <label class="form-label" for="uf-email">Courriel</label>
                <input id="uf-email" type="email" class="form-control" name="email" [(ngModel)]="form.email" required />
              </div>
              <div class="col-md-6">
                <label class="form-label" for="uf-role">Rôle</label>
                <select
                  id="uf-role"
                  class="form-select"
                  name="roleId"
                  [(ngModel)]="form.role_id"
                  required
                  (ngModelChange)="onRoleChange()"
                >
                  @for (role of roles; track role.id) {
                    <option [ngValue]="role.id">{{ role.label }}</option>
                  }
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label" for="uf-password">
                  Mot de passe
                  @if (editingId) {
                    <span class="text-muted fw-normal">(vide = inchangé)</span>
                  }
                </label>
                <input
                  id="uf-password"
                  type="password"
                  class="form-control"
                  name="password"
                  [(ngModel)]="passwordLocal"
                  [required]="!editingId"
                  minlength="8"
                  autocomplete="new-password"
                />
              </div>
              @if (selectedRoleCode() === 'AGENT') {
                <div class="col-12">
                  <label class="form-label" for="uf-agence">Agence rattachée</label>
                  <select
                    id="uf-agence"
                    class="form-select"
                    name="agenceId"
                    [(ngModel)]="form.agence_id"
                    required
                  >
                    <option [ngValue]="null">Sélectionner une agence…</option>
                    @for (ag of agences; track ag.agenceId) {
                      <option [ngValue]="ag.agenceId">
                        {{ ag.code_agence }} — {{ ag.nom || 'Sans nom' }}
                      </option>
                    }
                  </select>
                  <p class="form-text mb-0">
                    Si l’agence est mère, l’agent voit aussi ses filles. Sinon, uniquement cette agence.
                  </p>
                </div>
              }
              @if (selectedRoleCode() === 'RZ') {
                <div class="col-12">
                  <label class="form-label" for="uf-rz">Responsable de zone</label>
                  <select
                    id="uf-rz"
                    class="form-select"
                    name="rzId"
                    [(ngModel)]="form.responsable_zone_id"
                    required
                  >
                    <option [ngValue]="null">Sélectionner un RZ…</option>
                    @for (rz of responsables; track rz.id) {
                      <option [ngValue]="rz.id">{{ rz.nom }} ({{ rz.code }})</option>
                    }
                  </select>
                  <p class="form-text mb-0">Périmètre limité aux agences de sa zone.</p>
                </div>
              }
              <div class="col-12">
                <div class="form-check form-switch">
                  <input id="uf-active" class="form-check-input" type="checkbox" name="active" [(ngModel)]="form.is_active" />
                  <label class="form-check-label" for="uf-active">Compte actif</label>
                </div>
              </div>
            </div>
            <div class="d-flex justify-content-end gap-2 mt-4 pt-2 border-top">
              <button type="button" class="btn btn-outline-secondary btn-sm" (click)="cancel.emit()">Annuler</button>
              <button type="submit" class="btn btn-primary btn-sm" [disabled]="saving || f.invalid">
                @if (saving) {
                  <span class="spinner-border spinner-border-sm me-1"></span>
                }
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class UserFormModalComponent implements OnChanges {
  @Input({ required: true }) open = false;
  @Input({ required: true }) form!: AdminUserInput;
  @Input() roles: AdminRole[] = [];
  @Input() agences: AgenceAdmin[] = [];
  @Input() responsables: ResponsableZoneRef[] = [];
  @Input() editingId: number | null = null;
  @Input() saving = false;

  @Output() cancel = new EventEmitter<void>();
  @Output() save = new EventEmitter<string>();

  passwordLocal = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this.passwordLocal = '';
    }
  }

  selectedRoleCode(): string {
    const role = this.roles.find((r) => r.id === this.form.role_id);
    return role?.code ?? '';
  }

  onRoleChange(): void {
    const code = this.selectedRoleCode();
    if (code !== 'AGENT') {
      this.form.agence_id = null;
    }
    if (code !== 'RZ') {
      this.form.responsable_zone_id = null;
    }
  }

  onBackdropClick(): void {
    this.cancel.emit();
  }

  submit(): void {
    this.save.emit(this.passwordLocal);
  }
}
