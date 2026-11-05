import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  RegionRef,
  RegionRefInput,
  ResponsableZoneInput,
  ResponsableZoneRef,
  ZoneRef,
  ZoneRefInput,
} from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { ZoneReferentielService } from '../../core/services/zone-referentiel.service';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SectionCardComponent } from '../../shared/components/section-card/section-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { ResponsableZoneFormModalComponent } from './components/responsable-zone-form-modal.component';
import { TableActionsMenuComponent } from './components/table-actions-menu.component';
import { RegionFormModalComponent } from './components/region-form-modal.component';
import { ZoneFormModalComponent } from './components/zone-form-modal.component';

@Component({
  selector: 'app-parametrages-referentiels-zones',
  standalone: true,
  imports: [
    CommonModule,
    SectionCardComponent,
    SkeletonComponent,
    EmptyStateComponent,
    TableActionsMenuComponent,
    ResponsableZoneFormModalComponent,
    ZoneFormModalComponent,
    RegionFormModalComponent,
  ],
  template: `
    <app-section-card [title]="cardTitle()" [noPadding]="true">
      @if (canWrite()) {
        <button actions type="button" class="btn btn-primary btn-sm" (click)="openCreate()">
          <i class="bi bi-plus-lg me-1"></i>{{ createLabel() }}
        </button>
      }
      @if (loading()) {
        <app-skeleton type="table" [rows]="6" [cols]="5" />
      } @else if (mode === 'regions') {
        @if (!regions().length) {
          <app-empty-state title="Aucune région" />
        } @else {
          <div class="parametrages-table-scroll">
            <table class="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Libellé</th>
                  <th>Par défaut</th>
                  <th>Actif</th>
                  @if (canWrite()) {
                    <th class="text-end" style="width: 3.5rem"></th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (r of regions(); track r.id) {
                  <tr>
                    <td><code>{{ r.code }}</code></td>
                    <td class="fw-semibold">{{ r.libelle }}</td>
                    <td>{{ r.par_defaut ? 'Oui' : 'Non' }}</td>
                    <td>{{ r.actif ? 'Oui' : 'Non' }}</td>
                    @if (canWrite()) {
                      <td class="text-end">
                        <app-table-actions-menu #m>
                          <button type="button" class="table-actions-menu__item" (click)="openEditRegion(r); m.close()">
                            <i class="bi bi-pencil"></i> Modifier
                          </button>
                          <button type="button" class="table-actions-menu__item text-danger" (click)="removeRegion(r); m.close()">
                            <i class="bi bi-trash"></i> Supprimer
                          </button>
                        </app-table-actions-menu>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      } @else if (mode === 'responsables_zone') {
        @if (!responsables().length) {
          <app-empty-state title="Aucun responsable de zone" />
        } @else {
          <div class="parametrages-table-scroll">
            <table class="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Nom</th>
                  <th>Périmètre</th>
                  <th>Zone</th>
                  <th>Actif</th>
                  @if (canWrite()) {
                    <th class="text-end" style="width: 3.5rem"></th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (r of responsables(); track r.id) {
                  <tr>
                    <td><code>{{ r.code }}</code></td>
                    <td class="fw-semibold">{{ r.nom }}</td>
                    <td>{{ r.perimetre }}</td>
                    <td>{{ r.zone_libelle || '—' }}</td>
                    <td>{{ r.actif ? 'Oui' : 'Non' }}</td>
                    @if (canWrite()) {
                      <td class="text-end">
                        <app-table-actions-menu #m>
                          <button type="button" class="table-actions-menu__item" (click)="openEditRz(r); m.close()">
                            <i class="bi bi-pencil"></i> Modifier
                          </button>
                          <button type="button" class="table-actions-menu__item text-danger" (click)="removeRz(r); m.close()">
                            <i class="bi bi-trash"></i> Supprimer
                          </button>
                        </app-table-actions-menu>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      } @else {
        @if (!zones().length) {
          <app-empty-state title="Aucune zone" />
        } @else {
          <div class="parametrages-table-scroll">
            <table class="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Libellé</th>
                  <th>Périmètre</th>
                  <th>Région</th>
                  <th>Responsable</th>
                  <th>Communes</th>
                  <th>Villes</th>
                  <th>Actif</th>
                  @if (canWrite()) {
                    <th class="text-end" style="width: 3.5rem"></th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (z of zones(); track z.id) {
                  <tr>
                    <td><code>{{ z.code }}</code></td>
                    <td class="fw-semibold">{{ z.libelle }}</td>
                    <td>{{ z.perimetre }}</td>
                    <td>{{ z.region || '—' }}@if (z.region_code) { <span class="text-secondary"> · {{ z.region_code }}</span> }</td>
                    <td>{{ z.responsable_nom || '—' }}</td>
                    <td>{{ z.nb_communes }}</td>
                    <td>{{ z.nb_villes }}</td>
                    <td>{{ z.actif ? 'Oui' : 'Non' }}</td>
                    @if (canWrite()) {
                      <td class="text-end">
                        <app-table-actions-menu #m>
                          <button type="button" class="table-actions-menu__item" (click)="openEditZone(z); m.close()">
                            <i class="bi bi-pencil"></i> Modifier
                          </button>
                          <button type="button" class="table-actions-menu__item text-danger" (click)="removeZone(z); m.close()">
                            <i class="bi bi-trash"></i> Supprimer
                          </button>
                        </app-table-actions-menu>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </app-section-card>

    <app-responsable-zone-form-modal
      [open]="rzModalOpen()"
      [saving]="saving()"
      [responsable]="editingRz()"
      (cancel)="closeRzModal()"
      (save)="saveRz($event)"
    />
    <app-zone-form-modal
      [open]="zoneModalOpen()"
      [saving]="saving()"
      [zone]="editingZone()"
      [responsables]="responsables()"
      [regions]="regions()"
      (cancel)="closeZoneModal()"
      (save)="saveZone($event)"
    />
    <app-region-form-modal
      [open]="regionModalOpen()"
      [saving]="saving()"
      [region]="editingRegion()"
      (cancel)="closeRegionModal()"
      (save)="saveRegion($event)"
    />
  `,
})
export class ParametragesReferentielsZonesComponent implements OnInit {
  @Input({ required: true }) mode!: 'responsables_zone' | 'zones' | 'regions';

  private readonly api = inject(ZoneReferentielService);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly responsables = signal<ResponsableZoneRef[]>([]);
  readonly zones = signal<ZoneRef[]>([]);
  readonly regions = signal<RegionRef[]>([]);

  readonly rzModalOpen = signal(false);
  readonly zoneModalOpen = signal(false);
  readonly editingRz = signal<ResponsableZoneRef | null>(null);
  readonly editingZone = signal<ZoneRef | null>(null);
  readonly regionModalOpen = signal(false);
  readonly editingRegion = signal<RegionRef | null>(null);

  ngOnInit(): void {
    void this.reload();
  }

  canWrite(): boolean {
    return this.auth.can('referentiels.zones.ecrire');
  }

  cardTitle(): string {
    if (this.mode === 'regions') return 'Régions';
    if (this.mode === 'responsables_zone') return 'Responsables de zone';
    return 'Zones';
  }

  createLabel(): string {
    if (this.mode === 'regions') return 'Nouvelle région';
    if (this.mode === 'responsables_zone') return 'Nouveau responsable';
    return 'Nouvelle zone';
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const [rz, z, regions] = await Promise.all([
        firstValueFrom(this.api.listResponsables()),
        firstValueFrom(this.api.listZones()),
        firstValueFrom(this.api.listRegions()),
      ]);
      this.responsables.set(rz);
      this.zones.set(z);
      this.regions.set(regions);
    } catch {
      this.toast.error('Impossible de charger les référentiels zones.');
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    if (this.mode === 'regions') {
      this.editingRegion.set(null);
      this.regionModalOpen.set(true);
    } else if (this.mode === 'responsables_zone') {
      this.editingRz.set(null);
      this.rzModalOpen.set(true);
    } else {
      this.editingZone.set(null);
      this.zoneModalOpen.set(true);
    }
  }

  openEditRegion(r: RegionRef): void {
    this.editingRegion.set(r);
    this.regionModalOpen.set(true);
  }

  closeRegionModal(): void {
    this.regionModalOpen.set(false);
    this.editingRegion.set(null);
  }

  openEditRz(r: ResponsableZoneRef): void {
    this.editingRz.set(r);
    this.rzModalOpen.set(true);
  }

  openEditZone(z: ZoneRef): void {
    this.editingZone.set(z);
    this.zoneModalOpen.set(true);
  }

  closeRzModal(): void {
    this.rzModalOpen.set(false);
    this.editingRz.set(null);
  }

  closeZoneModal(): void {
    this.zoneModalOpen.set(false);
    this.editingZone.set(null);
  }

  async saveRegion(input: RegionRefInput): Promise<void> {
    this.saving.set(true);
    try {
      const edit = this.editingRegion();
      if (edit) {
        await firstValueFrom(this.api.updateRegion(edit.id, input));
        this.toast.success('Région mise à jour.');
      } else {
        await firstValueFrom(this.api.createRegion(input));
        this.toast.success('Région créée.');
      }
      this.closeRegionModal();
      await this.reload();
    } catch {
      this.toast.error('Enregistrement impossible (code déjà utilisé ?).');
    } finally {
      this.saving.set(false);
    }
  }

  async removeRegion(r: RegionRef): Promise<void> {
    if (!confirm(`Supprimer la région ${r.libelle} ?`)) return;
    try {
      await firstValueFrom(this.api.deleteRegion(r.id));
      this.toast.success('Région supprimée.');
      await this.reload();
    } catch {
      this.toast.error('Suppression impossible (région liée à une zone).');
    }
  }

  async saveRz(input: ResponsableZoneInput): Promise<void> {
    this.saving.set(true);
    try {
      const edit = this.editingRz();
      if (edit) {
        await firstValueFrom(this.api.updateResponsable(edit.id, input));
        this.toast.success('Responsable mis à jour.');
      } else {
        await firstValueFrom(this.api.createResponsable(input));
        this.toast.success('Responsable créé.');
      }
      this.closeRzModal();
      await this.reload();
    } catch {
      this.toast.error('Enregistrement impossible (code déjà utilisé ?).');
    } finally {
      this.saving.set(false);
    }
  }

  async saveZone(input: ZoneRefInput): Promise<void> {
    this.saving.set(true);
    try {
      const edit = this.editingZone();
      if (edit) {
        await firstValueFrom(this.api.updateZone(edit.id, input));
        this.toast.success('Zone mise à jour.');
      } else {
        await firstValueFrom(this.api.createZone(input));
        this.toast.success('Zone créée.');
      }
      this.closeZoneModal();
      await this.reload();
    } catch {
      this.toast.error('Enregistrement impossible (code déjà utilisé ?).');
    } finally {
      this.saving.set(false);
    }
  }

  async removeRz(r: ResponsableZoneRef): Promise<void> {
    if (!confirm(`Supprimer le responsable ${r.nom} ?`)) return;
    try {
      await firstValueFrom(this.api.deleteResponsable(r.id));
      this.toast.success('Responsable supprimé.');
      await this.reload();
    } catch {
      this.toast.error('Suppression impossible (responsable lié à une zone).');
    }
  }

  async removeZone(z: ZoneRef): Promise<void> {
    if (!confirm(`Supprimer la zone ${z.libelle} ?`)) return;
    try {
      await firstValueFrom(this.api.deleteZone(z.id));
      this.toast.success('Zone supprimée.');
      await this.reload();
    } catch {
      this.toast.error('Suppression impossible.');
    }
  }
}
