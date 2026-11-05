import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RegionRef, RegionRefInput } from '../../../core/models/api.models';

@Component({
  selector: 'app-region-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (open) {
      <div class="parametrages-modal-backdrop" (click)="cancel.emit()">
        <div class="parametrages-modal card shadow-lg" (click)="$event.stopPropagation()">
          <div class="card-header parametrages-modal__header">
            <h2 class="h6 mb-0">{{ editing ? 'Modifier la région' : 'Nouvelle région' }}</h2>
            <button type="button" class="btn-close" (click)="cancel.emit()"></button>
          </div>
          <form class="card-body" (ngSubmit)="submit()">
            <div class="row g-3 parametrages-form-grid">
              <div class="col-md-6">
                <label class="form-label" for="rg-code">Code</label>
                <input id="rg-code" class="form-control" name="code" [(ngModel)]="form.code" required maxlength="30" />
              </div>
              <div class="col-md-6">
                <label class="form-label" for="rg-libelle">Libellé</label>
                <input id="rg-libelle" class="form-control" name="libelle" [(ngModel)]="form.libelle" required maxlength="120" />
              </div>
              <div class="col-md-6">
                <div class="form-check">
                  <input id="rg-defaut" class="form-check-input" type="checkbox" name="par_defaut" [(ngModel)]="form.par_defaut" />
                  <label class="form-check-label" for="rg-defaut">Région par défaut</label>
                </div>
              </div>
              <div class="col-md-6">
                <div class="form-check">
                  <input id="rg-actif" class="form-check-input" type="checkbox" name="actif" [(ngModel)]="form.actif" />
                  <label class="form-check-label" for="rg-actif">Actif</label>
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
export class RegionFormModalComponent {
  @Input() open = false;
  @Input() saving = false;
  @Input() editing = false;
  @Output() cancel = new EventEmitter<void>();
  @Output() save = new EventEmitter<RegionRefInput>();

  form: RegionRefInput = emptyRegionForm();

  @Input() set region(value: RegionRef | null) {
    if (!value) {
      this.form = emptyRegionForm();
      this.editing = false;
      return;
    }
    this.editing = true;
    this.form = {
      code: value.code,
      libelle: value.libelle,
      par_defaut: value.par_defaut,
      actif: value.actif,
    };
  }

  submit(): void {
    this.save.emit({ ...this.form, code: this.form.code.trim().toUpperCase() });
  }
}

function emptyRegionForm(): RegionRefInput {
  return { code: '', libelle: '', par_defaut: false, actif: true };
}
