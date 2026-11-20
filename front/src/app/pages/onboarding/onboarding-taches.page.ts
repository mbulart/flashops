import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { OnboardingTask, WorkflowAction } from '../../core/models/onboarding.models';
import { OnboardingService } from '../../core/services/onboarding.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-onboarding-taches',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PageHeaderComponent, SectionCardComponent, SkeletonComponent],
  template: `
    <app-page-header title="Mes tâches" subtitle="Dossiers nécessitant votre intervention" />
    <app-section-card [title]="'Tâches (' + tasks().length + ')'" [noPadding]="true">
      @if (loading()) { <div class="p-3"><app-skeleton type="table" [rows]="6" [cols]="5" /></div> }
      @else {
        <div class="table-responsive"><table class="table table-hover table-sm align-middle mb-0">
          <thead><tr><th>Candidature</th><th>Tâche</th><th>Étape</th><th>Échéance</th><th>Actions</th></tr></thead>
          <tbody>@for (task of tasks(); track task.id) {
            <tr>
              <td><a [routerLink]="['/onboarding/candidatures', task.candidature_id]">{{ task.reference || task.candidature_id }}</a></td>
              <td><strong>{{ task.libelle || 'Traitement du dossier' }}</strong><small class="d-block text-muted">{{ task.statut || '' }}</small></td>
              <td>{{ task.etape || '—' }}</td><td>{{ (task.echeance | date:'dd/MM/yyyy') || '—' }}</td>
              <td><div class="d-flex gap-1 flex-wrap">@for (action of task.actions_disponibles || []; track action.code) {
                <button class="btn btn-outline-dark btn-sm" (click)="openAction(task, action)">{{ action.libelle }}</button>
              }</div></td>
            </tr>
          } @empty { <tr><td colspan="5" class="text-center text-muted py-4">Aucune tâche en attente.</td></tr> }</tbody>
        </table></div>
      }
    </app-section-card>

    @if (selectedTask(); as task) {
      <div class="modal-backdrop-custom" (click)="closeAction()">
        <section class="action-modal" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="d-flex justify-content-between"><div><small class="text-muted">{{ task.reference }}</small><h2>{{ selectedAction()?.libelle }}</h2></div><button class="btn-close" (click)="closeAction()"></button></div>
          <label class="form-label mt-3">Commentaire @if(selectedAction()?.commentaire_requis){<span class="text-danger">*</span>}</label>
          <textarea class="form-control form-control-sm" rows="4" [(ngModel)]="commentaire"></textarea>
          <div class="d-flex justify-content-end gap-2 mt-4"><button class="btn btn-outline-secondary btn-sm" (click)="closeAction()">Annuler</button><button class="btn btn-primary btn-sm" [disabled]="acting() || (selectedAction()?.commentaire_requis && !commentaire.trim())" (click)="confirmAction()">{{ acting() ? 'Traitement…' : 'Confirmer' }}</button></div>
        </section>
      </div>
    }
  `,
  styles: `
    th{white-space:nowrap;font-size:.75rem;color:var(--bs-secondary-color);text-transform:uppercase}td{padding:.7rem}.modal-backdrop-custom{position:fixed;inset:0;background:rgba(0,0,0,.48);display:grid;place-items:center;z-index:1050;padding:1rem}
    .action-modal{width:min(500px,100%);background:var(--bs-body-bg);border-radius:.8rem;padding:1.4rem;box-shadow:0 20px 70px rgba(0,0,0,.3)}h2{font-size:1.15rem;margin:.2rem 0}
  `,
})
export class OnboardingTachesPageComponent implements OnInit {
  private readonly service = inject(OnboardingService);
  private readonly toast = inject(ToastService);
  readonly tasks = signal<OnboardingTask[]>([]);
  readonly loading = signal(true);
  readonly acting = signal(false);
  readonly selectedTask = signal<OnboardingTask | null>(null);
  readonly selectedAction = signal<WorkflowAction | null>(null);
  commentaire = '';

  ngOnInit(): void { void this.load(); }
  async load(): Promise<void> {
    this.loading.set(true);
    try { this.tasks.set((await firstValueFrom(this.service.listTasks())) || []); }
    catch { this.toast.error('Impossible de charger les tâches.'); }
    finally { this.loading.set(false); }
  }
  openAction(task: OnboardingTask, action: WorkflowAction): void {
    this.selectedTask.set(task); this.selectedAction.set(action); this.commentaire = '';
  }
  closeAction(): void { this.selectedTask.set(null); this.selectedAction.set(null); }
  async confirmAction(): Promise<void> {
    const task = this.selectedTask(); const action = this.selectedAction();
    if (!task || !action) return;
    this.acting.set(true);
    try {
      await firstValueFrom(this.service.actOnTask(task.id, { action: action.code, commentaire: this.commentaire.trim() || undefined }));
      this.toast.success('Action enregistrée.'); this.closeAction(); await this.load();
    } catch { this.toast.error('L’action n’a pas pu être enregistrée.'); }
    finally { this.acting.set(false); }
  }
}
