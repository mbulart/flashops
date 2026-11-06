import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminRole, Permission } from '../../core/models/api.models';
import { AdminService } from '../../core/services/admin.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';

@Component({
  selector: 'app-parametrages-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, SectionCardComponent, SkeletonComponent],
  template: `
    <div class="row g-3">
      <div class="col-lg-5">
        <app-section-card title="Registre des rôles" [noPadding]="true">
          @if (loading()) {
            <app-skeleton type="table" [rows]="4" [cols]="2" />
          } @else {
            <div class="list-group list-group-flush">
              @for (role of roles(); track role.id) {
                <button
                  type="button"
                  class="parametrages-role-item"
                  [class.is-selected]="selectedRoleId() === role.id"
                  (click)="selectRole(role)"
                >
                  <span>
                    <span class="fw-semibold">{{ role.label }}</span>
                    <small class="d-block">{{ role.code }}</small>
                  </span>
                  <span class="badge rounded-pill text-bg-secondary">{{ role.permissions.length }}</span>
                </button>
              }
            </div>
          }
        </app-section-card>
      </div>

      <div class="col-lg-7">
        <app-section-card [title]="selectedRole() ? 'Permissions — ' + selectedRole()!.label : 'Permissions du rôle'">
          @if (!selectedRole()) {
            <p class="text-muted mb-0">Sélectionnez un rôle.</p>
          } @else if (selectedRole()!.code === 'SUPER_ADMIN') {
            <p class="text-muted mb-0">Le rôle super administrateur possède toutes les permissions.</p>
          } @else if (selectedRole()!.code === 'ADMIN') {
            <p class="text-muted mb-0">Accès opérationnel (pilotage, agences), sans gestion des paramétrages.</p>
          } @else {
            @for (group of permissionGroups(); track group.module) {
              <div class="mb-3">
                <div class="text-uppercase text-muted small fw-semibold mb-2">{{ group.module }}</div>
                <div class="row g-2">
                  @for (perm of group.items; track perm.id) {
                    <div class="col-12">
                      <label class="d-flex align-items-start gap-2 small mb-0">
                        <input
                          type="checkbox"
                          class="form-check-input mt-1"
                          [checked]="selectedPermissionIds().has(perm.id)"
                          [disabled]="!auth.can('auth.roles.ecrire')"
                          (change)="togglePermission(perm.id, $any($event.target).checked)"
                        />
                        <span class="flex-grow-1">
                          <span class="d-block">{{ perm.label }}</span>
                          <code class="text-muted">{{ perm.code }}</code>
                        </span>
                      </label>
                    </div>
                  }
                </div>
              </div>
            }
            @if (auth.can('auth.roles.ecrire')) {
              <div class="text-end mt-3 pt-2 border-top">
                <button type="button" class="btn btn-primary btn-sm" [disabled]="saving()" (click)="saveRolePermissions()">
                  @if (saving()) {
                    <span class="spinner-border spinner-border-sm me-1"></span>
                  }
                  Enregistrer les permissions
                </button>
              </div>
            }
          }
        </app-section-card>
      </div>
    </div>
  `,
})
export class ParametragesRolesPageComponent {
  readonly auth = inject(AuthService);
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly roles = signal<AdminRole[]>([]);
  readonly allPermissions = signal<Permission[]>([]);
  readonly selectedRoleId = signal<number | null>(null);
  readonly selectedPermissionIds = signal<Set<number>>(new Set());

  readonly selectedRole = computed(() => this.roles().find((r) => r.id === this.selectedRoleId()) ?? null);

  readonly permissionGroups = computed(() => {
    const map = new Map<string, Permission[]>();
    for (const p of this.allPermissions()) {
      const mod = p.module || 'general';
      if (!map.has(mod)) map.set(mod, []);
      map.get(mod)!.push(p);
    }
    return [...map.entries()].map(([module, items]) => ({ module, items }));
  });

  ngOnInit(): void {
    void this.reload();
  }

  selectRole(role: AdminRole): void {
    this.selectedRoleId.set(role.id);
    this.selectedPermissionIds.set(new Set(role.permissions.map((p) => p.id)));
  }

  togglePermission(id: number, checked: boolean): void {
    const next = new Set(this.selectedPermissionIds());
    if (checked) next.add(id);
    else next.delete(id);
    this.selectedPermissionIds.set(next);
  }

  async saveRolePermissions(): Promise<void> {
    const role = this.selectedRole();
    if (!role) return;
    this.saving.set(true);
    try {
      const res = await firstValueFrom(
        this.admin.setRolePermissions(role.id, [...this.selectedPermissionIds()])
      );
      this.roles.update((list) => list.map((r) => (r.id === role.id ? res.data : r)));
      this.toast.success('Permissions enregistrées');
    } catch {
      this.toast.error('Enregistrement impossible');
    } finally {
      this.saving.set(false);
    }
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        firstValueFrom(this.admin.listRoles()),
        firstValueFrom(this.admin.listPermissions()),
      ]);
      this.roles.set(rolesRes.data);
      this.allPermissions.set(permsRes.data);
      if (rolesRes.data.length && this.selectedRoleId() == null) {
        this.selectRole(rolesRes.data[0]);
      }
    } catch {
      this.toast.error('Chargement des rôles impossible');
    } finally {
      this.loading.set(false);
    }
  }
}
