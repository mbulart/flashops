import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgenceAdmin, AgenceAdminInput } from '../../../core/models/agences.models';
import { GeoPoint } from '../../../core/models/api.models';
import { PilotageReseauRef } from '../../../core/models/pilotage.models';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { GeoMapComponent } from '../../../shared/components/geo-map/geo-map.component';

export type AgenceFormModel = AgenceAdminInput & {
  latitude: number | null;
  longitude: number | null;
};

@Component({
  selector: 'app-agence-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, GeoMapComponent],
  template: `
    @if (open) {
      <div class="parametrages-modal-backdrop agence-form-backdrop">
        <div
          class="parametrages-modal card shadow-lg agence-form-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agence-form-title"
          (click)="$event.stopPropagation()"
        >
          <div class="card-header parametrages-modal__header">
            <h2 id="agence-form-title" class="h6 mb-0">{{ editingId ? 'Modifier l’agence' : 'Nouvelle agence' }}</h2>
            <button type="button" class="btn btn-icon btn-sm" (click)="cancel.emit()" [disabled]="saving" aria-label="Fermer">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          <form class="card-body" (ngSubmit)="submit()">
            <div class="row g-3 agence-form-grid">
              <div class="col-lg-6">
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label" for="ag-code">Code agence</label>
                    <input id="ag-code" class="form-control" name="code" [(ngModel)]="form.code_agence" required maxlength="80" />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label" for="ag-pos">POS / FP</label>
                    <input id="ag-pos" class="form-control" name="pos" [(ngModel)]="form.pos_id" maxlength="80" />
                  </div>
                  <div class="col-12">
                    <label class="form-label" for="ag-nom">Nom</label>
                    <input id="ag-nom" class="form-control" name="nom" [(ngModel)]="form.nom" required maxlength="200" />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label" for="ag-cat">Catégorie</label>
                    <input id="ag-cat" class="form-control" name="cat" [(ngModel)]="form.categorie" list="ag-cat-list" maxlength="80" />
                    <datalist id="ag-cat-list">
                      @for (c of categories; track c) {
                        <option [value]="c"></option>
                      }
                    </datalist>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label" for="ag-fp">FP agent</label>
                    <input id="ag-fp" class="form-control" name="fp" [(ngModel)]="form.fp_agent" maxlength="80" />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label" for="ag-region">Région</label>
                    <select id="ag-region" class="form-select" name="region" [(ngModel)]="form.regionId" (ngModelChange)="onRegionChange()">
                      <option [ngValue]="null">—</option>
                      @for (r of regions; track r.id) {
                        <option [ngValue]="r.id">{{ r.libelle }}</option>
                      }
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label" for="ag-zone">Zone</label>
                    <select id="ag-zone" class="form-select" name="zone" [(ngModel)]="form.zoneId">
                      <option [ngValue]="null">—</option>
                      @for (z of zonesForRegion(); track z.id) {
                        <option [ngValue]="z.id">{{ z.libelle }}</option>
                      }
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label" for="ag-ville">Ville</label>
                    <input id="ag-ville" class="form-control" name="ville" [(ngModel)]="form.ville" maxlength="120" />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label" for="ag-commune">Commune</label>
                    <input id="ag-commune" class="form-control" name="commune" [(ngModel)]="form.commune" maxlength="120" />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label" for="ag-province">Province</label>
                    <input id="ag-province" class="form-control" name="province" [(ngModel)]="form.province" maxlength="120" />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label" for="ag-pays">Pays</label>
                    <input id="ag-pays" class="form-control" name="pays" [(ngModel)]="form.pays" maxlength="80" />
                  </div>
                  <div class="col-12">
                    <label class="form-label" for="ag-adresse">Adresse</label>
                    <textarea id="ag-adresse" class="form-control" rows="2" name="adresse" [(ngModel)]="form.adresse" maxlength="500"></textarea>
                  </div>
                  <div class="col-12">
                    <label class="form-label" for="ag-mere">Agence mère (ID)</label>
                    <input
                      id="ag-mere"
                      type="number"
                      class="form-control"
                      name="mere"
                      [(ngModel)]="form.parentAgenceId"
                      min="1"
                      placeholder="agence_id de la mère"
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label" for="ag-lat">Latitude</label>
                    <input id="ag-lat" type="number" step="any" class="form-control" name="lat" [(ngModel)]="form.latitude" />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label" for="ag-lng">Longitude</label>
                    <input id="ag-lng" type="number" step="any" class="form-control" name="lng" [(ngModel)]="form.longitude" />
                  </div>
                </div>
              </div>
              <div class="col-lg-6 agence-form-map-col">
                <p class="small text-muted mb-2">Cliquez sur la carte pour positionner l’agence.</p>
                <div class="agency-map">
                  <app-geo-map
                    [points]="mapPoints()"
                    [pickMode]="true"
                    [staticPin]="true"
                    [compactChrome]="true"
                    [pinIconUrl]="faviconUrl()"
                    [pinLabel]="mapLabel()"
                    height="100%"
                    (locationPick)="onMapPick($event)"
                  />
                </div>
              </div>
            </div>
            <div class="d-flex justify-content-end gap-2 mt-4 pt-2 border-top">
              <button type="button" class="btn btn-outline-secondary btn-sm" (click)="cancel.emit()" [disabled]="saving">Annuler</button>
              <button type="submit" class="btn btn-primary btn-sm" [disabled]="saving">
                {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    @if (confirmLatLngOpen()) {
      <div class="parametrages-modal-backdrop" style="z-index: 1060">
        <div class="parametrages-modal card shadow-lg" style="width: min(100%, 28rem)" (click)="$event.stopPropagation()">
          <div class="card-header parametrages-modal__header">
            <h2 class="h6 mb-0">Confirmer la position</h2>
          </div>
          <div class="card-body">
            <p class="mb-2">Les coordonnées vont être modifiées :</p>
            <p class="small font-monospace mb-3">
              {{ pendingLat() | number: '1.5-6' }}, {{ pendingLng() | number: '1.5-6' }}
            </p>
            <div class="d-flex justify-content-end gap-2">
              <button type="button" class="btn btn-outline-secondary btn-sm" (click)="rejectLatLng()">Annuler</button>
              <button type="button" class="btn btn-primary btn-sm" (click)="acceptLatLng()">Confirmer</button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .agence-form-backdrop {
      z-index: 1055;
    }
    .agence-form-modal {
      width: min(100%, 64rem);
      max-height: min(94vh, 52rem);
    }
    .agence-form-grid {
      align-items: stretch;
    }
    .agence-form-map-col {
      display: flex;
      flex-direction: column;
      min-height: 36rem;
    }
    .agency-map {
      flex: 1 1 auto;
      width: 100%;
      min-height: 36rem;
      border: 1px solid var(--card-border, #e5e7eb);
      border-radius: 0.75rem;
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .agency-map ::ng-deep app-geo-map,
    .agency-map ::ng-deep .geo-map-shell,
    .agency-map ::ng-deep .geo-map-host {
      width: 100%;
      flex: 1 1 auto;
      height: 100% !important;
      min-height: 36rem;
    }
  `,
})
export class AgenceFormModalComponent implements OnChanges {
  private readonly appSettings = inject(AppSettingsService);

  @Input() open = false;
  @Input() saving = false;
  @Input() editingId: number | null = null;
  @Input() agency: AgenceAdmin | null = null;
  @Input() regions: PilotageReseauRef[] = [];
  @Input() zones: PilotageReseauRef[] = [];
  @Input() categories: string[] = [];
  @Output() cancel = new EventEmitter<void>();
  @Output() save = new EventEmitter<AgenceAdminInput>();
  @Output() regionChange = new EventEmitter<number | null>();

  form: AgenceFormModel = this.emptyForm();
  private initialLat: number | null = null;
  private initialLng: number | null = null;

  readonly confirmLatLngOpen = signal(false);
  readonly pendingLat = signal<number | null>(null);
  readonly pendingLng = signal<number | null>(null);

  readonly faviconUrl = computed(
    () => this.appSettings.settings().favicon || '/branding/logo-light1.png'
  );

  mapLabel(): string {
    return (this.form.nom || this.form.code_agence || '').trim();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] || changes['agency'] || changes['editingId']) {
      if (this.open) {
        this.form = this.agency ? this.fromAgency(this.agency) : this.emptyForm();
        this.initialLat = this.form.latitude;
        this.initialLng = this.form.longitude;
        this.confirmLatLngOpen.set(false);
      }
    }
  }

  zonesForRegion(): PilotageReseauRef[] {
    // zones already filtered by parent page for selected region when possible
    return this.zones;
  }

  onRegionChange(): void {
    this.form.zoneId = null;
    this.regionChange.emit(this.form.regionId ?? null);
  }

  mapPoints(): GeoPoint[] {
    const lat = this.form.latitude;
    const lng = this.form.longitude;
    if (lat == null || lng == null || (lat === 0 && lng === 0)) return [];
    return [
      {
        agency_id: this.editingId || 0,
        code: this.form.code_agence || '',
        label: this.form.nom || this.form.code_agence || 'Agence',
        city: this.form.ville || '',
        commune: this.form.commune || '',
        lat,
        lng,
        tx_count: 0,
        volume: 0,
        currency: 'USD',
      },
    ];
  }

  onMapPick(ev: { lat: number; lng: number }): void {
    const nextLat = Number(ev.lat);
    const nextLng = Number(ev.lng);
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return;

    const changed =
      this.editingId != null &&
      (round6(this.initialLat) !== round6(nextLat) || round6(this.initialLng) !== round6(nextLng));

    if (changed) {
      this.pendingLat.set(nextLat);
      this.pendingLng.set(nextLng);
      this.confirmLatLngOpen.set(true);
      return;
    }
    this.form.latitude = nextLat;
    this.form.longitude = nextLng;
  }

  acceptLatLng(): void {
    this.form.latitude = this.pendingLat();
    this.form.longitude = this.pendingLng();
    this.confirmLatLngOpen.set(false);
  }

  rejectLatLng(): void {
    this.confirmLatLngOpen.set(false);
    this.pendingLat.set(null);
    this.pendingLng.set(null);
  }

  submit(): void {
    if (!this.form.code_agence?.trim() || !this.form.nom?.trim()) return;
    this.save.emit({
      code_agence: this.form.code_agence.trim(),
      nom: this.form.nom.trim(),
      categorie: this.form.categorie?.trim() || '',
      pos_id: this.form.pos_id?.trim() || '',
      fp_agent: this.form.fp_agent?.trim() || '',
      ville: this.form.ville?.trim() || '',
      commune: this.form.commune?.trim() || '',
      province: this.form.province?.trim() || '',
      pays: this.form.pays?.trim() || '',
      adresse: this.form.adresse?.trim() || '',
      latitude: this.form.latitude,
      longitude: this.form.longitude,
      regionId: this.form.regionId,
      zoneId: this.form.zoneId,
      parentAgenceId: this.form.parentAgenceId || null,
    });
  }

  private emptyForm(): AgenceFormModel {
    return {
      code_agence: '',
      nom: '',
      categorie: '',
      pos_id: '',
      fp_agent: '',
      ville: '',
      commune: '',
      province: '',
      pays: '',
      adresse: '',
      latitude: null,
      longitude: null,
      regionId: null,
      zoneId: null,
      parentAgenceId: null,
    };
  }

  private fromAgency(a: AgenceAdmin): AgenceFormModel {
    return {
      code_agence: a.code_agence || '',
      nom: a.nom || '',
      categorie: a.categorie || '',
      pos_id: a.pos_id || '',
      fp_agent: a.fp_agent || '',
      ville: a.ville || '',
      commune: a.commune || '',
      province: a.province || '',
      pays: a.pays || '',
      adresse: a.adresse || '',
      latitude: a.latitude,
      longitude: a.longitude,
      regionId: a.regionId,
      zoneId: a.zoneId,
      parentAgenceId: a.parentAgenceId,
    };
  }
}

function round6(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.round(n * 1e6) / 1e6;
}
