import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatNumberFr } from '../../utils/format.utils';
import { heatIntensity, mapHeatColor, type HeatMetric } from '../../utils/heat-scale.utils';

/** Point journalier (reports ou pilotage). */
export type HeatmapDayPoint = {
  period?: string;
  jour?: string;
  amount_sum?: number;
  montant?: number;
  tx_count?: number;
  volume?: number;
};

interface HeatCell {
  date: string;
  label: string;
  value: number;
  intensity: number;
  color: string;
  dow: number;
}

@Component({
  selector: 'app-heatmap-calendar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="heatmap-wrap" [attr.data-density]="density()">
      <div class="heatmap-legend mb-2">
        <span class="small text-muted">{{ metric === 'volume' ? 'Volume faible' : 'Valeur faible' }}</span>
        <span class="heat-swatch" [style.background]="heatColor(0.08)"></span>
        <span class="heat-swatch" [style.background]="heatColor(0.35)"></span>
        <span class="heat-swatch" [style.background]="heatColor(0.65)"></span>
        <span class="heat-swatch" [style.background]="heatColor(1)"></span>
        <span class="small text-muted">{{ metric === 'volume' ? 'Volume fort' : 'Valeur forte' }}</span>
      </div>
      <div class="heatmap-grid" role="list">
        @for (cell of cells; track cell.date) {
          <div
            class="heatmap-cell"
            [class.heatmap-cell--light-text]="cell.intensity >= 0.32"
            role="listitem"
            [style.background]="cell.color"
            [attr.title]="tooltip(cell)"
            [attr.aria-label]="tooltip(cell)"
          >
            @if (showDayLabels()) {
              <span class="heatmap-day">{{ cell.label }}</span>
            }
          </div>
        }
      </div>
      @if (!cells.length) {
        <p class="text-muted small mb-0 mt-2">Aucune donnée journalière sur la période.</p>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      .heatmap-legend {
        display: flex;
        align-items: center;
        gap: 0.35rem;
      }
      .heat-swatch {
        width: 0.85rem;
        height: 0.85rem;
        border-radius: 3px;
      }
      .heatmap-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(var(--heat-cell, 2.4rem), 1fr));
        gap: var(--heat-gap, 0.3rem);
      }
      .heatmap-cell {
        aspect-ratio: 1;
        border-radius: 4px;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding: 0.15rem;
        cursor: default;
        min-height: var(--heat-cell, 2.4rem);
      }
      .heatmap-day {
        font-size: 0.62rem;
        color: #1a1a1a;
        line-height: 1;
        font-weight: 600;
      }
      .heatmap-cell--light-text .heatmap-day {
        color: #fff;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
      }

      /* Plus de jours → cases plus petites */
      .heatmap-wrap[data-density='md'] {
        --heat-cell: 1.75rem;
        --heat-gap: 0.22rem;
      }
      .heatmap-wrap[data-density='md'] .heatmap-day {
        font-size: 0.55rem;
      }
      .heatmap-wrap[data-density='sm'] {
        --heat-cell: 1.15rem;
        --heat-gap: 0.16rem;
      }
      .heatmap-wrap[data-density='sm'] .heatmap-cell {
        border-radius: 3px;
        padding: 0;
      }
      .heatmap-wrap[data-density='xs'] {
        --heat-cell: 0.85rem;
        --heat-gap: 0.12rem;
      }
      .heatmap-wrap[data-density='xs'] .heatmap-cell {
        border-radius: 2px;
        padding: 0;
      }
    `,
  ],
})
export class HeatmapCalendarComponent implements OnChanges {
  @Input() data: HeatmapDayPoint[] = [];
  @Input() metric: HeatMetric = 'value';

  cells: HeatCell[] = [];

  ngOnChanges(): void {
    this.rebuild();
  }

  heatColor = mapHeatColor;

  /** md ≈ 2 mois, sm ≈ 1 trimestre+, xs ≈ semestre+ */
  density(): 'lg' | 'md' | 'sm' | 'xs' {
    const n = this.cells.length;
    if (n > 180) return 'xs';
    if (n > 90) return 'sm';
    if (n > 45) return 'md';
    return 'lg';
  }

  showDayLabels(): boolean {
    return this.density() === 'lg' || this.density() === 'md';
  }

  tooltip(cell: HeatCell): string {
    const unit = this.metric === 'volume' ? 'tx' : '';
    return `${cell.date} — ${formatNumberFr(cell.value)}${unit ? ' ' + unit : ''}`;
  }

  private rebuild(): void {
    const byDate = new Map<string, number>();
    for (const row of this.data) {
      const key = (row.period || row.jour || '').trim();
      if (!key) continue;
      const val = this.metric === 'volume' ? Number(row.tx_count ?? row.volume ?? 0) : Number(row.amount_sum ?? row.montant ?? 0);
      byDate.set(key, (byDate.get(key) || 0) + (Number.isFinite(val) ? val : 0));
    }
    const values = [...byDate.values()];
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    this.cells = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => {
        const d = new Date(`${date}T00:00:00`);
        const intensity = heatIntensity(value, min, max);
        return {
          date,
          label: Number.isNaN(d.getTime()) ? date.slice(8, 10) : String(d.getDate()),
          value,
          intensity,
          color: this.heatColor(intensity),
          dow: Number.isNaN(d.getTime()) ? 0 : d.getDay(),
        };
      });
  }
}
