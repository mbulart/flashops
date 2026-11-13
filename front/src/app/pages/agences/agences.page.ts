import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AgenceAdmin, AgenceAdminFilters, AgenceAdminInput } from '../../core/models/agences.models';
import { PilotageReseauRef } from '../../core/models/pilotage.models';
import { AgencesService } from '../../core/services/agences.service';
import { AuthService } from '../../core/services/auth.service';
import { PilotageService } from '../../core/services/pilotage.service';
import { ToastService } from '../../core/services/toast.service';
import { FilterPanelComponent } from '../../shared/components/filter-panel/filter-panel.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { exportExcel } from '../../shared/utils/format.utils';
import { TableActionsMenuComponent } from '../parametrages/components/table-actions-menu.component';
import { AgenceFormModalComponent } from './components/agence-form-modal.component';

@Component({
  selector: 'app-agences-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    FilterPanelComponent,
    SectionCardComponent,
    SkeletonComponent,
    TableActionsMenuComponent,
    AgenceFormModalComponent,
  ],
  template: `
    <app-page-header title="Agences" />

    <app-filter-panel title="Filtres" [expanded]="true">
      <div class="agences-filters">
        <div class="agences-filter-row">
          <div class="filter-field filter-field--search">
            <label class="form-label" for="ag-q">Recherche</label>
            <input
              id="ag-q"
              type="search"
              class="form-control form-control-sm"
              [(ngModel)]="draftQ"
              placeholder="Nom, code, ville…"
              (keydown.enter)="$event.preventDefault(); applyFilters()"
            />
          </div>
          <div class="filter-field">
            <label class="form-label" for="ag-ident">Identifiant</label>
            <input
              id="ag-ident"
              type="search"
              class="form-control form-control-sm"
              [(ngModel)]="draftIdentifiant"
              placeholder="ID, code, POS, FP"
              (keydown.enter)="$event.preventDefault(); applyFilters()"
            />
          </div>
          <div class="filter-field">
            <label class="form-label" for="ag-activity">Activité</label>
            <select id="ag-activity" class="form-select form-select-sm" [(ngModel)]="draftActivityDays">
              <option [ngValue]="null">Toutes</option>
              <option [ngValue]="30">≤ 30 jours</option>
              <option [ngValue]="60">≤ 60 jours</option>
              <option [ngValue]="90">≤ 90 jours</option>
            </select>
          </div>
          <div class="filter-field">
            <label class="form-label" for="ag-statut">Statut</label>
            <select id="ag-statut" class="form-select form-select-sm" [(ngModel)]="draftStatutActivite">
              <option value="">Tous</option>
              <option value="Nouveau">Nouveau</option>
              <option value="Actif">Actif</option>
              <option value="Inactif">Inactif</option>
            </select>
          </div>
          <div class="filter-field">
            <label class="form-label" for="ag-coords">Géoloc.</label>
            <select id="ag-coords" class="form-select form-select-sm" [(ngModel)]="draftSansCoords">
              <option [ngValue]="false">Toutes</option>
              <option [ngValue]="true">Sans lat/long</option>
            </select>
          </div>
        </div>

        <div class="agences-filter-row">
          <div class="filter-field">
            <label class="form-label" for="ag-f-region">Région</label>
            <select id="ag-f-region" class="form-select form-select-sm" [(ngModel)]="draftRegionId" (ngModelChange)="onFilterRegionChange()">
              <option [ngValue]="null">Toutes</option>
              @for (r of regions(); track r.id) {
                <option [ngValue]="r.id">{{ r.libelle }}</option>
              }
            </select>
          </div>
          <div class="filter-field">
            <label class="form-label" for="ag-f-zone">Zone</label>
            <select id="ag-f-zone" class="form-select form-select-sm" [(ngModel)]="draftZoneId">
              <option [ngValue]="null">Toutes</option>
              @for (z of filterZones(); track z.id) {
                <option [ngValue]="z.id">{{ z.libelle }}</option>
              }
            </select>
          </div>
          <div class="filter-field">
            <label class="form-label" for="ag-f-ville">Ville</label>
            <input id="ag-f-ville" class="form-control form-control-sm" [(ngModel)]="draftVille" />
          </div>
          <div class="filter-field">
            <label class="form-label" for="ag-f-commune">Commune</label>
            <input id="ag-f-commune" class="form-control form-control-sm" [(ngModel)]="draftCommune" />
          </div>
          <div class="filter-field">
            <label class="form-label" for="ag-f-cat">Catégorie</label>
            <select id="ag-f-cat" class="form-select form-select-sm" [(ngModel)]="draftCategorie">
              <option value="">Toutes</option>
              @for (c of categories(); track c) {
                <option [value]="c">{{ c }}</option>
              }
            </select>
          </div>
          <div class="filter-field filter-field--actions">
            <label class="form-label" aria-hidden="true">&nbsp;</label>
            <div class="agences-filters-actions">
              <button type="button" class="btn btn-outline-secondary btn-sm" (click)="resetFilters()">Réinit.</button>
              <button type="button" class="btn btn-primary btn-sm" (click)="applyFilters()">
                <i class="bi bi-search me-1"></i>Appliquer
              </button>
            </div>
          </div>
        </div>
      </div>
    </app-filter-panel>

    <app-section-card [title]="tableTitle()" [subtitle]="tableSubtitle()" [noPadding]="true">
      <div actions class="agences-table-actions">
        @if (auth.can('agences.ecrire')) {
          <button type="button" class="btn btn-primary btn-sm" (click)="openCreate()">
            <i class="bi bi-plus-lg me-1"></i>Ajouter
          </button>
        }
        <button type="button" class="btn btn-outline-dark btn-sm" [disabled]="exporting() || loading()" (click)="exportRows()">
          <i class="bi bi-download me-1"></i>{{ exporting() ? 'Export…' : 'Exporter' }}
        </button>
        <select class="form-select form-select-sm agences-page-size" [ngModel]="pageSize()" (ngModelChange)="setPageSize($event)">
          @for (s of pageSizes; track s) {
            <option [ngValue]="s">{{ s }} / page</option>
          }
        </select>
      </div>

      @if (loading()) {
        <div class="p-3">
          <app-skeleton type="table" [rows]="8" [cols]="7" />
        </div>
      } @else {
        <div class="parametrages-table-scroll">
          <table class="table table-hover table-sm align-middle mb-0 agences-table">
            <thead>
              <tr>
                <th>Agence</th>
                <th>Identifiants</th>
                <th>Réseau</th>
                <th>Localisation</th>
                <th>Statut</th>
                <th>Dernière tx</th>
                <th>Mère</th>
                @if (auth.can('agences.ecrire')) {
                  <th class="text-end" style="width: 2.75rem"></th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.agenceId) {
                <tr>
                  <td>
                    <div class="agences-cell-primary">{{ row.nom || '—' }}</div>
                    <div class="agences-cell-muted">{{ row.categorie || '—' }}</div>
                  </td>
                  <td>
                    <div class="agences-cell-primary">
                      <span class="text-muted">ID</span> {{ row.agenceId }}
                      <span class="font-monospace"> · {{ row.code_agence || '—' }}</span>
                    </div>
                    @if (row.pos_id) {
                      <div class="agences-cell-muted">FP {{ row.pos_id }}</div>
                    }
                  </td>
                  <td>
                    <div class="agences-cell-primary">{{ row.region || '—' }}</div>
                    <div class="agences-cell-muted">
                      {{ row.zone || '—' }}
                      @if (row.responsable_zone) {
                        <span> · RZ {{ row.responsable_zone }}</span>
                      }
                    </div>
                  </td>
                  <td>
                    <div class="agences-cell-primary">
                      {{ row.ville || '—' }}{{ row.commune ? ' · ' + row.commune : '' }}
                    </div>
                    <div class="agences-cell-muted font-monospace">{{ coordsLabel(row) }}</div>
                  </td>
                  <td>
                    <span class="badge rounded-pill agence-statut" [class]="statutBadgeClass(row.statut_activite)">
                      {{ row.statut_activite || 'Inactif' }}
                    </span>
                  </td>
                  <td class="text-nowrap">{{ formatJour(row.derniere_transaction) }}</td>
                  <td>
                    @if (row.parentAgenceId) {
                      <div class="agences-cell-primary">{{ row.mere_nom || row.mere_code || row.parentAgenceId }}</div>
                      @if (row.mere_code) {
                        <div class="agences-cell-muted font-monospace">{{ row.mere_code }}</div>
                      }
                    } @else {
                      —
                    }
                  </td>
                  @if (auth.can('agences.ecrire')) {
                    <td class="text-end">
                      <app-table-actions-menu #rowMenu>
                        <button type="button" class="table-actions-menu__item" (click)="openEdit(row); rowMenu.close()">
                          <i class="bi bi-pencil"></i>
                          Modifier
                        </button>
                      </app-table-actions-menu>
                    </td>
                  }
                </tr>
              } @empty {
                <tr>
                  <td [attr.colspan]="auth.can('agences.ecrire') ? 8 : 7" class="text-center text-muted py-3">
                    Aucune agence pour ces filtres.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (total() > 0) {
          <div class="agences-pager">
            <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="page() <= 1" (click)="go(1)">«</button>
            <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="page() <= 1" (click)="go(page() - 1)">Précédent</button>
            <span>{{ rangeLabel() }}</span>
            <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="page() >= pageCount()" (click)="go(page() + 1)">Suivant</button>
            <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="page() >= pageCount()" (click)="go(pageCount())">»</button>
          </div>
        }
      }
    </app-section-card>

    <app-agence-form-modal
      [open]="editorOpen()"
      [saving]="saving()"
      [editingId]="editingId()"
      [agency]="editingAgency()"
      [regions]="regions()"
      [zones]="editorZones()"
      [categories]="categories()"
      (cancel)="closeEditor()"
      (save)="saveAgency($event)"
      (regionChange)="loadZones($event)"
    />
  `,
  styles: `
    .agences-filters {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
    }
    .agences-filter-row {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 0.45rem 0.65rem;
      align-items: end;
    }
    .agences-filter-row .filter-field--search {
      grid-column: span 2;
    }
    @media (max-width: 1199.98px) {
      .agences-filter-row {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .agences-filter-row .filter-field--search {
        grid-column: span 1;
      }
    }
    @media (max-width: 767.98px) {
      .agences-filter-row {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .agences-filter-row .filter-field--search,
      .agences-filter-row .filter-field--actions {
        grid-column: 1 / -1;
      }
    }
    .agences-filters .filter-field {
      min-width: 0;
    }
    .agences-filters .form-label {
      margin-bottom: 0.15rem;
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.01em;
      color: var(--text-muted, #6b7280);
    }
    .agences-filters-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
    .agences-table-actions {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
    .agences-page-size {
      width: auto;
      min-width: 7rem;
    }
    .agences-pager {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.4rem;
      padding: 0.55rem 0.85rem;
      border-top: 1px solid var(--card-border, #e5e7eb);
      font-size: 0.8rem;
      color: var(--text-muted, #6b7280);
    }
    .agences-table {
      font-size: 0.8125rem;
      --bs-table-cell-padding-y: 0.28rem;
      --bs-table-cell-padding-x: 0.55rem;
    }
    .agences-table thead th {
      font-size: 0.72rem;
      font-weight: 650;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      color: var(--text-muted, #6b7280);
      white-space: nowrap;
      padding-top: 0.4rem;
      padding-bottom: 0.4rem;
      vertical-align: middle;
    }
    .agences-table tbody td {
      padding-top: 0.28rem;
      padding-bottom: 0.28rem;
      line-height: 1.25;
      vertical-align: middle;
    }
    .agences-cell-primary {
      font-weight: 600;
      line-height: 1.25;
    }
    .agences-cell-muted {
      color: var(--text-muted, #6b7280);
      font-size: 0.74rem;
      line-height: 1.2;
      margin-top: 0.05rem;
    }
    .agence-statut {
      font-weight: 600;
      font-size: 0.68rem;
      letter-spacing: 0.01em;
      padding: 0.18em 0.55em;
      line-height: 1.2;
    }
    .agence-statut--nouveau {
      background: #dbeafe;
      color: #1d4ed8;
    }
    .agence-statut--actif {
      background: #dcfce7;
      color: #15803d;
    }
    .agence-statut--inactif {
      background: #f3f4f6;
      color: #6b7280;
    }
  `,
})
export class AgencesPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly agencesApi = inject(AgencesService);
  private readonly pilotage = inject(PilotageService);
  private readonly toast = inject(ToastService);

  readonly pageSizes = [25, 50, 100];

  draftActivityDays: number | null = null;
  draftStatutActivite = '';
  draftSansCoords = false;
  draftIdentifiant = '';
  draftQ = '';
  draftRegionId: number | null = null;
  draftZoneId: number | null = null;
  draftVille = '';
  draftCommune = '';
  draftCategorie = '';

  readonly statutActiviteBadgeColors = {
    Nouveau: { bg: 'FFDBEAFE', fg: 'FF1D4ED8' },
    Actif: { bg: 'FFDCFCE7', fg: 'FF15803D' },
    Inactif: { bg: 'FFF3F4F6', fg: 'FF6B7280' },
  } as const;

  private applied: AgenceAdminFilters = { page: 1, size: 25 };

  readonly loading = signal(true);
  readonly exporting = signal(false);
  readonly saving = signal(false);
  readonly rows = signal<AgenceAdmin[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(25);
  readonly regions = signal<PilotageReseauRef[]>([]);
  readonly zones = signal<PilotageReseauRef[]>([]);
  readonly categories = signal<string[]>([]);

  readonly editorOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly editingAgency = signal<AgenceAdmin | null>(null);

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  readonly editorZones = computed(() => {
    const regionId = this.editingAgency()?.regionId ?? null;
    // zones signal holds current filter region zones; reload on open via loadZonesForEditor
    return this.zones();
  });

  ngOnInit(): void {
    this.pilotage.listReseauRegions().subscribe({
      next: (rows) => this.regions.set(rows ?? []),
      error: () => this.regions.set([]),
    });
    this.agencesApi.categories().subscribe({
      next: (rows) => this.categories.set(rows ?? []),
      error: () => this.categories.set([]),
    });
    this.loadZones(null);
    this.applyFilters();
  }

  tableTitle(): string {
    return 'Registre des agences';
  }

  tableSubtitle(): string {
    const n = this.total();
    return n ? `${n.toLocaleString('fr-FR')} agence(s)` : 'Filtrez puis appliquez';
  }

  filterZones(): PilotageReseauRef[] {
    return this.zones();
  }

  onFilterRegionChange(): void {
    this.draftZoneId = null;
    this.loadZones(this.draftRegionId);
  }

  resetFilters(): void {
    this.draftActivityDays = null;
    this.draftStatutActivite = '';
    this.draftSansCoords = false;
    this.draftIdentifiant = '';
    this.draftQ = '';
    this.draftRegionId = null;
    this.draftZoneId = null;
    this.draftVille = '';
    this.draftCommune = '';
    this.draftCategorie = '';
    this.loadZones(null);
    this.applyFilters();
  }

  applyFilters(): void {
    this.page.set(1);
    this.applied = this.buildFilters(1);
    this.reload();
  }

  setPageSize(size: number): void {
    const next = Number(size);
    if (!this.pageSizes.includes(next)) return;
    this.pageSize.set(next);
    this.page.set(1);
    this.applied = { ...this.applied, page: 1, size: next };
    this.reload();
  }

  go(page: number): void {
    const next = Math.min(this.pageCount(), Math.max(1, page));
    if (next === this.page()) return;
    this.page.set(next);
    this.applied = { ...this.applied, page: next };
    this.reload();
  }

  rangeLabel(): string {
    const total = this.total();
    if (!total) return '0';
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end = Math.min(total, this.page() * this.pageSize());
    return `${start}–${end} / ${total.toLocaleString('fr-FR')}`;
  }

  coordsLabel(row: AgenceAdmin): string {
    if (row.latitude == null || row.longitude == null) return '—';
    if (Number(row.latitude) === 0 && Number(row.longitude) === 0) return '—';
    return `${Number(row.latitude).toFixed(5)}, ${Number(row.longitude).toFixed(5)}`;
  }

  statutBadgeClass(statut: string | null | undefined): string {
    const s = (statut || 'Inactif').trim().toLowerCase();
    if (s === 'nouveau') return 'agence-statut--nouveau';
    if (s === 'actif') return 'agence-statut--actif';
    return 'agence-statut--inactif';
  }

  openCreate(): void {
    this.editingId.set(null);
    this.editingAgency.set(null);
    this.loadZones(null);
    this.editorOpen.set(true);
  }

  openEdit(row: AgenceAdmin): void {
    this.editingId.set(row.agenceId);
    this.editingAgency.set(row);
    this.loadZones(row.regionId);
    this.editorOpen.set(true);
  }

  closeEditor(): void {
    this.editorOpen.set(false);
    this.editingId.set(null);
    this.editingAgency.set(null);
  }

  async saveAgency(body: AgenceAdminInput): Promise<void> {
    this.saving.set(true);
    try {
      const id = this.editingId();
      if (id) await firstValueFrom(this.agencesApi.update(id, body));
      else await firstValueFrom(this.agencesApi.create(body));
      this.toast.success(id ? 'Agence mise à jour.' : 'Agence créée.');
      this.closeEditor();
      this.reload();
      this.agencesApi.categories().subscribe({ next: (c) => this.categories.set(c ?? []) });
    } catch {
      this.toast.error('Enregistrement impossible.');
    } finally {
      this.saving.set(false);
    }
  }

  async exportRows(): Promise<void> {
    this.exporting.set(true);
    try {
      const rows = await firstValueFrom(this.agencesApi.export({ ...this.applied, page: 1, size: 50_000 }));
      await exportExcel({
        filename: `agences-${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheets: [
          {
            name: 'Agences',
            columns: [
              { label: 'agence_id', key: 'agenceId' },
              { label: 'code_agence', key: 'code_agence' },
              { label: 'nom', key: 'nom' },
              { label: 'categorie', key: 'categorie' },
              { label: 'pos_id (FP)', key: 'pos_id' },
              { label: 'fp_agent', key: 'fp_agent' },
              { label: 'region', key: 'region' },
              { label: 'zone', key: 'zone' },
              { label: 'RZ', key: 'responsable_zone' },
              { label: 'ville', key: 'ville' },
              { label: 'commune', key: 'commune' },
              { label: 'province', key: 'province' },
              { label: 'pays', key: 'pays' },
              { label: 'adresse', key: 'adresse' },
              { label: 'latitude', key: 'latitude' },
              { label: 'longitude', key: 'longitude' },
              { label: 'premiere_transaction', key: 'premiere_transaction' },
              { label: 'derniere_transaction', key: 'derniere_transaction' },
              {
                label: 'statut_activite',
                key: 'statut_activite',
                badgeColors: { ...this.statutActiviteBadgeColors },
              },
              { label: 'agence_mere_id', key: 'parentAgenceId' },
              { label: 'agence_mere_code', key: 'mere_code' },
              { label: 'agence_mere_nom', key: 'mere_nom' },
            ],
            rows: rows.map((r) => ({
              ...r,
              statut_activite: r.statut_activite || 'Inactif',
            })),
          },
        ],
      });
      this.toast.success(`${rows.length.toLocaleString('fr-FR')} ligne(s) exportée(s).`);
    } catch {
      this.toast.error('Export impossible.');
    } finally {
      this.exporting.set(false);
    }
  }

  private buildFilters(page: number): AgenceAdminFilters {
    return {
      q: this.draftQ.trim() || undefined,
      identifiant: this.draftIdentifiant.trim() || undefined,
      region_id: this.draftRegionId,
      zone_id: this.draftZoneId,
      ville: this.draftVille.trim() || undefined,
      commune: this.draftCommune.trim() || undefined,
      categorie: this.draftCategorie.trim() || undefined,
      activity_days: this.draftActivityDays,
      statut_activite: this.draftStatutActivite.trim()
        ? [this.draftStatutActivite.trim()]
        : undefined,
      sans_coords: this.draftSansCoords || undefined,
      page,
      size: this.pageSize(),
    };
  }

  private reload(): void {
    this.loading.set(true);
    this.agencesApi.list(this.applied).subscribe({
      next: (page) => {
        this.rows.set(page.items ?? []);
        this.total.set(page.total ?? 0);
        this.page.set(page.page ?? 1);
        this.pageSize.set(page.size ?? this.pageSize());
        this.loading.set(false);
      },
      error: () => {
        this.rows.set([]);
        this.total.set(0);
        this.loading.set(false);
        this.toast.error('Chargement des agences impossible.');
      },
    });
  }

  formatJour(value: string | null | undefined): string {
    if (!value) return '—';
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!match) return value;
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  loadZones(regionId: number | null): void {
    const labels =
      regionId == null
        ? []
        : this.regions()
            .filter((r) => r.id === regionId)
            .map((r) => r.libelle);
    this.pilotage.listReseauZones(labels).subscribe({
      next: (rows) => this.zones.set(rows ?? []),
      error: () => this.zones.set([]),
    });
  }
}
