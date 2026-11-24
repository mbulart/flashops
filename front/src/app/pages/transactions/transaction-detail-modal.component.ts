import { Component, EventEmitter, Input, Output, inject, signal, OnChanges } from '@angular/core';
import { PilotageTransactionDetail } from '../../core/models/pilotage.models';
import { PilotageService } from '../../core/services/pilotage.service';
import { ToastService } from '../../core/services/toast.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { formatValeurFr } from '../../shared/utils/format.utils';

@Component({
  selector: 'app-transaction-detail-modal',
  standalone: true,
  imports: [StatusBadgeComponent, SkeletonComponent],
  template: `
    <div class="tx-modal" (click)="closed.emit()">
      <section class="tx-sheet" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <header class="tx-sheet__head">
          <div>
            <h2>Transaction {{ detail()?.operationId || operationId }}</h2>
            <p class="tx-sheet__meta">
              @if (detail(); as d) {
                {{ formatJour(d.jour) }}
                @if (d.heure) {
                  <span>· {{ d.heure }}</span>
                }
                @if (d.statut) {
                  <app-status-badge class="ms-2" [label]="d.statut" />
                }
              }
            </p>
          </div>
          <button type="button" class="btn-close" aria-label="Fermer" (click)="closed.emit()"></button>
        </header>

        <div class="tx-sheet__body">
          @if (loading()) {
            <app-skeleton type="table" [rows]="6" [cols]="2" />
          } @else if (detail(); as d) {
            <section class="tx-block">
              <h3>Identité</h3>
              <dl class="tx-grid">
                @for (row of identityRows(d); track row.label) {
                  <div class="tx-kv">
                    <dt>{{ row.label }}</dt>
                    <dd [class.font-monospace]="row.mono">{{ row.value }}</dd>
                  </div>
                }
              </dl>
            </section>
            <section class="tx-block">
              <h3>Agence &amp; produit</h3>
              <dl class="tx-grid">
                @for (row of agencyRows(d); track row.label) {
                  <div class="tx-kv">
                    <dt>{{ row.label }}</dt>
                    <dd [class.font-monospace]="row.mono">{{ row.value }}</dd>
                  </div>
                }
              </dl>
            </section>
            <section class="tx-block">
              <h3>Parties</h3>
              <dl class="tx-grid">
                @for (row of partyRows(d); track row.label) {
                  <div class="tx-kv">
                    <dt>{{ row.label }}</dt>
                    <dd>{{ row.value }}</dd>
                  </div>
                }
              </dl>
            </section>
            <section class="tx-block">
              <h3>Montants</h3>
              <dl class="tx-grid">
                @for (row of moneyRows(d); track row.label) {
                  <div class="tx-kv">
                    <dt>{{ row.label }}</dt>
                    <dd class="font-monospace">{{ row.value }}</dd>
                  </div>
                }
              </dl>
            </section>
            @if (d.commentaire) {
              <section class="tx-block">
                <h3>Commentaire</h3>
                <p class="tx-comment">{{ d.commentaire }}</p>
              </section>
            }
          } @else {
            <p class="text-muted mb-0">Détail indisponible.</p>
          }
        </div>
      </section>
    </div>
  `,
  styles: `
    .tx-modal {
      position: fixed;
      inset: 0;
      z-index: 1080;
      background: rgba(15, 23, 42, 0.45);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 1.25rem;
      overflow: auto;
    }
    .tx-sheet {
      width: min(920px, 100%);
      max-height: calc(100vh - 2.5rem);
      overflow: auto;
      background: var(--card-bg, #fff);
      border-radius: 12px;
      border: 1px solid var(--card-border, #e5e7eb);
      box-shadow: 0 18px 50px rgba(15, 23, 42, 0.22);
    }
    .tx-sheet__head {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      align-items: flex-start;
      padding: 1rem 1.15rem;
      border-bottom: 1px solid var(--card-border, #e5e7eb);
      position: sticky;
      top: 0;
      background: var(--card-bg, #fff);
      z-index: 1;
    }
    .tx-sheet__head h2 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
    }
    .tx-sheet__meta {
      margin: 0.35rem 0 0;
      color: var(--text-muted, #6b7280);
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.25rem;
    }
    .tx-sheet__body {
      padding: 1rem 1.15rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .tx-block h3 {
      margin: 0 0 0.55rem;
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted, #6b7280);
      font-weight: 700;
    }
    .tx-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.55rem 1rem;
      margin: 0;
    }
    @media (max-width: 700px) {
      .tx-modal {
        padding: 0.5rem;
        padding-top: max(0.5rem, env(safe-area-inset-top, 0px));
        padding-bottom: max(0.5rem, env(safe-area-inset-bottom, 0px));
        align-items: stretch;
      }
      .tx-sheet {
        max-height: calc(100dvh - 1rem);
        border-radius: 0.75rem;
      }
      .tx-sheet__head,
      .tx-sheet__body {
        padding-left: 0.9rem;
        padding-right: 0.9rem;
      }
      .tx-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .tx-kv {
      min-width: 0;
    }
    .tx-kv dt {
      margin: 0;
      font-size: 0.72rem;
      color: var(--text-muted, #6b7280);
      font-weight: 600;
    }
    .tx-kv dd {
      margin: 0.1rem 0 0;
      font-size: 0.9rem;
      word-break: break-word;
    }
    .tx-comment {
      margin: 0;
      white-space: pre-wrap;
      font-size: 0.9rem;
    }
  `,
})
export class TransactionDetailModalComponent implements OnChanges {
  private readonly pilotage = inject(PilotageService);
  private readonly toast = inject(ToastService);

  @Input({ required: true }) operationId!: number;
  @Output() closed = new EventEmitter<void>();

  readonly loading = signal(false);
  readonly detail = signal<PilotageTransactionDetail | null>(null);

  ngOnChanges(): void {
    if (!this.operationId) return;
    this.loading.set(true);
    this.detail.set(null);
    this.pilotage.loadTransactionDetail(this.operationId).subscribe({
      next: (d) => {
        this.detail.set(d);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Détail transaction indisponible.');
      },
    });
  }

  formatJour(iso: string): string {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || '—';
  }

  private text(v: string | null | undefined): string {
    const s = (v || '').trim();
    return s || '—';
  }

  private money(v: number | null | undefined, devise: string): string {
    if (v == null || !Number.isFinite(Number(v))) return '—';
    return formatValeurFr(Number(v), devise || 'USD');
  }

  identityRows(d: PilotageTransactionDetail) {
    return [
      { label: 'Opération', value: String(d.operationId), mono: true },
      { label: 'Date opération', value: this.text(d.date_operation), mono: false },
      { label: 'Référence', value: this.text(d.reference), mono: true },
      { label: 'Source', value: this.text(d.source_id), mono: true },
      { label: 'ID externe', value: this.text(d.id_externe), mono: true },
      { label: 'Clé métier', value: this.text(d.cle_metier), mono: true },
      { label: 'Type opération', value: this.text(d.type_operation), mono: false },
      { label: 'Statut', value: this.text(d.statut), mono: false },
    ];
  }

  agencyRows(d: PilotageTransactionDetail) {
    return [
      { label: 'Agence', value: this.text(d.agence_nom || d.code_agence), mono: false },
      { label: 'Code agence', value: this.text(d.code_agence), mono: true },
      { label: 'POS / FP', value: this.text(d.pos_id || d.fp_agent), mono: true },
      { label: 'Produit', value: this.text(d.produit), mono: false },
      { label: 'Module', value: this.text(d.module), mono: false },
      { label: 'Écran', value: this.text(d.ecran), mono: false },
      { label: 'Partenaire', value: this.text(d.partenaire), mono: false },
      { label: 'Opérateur', value: this.text(d.operateur), mono: false },
      { label: 'Pays origine', value: this.text(d.pays_origine), mono: false },
      { label: 'Pays destination', value: this.text(d.pays_destination), mono: false },
      { label: 'Ville origine', value: this.text(d.ville_origine), mono: false },
    ];
  }

  partyRows(d: PilotageTransactionDetail) {
    return [
      { label: 'Expéditeur', value: this.text(d.expediteur) },
      { label: 'Bénéficiaire', value: this.text(d.beneficiaire) },
      { label: 'Téléphone', value: this.text(d.telephone) },
      { label: 'Tél. expéditeur', value: this.text(d.telephone_expediteur) },
      { label: 'N° abonnement', value: this.text(d.numero_abonnement) },
      { label: 'N° pièce', value: this.text(d.numero_id) },
    ];
  }

  moneyRows(d: PilotageTransactionDetail) {
    const cur = d.devise || 'USD';
    return [
      { label: `Montant (${cur})`, value: this.money(d.montant, cur) },
      { label: 'Montant total', value: this.money(d.montant_total, cur) },
      { label: 'Montant caisse', value: this.money(d.montant_caisse, cur) },
      { label: 'Montant payé', value: this.money(d.montant_paye, cur) },
      { label: 'Frais', value: this.money(d.frais, cur) },
      { label: 'Taxes', value: this.money(d.taxes, cur) },
      { label: 'Marge', value: this.money(d.marge, cur) },
      { label: 'Commission', value: this.money(d.commission, cur) },
      { label: 'Commission FCN', value: this.money(d.commission_fcn, cur) },
      { label: 'Commission agent', value: this.money(d.commission_agent, cur) },
      { label: 'Commission FCN agent', value: this.money(d.commission_fcn_agent, cur) },
      {
        label: 'Réception',
        value: d.montant_reception == null
          ? '—'
          : `${this.money(d.montant_reception, d.devise_reception || cur)}${d.devise_reception ? '' : ''}`,
      },
      { label: 'Taux', value: d.taux == null ? '—' : String(d.taux) },
      {
        label: 'Taux de change',
        value: d.taux_change == null ? '—' : d.taux_change ? 'Oui' : 'Non',
      },
    ];
  }
}
