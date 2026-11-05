import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ResponsableZoneInput, ResponsableZoneRef } from '../../../core/models/api.models';

@Component({
  selector: 'app-responsable-zone-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (open) {
      <div class="parametrages-modal-backdrop" (click)="cancel.emit()">
        <div class="parametrages-modal card shadow-lg" (click)="$event.stopPropagation()">
          <div class="card-header parametrages-modal__header">
            <h2 class="h6 mb-0">{{ editing ? 'Modifier le responsable' : 'Nouveau responsable de zone' }}</h2>
            <button type="button" class="btn-close" (click)="cancel.emit()"></button>
          </div>
          <form class="card-body" (ngSubmit)="submit()">
            <div class="row g-3 parametrages-form-grid">
              <div class="col-md-6">
                <label class="form-label" for="rz-code">Code</label>
                <input id="rz-code" class="form-control" name="code" [(ngModel)]="form.code" required maxlength="40" />
              </div>
              <div class="col-md-6">
                <label class="form-label" for="rz-nom">Nom</label>
                <input id="rz-nom" class="form-control" name="nom" [(ngModel)]="form.nom" required maxlength="120" />
              </div>
              <div class="col-md-6">
                <label class="form-label" for="rz-perimetre">Périmètre</label>
                <select id="rz-perimetre" class="form-select" name="perimetre" [(ngModel)]="form.perimetre" required>
                  <option value="Kinshasa">Kinshasa</option>
                  <option value="Intérieur">Intérieur</option>
                </select>
              </div>
              <div class="col-md-6 d-flex align-items-end">
                <div class="form-check">
                  <input id="rz-actif" class="form-check-input" type="checkbox" name="actif" [(ngModel)]="form.actif" />
                  <label class="form-check-label" for="rz-actif">Actif</label>
                </div>
              </div>
            </div>
            <div class="d-flex justify-content-end gap-2 mt-4 pt-2 border-top">
              <button type="button" class="btn btn-outline-secondary btn-sm" (click)="cancel.emit()">Annuler</button>
              <button type="submit" class="btn btn-primary btn-sm" [disabled]="saving">{{ saving ? 'Enregistrement…' : 'Enregistrer' }}</button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class ResponsableZoneFormModalComponent {
  @Input() open = false;
  @Input() saving = false;
  @Input() editing = false;
  @Output() cancel = new EventEmitter<void>();
  @Output() save = new EventEmitter<ResponsableZoneInput>();

  form: ResponsableZoneInput = emptyForm();

  @Input() set responsable(value: ResponsableZoneRef | null) {
    if (!value) {
      this.form = emptyForm();
      this.editing = false;
      return;
    }
    this.editing = true;
    this.form = {
      code: value.code,
      nom: value.nom,
      perimetre: value.perimetre,
      actif: value.actif,
    };
  }

  submit(): void {
    this.save.emit({ ...this.form, code: this.form.code.trim().toUpperCase() });
  }
}

function emptyForm(): ResponsableZoneInput {
  return { code: '', nom: '', perimetre: 'Kinshasa', actif: true };
}
