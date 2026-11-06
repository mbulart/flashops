/** Pale yellow → brand yellow → orange (légendes / échelles secondaires). */
const HEAT_STOPS: [number, number, number][] = [
  [255, 243, 176],
  [255, 213, 0],
  [249, 115, 22],
];

export type HeatMetric = 'value' | 'volume';
export type MapMetric = HeatMetric | 'presence';

export function heatColor(intensity: number): string {
  const x = Math.min(1, Math.max(0, intensity));
  const seg = x < 0.5 ? 0 : 1;
  const local = x < 0.5 ? x * 2 : (x - 0.5) * 2;
  const a = HEAT_STOPS[seg];
  const b = HEAT_STOPS[seg + 1];
  const r = Math.round(a[0] + (b[0] - a[0]) * local);
  const g = Math.round(a[1] + (b[1] - a[1]) * local);
  const bl = Math.round(a[2] + (b[2] - a[2]) * local);
  return `rgb(${r}, ${g}, ${bl})`;
}

export function heatStrokeColor(intensity: number): string {
  return intensity >= 0.55 ? '#9a3412' : '#1a1a1a';
}

function lerpHeat(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Intensité 0..1 relative au min/max de la période (milieu = 0.5 si égalité). */
export function heatIntensity(value: number, min: number, max: number): number {
  if (!(max > min)) return 0.5;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** Carte + heatmap journalière : rouge sang (faible) → vert luisant (fort). */
export function mapHeatColor(intensity: number): string {
  const x = Math.min(1, Math.max(0, intensity));
  const hue = Math.round(lerpHeat(0, 142, x));
  const sat = Math.round(lerpHeat(96, 92, x));
  const light = Math.round(lerpHeat(42, 52, x));
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

export function mapHeatStrokeColor(intensity: number): string {
  const x = Math.min(1, Math.max(0, intensity));
  const hue = Math.round(lerpHeat(0, 142, x));
  const sat = Math.round(lerpHeat(90, 88, x));
  const light = Math.round(lerpHeat(30, 36, x));
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}
