import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  effect,
  inject,
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

@Component({
  selector: 'app-rdc-province-map',
  standalone: true,
  template: `<div #host class="rdc-map"></div>`,
  styles: [
    `
      :host {
        display: block;
        height: 22rem;
      }
      .rdc-map {
        height: 100%;
        width: 100%;
        background: #f4f4f5;
        border-radius: 0.75rem;
        overflow: hidden;
      }
      :host-context([data-bs-theme='dark']) .rdc-map {
        background: #111827;
      }
      :host ::ng-deep .leaflet-control-attribution {
        display: none;
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
  private layer?: L.GeoJSON;
  private byKey = new Map<string, ProvinceStat>();

  constructor() {
    effect(() => {
      this.theme.mode();
      this.layer?.setStyle((feature) => this.styleOf(feature));
    });
  }

  ngAfterViewInit(): void {
    const host = this.hostRef.nativeElement;
    this.map = L.map(host, {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      dragging: true,
    });
    this.rebuild();
    void this.ensureGeo().then((geo) => {
      if (!this.map) return;
      this.layer = L.geoJSON(geo as never, {
        style: (feature) => this.styleOf(feature),
        onEachFeature: (feature, layer) => {
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
      const bounds = this.layer.getBounds();
      if (bounds.isValid()) {
        this.map.fitBounds(bounds, { padding: [12, 12], animate: false });
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['zones'] || changes['metric'] || changes['devise']) {
      this.rebuild();
      this.layer?.setStyle((feature) => this.styleOf(feature));
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = undefined;
    this.layer = undefined;
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
    if (!geojsonCache) {
      geojsonCache = new Promise((resolve, reject) => {
        this.http.get<GeoJson>('/rdc-provinces.geojson').subscribe({
          next: (data) => resolve(data),
          error: (err) => {
            geojsonCache = null;
            reject(err);
          },
        });
      });
    }
    return geojsonCache;
  }
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
