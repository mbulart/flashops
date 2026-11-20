import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Candidature } from '../../core/models/onboarding.models';
import { OnboardingService } from '../../core/services/onboarding.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-onboarding-candidatures',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PageHeaderComponent, SectionCardComponent, SkeletonComponent],
  template: `
    <app-page-header title="Candidatures" subtitle="Dossiers de candidature au réseau de distribution" />
    <app-section-card title="Filtres">
      <form class="filters" (ngSubmit)="load()">
        <label>Recherche<input class="form-control form-control-sm" name="q" [(ngModel)]="q" placeholder="Référence, entreprise, contact…" /></label>
        <label>Statut<select class="form-select form-select-sm" name="statut" [(ngModel)]="statut">
          <option value="">Tous</option><option value="BROUILLON">Brouillon</option><option value="SOUMISE">Soumise</option>
          <option value="EN_COURS">En cours</option><option value="ACCEPTEE">Acceptée</option><option value="REJETEE">Rejetée</option>
        </select></label>
        <button class="btn btn-primary btn-sm">Appliquer</button>
      </form>
    </app-section-card>
    <app-section-card [title]="'Candidatures (' + total() + ')'" [noPadding]="true">
      @if (loading()) { <div class="p-3"><app-skeleton type="table" [rows]="7" [cols]="6" /></div> }
      @else {
        <div class="table-responsive"><table class="table table-hover table-sm align-middle mb-0">
          <thead><tr><th>Référence</th><th>Entreprise</th><th>Contact</th><th>Statut</th><th>Étape</th><th>Date</th><th></th></tr></thead>
          <tbody>
            @for (item of rows(); track item.id) {
              <tr>
                <td class="font-monospace">{{ item.reference || '—' }}</td>
                <td><strong>{{ item.entreprise?.raison_sociale || '—' }}</strong><small class="d-block text-muted">{{ item.entreprise?.ville || '' }}</small></td>
                <td>{{ item.representant?.prenom }} {{ item.representant?.nom }}<small class="d-block text-muted">{{ item.email || item.representant?.email }}</small></td>
                <td><span class="badge text-bg-light border">{{ item.statut || '—' }}</span></td>
                <td>{{ item.etape || '—' }}</td><td class="text-nowrap">{{ item.soumis_le || item.cree_le | date:'dd/MM/yyyy' }}</td>
                <td class="text-end"><a class="btn btn-outline-dark btn-sm" [routerLink]="['/onboarding/candidatures', item.id]">Ouvrir</a></td>
              </tr>
            } @empty { <tr><td colspan="7" class="text-center text-muted py-4">Aucune candidature.</td></tr> }
          </tbody>
        </table></div>
      }
    </app-section-card>
  `,
  styles: `
    .filters{display:grid;grid-template-columns:minmax(220px,2fr) minmax(160px,1fr) auto;gap:1rem;align-items:end}
    label{font-size:.78rem;font-weight:600;color:var(--bs-secondary-color)}label input,label select{margin-top:.3rem}
    th{white-space:nowrap;font-size:.75rem;color:var(--bs-secondary-color);text-transform:uppercase;letter-spacing:.03em}
    td{padding:.7rem .75rem}@media(max-width:650px){.filters{grid-template-columns:1fr}}
  `,
})
export class OnboardingCandidaturesPageComponent implements OnInit {
  private readonly service = inject(OnboardingService);
  private readonly toast = inject(ToastService);
  readonly rows = signal<Candidature[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  q = '';
  statut = '';

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await firstValueFrom(this.service.listCandidatures({ q: this.q, statut: this.statut, page: 1, size: 100 }));
      this.rows.set(result.items || []);
      this.total.set(result.total ?? result.items?.length ?? 0);
    } catch {
      this.toast.error('Impossible de charger les candidatures.');
    } finally {
      this.loading.set(false);
    }
  }
}
