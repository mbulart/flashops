import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Pays, Ville, Commune } from '../../core/models/api.models';
import {
  PilotageAgenceScope,
  PilotageCriteria,
  PilotageDomaine,
  PilotageDomaineOption,
  PilotageJourFiltre,
  PilotageReseauRef,
  PilotageTransactionListItem,
  PilotageTypeOperation,
} from '../../core/models/pilotage.models';
import { PilotageService } from '../../core/services/pilotage.service';
import { ToastService } from '../../core/services/toast.service';
import { FilterPanelComponent } from '../../shared/components/filter-panel/filter-panel.component';
import { MultiSelectComponent, MultiSelectOption } from '../../shared/components/multi-select/multi-select.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import {
  PERIOD_PRESETS,
  PeriodPresetId,
  formatNumberFr,
  formatValeurFr,
  periodPresetRange,
} from '../../shared/utils/format.utils';
import { PilotageAgencySelectComponent } from '../pilotage/components/pilotage-agency-select.component';
import { PilotageAgentSelectComponent } from '../pilotage/components/pilotage-agent-select.component';
import {
  PILOTAGE_JOUR_OPTIONS,
  PILOTAGE_STATUT_OPTIONS,
  PilotageProduitVue,
  buildPilotageProduitChoices,
  pilotageCompactKey,
  pilotageDeviseOptionId,
  pilotageDomaineOptionId,
  pilotageEcransForDomain,
  pilotageCategoryOptionId,
  pilotagePartenaireLabel,
  pilotageStatutOptionId,
  resolvePilotageProduitIds,
} from '../pilotage/pilotage-filtres.config';
import { TransactionDetailModalComponent } from './transaction-detail-modal.component';

const DEFAULT_DOMAINES: PilotageDomaineOption[] = [
  { code: 'transfert', label: 'Transferts' },
  { code: 'monnaie', label: 'Monnaie' },
  { code: 'service', label: 'Services' },
];

@Component({
  selector: 'app-transactions-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    FilterPanelComponent,
    SectionCardComponent,
    SkeletonComponent,
    MultiSelectComponent,
    StatusBadgeComponent,
    PilotageAgencySelectComponent,
    PilotageAgentSelectComponent,
    TransactionDetailModalComponent,
  ],
  template: `
    @if (openedOperationId(); as opId) {
      <app-transaction-detail-modal [operationId]="opId" (closed)="openedOperationId.set(null)" />
    }

    <app-page-header title="Transactions" subtitle="Consultation des opérations du périmètre" />

    <app-filter-panel title="Filtres" [expanded]="true">
      <div class="pilotage-filters-unified">
        <section class="pilotage-filter-group" aria-labelledby="tx-grp-periode">
          <h3 class="pilotage-filter-group__title" id="tx-grp-periode">Période et périmètre</h3>
          <div class="period-presets" role="group" aria-label="Périodes rapides">
            @for (p of periodPresets; track p.id) {
              <button
                type="button"
                class="btn"
                [class.btn-primary]="activePreset === p.id"
                [class.btn-outline-secondary]="activePreset !== p.id"
                (click)="applyPreset(p.id)"
              >
                {{ p.label }}
              </button>
            }
          </div>
          <div class="pilotage-filter-row pilotage-filter-row--period">
            <div class="filter-field">
              <label class="form-label">Domaine</label>
              <app-multi-select
                [options]="domaineOptions()"
                [selectedIds]="draftDomaineIds"
                (selectedIdsChange)="onDomaineIdsChange($event)"
                placeholder="Domaines"
              />
            </div>
            <div class="filter-field">
              <label class="form-label">Devise</label>
              <app-multi-select
                [options]="deviseOptions()"
                [selectedIds]="draftDeviseIds"
                (selectedIdsChange)="draftDeviseIds = $event"
                placeholder="Devises"
              />
            </div>
            <div class="filter-field">
              <label class="form-label">Du</label>
              <input type="date" class="form-control" [(ngModel)]="draftFrom" (ngModelChange)="activePreset = null" />
            </div>
            <div class="filter-field">
              <label class="form-label">Au</label>
              <input type="date" class="form-control" [(ngModel)]="draftTo" (ngModelChange)="activePreset = null" />
            </div>
          </div>
        </section>

        <section class="pilotage-filter-group" aria-labelledby="tx-grp-produits">
          <h3 class="pilotage-filter-group__title" id="tx-grp-produits">Produits et statut</h3>
          @if (filtresLoading()) {
            <app-skeleton type="table" [rows]="1" [cols]="3" />
          } @else {
            <div class="pilotage-filter-row pilotage-filter-row--products">
              @if (hasTransfert()) {
                <div class="filter-field">
                  <label class="form-label">Sens du transfert</label>
                  <select class="form-select" [(ngModel)]="draftEcran" (ngModelChange)="onSensChange()">
                    <option value="">Tous (envois et retraits)</option>
                    @for (e of sensTransfertOptions; track e.id) {
                      <option [value]="e.id">{{ e.label }}</option>
                    }
                  </select>
                </div>
              }
              <div class="filter-field">
                <label class="form-label">Produits</label>
                <app-multi-select
                  [options]="productOptions()"
                  [selectedIds]="draftProduitIds"
                  (selectedIdsChange)="onProduitIdsChange($event)"
                  placeholder="Tous les produits"
                />
              </div>
              @if (flashPaymentPartners().length) {
                <div class="filter-field">
                  <label class="form-label">Partenaire</label>
                  <select class="form-select" [(ngModel)]="draftPartenaire" (ngModelChange)="onPartenaireChange()">
                    <option value="">Tous les partenaires</option>
                    @for (p of flashPaymentPartners(); track p.value) {
                      <option [value]="p.value">{{ p.label }}</option>
                    }
                  </select>
                </div>
              }
              @if (draftPartenaire) {
                <div class="filter-field">
                  <label class="form-label">Mode de paiement</label>
                  <select class="form-select" [(ngModel)]="draftModePaiement" (ngModelChange)="onModePaiementChange()">
                    <option value="">Cash et mobile money</option>
                    <option value="cash">Cash</option>
                    <option value="momo">Mobile money</option>
                  </select>
                </div>
              }
              @if (draftModePaiement === 'momo' && flashPaymentSousProduits().length) {
                <div class="filter-field">
                  <label class="form-label">Sous-produit</label>
                  <select class="form-select" [(ngModel)]="draftSousProduit">
                    <option value="">Tous</option>
                    @for (p of flashPaymentSousProduits(); track p.value) {
                      <option [value]="p.value">{{ p.label }}</option>
                    }
                  </select>
                </div>
              }
              <div class="filter-field">
                <label class="form-label">Statut</label>
                <app-multi-select
                  [options]="statutSelectOptions"
                  [(selectedIds)]="draftStatutIds"
                  placeholder="Statuts"
                />
              </div>
              <div class="filter-field">
                <label class="form-label">Expéditeur / récepteur / réf.</label>
                <input
                  type="search"
                  class="form-control"
                  [(ngModel)]="draftPartyQuery"
                  placeholder="Nom, téléphone, référence…"
                  (keydown.enter)="$event.preventDefault(); applyFilters()"
                />
              </div>
            </div>
          }
        </section>

        <button
          type="button"
          class="pilotage-detail-toggle"
          [attr.aria-expanded]="detailFiltresOpen()"
          (click)="detailFiltresOpen.set(!detailFiltresOpen())"
        >
          <span class="pilotage-detail-toggle__label">
            <i
              class="bi pilotage-detail-toggle__chevron"
              [class.bi-chevron-right]="!detailFiltresOpen()"
              [class.bi-chevron-down]="detailFiltresOpen()"
            ></i>
            Réseau
          </span>
        </button>

        <div
          class="pilotage-detail-panel pilotage-detail-panel--compact"
          [class.pilotage-detail-panel--closed]="!detailFiltresOpen()"
          [attr.hidden]="detailFiltresOpen() ? null : ''"
        >
          <div class="pilotage-filter-row pilotage-filter-row--detail-main">
            <div class="filter-field">
              <label class="form-label">Pays</label>
              <select class="form-select form-select-sm" [ngModel]="draftPaysId" (ngModelChange)="onDraftPaysChange($event)">
                <option [ngValue]="null">Tous</option>
                @for (p of paysList(); track p.id) {
                  <option [ngValue]="p.id">{{ p.libelle }}</option>
                }
              </select>
            </div>
            <div class="filter-field">
              <label class="form-label">Région</label>
              <app-multi-select
                [options]="regionOptions()"
                [selectedIds]="draftRegionIds"
                (selectedIdsChange)="onDraftRegionIdsChange($event)"
                placeholder="Toutes"
              />
            </div>
            <div class="filter-field">
              <label class="form-label">Zone</label>
              <app-multi-select
                [options]="zoneOptions()"
                [selectedIds]="draftZoneIds"
                (selectedIdsChange)="draftZoneIds = $event"
                placeholder="Toutes"
              />
            </div>
            <div class="filter-field">
              <label class="form-label">Ville</label>
              <app-multi-select
                [options]="villeOptions()"
                [selectedIds]="draftVilleIds"
                [disabled]="!draftPaysId"
                (selectedIdsChange)="onDraftVilleIdsChange($event)"
                placeholder="Toutes"
              />
            </div>
            <div class="filter-field">
              <label class="form-label">Commune</label>
              <app-multi-select
                [options]="communeOptions()"
                [selectedIds]="draftCommuneIds"
                [disabled]="!draftVilleIds.length"
                (selectedIdsChange)="draftCommuneIds = $event"
                placeholder="Toutes"
              />
            </div>
            <div class="filter-field">
              <label class="form-label">Catégorie</label>
              <app-multi-select
                [options]="categoryOptions()"
                [(selectedIds)]="draftCategorieIds"
                placeholder="Toutes"
              />
            </div>
            <div class="filter-field">
              <label class="form-label">Agence</label>
              <app-pilotage-agency-select
                [agenceScope]="buildAgenceScope()"
                [selectedIds]="draftAgenceIds"
                (selectedIdsChange)="onAgenceIdsChange($event)"
              />
            </div>
            <div class="filter-field">
              <label class="form-label">Agent</label>
              <app-pilotage-agent-select
                [agenceIds]="draftAgenceIds"
                [agenceScope]="buildAgenceScope()"
                [selectedIds]="draftAgentIds"
                (selectedIdsChange)="draftAgentIds = $event"
              />
            </div>
            <div class="filter-field">
              <label class="form-label">Jours</label>
              <select class="form-select form-select-sm" [(ngModel)]="draftJourFiltre">
                @for (j of jourOptions; track j.value) {
                  <option [value]="j.value">{{ j.label }}</option>
                }
              </select>
            </div>
          </div>
        </div>

        <div class="pilotage-filters-actions">
          <button class="btn btn-outline-secondary" type="button" (click)="resetFilters()">Réinitialiser</button>
          <button class="btn btn-primary" type="button" (click)="applyFilters()">
            <i class="bi bi-search me-1"></i>Appliquer
          </button>
        </div>
      </div>
    </app-filter-panel>

    <app-section-card [title]="tableTitle()" [subtitle]="tableSubtitle()" [noPadding]="true">
      <div actions class="tx-table-actions">
        <select class="form-select form-select-sm tx-page-size" [ngModel]="pageSize()" (ngModelChange)="setPageSize($event)">
          @for (s of pageSizes; track s) {
            <option [ngValue]="s">{{ s }} / page</option>
          }
        </select>
      </div>

      @if (!criteria()) {
        <div class="p-4 text-muted">Choisissez une période puis appliquez les filtres.</div>
      } @else if (loading()) {
        <div class="p-3"><app-skeleton type="table" [rows]="10" [cols]="8" /></div>
      } @else {
        <div class="table-responsive">
          <table class="table table-hover table-sm align-middle mb-0 tx-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Agence</th>
                <th>Produit</th>
                <th>Expéditeur</th>
                <th>Bénéficiaire</th>
                <th>Statut</th>
                <th class="text-end">Montant</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.operationId) {
                <tr class="tx-row" (click)="openDetail(row)">
                  <td class="text-nowrap">
                    <div class="fw-semibold">{{ formatJour(row.jour) }}</div>
                    @if (row.heure) {
                      <div class="text-muted small">{{ row.heure }}</div>
                    }
                  </td>
                  <td>
                    <div class="fw-semibold">{{ row.agence_nom || row.code_agence || '—' }}</div>
                    <div class="text-muted small font-monospace">{{ row.code_agence || row.agenceId }}</div>
                  </td>
                  <td class="clip" [title]="row.produit">{{ row.produit || '—' }}</td>
                  <td class="clip" [title]="row.expediteur">{{ row.expediteur || '—' }}</td>
                  <td class="clip" [title]="row.beneficiaire">{{ row.beneficiaire || '—' }}</td>
                  <td>
                    @if (row.statut) {
                      <app-status-badge [label]="row.statut" />
                    } @else {
                      —
                    }
                  </td>
                  <td class="text-end font-monospace text-nowrap">
                    {{ formatValeurFr(row.montant, row.devise || appliedDevise()) }}
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="text-center text-muted py-4">Aucune transaction pour ces filtres.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (total() > 0) {
          <div class="tx-pager">
            <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="page() <= 1" (click)="go(1)">«</button>
            <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="page() <= 1" (click)="go(page() - 1)">
              Précédent
            </button>
            <span>{{ rangeLabel() }}</span>
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              [disabled]="page() >= pageCount()"
              (click)="go(page() + 1)"
            >
              Suivant
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-secondary"
              [disabled]="page() >= pageCount()"
              (click)="go(pageCount())"
            >
              »
            </button>
          </div>
        }
      }
    </app-section-card>
  `,
  styles: `
    .tx-table-actions {
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }
    .tx-page-size {
      width: auto;
      min-width: 7rem;
    }
    .tx-table {
      font-size: 0.84rem;
    }
    .tx-table thead th {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      color: var(--text-muted, #6b7280);
      white-space: nowrap;
    }
    .tx-row {
      cursor: pointer;
    }
    .tx-row:hover {
      background: color-mix(in srgb, var(--bs-primary, #0d6efd) 6%, transparent);
    }
    .clip {
      max-width: 12rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tx-pager {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.4rem;
      padding: 0.65rem 0.9rem;
      border-top: 1px solid var(--card-border, #e5e7eb);
      font-size: 0.82rem;
      color: var(--text-muted, #6b7280);
    }
  `,
})
export class TransactionsPageComponent implements OnInit {
  private readonly pilotage = inject(PilotageService);
  private readonly toast = inject(ToastService);

  readonly periodPresets = PERIOD_PRESETS;
  readonly jourOptions = PILOTAGE_JOUR_OPTIONS;
  readonly sensTransfertOptions = pilotageEcransForDomain('transfert');
  readonly pageSizes = [25, 50, 100];
  readonly statutSelectOptions: MultiSelectOption[] = PILOTAGE_STATUT_OPTIONS.filter((o) => o.value).map((o) => ({
    id: pilotageStatutOptionId(o.value),
    label: o.label,
  }));

  activePreset: PeriodPresetId | null = '30d';
  draftFrom = '';
  draftTo = '';
  draftDomaineIds: number[] = [];
  draftDeviseIds: number[] = [];
  draftEcran = '';
  draftProduitIds: number[] = [];
  draftPartenaire = '';
  draftModePaiement: '' | 'cash' | 'momo' = '';
  draftSousProduit = '';
  draftStatutIds: number[] = [];
  draftPartyQuery = '';
  draftPaysId: number | null = null;
  draftRegionIds: number[] = [];
  draftZoneIds: number[] = [];
  draftVilleIds: number[] = [];
  draftCommuneIds: number[] = [];
  draftCategorieIds: number[] = [];
  draftAgenceIds: number[] = [];
  draftAgentIds: number[] = [];
  draftJourFiltre: PilotageJourFiltre | '' = '';

  readonly domaines = signal<PilotageDomaineOption[]>(DEFAULT_DOMAINES);
  readonly devises = signal<string[]>(['USD']);
  readonly produits = signal<PilotageProduitVue[]>([]);
  readonly categories = signal<string[]>([]);
  readonly typesOperation = signal<PilotageTypeOperation[]>([]);
  readonly regions = signal<PilotageReseauRef[]>([]);
  readonly zones = signal<PilotageReseauRef[]>([]);
  readonly paysList = signal<Pays[]>([]);
  readonly villes = signal<Ville[]>([]);
  readonly communes = signal<Commune[]>([]);
  readonly filtresLoading = signal(false);
  readonly detailFiltresOpen = signal(false);
  readonly criteria = signal<PilotageCriteria | null>(null);
  readonly appliedParty = signal('');
  readonly loading = signal(false);
  readonly rows = signal<PilotageTransactionListItem[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(25);
  readonly moyenne = signal(0);
  readonly montantTotal = signal(0);
  readonly openedOperationId = signal<number | null>(null);

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly appliedDevise = computed(() => this.criteria()?.devise || 'USD');

  readonly domaineOptions = computed((): MultiSelectOption[] =>
    this.domaines().map((d) => ({
      id: pilotageDomaineOptionId(d.code),
      label: d.code === 'transfert' ? 'Transferts' : d.code === 'monnaie' ? 'Monnaie' : 'Services',
    }))
  );

  readonly deviseOptions = computed((): MultiSelectOption[] =>
    this.devises().map((d) => ({ id: pilotageDeviseOptionId(d), label: d }))
  );

  readonly productOptions = computed((): MultiSelectOption[] =>
    buildPilotageProduitChoices(this.produits(), this.draftEcran).map((c) => ({ id: c.id, label: c.label }))
  );

  readonly regionOptions = computed((): MultiSelectOption[] =>
    this.regions().map((r) => ({ id: r.id, label: r.libelle }))
  );

  readonly zoneOptions = computed((): MultiSelectOption[] =>
    this.zones().map((z) => ({ id: z.id, label: z.libelle }))
  );

  readonly villeOptions = computed((): MultiSelectOption[] =>
    this.villes().map((v) => ({ id: v.id, label: v.libelle }))
  );

  readonly communeOptions = computed((): MultiSelectOption[] =>
    this.communes().map((c) => ({ id: c.id, label: c.libelle }))
  );

  readonly categoryOptions = computed((): MultiSelectOption[] =>
    this.categories().map((c) => ({ id: pilotageCategoryOptionId(c), label: c }))
  );

  flashPaymentPartners(): { value: string; label: string }[] {
    const keys = new Set<string>();
    for (const p of this.produits()) {
      if (p.module.trim().toUpperCase() !== 'FLASHPAYMENT') continue;
      const key = pilotageCompactKey(p.partenaire || '');
      if (key) keys.add(key);
    }
    return [...keys].sort().map((value) => ({ value, label: pilotagePartenaireLabel(value) }));
  }

  flashPaymentSousProduits(): { value: string; label: string }[] {
    const keys = new Set<string>();
    for (const p of this.produits()) {
      if (p.module.trim().toUpperCase() !== 'FLASHPAYMENT') continue;
      if (pilotageCompactKey(p.partenaire || '') !== this.draftPartenaire) continue;
      const key = pilotageCompactKey(p.produit || '');
      if (key) keys.add(key);
    }
    return [...keys].sort().map((value) => ({ value, label: pilotagePartenaireLabel(value) }));
  }

  ngOnInit(): void {
    this.applyPreset('30d');
    this.pilotage.loadMeta().subscribe({
      next: (meta) => {
        this.domaines.set(meta.domaines?.length ? meta.domaines : DEFAULT_DOMAINES);
        this.devises.set(meta.devises?.length ? meta.devises : ['USD']);
        this.draftDomaineIds = this.domaines().map((d) => pilotageDomaineOptionId(d.code));
        const list = this.devises();
        const preferred = list.includes('USD') ? 'USD' : list[0];
        this.draftDeviseIds = preferred ? [pilotageDeviseOptionId(preferred)] : [];
        this.reloadProduits();
      },
      error: () => {
        this.domaines.set(DEFAULT_DOMAINES);
        this.devises.set(['USD']);
        this.draftDomaineIds = this.domaines().map((d) => pilotageDomaineOptionId(d.code));
        this.draftDeviseIds = [pilotageDeviseOptionId('USD')];
      },
    });
    this.pilotage.listReseauRegions().subscribe({
      next: (rows) => this.regions.set(rows ?? []),
      error: () => this.regions.set([]),
    });
    this.pilotage.listGeoPays().subscribe({
      next: (rows) => this.paysList.set(rows ?? []),
      error: () => this.paysList.set([]),
    });
    this.loadZones([]);
  }

  hasTransfert(): boolean {
    return this.resolveDomaines(this.draftDomaineIds).includes('transfert');
  }

  applyPreset(id: PeriodPresetId): void {
    const range = periodPresetRange(id);
    this.draftFrom = range.from;
    this.draftTo = range.to;
    this.activePreset = id;
  }

  onDomaineIdsChange(ids: number[]): void {
    this.draftDomaineIds = ids;
    this.draftEcran = '';
    this.draftProduitIds = [];
    this.draftPartenaire = '';
    this.draftModePaiement = '';
    this.draftSousProduit = '';
    this.reloadProduits();
  }

  onSensChange(): void {
    this.draftProduitIds = [];
    this.draftPartenaire = '';
    this.draftModePaiement = '';
    this.draftSousProduit = '';
  }

  onProduitIdsChange(ids: number[]): void {
    this.draftProduitIds = ids;
    this.draftPartenaire = '';
    this.draftModePaiement = '';
    this.draftSousProduit = '';
  }

  onPartenaireChange(): void {
    this.draftModePaiement = '';
    this.draftSousProduit = '';
  }

  onModePaiementChange(): void {
    this.draftSousProduit = '';
  }

  onDraftPaysChange(paysId: number | null): void {
    this.draftPaysId = paysId;
    this.draftVilleIds = [];
    this.draftCommuneIds = [];
    this.villes.set([]);
    this.communes.set([]);
    if (paysId) {
      this.pilotage.listGeoVillesByPays(paysId, this.selectedRegionLabels()).subscribe({
        next: (rows) => this.villes.set(rows ?? []),
        error: () => this.villes.set([]),
      });
    }
  }

  onDraftRegionIdsChange(ids: number[]): void {
    this.draftRegionIds = ids;
    this.loadZones(this.selectedRegionLabels());
    if (this.draftPaysId) this.onDraftPaysChange(this.draftPaysId);
  }

  onDraftVilleIdsChange(ids: number[]): void {
    this.draftVilleIds = ids;
    this.draftCommuneIds = [];
    this.communes.set([]);
    if (!ids.length) return;
    forkJoin(
      ids.map((id) => this.pilotage.listGeoCommunes({ villeId: id }).pipe(catchError(() => of([]))))
    ).subscribe({
      next: (parts) => this.communes.set(parts.flat()),
      error: () => this.communes.set([]),
    });
  }

  onAgenceIdsChange(ids: number[]): void {
    this.draftAgenceIds = ids;
    this.draftAgentIds = [];
  }

  buildAgenceScope(): PilotageAgenceScope {
    return {
      reseauRegions: this.selectedRegionLabels(),
      zoneIds: [...this.draftZoneIds],
      paysId: this.draftPaysId,
      villeIds: [...this.draftVilleIds],
      communeIds: [...this.draftCommuneIds],
    };
  }

  resetFilters(): void {
    this.applyPreset('30d');
    this.draftDomaineIds = this.domaines().map((d) => pilotageDomaineOptionId(d.code));
    const list = this.devises();
    const preferred = list.includes('USD') ? 'USD' : list[0];
    this.draftDeviseIds = preferred ? [pilotageDeviseOptionId(preferred)] : [];
    this.draftEcran = '';
    this.draftProduitIds = [];
    this.draftPartenaire = '';
    this.draftModePaiement = '';
    this.draftSousProduit = '';
    this.draftStatutIds = [];
    this.draftPartyQuery = '';
    this.draftPaysId = null;
    this.draftRegionIds = [];
    this.draftZoneIds = [];
    this.draftVilleIds = [];
    this.draftCommuneIds = [];
    this.draftCategorieIds = [];
    this.draftAgenceIds = [];
    this.draftAgentIds = [];
    this.draftJourFiltre = '';
    this.villes.set([]);
    this.communes.set([]);
    this.loadZones([]);
    this.reloadProduits();
    this.criteria.set(null);
    this.rows.set([]);
    this.total.set(0);
  }

  applyFilters(): void {
    const domaines = this.resolveDomaines(this.draftDomaineIds);
    if (!domaines.length) {
      this.toast.warning('Domaine requis.');
      return;
    }
    const devises = this.resolveDevises(this.draftDeviseIds);
    if (!devises.length) {
      this.toast.warning('Devise requise.');
      return;
    }
    const from = (this.draftFrom || '').trim();
    const to = (this.draftTo || '').trim();
    if (!from || !to) {
      this.toast.warning('Dates requises.');
      return;
    }
    if (from > to) {
      this.toast.warning('Date de fin invalide.');
      return;
    }

    const choices = buildPilotageProduitChoices(this.produits(), this.draftEcran);
    const picked = this.draftProduitIds.filter((id) => choices.some((c) => c.id === id));
    const flashChoice = choices.find((item) => item.module.trim().toUpperCase() === 'FLASHPAYMENT');
    const flashSelected = !!flashChoice && this.draftProduitIds.includes(flashChoice.id);
    const partnerKey = flashSelected ? pilotageCompactKey(this.draftPartenaire) : '';
    const sousKey = this.draftModePaiement === 'momo' ? pilotageCompactKey(this.draftSousProduit) : '';
    const narrowed =
      picked.length > 0 || !!this.draftEcran || !!partnerKey || !!this.draftModePaiement || !!sousKey;
    const produitIds = narrowed
      ? resolvePilotageProduitIds(choices, picked, partnerKey, this.draftModePaiement, sousKey)
      : [];
    if (narrowed && !produitIds.length) {
      this.toast.warning('Aucun produit ne correspond à ce filtre.');
      return;
    }

    const statutIds = new Set(this.draftStatutIds);
    const statutUniformes = PILOTAGE_STATUT_OPTIONS.filter(
      (o) => o.value && statutIds.has(pilotageStatutOptionId(o.value))
    ).map((o) => o.value);

    const catIds = new Set(this.draftCategorieIds);
    const categories = this.categories().filter((c) => catIds.has(pilotageCategoryOptionId(c)));

    const devise = devises.includes('USD') ? 'USD' : devises[0];
    this.criteria.set({
      domaine: domaines[0],
      domaines,
      devise,
      devises,
      from,
      to,
      produitIds,
      produitLabels: choices.filter((c) => picked.includes(c.id)).map((c) => c.label),
      partenaire: partnerKey,
      modePaiement: partnerKey ? this.draftModePaiement : '',
      sousProduit: sousKey,
      ecran: this.hasTransfert() ? this.draftEcran : '',
      statutUniformes,
      categories,
      agenceIds: [...this.draftAgenceIds],
      agentIds: [...this.draftAgentIds],
      typeOperationIds: [],
      jourFiltre: (this.draftJourFiltre || '') as PilotageJourFiltre,
      paysId: this.draftPaysId,
      provinceId: null,
      villeIds: [...this.draftVilleIds],
      territoireId: null,
      communeIds: [...this.draftCommuneIds],
      reseauRegions: this.selectedRegionLabels(),
      zoneIds: [...this.draftZoneIds],
      couloirCodes: [],
      locationLabels: {},
    });
    this.appliedParty.set(this.draftPartyQuery.trim());
    this.page.set(1);
    this.reload();
  }

  setPageSize(size: number): void {
    const next = Number(size);
    if (!this.pageSizes.includes(next)) return;
    this.pageSize.set(next);
    this.page.set(1);
    if (this.criteria()) this.reload();
  }

  go(page: number): void {
    const next = Math.min(this.pageCount(), Math.max(1, page));
    if (next === this.page()) return;
    this.page.set(next);
    this.reload();
  }

  openDetail(row: PilotageTransactionListItem): void {
    if (!row.operationId) return;
    this.openedOperationId.set(row.operationId);
  }

  tableTitle(): string {
    return 'Opérations';
  }

  tableSubtitle(): string {
    if (!this.criteria()) return 'Appliquez les filtres pour charger les transactions';
    const n = this.total();
    return n
      ? `${n.toLocaleString('fr-FR')} transaction(s) · total ${formatValeurFr(this.montantTotal(), this.appliedDevise())}`
      : 'Aucune transaction';
  }

  rangeLabel(): string {
    const total = this.total();
    if (!total) return '0';
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end = Math.min(total, this.page() * this.pageSize());
    return `${start}–${end} / ${total.toLocaleString('fr-FR')}`;
  }

  formatJour(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || '—';
  }

  private reload(): void {
    const c = this.criteria();
    if (!c) return;
    this.loading.set(true);
    this.pilotage.loadTransactions(c, this.page(), this.pageSize(), this.appliedParty()).subscribe({
      next: (page) => {
        this.rows.set(page.lignes ?? []);
        this.total.set(page.total ?? 0);
        this.page.set(page.page ?? 1);
        this.pageSize.set(page.size ?? this.pageSize());
        this.moyenne.set(page.moyenne ?? 0);
        this.montantTotal.set(page.montantTotal ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.rows.set([]);
        this.total.set(0);
        this.loading.set(false);
        this.toast.error('Chargement des transactions impossible.');
      },
    });
  }

  private reloadProduits(): void {
    const domaines = this.resolveDomaines(this.draftDomaineIds);
    if (!domaines.length) {
      this.produits.set([]);
      this.categories.set([]);
      this.typesOperation.set([]);
      return;
    }
    this.filtresLoading.set(true);
    forkJoin(
      domaines.map((domaine) =>
        this.pilotage.loadFiltres(domaine).pipe(
          map((filtres) => ({ domaine, filtres })),
          catchError(() => of(null))
        )
      )
    ).subscribe({
      next: (parts) => {
        const produits: PilotageProduitVue[] = [];
        const cats = new Set<string>();
        const types: PilotageTypeOperation[] = [];
        for (const part of parts) {
          if (!part) continue;
          for (const p of part.filtres.produits ?? []) {
            produits.push({ ...p, domaine: part.domaine });
          }
          for (const c of part.filtres.categories ?? []) cats.add(c);
          for (const t of part.filtres.typesOperation ?? []) types.push(t);
        }
        this.produits.set(produits);
        this.categories.set([...cats].sort((a, b) => a.localeCompare(b, 'fr')));
        this.typesOperation.set(types);
        this.filtresLoading.set(false);
      },
      error: () => {
        this.produits.set([]);
        this.filtresLoading.set(false);
      },
    });
  }

  private resolveDomaines(ids: number[]): PilotageDomaine[] {
    const selected = new Set(ids);
    return this.domaines()
      .filter((d) => selected.has(pilotageDomaineOptionId(d.code)))
      .map((d) => d.code);
  }

  private resolveDevises(ids: number[]): string[] {
    const selected = new Set(ids);
    return this.devises().filter((d) => selected.has(pilotageDeviseOptionId(d)));
  }

  private selectedRegionLabels(): string[] {
    const ids = new Set(this.draftRegionIds);
    return this.regions()
      .filter((r) => ids.has(r.id))
      .map((r) => r.libelle);
  }

  private loadZones(labels: string[]): void {
    this.pilotage.listReseauZones(labels).subscribe({
      next: (rows) => this.zones.set(rows ?? []),
      error: () => this.zones.set([]),
    });
  }

  protected readonly formatValeurFr = formatValeurFr;
  protected readonly formatNumberFr = formatNumberFr;
}
