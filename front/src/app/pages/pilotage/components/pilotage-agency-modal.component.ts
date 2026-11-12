import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, map, of } from 'rxjs';
import { GeoPoint } from '../../../core/models/api.models';
import {
  PilotageAgenceFiche,
  PilotageAgenceRank,
  PilotageAgenceTransactionsPage,
  PilotageCriteria,
  PilotageDomaine,
  PilotageDomaineOption,
} from '../../../core/models/pilotage.models';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { PilotageService } from '../../../core/services/pilotage.service';
import { ToastService } from '../../../core/services/toast.service';
import { GeoMapComponent } from '../../../shared/components/geo-map/geo-map.component';
import {
  MultiSelectComponent,
  MultiSelectOption,
} from '../../../shared/components/multi-select/multi-select.component';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { formatNumberFr, formatValeurFr } from '../../../shared/utils/format.utils';
import { downloadPilotageAgencyTxExcel } from '../pilotage-agency-tx.export';
import {
  PILOTAGE_STATUT_OPTIONS,
  PilotageEcranOption,
  PilotageProduitChoice,
  PilotageProduitVue,
  buildPilotageProduitChoices,
  pilotageCompactKey,
  pilotageDomaineOptionId,
  pilotageEcransForDomain,
  pilotageIsMobileMoneyProduit,
  pilotagePartenaireLabel,
  pilotageStatutOptionId,
  resolvePilotageProduitIds,
} from '../pilotage-filtres.config';

const ALERT_RATIO = 2;

const DEFAULT_DOMAINES: PilotageDomaineOption[] = [
  { code: 'transfert', label: 'Transferts' },
  { code: 'monnaie', label: 'Monnaie' },
  { code: 'service', label: 'Services' },
];

@Component({
  selector: 'app-pilotage-agency-modal',
  standalone: true,
  imports: [FormsModule, GeoMapComponent, MultiSelectComponent, SkeletonComponent, StatusBadgeComponent],
  template: `
    <div class="agency-modal">
      <section
        class="agency-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agency-sheet-title"
      >
        <header class="agency-sheet__head">
          <div class="agency-sheet__identity">
            <h2 id="agency-sheet-title">{{ title() }}</h2>
            <p class="agency-sheet__meta">
              <span class="font-monospace">{{ codeLine() }}</span>
              @if (posLine()) {
                <span class="agency-sheet__dot" aria-hidden="true"></span>
                <span class="font-monospace">{{ posLine() }}</span>
              }
            </p>
            <p class="agency-sheet__period">
              {{ formatJour(appliedFrom) }} – {{ formatJour(appliedTo) }}
              <span class="agency-sheet__dot" aria-hidden="true"></span>
              {{ appliedDevise }}
              <span class="agency-sheet__dot" aria-hidden="true"></span>
              {{ domainesSummary() }}
              <span class="agency-sheet__dot" aria-hidden="true"></span>
              {{ formatNumberFr(agency.volume) }} vol.
              <span class="agency-sheet__dot" aria-hidden="true"></span>
              {{ formatValeurFr(agency.montant, appliedDevise) }}
            </p>
          </div>
          <button #closeBtn type="button" class="agency-sheet__close" (click)="closed.emit()" aria-label="Fermer">
            <i class="bi bi-x-lg"></i>
          </button>
        </header>

        <div class="agency-sheet__body">
          <section class="sheet-section" aria-labelledby="agency-identity-title">
            <h3 id="agency-identity-title" class="sheet-kicker">Identité</h3>
            @if (ficheLoading() && !fiche()) {
              <app-skeleton type="table" [rows]="2" [cols]="4" />
            } @else {
              <dl class="identity-grid">
                @for (field of identityFields(); track field.label) {
                  <div>
                    <dt>{{ field.label }}</dt>
                    <dd [title]="field.value">{{ field.value }}</dd>
                  </div>
                }
              </dl>
            }
          </section>

          @if (mapPoints().length) {
            <section class="sheet-section" aria-label="Localisation">
              <h3 class="sheet-kicker">Localisation</h3>
              <div class="agency-map">
                <app-geo-map
                  [points]="mapPoints()"
                  [staticPin]="true"
                  [compactChrome]="true"
                  [pinIconUrl]="faviconUrl()"
                  [pinLabel]="mapLabel()"
                  height="14.5rem"
                />
              </div>
            </section>
          }

          @if (showCommissions()) {
            <section class="sheet-section" aria-labelledby="agency-commissions-title">
              <h3 id="agency-commissions-title" class="sheet-kicker">Commissions</h3>
              <dl class="identity-grid">
                @for (field of commissionFields(); track field.label) {
                  <div>
                    <dt>{{ field.label }}</dt>
                    <dd [title]="field.title">{{ field.value }}</dd>
                  </div>
                }
              </dl>
            </section>
          }

          <section class="sheet-section" aria-labelledby="agency-tx-title">
            <div class="tx-head">
              <div>
                <h3 id="agency-tx-title" class="sheet-kicker">Transactions</h3>
              </div>
              <div class="tx-head__actions">
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary"
                  [disabled]="txLoading() || txExporting() || !(txPage()?.total)"
                  (click)="exportExcel()"
                >
                  @if (txExporting()) {
                    Export…
                  } @else {
                    <i class="bi bi-file-earmark-excel" aria-hidden="true"></i>
                    Excel
                  }
                </button>
                <label class="tx-size">
                  <span class="visually-hidden">Lignes par page</span>
                  <select
                    class="form-select form-select-sm"
                    [ngModel]="pageSize()"
                    (ngModelChange)="setPageSize($event)"
                    [disabled]="txLoading()"
                  >
                    @for (size of pageSizes; track size) {
                      <option [ngValue]="size">{{ size }} / page</option>
                    }
                  </select>
                </label>
              </div>
            </div>

            <div class="tx-filters">
              <div class="filter-field">
                <label class="form-label">Domaine</label>
                <app-multi-select
                  [options]="domaineSelectOptions()"
                  [selectedIds]="draftDomaineIds"
                  (selectedIdsChange)="onDomaineIdsChange($event)"
                  placeholder="Domaines"
                />
              </div>
              <div class="filter-field">
                <label class="form-label" for="agency-tx-from">Date début</label>
                <input
                  id="agency-tx-from"
                  type="date"
                  class="form-control form-control-sm"
                  [(ngModel)]="draftFrom"
                />
              </div>
              <div class="filter-field">
                <label class="form-label" for="agency-tx-to">Date fin</label>
                <input
                  id="agency-tx-to"
                  type="date"
                  class="form-control form-control-sm"
                  [(ngModel)]="draftTo"
                />
              </div>
              <div class="filter-field">
                <label class="form-label" for="agency-tx-devise">Devise</label>
                <select id="agency-tx-devise" class="form-select form-select-sm" [(ngModel)]="draftDevise">
                  @for (cur of deviseChoices(); track cur) {
                    <option [value]="cur">{{ cur }}</option>
                  }
                </select>
              </div>
              @if (sensOptions().length) {
                <div class="filter-field">
                  <label class="form-label">{{ sensLabel() }}</label>
                  <select
                    class="form-select form-select-sm"
                    [(ngModel)]="draftEcran"
                    (ngModelChange)="onSensChange()"
                  >
                    <option value="">Tous</option>
                    @for (e of sensOptions(); track e.id) {
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
                  [placeholder]="produitsLoading() ? 'Chargement…' : 'Tous les produits'"
                />
              </div>
              @if (flashPaymentPartners().length) {
                <div class="filter-field">
                  <label class="form-label">Partenaire</label>
                  <select
                    class="form-select form-select-sm"
                    [(ngModel)]="draftPartenaire"
                    (ngModelChange)="onPartenaireChange()"
                  >
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
                  <select
                    class="form-select form-select-sm"
                    [(ngModel)]="draftModePaiement"
                    (ngModelChange)="onModePaiementChange()"
                  >
                    <option value="">Cash et mobile money</option>
                    <option value="cash">Cash</option>
                    <option value="momo">Mobile money</option>
                  </select>
                </div>
              }
              @if (draftModePaiement === 'momo' && flashPaymentSousProduits().length) {
                <div class="filter-field">
                  <label class="form-label">Sous-produit</label>
                  <select class="form-select form-select-sm" [(ngModel)]="draftSousProduit">
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
              <div class="filter-field filter-field--party">
                <label class="form-label" for="agency-tx-party">Expéditeur / récepteur</label>
                <input
                  id="agency-tx-party"
                  type="search"
                  class="form-control form-control-sm"
                  [(ngModel)]="draftPartyQuery"
                  placeholder="Nom…"
                  autocomplete="off"
                  (keydown.enter)="$event.preventDefault(); applyFilters()"
                />
              </div>
              <div class="filter-field filter-field--action">
                <label class="form-label">&nbsp;</label>
                <button
                  type="button"
                  class="btn btn-sm btn-primary tx-search-btn"
                  [disabled]="txLoading()"
                  (click)="applyFilters()"
                  aria-label="Rechercher"
                >
                  <i class="bi bi-search" aria-hidden="true"></i>
                  Rechercher
                </button>
              </div>
            </div>

            @if (txPage() && !txError()) {
              <div class="tx-totals" aria-live="polite">
                <div class="tx-total">
                  <span class="tx-total__label">Volume</span>
                  <strong class="tx-total__value">{{ formatNumberFr(txPage()!.total) }}</strong>
                </div>
                <div class="tx-total">
                  <span class="tx-total__label">Montant total</span>
                  <strong class="tx-total__value">{{ formatValeurFr(txPage()!.montantTotal, appliedDevise) }}</strong>
                </div>
                <div class="tx-total">
                  <span class="tx-total__label">Ticket moyen</span>
                  <strong class="tx-total__value">{{ formatValeurFr(txPage()!.moyenne, appliedDevise) }}</strong>
                </div>
              </div>
            }

            @if (txLoading() && !txPage()) {
              <app-skeleton type="table" [rows]="5" [cols]="8" />
            } @else if (txError()) {
              <p class="tx-empty">Transactions indisponibles.</p>
            } @else if (!txPage()?.lignes?.length) {
              <p class="tx-empty">Aucune transaction sur ce périmètre.</p>
            } @else {
              <div class="tx-scroll">
                <table class="tx-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Produit</th>
                      <th>Opérateur</th>
                      <th>{{ partyFromLabel() }}</th>
                      <th>{{ partyToLabel() }}</th>
                      <th>ID</th>
                      <th>Statut</th>
                      <th class="num">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (tx of txPage()!.lignes; track tx.operationId) {
                      <tr [class.tx-alert]="isAlert(tx.montant)" [attr.title]="alertTitle(tx.montant)">
                        <td class="nowrap">
                          <span class="tx-date">{{ formatJour(tx.jour) }}</span>
                          @if (tx.heure) {
                            <span class="tx-time">{{ tx.heure }}</span>
                          }
                        </td>
                        <td class="clip" [title]="tx.produit || '—'">{{ tx.produit || '—' }}</td>
                        <td class="clip" [title]="tx.operateur || '—'">{{ tx.operateur || '—' }}</td>
                        <td class="clip" [title]="tx.expediteur || '—'">{{ tx.expediteur || '—' }}</td>
                        <td class="clip" [title]="tx.beneficiaire || '—'">{{ tx.beneficiaire || '—' }}</td>
                        <td class="nowrap font-monospace tx-id">{{ tx.operationId }}</td>
                        <td>
                          @if (tx.statut) {
                            <app-status-badge [label]="tx.statut" />
                          } @else {
                            —
                          }
                        </td>
                        <td class="num nowrap">
                          {{ formatValeurFr(tx.montant, appliedDevise) }}
                          @if (isAlert(tx.montant)) {
                            <span class="tx-flag">{{ alertRatio }}×</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>
        </div>
        @if (txPage()?.lignes?.length) {
          <footer class="tx-pager">
            <span>{{ rangeLabel() }}</span>
            <div class="tx-pager__nav">
              <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="page() <= 1 || txLoading()" (click)="go(1)">
                Début
              </button>
              <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="page() <= 1 || txLoading()" (click)="go(page() - 1)">
                Précédent
              </button>
              <span class="tx-pager__index">{{ page() }} / {{ pageCount() }}</span>
              <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="page() >= pageCount() || txLoading()" (click)="go(page() + 1)">
                Suivant
              </button>
              <button type="button" class="btn btn-sm btn-outline-secondary" [disabled]="page() >= pageCount() || txLoading()" (click)="go(pageCount())">
                Fin
              </button>
            </div>
          </footer>
        }
      </section>
    </div>
  `,
  styles: `
    .agency-modal {
      position: fixed;
      inset: 0;
      z-index: 1100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: rgba(17, 17, 17, 0.46);
    }

    .agency-sheet {
      display: flex;
      flex-direction: column;
      width: min(72rem, 100%);
      max-height: calc(100vh - 2rem);
      overflow: hidden;
      border-radius: 1rem;
      background: var(--card-bg, #fff);
      border: 1px solid var(--card-border, #e5e7eb);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.22);
    }

    .agency-sheet__head {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      padding: 1rem 1.1rem 0.85rem;
      border-bottom: 1px solid var(--card-border, #e5e7eb);
    }

    .agency-sheet__identity {
      min-width: 0;
      flex: 1;
    }

    .agency-sheet__identity h2 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 650;
      letter-spacing: -0.02em;
      line-height: 1.25;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .agency-sheet__meta,
    .agency-sheet__period {
      margin: 0.2rem 0 0;
      color: var(--text-muted, #6b7280);
      font-size: 0.8125rem;
    }

    .agency-sheet__meta,
    .agency-sheet__period {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.4rem;
    }

    .agency-sheet__dot {
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.55;
    }

    .agency-sheet__close {
      flex: 0 0 auto;
      width: 2rem;
      height: 2rem;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: inherit;
      display: grid;
      place-items: center;
    }

    .agency-sheet__close:hover {
      background: color-mix(in srgb, currentColor 8%, transparent);
    }

    .agency-sheet__head,
    .tx-pager {
      flex: 0 0 auto;
    }

    .agency-sheet__body {
      flex: 1 1 auto;
      overflow: auto;
      padding: 0.15rem 1.1rem 1rem;
      min-height: 0;
    }

    .sheet-section + .sheet-section {
      margin-top: 0.85rem;
      padding-top: 0.85rem;
      border-top: 1px solid var(--card-border, #e5e7eb);
    }

    .sheet-kicker {
      margin: 0 0 0.65rem;
      font-size: 0.6875rem;
      font-weight: 650;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-muted, #6b7280);
    }

    .identity-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.75rem 1rem;
      margin: 0;
    }

    .identity-grid dt {
      margin: 0;
      font-size: 0.6875rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-muted, #6b7280);
    }

    .identity-grid dd {
      margin: 0.12rem 0 0;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .agency-map {
      width: 100%;
      min-height: 14.5rem;
      border: 1px solid var(--card-border, #e5e7eb);
      border-radius: 0.75rem;
      overflow: hidden;
      position: relative;
    }

    .agency-map ::ng-deep .geo-map-shell,
    .agency-map ::ng-deep .geo-map-host {
      width: 100%;
    }

    .tx-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .tx-head__actions {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      flex-wrap: wrap;
    }

    .tx-totals {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0.45rem;
      margin: 0 0 0.75rem;
    }

    .tx-total {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      padding: 0.55rem 0.7rem;
      border-radius: 0.55rem;
      border: 1px solid color-mix(in srgb, #ffd500 55%, var(--card-border, #e5e7eb));
      background: color-mix(in srgb, #ffd500 28%, var(--card-bg, #fff));
    }

    .tx-total__label {
      font-size: 0.68rem;
      font-weight: 650;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-muted, #6b7280);
    }

    .tx-total__value {
      font-size: 0.95rem;
      font-weight: 750;
      font-variant-numeric: tabular-nums;
      color: var(--flash-black, #111);
      line-height: 1.2;
    }

    .tx-filters {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
      gap: 0.45rem 0.65rem;
      align-items: end;
      margin: 0.75rem 0 0.85rem;
      padding: 0.65rem 0.7rem;
      border: 1px solid var(--card-border, #e5e7eb);
      border-radius: 0.65rem;
      background: color-mix(in srgb, var(--card-border, #e5e7eb) 18%, transparent);
    }

    .tx-filters .filter-field {
      min-width: 0;
    }

    .tx-filters .filter-field--party {
      min-width: 11rem;
    }

    .tx-filters .filter-field--action {
      min-width: 7.5rem;
    }

    .tx-filters .form-label {
      margin-bottom: 0.15rem;
      font-size: 0.6875rem;
    }

    .tx-filters .form-select,
    .tx-filters .form-control,
    .tx-filters ::ng-deep .multi-select-control {
      font-size: 0.75rem;
      min-height: calc(var(--flash-control-height, 2rem) - 2px);
    }

    .tx-search-btn {
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      white-space: nowrap;
    }

    .tx-size {
      flex: 0 0 auto;
      margin: 0;
    }

    .tx-size .form-select {
      width: auto;
      min-width: 6.4rem;
    }

    .tx-scroll {
      overflow-x: auto;
    }

    .tx-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;
    }

    .tx-table th {
      padding: 0.4rem 0.45rem;
      border-bottom: 1px solid var(--card-border, #e5e7eb);
      font-size: 0.6875rem;
      font-weight: 650;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-muted, #6b7280);
      white-space: nowrap;
    }

    .tx-table td {
      padding: 0.5rem 0.45rem;
      border-bottom: 1px solid color-mix(in srgb, var(--card-border, #e5e7eb) 85%, transparent);
      vertical-align: middle;
    }

    .tx-table tbody tr:last-child td {
      border-bottom: 0;
    }

    .tx-table .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .tx-table .clip {
      max-width: 9.5rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tx-table .nowrap {
      white-space: nowrap;
    }

    .tx-date {
      display: block;
      font-variant-numeric: tabular-nums;
    }

    .tx-time {
      display: block;
      margin-top: 0.1rem;
      color: var(--text-muted, #6b7280);
      font-size: 0.75rem;
      font-variant-numeric: tabular-nums;
    }

    .tx-id {
      font-size: 0.8125rem;
      font-variant-numeric: tabular-nums;
    }

    .tx-alert td {
      background: rgba(217, 119, 6, 0.1);
    }

    .tx-alert td:first-child {
      box-shadow: inset 3px 0 0 #d97706;
    }

    .tx-flag {
      display: inline-block;
      margin-left: 0.35rem;
      padding: 0.05rem 0.32rem;
      border-radius: 999px;
      background: #d97706;
      color: #fff;
      font-size: 0.625rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      vertical-align: 1px;
    }

    .tx-empty {
      margin: 0.25rem 0 0.4rem;
      color: var(--text-muted, #6b7280);
      font-size: 0.875rem;
    }

    .tx-pager {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      flex-wrap: wrap;
      padding: 0.7rem 1.1rem;
      border-top: 1px solid var(--card-border, #e5e7eb);
      color: var(--text-muted, #6b7280);
      font-size: 0.8125rem;
      background: var(--card-bg, #fff);
    }

    .tx-pager__nav {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-wrap: wrap;
    }

    .tx-pager__index {
      min-width: 3.5rem;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    @media (max-width: 720px) {
      .identity-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .tx-totals {
        grid-template-columns: 1fr;
      }

      .agency-modal {
        padding: 0.5rem;
        align-items: stretch;
      }

      .agency-sheet {
        max-height: calc(100vh - 1rem);
      }
    }
  `,
})
export class PilotageAgencyModalComponent implements OnChanges, OnInit, OnDestroy, AfterViewInit {
  private readonly pilotage = inject(PilotageService);
  private readonly toast = inject(ToastService);
  private readonly appSettings = inject(AppSettingsService);
  private previousOverflow = '';
  private txToken = 0;

  @Input({ required: true }) agency!: PilotageAgenceRank;
  @Input({ required: true }) criteria!: PilotageCriteria;
  @Input() produits: PilotageProduitVue[] = [];
  @Input() domaines: PilotageDomaineOption[] = DEFAULT_DOMAINES;
  @Input() devises: string[] = ['USD'];
  @Output() closed = new EventEmitter<void>();
  @ViewChild('closeBtn') closeBtn?: ElementRef<HTMLButtonElement>;

  readonly pageSizes = [10, 20, 50];
  readonly alertRatio = ALERT_RATIO;
  readonly statutSelectOptions: MultiSelectOption[] = PILOTAGE_STATUT_OPTIONS.filter((o) => o.value).map(
    (o) => ({ id: pilotageStatutOptionId(o.value), label: o.label })
  );

  readonly fiche = signal<PilotageAgenceFiche | null>(null);
  readonly ficheLoading = signal(false);
  readonly txPage = signal<PilotageAgenceTransactionsPage | null>(null);
  readonly txLoading = signal(false);
  readonly txExporting = signal(false);
  readonly txError = signal(false);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly sensListe = signal(0);
  /** Force le recalcul des options domaine / produits liées au draft. */
  readonly draftScopeTick = signal(0);
  /** Produits chargés pour le(s) domaine(s) draft du modal. */
  readonly modalProduits = signal<PilotageProduitVue[]>([]);
  readonly produitsLoading = signal(false);
  private filtresToken = 0;
  private appliedProduits: PilotageProduitVue[] = [];

  draftDomaineIds: number[] = [];
  draftFrom = '';
  draftTo = '';
  draftDevise = 'USD';
  draftEcran = '';
  draftProduitIds: number[] = [];
  draftPartenaire = '';
  draftModePaiement: '' | 'cash' | 'momo' = '';
  draftSousProduit = '';
  draftStatutIds: number[] = [];
  draftPartyQuery = '';

  appliedDomaineIds: number[] = [];
  appliedFrom = '';
  appliedTo = '';
  appliedDevise = 'USD';
  private appliedEcran = '';
  private appliedProduitIds: number[] = [];
  private appliedPartenaire = '';
  private appliedModePaiement: '' | 'cash' | 'momo' = '';
  private appliedSousProduit = '';
  private appliedStatutIds: number[] = [];
  private appliedPartyQuery = '';

  readonly domaineSelectOptions = computed((): MultiSelectOption[] => {
    this.draftScopeTick();
    return this.domaineChoices().map((d) => ({
      id: pilotageDomaineOptionId(d.code),
      label: this.shortDomainLabel(d.label, d.code),
    }));
  });

  readonly sensOptions = computed((): PilotageEcranOption[] => {
    this.draftScopeTick();
    const domaines = this.resolveDomaineCodes(this.draftDomaineIds);
    if (domaines.length !== 1) return [];
    return pilotageEcransForDomain(domaines[0]);
  });

  readonly productChoices = computed((): PilotageProduitChoice[] => {
    this.sensListe();
    this.draftScopeTick();
    this.modalProduits();
    const domaines = this.resolveDomaineCodes(this.draftDomaineIds);
    const rows = this.modalProduits().filter((row) => !domaines.length || domaines.includes(row.domaine));
    return buildPilotageProduitChoices(rows, this.draftEcran);
  });

  readonly productOptions = computed((): MultiSelectOption[] =>
    this.productChoices().map((choice) => ({ id: choice.id, label: choice.label }))
  );

  readonly pageCount = computed(() => {
    const total = this.txPage()?.total ?? 0;
    return Math.max(1, Math.ceil(total / this.pageSize()));
  });

  readonly mapPoints = computed((): GeoPoint[] => {
    const fiche = this.fiche();
    if (!fiche) return [];
    const lat = fiche.latitude;
    const lng = fiche.longitude;
    if (lat == null || lng == null) return [];
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return [];
    return [
      {
        agency_id: fiche.agenceId,
        code: fiche.codeAgence,
        label: fiche.nom || fiche.codeAgence,
        city: fiche.ville,
        commune: fiche.commune,
        lat,
        lng,
        tx_count: 0,
        volume: 0,
        currency: this.appliedDevise || this.criteria.devise,
      },
    ];
  });

  readonly faviconUrl = computed(
    () => this.appSettings.settings().favicon || '/branding/logo-light1.png'
  );

  readonly mapLabel = computed(() => {
    const fiche = this.fiche();
    return (fiche?.nom || this.agency.nom || fiche?.codeAgence || this.agency.codeAgence || '').trim();
  });

  formatNumberFr = formatNumberFr;
  formatValeurFr = formatValeurFr;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['agency']) {
      this.page.set(1);
      this.resetLocalFilters();
      this.fiche.set(null);
      this.txPage.set(null);
      this.loadFiche();
      this.loadTransactions();
      return;
    }
    if (changes['criteria']) {
      this.syncScopeFromCriteria();
      this.draftEcran = '';
      this.draftProduitIds = [];
      this.draftPartenaire = '';
      this.draftModePaiement = '';
      this.draftSousProduit = '';
      this.reloadModalProduits({ seedApplied: true });
      this.page.set(1);
      this.txPage.set(null);
      this.loadTransactions();
      return;
    }
    if (changes['domaines'] || changes['devises']) {
      this.draftScopeTick.update((n) => n + 1);
      const validDomains = new Set(this.domaineSelectOptions().map((o) => o.id));
      this.draftDomaineIds = this.draftDomaineIds.filter((id) => validDomains.has(id));
      if (!this.draftDomaineIds.length) this.draftDomaineIds = this.domaineIdsFromCriteria();
      if (changes['domaines']) this.reloadModalProduits();
      else this.onSensChange();
    }
  }

  ngOnInit(): void {
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  ngAfterViewInit(): void {
    this.closeBtn?.nativeElement.focus();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = this.previousOverflow;
    this.txToken += 1;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }

  title(): string {
    return this.fiche()?.nom || this.agency.nom || this.agency.codeAgence || 'Agence';
  }

  codeLine(): string {
    return this.fiche()?.codeAgence || this.agency.codeAgence || '—';
  }

  posLine(): string {
    return (this.fiche()?.posId || this.agency.posId || '').trim();
  }

  showCommissions(): boolean {
    if (this.isSagWu()) return true;
    if (this.isCfc()) return true;
    return (
      Number(this.agency.commission) !== 0 ||
      Number(this.agency.commissionFcn) !== 0 ||
      Number(this.agency.commissionAgent) !== 0 ||
      Number(this.agency.commissionFcnAgent) !== 0
    );
  }

  commissionFields(): { label: string; value: string; title: string }[] {
    const money = (n: number | null | undefined) => formatValeurFr(Number(n) || 0, this.appliedDevise);
    const field = (label: string, value: number | null | undefined) => ({
      label,
      value: this.formatPilotageMoney(value),
      title: money(value),
    });
    if (this.isCfc() && !this.isSagWu()) {
      return [
        field('Commission FCN', this.agency.commissionFcn),
        field('Commission agent', this.agency.commissionAgent),
        field('Commission FCN agent', this.agency.commissionFcnAgent),
      ];
    }
    if (this.isSagWu()) {
      return [field('Commission', this.agency.commission)];
    }
    return [
      field('Commission', this.agency.commission),
      field('Commission FCN', this.agency.commissionFcn),
      field('Commission agent', this.agency.commissionAgent),
      field('Commission FCN agent', this.agency.commissionFcnAgent),
    ];
  }

  isSagWu(): boolean {
    const cat = (this.fiche()?.categorie || this.agency.categorie || '').toUpperCase();
    return cat.includes('SAG') && cat.includes('WU');
  }

  isCfc(): boolean {
    const cat = (this.fiche()?.categorie || this.agency.categorie || '').toUpperCase();
    return cat.includes('CFC');
  }

  private formatPilotageMoney(value: number | null | undefined): string {
    return formatValeurFr(Number(value) || 0, this.appliedDevise);
  }

  identityFields(): { label: string; value: string }[] {
    const fiche = this.fiche();
    const text = (value?: string | null) => (value && value.trim() ? value.trim() : '—');
    return [
      { label: 'Code', value: text(fiche?.codeAgence || this.agency.codeAgence) },
      { label: 'Catégorie', value: text(fiche?.categorie || this.agency.categorie) },
      { label: 'Région', value: text(fiche?.region || this.agency.region) },
      { label: 'Zone', value: text(fiche?.zone || this.agency.zone) },
      { label: 'Ville', value: text(fiche?.ville) },
      { label: 'Commune', value: text(fiche?.commune) },
      { label: 'Province', value: text(fiche?.province) },
      { label: 'Pays', value: text(fiche?.pays) },
    ];
  }

  /** Libellés stables : on ne permute pas les colonnes, on adapte le rôle du 2ᵉ nom. */
  partyFromLabel(): string {
    return 'Expéditeur';
  }

  partyToLabel(): string {
    if (this.appliedEcran === 'envois') return 'Destinataire';
    if (this.appliedEcran === 'retraits') return 'Récepteur';
    return 'Bénéficiaire';
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
    return [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }

  onDomaineIdsChange(ids: number[]): void {
    this.draftDomaineIds = ids.length ? ids : this.domaineIdsFromCriteria();
    this.draftScopeTick.update((n) => n + 1);
    if (this.draftEcran && !this.sensOptions().some((e) => e.id === this.draftEcran)) {
      this.draftEcran = '';
    }
    this.draftProduitIds = [];
    this.draftPartenaire = '';
    this.draftModePaiement = '';
    this.draftSousProduit = '';
    this.reloadModalProduits();
  }

  onSensChange(): void {
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

  sensLabel(): string {
    const domaines = this.resolveDomaineCodes(this.draftDomaineIds);
    return domaines[0] === 'monnaie' ? "Type d'opération" : 'Sens du transfert';
  }

  domainesSummary(): string {
    const codes = this.resolveDomaineCodes(this.appliedDomaineIds);
    if (!codes.length) return 'Tous domaines';
    return codes
      .map((code) => {
        const opt = this.domaineChoices().find((d) => d.code === code);
        return this.shortDomainLabel(opt?.label || code, code);
      })
      .join(' · ');
  }

  deviseChoices(): string[] {
    const list = [...(this.devises?.length ? this.devises : ['USD'])];
    if (this.draftDevise && !list.includes(this.draftDevise)) list.unshift(this.draftDevise);
    return list;
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

  applyFilters(): void {
    const from = (this.draftFrom || '').trim();
    const to = (this.draftTo || '').trim();
    if (!this.draftDomaineIds.length) {
      this.toast.warning('Sélectionnez au moins un domaine.');
      return;
    }
    if (!from || !to) {
      this.toast.warning('Dates de début et de fin requises.');
      return;
    }
    if (from > to) {
      this.toast.warning('Date de fin invalide.');
      return;
    }
    if (!(this.draftDevise || '').trim()) {
      this.toast.warning('Devise requise.');
      return;
    }
    this.appliedDomaineIds = [...this.draftDomaineIds];
    this.appliedFrom = from;
    this.appliedTo = to;
    this.appliedDevise = this.draftDevise.trim().toUpperCase();
    this.appliedEcran = this.sensOptions().some((e) => e.id === this.draftEcran) ? this.draftEcran : '';
    this.appliedProduitIds = [...this.draftProduitIds];
    this.appliedProduits = [...this.modalProduits()];
    this.appliedPartenaire = this.draftPartenaire;
    this.appliedModePaiement = this.draftModePaiement;
    this.appliedSousProduit = this.draftSousProduit;
    this.appliedStatutIds = [...this.draftStatutIds];
    this.appliedPartyQuery = this.draftPartyQuery.trim();
    this.page.set(1);
    this.loadTransactions();
  }

  formatJour(value: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
    if (!match) return value || '—';
    return `${match[3]}/${match[2]}/${match[1]}`;
  }

  isAlert(amount: number): boolean {
    const moyenne = this.txPage()?.moyenne ?? 0;
    return moyenne > 0 && amount >= moyenne * ALERT_RATIO;
  }

  alertTitle(amount: number): string | null {
    return this.isAlert(amount) ? `Au moins ${ALERT_RATIO} fois la moyenne du périmètre` : null;
  }

  rangeLabel(): string {
    const total = this.txPage()?.total ?? 0;
    if (!total) return '0 transaction';
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end = Math.min(total, this.page() * this.pageSize());
    return `${start}–${end} sur ${formatNumberFr(total)}`;
  }

  setPageSize(size: number): void {
    const next = Number(size);
    if (!this.pageSizes.includes(next) || next === this.pageSize()) return;
    this.pageSize.set(next);
    this.page.set(1);
    this.loadTransactions();
  }

  go(page: number): void {
    const next = Math.min(this.pageCount(), Math.max(1, page));
    if (next === this.page()) return;
    this.page.set(next);
    this.loadTransactions();
  }

  exportExcel(): void {
    const current = this.txPage();
    if (!current?.total || this.txExporting()) return;
    const agenceId = this.agency.agenceId;
    const criteria = this.txCriteria();
    const party = this.appliedPartyQuery;
    const devise = this.appliedDevise;
    const limit = 5000;
    this.txExporting.set(true);
    this.pilotage.loadAgenceTransactions(agenceId, criteria, 1, limit, party, { export: true }).subscribe({
      next: async (page) => {
        try {
          const truncated = page.total > page.lignes.length;
          const safeName = (this.title() || 'agence').replace(/[^\w\-]+/g, '_').slice(0, 40);
          await downloadPilotageAgencyTxExcel({
            filename: `transactions_${safeName}_${this.appliedFrom}_${this.appliedTo}.xlsx`,
            title: `Transactions — ${this.title()}`,
            subtitle: `${this.formatJour(this.appliedFrom)} – ${this.formatJour(this.appliedTo)} · ${devise} · ${this.domainesSummary()} · ${formatNumberFr(page.total)} transaction(s)`,
            devise,
            total: page.total,
            montantTotal: page.montantTotal,
            rows: page.lignes,
            truncated,
          });
          if (truncated) {
            this.toast.warning(`Export limité à ${formatNumberFr(limit)} lignes sur ${formatNumberFr(page.total)}.`);
          } else {
            this.toast.success('Export Excel prêt.');
          }
        } catch {
          this.toast.error('Export Excel impossible.');
        } finally {
          this.txExporting.set(false);
        }
      },
      error: () => {
        this.txExporting.set(false);
        this.toast.error('Export Excel impossible.');
      },
    });
  }

  private flashPaymentSelected(): boolean {
    const choice = this.productChoices().find((item) => item.module.trim().toUpperCase() === 'FLASHPAYMENT');
    return !!choice && this.draftProduitIds.includes(choice.id);
  }

  private resetLocalFilters(): void {
    this.syncScopeFromCriteria();
    this.draftEcran = '';
    this.draftProduitIds = [];
    this.draftPartenaire = '';
    this.draftModePaiement = '';
    this.draftSousProduit = '';
    this.draftStatutIds = [];
    this.draftPartyQuery = '';
    this.appliedEcran = '';
    this.appliedProduitIds = [];
    this.appliedProduits = [];
    this.appliedPartenaire = '';
    this.appliedModePaiement = '';
    this.appliedSousProduit = '';
    this.appliedStatutIds = [];
    this.appliedPartyQuery = '';
    this.sensListe.update((n) => n + 1);
    this.reloadModalProduits({ seedApplied: true });
  }

  private syncScopeFromCriteria(): void {
    this.draftDomaineIds = this.domaineIdsFromCriteria();
    this.draftFrom = this.criteria.from;
    this.draftTo = this.criteria.to;
    this.draftDevise = this.criteria.devise || 'USD';
    this.appliedDomaineIds = [...this.draftDomaineIds];
    this.appliedFrom = this.draftFrom;
    this.appliedTo = this.draftTo;
    this.appliedDevise = this.draftDevise;
    this.draftScopeTick.update((n) => n + 1);
  }

  /** Charge les produits du/des domaine(s) sélectionné(s) dans le modal. */
  private reloadModalProduits(options?: { seedApplied?: boolean }): void {
    const domaines = this.resolveDomaineCodes(this.draftDomaineIds);
    const token = ++this.filtresToken;
    if (!domaines.length) {
      this.modalProduits.set([]);
      this.produitsLoading.set(false);
      if (options?.seedApplied) this.appliedProduits = [];
      this.onSensChange();
      return;
    }
    this.produitsLoading.set(true);
    forkJoin(
      domaines.map((domaine) =>
        this.pilotage.loadFiltres(domaine).pipe(
          map((filtres) => ({ domaine, filtres })),
          catchError(() => of(null))
        )
      )
    ).subscribe({
      next: (parts) => {
        if (token !== this.filtresToken) return;
        const produits: PilotageProduitVue[] = [];
        for (const part of parts) {
          if (!part) continue;
          for (const produit of part.filtres.produits ?? []) {
            produits.push({ ...produit, domaine: part.domaine });
          }
        }
        this.modalProduits.set(produits);
        this.produitsLoading.set(false);
        if (options?.seedApplied) this.appliedProduits = [...produits];
        this.onSensChange();
      },
      error: () => {
        if (token !== this.filtresToken) return;
        this.modalProduits.set([]);
        this.produitsLoading.set(false);
        if (options?.seedApplied) this.appliedProduits = [];
        this.onSensChange();
      },
    });
  }

  private domaineChoices(): PilotageDomaineOption[] {
    return this.domaines?.length ? this.domaines : DEFAULT_DOMAINES;
  }

  private domaineIdsFromCriteria(): number[] {
    const codes = this.criteria.domaines?.length ? this.criteria.domaines : [this.criteria.domaine];
    const available = new Set(this.domaineChoices().map((d) => d.code));
    const picked = codes.filter((code) => available.has(code));
    const use = picked.length ? picked : this.domaineChoices().map((d) => d.code);
    return use.map((code) => pilotageDomaineOptionId(code));
  }

  private resolveDomaineCodes(ids: number[]): PilotageDomaine[] {
    const selected = new Set(ids);
    return this.domaineChoices()
      .filter((d) => selected.has(pilotageDomaineOptionId(d.code)))
      .map((d) => d.code);
  }

  private shortDomainLabel(label: string, code: PilotageDomaine): string {
    if (code === 'transfert') return 'Transferts';
    if (code === 'monnaie') return 'Monnaie';
    if (code === 'service') return 'Services';
    return label;
  }

  private resolveAppliedStatuts(): string[] {
    const ids = new Set(this.appliedStatutIds);
    return PILOTAGE_STATUT_OPTIONS.filter((o) => o.value && ids.has(pilotageStatutOptionId(o.value))).map(
      (o) => o.value
    );
  }

  private appliedProductRows(): PilotageProduitVue[] {
    const domaines = this.resolveDomaineCodes(this.appliedDomaineIds);
    return this.appliedProduits.filter((row) => !domaines.length || domaines.includes(row.domaine));
  }

  private resolvedAppliedProduitIds(): number[] {
    const choices = buildPilotageProduitChoices(this.appliedProductRows(), this.appliedEcran);
    const picked = this.appliedProduitIds.filter((id) => choices.some((choice) => choice.id === id));
    const flashChoice = choices.find((item) => item.module.trim().toUpperCase() === 'FLASHPAYMENT');
    const flashSelected = !!flashChoice && this.appliedProduitIds.includes(flashChoice.id);
    const partner = flashSelected ? pilotageCompactKey(this.appliedPartenaire) : '';
    const mode = flashSelected ? this.appliedModePaiement : '';
    const sous = mode === 'momo' ? pilotageCompactKey(this.appliedSousProduit) : '';
    if (!picked.length && !partner && !mode && !sous) return [];
    return resolvePilotageProduitIds(choices, picked, partner, mode, sous);
  }

  /** Conserve USD+CDF (conversion) du parent si la modal n'a pas changé de devise d'affichage. */
  private devisesForApi(): string[] {
    const one = (this.appliedDevise || this.criteria.devise || 'USD').trim().toUpperCase();
    const parent = (this.criteria.devises?.length ? this.criteria.devises : [])
      .map((d) => d.trim().toUpperCase())
      .filter(Boolean);
    const parentDisplay = (this.criteria.devise || '').trim().toUpperCase();
    if (parent.length > 1 && one === parentDisplay) {
      return parent;
    }
    return [one];
  }

  /** Critères parent + filtres appliqués de la modal (domaine / dates / devise inclus). */
  private txCriteria(): PilotageCriteria {
    const domaines = this.resolveDomaineCodes(this.appliedDomaineIds);
    const choices = buildPilotageProduitChoices(this.appliedProductRows(), this.appliedEcran);
    const flashChoice = choices.find((item) => item.module.trim().toUpperCase() === 'FLASHPAYMENT');
    const flashSelected = !!flashChoice && this.appliedProduitIds.includes(flashChoice.id);
    const partner = flashSelected ? pilotageCompactKey(this.appliedPartenaire) : '';
    const ecranOk =
      domaines.length === 1 && pilotageEcransForDomain(domaines[0]).some((e) => e.id === this.appliedEcran);
    return {
      ...this.criteria,
      domaine: domaines[0] ?? this.criteria.domaine,
      domaines: domaines.length ? domaines : this.criteria.domaines,
      devise: this.appliedDevise || this.criteria.devise,
      // KPI parent multi-devises : garder la conversion tant que la modal n'a pas changé de devise.
      devises: this.devisesForApi(),
      from: this.appliedFrom || this.criteria.from,
      to: this.appliedTo || this.criteria.to,
      produitIds: this.resolvedAppliedProduitIds(),
      produitLabels: [],
      partenaire: partner,
      modePaiement: partner ? this.appliedModePaiement : '',
      sousProduit: this.appliedModePaiement === 'momo' ? pilotageCompactKey(this.appliedSousProduit) : '',
      ecran: ecranOk ? this.appliedEcran : '',
      statutUniformes: this.resolveAppliedStatuts(),
      categories: [],
      agenceIds: [],
      agentIds: [],
      typeOperationIds: [],
      jourFiltre: '',
      couloirCodes: [],
    };
  }

  private loadFiche(): void {
    const agenceId = this.agency.agenceId;
    this.ficheLoading.set(true);
    this.pilotage.loadAgenceFiche(agenceId).subscribe({
      next: (fiche) => {
        if (this.agency.agenceId !== agenceId) return;
        this.fiche.set(fiche);
        this.ficheLoading.set(false);
      },
      error: () => {
        if (this.agency.agenceId !== agenceId) return;
        this.ficheLoading.set(false);
        this.toast.error('Fiche agence indisponible.');
      },
    });
  }

  private loadTransactions(): void {
    const agenceId = this.agency.agenceId;
    const token = ++this.txToken;
    const produitIds = this.resolvedAppliedProduitIds();
    const productCascade =
      this.appliedProduitIds.length > 0 ||
      !!this.appliedPartenaire ||
      !!this.appliedModePaiement ||
      !!this.appliedSousProduit;
    if (productCascade && !produitIds.length) {
      this.txPage.set({ total: 0, page: 1, size: this.pageSize(), moyenne: 0, montantTotal: 0, lignes: [] });
      this.txLoading.set(false);
      this.txError.set(false);
      return;
    }
    this.txLoading.set(true);
    this.txError.set(false);
    this.pilotage
      .loadAgenceTransactions(agenceId, this.txCriteria(), this.page(), this.pageSize(), this.appliedPartyQuery)
      .subscribe({
        next: (page) => {
          if (token !== this.txToken) return;
          const pages = Math.max(1, Math.ceil(page.total / this.pageSize()));
          if (page.total > 0 && this.page() > pages) {
            this.page.set(pages);
            this.loadTransactions();
            return;
          }
          this.txPage.set(page);
          this.txLoading.set(false);
        },
        error: () => {
          if (token !== this.txToken) return;
          this.txPage.set(null);
          this.txError.set(true);
          this.txLoading.set(false);
          this.toast.error('Transactions indisponibles.');
        },
      });
  }
}
