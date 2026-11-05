import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RegionRef, ResponsableZoneRef, ZoneRef, ZoneRefInput } from '../../../core/models/api.models';

@Component({
  selector: 'app-zone-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (open) {
      <div class="parametrages-modal-backdrop" (click)="cancel.emit()">
        <div class="parametrages-modal card shadow-lg" (click)="$event.stopPropagation()">
          <div class="card-header parametrages-modal__header">
            <h2 class="h6 mb-0">{{ editing ? 'Modifier la zone' : 'Nouvelle zone' }}</h2>
            <button type="button" class="btn-close" (click)="cancel.emit()"></button>
          </div>
          <form class="card-body" (ngSubmit)="submit()">
            <div class="row g-3 parametrages-form-grid">
              <div class="col-md-6">
                <label class="form-label" for="z-code">Code</label>
                <input id="z-code" class="form-control" name="code" [(ngModel)]="form.code" required maxlength="40" />
              </div>
              <div class="col-md-6">
                <label class="form-label" for="z-libelle">Libellé</label>
                <input id="z-libelle" class="form-control" name="libelle" [(ngModel)]="form.libelle" required maxlength="120" />
              </div>
              <div class="col-md-6">
                <label class="form-label" for="z-perimetre">Périmètre</label>
                <select id="z-perimetre" class="form-select" name="perimetre" [(ngModel)]="form.perimetre" required>
                  <option value="Kinshasa">Kinshasa</option>
                  <option value="Intérieur">Intérieur</option>
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label" for="z-region">Région</label>
                <select id="z-region" class="form-select" name="region_id" [(ngModel)]="form.region_id">
                  <option [ngValue]="null">— Aucune —</option>
                  @for (r of regions; track r.id) {
                    <option [ngValue]="r.id">{{ r.libelle }} ({{ r.code }})</option>
                  }
                </select>
              </div>
              <div class="col-md-6">
                <label class="form-label" for="z-rz">Responsable de zone</label>
                <select id="z-rz" class="form-select" name="responsable" [(ngModel)]="form.responsable_zone_id">
                  <option [ngValue]="null">— Aucun —</option>
                  @for (r of responsables; track r.id) {
                    <option [ngValue]="r.id">{{ r.nom }} ({{ r.code }})</option>
                  }
                </select>
              </div>
              <div class="col-md-3">
                <label class="form-label" for="z-nc">Communes</label>
                <input id="z-nc" type="number" min="0" class="form-control" name="nb_communes" [(ngModel)]="form.nb_communes" />
              </div>
              <div class="col-md-3">
                <label class="form-label" for="z-nv">Villes</label>
                <input id="z-nv" type="number" min="0" class="form-control" name="nb_villes" [(ngModel)]="form.nb_villes" />
              </div>
              <div class="col-12">
                <div class="form-check">
                  <input id="z-actif" class="form-check-input" type="checkbox" name="actif" [(ngModel)]="form.actif" />
                  <label class="form-check-label" for="z-actif">Actif</label>
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
export class ZoneFormModalComponent {
  @Input() open = false;
  @Input() saving = false;
  @Input() editing = false;
  @Input() responsables: ResponsableZoneRef[] = [];
  @Input() regions: RegionRef[] = [];
  @Output() cancel = new EventEmitter<void>();
  @Output() save = new EventEmitter<ZoneRefInput>();

  form: ZoneRefInput = emptyZoneForm();

  @Input() set zone(value: ZoneRef | null) {
    if (!value) {
      this.form = emptyZoneForm();
      this.editing = false;
      return;
    }
    this.editing = true;
    this.form = {
      code: value.code,
      libelle: value.libelle,
      perimetre: value.perimetre,
      region: value.region ?? '',
      region_id: value.region_id ?? null,
      responsable_zone_id: value.responsable_zone_id ?? null,
      nb_communes: value.nb_communes,
      nb_villes: value.nb_villes,
      actif: value.actif,
    };
  }

  submit(): void {
    const region = this.regions.find((r) => r.id === this.form.region_id);
    this.save.emit({
      ...this.form,
      code: this.form.code.trim().toUpperCase(),
      region_id: this.form.region_id ?? null,
      region: region?.libelle ?? '',
    });
  }
}

function emptyZoneForm(): ZoneRefInput {
  return {
    code: '',
    libelle: '',
    perimetre: 'Kinshasa',
    region: '',
    region_id: null,
    responsable_zone_id: null,
    nb_communes: 0,
    nb_villes: 0,
    actif: true,
  };
}
