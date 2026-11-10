import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import {
  ApprovisionnementVasDemandeInput,
  ApprovisionnementVasDemandeListItem,
  ApprovisionnementVasLigneForm,
  ApprovisionnementVasProduit,
  ApprovisionnementVasStatut,
} from '../../core/models/approvisionnement-vas.models';
import { ApprovisionnementVasService } from '../../core/services/approvisionnement-vas.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { pilotagePartenaireLabel } from '../pilotage/pilotage-filtres.config';

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
  ],
  template: `
    @if (mode() === 'list') {
      <app-page-header title="Approvisionnement VAS" subtitle="Demandes de recharge Mobile Money">
        <div actions>
          @if (canWrite()) {
            <a class="btn btn-primary btn-sm" routerLink="/approvisionnement-vas/nouvelle">
              <i class="bi bi-plus-lg me-1"></i>Nouvelle demande
            </a>
          }
        </div>
      </app-page-header>

      @if (loadingList()) {
        <app-skeleton type="card" />
      } @else {
        <app-section-card title="Demandes">
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Date de référence</th>
                  <th>Statut</th>
                  <th class="text-end">Lignes</th>
                  <th>Créée le</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (d of demandes(); track d.id) {
                  <tr>
                    <td>{{ d.date_reference | date: 'dd/MM/yyyy' }}</td>
                    <td><span class="badge text-bg-secondary">{{ statutLabel(d.statut) }}</span></td>
                    <td class="text-end">{{ d.nb_lignes }}</td>
                    <td>{{ d.cree_le | date: 'dd/MM/yyyy HH:mm' }}</td>
                    <td class="text-end">
                      <a class="btn btn-outline-secondary btn-sm" [routerLink]="['/approvisionnement-vas', d.id]">
                        Ouvrir
                      </a>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="text-muted text-center py-4">Aucune demande pour le moment.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </app-section-card>
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

      @if (loadingForm()) {
        <app-skeleton type="card" />
      } @else {
        <form (ngSubmit)="save()">
          <app-section-card title="En-tête">
            <div class="row g-3">
              <div class="col-md-4">
                <label class="form-label" for="date-ref">Date de référence</label>
                <input
                  id="date-ref"
                  type="date"
                  class="form-control"
                  name="dateRef"
                  [(ngModel)]="dateReference"
                  (ngModelChange)="onDateChange()"
                  [disabled]="!canWrite()"
                  required
                />
                <div class="form-text">Pas de demande le samedi ni le dimanche.</div>
              </div>
              <div class="col-md-4">
                <label class="form-label" for="statut">Statut</label>
                <select
                  id="statut"
                  class="form-select"
                  name="statut"
                  [(ngModel)]="statut"
                  [disabled]="!canWrite()"
                >
                  <option value="brouillon">Brouillon</option>
                  <option value="soumise">Soumise</option>
                  <option value="validee">Validée</option>
                  <option value="payee">Payée</option>
                  <option value="annulee">Annulée</option>
                </select>
              </div>
              <div class="col-md-4">
                <label class="form-label" for="commentaire">Commentaire</label>
                <input
                  id="commentaire"
                  class="form-control"
                  name="commentaire"
                  [(ngModel)]="commentaire"
                  [disabled]="!canWrite()"
                />
              </div>
            </div>
          </app-section-card>

          <div class="mt-3">
          <app-section-card title="Lignes produits">
            <div class="table-responsive">
              <table class="table table-sm align-middle appro-table">
                <thead>
                  <tr>
                    <th>Opérateur</th>
                    <th>Devise</th>
                    <th class="text-end">Conso. J-1</th>
                    <th class="text-end">Conso. J-2</th>
                    <th class="text-end">Moyenne</th>
                    <th class="text-end">Solde à 08h</th>
                    <th class="text-end">Montant proposé</th>
                    <th class="text-end">Montant validé</th>
                    <th class="text-end">Montant payé</th>
                    @if (canWrite()) {
                      <th></th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (line of lignes(); track line.key; let i = $index) {
                    <tr>
                      <td style="min-width: 11rem">
                        <select
                          class="form-select form-select-sm"
                          [name]="'prod-' + line.key"
                          [(ngModel)]="line.produit_id"
                          (ngModelChange)="onProduitChange(line)"
                          [disabled]="!canWrite()"
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
                          class="form-select form-select-sm"
                          [name]="'dev-' + line.key"
                          [(ngModel)]="line.devise"
                          (ngModelChange)="refreshLine(line)"
                          [disabled]="!canWrite()"
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
                      <td>
                        <input
                          type="number"
                          class="form-control form-control-sm text-end"
                          [name]="'solde-' + line.key"
                          [(ngModel)]="line.solde_08h"
                          [disabled]="!canWrite()"
                          step="0.01"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          class="form-control form-control-sm text-end"
                          [name]="'propose-' + line.key"
                          [(ngModel)]="line.montant_propose"
                          [disabled]="!canWrite()"
                          step="0.01"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          class="form-control form-control-sm text-end"
                          [name]="'valide-' + line.key"
                          [(ngModel)]="line.montant_valide"
                          [disabled]="!canWrite()"
                          step="0.01"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          class="form-control form-control-sm text-end"
                          [name]="'paye-' + line.key"
                          [(ngModel)]="line.montant_paye"
                          [disabled]="!canWrite()"
                          step="0.01"
                        />
                      </td>
                      @if (canWrite()) {
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

            @if (canWrite()) {
              <button type="button" class="btn btn-outline-secondary btn-sm mt-2" (click)="addLine()">
                <i class="bi bi-plus-lg me-1"></i>Ajouter un produit
              </button>
            }
          </app-section-card>
          </div>

          @if (canWrite()) {
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
      }
    }
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
  `,
})
export class ApprovisionnementVasPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApprovisionnementVasService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly mode = signal<'list' | 'form'>('list');
  readonly demandeId = signal<number | null>(null);
  readonly loadingList = signal(true);
  readonly loadingForm = signal(false);
  readonly saving = signal(false);
  readonly demandes = signal<ApprovisionnementVasDemandeListItem[]>([]);
  readonly produits = signal<ApprovisionnementVasProduit[]>([]);
  readonly lignes = signal<ApprovisionnementVasLigneForm[]>([]);

  dateReference = this.todayIso();
  statut: ApprovisionnementVasStatut = 'brouillon';
  commentaire = '';
  private lineSeq = 0;
  private navSub?: Subscription;

  ngOnInit(): void {
    this.navSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => void this.bootstrap());
    void this.bootstrap();
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  canWrite(): boolean {
    return this.auth.can('approvisionnement.vas.ecrire');
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
      case 'validee':
        return 'Validée';
      case 'payee':
        return 'Payée';
      case 'annulee':
        return 'Annulée';
      default:
        return statut;
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
    if (!this.canWrite() || !this.canSubmit()) return;
    this.saving.set(true);
    try {
      const payload: ApprovisionnementVasDemandeInput = {
        date_reference: this.dateReference,
        statut: this.statut,
        commentaire: this.commentaire?.trim() || null,
        lignes: this.lignes().map((l) => ({
          produit_id: l.produit_id!,
          devise: l.devise,
          solde_08h: l.solde_08h,
          montant_propose: l.montant_propose,
          montant_valide: l.montant_valide,
          montant_paye: l.montant_paye,
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

  private async loadList(): Promise<void> {
    this.loadingList.set(true);
    try {
      this.demandes.set(await firstValueFrom(this.api.list()));
    } catch {
      this.toast.error('Chargement des demandes impossible');
    } finally {
      this.loadingList.set(false);
    }
  }

  private async initNewForm(): Promise<void> {
    this.loadingForm.set(true);
    try {
      this.produits.set(await firstValueFrom(this.api.produits()));
      this.dateReference = this.todayIso();
      this.statut = 'brouillon';
      this.commentaire = '';
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
      const [produits, demande] = await Promise.all([
        firstValueFrom(this.api.produits()),
        firstValueFrom(this.api.get(id)),
      ]);
      this.produits.set(produits);
      this.dateReference = demande.date_reference;
      this.statut = demande.statut;
      this.commentaire = demande.commentaire ?? '';
      this.lignes.set(
        demande.lignes.map((l) => ({
          key: `saved-${l.id ?? this.nextKey()}`,
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
          solde_08h: l.solde_08h,
          montant_propose: l.montant_propose,
          montant_valide: l.montant_valide,
          montant_paye: l.montant_paye,
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
      produit_id: null,
      devise: 'USD',
      operateur: '',
      produit_libelle: '',
      consommation_j1: null,
      consommation_j2: null,
      moyenne: null,
      solde_08h: null,
      montant_propose: null,
      montant_valide: null,
      montant_paye: null,
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
