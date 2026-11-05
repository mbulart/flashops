import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Commune, Pays, Province, Territoire, Ville } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { GeoReferentielService } from '../../core/services/geo-referentiel.service';
import { ToastService } from '../../core/services/toast.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { ParametragesReferentielsZonesComponent } from './parametrages-referentiels-zones.component';

type GeoTab = 'pays' | 'provinces' | 'villes' | 'communes' | 'territoires';
type RefTab = GeoTab | 'regions' | 'responsables_zone' | 'zones';

@Component({
  selector: 'app-parametrages-referentiels',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SectionCardComponent,
    SkeletonComponent,
    EmptyStateComponent,
    ParametragesReferentielsZonesComponent,
  ],
  template: `
    <nav class="parametrages-inner-nav nav" aria-label="Référentiels">
      @for (t of tabs; track t.key) {
        <button type="button" class="nav-link" [class.active]="tab() === t.key" (click)="selectTab(t.key)">
          {{ t.label }}
        </button>
      }
    </nav>

    @if (isGeoTab() && tab() !== 'pays') {
      <div class="row g-2 mb-3 align-items-end">
        <div class="col-md-4">
          <label class="form-label small mb-1" for="ref-pays">Pays</label>
          <select
            id="ref-pays"
            class="form-select form-select-sm"
            [ngModel]="selectedPaysId()"
            (ngModelChange)="onPaysChange($event)"
          >
            <option [ngValue]="null">— Sélectionner —</option>
            @for (p of pays(); track p.id) {
              <option [ngValue]="p.id">{{ p.libelle }} ({{ p.code_iso }})</option>
            }
          </select>
        </div>
        @if (needsProvince()) {
          <div class="col-md-4">
            <label class="form-label small mb-1" for="ref-province">Province</label>
            <select
              id="ref-province"
              class="form-select form-select-sm"
              [disabled]="!selectedPaysId()"
              [ngModel]="selectedProvinceId()"
              (ngModelChange)="onProvinceChange($event)"
            >
              <option [ngValue]="null">— Sélectionner —</option>
              @for (pr of provinces(); track pr.id) {
                <option [ngValue]="pr.id">{{ pr.libelle }}</option>
              }
            </select>
          </div>
        }
        @if (canLoadLocalSeed()) {
          <div class="col-md-4 text-md-end d-flex gap-2 justify-content-md-end flex-wrap">
            <button
              type="button"
              class="btn btn-primary btn-sm"
              [disabled]="syncing() || !selectedPaysCode()"
              (click)="loadLocalSeedForCountry(false)"
            >
              @if (syncing()) {
                <span class="spinner-border spinner-border-sm me-1"></span>
              }
              Charger le seed local
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm"
              [disabled]="syncing() || !selectedPaysCode()"
              (click)="loadLocalSeedForCountry(true)"
              title="Réécrit les données depuis le fichier JSON"
            >
              Forcer
            </button>
          </div>
        }
      </div>
    }

    @if (tab() === 'regions' || tab() === 'responsables_zone' || tab() === 'zones') {
      <app-parametrages-referentiels-zones [mode]="networkMode()" />
    } @else {
    <app-section-card [title]="cardTitle()" [noPadding]="true">
      @if (tab() === 'pays' && canSync()) {
        <div class="p-3 border-bottom d-flex justify-content-end gap-2 flex-wrap">
          <button type="button" class="btn btn-primary btn-sm" [disabled]="syncing()" (click)="loadAllLocalSeeds()">
            @if (syncing()) {
              <span class="spinner-border spinner-border-sm me-1"></span>
            }
            Charger les seeds locaux (pays vides)
          </button>
          <button type="button" class="btn btn-outline-secondary btn-sm" [disabled]="syncing()" (click)="syncPays()">
            Actualiser la liste des pays (JSON)
          </button>
        </div>
      }

      @if (loading()) {
        <app-skeleton type="table" [rows]="6" [cols]="columnCount()" />
      } @else if (!hasRows()) {
        <app-empty-state [title]="emptyMessage()" />
      } @else {
        <div class="parametrages-table-scroll">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                @for (col of columns(); track col.key) {
                  <th>{{ col.label }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track trackRow(row)) {
                <tr>
                  @for (col of columns(); track col.key) {
                    <td>{{ cell($any(row), col.key) }}</td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </app-section-card>
    }
  `,
})
export class ParametragesReferentielsPageComponent {
  private readonly geo = inject(GeoReferentielService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly tab = signal<RefTab>('pays');
  readonly loading = signal(false);
  readonly syncing = signal(false);

  readonly pays = signal<Pays[]>([]);
  readonly provinces = signal<Province[]>([]);
  readonly villes = signal<Ville[]>([]);
  readonly territoires = signal<Territoire[]>([]);
  readonly communes = signal<Commune[]>([]);

  readonly selectedPaysId = signal<number | null>(null);
  readonly selectedProvinceId = signal<number | null>(null);

  readonly tabs: { key: RefTab; label: string }[] = [
    { key: 'pays', label: 'Pays' },
    { key: 'provinces', label: 'Provinces' },
    { key: 'villes', label: 'Villes' },
    { key: 'communes', label: 'Communes' },
    { key: 'territoires', label: 'Territoires' },
    { key: 'regions', label: 'Régions' },
    { key: 'zones', label: 'Zones' },
    { key: 'responsables_zone', label: 'Responsables zone' },
  ];

  readonly selectedPaysCode = computed(() => {
    const id = this.selectedPaysId();
    if (id == null) return null;
    return this.pays().find((p) => p.id === id)?.code_iso ?? null;
  });

  readonly columns = computed(() => {
    switch (this.tab()) {
      case 'pays':
        return [
          { key: 'code_iso', label: 'Code ISO' },
          { key: 'libelle', label: 'Libellé' },
          { key: 'geoname_id', label: 'GeoNames ID' },
          { key: 'actif', label: 'Actif' },
        ];
      case 'provinces':
        return [
          { key: 'code', label: 'Code' },
          { key: 'libelle', label: 'Libellé' },
          { key: 'geoname_id', label: 'GeoNames ID' },
          { key: 'ordre_tri', label: 'Ordre' },
        ];
      case 'villes':
      case 'territoires':
        return [
          { key: 'code', label: 'Code' },
          { key: 'libelle', label: 'Libellé' },
          { key: 'geoname_id', label: 'GeoNames ID' },
        ];
      case 'communes':
        return [
          { key: 'code', label: 'Code' },
          { key: 'libelle', label: 'Libellé' },
          { key: 'ville_id', label: 'Ville ID' },
          { key: 'territoire_id', label: 'Territoire ID' },
          { key: 'geoname_id', label: 'GeoNames ID' },
        ];
      default:
        return [];
    }
  });

  readonly rows = computed(() => {
    switch (this.tab()) {
      case 'pays':
        return this.pays();
      case 'provinces':
        return this.provinces();
      case 'villes':
        return this.villes();
      case 'territoires':
        return this.territoires();
      case 'communes':
        return this.communes();
      default:
        return [];
    }
  });

  constructor() {
    void this.loadPays();
  }

  canSync(): boolean {
    return this.auth.can('referentiels.geo.synchroniser');
  }

  canLoadLocalSeed(): boolean {
    return this.tab() === 'provinces' && this.canSync();
  }

  needsProvince(): boolean {
    const t = this.tab();
    return t === 'villes' || t === 'communes' || t === 'territoires';
  }

  cardTitle(): string {
    return this.tabs.find((t) => t.key === this.tab())?.label ?? 'Référentiels';
  }

  columnCount(): number {
    return this.columns().length;
  }

  hasRows(): boolean {
    return this.rows().length > 0;
  }

  emptyMessage(): string {
    if (this.tab() === 'pays') {
      return 'Aucun pays. Lancez la synchronisation ou redémarrez l’API pour le seed JSON.';
    }
    if (!this.selectedPaysId()) {
      return 'Sélectionnez un pays.';
    }
    if (this.needsProvince() && !this.selectedProvinceId()) {
      return 'Sélectionnez une province.';
    }
    return 'Aucune entrée. Synchronisez le pays via GeoNames.';
  }

  isGeoTab(): boolean {
    const t = this.tab();
    return t !== 'responsables_zone' && t !== 'zones' && t !== 'regions';
  }

  networkMode(): 'regions' | 'responsables_zone' | 'zones' {
    const t = this.tab();
    if (t === 'regions' || t === 'responsables_zone') return t;
    return 'zones';
  }

  selectTab(key: RefTab): void {
    this.tab.set(key);
    if (this.isGeoTab()) {
      void this.reloadTab();
    }
  }

  onPaysChange(id: number | null): void {
    this.selectedPaysId.set(id);
    this.selectedProvinceId.set(null);
    this.provinces.set([]);
    this.villes.set([]);
    this.territoires.set([]);
    this.communes.set([]);
    if (id != null) {
      void this.loadProvinces(id);
      if (this.tab() === 'provinces') {
        return;
      }
    }
    void this.reloadTab();
  }

  onProvinceChange(id: number | null): void {
    this.selectedProvinceId.set(id);
    this.villes.set([]);
    this.territoires.set([]);
    this.communes.set([]);
    void this.reloadTab();
  }

  trackRow(row: Pays | Province | Ville | Territoire | Commune): string | number {
    return 'id' in row ? row.id : JSON.stringify(row);
  }

  cell(row: Record<string, unknown>, key: string): string {
    const v = row[key];
    if (v == null || v === '') return '—';
    if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
    return String(v);
  }

  async syncPays(): Promise<void> {
    this.syncing.set(true);
    try {
      const res = await firstValueFrom(this.geo.syncPaysList());
      this.toast.success(`Pays synchronisés (${res.pays}).`);
      await this.loadPays();
    } catch (err) {
      this.toast.error(this.syncErrorMessage(err, 'Échec de la synchronisation des pays.'));
    } finally {
      this.syncing.set(false);
    }
  }

  async loadLocalSeedForCountry(force: boolean): Promise<void> {
    const code = this.selectedPaysCode();
    if (!code) return;
    this.syncing.set(true);
    try {
      const res = await firstValueFrom(this.geo.seedLocalCountry(code, force));
      if (res.skipped) {
        this.toast.info(`Seed ${code} déjà présent (utilisez Forcer pour réimporter).`);
      } else {
        this.toast.success(
          `Seed ${code} : ${res.provinces} provinces, ${res.villes} villes, ${res.territoires} territoires, ${res.communes} communes.`
        );
      }
      const paysId = this.selectedPaysId();
      if (paysId != null) {
        await this.loadProvinces(paysId);
      }
      await this.reloadTab();
    } catch (err) {
      this.toast.error(this.syncErrorMessage(err, `Aucun seed local pour ${code} ou erreur serveur.`));
    } finally {
      this.syncing.set(false);
    }
  }

  async loadAllLocalSeeds(): Promise<void> {
    this.syncing.set(true);
    try {
      const res = await firstValueFrom(this.geo.seedAllLocalMissing());
      if (res.skipped) {
        this.toast.info('Seeds locaux déjà chargés pour les pays concernés.');
      } else {
        this.toast.success(
          `Seeds : ${res.provinces} provinces, ${res.villes} villes, ${res.territoires} territoires, ${res.communes} communes.`
        );
      }
      await this.loadPays();
    } catch (err) {
      this.toast.error(this.syncErrorMessage(err, 'Impossible de charger les seeds locaux.'));
    } finally {
      this.syncing.set(false);
    }
  }

  private syncErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error;
      if (body && typeof body === 'object' && 'error' in body && body.error) {
        return String(body.error);
      }
      if (err.status === 503) {
        return 'GEONAMES_USERNAME non configuré sur le serveur (backend/.env).';
      }
    }
    return fallback;
  }

  private async loadPays(): Promise<void> {
    this.loading.set(true);
    try {
      this.pays.set(await firstValueFrom(this.geo.listPays()));
    } catch {
      this.toast.error('Impossible de charger les pays.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadProvinces(paysId: number): Promise<void> {
    this.loading.set(true);
    try {
      this.provinces.set(await firstValueFrom(this.geo.listProvinces(paysId)));
    } catch {
      this.toast.error('Impossible de charger les provinces.');
    } finally {
      this.loading.set(false);
    }
  }

  private async reloadTab(): Promise<void> {
    const t = this.tab();
    const paysId = this.selectedPaysId();
    const provinceId = this.selectedProvinceId();

    if (t === 'pays') {
      await this.loadPays();
      return;
    }
    if (paysId == null) {
      return;
    }
    if (t === 'provinces') {
      await this.loadProvinces(paysId);
      return;
    }
    if (provinceId == null) {
      return;
    }

    this.loading.set(true);
    try {
      if (t === 'villes') {
        this.villes.set(await firstValueFrom(this.geo.listVilles(provinceId)));
      } else if (t === 'territoires') {
        this.territoires.set(await firstValueFrom(this.geo.listTerritoires(provinceId)));
      } else if (t === 'communes') {
        this.communes.set(await firstValueFrom(this.geo.listCommunes({ provinceId })));
      }
    } catch {
      this.toast.error('Impossible de charger les données.');
    } finally {
      this.loading.set(false);
    }
  }
}
