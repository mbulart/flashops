import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  AgenceAdmin,
  AgenceAdminFilters,
  AgenceAdminInput,
  DEFAULT_AGENCE_CATEGORIES,
} from '../../core/models/agences.models';
import {
  PilotageAgenceRank,
  PilotageCriteria,
  PilotageDomaine,
  PilotageDomaineOption,
  PilotageReseauRef,
} from '../../core/models/pilotage.models';
import { AgencesService } from '../../core/services/agences.service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { AuthService } from '../../core/services/auth.service';
import { PilotageService } from '../../core/services/pilotage.service';
import { ToastService } from '../../core/services/toast.service';
import { FilterPanelComponent } from '../../shared/components/filter-panel/filter-panel.component';
import {
  MultiSelectComponent,
  MultiSelectOption,
} from '../../shared/components/multi-select/multi-select.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { exportExcel, periodPresetRange } from '../../shared/utils/format.utils';
import { TableActionsMenuComponent } from '../parametrages/components/table-actions-menu.component';
import { PilotageAgencyModalComponent } from '../pilotage/components/pilotage-agency-modal.component';
import { pilotageCategoryOptionId } from '../pilotage/pilotage-filtres.config';
import { downloadPilotageAgencesPeriodiqueExcel } from '../pilotage/pilotage-agences-periodique.export';
import { downloadPilotageAgencesProduitsPeriodiqueExcel } from '../pilotage/pilotage-agences-produits-periodique.export';
import { buildPilotageReportIdentity } from '../pilotage/pilotage-report-identity';
import { AgenceFormModalComponent } from './components/agence-form-modal.component';

const STATUT_OPTIONS: MultiSelectOption[] = [
  { id: pilotageCategoryOptionId('statut:Nouveau'), label: 'Nouveau' },
  { id: pilotageCategoryOptionId('statut:Actif'), label: 'Actif' },
  { id: pilotageCategoryOptionId('statut:Inactif'), label: 'Inactif' },
];

const DEFAULT_DOMAINES: PilotageDomaineOption[] = [
  { code: 'transfert', label: 'Transferts' },
  { code: 'monnaie', label: 'Monnaie' },
  { code: 'service', label: 'Services' },
];

@Component({
  selector: 'app-agences-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    FilterPanelComponent,
    MultiSelectComponent,
    SectionCardComponent,
    SkeletonComponent,
    TableActionsMenuComponent,
    AgenceFormModalComponent,
    PilotageAgencyModalComponent,
  ],
  template: `
    @if (openedAgency(); as agency) {
      @if (agencyCriteria(); as c) {
        <app-pilotage-agency-modal
          [agency]="agency"
          [criteria]="c"
          [domaines]="domaines()"
          [devises]="devises()"
          (closed)="closeAgencyFiche()"
        />
      }
    }

    <app-page-header title="Agences" />

    <app-filter-panel title="Filtres" [expanded]="true">
      <div class="agences-filters">
        <div class="agences-filter-row">
          <div class="filter-field">
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
            <label class="form-label" for="ag-activity">Active dans les</label>
            <select
              id="ag-activity"
              class="form-select form-select-sm"
              [(ngModel)]="draftActivityDays"
              (ngModelChange)="onActivityDaysChange()"
              title="Agences dont la dernière transaction date d’au plus X jours"
            >
              <option [ngValue]="null">Toutes</option>
              <option [ngValue]="30">30 derniers jours</option>
              <option [ngValue]="60">60 derniers jours</option>
              <option [ngValue]="90">90 derniers jours</option>
            </select>
          </div>
          <div class="filter-field filter-field--inactive">
            <label class="form-label" for="ag-inactive">Sans activité depuis</label>
            <div class="agences-inactive-custom input-group input-group-sm">
              <input
                id="ag-inactive"
                type="number"
                min="1"
                step="1"
                class="form-control form-control-sm"
                [(ngModel)]="draftInactiveCustomDays"
                (ngModelChange)="onInactiveCustomChange()"
                placeholder="N"
                title="Dernière transaction entre 1 et N jours (pas aujourd’hui, pas plus ancien que N jours)"
              />
              <span class="input-group-text">j</span>
            </div>
          </div>
          <div class="filter-field">
            <label class="form-label">Statut</label>
            <app-multi-select
              [options]="statutOptions"
              [selectedIds]="draftStatutIds"
              (selectedIdsChange)="draftStatutIds = $event"
              placeholder="Tous les statuts"
            />
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
            <label class="form-label">Région</label>
            <app-multi-select
              [options]="regionOptions()"
              [selectedIds]="draftRegionIds"
              (selectedIdsChange)="onFilterRegionsChange($event)"
              placeholder="Toutes les régions"
            />
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
          <div class="filter-field filter-field--category">
            <label class="form-label">Catégorie</label>
            <app-multi-select
              [options]="categoryOptions()"
              [selectedIds]="draftCategorieIds"
              (selectedIdsChange)="draftCategorieIds = $event"
              placeholder="Toutes les catégories"
            />
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
        <div class="agences-export-collapse" [class.is-open]="exportMenuOpen()">
          <button
            type="button"
            class="btn btn-outline-dark btn-sm"
            [disabled]="exporting() || loading()"
            [attr.aria-expanded]="exportMenuOpen()"
            aria-controls="agences-export-panel"
            (click)="toggleExportMenu($event)"
          >
            <i class="bi bi-download me-1"></i>{{ exporting() ? 'Export…' : 'Exporter' }}
            <i
              class="bi ms-1"
              [class.bi-chevron-up]="exportMenuOpen()"
              [class.bi-chevron-down]="!exportMenuOpen()"
              aria-hidden="true"
            ></i>
          </button>
          @if (exportMenuOpen()) {
            <div
              id="agences-export-panel"
              class="agences-export-collapse__panel shadow-sm"
              role="menu"
              (click)="$event.stopPropagation()"
            >
              <button
                type="button"
                class="agences-export-collapse__item"
                role="menuitem"
                [disabled]="exporting()"
                (click)="exportRows()"
              >
                <span class="agences-export-collapse__item-title">
                  <i class="bi bi-table me-2" aria-hidden="true"></i>
                  Registre des agences
                </span>
                <span class="agences-export-collapse__item-desc">
                  Liste filtrée du registre (identifiants, réseau, localisation…).
                </span>
              </button>
              <button
                type="button"
                class="agences-export-collapse__item"
                role="menuitem"
                [disabled]="exporting()"
                (click)="exportAgencesPeriodique()"
              >
                <span class="agences-export-collapse__item-title">
                  <i class="bi bi-building me-2" aria-hidden="true"></i>
                  Agences par mois
                </span>
                <span class="agences-export-collapse__item-desc">
                  Une feuille Excel par mois, totaux volume / montant (année en cours).
                </span>
              </button>
              <button
                type="button"
                class="agences-export-collapse__item"
                role="menuitem"
                [disabled]="exporting()"
                (click)="exportAgencesProduitsPeriodique()"
              >
                <span class="agences-export-collapse__item-title">
                  <i class="bi bi-grid-3x3-gap me-2" aria-hidden="true"></i>
                  Agences × produits par mois
                </span>
                <span class="agences-export-collapse__item-desc">
                  Une feuille par mois : agence, produit (Envoi/Retrait), volume et montant.
                </span>
              </button>
            </div>
          }
        </div>
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
                <th class="text-end" style="width: 2.75rem"></th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.agenceId) {
                <tr>
                  <td>
                    <button type="button" class="agences-name-btn" (click)="openAgencyFiche(row)">
                      <span class="agences-cell-primary">{{ row.nom || '—' }}</span>
                      <span class="agences-cell-muted">{{ row.categorie || '—' }}</span>
                    </button>
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
                  <td class="text-end">
                    <app-table-actions-menu #rowMenu>
                      <button type="button" class="table-actions-menu__item" (click)="openAgencyFiche(row); rowMenu.close()">
                        <i class="bi bi-eye"></i>
                        Voir la fiche
                      </button>
                      @if (auth.can('agences.ecrire')) {
                        <button type="button" class="table-actions-menu__item" (click)="openEdit(row); rowMenu.close()">
                          <i class="bi bi-pencil"></i>
                          Modifier
                        </button>
                      }
                    </app-table-actions-menu>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="text-center text-muted py-3">
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
      (regionChange)="loadZones($event != null ? [$event] : [])"
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
      gap: 0.55rem 0.7rem;
      align-items: start;
    }
    @media (max-width: 1199.98px) {
      .agences-filter-row {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    @media (max-width: 767.98px) {
      .agences-filter-row {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .agences-filter-row .filter-field--category,
      .agences-filter-row .filter-field--actions {
        grid-column: 1 / -1;
      }
    }
    @media (max-width: 575.98px) {
      .agences-filter-row {
        grid-template-columns: minmax(0, 1fr);
      }
      .agences-pager {
        flex-wrap: wrap;
        justify-content: space-between;
      }
      .agences-table-actions {
        flex-wrap: wrap;
      }
    }
    .agences-filters .filter-field {
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .agences-filters .form-label {
      margin-bottom: 0.2rem;
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.01em;
      color: var(--text-muted, #6b7280);
    }
    .agences-filters-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
      min-height: calc(1.5em + 0.5rem + 2px);
    }
    .agences-inactive-custom {
      width: 7.5rem;
      flex-wrap: nowrap;
    }
    .agences-inactive-custom .form-control {
      min-width: 0;
    }
    .agences-inactive-custom .input-group-text {
      font-size: 0.75rem;
      padding: 0.2rem 0.4rem;
    }
    .agences-filters ::ng-deep .multi-select-control {
      min-height: calc(1.5em + 0.5rem + 2px);
      font-size: 0.875rem;
    }
    .agences-table-actions {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
    .agences-export-collapse {
      position: relative;
    }
    .agences-export-collapse__panel {
      position: absolute;
      top: calc(100% + 0.35rem);
      right: 0;
      z-index: 30;
      width: min(22rem, 80vw);
      padding: 0.35rem;
      border: 1px solid var(--card-border);
      border-radius: 0.65rem;
      background: var(--card-bg);
    }
    .agences-export-collapse__item {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.2rem;
      width: 100%;
      margin: 0;
      padding: 0.7rem 0.8rem;
      border: 0;
      border-radius: 0.5rem;
      background: transparent;
      color: var(--text-primary);
      text-align: left;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .agences-export-collapse__item:hover:not(:disabled),
    .agences-export-collapse__item:focus-visible {
      background: var(--flash-gray-100, rgba(0, 0, 0, 0.04));
      outline: none;
    }
    .agences-export-collapse__item:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .agences-export-collapse__item-title {
      display: inline-flex;
      align-items: center;
      font-size: 0.875rem;
      font-weight: 600;
    }
    .agences-export-collapse__item-desc {
      font-size: 0.75rem;
      line-height: 1.35;
      color: var(--text-muted);
    }
    :host-context([data-bs-theme='dark']) .agences-export-collapse__item:hover:not(:disabled),
    :host-context([data-bs-theme='dark']) .agences-export-collapse__item:focus-visible {
      background: #2a2a2a;
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
    .agences-name-btn {
      display: block;
      width: 100%;
      padding: 0;
      border: 0;
      background: transparent;
      text-align: left;
      cursor: pointer;
    }
    .agences-name-btn:hover .agences-cell-primary,
    .agences-name-btn:focus-visible .agences-cell-primary {
      color: var(--bs-primary, #0d6efd);
      text-decoration: underline;
    }
    .agences-cell-primary {
      display: block;
      font-weight: 600;
      line-height: 1.25;
    }
    .agences-cell-muted {
      display: block;
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
  private readonly appSettings = inject(AppSettingsService);
  private readonly toast = inject(ToastService);

  readonly pageSizes = [25, 50, 100];
  readonly exportMenuOpen = signal(false);

  readonly statutOptions = STATUT_OPTIONS;

  draftActivityDays: number | null = null;
  draftInactiveCustomDays: number | null = null;
  draftStatutIds: number[] = [];
  draftSansCoords = false;
  draftIdentifiant = '';
  draftQ = '';
  draftRegionIds: number[] = [];
  draftZoneId: number | null = null;
  draftVille = '';
  draftCommune = '';
  draftCategorieIds: number[] = [];

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

  readonly openedAgency = signal<PilotageAgenceRank | null>(null);
  readonly agencyCriteria = signal<PilotageCriteria | null>(null);
  readonly domaines = signal<PilotageDomaineOption[]>(DEFAULT_DOMAINES);
  readonly devises = signal<string[]>(['USD']);

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  readonly editorZones = computed(() => {
    const regionId = this.editingAgency()?.regionId ?? null;
    // zones signal holds current filter region zones; reload on open via loadZonesForEditor
    return this.zones();
  });

  ngOnInit(): void {
    this.pilotage.loadMeta().subscribe({
      next: (meta) => {
        this.domaines.set(meta.domaines?.length ? meta.domaines : DEFAULT_DOMAINES);
        this.devises.set(meta.devises?.length ? meta.devises : ['USD']);
      },
      error: () => {
        this.domaines.set(DEFAULT_DOMAINES);
        this.devises.set(['USD']);
      },
    });
    this.pilotage.listReseauRegions().subscribe({
      next: (rows) => this.regions.set(rows ?? []),
      error: () => this.regions.set([]),
    });
    this.agencesApi.categories().subscribe({
      next: (rows) => {
        this.categories.set(rows ?? []);
        this.applyDefaultCategories();
        this.applyFilters();
      },
      error: () => {
        this.categories.set([...DEFAULT_AGENCE_CATEGORIES]);
        this.applyDefaultCategories();
        this.applyFilters();
      },
    });
    this.loadZones([]);
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

  regionOptions(): MultiSelectOption[] {
    return this.regions().map((r) => ({ id: r.id, label: r.libelle }));
  }

  categoryOptions(): MultiSelectOption[] {
    return this.categories().map((c) => ({ id: pilotageCategoryOptionId(c), label: c }));
  }

  onFilterRegionsChange(ids: number[]): void {
    this.draftRegionIds = ids;
    this.draftZoneId = null;
    this.loadZones(ids);
  }

  onActivityDaysChange(): void {
    if (this.draftActivityDays != null) {
      this.draftInactiveCustomDays = null;
    }
  }

  onInactiveCustomChange(): void {
    const n = this.normalizeCustomDays(this.draftInactiveCustomDays);
    this.draftInactiveCustomDays = n;
    if (n != null) {
      this.draftActivityDays = null;
    }
  }

  resetFilters(): void {
    this.draftActivityDays = null;
    this.draftInactiveCustomDays = null;
    this.draftStatutIds = [];
    this.draftSansCoords = false;
    this.draftIdentifiant = '';
    this.draftQ = '';
    this.draftRegionIds = [];
    this.draftZoneId = null;
    this.draftVille = '';
    this.draftCommune = '';
    this.applyDefaultCategories();
    this.loadZones([]);
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
    this.loadZones([]);
    this.editorOpen.set(true);
  }

  openEdit(row: AgenceAdmin): void {
    this.editingId.set(row.agenceId);
    this.editingAgency.set(row);
    this.loadZones(row.regionId != null ? [row.regionId] : []);
    this.editorOpen.set(true);
  }

  openAgencyFiche(row: AgenceAdmin): void {
    this.agencyCriteria.set(this.buildAgencyCriteria());
    this.openedAgency.set({
      agenceId: row.agenceId,
      codeAgence: row.code_agence || '',
      nom: row.nom || row.code_agence || String(row.agenceId),
      categorie: row.categorie || '',
      posId: row.pos_id || '',
      region: row.region || '',
      zone: row.zone || '',
      volume: 0,
      montant: 0,
      commission: 0,
      commissionFcn: 0,
      commissionAgent: 0,
      commissionFcnAgent: 0,
    });
  }

  closeAgencyFiche(): void {
    this.openedAgency.set(null);
    this.agencyCriteria.set(null);
  }

  closeEditor(): void {
    this.editorOpen.set(false);
    this.editingId.set(null);
    this.editingAgency.set(null);
  }

  private buildAgencyCriteria(): PilotageCriteria {
    const range = periodPresetRange('30d');
    const domaines = (this.domaines().map((d) => d.code) as PilotageDomaine[]).filter(Boolean);
    const useDomaines = domaines.length ? domaines : (['transfert', 'monnaie', 'service'] as PilotageDomaine[]);
    const devises = this.devises().length ? this.devises() : ['USD'];
    const devise = devises.includes('USD') ? 'USD' : devises[0];
    return {
      domaine: useDomaines[0],
      domaines: useDomaines,
      devise,
      devises: [devise],
      from: range.from,
      to: range.to,
      produitIds: [],
      produitLabels: [],
      partenaire: '',
      modePaiement: '',
      sousProduit: '',
      ecran: '',
      statutUniformes: [],
      categories: [],
      agenceIds: [],
      agentIds: [],
      typeOperationIds: [],
      jourFiltre: '',
      paysId: null,
      provinceId: null,
      villeIds: [],
      territoireId: null,
      communeIds: [],
      reseauRegions: [],
      zoneIds: [],
      couloirCodes: [],
      locationLabels: {},
    };
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

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.exportMenuOpen()) this.exportMenuOpen.set(false);
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    if (this.exporting() || this.loading()) return;
    this.exportMenuOpen.update((open) => !open);
  }

  async exportRows(): Promise<void> {
    this.exportMenuOpen.set(false);
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

  exportAgencesPeriodique(): void {
    if (this.exporting()) return;
    this.exportMenuOpen.set(false);
    this.exporting.set(true);
    const criteria = this.buildActivityExportCriteria();
    this.pilotage.loadAgencesPeriodique(criteria, 'month', 'top', 'montant').subscribe({
      next: (data) => {
        const settings = this.appSettings.settings();
        const identity = buildPilotageReportIdentity({
          kind: 'agences-mois',
          criteria,
          domainesLabel: this.domainesLabel(criteria.domaines),
          period: `${this.formatDateFr(criteria.from)} — ${this.formatDateFr(criteria.to)}`,
          chips: this.exportScopeChips(),
        });
        downloadPilotageAgencesPeriodiqueExcel({
          identity,
          from: data.from || criteria.from,
          to: data.to || criteria.to,
          devise: data.devise || criteria.devise,
          periods: data.periods,
          logoUrl: settings.logo_light || '/branding/logo-light1.png',
          appName: settings.app_name || 'Flash OPS',
          faviconUrl: settings.favicon || '/branding/logo-light1.png',
        })
          .then(() => {
            if (!data.periods?.length) {
              this.toast.warning('Aucune donnée agence par mois pour ce périmètre.');
            }
          })
          .catch(() => this.toast.error('Export agences par mois impossible.'))
          .finally(() => this.exporting.set(false));
      },
      error: () => {
        this.exporting.set(false);
        this.toast.error('Export agences par mois impossible.');
      },
    });
  }

  exportAgencesProduitsPeriodique(): void {
    if (this.exporting()) return;
    this.exportMenuOpen.set(false);
    this.exporting.set(true);
    const criteria = this.buildActivityExportCriteria();
    this.pilotage.loadAgencesProduitsPeriodique(criteria, 'month', 'top', 'montant').subscribe({
      next: (data) => {
        const settings = this.appSettings.settings();
        const identity = buildPilotageReportIdentity({
          kind: 'agences-produits-mois',
          criteria,
          domainesLabel: this.domainesLabel(criteria.domaines),
          period: `${this.formatDateFr(criteria.from)} — ${this.formatDateFr(criteria.to)}`,
          chips: this.exportScopeChips(),
        });
        downloadPilotageAgencesProduitsPeriodiqueExcel({
          identity,
          from: data.from || criteria.from,
          to: data.to || criteria.to,
          devise: data.devise || criteria.devise,
          periods: data.periods,
          logoUrl: settings.logo_light || '/branding/logo-light1.png',
          appName: settings.app_name || 'Flash OPS',
          faviconUrl: settings.favicon || '/branding/logo-light1.png',
        })
          .then(() => {
            if (!data.periods?.length) {
              this.toast.warning('Aucune donnée agence × produit par mois pour ce périmètre.');
            }
          })
          .catch(() => this.toast.error('Export agences × produits par mois impossible.'))
          .finally(() => this.exporting.set(false));
      },
      error: () => {
        this.exporting.set(false);
        this.toast.error('Export agences × produits par mois impossible.');
      },
    });
  }

  /** Critères activité pour exports mensuels : année en cours + filtres registre. */
  private buildActivityExportCriteria(): PilotageCriteria {
    const base = this.buildAgencyCriteria();
    const range = periodPresetRange('year');
    const regionIds = this.applied.region_ids ?? [];
    const reseauRegions = this.regions()
      .filter((r) => regionIds.includes(r.id))
      .map((r) => r.libelle?.trim() || '')
      .filter(Boolean);
    return {
      ...base,
      from: range.from,
      to: range.to,
      categories: [...(this.applied.categories ?? [])],
      zoneIds: this.applied.zone_id != null ? [this.applied.zone_id] : [],
      reseauRegions,
    };
  }

  private domainesLabel(domaines: PilotageDomaine[]): string {
    const labels = this.domaines()
      .filter((d) => domaines.includes(d.code as PilotageDomaine))
      .map((d) => d.label);
    return labels.length ? labels.join(', ') : 'Tous domaines';
  }

  private exportScopeChips(): string[] {
    const chips: string[] = [];
    const regionIds = this.applied.region_ids ?? [];
    if (regionIds.length) {
      const labels = this.regions()
        .filter((r) => regionIds.includes(r.id))
        .map((r) => r.libelle)
        .filter(Boolean);
      if (labels.length) chips.push(`Région : ${labels.join(', ')}`);
    }
    if (this.applied.zone_id != null) {
      const label = this.zones().find((z) => z.id === this.applied.zone_id)?.libelle;
      if (label) chips.push(`Zone : ${label}`);
    }
    if (this.applied.categories?.length) {
      chips.push(`Catégorie : ${this.applied.categories.join(', ')}`);
    }
    return chips;
  }

  private formatDateFr(iso: string): string {
    const [y, m, d] = (iso || '').split('-');
    if (!y || !m || !d) return iso || '—';
    return `${d}/${m}/${y}`;
  }

  private buildFilters(page: number): AgenceAdminFilters {
    const categories = this.selectedCategories();
    const statutIds = new Set(this.draftStatutIds);
    const statut_activite = this.statutOptions
      .filter((o) => statutIds.has(o.id))
      .map((o) => o.label);
    return {
      q: this.draftQ.trim() || undefined,
      identifiant: this.draftIdentifiant.trim() || undefined,
      region_ids: this.draftRegionIds.length ? [...this.draftRegionIds] : undefined,
      zone_id: this.draftZoneId,
      ville: this.draftVille.trim() || undefined,
      commune: this.draftCommune.trim() || undefined,
      categories: categories.length ? categories : undefined,
      activity_days: this.draftActivityDays,
      inactive_since_days: this.resolveInactiveSinceDays(),
      statut_activite: statut_activite.length ? statut_activite : undefined,
      sans_coords: this.draftSansCoords || undefined,
      page,
      size: this.pageSize(),
    };
  }

  private resolveInactiveSinceDays(): number | null {
    return this.normalizeCustomDays(this.draftInactiveCustomDays);
  }

  private normalizeCustomDays(value: number | null | undefined): number | null {
    if (value == null || value === ('' as unknown as number)) return null;
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 1) return null;
    return n;
  }

  private selectedCategories(): string[] {
    const ids = new Set(this.draftCategorieIds);
    return this.categories().filter((c) => ids.has(pilotageCategoryOptionId(c)));
  }

  private applyDefaultCategories(): void {
    const available = this.categories();
    const picked: string[] = [];
    for (const wanted of DEFAULT_AGENCE_CATEGORIES) {
      const match =
        available.find((c) => c.trim().toLowerCase() === wanted.toLowerCase()) ||
        available.find((c) => c.trim().toLowerCase().includes(wanted.toLowerCase()));
      if (match && !picked.includes(match)) picked.push(match);
    }
    const source = picked.length ? picked : [...DEFAULT_AGENCE_CATEGORIES];
    if (!picked.length && !available.length) {
      this.categories.set([...DEFAULT_AGENCE_CATEGORIES]);
    }
    this.draftCategorieIds = source.map((c) => pilotageCategoryOptionId(c));
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

  loadZones(regionIds: number[]): void {
    const idSet = new Set(regionIds);
    const labels =
      idSet.size === 0
        ? []
        : this.regions()
            .filter((r) => idSet.has(r.id))
            .map((r) => r.libelle)
            .filter(Boolean);
    this.pilotage.listReseauZones(labels).subscribe({
      next: (rows) => this.zones.set(rows ?? []),
      error: () => this.zones.set([]),
    });
  }
}
