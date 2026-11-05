import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { GeoPoint } from '../../../core/models/api.models';
import { GoogleMapsLoaderService } from '../../../core/services/google-maps-loader.service';
import { formatNumberFr, formatValeurFr } from '../../utils/format.utils';
import { heatIntensity, mapHeatColor, mapHeatStrokeColor, type HeatMetric } from '../../utils/heat-scale.utils';

type MapEngine = 'google' | 'leaflet';

@Component({
  selector: 'app-geo-map',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="geo-map-shell" [class.geo-map-shell--fullscreen]="fullscreen()" [class.geo-map-shell--ready]="tilesReady()">
      @if (!compactChrome) {
        <button
          type="button"
          class="geo-map-fs-btn"
          (click)="toggleFullscreen($event)"
          [attr.aria-label]="fullscreen() ? 'Quitter le plein écran' : 'Agrandir la carte'"
          [title]="fullscreen() ? 'Quitter (Échap)' : 'Plein écran'"
        >
          <i class="bi" [class.bi-fullscreen]="!fullscreen()" [class.bi-fullscreen-exit]="fullscreen()"></i>
          @if (fullscreen()) {
            <span>Réduire</span>
          } @else {
            <span>Plein écran</span>
          }
        </button>
      }
      @if (fullscreen()) {
        <div class="geo-map-fs-hint">Échap ou Réduire pour quitter</div>
      }
      @if (engine() === 'google' && !compactChrome) {
        <div class="geo-map-provider geo-map-provider--google">Google Maps</div>
      }
      @if (!staticPin && !ringColor && points.length && presenceMode) {
        <div class="geo-map-legend">
          <span class="geo-map-swatch geo-map-swatch--present"></span>
          <span class="small text-muted">Dans le résultat</span>
          <span class="geo-map-swatch geo-map-swatch--missing"></span>
          <span class="small text-muted">Sans opération</span>
        </div>
      } @else if (!staticPin && !ringColor && points.length) {
        <div class="geo-map-legend">
          <span class="small text-muted">{{ activityMetric === 'volume' ? 'Volume faible' : 'Valeur faible' }}</span>
          <span class="geo-map-swatch" [style.background]="heatColor(0.08)"></span>
          <span class="geo-map-swatch" [style.background]="heatColor(0.35)"></span>
          <span class="geo-map-swatch" [style.background]="heatColor(0.65)"></span>
          <span class="geo-map-swatch" [style.background]="heatColor(1)"></span>
          <span class="small text-muted">{{ activityMetric === 'volume' ? 'Volume fort' : 'Valeur forte' }}</span>
        </div>
      }
      @if (!tilesReady()) {
        <div class="geo-map-loading" aria-hidden="true">
          <span class="geo-map-loading__pulse"></span>
        </div>
      }
      <div
        class="geo-map-host"
        #mapHost
        [class.geo-map-host--pick]="pickMode"
        [style.height]="fullscreen() ? '100%' : height"
        (dblclick)="onHostDblClick($event)"
      ></div>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        min-height: 0;
        flex: 1 1 auto;
      }
      .geo-map-shell {
        position: relative;
        width: 100%;
        height: 100%;
        flex: 1 1 auto;
        min-height: 0;
        border-radius: 0.5rem;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .geo-map-shell--fullscreen {
        position: fixed;
        inset: 0;
        z-index: 2100;
        border-radius: 0;
        background: var(--card-bg, #0f1115);
        padding: 0.75rem;
        display: flex;
        flex-direction: column;
      }
      .geo-map-host--pick {
        cursor: crosshair;
      }
      .geo-map-host {
        width: 100%;
        flex: 1 1 auto;
        height: 22rem;
        min-height: 10rem;
        border-radius: 0.5rem;
        overflow: hidden;
        z-index: 0;
        /* Jamais d'opacity sur le conteneur Leaflet : ça décale les tuiles (bandes blanches). */
      }
      .geo-map-loading {
        position: absolute;
        inset: 0;
        z-index: 2;
        display: grid;
        place-items: center;
        background: color-mix(in srgb, var(--card-bg, #f3f4f6) 92%, #dbe3ef);
        pointer-events: none;
        opacity: 1;
        transition: opacity 0.35s ease;
      }
      .geo-map-shell--ready .geo-map-loading {
        opacity: 0;
        visibility: hidden;
      }
      .geo-map-loading__pulse {
        width: 2.25rem;
        height: 2.25rem;
        border-radius: 999px;
        border: 2px solid color-mix(in srgb, #ffd500 70%, transparent);
        border-top-color: #ffd500;
        animation: geo-map-spin 0.8s linear infinite;
      }
      @keyframes geo-map-spin {
        to {
          transform: rotate(360deg);
        }
      }
      .geo-map-shell--fullscreen .geo-map-host {
        flex: 1 1 auto;
        min-height: 0;
        border-radius: 0.4rem;
        height: 100% !important;
      }
      .geo-map-fs-btn {
        position: absolute;
        top: 0.65rem;
        right: 0.65rem;
        z-index: 1000;
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
      }
      .geo-map-fs-btn:hover {
        filter: brightness(1.05);
      }
      .geo-map-fs-hint {
        position: absolute;
        top: 0.75rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        padding: 0.25rem 0.65rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--card-bg, #fff) 88%, transparent);
        font-size: 0.75rem;
        color: var(--bs-secondary-color, #6c757d);
        pointer-events: none;
      }
      .geo-map-provider {
        position: absolute;
        left: 0.65rem;
        bottom: 0.65rem;
        z-index: 1000;
        padding: 0.2rem 0.5rem;
        border-radius: 0.3rem;
        background: color-mix(in srgb, var(--card-bg, #fff) 90%, transparent);
        font-size: 0.7rem;
        font-weight: 600;
        pointer-events: none;
      }
      .geo-map-provider--google {
        color: #1a73e8;
      }
      .geo-map-legend {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.35rem;
        margin-bottom: 0.5rem;
      }
      .geo-map-swatch {
        width: 0.85rem;
        height: 0.85rem;
        border-radius: 3px;
        border: 1px solid color-mix(in srgb, var(--card-border, #ccc) 70%, transparent);
      }
      .geo-map-swatch--present {
        background: #16a34a;
      }
      .geo-map-swatch--missing {
        background: #dc2626;
      }
      :host ::ng-deep .geo-hex-icon,
      :host ::ng-deep .geo-brand-pin-icon {
        background: transparent;
        border: none;
      }
      :host ::ng-deep .geo-hex-icon svg {
        display: block;
        overflow: visible;
      }
      :host ::ng-deep .geo-brand-pin {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.35rem;
        pointer-events: none;
        filter: drop-shadow(0 6px 14px rgba(17, 17, 17, 0.18));
      }
      :host ::ng-deep .geo-brand-pin__mark {
        width: 2.35rem;
        height: 2.35rem;
        border-radius: 999px;
        background: #fff;
        border: 3px solid #ffd500;
        display: grid;
        place-items: center;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      }
      :host ::ng-deep .geo-brand-pin--compact .geo-brand-pin__mark {
        width: 2rem;
        height: 2rem;
        border-width: 3px;
      }
      :host ::ng-deep .geo-brand-pin--compact .geo-brand-pin__mark img {
        width: 1.2rem;
        height: 1.2rem;
      }
      :host ::ng-deep .geo-brand-pin__mark img {
        width: 1.45rem;
        height: 1.45rem;
        object-fit: contain;
      }
      :host ::ng-deep .geo-brand-pin--missing .geo-brand-pin__mark,
      :host ::ng-deep .geo-hex-icon--missing {
        animation: geo-pin-blink 1s ease-in-out infinite;
      }
      @keyframes geo-pin-blink {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.22;
        }
      }
      :host ::ng-deep .geo-brand-pin__label {
        max-width: 11rem;
        padding: 0.18rem 0.55rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--card-bg, #fff) 94%, transparent);
        border: 1px solid color-mix(in srgb, var(--card-border, #e5e7eb) 85%, transparent);
        color: var(--text-primary, #111);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: -0.01em;
        line-height: 1.2;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      :host ::ng-deep .leaflet-control-attribution {
        display: none !important;
      }
      :host ::ng-deep .leaflet-container {
        width: 100%;
        height: 100%;
        background: var(--app-bg, #e8eef5);
      }
      :host ::ng-deep .leaflet-popup-content-wrapper,
      :host ::ng-deep .leaflet-popup-tip {
        background: var(--card-bg, #fff);
        color: var(--text-primary, #111);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
      }
      :host ::ng-deep .leaflet-popup-content {
        color: inherit;
        margin: 0.65rem 0.85rem;
      }
      /* Capture temporaire pendant zoom/pan — ne bloque pas les gestes. */
      :host ::ng-deep .geo-map-tile-freeze {
        position: absolute;
        left: 0;
        top: 0;
        pointer-events: none !important;
        z-index: 250;
        transform-origin: 0 0;
        image-rendering: auto;
        transition: opacity 0.28s ease;
        opacity: 1;
      }
      :host ::ng-deep .geo-map-tile-freeze--out {
        opacity: 0;
      }
      /* Filet de sécurité si leaflet.css charge après le 1er paint. */
      :host ::ng-deep .leaflet-tile-pane,
      :host ::ng-deep .leaflet-map-pane,
      :host ::ng-deep .leaflet-marker-pane,
      :host ::ng-deep .leaflet-overlay-pane,
      :host ::ng-deep .leaflet-tooltip-pane,
      :host ::ng-deep .leaflet-popup-pane,
      :host ::ng-deep .leaflet-shadow-pane {
        position: absolute;
        left: 0;
        top: 0;
      }
      :host ::ng-deep .leaflet-tile {
        position: absolute !important;
        left: auto;
        top: auto;
        max-width: none !important;
        max-height: none !important;
      }
      :host ::ng-deep .leaflet-tile-container {
        position: absolute;
        left: 0;
        top: 0;
      }
    `,
  ],
})
export class GeoMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapHost', { static: true }) mapHost!: ElementRef<HTMLDivElement>;
  @Input() points: GeoPoint[] = [];
  @Input() height = '22rem';
  @Input() staticPin = false;
  /** Favicon / logo pour le pin unique (fiche agence). */
  @Input() pinIconUrl = '';
  /** Libellé sous le pin. */
  @Input() pinLabel = '';
  /** Masque plein écran / badge provider (fiche encadrée). */
  @Input() compactChrome = false;
  /** Activity scale for marker size and heat color (dashboard map). */
  @Input() activityMetric: HeatMetric = 'value';
  /** Toutes les agences : vert = dans le résultat, rouge clignotant = sans opération. */
  @Input() presenceMode = false;
  /** Contour uniforme (ex. jaune). Masque la légende chaleur / présence. */
  @Input() ringColor = '';
  /** Affiche volume / valeur dans le popup. */
  @Input() showActivity = true;
  /** When true, map clicks emit coordinates (edit / place pin). */
  @Input() pickMode = false;
  /**
   * Opt-in Google Maps only. Default false → OpenStreetMap (léger).
   * Pick mode works on OSM; do not force Google.
   */
  @Input() preferGoogle = false;
  @Output() agencyClick = new EventEmitter<number>();
  @Output() locationPick = new EventEmitter<{ lat: number; lng: number }>();

  private readonly gmapsLoader = inject(GoogleMapsLoaderService);
  private readonly zone = inject(NgZone);

  readonly fullscreen = signal(false);
  readonly engine = signal<MapEngine>('leaflet');
  readonly tilesReady = signal(false);
  readonly heatColor = mapHeatColor;

  private leafletMap?: L.Map;
  private leafletTiles?: L.TileLayer;
  private leafletLayer?: L.LayerGroup;
  private googleMap?: google.maps.Map;
  private googleMarkers: google.maps.Marker[] = [];
  private googleInfo?: google.maps.InfoWindow;
  private googleDblClickListener?: google.maps.MapsEventListener;
  private googleClickListener?: google.maps.MapsEventListener;
  private googleCameraListeners: google.maps.MapsEventListener[] = [];
  private leafletClickHandler?: (e: L.LeafletMouseEvent) => void;
  private ready = false;
  private destroyed = false;
  private lastFingerprint = '';
  private sizeTimer?: ReturnType<typeof setTimeout>;
  private readonly sizeKickTimers: ReturnType<typeof setTimeout>[] = [];
  /** After the user pans/zooms, never auto fitBounds again. */
  private userMovedCamera = false;
  private hostObserver?: ResizeObserver;
  /** Reuse hex DivIcons by size bucket (fewer DOM SVG builds). */
  private readonly hexIconCache = new Map<string, L.DivIcon>();
  /** Capture tuiles visibles pendant zoom/pan (évite le flash blanc). */
  private tileFreeze: {
    canvas: HTMLCanvasElement;
    zoom: number;
    center: L.LatLng;
    size: L.Point;
  } | null = null;
  private freezeReleasePending = false;
  private freezeFadeTimer?: ReturnType<typeof setTimeout>;
  private freezeSafetyTimer?: ReturnType<typeof setTimeout>;
  private initialTilesLoaded = false;
  private readonly onTileFreezeLoad = (): void => {
    if (this.freezeReleasePending) this.releaseTileFreeze(true);
  };

  async ngAfterViewInit(): Promise<void> {
    // Dashboard & lecture : OSM. Google uniquement si preferGoogle=true.
    let useGoogle = false;
    if (this.preferGoogle) {
      useGoogle = await this.gmapsLoader.load();
    }
    if (this.destroyed) return;

    await this.whenHostHasSize();
    if (this.destroyed) return;

    this.zone.runOutsideAngular(() => {
      if (useGoogle) {
        this.engine.set('google');
        this.initGoogle();
      } else {
        this.engine.set('leaflet');
        this.initLeaflet();
      }
      this.bindPickListeners();
      this.bindCameraGuards();
      this.ready = true;
      this.renderPoints(true);
    });
    this.observeHost();
    this.kickInvalidateSize([0, 80, 200, 450]);
  }

  /** Attend une largeur/hauteur réelles (modale / @if qui vient d’apparaître). */
  private whenHostHasSize(): Promise<void> {
    const el = this.mapHost?.nativeElement;
    if (!el) return Promise.resolve();
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      return new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.hostObserver?.disconnect();
        resolve();
      };
      if (typeof ResizeObserver !== 'undefined') {
        this.hostObserver?.disconnect();
        this.hostObserver = new ResizeObserver(() => {
          if (el.clientWidth > 0 && el.clientHeight > 0) finish();
        });
        this.hostObserver.observe(el);
      }
      setTimeout(finish, 800);
    });
  }

  private observeHost(): void {
    const el = this.mapHost?.nativeElement;
    if (!el || typeof ResizeObserver === 'undefined') return;
    this.hostObserver?.disconnect();
    let lastW = 0;
    let lastH = 0;
    this.hostObserver = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      const w = Math.round(box?.width ?? el.clientWidth);
      const h = Math.round(box?.height ?? el.clientHeight);
      if (w <= 0 || h <= 0) return;
      if (w === lastW && h === lastH) return;
      lastW = w;
      lastH = h;
      this.scheduleInvalidateSize(50);
    });
    this.hostObserver.observe(el);
    const shell = el.parentElement;
    if (shell) this.hostObserver.observe(shell);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.ready || this.destroyed) return;
    if (changes['height']) {
      this.scheduleInvalidateSize(80);
    }
    if (changes['pickMode']) {
      this.zone.runOutsideAngular(() => this.bindPickListeners());
    }
    if (
      changes['points'] ||
      changes['staticPin'] ||
      changes['pickMode'] ||
      changes['activityMetric'] ||
      changes['presenceMode'] ||
      changes['ringColor'] ||
      changes['showActivity'] ||
      changes['pinIconUrl'] ||
      changes['pinLabel']
    ) {
      this.zone.runOutsideAngular(() => this.renderPoints(false));
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.hostObserver?.disconnect();
    this.hostObserver = undefined;
    this.setBodyScrollLocked(false);
    if (this.sizeTimer != null) {
      clearTimeout(this.sizeTimer);
      this.sizeTimer = undefined;
    }
    for (const t of this.sizeKickTimers) clearTimeout(t);
    this.sizeKickTimers.length = 0;
    this.zone.runOutsideAngular(() => {
      this.clearTileFreeze(true);
      this.clearGoogleMarkers();
      this.unbindPickListeners();
      for (const l of this.googleCameraListeners) {
        google.maps.event.removeListener(l);
      }
      this.googleCameraListeners = [];
      if (this.googleDblClickListener) {
        google.maps.event.removeListener(this.googleDblClickListener);
        this.googleDblClickListener = undefined;
      }
      this.googleMap = undefined;
      this.googleInfo = undefined;
      try {
        this.leafletTiles?.off('load', this.onTileFreezeLoad);
        this.leafletMap?.off();
        this.leafletMap?.remove();
      } catch {
        /* ignore */
      }
      this.leafletMap = undefined;
      this.leafletTiles = undefined;
      this.leafletLayer = undefined;
      this.hexIconCache.clear();
    });
    this.ready = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.fullscreen()) {
      this.setFullscreen(false);
    }
  }

  toggleFullscreen(ev?: Event): void {
    ev?.preventDefault();
    ev?.stopPropagation();
    this.setFullscreen(!this.fullscreen());
  }

  onHostDblClick(ev: MouseEvent): void {
    if (this.pickMode) return;
    const t = ev.target as HTMLElement | null;
    if (t?.closest?.('.geo-hex-icon, .leaflet-marker-icon, .leaflet-popup, .gm-style-iw, .leaflet-control')) {
      return;
    }
    this.toggleFullscreen(ev);
  }

  private initGoogle(): void {
    this.tilesReady.set(false);
    this.googleMap = new google.maps.Map(this.mapHost.nativeElement, {
      center: { lat: -4.325, lng: 15.322 },
      zoom: 5,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: 'greedy',
      scrollwheel: true,
      disableDoubleClickZoom: true,
      clickableIcons: false,
    });
    this.googleInfo = new google.maps.InfoWindow();
    this.googleDblClickListener = this.googleMap.addListener('dblclick', () => {
      if (!this.pickMode) this.zone.run(() => this.toggleFullscreen());
    });
    google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
      this.zone.run(() => this.tilesReady.set(true));
    });
  }

  private initLeaflet(): void {
    this.tilesReady.set(false);
    this.initialTilesLoaded = false;
    const host = this.mapHost.nativeElement;
    this.leafletMap = L.map(host, {
      scrollWheelZoom: true,
      doubleClickZoom: false,
      zoomControl: !this.compactChrome,
      attributionControl: false,
      fadeAnimation: true,
      zoomAnimation: true,
      markerZoomAnimation: false,
    });
    this.patchLeafletIntegerSize(this.leafletMap);
    this.leafletMap.setView([-4.325, 15.322], 5);

    // Pas tile.openstreetmap.org (usage app déconseillé / trous). OSM-FR HOT + secours Esri.
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '',
      subdomains: 'abc',
      updateWhenIdle: false,
      updateWhenZooming: false,
      keepBuffer: 8,
      crossOrigin: true,
    });
    this.leafletTiles = tiles;
    // Overlay « chargement » uniquement au 1er paint — pas à chaque zoom/pan.
    tiles.on('loading', () => {
      if (!this.initialTilesLoaded) this.zone.run(() => this.tilesReady.set(false));
    });
    tiles.on('load', () => {
      this.initialTilesLoaded = true;
      this.zone.run(() => this.tilesReady.set(true));
    });
    tiles.on('load', this.onTileFreezeLoad);
    tiles.on('tileerror', (ev: { tile: HTMLImageElement; coords: L.Coords }) => {
      const img = ev.tile;
      if (!img || img.dataset['retried'] === '1') return;
      img.dataset['retried'] = '1';
      const { z, x, y } = ev.coords;
      // Secours Esri World Street Map (ordre z/y/x).
      img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`;
    });
    tiles.addTo(this.leafletMap);
    this.bindTileFreeze(this.leafletMap, tiles);
    // Cache navigateur / tuiles déjà prêtes : ne pas bloquer le fondu.
    setTimeout(() => {
      if (!this.destroyed && !this.tilesReady()) {
        this.initialTilesLoaded = true;
        this.zone.run(() => this.tilesReady.set(true));
      }
    }, 1500);

    this.leafletLayer = L.layerGroup().addTo(this.leafletMap);
  }

  /** Gel de la vue courante pendant zoom/pan : capture canvas des tuiles déjà CORS. */
  private bindTileFreeze(map: L.Map, tiles: L.TileLayer): void {
    map.on('zoomstart dragstart', () => {
      this.freezeReleasePending = false;
      if (this.freezeFadeTimer != null) {
        clearTimeout(this.freezeFadeTimer);
        this.freezeFadeTimer = undefined;
      }
      if (this.freezeSafetyTimer != null) {
        clearTimeout(this.freezeSafetyTimer);
        this.freezeSafetyTimer = undefined;
      }
      if (this.tileFreeze) {
        this.tileFreeze.canvas.classList.remove('geo-map-tile-freeze--out');
        this.syncTileFreezeTransform(map);
        return;
      }
      this.ensureTileFreeze(map);
    });
    map.on('zoom move', () => this.syncTileFreezeTransform(map));
    map.on('zoomend moveend', () => this.scheduleTileFreezeRelease(map, tiles));
  }

  private ensureTileFreeze(map: L.Map): void {
    if (this.destroyed || this.tileFreeze) return;
    const canvas = this.captureVisibleTiles(map);
    if (!canvas) return;
    canvas.className = 'geo-map-tile-freeze';
    const size = map.getSize();
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;
    map.getContainer().appendChild(canvas);
    this.tileFreeze = {
      canvas,
      zoom: map.getZoom(),
      center: map.getCenter(),
      size,
    };
    this.syncTileFreezeTransform(map);
  }

  private captureVisibleTiles(map: L.Map): HTMLCanvasElement | null {
    const size = map.getSize();
    if (size.x < 2 || size.y < 2) return null;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(size.x));
    canvas.height = Math.max(1, Math.floor(size.y));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#e8eef5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const hostRect = map.getContainer().getBoundingClientRect();
    const imgs = map.getPane('tilePane')?.querySelectorAll('img.leaflet-tile');
    if (!imgs?.length) return null;
    let drawn = 0;
    for (const node of Array.from(imgs)) {
      const img = node as HTMLImageElement;
      if (!img.complete || img.naturalWidth === 0) continue;
      const r = img.getBoundingClientRect();
      try {
        ctx.drawImage(img, r.left - hostRect.left, r.top - hostRect.top, r.width, r.height);
        drawn++;
      } catch {
        /* tuile non dessinable (CORS) — on ignore */
      }
    }
    return drawn > 0 ? canvas : null;
  }

  private syncTileFreezeTransform(map: L.Map): void {
    const freeze = this.tileFreeze;
    if (!freeze || this.destroyed) return;
    const scale = Math.pow(2, map.getZoom() - freeze.zoom);
    const centerPt = map.latLngToContainerPoint(freeze.center);
    const tx = centerPt.x - (freeze.size.x / 2) * scale;
    const ty = centerPt.y - (freeze.size.y / 2) * scale;
    freeze.canvas.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  private scheduleTileFreezeRelease(map: L.Map, _tiles: L.TileLayer): void {
    if (!this.tileFreeze || this.destroyed) return;
    this.freezeReleasePending = true;
    this.syncTileFreezeTransform(map);
    if (this.freezeSafetyTimer != null) clearTimeout(this.freezeSafetyTimer);
    // Tuiles encore en vol → attendre 'load' ; sinon fondu immédiat.
    const stillLoading = !!(this.leafletTiles as L.TileLayer & { _loading?: boolean })?._loading;
    if (!stillLoading) {
      this.releaseTileFreeze(true);
      return;
    }
    this.freezeSafetyTimer = setTimeout(() => {
      this.freezeSafetyTimer = undefined;
      if (this.freezeReleasePending) this.releaseTileFreeze(true);
    }, 900);
  }

  private releaseTileFreeze(fade: boolean): void {
    if (!this.tileFreeze) {
      this.freezeReleasePending = false;
      return;
    }
    this.freezeReleasePending = false;
    if (this.freezeSafetyTimer != null) {
      clearTimeout(this.freezeSafetyTimer);
      this.freezeSafetyTimer = undefined;
    }
    const canvas = this.tileFreeze.canvas;
    if (!fade) {
      this.clearTileFreeze(true);
      return;
    }
    canvas.classList.add('geo-map-tile-freeze--out');
    if (this.freezeFadeTimer != null) clearTimeout(this.freezeFadeTimer);
    this.freezeFadeTimer = setTimeout(() => {
      this.freezeFadeTimer = undefined;
      // Nouveau geste pendant le fade : ne pas détruire si un autre freeze a pris le relais.
      if (this.tileFreeze?.canvas === canvas) {
        this.clearTileFreeze(true);
      } else {
        canvas.remove();
      }
    }, 300);
  }

  private clearTileFreeze(removeDom: boolean): void {
    if (this.freezeFadeTimer != null) {
      clearTimeout(this.freezeFadeTimer);
      this.freezeFadeTimer = undefined;
    }
    if (this.freezeSafetyTimer != null) {
      clearTimeout(this.freezeSafetyTimer);
      this.freezeSafetyTimer = undefined;
    }
    this.freezeReleasePending = false;
    const freeze = this.tileFreeze;
    this.tileFreeze = null;
    if (freeze && removeDom) {
      try {
        freeze.canvas.remove();
      } catch {
        /* ignore */
      }
      freeze.canvas.width = 0;
      freeze.canvas.height = 0;
    }
  }

  private bindCameraGuards(): void {
    if (this.googleMap) {
      const mark = () => {
        this.userMovedCamera = true;
      };
      this.googleCameraListeners.push(
        this.googleMap.addListener('dragstart', mark),
        this.googleMap.addListener('zoom_changed', mark)
      );
    }
    if (this.leafletMap) {
      this.leafletMap.on('dragstart zoomstart', () => {
        this.userMovedCamera = true;
      });
    }
  }

  private bindPickListeners(): void {
    this.unbindPickListeners();
    if (!this.pickMode) return;

    if (this.googleMap) {
      this.googleClickListener = this.googleMap.addListener('click', (e: google.maps.MapMouseEvent) => {
        const lat = e.latLng?.lat();
        const lng = e.latLng?.lng();
        if (lat == null || lng == null) return;
        this.zone.run(() => this.locationPick.emit({ lat, lng }));
      });
      this.googleMap.setOptions({ draggableCursor: 'crosshair' });
    }

    if (this.leafletMap) {
      this.leafletClickHandler = (e: L.LeafletMouseEvent) => {
        this.zone.run(() => this.locationPick.emit({ lat: e.latlng.lat, lng: e.latlng.lng }));
      };
      this.leafletMap.on('click', this.leafletClickHandler);
    }
  }

  private unbindPickListeners(): void {
    if (this.googleClickListener) {
      google.maps.event.removeListener(this.googleClickListener);
      this.googleClickListener = undefined;
    }
    if (this.googleMap) {
      try {
        this.googleMap.setOptions({ draggableCursor: '' });
      } catch {
        /* ignore */
      }
    }
    if (this.leafletMap && this.leafletClickHandler) {
      this.leafletMap.off('click', this.leafletClickHandler);
      this.leafletClickHandler = undefined;
    }
  }

  private setFullscreen(on: boolean): void {
    this.fullscreen.set(on);
    this.setBodyScrollLocked(on);
    this.leafletMap?.scrollWheelZoom.enable();
    this.googleMap?.setOptions({ scrollwheel: true });
    this.scheduleInvalidateSize(100);
    this.scheduleInvalidateSize(250);
  }

  private setBodyScrollLocked(locked: boolean): void {
    document.body.style.overflow = locked ? 'hidden' : '';
  }

  private renderPoints(force: boolean): void {
    if (this.destroyed) return;
    const pts = (this.points || []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    const fingerprint = `${this.engine()}|${this.staticPin ? 1 : 0}|${this.pinIconUrl}|${this.pinLabel}|${this.activityMetric}|${this.presenceMode ? 1 : 0}|${this.ringColor}|${this.showActivity ? 1 : 0}|${pts
      .map((p) => {
        const act = pointActivity(p, this.activityMetric);
        return `${p.agency_id}:${p.lat.toFixed(5)}:${p.lng.toFixed(5)}:${Math.round(act)}:${p.presence ?? ''}`;
      })
      .join(';')}`;
    if (!force && fingerprint === this.lastFingerprint) {
      return;
    }
    this.lastFingerprint = fingerprint;

    // Keep camera stable: pick mode, or after the user has already moved the map.
    const preserveCamera = (this.pickMode && !force) || (!force && this.userMovedCamera);

    try {
      if (this.engine() === 'google' && this.googleMap) {
        this.renderGooglePoints(pts, preserveCamera);
      } else if (this.leafletMap && this.leafletLayer) {
        this.renderLeafletPoints(pts, preserveCamera);
      }
    } catch (err) {
      console.warn('[geo-map] render failed', err);
    }
  }

  private renderGooglePoints(pts: GeoPoint[], preserveCamera: boolean): void {
    if (!this.googleMap) return;
    this.clearGoogleMarkers();
    if (!pts.length) {
      if (!preserveCamera) {
        this.googleMap.setCenter({ lat: -4.325, lng: 15.322 });
        this.googleMap.setZoom(5);
      }
      return;
    }

    const sorted = this.presenceMode ? pts : sortPointsByActivity(pts, this.activityMetric);
    const acts = sorted.map((p) => pointActivity(p, this.activityMetric));
    const minAct = acts.length ? Math.min(...acts) : 0;
    const maxAct = acts.length ? Math.max(...acts) : 0;
    const bounds = new google.maps.LatLngBounds();

    for (const p of sorted) {
      const activity = pointActivity(p, this.activityMetric);
      const intensity = heatIntensity(activity, minAct, maxAct);
      const missing = this.isMissing(p);
      const ring = this.markerRing(p, intensity);
      // Google : logo seul en pin fixe ; multi → hex chauffé (SVG data-URL + image externe fragile).
      const brand = this.staticPin ? this.brandPinFor(p, ring, missing) : null;
      let icon: google.maps.Icon | google.maps.Symbol | undefined;
      if (brand) {
        icon = {
          url: brand.url,
          scaledSize: new google.maps.Size(36, 36),
          anchor: new google.maps.Point(18, 18),
        };
      } else {
        const radius = this.ringColor ? 12 : this.presenceMode ? 12 : this.staticPin ? 14 : 6 + Math.sqrt(intensity) * 18;
        const width = Math.max(12, Math.round(radius * 2 / 2) * 2);
        const height = Math.max(10, Math.round(width * (Math.sqrt(3) / 2)));
        const fill = this.markerFill(p, intensity);
        const stroke = this.markerStroke(p, intensity);
        icon = {
          url: hexIconDataUrl(width, height, fill, 0.88, stroke),
          scaledSize: new google.maps.Size(width, height),
          anchor: new google.maps.Point(width / 2, height / 2),
        };
      }
      const marker = new google.maps.Marker({
        map: this.googleMap,
        position: { lat: p.lat, lng: p.lng },
        optimized: !brand,
        zIndex: missing ? 2000 : Math.round(intensity * 1000),
        icon,
        title: p.label,
        animation: missing ? google.maps.Animation.BOUNCE : undefined,
      });
      if (!this.staticPin) {
        marker.addListener('click', () => {
          this.googleInfo?.setContent(
            `<div style="min-width:10rem"><strong>${escapeHtml(p.label)}</strong><br/>` +
              `<small>${escapeHtml(p.code)}</small><br/>` +
              this.popupBody(p) +
              `</div>`
          );
          this.googleInfo?.open({ map: this.googleMap, anchor: marker });
          this.zone.run(() => this.agencyClick.emit(p.agency_id));
        });
      }
      this.googleMarkers.push(marker);
      bounds.extend({ lat: p.lat, lng: p.lng });
    }

    if (preserveCamera) return;

    if (pts.length === 1) {
      this.googleMap.setCenter({ lat: pts[0].lat, lng: pts[0].lng });
      this.googleMap.setZoom(this.staticPin ? 16 : 13);
    } else {
      this.googleMap.fitBounds(bounds, 48);
    }
  }

  private renderLeafletPoints(pts: GeoPoint[], preserveCamera: boolean): void {
    if (!this.leafletMap || !this.leafletLayer) return;
    this.leafletLayer.clearLayers();
    if (!pts.length) {
      if (!preserveCamera) {
        this.leafletMap.setView([-4.325, 15.322], 5);
      }
      return;
    }

    const sorted = this.presenceMode ? pts : sortPointsByActivity(pts, this.activityMetric);
    const acts = sorted.map((p) => pointActivity(p, this.activityMetric));
    const minAct = acts.length ? Math.min(...acts) : 0;
    const maxAct = acts.length ? Math.max(...acts) : 0;
    const bounds = L.latLngBounds([]);

    for (const p of sorted) {
      const activity = pointActivity(p, this.activityMetric);
      const intensity = heatIntensity(activity, minAct, maxAct);
      const missing = this.isMissing(p);
      const ring = this.markerRing(p, intensity);
      const brand = this.brandPinFor(p, ring, missing);
      const icon = brand
        ? this.getBrandDivIcon(brand)
        : (() => {
            const radius = this.ringColor ? 12 : this.presenceMode ? 12 : this.staticPin ? 14 : 6 + Math.sqrt(intensity) * 18;
            const width = Math.max(12, Math.round(radius * 2 / 2) * 2);
            const height = Math.max(10, Math.round(width * (Math.sqrt(3) / 2)));
            const fill = this.markerFill(p, intensity);
            const stroke = this.markerStroke(p, intensity);
            return this.getHexDivIcon(width, height, fill, stroke, missing);
          })();
      const marker = L.marker([p.lat, p.lng], {
        icon,
        riseOnHover: false,
        keyboard: false,
        zIndexOffset: missing ? 1000 : 0,
      });
      if (!this.staticPin) {
        marker.bindPopup(
          `<strong>${escapeHtml(p.label)}</strong><br/>` +
            `<small>${escapeHtml(p.code)}</small><br/>` +
            this.popupBody(p)
        );
        marker.on('click', () => this.zone.run(() => this.agencyClick.emit(p.agency_id)));
      }
      marker.addTo(this.leafletLayer);
      bounds.extend([p.lat, p.lng]);
    }

    if (preserveCamera || !bounds.isValid()) return;

    if (pts.length === 1) {
      this.leafletMap.setView([pts[0].lat, pts[0].lng], this.staticPin ? 16 : 13, { animate: false });
    } else {
      this.leafletMap.fitBounds(bounds.pad(0.2), { maxZoom: 12, animate: false });
    }
    if (this.compactChrome || this.staticPin) {
      this.kickInvalidateSize([0, 60, 180, 400]);
    }
  }

  private clearGoogleMarkers(): void {
    for (const m of this.googleMarkers) {
      try {
        google.maps.event.clearInstanceListeners(m);
        m.setMap(null);
      } catch {
        /* ignore */
      }
    }
    this.googleMarkers = [];
    try {
      this.googleInfo?.close();
    } catch {
      /* ignore */
    }
  }

  private getHexDivIcon(
    width: number,
    height: number,
    fill: string,
    stroke: string,
    missing = false
  ): L.DivIcon {
    const key = `${width}x${height}:${fill}:${stroke}:${missing ? 1 : 0}`;
    let icon = this.hexIconCache.get(key);
    if (!icon) {
      icon = L.divIcon({
        className: missing ? 'geo-hex-icon geo-hex-icon--missing' : 'geo-hex-icon',
        iconSize: [width, height],
        iconAnchor: [width / 2, height / 2],
        html: flatTopHexSvg(width, height, fill, 0.88, stroke),
      });
      this.hexIconCache.set(key, icon);
    }
    return icon;
  }

  private brandPinFor(point: GeoPoint, ringColor: string, missing = false): BrandPinSpec | null {
    if (!this.pinIconUrl) return null;
    if (this.staticPin) {
      const label = (this.pinLabel || point.label || point.code || '').trim();
      const width = 176;
      const height = label ? 78 : 42;
      return {
        url: this.pinIconUrl,
        label,
        width,
        height,
        anchorX: width / 2,
        anchorY: 21,
        ringColor,
        compact: false,
        missing: false,
      };
    }
    // Multi-agences : logo compact, contour chauffé min→max.
    return {
      url: this.pinIconUrl,
      label: '',
      width: 36,
      height: 36,
      anchorX: 18,
      anchorY: 18,
      ringColor,
      compact: true,
      missing,
    };
  }

  private getBrandDivIcon(spec: BrandPinSpec): L.DivIcon {
    const key = `brand:${spec.url}:${spec.label}:${spec.width}x${spec.height}:${spec.ringColor}:${spec.compact}:${spec.missing ? 1 : 0}`;
    let icon = this.hexIconCache.get(key);
    if (!icon) {
      const compactClass = spec.compact ? ' geo-brand-pin--compact' : '';
      const missingClass = spec.missing ? ' geo-brand-pin--missing' : '';
      icon = L.divIcon({
        className: 'geo-brand-pin-icon',
        iconSize: [spec.width, spec.height],
        iconAnchor: [spec.anchorX, spec.anchorY],
        html:
          `<div class="geo-brand-pin${compactClass}${missingClass}">` +
          `<div class="geo-brand-pin__mark" style="border-color:${escapeHtml(spec.ringColor)}">` +
          `<img src="${escapeHtml(spec.url)}" alt="" /></div>` +
          (spec.label ? `<div class="geo-brand-pin__label">${escapeHtml(spec.label)}</div>` : '') +
          `</div>`,
      });
      this.hexIconCache.set(key, icon);
    }
    return icon;
  }

  private isMissing(p: GeoPoint): boolean {
    return this.presenceMode && p.presence === 'missing';
  }

  private markerRing(p: GeoPoint, intensity: number): string {
    if (this.ringColor) return this.ringColor;
    if (this.presenceMode) return this.isMissing(p) ? '#dc2626' : '#16a34a';
    return this.staticPin ? '#ffd500' : mapHeatStrokeColor(intensity);
  }

  private markerFill(p: GeoPoint, intensity: number): string {
    if (this.ringColor) return this.ringColor;
    if (this.presenceMode) return this.isMissing(p) ? '#ef4444' : '#22c55e';
    return this.staticPin ? '#ffd500' : mapHeatColor(intensity);
  }

  private markerStroke(p: GeoPoint, intensity: number): string {
    if (this.ringColor) return '#1a1a1a';
    if (this.presenceMode) return this.isMissing(p) ? '#991b1b' : '#166534';
    return this.staticPin ? '#1a1a1a' : mapHeatStrokeColor(intensity);
  }

  private popupBody(p: GeoPoint): string {
    if (!this.showActivity) {
      const addr = (p.address || p.city || '').trim();
      return addr ? escapeHtml(addr) : '';
    }
    const status = this.presenceMode
      ? this.isMissing(p)
        ? 'Sans opération sur la période<br/>'
        : 'Dans le résultat<br/>'
      : '';
    return (
      status +
      `Volume ${formatNumberFr(p.tx_count)} · Valeur ${escapeHtml(formatValeurFr(p.volume, p.currency))}`
    );
  }

  private scheduleInvalidateSize(delay = 100): void {
    if (this.sizeTimer != null) clearTimeout(this.sizeTimer);
    this.sizeTimer = setTimeout(() => {
      this.sizeTimer = undefined;
      if (this.destroyed) return;
      this.zone.runOutsideAngular(() => this.refreshMapSize());
    }, delay);
  }

  /** Plusieurs passes après ouverture d’une modale (scrollbar, layout, DPR). */
  private kickInvalidateSize(delays: number[]): void {
    for (const t of this.sizeKickTimers) clearTimeout(t);
    this.sizeKickTimers.length = 0;
    for (const delay of delays) {
      this.sizeKickTimers.push(
        setTimeout(() => {
          if (this.destroyed) return;
          this.zone.runOutsideAngular(() => this.refreshMapSize());
        }, delay)
      );
    }
  }

  /** Recalcule le viewport Leaflet et force le rechargement des tuiles manquantes. */
  private refreshMapSize(): void {
    try {
      if (this.leafletMap) {
        const host = this.mapHost?.nativeElement;
        if (host && (host.clientWidth <= 0 || host.clientHeight <= 0)) return;
        this.leafletMap.invalidateSize({ animate: false, pan: false });
        if (this.staticPin && this.points.length === 1) {
          const pin = this.points[0];
          this.leafletMap.setView([pin.lat, pin.lng], 16, { animate: false });
        } else {
          const center = this.leafletMap.getCenter();
          const zoom = this.leafletMap.getZoom();
          this.leafletMap.setView(center, zoom, { animate: false });
        }
        // Force le recalcul des tuiles visibles (invalidateSize seul ne suffit pas toujours).
        this.leafletTiles?.redraw();
        (this.leafletMap as L.Map & { _onResize?: () => void })._onResize?.();
      }
    } catch {
      /* ignore */
    }
    if (this.googleMap) {
      try {
        const c = this.googleMap.getCenter();
        google.maps.event.trigger(this.googleMap, 'resize');
        if (c) this.googleMap.setCenter(c);
      } catch {
        /* ignore */
      }
    }
  }

  /** Évite les tailles fractionnaires qui font sauter des colonnes de tuiles. */
  private patchLeafletIntegerSize(map: L.Map): void {
    const protoGetSize = map.getSize.bind(map);
    map.getSize = () => {
      const size = protoGetSize();
      return L.point(Math.max(1, Math.floor(size.x)), Math.max(1, Math.floor(size.y)));
    };
  }
}

type BrandPinSpec = {
  url: string;
  label: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  ringColor: string;
  compact: boolean;
  missing: boolean;
};

function pointActivity(p: GeoPoint, metric: HeatMetric): number {
  return metric === 'volume' ? p.tx_count || 0 : p.volume || 0;
}

function sortPointsByActivity(pts: GeoPoint[], metric: HeatMetric): GeoPoint[] {
  return [...pts].sort(
    (a, b) => pointActivity(a, metric) - pointActivity(b, metric)
  );
}

function flatTopHexSvg(
  w: number,
  h: number,
  fill = '#ffd500',
  fillOpacity = 0.75,
  stroke = '#1a1a1a'
): string {
  const points = [
    [w * 0.25, 0],
    [w * 0.75, 0],
    [w, h * 0.5],
    [w * 0.75, h],
    [w * 0.25, h],
    [0, h * 0.5],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(' ');
  return (
    `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">` +
    `<polygon points="${points}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="1" stroke-linejoin="miter"/>` +
    `</svg>`
  );
}

function hexIconDataUrl(
  w: number,
  h: number,
  fill = '#ffd500',
  fillOpacity = 0.75,
  stroke = '#1a1a1a'
): string {
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(flatTopHexSvg(w, h, fill, fillOpacity, stroke));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
