import { ChartConfiguration, ChartDataset, TooltipItem } from 'chart.js';
import { ThemeMode } from '../../core/services/theme.service';
import {
  PilotageProductSlice,
  PilotageProductTimeseriesPoint,
  PilotageTimeseriesPoint,
} from '../../core/models/pilotage.models';
import { formatNumberFr, formatValeurFr } from '../../shared/utils/format.utils';
import { pilotageProduitLabel } from './pilotage-filtres.config';

const FLASH_YELLOW = '#ffd500';
const FLASH_BLACK = '#111111';
const VOLUME_CORAL = '#EF4444';
const GRID_LIGHT = 'rgba(0, 0, 0, 0.06)';

const DONUT_LIGHT = [
  FLASH_YELLOW,
  FLASH_BLACK,
  '#6b7280',
  '#f59e0b',
  '#374151',
  '#fcd34d',
  '#9ca3af',
  '#d97706',
];

const DONUT_DARK = [
  FLASH_YELLOW,
  '#facc15',
  '#fde047',
  '#ca8a04',
  '#eab308',
  '#a16207',
  '#854d0e',
  '#713f12',
];

/** Une couleur par barre produit (top 10). */
const BAR_LIGHT = [
  FLASH_YELLOW,
  FLASH_BLACK,
  '#6b7280',
  '#f59e0b',
  '#374151',
  VOLUME_CORAL,
  '#fcd34d',
  '#9ca3af',
  '#d97706',
  '#52525b',
];

const BAR_DARK = [
  FLASH_YELLOW,
  '#facc15',
  '#fde047',
  '#ca8a04',
  VOLUME_CORAL,
  '#eab308',
  '#a16207',
  '#854d0e',
  '#713f12',
  '#fbbf24',
];

/** Courbes produits : contrastées clair / sombre, légende cliquable. */
const PRODUCT_LINE_LIGHT = [
  '#ca8a04',
  '#111111',
  '#2563eb',
  '#dc2626',
  '#7c3aed',
  '#059669',
  '#ea580c',
  '#db2777',
];

const PRODUCT_LINE_DARK = [
  '#ffd500',
  '#38bdf8',
  '#f87171',
  '#a78bfa',
  '#34d399',
  '#fb923c',
  '#f472b6',
  '#fde047',
];

export type PilotageSeriesGranularity = 'day' | 'week' | 'month';

function formatDayLabel(iso: string): string {
  const p = (iso || '').split('-');
  if (p.length !== 3) return iso;
  return `${p[2]}/${p[1]}`;
}

function parseIsoDate(iso: string): Date | null {
  const p = (iso || '').split('-');
  if (p.length !== 3) return null;
  const y = Number(p[0]);
  const m = Number(p[1]) - 1;
  const d = Number(p[2]);
  if (!y || m < 0 || !d) return null;
  return new Date(y, m, d);
}

function isoWeekKey(iso: string): string {
  const dt = parseIsoDate(iso);
  if (!dt) return iso;
  const day = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - day + 3);
  const week1 = new Date(dt.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(
      ((dt.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    );
  return `${dt.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function formatSeriesBucketLabel(key: string, granularity: PilotageSeriesGranularity): string {
  if (granularity === 'day') {
    return formatDayLabel(key);
  }
  if (granularity === 'month') {
    const p = key.split('-');
    if (p.length >= 2) return `${p[1]}/${p[0]}`;
    return key;
  }
  const m = key.match(/^(\d{4})-W(\d{2})$/);
  if (m) return `S${m[2]} ${m[1]}`;
  return key;
}

export function aggregatePilotageTimeseries(
  points: PilotageTimeseriesPoint[],
  granularity: PilotageSeriesGranularity
): PilotageTimeseriesPoint[] {
  if (granularity === 'day' || !points.length) {
    return points;
  }
  const buckets = new Map<string, { volume: number; montant: number; sort: string }>();
  for (const p of points) {
    const key =
      granularity === 'week'
        ? isoWeekKey(p.jour)
        : `${(p.jour || '').slice(0, 7)}-01`;
    const sortKey = granularity === 'week' ? key : (p.jour || '').slice(0, 7);
    const prev = buckets.get(key);
    if (prev) {
      prev.volume += Number(p.volume) || 0;
      prev.montant += Number(p.montant) || 0;
    } else {
      buckets.set(key, {
        volume: Number(p.volume) || 0,
        montant: Number(p.montant) || 0,
        sort: sortKey,
      });
    }
  }
  return [...buckets.entries()]
    .sort((a, b) => a[1].sort.localeCompare(b[1].sort))
    .map(([key, v]) => ({
      jour: key,
      volume: v.volume,
      montant: v.montant,
    }));
}

export type PilotageSeriesVisibility = {
  montant: boolean;
  volume: boolean;
};

function hasVolumeSeries(points: PilotageTimeseriesPoint[]): boolean {
  return points.some((p) => p.volume != null && Number.isFinite(Number(p.volume)));
}

export function buildPilotageSeriesChart(
  points: PilotageTimeseriesPoint[],
  devise: string,
  visibility: PilotageSeriesVisibility,
  theme: ThemeMode,
  granularity: PilotageSeriesGranularity = 'day'
): ChartConfiguration {
  const series = aggregatePilotageTimeseries(points, granularity);
  const labels = series.map((p) => formatSeriesBucketLabel(p.jour, granularity));
  const showMontant = visibility.montant !== false;
  const volumeAvailable = hasVolumeSeries(series);
  const showVolume = visibility.volume !== false && volumeAvailable;

  const dark = theme === 'dark';
  const montantBorder = dark ? FLASH_YELLOW : FLASH_BLACK;
  const montantFill = dark ? 'rgba(255, 213, 0, 0.22)' : 'rgba(255, 213, 0, 0.25)';
  const gridColor = dark ? 'rgba(255, 213, 0, 0.08)' : GRID_LIGHT;
  const tickColor = dark ? '#d1d5db' : '#374151';
  const pointRadius = series.length > 45 ? 0 : series.length > 20 ? 1 : 2;
  const volumePointRadius = series.length > 45 ? 0 : series.length > 20 ? 1 : 2;

  const datasets: ChartDataset<'line'>[] = [];
  if (showMontant) {
    datasets.push({
      label: `Montant (${devise})`,
      data: series.map((p) => Number(p.montant) || 0),
      borderColor: montantBorder,
      backgroundColor: montantFill,
      fill: true,
      tension: 0.22,
      pointRadius,
      pointHoverRadius: 4,
      pointBackgroundColor: montantBorder,
      borderWidth: 2,
      yAxisID: 'y',
      order: 2,
    });
  }
  if (showVolume) {
    datasets.push({
      label: 'Volume (opérations)',
      data: series.map((p) => Number(p.volume) || 0),
      borderColor: VOLUME_CORAL,
      backgroundColor: 'transparent',
      fill: false,
      tension: 0.22,
      pointRadius: volumePointRadius,
      pointHoverRadius: 4,
      pointBackgroundColor: VOLUME_CORAL,
      pointBorderColor: VOLUME_CORAL,
      borderWidth: 1.5,
      yAxisID: 'y1',
      order: 1,
    });
  }

  return {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: datasets.length > 0,
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            font: { size: 10 },
            color: dark ? '#f3f4f6' : '#111111',
            usePointStyle: true,
            pointStyle: 'circle',
          },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            title(items: TooltipItem<'line'>[]) {
              return items[0]?.label ?? '';
            },
            label(item: TooltipItem<'line'>) {
              const raw = Number(item.parsed.y);
              if (!Number.isFinite(raw)) return `${item.dataset.label} : —`;
              if (item.dataset.yAxisID === 'y1') {
                return `Volume : ${formatNumberFr(Math.round(raw), { maximumFractionDigits: 0 })}`;
              }
              return `Montant : ${formatValeurFr(raw, devise)}`;
            },
            afterBody() {
              if (visibility.volume && !volumeAvailable) {
                return ['Volume : données absentes'];
              }
              return [];
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12,
            font: { size: 10 },
            color: tickColor,
          },
        },
        y: {
          display: showMontant,
          position: 'left',
          grid: { color: gridColor },
          ticks: {
            font: { size: 10 },
            color: tickColor,
            callback(value) {
              const n = Number(value);
              if (!Number.isFinite(n)) return '';
              return formatNumberFr(n, {
                notation: Math.abs(n) >= 10_000 ? 'compact' : 'standard',
                maximumFractionDigits: Math.abs(n) >= 10_000 ? 1 : 0,
              });
            },
          },
          title: {
            display: showMontant,
            text: `Montant (${devise})`,
            color: tickColor,
            font: { size: 10, weight: 500 },
          },
        },
        y1: {
          display: showVolume,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: {
            font: { size: 10 },
            color: tickColor,
            callback(value) {
              const n = Number(value);
              if (!Number.isFinite(n)) return '';
              return formatNumberFr(Math.round(n), {
                notation: Math.abs(n) >= 10_000 ? 'compact' : 'standard',
                maximumFractionDigits: 0,
              });
            },
          },
          title: {
            display: showVolume,
            text: 'Volume',
            color: VOLUME_CORAL,
            font: { size: 10, weight: 500 },
          },
        },
      },
    },
  };
}

export function buildPilotageProductDonut(
  products: PilotageProductSlice[],
  theme: ThemeMode
): ChartConfiguration {
  const top = products.slice(0, 8);
  const labels = top.map((p) => productLabel(p));
  const values = top.map((p) => Number(p.montant) || 0);
  const dark = theme === 'dark';

  return {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: dark ? DONUT_DARK : DONUT_LIGHT,
          borderWidth: 1,
          borderColor: dark ? '#1e1e1e' : '#fff',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 10,
            font: { size: 10 },
            color: dark ? '#f3f4f6' : '#111111',
          },
        },
      },
    },
  };
}

export function buildPilotageProductBar(
  products: PilotageProductSlice[],
  theme: ThemeMode
): ChartConfiguration {
  const top = products.slice(0, 10);
  const dark = theme === 'dark';
  const palette = dark ? BAR_DARK : BAR_LIGHT;
  const colors = top.map((_, i) => palette[i % palette.length]!);

  return {
    type: 'bar',
    data: {
      labels: top.map((p) => productLabel(p)),
      datasets: [
        {
          label: 'Montant',
          data: top.map((p) => Number(p.montant) || 0),
          backgroundColor: colors,
          borderColor: dark ? colors.map((c) => c) : colors.map((c) => (c === FLASH_YELLOW ? FLASH_BLACK : c)),
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { color: dark ? 'rgba(255, 213, 0, 0.08)' : GRID_LIGHT },
          ticks: { font: { size: 10 }, color: dark ? '#d1d5db' : '#374151' },
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 10 }, color: dark ? '#d1d5db' : '#374151' },
        },
      },
    },
  };
}

/**
 * Courbes montant par produit (top 8), style proche de l’évolution globale.
 * Légende Chart.js : clic pour activer / désactiver une série.
 */
export function buildPilotageProductLinesChart(
  points: PilotageProductTimeseriesPoint[],
  devise: string,
  theme: ThemeMode,
  granularity: PilotageSeriesGranularity = 'day'
): ChartConfiguration | null {
  if (!points.length) return null;

  const metaById = new Map<number, PilotageProductTimeseriesPoint>();
  for (const p of points) {
    if (!metaById.has(p.produitId)) metaById.set(p.produitId, p);
  }
  const productIds = [...metaById.keys()];
  if (!productIds.length) return null;

  const buckets = new Map<string, Map<number, number>>();
  const ensureBucket = (key: string) => {
    let m = buckets.get(key);
    if (!m) {
      m = new Map();
      buckets.set(key, m);
    }
    return m;
  };

  for (const p of points) {
    let key = p.jour;
    if (granularity === 'week') key = isoWeekKey(p.jour) || p.jour;
    else if (granularity === 'month') key = (p.jour || '').slice(0, 7) || p.jour;
    const m = ensureBucket(key);
    m.set(p.produitId, (m.get(p.produitId) ?? 0) + (Number(p.montant) || 0));
  }

  const keys = [...buckets.keys()].sort();
  const labels = keys.map((k) => formatSeriesBucketLabel(k, granularity));
  const dark = theme === 'dark';
  const palette = dark ? PRODUCT_LINE_DARK : PRODUCT_LINE_LIGHT;
  const gridColor = dark ? 'rgba(255, 213, 0, 0.08)' : GRID_LIGHT;
  const tickColor = dark ? '#d1d5db' : '#374151';
  const pointRadius = keys.length > 45 ? 0 : keys.length > 20 ? 1 : 2;

  const datasets: ChartDataset<'line'>[] = productIds.map((id, i) => {
    const meta = metaById.get(id)!;
    const color = palette[i % palette.length]!;
    return {
      label: productLabel(meta),
      data: keys.map((k) => buckets.get(k)?.get(id) ?? 0),
      borderColor: color,
      backgroundColor: color,
      fill: false,
      tension: 0.22,
      pointRadius,
      pointHoverRadius: 4,
      pointBackgroundColor: color,
      pointBorderColor: color,
      borderWidth: 2,
      spanGaps: true,
    };
  });

  return {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          align: 'start',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            font: { size: 10 },
            color: dark ? '#f3f4f6' : '#111111',
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 10,
          },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label(item: TooltipItem<'line'>) {
              const raw = Number(item.parsed.y);
              if (!Number.isFinite(raw)) return `${item.dataset.label} : —`;
              return `${item.dataset.label} : ${formatValeurFr(raw, devise)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 12,
            font: { size: 10 },
            color: tickColor,
          },
        },
        y: {
          position: 'left',
          grid: { color: gridColor },
          ticks: {
            font: { size: 10 },
            color: tickColor,
            callback(value) {
              const n = Number(value);
              if (!Number.isFinite(n)) return '';
              return formatNumberFr(n, {
                notation: Math.abs(n) >= 10_000 ? 'compact' : 'standard',
                maximumFractionDigits: Math.abs(n) >= 10_000 ? 1 : 0,
              });
            },
          },
          title: {
            display: true,
            text: `Montant (${devise})`,
            color: tickColor,
            font: { size: 10, weight: 500 },
          },
        },
      },
    },
  };
}

function productLabel(p: Pick<PilotageProductSlice, 'module' | 'produit' | 'ecran' | 'partenaire' | 'produitId'>): string {
  return pilotageProduitLabel(p.module, p.produit, p.ecran, p.partenaire) || `#${p.produitId}`;
}
