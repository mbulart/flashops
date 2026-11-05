import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AgenceAdmin } from '../../core/models/agences.models';
import { AdminUserInput, AdminRole, ResponsableZoneRef, User } from '../../core/models/api.models';
import { AdminService } from '../../core/services/admin.service';
import { AgencesService } from '../../core/services/agences.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ZoneReferentielService } from '../../core/services/zone-referentiel.service';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TableActionsMenuComponent } from './components/table-actions-menu.component';
import { UserFormModalComponent } from './components/user-form-modal.component';

@Component({
  selector: 'app-parametrages-users',
  standalone: true,
  imports: [
    CommonModule,
    SectionCardComponent,
    SkeletonComponent,
    TableActionsMenuComponent,
    UserFormModalComponent,
  ],
  template: `
    <app-section-card title="Registre des utilisateurs" [noPadding]="true">
      @if (auth.can('auth.utilisateurs.ecrire')) {
        <button actions type="button" class="btn btn-primary btn-sm" (click)="openCreate()">
          <i class="bi bi-plus-lg me-1"></i>Nouvel utilisateur
        </button>
      }
      @if (loading()) {
        <app-skeleton type="table" [rows]="5" [cols]="4" />
      } @else {
            <div class="parametrages-table-scroll">
              <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Rôle</th>
                <th>Périmètre</th>
                <th>Statut</th>
                <th>Dernière connexion</th>
                @if (auth.can('auth.utilisateurs.ecrire')) {
                  <th class="text-end" style="width: 3.5rem"></th>
                }
              </tr>
            </thead>
            <tbody>
              @for (user of users(); track user.id) {
                <tr>
                  <td>
                    <span class="d-block fw-semibold">{{ user.full_name }}</span>
                    <small class="text-muted">{{ user.email }}</small>
                  </td>
                  <td><span class="badge text-bg-light border">{{ user.role.label }}</span></td>
                  <td class="small text-muted">{{ scopeLabel(user) }}</td>
                  <td>
                    <span class="badge" [class.text-bg-success-subtle]="user.is_active" [class.text-bg-secondary-subtle]="!user.is_active">
                      {{ user.is_active ? 'Actif' : 'Inactif' }}
                    </span>
                  </td>
                  <td class="text-muted small">
                    {{ user.last_login_at ? (user.last_login_at | date: 'dd/MM/yyyy HH:mm') : 'Jamais' }}
                  </td>
                  @if (auth.can('auth.utilisateurs.ecrire')) {
                    <td class="text-end">
                      <app-table-actions-menu #rowMenu>
                        <button type="button" class="table-actions-menu__item" (click)="openEdit(user); rowMenu.close()">
                          <i class="bi bi-pencil"></i>
                          Modifier
                        </button>
                      </app-table-actions-menu>
                    </td>
                  }
                </tr>
              } @empty {
                <tr><td [attr.colspan]="auth.can('auth.utilisateurs.ecrire') ? 6 : 5" class="text-center text-muted py-4">Aucun utilisateur</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </app-section-card>

    <app-user-form-modal
      [open]="editorOpen()"
      [form]="form"
      [roles]="roles()"
      [agences]="agences()"
      [responsables]="responsables()"
      [editingId]="editingId()"
      [saving]="saving()"
      (cancel)="closeEditor()"
      (save)="save($event)"
    />
  `,
})
export class ParametragesUsersPageComponent {
  readonly auth = inject(AuthService);
  private readonly admin = inject(AdminService);
  private readonly agencesApi = inject(AgencesService);
  private readonly zonesApi = inject(ZoneReferentielService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly users = signal<User[]>([]);
  readonly roles = signal<AdminRole[]>([]);
  readonly agences = signal<AgenceAdmin[]>([]);
  readonly responsables = signal<ResponsableZoneRef[]>([]);
  readonly editorOpen = signal(false);
  readonly editingId = signal<number | null>(null);

  form: AdminUserInput = this.emptyForm();

  ngOnInit(): void {
    void this.reload();
  }

  openCreate(): void {
    this.form = this.emptyForm();
    this.editingId.set(null);
    this.editorOpen.set(true);
  }

  openEdit(user: User): void {
    this.form = {
      email: user.email,
      full_name: user.full_name,
      role_id: user.role.id,
      is_active: user.is_active ?? true,
      agence_id: user.agence_id ?? null,
      responsable_zone_id: user.responsable_zone_id ?? null,
    };
    this.editingId.set(user.id);
    this.editorOpen.set(true);
  }

  closeEditor(): void {
    this.editorOpen.set(false);
    this.editingId.set(null);
  }

  scopeLabel(user: User): string {
    const code = user.role?.code;
    if (code === 'AGENT' && user.agence_id) {
      const ag = this.agences().find((a) => a.agenceId === user.agence_id);
      return ag ? `Agence ${ag.code_agence}` : `Agence #${user.agence_id}`;
    }
    if (code === 'RZ' && user.responsable_zone_id) {
      const rz = this.responsables().find((r) => r.id === user.responsable_zone_id);
      return rz ? `Zone ${rz.nom}` : `RZ #${user.responsable_zone_id}`;
    }
    return '—';
  }

  async save(password: string): Promise<void> {
    this.saving.set(true);
    try {
      const payload: AdminUserInput = { ...this.form };
      if (password.trim()) {
        payload.password = password.trim();
      }
      const id = this.editingId();
      if (id) {
        await firstValueFrom(this.admin.updateUser(id, payload));
        this.toast.success('Utilisateur mis à jour');
      } else {
        await firstValueFrom(this.admin.createUser(payload));
        this.toast.success('Utilisateur créé');
      }
      this.closeEditor();
      await this.reload();
    } catch {
      this.toast.error('Enregistrement impossible');
    } finally {
      this.saving.set(false);
    }
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        firstValueFrom(this.admin.listUsers()),
        firstValueFrom(this.admin.listRoles()),
      ]);
      this.users.set(usersRes?.data ?? []);
      this.roles.set(rolesRes?.data ?? []);

      const extras: Promise<void>[] = [];
      if (this.auth.can('agences.lire')) {
        extras.push(
          firstValueFrom(this.agencesApi.list({ page: 1, size: 500 }))
            .then((page) => this.agences.set(page?.items ?? []))
            .catch(() => this.agences.set([]))
        );
      }
      if (this.auth.can('referentiels.zones.lire')) {
        extras.push(
          firstValueFrom(this.zonesApi.listResponsables())
            .then((list) => this.responsables.set(list ?? []))
            .catch(() => this.responsables.set([]))
        );
      }
      await Promise.all(extras);
    } catch {
      this.toast.error('Chargement des utilisateurs impossible');
    } finally {
      this.loading.set(false);
    }
  }

  private emptyForm(): AdminUserInput {
    const firstRole = this.roles()[0]?.id ?? 1;
    return {
      email: '',
      full_name: '',
      role_id: firstRole,
      is_active: true,
      agence_id: null,
      responsable_zone_id: null,
    };
  }
}
