import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { PilotageZoneActivite } from '../../core/models/pilotage.models';
import { HeatMetric, heatIntensity, mapHeatColor, mapHeatStrokeColor } from '../../shared/utils/heat-scale.utils';

/** Codes zone réseau → noms GeoJSON (shapeName). */
const ZONE_PROVINCES: Record<string, string[]> = {
  EST_1: ['North Kivu', 'Ituri'],
  EST_2: ['South Kivu', 'Maniema'],
  KATANGA: ['Haut-Katanga', 'Haut-Lomami', 'Lualaba', 'Tanganyika'],
  KONGO_CENTRAL: ['Kongo-Central'],
  KIN_1: ['Kinshasa'],
  KIN_2: ['Kinshasa'],
  KIN_3: ['Kinshasa'],
  KIN_4: ['Kinshasa'],
};

const IDLE = '#f3f4f6';
const IDLE_STROKE = '#d1d5db';

interface ProvinceStat {
  name: string;
  volume: number;
  montant: number;
  zones: string[];
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
        background: #fafafa;
        border-radius: 0.75rem;
        overflow: hidden;
      }
      :host ::ng-deep .leaflet-control-attribution {
        display: none;
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
  private map?: L.Map;
  private layer?: L.GeoJSON;
  private byName = new Map<string, ProvinceStat>();

  ngAfterViewInit(): void {
    const host = this.hostRef.nativeElement;
    this.map = L.map(host, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
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
            layer.bindTooltip(this.tooltip(String(feature?.properties?.['name'] ?? '')), {
              sticky: true,
            }).openTooltip();
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
      const code = (row.code || '').trim().toUpperCase();
      const provinces = ZONE_PROVINCES[code];
      if (!provinces) continue;
      for (const name of provinces) {
        const cur = acc.get(name) ?? { name, volume: 0, montant: 0, zones: [] };
        cur.volume += Number(row.volume) || 0;
        cur.montant += Number(row.montant) || 0;
        if (!cur.zones.includes(code)) cur.zones.push(code);
        acc.set(name, cur);
      }
    }
    this.byName = acc;
  }

  private styleOf(feature: GeoJsonFeature | undefined): L.PathOptions {
    const name = String(feature?.properties?.['name'] ?? '');
    const stat = this.byName.get(name);
    const value = stat ? (this.metric === 'volume' ? stat.volume : stat.montant) : 0;
    if (!stat || value <= 0) {
      return { color: IDLE_STROKE, weight: 1, fillColor: IDLE, fillOpacity: 1 };
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
    for (const stat of this.byName.values()) {
      const value = this.metric === 'volume' ? stat.volume : stat.montant;
      if (value <= 0) continue;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    if (!Number.isFinite(min)) return { min: 0, max: 0 };
    return { min, max };
  }

  private tooltip(name: string): string {
    const stat = this.byName.get(name);
    const label = provinceLabel(name);
    if (!stat) return `${label}<br>Aucune activité sur les zones mappées`;
    const vol = stat.volume.toLocaleString('fr-FR');
    const mont = stat.montant.toLocaleString('fr-FR', { maximumFractionDigits: 0 });
    return `${label}<br>${vol} op. · ${mont} ${this.devise}<br>${stat.zones.join(', ')}`;
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

function provinceLabel(geoName: string): string {
  const labels: Record<string, string> = {
    'North Kivu': 'Nord-Kivu',
    'South Kivu': 'Sud-Kivu',
    'Kongo-Central': 'Kongo Central',
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
