import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import {
  ApprovisionnementVasDashboard,
  ApprovisionnementVasDemandeInput,
  ApprovisionnementVasDemandeListItem,
  ApprovisionnementVasHistorique,
  ApprovisionnementVasLigneForm,
  ApprovisionnementVasModePaiement,
  ApprovisionnementVasPaiement,
  ApprovisionnementVasProduit,
  ApprovisionnementVasReleve,
  ApprovisionnementVasSeuil,
  ApprovisionnementVasSoldeAlerte,
  ApprovisionnementVasStatut,
} from '../../core/models/approvisionnement-vas.models';
import { ApprovisionnementVasService } from '../../core/services/approvisionnement-vas.service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PdfPreviewModalComponent } from '../../shared/components/pdf-preview-modal/pdf-preview-modal.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import {
  buildPdfBuffer,
  exportBrandFromSettings,
  exportExcel,
  type PdfExportOptions,
} from '../../shared/utils/format.utils';
import { pilotagePartenaireLabel } from '../pilotage/pilotage-filtres.config';

interface SoldeSeuilRow {
  key: string;
  produit_id: number;
  produit_libelle: string;
  devise: 'USD' | 'CDF';
  solde: number | null;
  solde_id: number | null;
  releve_le: string | null;
  seuil_id: number | null;
  seuil_attention: number | null;
  seuil_critique: number | null;
  niveau: 'ok' | 'attention' | 'critique';
}

@Component({
  selector: 'app-approvisionnement-vas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    SectionCardComponent,
    SkeletonComponent,
    StatusBadgeComponent,
    KpiCardComponent,
    PdfPreviewModalComponent,
  ],
  template: `
    @if (mode() === 'list') {
      <app-page-header title="Approvisionnement VAS" subtitle="Demandes de recharge Mobile Money">
        <div actions>
          @if (canExport()) {
            <button type="button" class="btn btn-outline-secondary btn-sm me-2" (click)="exportDemandesExcel()" [disabled]="exporting()">
              Excel
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm me-2" (click)="exportDemandesPdf()" [disabled]="exporting()">
              PDF
            </button>
          }
          @if (canCreate()) {
            <a class="btn btn-primary btn-sm" routerLink="/approvisionnement-vas/nouvelle">
              <i class="bi bi-plus-lg me-1"></i>Nouvelle demande
            </a>
          }
        </div>
      </app-page-header>

      <div class="row g-3 mb-3">
        <div class="col-6 col-lg-3">
          <app-kpi-card label="Proposé USD" [value]="formatAmount(kpi()?.total_propose_usd)" icon="bi bi-currency-dollar" [loading]="loadingList()" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card label="Proposé CDF" [value]="formatAmount(kpi()?.total_propose_cdf)" icon="bi bi-cash-stack" [loading]="loadingList()" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card label="Payé USD" [value]="formatAmount(kpi()?.total_paye_usd)" icon="bi bi-check2-circle" variant="primary" [loading]="loadingList()" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card
            label="En retard"
            [value]="kpi()?.nb_en_retard ?? '—'"
            icon="bi bi-alarm"
            variant="secondary"
            [hint]="kpi() ? 'Délai ' + kpi()!.delai_traitement_heures + ' h' : ''"
            [loading]="loadingList()"
          />
        </div>
      </div>
      <div class="row g-3 mb-3">
        <div class="col-6 col-lg-3">
          <app-kpi-card label="Brouillons" [value]="kpi()?.nb_brouillon ?? '—'" icon="bi bi-pencil" [loading]="loadingList()" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card label="En attente" [value]="kpi()?.nb_en_attente ?? '—'" icon="bi bi-hourglass-split" variant="secondary" [loading]="loadingList()" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card label="Payées" [value]="kpi()?.nb_payees ?? '—'" icon="bi bi-badge-ad" variant="primary" [loading]="loadingList()" />
        </div>
        <div class="col-6 col-lg-3">
          <app-kpi-card
            label="Validé USD / CDF"
            [value]="kpi() ? formatAmount(kpi()!.total_valide_usd) + ' / ' + formatAmount(kpi()!.total_valide_cdf) : '—'"
            icon="bi bi-shield-check"
            [loading]="loadingList()"
          />
        </div>
      </div>

      <app-section-card title="Alertes soldes">
        @if (loadingList()) {
          <app-skeleton type="table" [rows]="2" [cols]="3" />
        } @else if (alertes().length) {
          <ul class="list-unstyled mb-0 small">
            @for (a of alertes(); track a.produit_id + a.devise) {
              <li class="mb-1">
                <span class="badge" [class.text-bg-danger]="a.niveau === 'critique'" [class.text-bg-warning]="a.niveau === 'attention'">
                  {{ a.niveau }}
                </span>
                {{ a.produit_libelle }} ({{ a.devise }}) — solde {{ formatAmount(a.solde) }}
              </li>
            }
          </ul>
        } @else {
          <p class="text-muted small mb-0">Aucune alerte solde pour le moment.</p>
        }
      </app-section-card>

      @if (canSoldes()) {
        <app-section-card title="Soldes & seuils">
          <div actions>
            <button type="button" class="btn btn-outline-secondary btn-sm" (click)="openSoldesModal()" title="Voir soldes et seuils">
              <i class="bi bi-table me-1"></i>Tableau
            </button>
          </div>
          @if (loadingList()) {
            <app-skeleton type="table" [rows]="2" [cols]="4" />
          } @else {
            <div class="row g-2 align-items-end mb-2">
              <div class="col-md-3">
                <label class="form-label form-label-sm">Produit</label>
                <select class="form-select form-select-sm" [(ngModel)]="soldeProduitId">
                  <option [ngValue]="null">Choisir…</option>
                  @for (p of produitsList(); track p.produit_id) {
                    <option [ngValue]="p.produit_id">{{ labelProduit(p) }}</option>
                  }
                </select>
              </div>
              <div class="col-md-2">
                <label class="form-label form-label-sm">Devise</label>
                <select class="form-select form-select-sm" [(ngModel)]="soldeDevise">
                  <option value="USD">USD</option>
                  <option value="CDF">CDF</option>
                </select>
              </div>
              <div class="col-md-2">
                <label class="form-label form-label-sm">Solde</label>
                <input type="number" class="form-control form-control-sm" [(ngModel)]="soldeMontant" step="0.01" />
              </div>
              <div class="col-md-2">
                <button type="button" class="btn btn-outline-primary btn-sm" (click)="enregistrerSolde()">Relever</button>
              </div>
              @if (canSeuils()) {
                <div class="col-md-1">
                  <label class="form-label form-label-sm">Attention</label>
                  <input type="number" class="form-control form-control-sm" [(ngModel)]="seuilAttention" step="0.01" />
                </div>
                <div class="col-md-1">
                  <label class="form-label form-label-sm">Critique</label>
                  <input type="number" class="form-control form-control-sm" [(ngModel)]="seuilCritique" step="0.01" />
                </div>
                <div class="col-md-1">
                  <button type="button" class="btn btn-outline-secondary btn-sm" (click)="enregistrerSeuil()">Seuil</button>
                </div>
              }
            </div>
          }
        </app-section-card>
      }

      <app-section-card title="Demandes">
        <div class="row g-2 mb-3 align-items-end">
          <div class="col-md-4">
            <label class="form-label form-label-sm" for="filtre-statut">Statut</label>
            <select id="filtre-statut" class="form-select form-select-sm" [(ngModel)]="filtreStatut" (ngModelChange)="loadList()" [disabled]="loadingList()">
              <option value="">Tous</option>
              <option value="brouillon">Brouillon</option>
              <option value="en_attente_validation">En attente validation</option>
              <option value="en_attente_paiement">En attente paiement</option>
              <option value="partiellement_payee">Partiellement payée</option>
              <option value="payee">Payée</option>
              <option value="rejetee">Rejetée</option>
              <option value="annulee">Annulée</option>
            </select>
          </div>
        </div>
        @if (loadingList()) {
          <app-skeleton type="table" [rows]="6" [cols]="7" />
        } @else {
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Date de référence</th>
                  <th>Statut</th>
                  <th class="text-end">Lignes</th>
                  <th class="text-end">Proposé USD</th>
                  <th class="text-end">Proposé CDF</th>
                  <th>Créée le</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (d of demandes(); track d.id) {
                  <tr [class.table-warning]="d.en_retard">
                    <td>{{ d.date_reference | date: 'dd/MM/yyyy' }}</td>
                    <td>
                      <app-status-badge [label]="statutLabel(d.statut)" />
                      @if (d.en_retard) {
                        <span class="badge text-bg-danger-subtle ms-1">Retard</span>
                      }
                    </td>
                    <td class="text-end">{{ d.nb_lignes }}</td>
                    <td class="text-end mono">{{ formatAmount(d.total_propose_usd) }}</td>
                    <td class="text-end mono">{{ formatAmount(d.total_propose_cdf) }}</td>
                    <td>{{ d.cree_le | date: 'dd/MM/yyyy HH:mm' }}</td>
                    <td class="text-end">
                      <a class="btn btn-outline-secondary btn-sm" [routerLink]="['/approvisionnement-vas', d.id]">Ouvrir</a>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="text-muted text-center py-4">Aucune demande pour le moment.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </app-section-card>

      @if (soldesModalOpen()) {
        <div class="modal d-block" tabindex="-1" style="background: rgba(0,0,0,.45)">
          <div class="modal-dialog modal-lg modal-dialog-scrollable modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Soldes &amp; seuils en cours</h5>
                <button type="button" class="btn-close" aria-label="Fermer" (click)="closeSoldesModal()"></button>
              </div>
              <div class="modal-body p-0">
                @if (loadingSoldesModal()) {
                  <div class="p-3"><app-skeleton type="table" [rows]="4" [cols]="6" /></div>
                } @else {
                  <div class="table-responsive">
                    <table class="table table-sm align-middle mb-0">
                      <thead>
                        <tr>
                          <th>Produit</th>
                          <th>Devise</th>
                          <th class="text-end">Solde</th>
                          <th class="text-end">Attention</th>
                          <th class="text-end">Critique</th>
                          <th>Niveau</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of soldesSeuilsRows(); track row.key) {
                          <tr>
                            <td>{{ row.produit_libelle }}</td>
                            <td>{{ row.devise }}</td>
                            <td class="text-end mono">{{ formatAmount(row.solde) }}</td>
                            <td class="text-end mono">{{ formatAmount(row.seuil_attention) }}</td>
                            <td class="text-end mono">{{ formatAmount(row.seuil_critique) }}</td>
                            <td>
                              <span
                                class="badge"
                                [class.text-bg-success-subtle]="row.niveau === 'ok'"
                                [class.text-bg-warning-subtle]="row.niveau === 'attention'"
                                [class.text-bg-danger-subtle]="row.niveau === 'critique'"
                              >{{ row.niveau }}</span>
                            </td>
                            <td class="text-end text-nowrap">
                              <button type="button" class="btn btn-outline-secondary btn-sm me-1" title="Modifier" (click)="editSoldeSeuil(row)">
                                <i class="bi bi-pencil"></i>
                              </button>
                              @if (canSeuils()) {
                                <button type="button" class="btn btn-outline-danger btn-sm" title="Supprimer" (click)="deleteSoldeSeuil(row)">
                                  <i class="bi bi-trash"></i>
                                </button>
                              }
                            </td>
                          </tr>
                        } @empty {
                          <tr><td colspan="7" class="text-muted text-center py-4">Aucun solde ni seuil enregistré.</td></tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary btn-sm" (click)="closeSoldesModal()">Fermer</button>
              </div>
            </div>
          </div>
        </div>
      }
    } @else {
      <app-page-header
        [title]="demandeId() ? 'Demande #' + demandeId() : 'Nouvelle demande'"
        subtitle="Consommations J-1 / J-2 calculées automatiquement (Mobile Money)"
      >
        <div actions>
          <a class="btn btn-outline-secondary btn-sm" routerLink="/approvisionnement-vas">Retour</a>
        </div>
      </app-page-header>

      @if (demandeId() && enRetard() && !loadingForm()) {
        <div class="alert alert-warning py-2 small">
          Délai de traitement dépassé ({{ delaiHeures() }} h).
        </div>
      }

      <form (ngSubmit)="save()">
        <app-section-card title="En-tête">
          @if (loadingForm()) {
            <app-skeleton type="table" [rows]="2" [cols]="3" />
          } @else {
            <div class="row g-3">
              <div class="col-md-4">
                <label class="form-label" for="date-ref">Date de référence</label>
                <input
                  id="date-ref"
                  type="date"
                  class="form-control form-control-sm appro-input"
                  name="dateRef"
                  [(ngModel)]="dateReference"
                  (ngModelChange)="onDateChange()"
                  [disabled]="!canEditContent()"
                  required
                />
                <div class="form-text">Pas de demande le samedi ni le dimanche.</div>
              </div>
              <div class="col-md-4">
                <label class="form-label">Statut</label>
                <div>
                  <app-status-badge [label]="statutLabel(statut)" />
                </div>
              </div>
              <div class="col-md-4">
                <label class="form-label" for="commentaire">Commentaire</label>
                <input
                  id="commentaire"
                  class="form-control form-control-sm appro-input"
                  name="commentaire"
                  [(ngModel)]="commentaire"
                  [disabled]="!canEditContent()"
                />
              </div>
            </div>

            @if (demandeId()) {
              <div class="d-flex flex-wrap gap-2 mt-3">
                @if (canSoumettre() && statut === 'brouillon') {
                  <button type="button" class="btn btn-outline-primary btn-sm" (click)="doTransition('soumise')">Soumettre</button>
                }
                @if (canValider() && statut === 'en_attente_validation') {
                  <button type="button" class="btn btn-success btn-sm" (click)="doTransition('validee')">Valider</button>
                }
                @if (canRejeter() && statut === 'en_attente_validation') {
                  <button type="button" class="btn btn-outline-danger btn-sm" (click)="doRejet()">Rejeter</button>
                }
                @if ((canCreate() || canEditContent()) && (statut === 'brouillon' || statut === 'soumise' || statut === 'en_attente_validation')) {
                  <button type="button" class="btn btn-outline-secondary btn-sm" (click)="doTransition('annulee')">Annuler</button>
                }
              </div>
            }
          }
        </app-section-card>

          <div class="mt-3">
            <app-section-card title="Lignes produits">
              @if (loadingForm()) {
                <app-skeleton type="table" [rows]="4" [cols]="8" />
              } @else {
              <div class="table-responsive">
                <table class="table table-sm align-middle appro-table">
                  <thead>
                    <tr>
                      <th>Opérateur</th>
                      <th>Devise</th>
                      <th class="text-end">Conso. J-1</th>
                      <th class="text-end">Conso. J-2</th>
                      <th class="text-end">Moyenne</th>
                      <th class="text-end">Solde</th>
                      <th class="text-end">Montant proposé</th>
                      <th class="text-end">Montant validé</th>
                      <th class="text-end">Montant payé</th>
                      @if (canEditContent()) {
                        <th></th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (line of lignes(); track line.key; let i = $index) {
                      <tr>
                        <td style="min-width: 11rem">
                          <select
                            class="form-select form-select-sm appro-input"
                            [name]="'prod-' + line.key"
                            [(ngModel)]="line.produit_id"
                            (ngModelChange)="onProduitChange(line)"
                            [disabled]="!canEditContent()"
                            required
                          >
                            <option [ngValue]="null">Sélectionner…</option>
                            @for (p of produits(); track p.produit_id) {
                              <option [ngValue]="p.produit_id">{{ labelProduit(p) }}</option>
                            }
                          </select>
                          @if (line.error) {
                            <div class="text-danger small mt-1">{{ line.error }}</div>
                          }
                        </td>
                        <td style="min-width: 5.5rem">
                          <select
                            class="form-select form-select-sm appro-input"
                            [name]="'dev-' + line.key"
                            [(ngModel)]="line.devise"
                            (ngModelChange)="refreshLine(line)"
                            [disabled]="!canEditContent()"
                          >
                            <option value="USD">USD</option>
                            <option value="CDF">CDF</option>
                          </select>
                        </td>
                        <td class="text-end mono">
                          @if (line.loading) {
                            <span class="spinner-border spinner-border-sm"></span>
                          } @else {
                            {{ formatAmount(line.consommation_j1) }}
                          }
                        </td>
                        <td class="text-end mono">{{ formatAmount(line.consommation_j2) }}</td>
                        <td class="text-end mono fw-semibold">{{ formatAmount(line.moyenne) }}</td>
                        <td class="solde-cell">
                          <input
                            type="text"
                            class="form-control form-control-sm appro-input solde-label"
                            [name]="'libelle-' + line.key"
                            [(ngModel)]="line.libelle_solde"
                            [disabled]="!canEditContent()"
                            placeholder="Solde à 08h"
                          />
                          <input
                            type="number"
                            class="solde-value text-end mono"
                            [name]="'solde-' + line.key"
                            [(ngModel)]="line.solde_08h"
                            [disabled]="!canEditContent()"
                            step="0.01"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            class="form-control form-control-sm text-end appro-input"
                            [name]="'propose-' + line.key"
                            [(ngModel)]="line.montant_propose"
                            [disabled]="!canEditContent()"
                            step="0.01"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            class="form-control form-control-sm text-end appro-input"
                            [name]="'valide-' + line.key"
                            [(ngModel)]="line.montant_valide"
                            [disabled]="!canEditContent()"
                            step="0.01"
                          />
                        </td>
                        <td class="text-end mono">{{ formatAmount(line.montant_paye) }}</td>
                        @if (canEditContent()) {
                          <td class="text-end">
                            <button type="button" class="btn btn-outline-danger btn-sm" (click)="removeLine(i)" title="Retirer">
                              <i class="bi bi-trash"></i>
                            </button>
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              @if (canEditContent()) {
                <button type="button" class="btn btn-outline-secondary btn-sm mt-2" (click)="addLine()">
                  <i class="bi bi-plus-lg me-1"></i>Ajouter un produit
                </button>
              }
              }
            </app-section-card>
          </div>

          @if (canEditContent() && !loadingForm()) {
            <div class="text-end mt-3">
              <button type="submit" class="btn btn-primary btn-sm" [disabled]="saving() || !canSubmit()">
                @if (saving()) {
                  <span class="spinner-border spinner-border-sm me-1"></span>
                }
                Enregistrer
              </button>
            </div>
          }
        </form>

        @if (demandeId()) {
          <div class="mt-3">
            <app-section-card title="Paiements">
              @if (loadingForm()) {
                <app-skeleton type="table" [rows]="3" [cols]="5" />
              } @else {
                @if (canPayer()) {
                  <div class="row g-2 align-items-end mb-3">
                    <div class="col-md-3">
                      <label class="form-label form-label-sm">Ligne</label>
                      <select class="form-select form-select-sm" [(ngModel)]="payLigneId">
                        <option [ngValue]="null">Choisir…</option>
                        @for (l of lignes(); track l.key) {
                          @if (l.id) {
                            <option [ngValue]="l.id">{{ l.produit_libelle }} {{ l.devise }} (reste {{ formatAmount(l.reste_a_payer) }})</option>
                          }
                        }
                      </select>
                    </div>
                    <div class="col-md-2">
                      <label class="form-label form-label-sm">Montant</label>
                      <input type="number" class="form-control form-control-sm" [(ngModel)]="payMontant" step="0.01" />
                    </div>
                    <div class="col-md-2">
                      <label class="form-label form-label-sm">Date</label>
                      <input type="date" class="form-control form-control-sm" [(ngModel)]="payDate" />
                    </div>
                    <div class="col-md-2">
                      <label class="form-label form-label-sm">Mode</label>
                      <select class="form-select form-select-sm" [(ngModel)]="payMode">
                        <option value="banque">Banque</option>
                        <option value="transfert_interne">Transfert interne</option>
                        <option value="autre">Autre</option>
                      </select>
                    </div>
                    <div class="col-md-2">
                      <label class="form-label form-label-sm">Référence</label>
                      <input class="form-control form-control-sm" [(ngModel)]="payReference" />
                    </div>
                    <div class="col-md-1">
                      <button type="button" class="btn btn-primary btn-sm w-100" (click)="ajouterPaiement()" [disabled]="paying()">Payer</button>
                    </div>
                  </div>
                }
                <div class="table-responsive">
                  <table class="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Ligne</th>
                        <th>Mode</th>
                        <th class="text-end">Montant</th>
                        <th>Référence</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (p of paiements(); track p.id) {
                        <tr>
                          <td>{{ p.date_paiement | date: 'dd/MM/yyyy' }}</td>
                          <td>#{{ p.ligne_id }}</td>
                          <td>{{ p.mode_paiement }}</td>
                          <td class="text-end mono">{{ formatAmount(p.montant) }} {{ p.devise }}</td>
                          <td>{{ p.reference_paiement || '—' }}</td>
                        </tr>
                      } @empty {
                        <tr><td colspan="5" class="text-muted text-center py-3">Aucun paiement.</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
                @if (canExport() && paiements().length) {
                  <div class="mt-2">
                    <button type="button" class="btn btn-outline-secondary btn-sm me-2" (click)="exportPaiementsExcel()">Export paiements Excel</button>
                    <button type="button" class="btn btn-outline-secondary btn-sm" (click)="exportPaiementsPdf()">Export paiements PDF</button>
                  </div>
                }
              }
            </app-section-card>
          </div>

          <div class="mt-3">
            <app-section-card title="Historique des statuts">
              @if (loadingForm()) {
                <app-skeleton type="table" [rows]="4" [cols]="2" />
              } @else {
                <ul class="timeline list-unstyled mb-0">
                  @for (h of historique(); track h.id) {
                    <li class="timeline-item" [ngClass]="historiqueItemClass(h.nouveau_statut)">
                      <div class="timeline-dot" [ngClass]="historiqueDotClass(h.nouveau_statut)"></div>
                      <div>
                        <div class="fw-semibold small d-flex flex-wrap align-items-center gap-1">
                          @if (h.ancien_statut) {
                            <span class="badge hist-badge" [ngClass]="historiqueBadgeClass(h.ancien_statut)">{{ statutLabel(h.ancien_statut) }}</span>
                            <i class="bi bi-arrow-right text-muted"></i>
                          }
                          <span class="badge hist-badge" [ngClass]="historiqueBadgeClass(h.nouveau_statut)">{{ statutLabel(h.nouveau_statut) }}</span>
                        </div>
                        <div class="text-muted small mt-1">{{ h.cree_le | date: 'dd/MM/yyyy HH:mm' }}</div>
                        @if (h.commentaire) {
                          <div class="small mt-1">{{ h.commentaire }}</div>
                        }
                      </div>
                    </li>
                  } @empty {
                    <li class="text-muted small">Aucun historique.</li>
                  }
                </ul>
              }
            </app-section-card>
          </div>
        }
      }

    <app-pdf-preview-modal
      [open]="pdfPreviewOpen()"
      [title]="pdfPreviewTitle()"
      [pdfUrl]="pdfPreviewUrl()"
      [filename]="pdfPreviewFilename()"
      [buffer]="pdfPreviewBuffer()"
      (closed)="closePdfPreview()"
    />
  `,
  styles: `
    .appro-table th,
    .appro-table td {
      white-space: nowrap;
      vertical-align: middle;
    }
    .mono {
      font-variant-numeric: tabular-nums;
    }
    .appro-input {
      font-size: 0.78rem;
    }
    .solde-cell {
      min-width: 8.5rem;
    }
    .solde-label {
      border: 0;
      border-bottom: 1px dashed var(--bs-border-color);
      border-radius: 0;
      background: transparent;
      padding-left: 0;
      padding-right: 0;
      margin-bottom: 0.15rem;
      font-size: 0.7rem;
      color: var(--bs-secondary-color);
    }
    .solde-value {
      width: 100%;
      border: 0;
      background: transparent;
      font-size: 0.85rem;
      font-weight: 600;
      padding: 0;
    }
    .solde-value:focus {
      outline: none;
      box-shadow: none;
    }
    .timeline-item {
      position: relative;
      padding-left: 1.25rem;
      padding-bottom: 0.85rem;
      border-left: 2px solid var(--bs-border-color);
      margin-left: 0.35rem;
    }
    .timeline-item.hist-success { border-left-color: #198754; }
    .timeline-item.hist-warning { border-left-color: #fd7e14; }
    .timeline-item.hist-danger { border-left-color: #dc3545; }
    .timeline-item.hist-info { border-left-color: #0d6efd; }
    .timeline-item.hist-muted { border-left-color: #6c757d; }
    .timeline-dot {
      position: absolute;
      left: -0.4rem;
      top: 0.2rem;
      width: 0.65rem;
      height: 0.65rem;
      border-radius: 50%;
      background: var(--bs-primary);
    }
    .timeline-dot.hist-success { background: #198754; }
    .timeline-dot.hist-warning { background: #fd7e14; }
    .timeline-dot.hist-danger { background: #dc3545; }
    .timeline-dot.hist-info { background: #0d6efd; }
    .timeline-dot.hist-muted { background: #6c757d; }
    .hist-badge.text-bg-success-subtle,
    .hist-badge.text-bg-warning-subtle,
    .hist-badge.text-bg-danger-subtle,
    .hist-badge.text-bg-primary-subtle,
    .hist-badge.text-bg-secondary-subtle {
      font-weight: 600;
    }
  `,
})
export class ApprovisionnementVasPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApprovisionnementVasService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly appSettings = inject(AppSettingsService);
  private readonly router = inject(Router);

  readonly mode = signal<'list' | 'form'>('list');
  readonly demandeId = signal<number | null>(null);
  readonly loadingList = signal(true);
  readonly loadingForm = signal(false);
  readonly saving = signal(false);
  readonly paying = signal(false);
  readonly exporting = signal(false);
  readonly demandes = signal<ApprovisionnementVasDemandeListItem[]>([]);
  readonly produits = signal<ApprovisionnementVasProduit[]>([]);
  readonly lignes = signal<ApprovisionnementVasLigneForm[]>([]);
  readonly historique = signal<ApprovisionnementVasHistorique[]>([]);
  readonly paiements = signal<ApprovisionnementVasPaiement[]>([]);
  readonly kpi = signal<ApprovisionnementVasDashboard | null>(null);
  readonly alertes = signal<ApprovisionnementVasSoldeAlerte[]>([]);
  readonly produitsList = signal<ApprovisionnementVasProduit[]>([]);
  readonly soldes = signal<ApprovisionnementVasReleve[]>([]);
  readonly seuils = signal<ApprovisionnementVasSeuil[]>([]);
  readonly soldesSeuilsRows = signal<SoldeSeuilRow[]>([]);
  readonly soldesModalOpen = signal(false);
  readonly loadingSoldesModal = signal(false);
  readonly enRetard = signal(false);
  readonly delaiHeures = signal(2);
  readonly pdfPreviewOpen = signal(false);
  readonly pdfPreviewTitle = signal('Aperçu PDF');
  readonly pdfPreviewFilename = signal('export.pdf');
  readonly pdfPreviewUrl = signal<string | null>(null);
  readonly pdfPreviewBuffer = signal<ArrayBuffer | null>(null);

  dateReference = this.todayIso();
  statut: ApprovisionnementVasStatut = 'brouillon';
  commentaire = '';
  filtreStatut = '';
  payLigneId: number | null = null;
  payMontant: number | null = null;
  payDate = this.todayIso();
  payMode: ApprovisionnementVasModePaiement = 'banque';
  payReference = '';
  soldeProduitId: number | null = null;
  soldeDevise: 'USD' | 'CDF' = 'USD';
  soldeMontant: number | null = null;
  seuilAttention: number | null = null;
  seuilCritique: number | null = null;
  private lineSeq = 0;
  private navSub?: Subscription;
  private pdfObjectUrl: string | null = null;

  ngOnInit(): void {
    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => void this.bootstrap());
    void this.bootstrap();
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
    this.revokePdfUrl();
  }

  historiqueTone(statut: string): 'success' | 'warning' | 'danger' | 'info' | 'muted' {
    switch (statut) {
      case 'payee':
      case 'validee':
        return 'success';
      case 'partiellement_payee':
      case 'en_attente_paiement':
      case 'en_attente_validation':
      case 'soumise':
        return 'warning';
      case 'rejetee':
      case 'annulee':
        return 'danger';
      case 'brouillon':
        return 'muted';
      default:
        return 'info';
    }
  }

  historiqueItemClass(statut: string): string {
    return `hist-${this.historiqueTone(statut)}`;
  }

  historiqueDotClass(statut: string): string {
    return `hist-${this.historiqueTone(statut)}`;
  }

  historiqueBadgeClass(statut: string): string {
    switch (this.historiqueTone(statut)) {
      case 'success':
        return 'text-bg-success-subtle';
      case 'warning':
        return 'text-bg-warning-subtle';
      case 'danger':
        return 'text-bg-danger-subtle';
      case 'muted':
        return 'text-bg-secondary-subtle';
      default:
        return 'text-bg-primary-subtle';
    }
  }

  async openSoldesModal(): Promise<void> {
    this.soldesModalOpen.set(true);
    this.loadingSoldesModal.set(true);
    try {
      await this.refreshSoldesSeuils();
    } finally {
      this.loadingSoldesModal.set(false);
    }
  }

  closeSoldesModal(): void {
    this.soldesModalOpen.set(false);
  }

  editSoldeSeuil(row: SoldeSeuilRow): void {
    this.soldeProduitId = row.produit_id;
    this.soldeDevise = row.devise;
    this.soldeMontant = row.solde;
    this.seuilAttention = row.seuil_attention;
    this.seuilCritique = row.seuil_critique;
    this.closeSoldesModal();
    this.toast.success('Ligne chargée dans le formulaire Soldes & seuils');
  }

  async deleteSoldeSeuil(row: SoldeSeuilRow): Promise<void> {
    if (!window.confirm(`Supprimer solde/seuil pour ${row.produit_libelle} (${row.devise}) ?`)) {
      return;
    }
    try {
      if (row.seuil_id != null) {
        await firstValueFrom(this.api.deleteSeuil(row.seuil_id));
      }
      if (row.solde_id != null) {
        await firstValueFrom(this.api.deleteSolde(row.solde_id));
      }
      this.toast.success('Supprimé');
      await this.refreshSoldesSeuils();
      this.alertes.set(await firstValueFrom(this.api.alertesSoldes()).catch(() => []));
    } catch {
      this.toast.error('Suppression impossible');
    }
  }

  private async refreshSoldesSeuils(): Promise<void> {
    const [soldes, seuils] = await Promise.all([
      firstValueFrom(this.api.soldes()).catch(() => [] as ApprovisionnementVasReleve[]),
      firstValueFrom(this.api.seuils()).catch(() => [] as ApprovisionnementVasSeuil[]),
    ]);
    this.soldes.set(soldes);
    this.seuils.set(seuils);
    this.soldesSeuilsRows.set(this.buildSoldesSeuilsRows(soldes, seuils));
  }

  private buildSoldesSeuilsRows(
    soldes: ApprovisionnementVasReleve[],
    seuils: ApprovisionnementVasSeuil[]
  ): SoldeSeuilRow[] {
    const map = new Map<string, SoldeSeuilRow>();
    for (const s of soldes) {
      const key = `${s.produit_id}|${s.devise}`;
      map.set(key, {
        key,
        produit_id: s.produit_id,
        produit_libelle: s.produit_libelle,
        devise: s.devise,
        solde: s.solde,
        solde_id: s.id,
        releve_le: s.releve_le,
        seuil_id: null,
        seuil_attention: null,
        seuil_critique: null,
        niveau: 'ok',
      });
    }
    for (const s of seuils) {
      const key = `${s.produit_id}|${s.devise}`;
      const existing = map.get(key);
      if (existing) {
        existing.seuil_id = s.id;
        existing.seuil_attention = s.seuil_attention;
        existing.seuil_critique = s.seuil_critique;
      } else {
        map.set(key, {
          key,
          produit_id: s.produit_id,
          produit_libelle: s.produit_libelle,
          devise: s.devise,
          solde: null,
          solde_id: null,
          releve_le: null,
          seuil_id: s.id,
          seuil_attention: s.seuil_attention,
          seuil_critique: s.seuil_critique,
          niveau: 'ok',
        });
      }
    }
    return [...map.values()]
      .map((row) => {
        let niveau: SoldeSeuilRow['niveau'] = 'ok';
        if (row.solde != null && row.seuil_critique != null && row.solde <= row.seuil_critique) {
          niveau = 'critique';
        } else if (row.solde != null && row.seuil_attention != null && row.solde <= row.seuil_attention) {
          niveau = 'attention';
        }
        return { ...row, niveau };
      })
      .sort((a, b) => a.produit_libelle.localeCompare(b.produit_libelle) || a.devise.localeCompare(b.devise));
  }

  private exportBrand() {
    return exportBrandFromSettings(this.appSettings.settings());
  }

  private revokePdfUrl(): void {
    if (this.pdfObjectUrl) {
      URL.revokeObjectURL(this.pdfObjectUrl);
      this.pdfObjectUrl = null;
    }
  }

  closePdfPreview(): void {
    this.pdfPreviewOpen.set(false);
    this.pdfPreviewBuffer.set(null);
    this.pdfPreviewUrl.set(null);
    this.revokePdfUrl();
  }

  private async openPdfPreview(options: PdfExportOptions): Promise<void> {
    this.exporting.set(true);
    try {
      const buffer = await buildPdfBuffer({
        ...options,
        brand: options.brand ?? this.exportBrand(),
      });
      this.revokePdfUrl();
      const blob = new Blob([buffer], { type: 'application/pdf' });
      this.pdfObjectUrl = URL.createObjectURL(blob);
      this.pdfPreviewBuffer.set(buffer);
      this.pdfPreviewUrl.set(this.pdfObjectUrl);
      this.pdfPreviewTitle.set(options.title);
      this.pdfPreviewFilename.set(options.filename);
      this.pdfPreviewOpen.set(true);
    } finally {
      this.exporting.set(false);
    }
  }

  canCreate(): boolean {
    return this.auth.can('approvisionnement.vas.creer') || this.auth.can('approvisionnement.vas.ecrire');
  }

  canEditContent(): boolean {
    if (!(this.auth.can('approvisionnement.vas.modifier') || this.auth.can('approvisionnement.vas.ecrire') || this.canCreate())) {
      return false;
    }
    if (!this.demandeId()) return true;
    return this.statut === 'brouillon' || this.statut === 'soumise';
  }

  canSoumettre(): boolean {
    return this.auth.can('approvisionnement.vas.soumettre') || this.auth.can('approvisionnement.vas.ecrire');
  }

  canValider(): boolean {
    return this.auth.can('approvisionnement.vas.valider') || this.auth.can('approvisionnement.vas.ecrire');
  }

  canRejeter(): boolean {
    return this.auth.can('approvisionnement.vas.rejeter') || this.auth.can('approvisionnement.vas.ecrire');
  }

  canPayer(): boolean {
    const ok = this.auth.can('approvisionnement.vas.payer') || this.auth.can('approvisionnement.vas.ecrire');
    return (
      ok &&
      (this.statut === 'en_attente_paiement' ||
        this.statut === 'partiellement_payee' ||
        this.statut === 'validee')
    );
  }

  canExport(): boolean {
    return this.auth.can('approvisionnement.vas.exporter') || this.auth.can('approvisionnement.vas.lire');
  }

  canSoldes(): boolean {
    return this.auth.can('approvisionnement.vas.soldes.lire') || this.auth.can('approvisionnement.vas.lire');
  }

  canSeuils(): boolean {
    return this.auth.can('approvisionnement.vas.seuils.ecrire') || this.auth.can('approvisionnement.vas.ecrire');
  }

  async enregistrerSolde(): Promise<void> {
    if (!this.soldeProduitId || this.soldeMontant == null) {
      this.toast.error('Produit et solde requis');
      return;
    }
    try {
      await firstValueFrom(
        this.api.createSolde({
          produit_id: this.soldeProduitId,
          devise: this.soldeDevise,
          solde: this.soldeMontant,
        })
      );
      this.toast.success('Solde relevé');
      this.soldeMontant = null;
      this.alertes.set(await firstValueFrom(this.api.alertesSoldes()));
      await this.refreshSoldesSeuils();
    } catch {
      this.toast.error('Relevé impossible');
    }
  }

  async enregistrerSeuil(): Promise<void> {
    if (!this.soldeProduitId || this.seuilAttention == null || this.seuilCritique == null) {
      this.toast.error('Produit et seuils requis');
      return;
    }
    try {
      await firstValueFrom(
        this.api.upsertSeuil({
          produit_id: this.soldeProduitId,
          devise: this.soldeDevise,
          seuil_attention: this.seuilAttention,
          seuil_critique: this.seuilCritique,
        })
      );
      this.toast.success('Seuil enregistré');
      this.alertes.set(await firstValueFrom(this.api.alertesSoldes()));
      await this.refreshSoldesSeuils();
    } catch {
      this.toast.error('Seuil impossible');
    }
  }

  canSubmit(): boolean {
    if (!this.dateReference) return false;
    const lines = this.lignes();
    if (!lines.length) return false;
    return lines.every(
      (l) =>
        l.produit_id != null &&
        !l.loading &&
        !l.error &&
        l.consommation_j1 != null &&
        l.consommation_j2 != null &&
        l.moyenne != null
    );
  }

  labelProduit(p: ApprovisionnementVasProduit): string {
    return pilotagePartenaireLabel(p.produit_libelle || p.operateur);
  }

  statutLabel(statut: string): string {
    switch (statut) {
      case 'brouillon':
        return 'Brouillon';
      case 'soumise':
        return 'Soumise';
      case 'en_attente_validation':
        return 'En attente validation';
      case 'validee':
        return 'Validée';
      case 'en_attente_paiement':
        return 'En attente paiement';
      case 'partiellement_payee':
        return 'Partiellement payée';
      case 'payee':
        return 'Payée';
      case 'rejetee':
        return 'Rejetée';
      case 'annulee':
        return 'Annulée';
      default:
        return statut || '—';
    }
  }

  formatAmount(value: number | null | undefined): string {
    if (value == null || Number.isNaN(Number(value))) return '—';
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value));
  }

  addLine(): void {
    this.lignes.update((rows) => [...rows, this.emptyLine()]);
  }

  removeLine(index: number): void {
    this.lignes.update((rows) => rows.filter((_, i) => i !== index));
  }

  onDateChange(): void {
    for (const line of this.lignes()) {
      void this.refreshLine(line);
    }
  }

  onProduitChange(line: ApprovisionnementVasLigneForm): void {
    const p = this.produits().find((x) => x.produit_id === line.produit_id);
    line.operateur = p?.operateur ?? '';
    line.produit_libelle = p?.produit_libelle ?? '';
    void this.refreshLine(line);
  }

  async refreshLine(line: ApprovisionnementVasLigneForm): Promise<void> {
    if (!line.produit_id || !this.dateReference || !line.devise) {
      line.consommation_j1 = null;
      line.consommation_j2 = null;
      line.moyenne = null;
      line.error = null;
      this.lignes.update((rows) => [...rows]);
      return;
    }
    line.loading = true;
    line.error = null;
    this.lignes.update((rows) => [...rows]);
    try {
      const calc = await firstValueFrom(
        this.api.calculerConsommation(line.produit_id, line.devise, this.dateReference)
      );
      line.operateur = calc.operateur;
      line.produit_libelle = calc.produit_libelle;
      line.consommation_j1 = Number(calc.j1.consommation);
      line.consommation_j2 = Number(calc.j2.consommation);
      line.moyenne = Number(calc.moyenne);
      line.j1_debut = calc.j1.periode.debut;
      line.j1_fin = calc.j1.periode.fin;
      line.j2_debut = calc.j2.periode.debut;
      line.j2_fin = calc.j2.periode.fin;
      line.error = null;
    } catch (err: unknown) {
      line.consommation_j1 = null;
      line.consommation_j2 = null;
      line.moyenne = null;
      const msg =
        err && typeof err === 'object' && 'error' in err
          ? String((err as { error?: { message?: string } }).error?.message ?? '')
          : '';
      line.error = msg.includes('week-end')
        ? 'Week-end : choisissez un jour ouvré.'
        : 'Calcul impossible pour cette ligne.';
    } finally {
      line.loading = false;
      this.lignes.update((rows) => [...rows]);
    }
  }

  async save(): Promise<void> {
    if (!this.canEditContent() || !this.canSubmit()) return;
    this.saving.set(true);
    try {
      const payload: ApprovisionnementVasDemandeInput = {
        date_reference: this.dateReference,
        statut: this.demandeId() ? this.statut : 'brouillon',
        commentaire: this.commentaire?.trim() || null,
        lignes: this.lignes().map((l) => ({
          produit_id: l.produit_id!,
          devise: l.devise,
          libelle_solde: l.libelle_solde?.trim() || 'Solde à 08h',
          solde_08h: l.solde_08h,
          montant_propose: l.montant_propose,
          montant_valide: l.montant_valide,
        })),
      };
      const id = this.demandeId();
      const saved = id
        ? await firstValueFrom(this.api.update(id, payload))
        : await firstValueFrom(this.api.create(payload));
      this.toast.success('Demande enregistrée');
      await this.router.navigate(['/approvisionnement-vas', saved.id]);
      await this.loadDemande(saved.id);
    } catch {
      this.toast.error('Enregistrement impossible');
    } finally {
      this.saving.set(false);
    }
  }

  async doTransition(statut: ApprovisionnementVasStatut): Promise<void> {
    const id = this.demandeId();
    if (!id) return;
    try {
      const d = await firstValueFrom(this.api.transition(id, statut));
      this.toast.success('Statut mis à jour');
      await this.loadDemande(d.id);
    } catch {
      this.toast.error('Transition impossible');
    }
  }

  async doRejet(): Promise<void> {
    const id = this.demandeId();
    if (!id) return;
    const motif = window.prompt('Motif du rejet ?');
    if (!motif?.trim()) return;
    try {
      const d = await firstValueFrom(this.api.transition(id, 'rejetee', undefined, motif.trim()));
      this.toast.success('Demande rejetée');
      await this.loadDemande(d.id);
    } catch {
      this.toast.error('Rejet impossible');
    }
  }

  async ajouterPaiement(): Promise<void> {
    if (!this.payLigneId || this.payMontant == null || this.payMontant <= 0) {
      this.toast.error('Ligne et montant requis');
      return;
    }
    const line = this.lignes().find((l) => l.id === this.payLigneId);
    if (!line) return;
    this.paying.set(true);
    try {
      await firstValueFrom(
        this.api.createPaiement(this.payLigneId, {
          montant: this.payMontant,
          devise: line.devise,
          date_paiement: this.payDate || this.todayIso(),
          mode_paiement: this.payMode,
          reference_paiement: this.payReference?.trim() || null,
        })
      );
      this.toast.success('Paiement enregistré');
      this.payMontant = null;
      this.payReference = '';
      await this.loadDemande(this.demandeId()!);
    } catch {
      this.toast.error('Paiement refusé (plafond ou statut)');
    } finally {
      this.paying.set(false);
    }
  }

  async exportDemandesExcel(): Promise<void> {
    this.exporting.set(true);
    try {
      await exportExcel({
        filename: `approvisionnement-vas-${this.todayIso()}.xlsx`,
        title: 'Approvisionnement VAS — Demandes',
        brand: this.exportBrand(),
        sheets: [
          {
            name: 'Demandes',
            columns: [
              { key: 'id', label: 'id' },
              { key: 'date_reference', label: 'date_reference' },
              { key: 'statut', label: 'statut' },
              { key: 'nb_lignes', label: 'nb_lignes' },
              { key: 'total_propose_usd', label: 'total_propose_usd' },
              { key: 'total_propose_cdf', label: 'total_propose_cdf' },
              { key: 'en_retard', label: 'en_retard' },
              { key: 'cree_le', label: 'cree_le' },
            ],
            rows: this.demandes().map((d) => ({ ...d })),
          },
        ],
      });
      this.toast.success('Export Excel généré');
    } catch {
      this.toast.error('Export Excel impossible');
    } finally {
      this.exporting.set(false);
    }
  }

  async exportDemandesPdf(): Promise<void> {
    try {
      await this.openPdfPreview({
        title: 'Approvisionnement VAS — Demandes',
        filename: `approvisionnement-vas-${this.todayIso()}.pdf`,
        orientation: 'landscape',
        brand: this.exportBrand(),
        sections: [
          {
            title: 'Demandes',
            columns: [
              { key: 'id', label: 'ID' },
              { key: 'date_reference', label: 'Date réf.' },
              { key: 'statut', label: 'Statut' },
              { key: 'nb_lignes', label: 'Lignes' },
              { key: 'usd', label: 'USD' },
              { key: 'cdf', label: 'CDF' },
              { key: 'retard', label: 'Retard' },
            ],
            rows: this.demandes().map((d) => ({
              id: d.id,
              date_reference: d.date_reference,
              statut: this.statutLabel(d.statut),
              nb_lignes: d.nb_lignes,
              usd: this.formatAmount(d.total_propose_usd),
              cdf: this.formatAmount(d.total_propose_cdf),
              retard: d.en_retard ? 'Oui' : 'Non',
            })),
          },
        ],
      });
    } catch {
      this.toast.error('Aperçu PDF impossible');
      this.exporting.set(false);
    }
  }

  async exportPaiementsExcel(): Promise<void> {
    try {
      await exportExcel({
        filename: `paiements-demande-${this.demandeId()}.xlsx`,
        title: `Paiements demande #${this.demandeId()}`,
        brand: this.exportBrand(),
        sheets: [
          {
            name: 'Paiements',
            columns: [
              { key: 'id', label: 'id' },
              { key: 'ligne_id', label: 'ligne_id' },
              { key: 'date_paiement', label: 'date_paiement' },
              { key: 'montant', label: 'montant' },
              { key: 'devise', label: 'devise' },
              { key: 'mode_paiement', label: 'mode_paiement' },
              { key: 'reference_paiement', label: 'reference' },
            ],
            rows: this.paiements().map((p) => ({ ...p })),
          },
        ],
      });
      this.toast.success('Export paiements Excel généré');
    } catch {
      this.toast.error('Export impossible');
    }
  }

  async exportPaiementsPdf(): Promise<void> {
    try {
      await this.openPdfPreview({
        title: `Paiements demande #${this.demandeId()}`,
        filename: `paiements-demande-${this.demandeId()}.pdf`,
        brand: this.exportBrand(),
        sections: [
          {
            title: 'Paiements',
            columns: [
              { key: 'date_paiement', label: 'Date' },
              { key: 'ligne_id', label: 'Ligne' },
              { key: 'montant', label: 'Montant' },
              { key: 'devise', label: 'Devise' },
              { key: 'mode_paiement', label: 'Mode' },
              { key: 'reference_paiement', label: 'Référence' },
            ],
            rows: this.paiements().map((p) => ({
              date_paiement: p.date_paiement,
              ligne_id: p.ligne_id,
              montant: this.formatAmount(p.montant),
              devise: p.devise,
              mode_paiement: p.mode_paiement,
              reference_paiement: p.reference_paiement || '',
            })),
          },
        ],
      });
    } catch {
      this.toast.error('Aperçu PDF impossible');
      this.exporting.set(false);
    }
  }

  async loadList(): Promise<void> {
    this.loadingList.set(true);
    try {
      const [demandes, kpi, alertes, produits] = await Promise.all([
        firstValueFrom(this.api.list(100, this.filtreStatut || undefined)),
        firstValueFrom(this.api.dashboard()),
        firstValueFrom(this.api.alertesSoldes()).catch(() => [] as ApprovisionnementVasSoldeAlerte[]),
        firstValueFrom(this.api.produits()).catch(() => [] as ApprovisionnementVasProduit[]),
      ]);
      this.demandes.set(demandes);
      this.kpi.set(kpi);
      this.alertes.set(alertes);
      this.produitsList.set(produits);
      void this.refreshSoldesSeuils().catch(() => undefined);
    } catch {
      this.toast.error('Chargement des demandes impossible');
    } finally {
      this.loadingList.set(false);
    }
  }

  private async bootstrap(): Promise<void> {
    const url = this.router.url.split('?')[0];
    if (url.endsWith('/approvisionnement-vas/nouvelle')) {
      this.mode.set('form');
      this.demandeId.set(null);
      await this.initNewForm();
      return;
    }
    const idMatch = url.match(/\/approvisionnement-vas\/(\d+)$/);
    if (idMatch) {
      this.mode.set('form');
      const id = Number(idMatch[1]);
      this.demandeId.set(id);
      await this.loadDemande(id);
      return;
    }
    this.mode.set('list');
    this.demandeId.set(null);
    await this.loadList();
  }

  private async initNewForm(): Promise<void> {
    this.loadingForm.set(true);
    try {
      this.produits.set(await firstValueFrom(this.api.produits()));
      this.dateReference = this.todayIso();
      this.statut = 'brouillon';
      this.commentaire = '';
      this.historique.set([]);
      this.paiements.set([]);
      this.enRetard.set(false);
      this.lignes.set([this.emptyLine()]);
    } catch {
      this.toast.error('Chargement des produits impossible');
    } finally {
      this.loadingForm.set(false);
    }
  }

  private async loadDemande(id: number): Promise<void> {
    this.loadingForm.set(true);
    try {
      const [produits, demande, paiements] = await Promise.all([
        firstValueFrom(this.api.produits()),
        firstValueFrom(this.api.get(id)),
        firstValueFrom(this.api.paiementsDemande(id)).catch(() => [] as ApprovisionnementVasPaiement[]),
      ]);
      this.produits.set(produits);
      this.dateReference = demande.date_reference;
      this.statut = demande.statut;
      this.commentaire = demande.commentaire ?? '';
      this.historique.set(demande.historique ?? []);
      this.paiements.set(paiements);
      this.enRetard.set(!!demande.en_retard);
      this.delaiHeures.set(Number(demande.delai_heures ?? 2));
      this.lignes.set(
        demande.lignes.map((l) => ({
          key: `saved-${l.id ?? this.nextKey()}`,
          id: l.id ?? null,
          produit_id: l.produit_id,
          devise: l.devise,
          operateur: l.operateur,
          produit_libelle: l.produit_libelle,
          consommation_j1: Number(l.consommation_j1),
          consommation_j2: Number(l.consommation_j2),
          moyenne: Number(l.moyenne),
          j1_debut: l.j1_debut,
          j1_fin: l.j1_fin,
          j2_debut: l.j2_debut,
          j2_fin: l.j2_fin,
          libelle_solde: l.libelle_solde || 'Solde à 08h',
          solde_08h: l.solde_08h,
          montant_propose: l.montant_propose,
          montant_valide: l.montant_valide,
          montant_paye: l.montant_paye,
          reste_a_payer: l.reste_a_payer ?? null,
          loading: false,
          error: null,
        }))
      );
    } catch {
      this.toast.error('Chargement de la demande impossible');
      await this.router.navigate(['/approvisionnement-vas']);
    } finally {
      this.loadingForm.set(false);
    }
  }

  private emptyLine(): ApprovisionnementVasLigneForm {
    return {
      key: this.nextKey(),
      id: null,
      produit_id: null,
      devise: 'USD',
      operateur: '',
      produit_libelle: '',
      consommation_j1: null,
      consommation_j2: null,
      moyenne: null,
      libelle_solde: 'Solde à 08h',
      solde_08h: null,
      montant_propose: null,
      montant_valide: null,
      montant_paye: null,
      reste_a_payer: null,
      loading: false,
      error: null,
    };
  }

  private nextKey(): string {
    this.lineSeq += 1;
    return `line-${this.lineSeq}`;
  }

  private todayIso(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
