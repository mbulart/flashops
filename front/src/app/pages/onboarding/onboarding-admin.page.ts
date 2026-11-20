import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Candidature, OnboardingOption, OnboardingReferentiels, WorkflowDefinition } from '../../core/models/onboarding.models';
import { AuthService } from '../../core/services/auth.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';

type AdminTab = 'referentiels' | 'workflows' | 'indicateurs';

@Component({
  selector: 'app-onboarding-admin',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, SectionCardComponent, SkeletonComponent],
  template: `
    <app-page-header title="Administration onboarding" subtitle="Référentiels, workflows et indicateurs" />
    <nav class="nav nav-tabs mb-3">
      <button class="nav-link" [class.active]="tab() === 'referentiels'" (click)="tab.set('referentiels')">Référentiels</button>
      <button class="nav-link" [class.active]="tab() === 'workflows'" (click)="tab.set('workflows')">Workflows</button>
      <button class="nav-link" [class.active]="tab() === 'indicateurs'" (click)="tab.set('indicateurs')">Indicateurs</button>
    </nav>
    @if (loading()) { <app-section-card><app-skeleton type="table" [rows]="6" [cols]="4" /></app-section-card> }
    @else {
      @switch (tab()) {
        @case ('referentiels') {
          @for (group of referenceGroups(); track group.key) {
            <app-section-card [title]="label(group.key)" [subtitle]="group.items.length + ' élément(s)'" [noPadding]="true">
              <div class="table-responsive"><table class="table table-sm mb-0"><thead><tr><th>Code</th><th>Libellé</th><th>Famille</th><th>État</th></tr></thead>
                <tbody>@for (item of group.items; track item.id || item.code) {
                  <tr><td class="font-monospace">{{ item.code }}</td><td>{{ item.libelle }}</td><td>{{ item.famille || '—' }}</td><td>{{ item.actif === false ? 'Inactif' : 'Actif' }}</td></tr>
                }</tbody></table></div>
            </app-section-card>
          } @empty { <app-section-card><p class="text-muted mb-0">Aucun référentiel disponible.</p></app-section-card> }
        }
        @case ('workflows') {
          <app-section-card title="Définitions et versions" [noPadding]="true">
            <div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Workflow</th><th>Version</th><th>Statut</th><th>Nœuds</th><th>Mise à jour</th></tr></thead>
              <tbody>@for (workflow of workflows(); track workflow.id) {
                <tr><td><strong>{{ workflow.libelle }}</strong><small class="d-block text-muted font-monospace">{{ workflow.code }}</small></td><td>v{{ workflow.version || 1 }}</td><td><span class="badge text-bg-light border">{{ workflow.statut || '—' }}</span></td><td>{{ (workflow.nodes || []).length }}<small class="d-block text-muted">{{ nodeLabels(workflow) }}</small></td><td>{{ (workflow.updated_at | date:'dd/MM/yyyy') || '—' }}</td></tr>
              } @empty { <tr><td colspan="5" class="text-center text-muted py-4">Aucun workflow disponible.</td></tr> }</tbody>
            </table></div>
          </app-section-card>
        }
        @case ('indicateurs') {
          <div class="kpis">
            <article><span>Total</span><strong>{{ candidatures().length }}</strong></article>
            <article><span>Soumises</span><strong>{{ countStatus('SOUMISE') }}</strong></article>
            <article><span>En cours</span><strong>{{ countStatus('EN_COURS') }}</strong></article>
            <article><span>Acceptées</span><strong>{{ countStatus('ACCEPTEE') }}</strong></article>
            <article><span>Rejetées</span><strong>{{ countStatus('REJETEE') }}</strong></article>
          </div>
          <app-section-card title="Répartition par statut" subtitle="Comptage simple sur les candidatures chargées">
            @for (entry of statusCounts(); track entry.status) {
              <div class="status-row"><span>{{ entry.status }}</span><strong>{{ entry.count }}</strong></div>
            } @empty { <p class="text-muted mb-0">Aucune donnée.</p> }
          </app-section-card>
        }
      }
    }
  `,
  styles: `
    .nav-link{color:var(--bs-secondary-color)}.nav-link.active{font-weight:600;color:var(--bs-body-color)}th{font-size:.75rem;text-transform:uppercase;color:var(--bs-secondary-color)}td{padding:.65rem .75rem}
    .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:.75rem;margin-bottom:1rem}.kpis article{display:grid;background:var(--bs-body-bg);border:1px solid var(--bs-border-color);border-radius:.65rem;padding:1rem}.kpis span{font-size:.75rem;color:var(--bs-secondary-color)}.kpis strong{font-size:1.75rem}.status-row{display:flex;justify-content:space-between;border-bottom:1px solid var(--bs-border-color);padding:.65rem 0}
    @media(max-width:850px){.kpis{grid-template-columns:repeat(2,1fr)}}
  `,
})
export class OnboardingAdminPageComponent implements OnInit {
  private readonly service = inject(OnboardingService);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  readonly tab = signal<AdminTab>('referentiels');
  readonly loading = signal(true);
  readonly references = signal<OnboardingReferentiels>({});
  readonly workflows = signal<WorkflowDefinition[]>([]);
  readonly candidatures = signal<Candidature[]>([]);
  readonly referenceGroups = computed(() =>
    Object.entries(this.references())
      .filter((entry): entry is [string, OnboardingOption[]] => Array.isArray(entry[1]))
      .map(([key, items]) => ({ key, items }))
  );
  readonly statusCounts = computed(() => {
    const counts = new Map<string, number>();
    this.candidatures().forEach((item) => counts.set(item.statut || 'NON RENSEIGNÉ', (counts.get(item.statut || 'NON RENSEIGNÉ') || 0) + 1));
    return [...counts.entries()].map(([status, count]) => ({ status, count }));
  });

  async ngOnInit(): Promise<void> {
    try {
      const [references, workflows, candidatures] = await Promise.all([
        firstValueFrom(this.service.referentiels()),
        firstValueFrom(this.service.listWorkflows()).catch(() => []),
        firstValueFrom(this.service.listCandidatures({ page: 1, size: 1000 })).catch(() => ({ items: [], total: 0 })),
      ]);
      this.references.set(references || {});
      this.workflows.set(workflows || []);
      this.candidatures.set(candidatures.items || []);
    } catch {
      this.toast.error('Impossible de charger l’administration onboarding.');
    } finally {
      this.loading.set(false);
    }
  }

  label(key: string): string { return key.replaceAll('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase()); }
  nodeLabels(workflow: WorkflowDefinition): string { return (workflow.nodes || []).map((node) => node.libelle).join(' · ') || '—'; }
  countStatus(status: string): number { return this.candidatures().filter((item) => item.statut === status).length; }
}
