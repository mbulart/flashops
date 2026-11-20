import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Candidature } from '../../core/models/onboarding.models';
import { OnboardingService } from '../../core/services/onboarding.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';

type DetailTab = 'apercu' | 'entreprise' | 'points' | 'documents' | 'workflow';

@Component({
  selector: 'app-onboarding-candidature-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, PageHeaderComponent, SectionCardComponent, SkeletonComponent],
  template: `
    <app-page-header [title]="item()?.reference || 'Candidature'" subtitle="Détail du dossier">
      <a actions routerLink="/onboarding/candidatures" class="btn btn-outline-secondary btn-sm"><i class="bi bi-arrow-left me-1"></i>Retour</a>
    </app-page-header>
    @if (loading()) { <app-section-card><app-skeleton type="text" [rows]="8" /></app-section-card> }
    @else if (item(); as c) {
      <div class="summary">
        <div><span>Statut</span><strong>{{ c.statut || '—' }}</strong></div>
        <div><span>Étape</span><strong>{{ c.etape || '—' }}</strong></div>
        <div><span>Entreprise</span><strong>{{ c.entreprise?.raison_sociale || '—' }}</strong></div>
        <div><span>Soumise le</span><strong>{{ (c.soumis_le | date:'dd/MM/yyyy HH:mm') || '—' }}</strong></div>
      </div>
      @if ((c.actions_disponibles || []).length) {
        <app-section-card title="Actions disponibles">
          <div class="d-flex flex-wrap gap-2">
            @for (action of c.actions_disponibles || []; track action.code) {
              <button class="btn btn-primary btn-sm" [title]="action.commentaire_requis ? 'Un commentaire sera requis dans la tâche' : ''">{{ action.libelle }}</button>
            }
          </div>
        </app-section-card>
      }
      <nav class="nav nav-tabs mb-3">
        @for (tab of tabs; track tab.key) {
          <button class="nav-link" [class.active]="activeTab() === tab.key" (click)="activeTab.set(tab.key)">{{ tab.label }}</button>
        }
      </nav>
      <app-section-card>
        @switch (activeTab()) {
          @case ('apercu') {
            <div class="details">
              <div><span>Représentant</span><strong>{{ c.representant?.prenom }} {{ c.representant?.nom }}</strong></div>
              <div><span>Téléphone</span><strong>{{ c.telephone || c.representant?.telephone || '—' }}</strong></div>
              <div><span>E-mail</span><strong>{{ c.email || c.representant?.email || '—' }}</strong></div>
              <div><span>Services</span><strong>{{ (c.services || []).join(', ') || '—' }}</strong></div>
            </div>
          }
          @case ('entreprise') {
            <div class="details">
              <div><span>Raison sociale</span><strong>{{ c.entreprise?.raison_sociale || '—' }}</strong></div>
              <div><span>Nom commercial</span><strong>{{ c.entreprise?.nom_commercial || '—' }}</strong></div>
              <div><span>Forme juridique</span><strong>{{ c.entreprise?.forme_juridique || '—' }}</strong></div>
              <div><span>RCCM</span><strong>{{ c.entreprise?.rccm || '—' }}</strong></div>
              <div><span>ID national / NIF</span><strong>{{ c.entreprise?.id_nat || '—' }} / {{ c.entreprise?.nif || '—' }}</strong></div>
              <div><span>Adresse</span><strong>{{ c.entreprise?.adresse || '—' }}, {{ c.entreprise?.ville || '' }}</strong></div>
            </div>
          }
          @case ('points') {
            <div class="table-responsive"><table class="table table-sm">
              <thead><tr><th>Point de vente</th><th>Adresse</th><th>Localité</th><th></th></tr></thead>
              <tbody>@for (point of c.points_vente || []; track point.id || $index) {
                <tr><td>{{ point.nom }}</td><td>{{ point.adresse }}</td><td>{{ point.ville }} · {{ point.province }}</td><td>@if(point.principal){<span class="badge text-bg-warning">Principal</span>}</td></tr>
              }</tbody>
            </table></div>
          }
          @case ('documents') {
            <div class="list">@for (doc of c.documents || []; track doc.id || doc.type_code) {
              <div><span>{{ doc.type_libelle || doc.type_code }}</span><strong>{{ doc.statut || 'À fournir' }}</strong></div>
            } @empty { <p class="text-muted mb-0">Aucun document.</p> }</div>
          }
          @case ('workflow') {
            <div class="timeline">@for (event of c.workflow_historique || []; track event.id || $index) {
              <article><span></span><div><strong>{{ event.action || event.etape || 'Événement' }}</strong><small>{{ event.acteur || '' }} · {{ event.date | date:'dd/MM/yyyy HH:mm' }}</small><p>{{ event.commentaire }}</p></div></article>
            } @empty { <p class="text-muted mb-0">Aucun historique.</p> }</div>
          }
        }
      </app-section-card>
    }
  `,
  styles: `
    .summary,.details{display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem;margin-bottom:1rem}.summary div,.details div{display:grid;border:1px solid var(--bs-border-color);border-radius:.55rem;padding:.8rem;background:var(--bs-body-bg)}
    .summary span,.details span{font-size:.72rem;color:var(--bs-secondary-color)}.nav-link{color:var(--bs-secondary-color)}.nav-link.active{color:var(--bs-body-color);font-weight:600}
    .list div{display:flex;justify-content:space-between;padding:.7rem 0;border-bottom:1px solid var(--bs-border-color)}
    .timeline article{display:flex;gap:.8rem}.timeline article>span{width:.65rem;height:.65rem;background:var(--bs-primary);border-radius:50%;margin-top:.3rem;flex:0 0 auto}.timeline article div{border-left:1px solid var(--bs-border-color);padding:0 0 1.2rem 1rem;display:grid}.timeline small{color:var(--bs-secondary-color)}.timeline p{margin:.2rem 0 0}
    @media(max-width:850px){.summary,.details{grid-template-columns:1fr 1fr}}@media(max-width:500px){.summary,.details{grid-template-columns:1fr}}
  `,
})
export class OnboardingCandidatureDetailPageComponent implements OnInit {
  private readonly service = inject(OnboardingService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  readonly loading = signal(true);
  readonly item = signal<Candidature | null>(null);
  readonly activeTab = signal<DetailTab>('apercu');
  readonly tabs: { key: DetailTab; label: string }[] = [
    { key: 'apercu', label: 'Aperçu' }, { key: 'entreprise', label: 'Entreprise' },
    { key: 'points', label: 'Points de vente' }, { key: 'documents', label: 'Documents' },
    { key: 'workflow', label: 'Historique' },
  ];

  async ngOnInit(): Promise<void> {
    try {
      this.item.set(await firstValueFrom(this.service.getCandidature(this.route.snapshot.paramMap.get('id')!)));
    } catch {
      this.toast.error('Impossible de charger la candidature.');
    } finally {
      this.loading.set(false);
    }
  }
}
