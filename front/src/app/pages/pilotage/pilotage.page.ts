import { CommonModule, Location } from '@angular/common';
import { HttpParams } from '@angular/common/http';
import { ChartConfiguration } from 'chart.js';
import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { FormsModule } from '@angular/forms';
import {
  PERIOD_PRESETS,
  PeriodPresetId,
  periodPresetRange,
} from '../../shared/utils/format.utils';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { FilterPanelComponent } from '../../shared/components/filter-panel/filter-panel.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { ChartHostComponent } from '../../shared/components/chart-host/chart-host.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { formatNumberFr, formatValeurFr } from '../../shared/utils/format.utils';
import { MultiSelectComponent, MultiSelectOption } from '../../shared/components/multi-select/multi-select.component';
import { Commune, GeoPoint, Pays, Ville } from '../../core/models/api.models';
import {
  PilotageAgenceGeoPoint,
  PilotageAgenceRank,
  PilotageAgenceScope,
  PilotageBundle,
  PilotageCriteria,
  PilotageDomaine,
  PilotageDomaineOption,
  PilotageJourFiltre,
  PilotageLocationLabels,
  PilotageReseauRef,
} from '../../core/models/pilotage.models';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { PilotageService } from '../../core/services/pilotage.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { HeatmapCalendarComponent } from '../../shared/components/heatmap-calendar/heatmap-calendar.component';
import { GeoMapComponent } from '../../shared/components/geo-map/geo-map.component';
import type { HeatMetric, MapMetric } from '../../shared/utils/heat-scale.utils';
import { PilotageAgencySelectComponent } from './components/pilotage-agency-select.component';
import { PilotageAgencyModalComponent } from './components/pilotage-agency-modal.component';
import { PilotageAgentSelectComponent } from './components/pilotage-agent-select.component';
import {
  PILOTAGE_JOUR_OPTIONS,
  PILOTAGE_STATUT_OPTIONS,
  pilotageEcransForDomain,
  pilotageCategoryOptionId,
  pilotageCouloirOptionId,
  pilotageStatutOptionId,
  pilotageDomaineOptionId,
  pilotagePartenaireLabel,
  pilotageCompactKey,
  pilotageIsMobileMoneyProduit,
  buildPilotageProduitChoices,
  resolvePilotageProduitIds,
  PilotageEcranOption,
  PilotageProduitVue,
  PilotageProduitChoice,
} from './pilotage-filtres.config';
import {
  buildPilotageProductBar,
  buildPilotageProductDonut,
  buildPilotageProductLinesChart,
  buildPilotageSeriesChart,
  PilotageSeriesGranularity,
} from './pilotage-charts.util';
import { downloadPilotageExcel } from './pilotage-excel.export';
import { downloadPilotageProduitsMensuelExcel } from './pilotage-produits-mensuel.export';
import { buildPilotageReportIdentity } from './pilotage-report-identity';

const DEFAULT_DOMAINES: PilotageDomaineOption[] = [
  { code: 'transfert', label: 'Transferts' },
  { code: 'monnaie', label: 'Monnaie' },
  { code: 'service', label: 'Services' },
];

@Component({
  selector: 'app-pilotage',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    FilterPanelComponent,
    SkeletonComponent,
    MultiSelectComponent,
    PilotageAgencySelectComponent,
    PilotageAgencyModalComponent,
    PilotageAgentSelectComponent,
    SectionCardComponent,
    KpiCardComponent,
    ChartHostComponent,
    EmptyStateComponent,
    HeatmapCalendarComponent,
    GeoMapComponent,
  ],
  template: `
    @if (openedAgency(); as agency) {
      @if (criteria(); as c) {
        <app-pilotage-agency-modal
          [agency]="agency"
          [criteria]="c"
          [produits]="produits()"
          [domaines]="domaines()"
          [devises]="devises()"
          (closed)="openedAgency.set(null)"
        />
      }
    }
    @if (exportingExcel()) {
      <div class="pilotage-export-loader" role="status" aria-live="polite" aria-busy="true">
        <div class="pilotage-export-loader__card">
          <img
            class="pilotage-export-loader__mark flash-brand-pulse"
            [src]="exportFavicon()"
            alt=""
            width="64"
            height="64"
          />
          <p class="pilotage-export-loader__title">Export en cours</p>
          <p class="pilotage-export-loader__hint">Préparation du classeur Excel</p>
          <div class="pilotage-export-loader__line">
            <span
              class="pilotage-export-loader__track"
              role="progressbar"
              [attr.aria-valuenow]="exportProgress()"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <span class="pilotage-export-loader__bar" [style.width.%]="exportProgress()"></span>
            </span>
            <span class="pilotage-export-loader__pct">{{ exportProgress() }}%</span>
          </div>
        </div>
      </div>
    }
    <app-page-header title="Tableau de bord">
      @if (!metaLoading() && dataFrom() && dataTo()) {
        <span actions class="pilotage-header-meta">
          Historique {{ formatDateFr(dataFrom()!) }} — {{ formatDateFr(dataTo()!) }}
        </span>
      }
    </app-page-header>

    @if (metaLoading()) {
      <app-skeleton type="table" [rows]="2" [cols]="4" />
    } @else {
      @if (!metaReady()) {
        <div class="alert alert-warning pilotage-alert-compact mb-3" role="status">
          Entrepôt pilotage non connecté.
        </div>
      }

      <app-filter-panel title="Filtres" [expanded]="true">
        <div class="pilotage-filters-unified">
          <section class="pilotage-filter-group" aria-labelledby="pilotage-grp-periode">
            <h3 class="pilotage-filter-group__title" id="pilotage-grp-periode">Période et périmètre</h3>
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
                <select class="form-select" [(ngModel)]="draftDevise">
                  @for (c of devises(); track c) {
                    <option [value]="c">{{ c }}</option>
                  }
                </select>
              </div>
              <div class="filter-field">
                <label class="form-label">Du</label>
                <input
                  type="date"
                  class="form-control"
                  [(ngModel)]="draftFrom"
                  (ngModelChange)="activePreset = null"
                  [min]="dataFrom() || undefined"
                  [max]="dataTo() || undefined"
                />
              </div>
              <div class="filter-field">
                <label class="form-label">Au</label>
                <input
                  type="date"
                  class="form-control"
                  [(ngModel)]="draftTo"
                  (ngModelChange)="activePreset = null"
                  [min]="dataFrom() || undefined"
                  [max]="dataTo() || undefined"
                />
              </div>
            </div>
          </section>

          @if (metaReady()) {
            <section class="pilotage-filter-group" aria-labelledby="pilotage-grp-produits">
              <h3 class="pilotage-filter-group__title" id="pilotage-grp-produits">Produits et statut</h3>
              @if (filtresLoading()) {
                <app-skeleton type="table" [rows]="1" [cols]="3" />
              } @else {
                <div
                  class="pilotage-filter-row pilotage-filter-row--products"
                  [class.pilotage-filter-row--products-transfert]="hasTransfert()"
                >
                  @if (hasTransfert()) {
                    <div class="filter-field">
                      <label class="form-label">Sens du transfert</label>
                      <select class="form-select" [(ngModel)]="draftEcran" (ngModelChange)="onSensTransfertChange()">
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
                      [placeholder]="produitsPlaceholder()"
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
                </div>
              }
            </section>

            <button
              type="button"
              class="pilotage-detail-toggle"
              [attr.aria-expanded]="detailFiltresOpen()"
              (click)="toggleDetailFiltres()"
            >
              <span class="pilotage-detail-toggle__label">
                <i
                  class="bi pilotage-detail-toggle__chevron"
                  [class.bi-chevron-right]="!detailFiltresOpen()"
                  [class.bi-chevron-down]="detailFiltresOpen()"
                ></i>
                Réseau
              </span>
              @if (detailFiltresCount() > 0) {
                <span class="pilotage-detail-toggle__badge">{{ detailFiltresCount() }} actif(s)</span>
              }
            </button>

            <div
              class="pilotage-detail-panel pilotage-detail-panel--compact"
              [class.pilotage-detail-panel--closed]="!detailFiltresOpen()"
              [attr.hidden]="detailFiltresOpen() ? null : ''"
            >
              <div
                class="pilotage-filter-row pilotage-filter-row--detail-main"
                [class.pe-none]="filtresLoading()"
                [class.opacity-50]="filtresLoading()"
              >
                <div class="filter-field">
                  <label class="form-label" for="pilotage-pays">Pays</label>
                  <select
                    id="pilotage-pays"
                    class="form-select form-select-sm"
                    [ngModel]="draftPaysId"
                    (ngModelChange)="onDraftPaysChange($event)"
                  >
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
                    autocompleteField="flash-pilotage-region"
                  />
                </div>
                <div class="filter-field">
                  <label class="form-label">Zone</label>
                  <app-multi-select
                    [options]="zoneOptions()"
                    [selectedIds]="draftZoneIds"
                    (selectedIdsChange)="onDraftZoneIdsChange($event)"
                    placeholder="Toutes"
                    autocompleteField="flash-pilotage-zone"
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
                    autocompleteField="flash-pilotage-ville"
                  />
                </div>
                <div class="filter-field">
                  <label class="form-label">Commune</label>
                  <app-multi-select
                    [options]="communeOptions()"
                    [selectedIds]="draftCommuneIds"
                    [disabled]="!draftVilleIds.length"
                    (selectedIdsChange)="onDraftCommuneIdsChange($event)"
                    placeholder="Toutes"
                    autocompleteField="flash-pilotage-commune"
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
                    #agencySelect
                    [agenceScope]="buildAgenceScope()"
                    [selectedIds]="draftAgenceIds"
                    (selectedIdsChange)="onAgenceIdsChange($event)"
                  />
                </div>
                <div class="filter-field">
                  <label class="form-label">Agent</label>
                  <app-pilotage-agent-select
                    #agentSelect
                    [agenceIds]="draftAgenceIds"
                    [agenceScope]="buildAgenceScope()"
                    [selectedIds]="draftAgentIds"
                    (selectedIdsChange)="onAgentIdsChange($event)"
                  />
                </div>
                @if (typesOperation().length) {
                  <div class="filter-field">
                    <label class="form-label">Type op.</label>
                    <app-multi-select
                      [options]="typeOperationOptions()"
                      [(selectedIds)]="draftTypeOperationIds"
                      placeholder="Tous"
                    />
                  </div>
                }
                <div class="filter-field">
                  <label class="form-label">Jours</label>
                  <select class="form-select form-select-sm" [(ngModel)]="draftJourFiltre">
                    @for (j of jourOptions; track j.value) {
                      <option [value]="j.value">{{ j.label }}</option>
                    }
                  </select>
                </div>
                @if (hasTransfert()) {
                  <div class="filter-field">
                    <label class="form-label" for="pilotage-sens-couloir">Sens du corridor</label>
                    <select
                      id="pilotage-sens-couloir"
                      class="form-select form-select-sm"
                      [ngModel]="sensCouloir()"
                      (ngModelChange)="onSensCouloirChange($event)"
                    >
                      <option value="">Tous</option>
                      <option value="envoi">Envois</option>
                      <option value="retrait">Retraits</option>
                    </select>
                  </div>
                  <div class="filter-field pilotage-couloirs-field">
                    <label class="form-label" for="pilotage-corridors">Corridors</label>
                    @if (couloirsLoading()) {
                      <app-skeleton type="table" [rows]="1" [cols]="1" />
                    } @else {
                      <app-multi-select
                        class="pilotage-couloirs-select"
                        [options]="couloirOptions()"
                        [(selectedIds)]="draftCouloirIds"
                        placeholder="Tous les corridors"
                      />
                    }
                  </div>
                }
              </div>

            </div>
          }

          <div class="pilotage-filters-actions">
            <button class="btn btn-outline-secondary" type="button" (click)="resetFilters()">
              Réinitialiser
            </button>
            <button class="btn btn-primary" type="button" (click)="applySearch()">
              <i class="bi bi-search me-1"></i>Appliquer
            </button>
          </div>
        </div>
      </app-filter-panel>

      @if (criteria(); as c) {
        <div class="pilotage-scope-bar" aria-label="Périmètre sélectionné">
          <span class="pilotage-scope-chip">
            <i class="bi bi-layers"></i>
            {{ domainesLabel(c.domaines?.length ? c.domaines : [c.domaine]) }}
          </span>
          <span class="pilotage-scope-chip">
            <i class="bi bi-currency-exchange"></i>
            {{ c.devise }}
          </span>
          <span class="pilotage-scope-chip pilotage-scope-chip--period">
            <i class="bi bi-calendar3"></i>
            {{ formatDateFr(c.from) }} — {{ formatDateFr(c.to) }}
          </span>
          @for (chip of optionalScopeChips(c); track chip) {
            <span class="pilotage-scope-chip pilotage-scope-chip--muted">{{ chip }}</span>
          }
        </div>

        @if (bundleLoading() || bundle()) {
          <div class="pilotage-kpi-grid">
            @if (bundleLoading()) {
              <app-kpi-card label="Volume" icon="bi bi-activity" [loading]="true" />
              <app-kpi-card label="Montant" icon="bi bi-cash-stack" [loading]="true" />
              <app-kpi-card label="Commission" icon="bi bi-percent" [loading]="true" />
              <app-kpi-card label="Ticket moyen" icon="bi bi-receipt" [loading]="true" />
              <app-kpi-card label="Succès" icon="bi bi-check2-circle" variant="secondary" [loading]="true" />
              <app-kpi-card label="MoM montant" icon="bi bi-graph-up-arrow" [loading]="true" />
              <app-kpi-card label="YoY montant" icon="bi bi-calendar-range" [loading]="true" />
            } @else if (bundle(); as b) {
              <app-kpi-card
                label="Volume"
                icon="bi bi-activity"
                [value]="formatPilotageNumber(b.kpis.volume)"
                [valueTitle]="formatNumberFr(b.kpis.volume)"
                [loading]="false"
              />
              <app-kpi-card
                label="Montant"
                icon="bi bi-cash-stack"
                [value]="formatPilotageMontant(b.kpis.montant, b.devise)"
                [valueTitle]="formatValeurFr(b.kpis.montant, b.devise)"
                [loading]="false"
              />
              @if (hasSagWuCommission(b)) {
                <app-kpi-card
                  label="Commission"
                  icon="bi bi-percent"
                  [value]="formatPilotageMontant(b.kpis.commission, b.devise)"
                  [valueTitle]="formatValeurFr(b.kpis.commission, b.devise)"
                  [loading]="false"
                />
              }
              <app-kpi-card
                label="Ticket moyen"
                icon="bi bi-receipt"
                [value]="formatPilotageMontant(b.kpis.ticketMoyen, b.devise)"
                [valueTitle]="formatValeurFr(b.kpis.ticketMoyen, b.devise)"
                [loading]="false"
              />
              <app-kpi-card
                label="Succès"
                icon="bi bi-check2-circle"
                variant="secondary"
                [value]="formatPilotageNumber(b.kpis.volumeSucces)"
                [valueTitle]="formatNumberFr(b.kpis.volumeSucces)"
                [loading]="false"
              />
              <app-kpi-card
                label="MoM montant"
                icon="bi bi-graph-up-arrow"
                [growthMetric]="true"
                [delta]="b.kpis.momMontantPct"
                [loading]="false"
              />
              <app-kpi-card
                label="YoY montant"
                icon="bi bi-calendar-range"
                [growthMetric]="true"
                [delta]="b.kpis.yoyMontantPct"
                [loading]="false"
              />
            }
          </div>

          @if (chartSensAvailable()) {
            <div class="pilotage-charts-sens">
              <p class="pilotage-charts-sens__label">{{ chartSensLabel() }}</p>
              <div class="btn-group btn-group-sm pilotage-chart-toggle" role="group" [attr.aria-label]="chartSensLabel()">
                <button
                  type="button"
                  class="btn"
                  [class.btn-primary]="!chartSens()"
                  [class.btn-outline-secondary]="!!chartSens()"
                  [disabled]="bundleLoading()"
                  (click)="onChartSensChange('')"
                >
                  Tous
                </button>
                @for (e of chartSensOptions(); track e.id) {
                  <button
                    type="button"
                    class="btn"
                    [class.btn-primary]="chartSens() === e.id"
                    [class.btn-outline-secondary]="chartSens() !== e.id"
                    [disabled]="bundleLoading()"
                    (click)="onChartSensChange(e.id)"
                  >
                    {{ e.label }}
                  </button>
                }
              </div>
            </div>
          }

          <div class="pilotage-charts-grid pilotage-charts-grid--quad">
            <app-section-card
              [title]="seriesChartTitle()"
              [subtitle]="seriesChartSubtitle()"
            >
              <div actions class="pilotage-chart-toolbar">
                <div class="btn-group btn-group-sm pilotage-chart-toggle" role="group" aria-label="Séries">
                  <button
                    type="button"
                    class="btn"
                    [class.btn-primary]="seriesShowMontant()"
                    [class.btn-outline-secondary]="!seriesShowMontant()"
                    [disabled]="bundleLoading()"
                    (click)="toggleSeriesMontant()"
                  >
                    Montant
                  </button>
                  <button
                    type="button"
                    class="btn"
                    [class.btn-primary]="seriesShowVolume()"
                    [class.btn-outline-secondary]="!seriesShowVolume()"
                    [disabled]="bundleLoading()"
                    (click)="toggleSeriesVolume()"
                  >
                    Volume
                  </button>
                </div>
                <select
                  class="form-select form-select-sm pilotage-chart-granularity"
                  [ngModel]="seriesGranularity()"
                  (ngModelChange)="seriesGranularity.set($event)"
                  [disabled]="bundleLoading()"
                  aria-label="Granularité"
                >
                  <option value="day">Jour</option>
                  <option value="week">Semaine</option>
                  <option value="month">Mois</option>
                </select>
              </div>
              @if (bundleLoading()) {
                <div class="pilotage-section-skeleton">
                  <app-skeleton type="chart" height="18rem" />
                </div>
              } @else if (activeSeriesChart(); as cfg) {
                <app-chart-host [config]="cfg" height="18rem" [enableZoom]="seriesGranularity() === 'day'" />
              } @else {
                <app-empty-state title="Aucune série" message="Pas de données sur cette période." />
              }
            </app-section-card>

            <app-section-card title="Produits" [subtitle]="productChartSubtitle()">
              <div actions class="pilotage-chart-toolbar">
                <div class="btn-group btn-group-sm pilotage-chart-toggle" role="group" aria-label="Vue produits">
                  <button
                    type="button"
                    class="btn"
                    [class.btn-primary]="productView() === 'donut'"
                    [class.btn-outline-secondary]="productView() !== 'donut'"
                    [disabled]="bundleLoading()"
                    (click)="productView.set('donut')"
                  >
                    Répartition
                  </button>
                  <button
                    type="button"
                    class="btn"
                    [class.btn-primary]="productView() === 'bar'"
                    [class.btn-outline-secondary]="productView() !== 'bar'"
                    [disabled]="bundleLoading()"
                    (click)="productView.set('bar')"
                  >
                    Barres
                  </button>
                  <button
                    type="button"
                    class="btn"
                    [class.btn-primary]="productView() === 'lines'"
                    [class.btn-outline-secondary]="productView() !== 'lines'"
                    [disabled]="bundleLoading()"
                    (click)="productView.set('lines')"
                  >
                    Courbes
                  </button>
                </div>
                @if (productView() === 'lines') {
                  <select
                    class="form-select form-select-sm pilotage-chart-granularity"
                    [ngModel]="seriesGranularity()"
                    (ngModelChange)="seriesGranularity.set($event)"
                    [disabled]="bundleLoading()"
                    aria-label="Granularité courbes produits"
                  >
                    <option value="day">Jour</option>
                    <option value="week">Semaine</option>
                    <option value="month">Mois</option>
                  </select>
                }
              </div>
              @if (bundleLoading()) {
                <div class="pilotage-section-skeleton">
                  <app-skeleton type="donut" height="18rem" />
                </div>
              } @else if (activeProductChart(); as cfg) {
                <app-chart-host [config]="cfg" height="18rem" [enableZoom]="productView() === 'lines' && seriesGranularity() === 'day'" />
              } @else {
                <app-empty-state
                  [title]="productView() === 'lines' ? 'Aucune courbe' : 'Aucun produit'"
                  [message]="productView() === 'lines' ? 'Pas de série produit sur cette période.' : 'Pas de ventilation produit.'"
                />
              }
            </app-section-card>

            <app-section-card title="Heatmap journalière" subtitle="Orange = faible · Vert = fort sur la période">
              <div actions class="pilotage-chart-toolbar">
                <div class="btn-group btn-group-sm pilotage-chart-toggle" role="group" aria-label="Métrique heatmap">
                  <button
                    type="button"
                    class="btn"
                    [class.btn-primary]="heatmapMetric() === 'value'"
                    [class.btn-outline-secondary]="heatmapMetric() !== 'value'"
                    [disabled]="bundleLoading()"
                    (click)="heatmapMetric.set('value')"
                  >
                    Montant
                  </button>
                  <button
                    type="button"
                    class="btn"
                    [class.btn-primary]="heatmapMetric() === 'volume'"
                    [class.btn-outline-secondary]="heatmapMetric() !== 'volume'"
                    [disabled]="bundleLoading()"
                    (click)="heatmapMetric.set('volume')"
                  >
                    Volume
                  </button>
                </div>
              </div>
              @if (bundleLoading()) {
                <div class="pilotage-section-skeleton">
                  <app-skeleton type="chart" height="18rem" />
                </div>
              } @else if (bundle()?.timeseries?.length) {
                <app-heatmap-calendar [data]="bundle()!.timeseries" [metric]="heatmapMetric()" />
              } @else {
                <app-empty-state title="Aucune journée" message="Pas de série journalière sur cette période." />
              }
            </app-section-card>

            <app-section-card
              title="Carte des agences"
              [subtitle]="agencyMapSubtitle()"
            >
              <div actions class="pilotage-chart-toolbar">
                <div class="btn-group btn-group-sm pilotage-chart-toggle" role="group" aria-label="Métrique carte">
                  <button
                    type="button"
                    class="btn"
                    [class.btn-primary]="mapMetric() === 'value'"
                    [class.btn-outline-secondary]="mapMetric() !== 'value'"
                    [disabled]="bundleLoading()"
                    (click)="mapMetric.set('value')"
                  >
                    Montant
                  </button>
                  <button
                    type="button"
                    class="btn"
                    [class.btn-primary]="mapMetric() === 'volume'"
                    [class.btn-outline-secondary]="mapMetric() !== 'volume'"
                    [disabled]="bundleLoading()"
                    (click)="mapMetric.set('volume')"
                  >
                    Volume
                  </button>
                  <button
                    type="button"
                    class="btn"
                    [class.btn-primary]="mapMetric() === 'presence'"
                    [class.btn-outline-secondary]="mapMetric() !== 'presence'"
                    [disabled]="bundleLoading() || !allGeoReady()"
                    (click)="mapMetric.set('presence')"
                  >
                    Présence
                  </button>
                </div>
              </div>
              @if (bundleLoading() || (mapMetric() === 'presence' && !allGeoReady())) {
                <div class="pilotage-section-skeleton">
                  <app-skeleton type="chart" height="18rem" />
                </div>
              } @else if (agencyMapPoints().length) {
                <app-geo-map
                  [points]="agencyMapPoints()"
                  [activityMetric]="mapHeatMetric()"
                  [presenceMode]="mapMetric() === 'presence'"
                  [pinIconUrl]="exportFavicon()"
                  height="100%"
                  (agencyClick)="openAgencyById($event)"
                />
              } @else {
                <app-empty-state
                  title="Aucune localisation"
                  message="Aucune agence du périmètre n’a de latitude / longitude."
                />
              }
            </app-section-card>
          </div>

          <app-section-card [title]="agencyOrder() === 'top' ? 'Top agences' : 'Dernières agences'" [subtitle]="agencySubtitle()">
            <div actions class="pilotage-chart-toolbar">
              <div class="btn-group btn-group-sm pilotage-chart-toggle" role="group" aria-label="Sens du classement">
                <button
                  type="button"
                  class="btn"
                  [class.btn-primary]="agencyOrder() === 'top'"
                  [class.btn-outline-secondary]="agencyOrder() !== 'top'"
                  (click)="setAgencyOrder('top')"
                >
                  Top
                </button>
                <button
                  type="button"
                  class="btn"
                  [class.btn-primary]="agencyOrder() === 'pire'"
                  [class.btn-outline-secondary]="agencyOrder() !== 'pire'"
                  (click)="setAgencyOrder('pire')"
                >
                  Dernières
                </button>
              </div>
              <select
                class="form-select form-select-sm pilotage-agency-page-size"
                aria-label="Agences par page"
                [ngModel]="agencyPageSize()"
                (ngModelChange)="setAgencyPageSize($event)"
              >
                @for (size of agencyPageSizes; track size) {
                  <option [ngValue]="size">{{ size }} / page</option>
                }
              </select>
              <div class="pilotage-export-collapse" [class.is-open]="exportMenuOpen()">
                <button
                  type="button"
                  class="btn btn-sm btn-outline-dark"
                  [disabled]="exportingExcel()"
                  [attr.aria-expanded]="exportMenuOpen()"
                  aria-controls="pilotage-export-panel"
                  (click)="toggleExportMenu($event)"
                >
                  <i class="bi bi-download me-1"></i>
                  {{ exportingExcel() ? 'Export…' : 'Exporter' }}
                  <i
                    class="bi ms-1"
                    [class.bi-chevron-up]="exportMenuOpen()"
                    [class.bi-chevron-down]="!exportMenuOpen()"
                    aria-hidden="true"
                  ></i>
                </button>
                @if (exportMenuOpen()) {
                  <div
                    id="pilotage-export-panel"
                    class="pilotage-export-collapse__panel shadow-sm"
                    role="menu"
                    (click)="$event.stopPropagation()"
                  >
                    <button
                      type="button"
                      class="pilotage-export-collapse__item"
                      role="menuitem"
                      [disabled]="exportingExcel()"
                      (click)="exportAgences()"
                    >
                      <span class="pilotage-export-collapse__item-title">
                        <i class="bi bi-building me-2" aria-hidden="true"></i>
                        Agences et opérations
                      </span>
                      <span class="pilotage-export-collapse__item-desc">
                        Classement agences, détail des opérations et analyses.
                      </span>
                    </button>
                    <button
                      type="button"
                      class="pilotage-export-collapse__item"
                      role="menuitem"
                      [disabled]="exportingExcel()"
                      (click)="exportProduitsMensuel()"
                    >
                      <span class="pilotage-export-collapse__item-title">
                        <i class="bi bi-calendar3 me-2" aria-hidden="true"></i>
                        Produits par mois
                      </span>
                      <span class="pilotage-export-collapse__item-desc">
                        Volume et valeur mensuels par produit, totaux et graphique Flash.
                      </span>
                    </button>
                  </div>
                }
              </div>
            </div>
            @if (agencyLoading() || bundleLoading()) {
              <app-skeleton type="table" [rows]="6" [cols]="4" />
            } @else if (agencyPageRows().length) {
              <div class="table-responsive">
                <table class="table table-sm align-middle mb-0 pilotage-top-agences">
                  <thead>
                    <tr>
                      <th style="width: 3rem">#</th>
                      <th>Agence</th>
                      <th class="text-end">Volume</th>
                      <th class="text-end">Montant</th>
                      @if (hasSagWuCommission(bundle())) {
                        <th class="text-end">Commission</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of agencyPageRows(); track item.row.agenceId) {
                      <tr
                        class="pilotage-agency-row"
                        [ngClass]="agencyRankClass(item.rank)"
                        tabindex="0"
                        (click)="openAgency(item.row)"
                        (keydown.enter)="openAgency(item.row)"
                      >
                        <td>
                          <span class="agency-rank-badge" [ngClass]="agencyBadgeClass(item.rank)">{{ item.rank + 1 }}</span>
                        </td>
                        <td>
                          <span class="d-block fw-semibold">{{ item.row.nom || item.row.codeAgence }}</span>
                          @if (agencyCodeLine(item.row); as codeLine) {
                            <small class="text-muted font-monospace">{{ codeLine }}</small>
                          }
                        </td>
                        <td class="text-end text-nowrap">{{ formatPilotageNumber(item.row.volume) }}</td>
                        <td class="text-end text-nowrap" [title]="formatValeurFr(item.row.montant, bundle()?.devise ?? 'USD')">
                          {{ formatPilotageMontant(item.row.montant, bundle()?.devise ?? 'USD') }}
                        </td>
                        @if (hasSagWuCommission(bundle())) {
                          <td class="text-end text-nowrap" [title]="formatValeurFr(item.row.commission, bundle()?.devise ?? 'USD')">
                            {{ formatPilotageMontant(item.row.commission, bundle()?.devise ?? 'USD') }}
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <div class="pilotage-agency-pager">
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary"
                  [disabled]="currentAgencyPage() <= 1"
                  (click)="setAgencyPage(currentAgencyPage() - 1)"
                >
                  Précédent
                </button>
                <span>{{ agencyRangeLabel() }}</span>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary"
                  [disabled]="currentAgencyPage() >= agencyPageCount()"
                  (click)="setAgencyPage(currentAgencyPage() + 1)"
                >
                  Suivant
                </button>
              </div>
            } @else {
              <app-empty-state title="Aucune agence" message="Pas de volume agence sur ce périmètre." />
            }
          </app-section-card>
        } @else if (criteria() && bundleError()) {
          <div class="alert alert-warning pilotage-alert-compact" role="alert">
            Indicateurs indisponibles pour ce périmètre.
          </div>
        }
      }
    }
  `,
  styles: `
    .pilotage-export-collapse {
      position: relative;
    }

    .pilotage-export-collapse__panel {
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

    .pilotage-export-collapse__item {
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

    .pilotage-export-collapse__item:hover:not(:disabled),
    .pilotage-export-collapse__item:focus-visible {
      background: var(--flash-gray-100, rgba(0, 0, 0, 0.04));
      outline: none;
    }

    .pilotage-export-collapse__item:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .pilotage-export-collapse__item-title {
      display: inline-flex;
      align-items: center;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .pilotage-export-collapse__item-desc {
      font-size: 0.75rem;
      line-height: 1.35;
      color: var(--text-muted);
    }

    :host-context([data-bs-theme='dark']) .pilotage-export-collapse__item:hover:not(:disabled),
    :host-context([data-bs-theme='dark']) .pilotage-export-collapse__item:focus-visible {
      background: #2a2a2a;
    }

    .pilotage-export-loader {
      position: fixed;
      inset: 0;
      z-index: 1080;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(17, 17, 17, 0.32);
      backdrop-filter: blur(5px);
    }

    .pilotage-export-loader__card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;
      min-width: 16.5rem;
      padding: 1.65rem 2rem 1.4rem;
      border-radius: 1rem;
      background: var(--card-bg, #fff);
      border: 1px solid var(--card-border, #e5e7eb);
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.18);
    }

    .pilotage-export-loader__card::before {
      content: '';
      width: 2.75rem;
      height: 3px;
      margin-bottom: 0.85rem;
      border-radius: 999px;
      background: #ffd500;
    }

    .pilotage-export-loader__mark {
      width: 3.5rem;
      height: 3.5rem;
      object-fit: contain;
      margin-bottom: 0.45rem;
    }

    .pilotage-export-loader__title {
      margin: 0;
      font-weight: 650;
      letter-spacing: -0.02em;
      color: var(--bs-body-color, #111);
    }

    .pilotage-export-loader__hint {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--text-muted, #6b7280);
    }

    .pilotage-export-loader__line {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      width: 11.5rem;
      margin-top: 0.85rem;
    }

    .pilotage-export-loader__track {
      flex: 1;
      height: 2px;
      border-radius: 999px;
      background: color-mix(in srgb, currentColor 14%, transparent);
      overflow: hidden;
    }

    .pilotage-export-loader__bar {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: #ffd500;
      transition: width 0.28s ease;
    }

    .pilotage-export-loader__pct {
      flex: 0 0 auto;
      font-size: 0.6875rem;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
      color: var(--text-muted, #9ca3af);
    }

    .pilotage-agency-page-size {
      width: auto;
      min-width: 6.5rem;
    }

    .pilotage-agency-pager {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.75rem;
      margin-top: 0.75rem;
      color: var(--text-muted, #6b7280);
      font-size: 0.8125rem;
    }

    .pilotage-agency-row {
      cursor: pointer;
    }

    .pilotage-agency-row:hover {
      outline: 1px solid color-mix(in srgb, #ffd500 75%, transparent);
      outline-offset: -1px;
    }

    .pilotage-agency-row:focus-visible {
      outline: 2px solid #ffd500;
      outline-offset: -2px;
    }
  `,
})
export class PilotagePageComponent implements OnInit, OnDestroy {
  private readonly pilotage = inject(PilotageService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly appSettings = inject(AppSettingsService);
  private readonly toast = inject(ToastService);
  private readonly theme = inject(ThemeService);

  @ViewChild('agencySelect') agencySelect?: PilotageAgencySelectComponent;
  @ViewChild('agentSelect') agentSelect?: PilotageAgentSelectComponent;

  readonly periodPresets = PERIOD_PRESETS;
  readonly jourOptions = PILOTAGE_JOUR_OPTIONS;

  activePreset: PeriodPresetId | null = '30d';

  readonly metaLoading = signal(true);
  readonly metaReady = signal(false);
  readonly filtresLoading = signal(false);
  readonly domaines = signal<PilotageDomaineOption[]>(DEFAULT_DOMAINES);
  readonly devises = signal<string[]>(['CDF', 'USD']);
  readonly dataFrom = signal<string | null>(null);
  readonly dataTo = signal<string | null>(null);
  readonly criteria = signal<PilotageCriteria | null>(null);
  readonly bundle = signal<PilotageBundle | null>(null);
  readonly bundleLoading = signal(false);
  readonly bundleError = signal(false);
  readonly exportingExcel = signal(false);
  readonly exportMenuOpen = signal(false);
  readonly agencyPageSizes = [5, 10, 20, 50];
  readonly agencyOrder = signal<'top' | 'pire'>('top');
  readonly agencyPageSize = signal(10);
  readonly agencyPage = signal(1);
  readonly agencyTotal = signal(0);
  readonly agencyRows = signal<PilotageAgenceRank[]>([]);
  readonly openedAgency = signal<PilotageAgenceRank | null>(null);
  readonly agencyLoading = signal(false);
  readonly agencyPageCount = computed(() =>
    Math.max(1, Math.ceil(this.agencyTotal() / this.agencyPageSize()))
  );
  readonly agencyPageRows = computed(() => {
    const size = this.agencyPageSize();
    const page = this.currentAgencyPage();
    const start = (page - 1) * size;
    return this.agencyRows().map((row, index) => ({
      row,
      rank: start + index,
    }));
  });
  readonly exportProgress = signal(0);
  private exportCreep: ReturnType<typeof setInterval> | null = null;

  readonly seriesShowMontant = signal(true);
  readonly seriesShowVolume = signal(true);
  readonly seriesGranularity = signal<PilotageSeriesGranularity>('day');
  readonly productView = signal<'donut' | 'bar' | 'lines'>('donut');
  readonly heatmapMetric = signal<HeatMetric>('value');
  readonly mapMetric = signal<MapMetric>('value');
  readonly mapHeatMetric = computed((): HeatMetric => {
    const metric = this.mapMetric();
    return metric === 'presence' ? 'value' : metric;
  });
  readonly allGeoAgences = signal<PilotageAgenceGeoPoint[]>([]);
  readonly allGeoReady = signal(false);

  readonly agencyMapPoints = computed((): GeoPoint[] => {
    const b = this.bundle();
    const devise = (b?.devise || 'USD').trim().toUpperCase();
    if (this.mapMetric() === 'presence') {
      const byId = new Map((b?.geoPoints ?? []).map((p) => [p.agenceId, p]));
      return this.allGeoAgences()
        .filter((g) => Number.isFinite(g.latitude) && Number.isFinite(g.longitude) && g.latitude !== 0 && g.longitude !== 0)
        .map((g) => {
          const hit = byId.get(g.agenceId);
          return {
            agency_id: g.agenceId,
            code: g.codeAgence || String(g.agenceId),
            label: g.nom || g.codeAgence || String(g.agenceId),
            lat: g.latitude,
            lng: g.longitude,
            tx_count: hit?.volume ?? 0,
            volume: hit?.montant ?? 0,
            currency: devise,
            presence: hit ? ('present' as const) : ('missing' as const),
          };
        });
    }
    if (!b?.geoPoints?.length) return [];
    return b.geoPoints
      .filter((g) => Number.isFinite(g.latitude) && Number.isFinite(g.longitude) && g.latitude !== 0 && g.longitude !== 0)
      .map((g) => ({
        agency_id: g.agenceId,
        code: g.codeAgence || String(g.agenceId),
        label: g.nom || g.codeAgence || String(g.agenceId),
        lat: g.latitude,
        lng: g.longitude,
        tx_count: g.volume,
        volume: g.montant,
        currency: devise,
      }));
  });

  readonly activeSeriesChart = computed((): ChartConfiguration | null => {
    const b = this.bundle();
    const theme = this.theme.mode();
    const showMontant = this.seriesShowMontant();
    const showVolume = this.seriesShowVolume();
    const granularity = this.seriesGranularity();
    if (!b?.timeseries?.length) return null;
    if (!showMontant && !showVolume) return null;
    return buildPilotageSeriesChart(
      b.timeseries,
      b.devise,
      { montant: showMontant, volume: showVolume },
      theme,
      granularity
    );
  });

  readonly activeProductChart = computed((): ChartConfiguration | null => {
    const b = this.bundle();
    const theme = this.theme.mode();
    const view = this.productView();
    if (view === 'lines') {
      if (!b?.productTimeseries?.length) return null;
      return buildPilotageProductLinesChart(b.productTimeseries, b.devise, theme, this.seriesGranularity());
    }
    if (!b?.products?.length) return null;
    return view === 'donut'
      ? buildPilotageProductDonut(b.products, theme)
      : buildPilotageProductBar(b.products, theme);
  });

  formatNumberFr = formatNumberFr;
  formatValeurFr = formatValeurFr;

  readonly produits = signal<PilotageProduitVue[]>([]);
  /** Force le recalcul de la liste quand le sens change, sans recharger les produits. */
  private readonly sensListe = signal(0);
  readonly categories = signal<string[]>([]);
  readonly typesOperation = signal<{ typeOperationId: number; libelle: string }[]>([]);

  readonly paysList = signal<Pays[]>([]);
  readonly villesList = signal<Ville[]>([]);
  readonly communesList = signal<Commune[]>([]);
  readonly regionsList = signal<PilotageReseauRef[]>([]);
  readonly zonesList = signal<PilotageReseauRef[]>([]);
  readonly couloirs = signal<{ code: string; label: string }[]>([]);
  readonly couloirsLoading = signal(false);

  /** Envois / Retraits — domaine Transfert uniquement. */
  readonly sensTransfertOptions: PilotageEcranOption[] = pilotageEcransForDomain('transfert');

  readonly productChoices = computed((): PilotageProduitChoice[] => {
    this.sensListe();
    return buildPilotageProduitChoices(this.produits(), this.draftEcran);
  });

  readonly productOptions = computed((): MultiSelectOption[] =>
    this.productChoices().map((choice) => ({
      id: choice.id,
      label: choice.label,
    }))
  );

  readonly domaineOptions = computed((): MultiSelectOption[] =>
    this.domaines().map((d) => ({
      id: pilotageDomaineOptionId(d.code),
      label: this.shortDomainLabel(d.label, d.code),
    }))
  );

  readonly categoryOptions = computed((): MultiSelectOption[] =>
    this.categories().map((cat) => ({
      id: pilotageCategoryOptionId(cat),
      label: cat,
    }))
  );

  readonly statutSelectOptions: MultiSelectOption[] = PILOTAGE_STATUT_OPTIONS.filter((s) => s.value !== '').map(
    (s) => ({
      id: pilotageStatutOptionId(s.value),
      label: s.label,
    })
  );

  readonly typeOperationOptions = computed((): MultiSelectOption[] =>
    this.typesOperation().map((t) => ({
      id: t.typeOperationId,
      label: t.libelle,
    }))
  );

  /** Vide = tous les corridors. Envoi = RDC vers l'étranger. Retrait = l'étranger vers la RDC. */
  readonly sensCouloir = signal<'' | 'envoi' | 'retrait'>('');

  readonly couloirOptions = computed((): MultiSelectOption[] => {
    const sens = this.sensCouloir();
    return this.couloirs()
      .filter((c) => corridorMatchesSens(c.label, sens))
      .map((c) => ({
        id: pilotageCouloirOptionId(c.code),
        label: c.label,
      }));
  });

  /** Agence, agent, calendrier — replié par défaut pour alléger l’écran. */
  readonly detailFiltresOpen = signal(false);

  draftDomaineIds: number[] = [pilotageDomaineOptionId('transfert')];
  draftPartenaire = '';
  draftModePaiement: '' | 'cash' | 'momo' = '';
  draftSousProduit = '';
  draftDevise = 'USD';
  draftFrom = '';
  draftTo = '';

  draftProduitIds: number[] = [];
  draftEcran = '';
  draftStatutIds: number[] = [];
  draftCategorieIds: number[] = [];
  draftAgenceIds: number[] = [];
  draftAgentIds: number[] = [];
  draftTypeOperationIds: number[] = [];
  draftJourFiltre: PilotageJourFiltre = '';

  draftPaysId: number | null = null;
  draftVilleIds: number[] = [];
  draftCommuneIds: number[] = [];
  draftRegionIds: number[] = [];
  draftZoneIds: number[] = [];
  private locationBootstrapped = false;
  private pendingCouloirCodes: string[] | null = null;
  private readonly searchGate = { filtres: false, pays: false, regions: false, couloirs: false };
  draftCouloirIds: number[] = [];

  ngOnDestroy(): void {
    this.stopExportCreep();
  }

  ngOnInit(): void {
    this.resetDraftDates();
    this.pilotage.loadMeta().subscribe({
      next: (meta) => {
        this.domaines.set(meta.domaines?.length ? meta.domaines : DEFAULT_DOMAINES);
        this.devises.set(meta.devises?.length ? meta.devises : ['CDF', 'USD']);
        this.dataFrom.set(meta.dataFrom);
        this.dataTo.set(meta.dataTo);
        this.metaReady.set(meta.pilotageSchemaReady);
        this.draftDevise = this.devises().includes('USD') ? 'USD' : this.devises()[0];
        this.restoreDraftFromUrl();
        this.clampDraftDomaines();
        this.metaLoading.set(false);
        this.loadFiltresForDomains(false);
        this.loadLocationAndReseauRefs();
        this.loadAllGeoAgences();
      },
      error: () => {
        this.metaLoading.set(false);
        this.restoreDraftFromUrl();
        this.toast.error('Métadonnées indisponibles.');
        this.loadAllGeoAgences();
        this.applySearch(false);
      },
    });
  }

  toggleDetailFiltres(): void {
    const opening = !this.detailFiltresOpen();
    this.detailFiltresOpen.set(opening);
    if (opening) {
      this.loadLocationAndReseauRefs(true);
    }
  }

  onDomaineIdsChange(ids: number[]): void {
    this.draftDomaineIds = ids;
    if (!this.hasTransfert()) {
      this.draftEcran = '';
      this.draftCouloirIds = [];
      this.sensCouloir.set('');
    }
    this.draftPartenaire = '';
    this.draftModePaiement = '';
    this.draftSousProduit = '';
    this.sensListe.update((n) => n + 1);
    this.draftProduitIds = [];
    this.draftTypeOperationIds = [];
    this.clearAgenceAgent();
    this.loadFiltresForDomains(true);
  }

  onProduitIdsChange(ids: number[]): void {
    this.draftProduitIds = ids;
    if (!this.flashPaymentSelected()) {
      this.draftPartenaire = '';
      this.draftModePaiement = '';
      this.draftSousProduit = '';
    }
  }

  onPartenaireChange(): void {
    this.draftSousProduit = '';
    if (!this.draftPartenaire) this.draftModePaiement = '';
  }

  onModePaiementChange(): void {
    if (this.draftModePaiement !== 'momo') this.draftSousProduit = '';
  }

  onSensTransfertChange(): void {
    this.sensListe.update((n) => n + 1);
    const valid = new Set(this.productChoices().map((choice) => choice.id));
    this.draftProduitIds = this.draftProduitIds.filter((id) => valid.has(id));
    if (!this.flashPaymentSelected()) {
      this.draftPartenaire = '';
      this.draftModePaiement = '';
      this.draftSousProduit = '';
    } else if (
      this.draftSousProduit &&
      !this.flashPaymentSousProduits().some((item) => item.value === this.draftSousProduit)
    ) {
      this.draftSousProduit = '';
    }
  }

  detailFiltresCount(): number {
    let n = 0;
    if (this.draftPaysId) n++;
    n += this.draftVilleIds.length;
    n += this.draftCommuneIds.length;
    n += this.draftRegionIds.length;
    n += this.draftZoneIds.length;
    n += this.draftCategorieIds.length;
    n += this.draftAgenceIds.length;
    n += this.draftAgentIds.length;
    n += this.draftTypeOperationIds.length;
    if (this.draftJourFiltre) n++;
    return n;
  }

  buildAgenceScope(): PilotageAgenceScope {
    return {
      paysId: this.draftPaysId,
      provinceId: null,
      villeIds: [...this.draftVilleIds],
      territoireId: null,
      communeIds: [...this.draftCommuneIds],
      reseauRegions: this.selectedRegionLabels(),
      zoneIds: [...this.draftZoneIds],
    };
  }

  onDraftPaysChange(id: number | null): void {
    this.draftPaysId = id;
    this.draftVilleIds = [];
    this.draftCommuneIds = [];
    this.communesList.set([]);
    this.clearAgenceAgent();
    this.reloadVillesList();
    if (id) {
      this.detailFiltresOpen.set(true);
    }
  }

  onDraftRegionIdsChange(ids: number[]): void {
    this.draftRegionIds = ids;
    this.draftZoneIds = [];
    this.draftVilleIds = [];
    this.draftCommuneIds = [];
    this.communesList.set([]);
    this.clearAgenceAgent();
    this.reloadZonesList();
    this.reloadVillesList();
    if (ids.length) {
      this.detailFiltresOpen.set(true);
    }
  }

  onDraftZoneIdsChange(ids: number[]): void {
    this.draftZoneIds = ids;
    this.clearAgenceAgent();
    if (ids.length) {
      this.detailFiltresOpen.set(true);
    }
  }

  onDraftVilleIdsChange(ids: number[]): void {
    this.draftVilleIds = ids;
    this.draftCommuneIds = [];
    this.communesList.set([]);
    this.clearAgenceAgent();
    this.reloadCommunesList();
    if (ids.length) {
      this.detailFiltresOpen.set(true);
    }
  }

  onDraftCommuneIdsChange(ids: number[]): void {
    this.draftCommuneIds = ids;
    this.clearAgenceAgent();
    if (ids.length) {
      this.detailFiltresOpen.set(true);
    }
  }

  onSensCouloirChange(value: string): void {
    const sens = value === 'envoi' || value === 'retrait' ? value : '';
    this.sensCouloir.set(sens);
    const allowed = new Set(this.couloirOptions().map((option) => option.id));
    this.draftCouloirIds = this.draftCouloirIds.filter((id) => allowed.has(id));
  }

  regionOptions(): MultiSelectOption[] {
    return this.regionsList().map((region) => ({ id: region.id, label: region.libelle }));
  }

  zoneOptions(): MultiSelectOption[] {
    return this.zonesList().map((zone) => ({ id: zone.id, label: zone.libelle }));
  }

  villeOptions(): MultiSelectOption[] {
    return this.villesList().map((ville) => ({ id: ville.id, label: ville.libelle }));
  }

  communeOptions(): MultiSelectOption[] {
    return this.communesList().map((commune) => ({ id: commune.id, label: commune.libelle }));
  }

  produitsPlaceholder(): string {
    return 'Produits';
  }

  onAgenceIdsChange(ids: number[]): void {
    const prevScope = this.draftAgenceIds.length === 1 ? this.draftAgenceIds[0] : null;
    const nextScope = ids.length === 1 ? ids[0] : null;
    this.draftAgenceIds = ids;
    if (prevScope !== nextScope) {
      this.draftAgentIds = [];
    }
    if (ids.length) {
      this.detailFiltresOpen.set(true);
    }
  }

  onAgentIdsChange(ids: number[]): void {
    this.draftAgentIds = ids;
    if (ids.length) {
      this.detailFiltresOpen.set(true);
    }
  }

  displayDomaineOption(d: PilotageDomaineOption): string {
    return this.shortDomainLabel(d.label, d.code);
  }

  domaineLabel(code: PilotageDomaine): string {
    const d = this.domaines().find((x) => x.code === code);
    return d ? this.shortDomainLabel(d.label, d.code) : code;
  }

  domainesLabel(codes: PilotageDomaine[]): string {
    return codes.map((code) => this.domaineLabel(code)).join(' · ');
  }

  hasTransfert(): boolean {
    return this.selectedDomaines().includes('transfert');
  }

  hasMonnaie(): boolean {
    return this.selectedDomaines().includes('monnaie');
  }

  /**
   * Filtre rapide au-dessus des graphiques : visible si un seul domaine
   * transfert (Envois/Retraits) ou monnaie (Cashin/Cashout/…).
   * Multi-domaines : l’API n’applique pas ecran → pas de contrôle trompeur.
   */
  chartSensAvailable(): boolean {
    const domaines = this.criteria()?.domaines?.length
      ? this.criteria()!.domaines
      : this.selectedDomaines();
    return domaines.length === 1 && (domaines[0] === 'transfert' || domaines[0] === 'monnaie');
  }

  chartSensOptions(): PilotageEcranOption[] {
    const domaines = this.criteria()?.domaines?.length
      ? this.criteria()!.domaines
      : this.selectedDomaines();
    if (domaines.length !== 1) return [];
    return pilotageEcransForDomain(domaines[0]);
  }

  chartSensLabel(): string {
    const domaines = this.criteria()?.domaines?.length
      ? this.criteria()!.domaines
      : this.selectedDomaines();
    return domaines[0] === 'monnaie' ? "Type d'opération" : 'Sens du transfert';
  }

  chartSens(): string {
    return (this.criteria()?.ecran || this.draftEcran || '').trim();
  }

  onChartSensChange(id: string): void {
    if (this.chartSens() === id) return;
    this.draftEcran = id;
    this.draftProduitIds = [];
    this.draftPartenaire = '';
    this.draftModePaiement = '';
    this.draftSousProduit = '';
    this.sensListe.update((n) => n + 1);
    const c = this.criteria();
    if (!c) return;
    // Sens graphique = filtre périmètre immédiat (KPI + séries + produits).
    this.criteria.set({
      ...c,
      ecran: id,
      produitIds: [],
      produitLabels: [],
      partenaire: '',
      modePaiement: '',
      sousProduit: '',
    });
    this.writeDashboardUrl();
    this.refreshBundle();
  }

  formatDateFr(iso: string): string {
    const [y, m, d] = (iso || '').split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  }

  optionalScopeChips(c: PilotageCriteria): string[] {
    const chips: string[] = [];
    if (c.produitLabels?.length) {
      chips.push(
        c.produitLabels.length <= 2 ? c.produitLabels.join(', ') : `${c.produitLabels.length} produits`
      );
    }
    if (c.partenaire) chips.push(`Partenaire : ${pilotagePartenaireLabel(c.partenaire)}`);
    if (c.modePaiement === 'cash') chips.push('Cash');
    if (c.modePaiement === 'momo') chips.push('Mobile money');
    if (c.sousProduit) chips.push(pilotagePartenaireLabel(c.sousProduit));
    if (c.ecran) {
      const domaines = c.domaines?.length ? c.domaines : [c.domaine];
      const ecranDomain = domaines.find((d) => d === 'transfert' || d === 'monnaie');
      if (ecranDomain) {
        const label = pilotageEcransForDomain(ecranDomain).find((e) => e.id === c.ecran)?.label;
        if (label) {
          chips.push(ecranDomain === 'monnaie' ? `Type : ${label}` : `Sens : ${label}`);
        }
      }
    }
    if (c.statutUniformes.length) {
      chips.push(
        c.statutUniformes.length === 1
          ? `Statut : ${c.statutUniformes[0]}`
          : `${c.statutUniformes.length} statut(s)`
      );
    }
    if (c.categories.length) {
      chips.push(
        c.categories.length === 1
          ? `Catégorie : ${c.categories[0]}`
          : `${c.categories.length} catégorie(s)`
      );
    }
    if (c.agenceIds.length) {
      chips.push(
        c.agenceIds.length === 1 ? '1 agence sélectionnée' : `${c.agenceIds.length} agences`
      );
    }
    if (c.agentIds.length) {
      chips.push(c.agentIds.length === 1 ? '1 agent sélectionné' : `${c.agentIds.length} agents`);
    }
    if (c.typeOperationIds.length) {
      chips.push(
        c.typeOperationIds.length === 1
          ? '1 type d’opération'
          : `${c.typeOperationIds.length} types d’opération`
      );
    }
    if (c.jourFiltre === 'hors_weekend') chips.push('Hors week-end');
    if (c.jourFiltre === 'feries') chips.push('Jours fériés');
    if (c.jourFiltre === 'par_mois') chips.push('Vue par mois');
    const loc = c.locationLabels;
    if (loc.pays) chips.push(`Pays : ${loc.pays}`);
    if (loc.province) chips.push(`Province : ${loc.province}`);
    if (loc.ville) chips.push(`Ville : ${loc.ville}`);
    if (loc.territoire) chips.push(`Territoire : ${loc.territoire}`);
    if (loc.commune) chips.push(`Commune : ${loc.commune}`);
    if (loc.region) chips.push(`Région : ${loc.region}`);
    if (loc.zone) chips.push(`Zone : ${loc.zone}`);
    if (c.couloirCodes.length === 1) {
      const label = this.couloirs().find((x) => x.code === c.couloirCodes[0])?.label;
      chips.push(label ? `Corridor : ${label}` : '1 corridor');
    } else if (c.couloirCodes.length > 1) {
      chips.push(`${c.couloirCodes.length} corridors`);
    }
    return chips;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.exportMenuOpen()) this.exportMenuOpen.set(false);
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    if (this.exportingExcel()) return;
    this.exportMenuOpen.update((open) => !open);
  }

  applyPreset(id: PeriodPresetId): void {
    const range = periodPresetRange(id);
    this.draftFrom = range.from;
    this.draftTo = range.to;
    this.activePreset = id;
    this.applySearch();
  }

  agencyMapSubtitle(): string {
    const n = this.agencyMapPoints().length;
    if (this.mapMetric() === 'presence') {
      if (!n) return 'Toutes les agences géolocalisées du périmètre';
      const missing = this.agencyMapPoints().filter((p) => p.presence === 'missing').length;
      return `${n.toLocaleString('fr-FR')} agence(s) · ${missing.toLocaleString('fr-FR')} sans opération`;
    }
    if (!n) return 'Agences géolocalisées du périmètre';
    return `${n.toLocaleString('fr-FR')} agence(s) · contour orange → vert selon min/max`;
  }

  openAgencyById(agenceId: number): void {
    if (!agenceId) return;
    const fromTable = this.agencyRows().find((r) => r.agenceId === agenceId);
    if (fromTable) {
      this.openAgency(fromTable);
      return;
    }
    const geo =
      this.bundle()?.geoPoints?.find((g) => g.agenceId === agenceId) ??
      this.allGeoAgences().find((g) => g.agenceId === agenceId);
    if (!geo) return;
    this.openAgency({
      agenceId: geo.agenceId,
      codeAgence: geo.codeAgence,
      nom: geo.nom,
      categorie: '',
      posId: '',
      region: '',
      zone: '',
      volume: geo.volume,
      montant: geo.montant,
      commission: 0,
      commissionFcn: 0,
      commissionAgent: 0,
      commissionFcnAgent: 0,
    });
  }

  openAgency(row: PilotageAgenceRank): void {
    this.openedAgency.set(row);
  }

  applySearch(showToastOnError = true): boolean {
    this.openedAgency.set(null);
    const from = (this.draftFrom || '').trim();
    const to = (this.draftTo || '').trim();
    const devise = (this.draftDevise || '').trim().toUpperCase();

    const domaines = this.selectedDomaines();
    if (!domaines.length) {
      if (showToastOnError) this.toast.warning('Domaine requis.');
      return false;
    }
    if (!devise) {
      if (showToastOnError) this.toast.warning('Devise requise.');
      return false;
    }
    if (!from || !to) {
      if (showToastOnError) this.toast.warning('Dates requises.');
      return false;
    }
    if (from > to) {
      if (showToastOnError) this.toast.warning('Date de fin invalide.');
      return false;
    }

    const choices = this.productChoices();
    const picked = this.draftProduitIds.filter((id) => choices.some((choice) => choice.id === id));
    const sensActive = this.hasTransfert() && !!this.draftEcran;
    const narrowed =
      picked.length > 0 || sensActive || !!this.draftPartenaire || !!this.draftModePaiement || !!this.draftSousProduit;
    const partnerKey = this.flashPaymentSelected() ? pilotageCompactKey(this.draftPartenaire) : '';
    const sousKey =
      this.draftModePaiement === 'momo' ? pilotageCompactKey(this.draftSousProduit) : '';
    // Normalise les valeurs UI (URL / ancien select) vers les clés dim_produit.
    this.draftPartenaire = partnerKey;
    this.draftSousProduit = sousKey;
    const produitIds = narrowed
      ? resolvePilotageProduitIds(
          choices,
          picked,
          partnerKey,
          this.draftModePaiement,
          sousKey
        )
      : [];
    if (narrowed && !produitIds.length) {
      if (showToastOnError) this.toast.warning('Aucun produit ne correspond à ce filtre.');
      return false;
    }
    const produitLabels = choices.filter((choice) => picked.includes(choice.id)).map((choice) => choice.label);

    this.criteria.set({
      domaine: domaines[0],
      domaines,
      devise,
      from,
      to,
      produitIds,
      produitLabels,
      partenaire: partnerKey,
      modePaiement: partnerKey ? this.draftModePaiement : '',
      sousProduit: sousKey,
      ecran: this.hasTransfert() ? this.draftEcran : '',
      statutUniformes: this.resolveDraftStatuts(),
      categories: this.resolveDraftCategories(),
      agenceIds: [...this.draftAgenceIds],
      agentIds: [...this.draftAgentIds],
      typeOperationIds: (this.draftTypeOperationIds = this.draftTypeOperationIds.filter((id) =>
        this.typesOperation().some((t) => t.typeOperationId === id)
      )),
      jourFiltre: this.draftJourFiltre,
      paysId: this.draftPaysId,
      provinceId: null,
      villeIds: [...this.draftVilleIds],
      territoireId: null,
      communeIds: [...this.draftCommuneIds],
      reseauRegions: this.selectedRegionLabels(),
      zoneIds: [...this.draftZoneIds],
      couloirCodes: domaines.length === 1 && domaines[0] === 'transfert' ? this.resolveDraftCouloirs() : [],
      locationLabels: this.resolveLocationLabels(),
    });
    if (this.detailFiltresCount() > 0) {
      this.detailFiltresOpen.set(true);
    }
    this.writeDashboardUrl();
    this.refreshBundle();
    return true;
  }

  hasSagWuCommission(b: PilotageBundle | null | undefined): boolean {
    return Number(b?.kpis?.commission ?? 0) !== 0;
  }

  seriesChartTitle(): string {
    const montant = this.seriesShowMontant();
    const volume = this.seriesShowVolume();
    if (montant && volume) return 'Évolution — montant & volume';
    if (montant) return 'Évolution — montant';
    if (volume) return 'Évolution — volume';
    return 'Évolution';
  }

  seriesChartSubtitle(): string {
    const g = this.seriesGranularity();
    const grain = g === 'day' ? 'jour' : g === 'week' ? 'semaine' : 'mois';
    return `Agrégation par ${grain} sur la période filtrée`;
  }

  toggleSeriesMontant(): void {
    if (this.seriesShowMontant() && !this.seriesShowVolume()) return;
    this.seriesShowMontant.update((v) => !v);
  }

  toggleSeriesVolume(): void {
    if (this.seriesShowVolume() && !this.seriesShowMontant()) return;
    this.seriesShowVolume.update((v) => !v);
  }

  productChartSubtitle(): string {
    const view = this.productView();
    const base =
      view === 'donut'
        ? 'Par montant (top 8)'
        : view === 'lines'
          ? 'Évolution montant par produit (top 8) — clic légende pour masquer'
          : 'Montant — top 10';
    const sens = this.chartSensOptions().find((e) => e.id === this.chartSens())?.label;
    return sens ? `${base} · ${sens}` : base;
  }

  exportFavicon(): string {
    return this.appSettings.settings().favicon || '/branding/logo-light1.png';
  }

  agencyCodeLine(row: { nom: string; codeAgence: string; posId: string }): string {
    const code = (row.codeAgence || '').trim();
    const pos = (row.posId || '').trim();
    const title = (row.nom || code).trim();
    const parts: string[] = [];
    if (code && code !== title) parts.push(code);
    if (pos) parts.push(pos);
    return parts.join(' · ');
  }

  exportAgences(): void {
    const criteria = this.criteria();
    const bundle = this.bundle();
    if (!criteria || !bundle || this.exportingExcel()) return;
    this.exportMenuOpen.set(false);
    this.exportingExcel.set(true);
    this.exportProgress.set(3);
    this.startExportCreep();
    this.pilotage.loadExport(criteria, (ratio) => this.bumpExportProgress(ratio * 100)).subscribe({
      next: (data) => {
        const identity = this.buildExportIdentity('agences', criteria);
        const settings = this.appSettings.settings();
        const logo = settings.logo_light || '/branding/logo-light1.png';
        downloadPilotageExcel(
          {
            filename: identity.filename,
            title: identity.title,
            subtitle: identity.subtitle,
            meta: identity.meta,
            bundle,
            agencies: data.agencies,
            lignes: data.lignes,
            lignesTronquees: data.lignesTronquees,
            lignesLimite: data.lignesLimite,
            logoUrl: logo,
            appName: settings.app_name || 'Flash OPS',
            faviconUrl: settings.favicon || '/branding/logo-light1.png',
          },
          (percent) => this.bumpExportProgress(percent)
        )
          .then(() => {
            if (data.lignesTronquees) {
              this.toast.warning(
                `Export limité aux ${data.lignesLimite.toLocaleString('fr-FR')} premières opérations.`
              );
            }
          })
          .catch(() => this.toast.error('Export Excel impossible.'))
          .finally(() => this.finishExport());
      },
      error: () => {
        this.finishExport();
        this.toast.error('Export Excel impossible.');
      },
    });
  }

  exportProduitsMensuel(): void {
    const criteria = this.criteria();
    if (!criteria || this.exportingExcel()) return;
    this.exportMenuOpen.set(false);
    this.exportingExcel.set(true);
    this.exportProgress.set(3);
    this.startExportCreep();
    this.pilotage
      .loadProduitsMensuel(criteria, (ratio) => this.bumpExportProgress(ratio * 100))
      .subscribe({
        next: (data) => {
          const identity = this.buildExportIdentity('produits-mensuel', criteria);
          const settings = this.appSettings.settings();
          downloadPilotageProduitsMensuelExcel(
            {
              identity,
              from: data.from || criteria.from,
              to: data.to || criteria.to,
              devise: data.devise || criteria.devise,
              rows: data.rows,
              logoUrl: settings.logo_light || '/branding/logo-light1.png',
              appName: settings.app_name || 'Flash OPS',
              faviconUrl: settings.favicon || '/branding/logo-light1.png',
            },
            (percent) => this.bumpExportProgress(percent)
          )
            .then(() => {
              if (!data.rows.length) {
                this.toast.warning('Aucune donnée produit pour ce périmètre.');
              }
            })
            .catch(() => this.toast.error('Export produits mensuel impossible.'))
            .finally(() => this.finishExport());
        },
        error: () => {
          this.finishExport();
          this.toast.error('Export produits mensuel impossible.');
        },
      });
  }

  private buildExportIdentity(
    kind: 'agences' | 'produits-mensuel',
    criteria: PilotageCriteria
  ) {
    const domaines = criteria.domaines?.length ? criteria.domaines : [criteria.domaine];
    return buildPilotageReportIdentity({
      kind,
      criteria,
      domainesLabel: this.domainesLabel(domaines),
      period: `${this.formatDateFr(criteria.from)} — ${this.formatDateFr(criteria.to)}`,
      chips: this.optionalScopeChips(criteria),
    });
  }

  private bumpExportProgress(percent: number): void {
    const next = Math.max(0, Math.min(100, Math.round(percent)));
    if (next > this.exportProgress()) this.exportProgress.set(next);
  }

  private startExportCreep(): void {
    this.stopExportCreep();
    this.exportCreep = setInterval(() => {
      const current = this.exportProgress();
      if (current < 16) this.exportProgress.set(current + 1);
    }, 420);
  }

  private stopExportCreep(): void {
    if (this.exportCreep != null) {
      clearInterval(this.exportCreep);
      this.exportCreep = null;
    }
  }

  private finishExport(): void {
    this.stopExportCreep();
    this.exportingExcel.set(false);
    this.exportProgress.set(0);
  }

  agencySubtitle(): string {
    const total = this.agencyTotal();
    if (!total) return 'Montant';
    const sens = this.agencyOrder() === 'top' ? 'meilleures en tête' : 'plus faibles en tête';
    return `Montant — ${total.toLocaleString('fr-FR')} agence(s), ${sens}`;
  }

  agencyRangeLabel(): string {
    const total = this.agencyTotal();
    if (!total) return '0';
    const size = this.agencyPageSize();
    const page = this.currentAgencyPage();
    const from = (page - 1) * size + 1;
    const to = Math.min(page * size, total);
    return `${from}–${to} sur ${total.toLocaleString('fr-FR')}`;
  }

  currentAgencyPage(): number {
    return Math.min(this.agencyPage(), this.agencyPageCount());
  }

  setAgencyPage(page: number): void {
    const next = Math.min(Math.max(1, page), this.agencyPageCount());
    if (next === this.agencyPage()) return;
    this.agencyPage.set(next);
    this.reloadClassement({ resetPage: false });
  }

  setAgencyPageSize(size: number): void {
    const next = Number(size);
    if (!this.agencyPageSizes.includes(next) || next === this.agencyPageSize()) return;
    this.agencyPageSize.set(next);
    this.agencyPage.set(1);
    this.reloadClassement({ resetPage: false });
  }

  setAgencyOrder(order: 'top' | 'pire'): void {
    if (this.agencyOrder() === order) return;
    this.openedAgency.set(null);
    this.agencyOrder.set(order);
    this.patchAgencyOrderInUrl(order);
    this.reloadClassement({ resetPage: true });
  }

  private patchAgencyOrderInUrl(order: 'top' | 'pire'): void {
    const current = this.location.path();
    const qIndex = current.indexOf('?');
    const path = (qIndex >= 0 ? current.slice(0, qIndex) : current) || '/';
    const query = qIndex >= 0 ? current.slice(qIndex + 1) : '';
    let params = new HttpParams({ fromString: query });
    params = order === 'pire' ? params.set('ordre', 'pire') : params.delete('ordre');
    const qs = params.toString();
    const next = qs ? `${path}?${qs}` : path;
    if (current !== next) {
      this.location.replaceState(next);
    }
  }

  agencyRankClass(rank: number): string {
    if (rank > 2) return '';
    const kind = this.agencyOrder() === 'pire' ? 'worst' : 'best';
    return `agency-rank-${kind}-${rank + 1}`;
  }

  agencyBadgeClass(rank: number): string {
    if (rank > 2) return '';
    const kind = this.agencyOrder() === 'pire' ? 'worst' : 'best';
    return `badge-${kind}-${rank + 1}`;
  }

  formatPilotageNumber(n: number): string {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) {
      return formatNumberFr(n, { notation: 'compact', maximumFractionDigits: 2 });
    }
    return formatNumberFr(n);
  }

  formatPilotageMontant(amount: number, devise: string): string {
    const cur = (devise || 'USD').trim().toUpperCase();
    const abs = Math.abs(amount);
    if (abs >= 1_000_000) {
      return `${formatNumberFr(amount, { notation: 'compact', maximumFractionDigits: 2 })}\u00A0${cur}`;
    }
    if (abs >= 100_000) {
      return `${formatNumberFr(amount, { maximumFractionDigits: 0 })}\u00A0${cur}`;
    }
    return formatValeurFr(amount, cur);
  }

  compareMoisLabel(iso: string): string {
    if (!iso) return 'mois de fin';
    const [y, m] = iso.split('-');
    if (!m || !y) return iso;
    return `${m}/${y}`;
  }

  private reloadClassement(options?: { resetPage?: boolean }): void {
    const resetPage = options?.resetPage !== false;
    const c = this.criteria();
    if (!c || !this.metaReady()) {
      this.agencyRows.set([]);
      this.agencyTotal.set(0);
      this.agencyLoading.set(false);
      return;
    }
    if (resetPage) {
      this.agencyPage.set(1);
      this.agencyRows.set([]);
      this.agencyTotal.set(0);
    }
    this.agencyLoading.set(true);
    this.pilotage
      .loadClassementAgences(c, this.agencyOrder(), this.agencyPage(), this.agencyPageSize())
      .subscribe({
        next: (page) => {
          this.agencyRows.set(page.items);
          this.agencyTotal.set(page.total);
          if (page.page > 0) this.agencyPage.set(page.page);
          this.agencyLoading.set(false);
        },
        error: () => {
          this.agencyRows.set([]);
          this.agencyTotal.set(0);
          this.agencyLoading.set(false);
        },
      });
  }

  private refreshBundle(): void {
    const c = this.criteria();
    if (!c || !this.metaReady()) {
      this.bundle.set(null);
      this.agencyRows.set([]);
      this.agencyTotal.set(0);
      return;
    }
    this.bundleLoading.set(true);
    this.bundleError.set(false);
    this.reloadClassement({ resetPage: true });
    this.pilotage.loadBundle(c).subscribe({
      next: (data) => {
        this.bundle.set(data);
        this.bundleLoading.set(false);
        // Cascade Flash Payment branchée : 0 volume = vraiment aucune op. sur la période
        // (ex. Orange Money inactif après le 11/09), pas un filtre cassé.
        if (
          (data.kpis?.volume ?? 0) === 0 &&
          c.partenaire &&
          c.modePaiement === 'momo' &&
          c.sousProduit &&
          c.produitIds.length > 0
        ) {
          const sous = pilotagePartenaireLabel(c.sousProduit);
          this.toast.info(
            `Aucune opération ${sous} sur cette période. Essayez M-Pesa ou élargissez les dates.`
          );
        }
      },
      error: () => {
        this.bundle.set(null);
        this.bundleLoading.set(false);
        this.bundleError.set(true);
        this.toast.error('Impossible de charger les indicateurs.');
      },
    });
  }

  resetFilters(): void {
    this.draftDomaineIds = this.defaultDomaineIds();
    this.draftDevise = this.devises().includes('USD') ? 'USD' : this.devises()[0];
    this.activePreset = '30d';
    this.resetDraftDates();
    this.resetOptionalDraft();
    this.agencyOrder.set('top');
    this.agencyPage.set(1);
    this.detailFiltresOpen.set(false);
    this.onDomaineIdsChange(this.draftDomaineIds);
    this.applySearch(false);
  }

  private loadFiltresForDomains(showError: boolean): void {
    const domaines = this.selectedDomaines();
    if (!this.metaReady() || !domaines.length) {
      this.produits.set([]);
      this.categories.set([]);
      this.typesOperation.set([]);
      this.markSearchReady('filtres');
      this.markSearchReady('couloirs');
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
        const loaded = parts.filter((part): part is NonNullable<typeof part> => part != null);
        const produits: PilotageProduitVue[] = [];
        const categories = new Set<string>();
        const types = new Map<number, { typeOperationId: number; libelle: string }>();
        for (const part of loaded) {
          for (const produit of part.filtres.produits ?? []) {
            produits.push({ ...produit, domaine: part.domaine });
          }
          for (const cat of part.filtres.categories ?? []) categories.add(cat);
          for (const type of part.filtres.typesOperation ?? []) {
            types.set(type.typeOperationId, type);
          }
        }
        this.produits.set(produits);
        this.categories.set([...categories]);
        const typeList = [...types.values()];
        this.typesOperation.set(typeList);
        const validTypeIds = new Set(typeList.map((t) => t.typeOperationId));
        this.draftTypeOperationIds = this.draftTypeOperationIds.filter((id) => validTypeIds.has(id));
        this.filtresLoading.set(false);
        this.onSensTransfertChange();
        this.markSearchReady('filtres');
        if (showError && !loaded.length) this.toast.error('Filtres indisponibles.');
      },
      error: () => {
        this.filtresLoading.set(false);
        this.produits.set([]);
        this.categories.set([]);
        this.typesOperation.set([]);
        this.markSearchReady('filtres');
        if (showError) this.toast.error('Filtres indisponibles.');
      },
    });
    this.loadCouloirs(showError);
  }

  private loadCouloirs(showError: boolean): void {
    if (!this.metaReady() || !this.hasTransfert()) {
      this.couloirs.set([]);
      if (!this.hasTransfert()) {
        this.draftCouloirIds = [];
        this.sensCouloir.set('');
      }
      this.markSearchReady('couloirs');
      return;
    }
    this.couloirsLoading.set(true);
    this.pilotage.listCouloirs('transfert').subscribe({
      next: (rows) => {
        this.couloirs.set(rows);
        const valid = new Set(rows.map((c) => pilotageCouloirOptionId(c.code)));
        if (this.pendingCouloirCodes) {
          this.draftCouloirIds = this.pendingCouloirCodes
            .map((code) => pilotageCouloirOptionId(code))
            .filter((id) => valid.has(id));
          this.pendingCouloirCodes = null;
        } else {
          this.draftCouloirIds = this.draftCouloirIds.filter((id) => valid.has(id));
        }
        this.couloirsLoading.set(false);
        this.markSearchReady('couloirs');
      },
      error: () => {
        this.couloirs.set([]);
        this.couloirsLoading.set(false);
        this.markSearchReady('couloirs');
        if (showError) this.toast.error('Corridors indisponibles.');
      },
    });
  }

  private defaultDomaineIds(): number[] {
    const first = this.domaines()[0];
    return first ? [pilotageDomaineOptionId(first.code)] : [];
  }

  private clampDraftDomaines(): void {
    const allowed = new Set(this.domaines().map((d) => d.code));
    const kept = this.selectedDomaines().filter((code) => allowed.has(code));
    this.draftDomaineIds = kept.length
      ? kept.map((code) => pilotageDomaineOptionId(code))
      : this.defaultDomaineIds();
  }

  private selectedDomaines(): PilotageDomaine[] {
    const ids = new Set(this.draftDomaineIds);
    return this.domaines()
      .filter((d) => ids.has(pilotageDomaineOptionId(d.code)))
      .map((d) => d.code);
  }

  private flashPaymentSelected(): boolean {
    const choice = this.productChoices().find((item) => item.module.trim().toUpperCase() === 'FLASHPAYMENT');
    return !!choice && this.draftProduitIds.includes(choice.id);
  }

  flashPaymentPartners(): { value: string; label: string }[] {
    if (!this.flashPaymentSelected()) return [];
    const choice = this.productChoices().find((item) => item.module.trim().toUpperCase() === 'FLASHPAYMENT');
    const seen = new Map<string, string>();
    for (const row of choice?.rows ?? []) {
      const raw = (row.partenaire || '').trim();
      if (!raw) continue;
      const key = pilotageCompactKey(raw);
      if (!key) continue;
      if (!seen.has(key)) seen.set(key, pilotagePartenaireLabel(raw));
    }
    return [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }

  flashPaymentSousProduits(): { value: string; label: string }[] {
    if (this.draftModePaiement !== 'momo' || !this.draftPartenaire || !this.flashPaymentSelected()) return [];
    const choice = this.productChoices().find((item) => item.module.trim().toUpperCase() === 'FLASHPAYMENT');
    const partner = pilotageCompactKey(this.draftPartenaire);
    const seen = new Map<string, string>();
    for (const row of choice?.rows ?? []) {
      if (pilotageCompactKey(row.partenaire || '') !== partner) continue;
      if (!pilotageIsMobileMoneyProduit(row.produit, row.ecran)) continue;
      const raw = (row.produit || '').trim();
      if (!raw || raw === '-') continue;
      const key = pilotageCompactKey(raw);
      if (!key) continue;
      if (!seen.has(key)) seen.set(key, pilotagePartenaireLabel(raw));
    }
    // M-Pesa d'abord : c'est le sous-produit actif sur la période courante.
    const rank = (value: string) => (value === 'MPESA' ? 0 : value === 'ORANGEMONEY' ? 2 : 1);
    return [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => rank(a.value) - rank(b.value) || a.label.localeCompare(b.label, 'fr'));
  }

  private resetOptionalDraft(): void {
    this.draftProduitIds = [];
    this.draftEcran = '';
    this.draftPartenaire = '';
    this.draftModePaiement = '';
    this.draftSousProduit = '';
    this.sensListe.update((n) => n + 1);
    this.draftStatutIds = [];
    this.draftCategorieIds = [];
    this.draftTypeOperationIds = [];
    this.draftJourFiltre = '';
    this.draftCouloirIds = [];
    this.resetLocationAndReseauDraft();
    this.clearAgenceAgent();
  }

  private loadAllGeoAgences(): void {
    this.pilotage.listAllGeoAgences().subscribe({
      next: (rows) => {
        this.allGeoAgences.set(rows);
        this.allGeoReady.set(true);
      },
      error: () => {
        this.allGeoAgences.set([]);
        this.allGeoReady.set(true);
      },
    });
  }

  private loadLocationAndReseauRefs(showError = false): void {
    const bootstrap = !this.locationBootstrapped;
    this.locationBootstrapped = true;
    this.pilotage.listGeoPays().subscribe({
      next: (rows) => {
        this.paysList.set(rows);
        if (bootstrap) {
          this.ensureDefaultPays(rows);
          this.reloadVillesList();
          this.markSearchReady('pays');
        }
        if (showError && !rows.length) {
          this.toast.warning('Référentiel pays vide.');
        }
      },
      error: () => {
        if (bootstrap) {
          this.markSearchReady('pays');
        }
        if (showError) {
          this.toast.error('Pays indisponibles.');
        }
      },
    });
    if (!this.metaReady()) {
      this.markSearchReady('regions');
      return;
    }
    this.pilotage.listReseauRegions().subscribe({
      next: (rows) => {
        this.regionsList.set(rows);
        const known = new Set(rows.map((region) => region.id));
        this.draftRegionIds = this.draftRegionIds.filter((id) => known.has(id));
        if (this.draftRegionIds.length) {
          this.reloadZonesList();
          this.reloadVillesList();
        }
        this.markSearchReady('regions');
      },
      error: () => this.markSearchReady('regions'),
    });
    this.reloadZonesList();
  }

  private markSearchReady(part: 'filtres' | 'pays' | 'regions' | 'couloirs'): void {
    this.searchGate[part] = true;
    if (this.criteria()) return;
    if (!this.searchGate.filtres || !this.searchGate.pays || !this.searchGate.regions || !this.searchGate.couloirs) {
      return;
    }
    this.applySearch(false);
  }

  private restoreDraftFromUrl(): void {
    const q = this.route.snapshot.queryParamMap;
    if (!q.keys.length) return;

    const domaines = q.getAll('domaine').filter((code): code is PilotageDomaine =>
      code === 'transfert' || code === 'monnaie' || code === 'service'
    );
    if (domaines.length) {
      this.draftDomaineIds = domaines.map((code) => pilotageDomaineOptionId(code));
    }
    const devise = (q.get('devise') || '').trim().toUpperCase();
    if (devise) this.draftDevise = devise;
    const from = (q.get('from') || '').trim();
    const to = (q.get('to') || '').trim();
    if (from && to) {
      this.draftFrom = from;
      this.draftTo = to;
      this.activePreset = PERIOD_PRESETS.find((preset) => {
        const range = periodPresetRange(preset.id);
        return range.from === from && range.to === to;
      })?.id ?? null;
    }
    this.draftProduitIds = queryInts(q.getAll('produit'));
    this.draftEcran = (q.get('ecran') || '').trim();
    this.draftPartenaire = pilotageCompactKey(q.get('partenaire') || '');
    const mode = (q.get('mode') || '').trim();
    this.draftModePaiement = mode === 'cash' || mode === 'momo' ? mode : '';
    this.draftSousProduit = pilotageCompactKey(q.get('sous') || '');
    const statuts = q.getAll('statut').filter((value) => PILOTAGE_STATUT_OPTIONS.some((option) => option.value === value));
    if (statuts.length) this.draftStatutIds = statuts.map((value) => pilotageStatutOptionId(value));
    const categories = q.getAll('categorie').map((value) => value.trim()).filter(Boolean);
    if (categories.length) this.draftCategorieIds = categories.map((value) => pilotageCategoryOptionId(value));
    this.draftAgenceIds = queryInts(q.getAll('agence_id'));
    this.draftAgentIds = queryInts(q.getAll('agent_id'));
    this.draftTypeOperationIds = queryInts(q.getAll('type_operation_id'));
    const jour = (q.get('jour') || '').trim();
    if (jour === 'hors_weekend' || jour === 'feries' || jour === 'par_mois') {
      this.draftJourFiltre = jour;
    }
    const couloirs = q.getAll('couloir').map((value) => value.trim()).filter(Boolean);
    if (couloirs.length) this.pendingCouloirCodes = couloirs;
    const sens = (q.get('sens') || '').trim();
    if (sens === 'envoi' || sens === 'retrait') this.sensCouloir.set(sens);
    this.draftRegionIds = queryInts(q.getAll('region_id'));
    this.draftZoneIds = queryInts(q.getAll('zone_id'));
    const paysId = queryInts([q.get('pays_id') || '']);
    if (paysId.length) this.draftPaysId = paysId[0];
    this.draftVilleIds = queryInts(q.getAll('ville_id'));
    this.draftCommuneIds = queryInts(q.getAll('commune_id'));
    if ((q.get('ordre') || '').trim() === 'pire') this.agencyOrder.set('pire');
  }

  private writeDashboardUrl(): void {
    let params = new HttpParams();
    for (const code of this.selectedDomaines()) params = params.append('domaine', code);
    params = params.set('devise', this.draftDevise).set('from', this.draftFrom).set('to', this.draftTo);
    for (const id of this.draftProduitIds) params = params.append('produit', String(id));
    if (this.draftEcran) params = params.set('ecran', this.draftEcran);
    if (this.draftPartenaire) params = params.set('partenaire', this.draftPartenaire);
    if (this.draftModePaiement) params = params.set('mode', this.draftModePaiement);
    if (this.draftSousProduit) params = params.set('sous', this.draftSousProduit);
    for (const statut of this.resolveDraftStatuts()) params = params.append('statut', statut);
    for (const categorie of this.resolveDraftCategories()) params = params.append('categorie', categorie);
    for (const id of this.draftAgenceIds) params = params.append('agence_id', String(id));
    for (const id of this.draftAgentIds) params = params.append('agent_id', String(id));
    for (const id of this.draftTypeOperationIds) params = params.append('type_operation_id', String(id));
    if (this.draftJourFiltre) params = params.set('jour', this.draftJourFiltre);
    for (const code of this.resolveDraftCouloirs()) params = params.append('couloir', code);
    const sens = this.sensCouloir();
    if (sens) params = params.set('sens', sens);
    for (const id of this.draftRegionIds) params = params.append('region_id', String(id));
    for (const id of this.draftZoneIds) params = params.append('zone_id', String(id));
    if (this.draftPaysId) params = params.set('pays_id', String(this.draftPaysId));
    for (const id of this.draftVilleIds) params = params.append('ville_id', String(id));
    for (const id of this.draftCommuneIds) params = params.append('commune_id', String(id));
    if (this.agencyOrder() === 'pire') params = params.set('ordre', 'pire');

    const qs = params.toString();
    const path = this.location.path().split('?')[0] || '/';
    const next = qs ? `${path}?${qs}` : path;
    if (this.location.path() !== next) {
      this.location.replaceState(next);
    }
  }

  private ensureDefaultPays(rows: { id: number; code_iso?: string }[]): void {
    if (this.draftPaysId != null) {
      return;
    }
    const rdc = rows.find((pays) => (pays.code_iso || '').toUpperCase() === 'CD');
    if (rdc) {
      this.draftPaysId = rdc.id;
    }
  }

  private selectedRegionLabels(): string[] {
    const ids = new Set(this.draftRegionIds);
    return this.regionsList()
      .filter((region) => ids.has(region.id))
      .map((region) => region.libelle);
  }

  private reloadZonesList(): void {
    if (!this.metaReady()) {
      this.zonesList.set([]);
      return;
    }
    this.pilotage.listReseauZones(this.selectedRegionLabels()).subscribe({
      next: (rows) => {
        this.zonesList.set(rows);
        const allowed = new Set(rows.map((zone) => zone.id));
        this.draftZoneIds = this.draftZoneIds.filter((id) => allowed.has(id));
      },
      error: () => this.zonesList.set([]),
    });
  }

  private reloadVillesList(): void {
    if (!this.draftPaysId) {
      this.villesList.set([]);
      this.draftVilleIds = [];
      return;
    }
    this.pilotage.listGeoVillesByPays(this.draftPaysId, this.selectedRegionLabels()).subscribe({
      next: (rows) => {
        this.villesList.set(rows);
        const allowed = new Set(rows.map((ville) => ville.id));
        const kept = this.draftVilleIds.filter((id) => allowed.has(id));
        if (kept.length !== this.draftVilleIds.length) {
          this.draftVilleIds = kept;
          this.draftCommuneIds = [];
        }
        if (this.draftVilleIds.length) {
          this.reloadCommunesList();
        }
      },
      error: () => this.toast.error('Villes indisponibles.'),
    });
  }

  private reloadCommunesList(): void {
    if (!this.draftVilleIds.length) {
      this.communesList.set([]);
      this.draftCommuneIds = [];
      return;
    }
    forkJoin(
      this.draftVilleIds.map((id) =>
        this.pilotage.listGeoCommunes({ villeId: id }).pipe(catchError(() => of([])))
      )
    ).subscribe({
      next: (groups) => {
        const byId = new Map<number, (typeof groups)[number][number]>();
        for (const rows of groups) {
          for (const row of rows) {
            byId.set(row.id, row);
          }
        }
        const communes = [...byId.values()].sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));
        this.communesList.set(communes);
        const allowed = new Set(communes.map((commune) => commune.id));
        this.draftCommuneIds = this.draftCommuneIds.filter((id) => allowed.has(id));
      },
      error: () => this.toast.error('Communes indisponibles.'),
    });
  }

  private resetLocationAndReseauDraft(): void {
    this.draftPaysId = null;
    this.draftVilleIds = [];
    this.draftCommuneIds = [];
    this.draftRegionIds = [];
    this.draftZoneIds = [];
    this.sensCouloir.set('');
    this.communesList.set([]);
    this.ensureDefaultPays(this.paysList());
    this.reloadVillesList();
    this.reloadZonesList();
  }

  private joinLabels(labels: string[], singular: string): string {
    if (labels.length <= 2) {
      return labels.join(', ');
    }
    return `${labels.length} ${singular}`;
  }

  private resolveLocationLabels(): PilotageLocationLabels {
    const labels: PilotageLocationLabels = {};
    if (this.draftPaysId) {
      labels.pays = this.paysList().find((p) => p.id === this.draftPaysId)?.libelle;
    }
    const villes = this.villesList()
      .filter((ville) => this.draftVilleIds.includes(ville.id))
      .map((ville) => ville.libelle);
    if (villes.length) {
      labels.ville = this.joinLabels(villes, 'villes');
    }
    const communes = this.communesList()
      .filter((commune) => this.draftCommuneIds.includes(commune.id))
      .map((commune) => commune.libelle);
    if (communes.length) {
      labels.commune = this.joinLabels(communes, 'communes');
    }
    const regions = this.selectedRegionLabels();
    if (regions.length) {
      labels.region = this.joinLabels(regions, 'régions');
    }
    const zones = this.zonesList()
      .filter((zone) => this.draftZoneIds.includes(zone.id))
      .map((zone) => zone.libelle);
    if (zones.length) {
      labels.zone = this.joinLabels(zones, 'zones');
    }
    return labels;
  }

  private resolveDraftCategories(): string[] {
    const byId = new Map(this.categoryOptions().map((o) => [o.id, o.label]));
    return this.draftCategorieIds.map((id) => byId.get(id)).filter((c): c is string => !!c);
  }

  private resolveDraftCouloirs(): string[] {
    const codeById = new Map(this.couloirs().map((c) => [pilotageCouloirOptionId(c.code), c.code]));
    return this.draftCouloirIds.map((id) => codeById.get(id)).filter((code): code is string => !!code);
  }

  private resolveDraftStatuts(): string[] {
    const valueById = new Map(
      PILOTAGE_STATUT_OPTIONS.filter((s) => s.value !== '').map((s) => [pilotageStatutOptionId(s.value), s.value])
    );
    return this.draftStatutIds.map((id) => valueById.get(id)).filter((v): v is string => !!v);
  }

  private clearAgenceAgent(): void {
    this.draftAgenceIds = [];
    this.draftAgentIds = [];
    this.agencySelect?.reset();
    this.agentSelect?.reset();
  }

  private resetDraftDates(): void {
    const range = periodPresetRange('30d');
    this.draftFrom = range.from;
    this.draftTo = range.to;
  }

  private shortDomainLabel(label: string, code: PilotageDomaine): string {
    if (code === 'transfert') return 'Transferts';
    if (code === 'monnaie') return 'Monnaie';
    if (code === 'service') return 'Services';
    return label;
  }
}

function queryInts(values: string[]): number[] {
  return values.map((value) => Number(value)).filter((id) => Number.isInteger(id) && id > 0);
}

function corridorMatchesSens(label: string, sens: '' | 'envoi' | 'retrait'): boolean {
  if (!sens) return true;
  const parts = label.split('→');
  const origin = (parts[0] ?? '').trim();
  const dest = (parts[1] ?? '').trim();
  const originRdc = isRdcCountry(origin);
  const destRdc = isRdcCountry(dest);
  if (sens === 'envoi') return originRdc && !destRdc;
  return !originRdc && destRdc;
}

function isRdcCountry(name: string): boolean {
  const n = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
  return n === 'RDC' || n === 'RD CONGO' || n === 'DRC' || n.includes('DEMOCRATIQUE DU CONGO');
}
