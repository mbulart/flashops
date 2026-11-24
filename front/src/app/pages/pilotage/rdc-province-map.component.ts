import {
  AfterViewInit,
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { PilotageZoneActivite } from '../../core/models/pilotage.models';
import { ThemeService } from '../../core/services/theme.service';
import { HeatMetric, heatIntensity, mapHeatColor, mapHeatStrokeColor } from '../../shared/utils/heat-scale.utils';

/** Variantes d’orthographe → clé GeoJSON pliée. */
const ALIASES: Record<string, string> = {
  nordkivu: 'northkivu',
  sudkivu: 'southkivu',
  hautuele: 'upperuele',
  basuele: 'loweruele',
  kasaicentral: 'centralkasai',
  kasaicentre: 'centralkasai',
};

interface ProvinceStat {
  name: string;
  volume: number;
  montant: number;
}

let geojsonCache: Promise<GeoJson> | null = null;
let africaCache: Promise<GeoJson> | null = null;

@Component({
  selector: 'app-rdc-province-map',
  standalone: true,
  template: `
    <div class="rdc-shell" [class.rdc-shell--expanded]="expanded()" [class.rdc-shell--fullscreen]="fullscreen()">
      <div class="rdc-toolbar" [class.rdc-toolbar--fs]="fullscreen()">
        @if (!fullscreen()) {
          <button
            type="button"
            class="rdc-btn"
            (click)="toggleExpanded($event)"
            [attr.aria-label]="expanded() ? 'Compresser la carte' : 'Étendre la carte'"
            [title]="expanded() ? 'Compresser' : 'Étendre'"
          >
            <i class="bi" [class.bi-arrows-angle-contract]="expanded()" [class.bi-arrows-angle-expand]="!expanded()"></i>
            <span>{{ expanded() ? 'Compresser' : 'Étendre' }}</span>
          </button>
        }
        <button
          type="button"
          class="rdc-btn"
          [class.rdc-btn--exit]="fullscreen()"
          (click)="toggleFullscreen($event)"
          [attr.aria-label]="fullscreen() ? 'Quitter le plein écran' : 'Plein écran'"
          [title]="fullscreen() ? 'Réduire' : 'Plein écran'"
        >
          <i class="bi" [class.bi-fullscreen-exit]="fullscreen()" [class.bi-fullscreen]="!fullscreen()"></i>
          <span>{{ fullscreen() ? 'Réduire' : 'Plein écran' }}</span>
        </button>
      </div>
      @if (fullscreen()) {
        <div class="rdc-fs-hint">Touchez Réduire pour quitter</div>
      }
      <div #host class="rdc-map"></div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 22rem;
        transition: height 0.2s ease;
      }
      :host.rdc-host--expanded:not(.rdc-host--fullscreen) {
        height: 36rem;
      }
      :host.rdc-host--fullscreen {
        height: 0;
      }
      .rdc-shell {
        position: relative;
        height: 100%;
        width: 100%;
      }
      /* Sous les modales (agence ~10000) */
      .rdc-shell--fullscreen {
        position: fixed;
        inset: 0;
        z-index: 1040;
        height: 100% !important;
        background: var(--card-bg, #0f1115);
        padding: 0.75rem;
        padding-top: max(0.75rem, env(safe-area-inset-top, 0px));
        padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px));
        padding-left: max(0.75rem, env(safe-area-inset-left, 0px));
        padding-right: max(0.75rem, env(safe-area-inset-right, 0px));
      }
      .rdc-toolbar {
        position: absolute;
        top: 0.65rem;
        right: 0.65rem;
        z-index: 1100;
        display: flex;
        gap: 0.35rem;
      }
      .rdc-toolbar--fs {
        z-index: 1200;
      }
      .rdc-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.35rem 0.65rem;
        border: 1px solid color-mix(in srgb, var(--card-border, #ccc) 80%, transparent);
        border-radius: 0.4rem;
        background: color-mix(in srgb, var(--card-bg, #fff) 92%, transparent);
        color: inherit;
        font-size: 0.8rem;
        font-weight: 600;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
      }
      .rdc-btn:hover {
        filter: brightness(1.05);
      }
      .rdc-btn--exit {
        padding: 0.55rem 0.9rem;
        font-size: 0.95rem;
        background: #fff;
        color: #111;
        border-color: color-mix(in srgb, #111 25%, transparent);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.28);
      }
      .rdc-fs-hint {
        position: absolute;
        top: max(3.25rem, calc(env(safe-area-inset-top, 0px) + 2.75rem));
        left: 50%;
        transform: translateX(-50%);
        z-index: 1200;
        max-width: calc(100% - 2rem);
        padding: 0.3rem 0.75rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--card-bg, #fff) 92%, transparent);
        font-size: 0.75rem;
        color: var(--bs-secondary-color, #6c757d);
        pointer-events: none;
        text-align: center;
      }
      @media (max-width: 767.98px) {
        .rdc-toolbar--fs {
          top: auto;
          bottom: max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem));
          left: 50%;
          right: auto;
          transform: translateX(-50%);
        }
        .rdc-btn--exit {
          min-height: 2.75rem;
          min-width: 9.5rem;
          justify-content: center;
          border-radius: 999px;
          font-size: 1rem;
          background: #ffd500;
          border-color: color-mix(in srgb, #111 20%, transparent);
          box-shadow: 0 6px 22px rgba(0, 0, 0, 0.32);
        }
        .rdc-fs-hint {
          top: max(0.85rem, env(safe-area-inset-top, 0px));
        }
      }
      .rdc-map {
        height: 100%;
        width: 100%;
        background: #e8eaed;
        border-radius: 0.75rem;
        overflow: hidden;
      }
      .rdc-shell--fullscreen .rdc-map {
        border-radius: 0.4rem;
        height: 100%;
      }
      :host-context([data-bs-theme='dark']) .rdc-map {
        background: #0b1220;
      }
      :host ::ng-deep .leaflet-control-attribution,
      :host ::ng-deep .leaflet-zoom-box {
        display: none;
      }
      :host ::ng-deep .leaflet-container,
      :host ::ng-deep .leaflet-container:focus,
      :host ::ng-deep .leaflet-container :focus,
      :host ::ng-deep .leaflet-interactive,
      :host ::ng-deep svg,
      :host ::ng-deep svg *,
      :host ::ng-deep path {
        outline: none !important;
      }
      :host-context([data-bs-theme='dark']) ::ng-deep .leaflet-bar a {
        background: #1f2937;
        color: #e5e7eb;
        border-color: #374151;
      }
      :host-context([data-bs-theme='dark']) ::ng-deep .leaflet-bar a:hover {
        background: #374151;
      }
      :host-context([data-bs-theme='dark']) ::ng-deep .leaflet-tooltip {
        background: #1f2937;
        color: #f9fafb;
        border: 1px solid #374151;
      }
      :host-context([data-bs-theme='dark']) ::ng-deep .leaflet-tooltip-top:before {
        border-top-color: #1f2937;
      }
    `,
  ],
})
export class RdcProvinceMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() zones: PilotageZoneActivite[] = [];
  @Input() metric: HeatMetric = 'value';
  @Input() devise = 'USD';

  @ViewChild('host', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

  private readonly http = inject(HttpClient);
  private readonly theme = inject(ThemeService);
  private map?: L.Map;
  private africa?: L.GeoJSON;
  private layer?: L.GeoJSON;
  private byKey = new Map<string, ProvinceStat>();
  private sizeTimer?: ReturnType<typeof setTimeout>;

  readonly expanded = signal(false);
  readonly fullscreen = signal(false);

  @HostBinding('class.rdc-host--expanded')
  get hostExpanded(): boolean {
    return this.expanded();
  }

  @HostBinding('class.rdc-host--fullscreen')
  get hostFullscreen(): boolean {
    return this.fullscreen();
  }

  constructor() {
    effect(() => {
      this.theme.mode();
      this.africa?.setStyle(() => this.africaStyle());
      this.layer?.setStyle((feature) => this.styleOf(feature));
    });
  }

  ngAfterViewInit(): void {
    const host = this.hostRef.nativeElement;
    // Padding large : garde une version vectorielle hors viewport pendant le pan latéral.
    const renderer = L.canvas({ padding: 1.25 });
    this.map = L.map(host, {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: false,
      dragging: true,
      zoomSnap: 0.25,
      zoomDelta: 0.25,
      wheelPxPerZoomLevel: 180,
      renderer,
      fadeAnimation: false,
      markerZoomAnimation: false,
    });
    this.rebuild();
    void Promise.all([this.ensureGeo(), this.ensureAfrica()]).then(([geo, africa]) => {
      if (!this.map) return;
      this.africa = L.geoJSON(africa as never, {
        interactive: false,
        style: () => this.africaStyle(),
      }).addTo(this.map);
      this.layer = L.geoJSON(geo as never, {
        style: (feature) => this.styleOf(feature),
        onEachFeature: (feature, layer) => {
          layer.on('click', () => blurPath(layer));
          layer.on('mouseover', () => {
            (layer as L.Path).setStyle({ weight: 2 });
            layer
              .bindTooltip(this.tooltip(String(feature?.properties?.['name'] ?? '')), {
                sticky: true,
              })
              .openTooltip();
          });
          layer.on('mouseout', () => {
            (layer as L.Path).setStyle(this.styleOf(feature));
            layer.closeTooltip();
          });
        },
      }).addTo(this.map);
      this.fitRdc();
      requestAnimationFrame(() => this.fitRdc());
    });
  }

  /** La RDC entière, calée sur la carte. L’Afrique reste visible seulement autour. */
  private fitRdc(): void {
    if (!this.map || !this.layer) return;
    this.map.invalidateSize();
    const bounds = this.layer.getBounds();
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [2, 2], animate: false });
    }
  }

  toggleExpanded(ev?: Event): void {
    ev?.preventDefault();
    ev?.stopPropagation();
    if (this.fullscreen()) {
      this.setFullscreen(false);
    }
    this.expanded.update((v) => !v);
    this.scheduleResize();
  }

  toggleFullscreen(ev?: Event): void {
    ev?.preventDefault();
    ev?.stopPropagation();
    if (document.body.classList.contains('agency-modal-open')) return;
    this.setFullscreen(!this.fullscreen());
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (document.body.classList.contains('agency-modal-open')) return;
    if (!this.fullscreen()) return;
    this.setFullscreen(false);
  }

  @HostListener('document:flashopsExitMapFs')
  onGlobalExitFullscreen(): void {
    if (this.fullscreen()) this.setFullscreen(false);
  }

  private setFullscreen(on: boolean): void {
    if (on === this.fullscreen()) return;
    if (on && document.body.classList.contains('agency-modal-open')) return;
    this.fullscreen.set(on);
    if (on) {
      this.expanded.set(true);
      document.body.classList.add('geo-map-fs-open');
    } else if (!document.querySelector('app-geo-map .geo-map-shell--fullscreen')) {
      document.body.classList.remove('geo-map-fs-open');
    }
    this.scheduleResize();
  }

  private scheduleResize(): void {
    if (this.sizeTimer != null) clearTimeout(this.sizeTimer);
    this.sizeTimer = setTimeout(() => {
      this.sizeTimer = undefined;
      this.map?.invalidateSize({ animate: false });
    }, 60);
    requestAnimationFrame(() => this.map?.invalidateSize({ animate: false }));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['zones'] || changes['metric'] || changes['devise']) {
      this.rebuild();
      this.layer?.setStyle((feature) => this.styleOf(feature));
    }
  }

  ngOnDestroy(): void {
    if (this.fullscreen()) {
      this.fullscreen.set(false);
      if (!document.querySelector('app-geo-map .geo-map-shell--fullscreen')) {
        document.body.classList.remove('geo-map-fs-open');
      }
    }
    if (this.sizeTimer != null) clearTimeout(this.sizeTimer);
    this.map?.remove();
    this.map = undefined;
    this.africa = undefined;
    this.layer = undefined;
  }

  private africaStyle(): L.PathOptions {
    const dark = this.theme.mode() === 'dark';
    return {
      interactive: false,
      color: dark ? '#1f2937' : '#9ca3af',
      weight: 0.6,
      fillColor: dark ? '#030712' : '#b7bcc4',
      fillOpacity: 1,
    };
  }

  private rebuild(): void {
    const acc = new Map<string, ProvinceStat>();
    for (const row of this.zones) {
      const key = geoKey(row.code || '');
      if (!key) continue;
      const cur = acc.get(key) ?? { name: row.code.trim(), volume: 0, montant: 0 };
      cur.volume += Number(row.volume) || 0;
      cur.montant += Number(row.montant) || 0;
      acc.set(key, cur);
    }
    this.byKey = acc;
  }

  private styleOf(feature: GeoJsonFeature | undefined): L.PathOptions {
    const dark = this.theme.mode() === 'dark';
    const idle = dark ? '#1f2937' : '#e5e7eb';
    const idleStroke = dark ? '#4b5563' : '#9ca3af';
    const key = geoKey(String(feature?.properties?.['name'] ?? ''));
    const stat = this.byKey.get(key);
    const value = stat ? (this.metric === 'volume' ? stat.volume : stat.montant) : 0;
    if (!stat || value <= 0) {
      return { color: idleStroke, weight: 1, fillColor: idle, fillOpacity: 1 };
    }
    const { min, max } = this.extent();
    const intensity = heatIntensity(value, min, max);
    return {
      color: mapHeatStrokeColor(intensity),
      weight: 1,
      fillColor: mapHeatColor(intensity),
      fillOpacity: 0.92,
    };
  }

  private extent(): { min: number; max: number } {
    let min = Number.POSITIVE_INFINITY;
    let max = 0;
    for (const stat of this.byKey.values()) {
      const value = this.metric === 'volume' ? stat.volume : stat.montant;
      if (value <= 0) continue;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    if (!Number.isFinite(min)) return { min: 0, max: 0 };
    return { min, max };
  }

  private tooltip(geoName: string): string {
    const label = provinceLabel(geoName);
    const stat = this.byKey.get(geoKey(geoName));
    if (!stat || (stat.volume <= 0 && stat.montant <= 0)) {
      return `${label}<br>Aucune activité`;
    }
    const vol = stat.volume.toLocaleString('fr-FR');
    const mont = stat.montant.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
    return `${label}<br>Volume ${vol}<br>Valeur ${mont} ${this.devise}`;
  }

  private ensureGeo(): Promise<GeoJson> {
    return loadGeo(this.http, '/rdc-provinces.geojson', () => geojsonCache, (p) => (geojsonCache = p));
  }

  private ensureAfrica(): Promise<GeoJson> {
    return loadGeo(this.http, '/africa.geojson', () => africaCache, (p) => (africaCache = p));
  }
}

function loadGeo(
  http: HttpClient,
  url: string,
  read: () => Promise<GeoJson> | null,
  write: (p: Promise<GeoJson> | null) => void,
): Promise<GeoJson> {
  const cached = read();
  if (cached) return cached;
  const pending = new Promise<GeoJson>((resolve, reject) => {
    http.get<GeoJson>(url).subscribe({
      next: (data) => resolve(data),
      error: (err) => {
        write(null);
        reject(err);
      },
    });
  });
  write(pending);
  return pending;
}

function blurPath(layer: L.Layer): void {
  const el = (layer as L.Path).getElement();
  if (el instanceof SVGElement || el instanceof HTMLElement) el.blur();
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function geoKey(value: string): string {
  const folded = fold(value);
  return ALIASES[folded] ?? folded;
}

function provinceLabel(geoName: string): string {
  const labels: Record<string, string> = {
    'North Kivu': 'Nord-Kivu',
    'South Kivu': 'Sud-Kivu',
    'Kongo-Central': 'Kongo Central',
    'Upper Uele': 'Haut-Uélé',
    'Lower Uele': 'Bas-Uélé',
    'Central Kasai': 'Kasaï-Central',
    'Kasai-Oriental': 'Kasaï-Oriental',
    'Mai-Ndombe': 'Maï-Ndombe',
  };
  return labels[geoName] ?? geoName;
}

interface GeoJsonFeature {
  properties?: Record<string, unknown>;
}

interface GeoJson {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}
