import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { GeoPoint } from '../../core/models/api.models';
import { PublicAgenceGeo } from '../../core/models/public-agences.models';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { PublicAgencesService } from '../../core/services/public-agences.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../core/services/toast.service';
import { ExcelPreviewModalComponent } from '../../shared/components/excel-preview-modal/excel-preview-modal.component';
import { GeoMapComponent } from '../../shared/components/geo-map/geo-map.component';
import { ExcelPreviewSheet } from '../../shared/utils/format.utils';
import { buildAgencesGeoExcel } from './agences-geo-excel.export';

@Component({
  selector: 'app-agences-carte-page',
  standalone: true,
  imports: [CommonModule, GeoMapComponent, ExcelPreviewModalComponent],
  template: `
    <div class="carte-page">
      <header class="carte-bar">
        @if (brandLogo()) {
          <img class="carte-logo" [src]="brandLogo()" [alt]="appName()" />
        }
        <div class="carte-title">
          <strong>Agences</strong>
          @if (!loading()) {
            <span class="text-muted">{{ agencies().length }}</span>
          }
        </div>
        <div class="carte-actions">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            [disabled]="loading() || !agencies().length || exporting()"
            (click)="openExport()"
          >
            @if (exporting()) {
              <span class="spinner-border spinner-border-sm me-1" role="status"></span>
            } @else {
              <i class="bi bi-download me-1"></i>
            }
            Exporter
          </button>
          <button
            type="button"
            class="btn btn-sm btn-icon"
            (click)="theme.toggle()"
            [title]="theme.mode() === 'light' ? 'Mode sombre' : 'Mode clair'"
          >
            <i class="bi" [class.bi-moon-stars]="theme.mode() === 'light'" [class.bi-sun]="theme.mode() === 'dark'"></i>
          </button>
        </div>
      </header>

      <div class="carte-map">
        @if (loading()) {
          <div class="carte-state">
            <span class="spinner-border spinner-border-sm me-2" role="status"></span>
            Chargement
          </div>
        } @else if (error()) {
          <div class="carte-state text-muted">{{ error() }}</div>
        } @else if (!points().length) {
          <div class="carte-state text-muted">Aucune agence géolocalisée</div>
        } @else {
          <app-geo-map
            [points]="points()"
            height="100%"
            ringColor="#ffd500"
            [showActivity]="false"
            [pinIconUrl]="pinIcon()"
          />
        }
      </div>
    </div>

    <app-excel-preview-modal
      [open]="previewOpen()"
      title="Aperçu"
      [filename]="exportFilename"
      [buffer]="exportBuffer()"
      [previewSheets]="previewSheets()"
      [hideShare]="true"
      (closed)="closeExport()"
    />
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        color: var(--text-primary, #111);
      }
      .carte-page {
        display: flex;
        flex-direction: column;
        height: 100vh;
        background: var(--app-bg, #f1f3f5);
        color: inherit;
      }
      .carte-bar {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-height: 3.25rem;
        padding: 0.5rem 1rem;
        border-bottom: 1px solid var(--card-border, #e5e7eb);
        background: var(--header-bg, #fff);
        color: inherit;
      }
      .carte-logo {
        height: 1.75rem;
        width: auto;
        object-fit: contain;
      }
      .carte-title {
        display: flex;
        align-items: baseline;
        gap: 0.5rem;
        min-width: 0;
        flex: 1 1 auto;
      }
      .carte-title strong {
        font-size: 0.95rem;
        font-weight: 600;
      }
      .carte-title .text-muted {
        font-size: 0.8rem;
      }
      .carte-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
      .carte-map {
        flex: 1 1 auto;
        min-height: 0;
        position: relative;
        background: var(--app-bg, #f1f3f5);
      }
      .carte-state {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.875rem;
        color: var(--text-muted, #6b7280);
      }
    `,
  ],
})
export class AgencesCartePageComponent implements OnInit {
  private readonly publicAgences = inject(PublicAgencesService);
  private readonly appSettings = inject(AppSettingsService);
  readonly theme = inject(ThemeService);
  private readonly toast = inject(ToastService);

  readonly agencies = signal<PublicAgenceGeo[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly exporting = signal(false);
  readonly previewOpen = signal(false);
  readonly exportBuffer = signal<ArrayBuffer | null>(null);
  readonly previewSheets = signal<ExcelPreviewSheet[]>([]);

  readonly exportFilename = 'agences.xlsx';
  readonly appName = computed(() => this.appSettings.settings().app_name);
  readonly brandLogo = computed(() => {
    const settings = this.appSettings.settings();
    return this.theme.mode() === 'dark'
      ? settings.logo_dark || settings.logo_light
      : settings.logo_light || settings.logo_dark;
  });
  readonly pinIcon = computed(
    () => this.appSettings.settings().favicon || this.brandLogo()
  );
  readonly points = computed<GeoPoint[]>(() =>
    this.agencies().map((row) => ({
      agency_id: row.agenceId,
      code: row.code,
      label: row.nom || row.code,
      address: row.adresse,
      city: row.adresse,
      lat: row.latitude,
      lng: row.longitude,
      tx_count: 0,
      volume: 0,
      currency: '',
    }))
  );

  ngOnInit(): void {
    this.publicAgences.listLocated().subscribe({
      next: (rows) => {
        this.agencies.set(rows.filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude)));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les agences');
        this.loading.set(false);
      },
    });
  }

  closeExport(): void {
    this.previewOpen.set(false);
    this.exportBuffer.set(null);
    this.previewSheets.set([]);
  }

  async openExport(): Promise<void> {
    const rows = this.agencies();
    if (!rows.length || this.exporting()) return;
    this.exporting.set(true);
    try {
      const settings = this.appSettings.settings();
      const generated = new Date().toLocaleDateString('fr-FR');
      const buffer = await buildAgencesGeoExcel({
        filename: this.exportFilename,
        title: 'Agences',
        subtitle: `Localisation · ${rows.length} agence${rows.length > 1 ? 's' : ''} · ${generated}`,
        agencies: rows,
        logoUrl: settings.logo_light || settings.logo_dark,
        appName: settings.app_name,
        faviconUrl: settings.favicon || settings.logo_light,
      });
      const previewLimit = 150;
      this.exportBuffer.set(buffer);
      this.previewSheets.set([
        {
          name: 'Agences',
          headers: ['Nom', 'Code', 'Adresse', 'Latitude', 'Longitude'],
          rows: rows.slice(0, previewLimit).map((row) => [
            row.nom || '',
            row.code || '',
            row.adresse || '',
            formatCoord(row.latitude),
            formatCoord(row.longitude),
          ]),
          totalRows: rows.length,
          truncated: rows.length > previewLimit,
        },
      ]);
      this.previewOpen.set(true);
    } catch (err) {
      console.error('export agences', err);
      this.toast.error('Export impossible');
    } finally {
      this.exporting.set(false);
    }
  }
}

function formatCoord(value: number): string {
  return Number.isFinite(value) ? value.toFixed(6) : '';
}
