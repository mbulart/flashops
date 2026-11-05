import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonComponent } from '../skeleton/skeleton.component';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule, SkeletonComponent],
  template: `
    <div class="kpi-card h-100">
      <div class="kpi-card-icon" [ngClass]="'text-' + variant">
        <i [class]="icon"></i>
      </div>
      <div class="kpi-card-content">
        <span class="kpi-card-label">{{ label }}</span>
        @if (loading) {
          <app-skeleton type="text" width="72%" height="1.35rem" />
        } @else if (growthMetric) {
          @if (delta != null) {
            <span
              class="kpi-card-value kpi-card-value--growth"
              [class.kpi-card-delta--up]="delta > 0"
              [class.kpi-card-delta--down]="delta < 0"
              [class.kpi-card-delta--flat]="delta === 0"
            >
              <i
                class="bi"
                [class.bi-arrow-up-short]="delta > 0"
                [class.bi-arrow-down-short]="delta < 0"
                [class.bi-dash]="delta === 0"
              ></i>
              {{ delta > 0 ? '+' : '' }}{{ delta | number: '1.1-1' }}%
            </span>
          } @else {
            <span class="kpi-card-value">—</span>
          }
          @if (hint) {
            <span class="kpi-card-hint">{{ hint }}</span>
          }
        } @else {
          <span class="kpi-card-value" [attr.title]="valueTitle || null">{{ value }}</span>
          @if (!loading && delta != null) {
            <span
              class="kpi-card-delta"
              [class.kpi-card-delta--up]="delta > 0"
              [class.kpi-card-delta--down]="delta < 0"
              [class.kpi-card-delta--flat]="delta === 0"
            >
              <i
                class="bi"
                [class.bi-arrow-up-short]="delta > 0"
                [class.bi-arrow-down-short]="delta < 0"
                [class.bi-dash]="delta === 0"
              ></i>
              {{ delta > 0 ? '+' : '' }}{{ delta | number: '1.1-1' }}%
              @if (deltaHint) {
                <span class="kpi-card-delta-hint">{{ deltaHint }}</span>
              }
            </span>
          } @else if (hint) {
            <span class="kpi-card-hint">{{ hint }}</span>
          }
        }
      </div>
    </div>
  `,
})
export class KpiCardComponent {
  @Input({ required: true }) label!: string;
  @Input() value: string | number = '—';
  /** Infobulle (valeur complète si affichage compact). */
  @Input() valueTitle = '';
  /** MoM / YoY : le pourcentage devient la valeur principale colorée. */
  @Input() growthMetric = false;
  @Input() hint = '';
  @Input() delta: number | null = null;
  @Input() deltaHint = '';
  @Input() icon = 'bi bi-graph-up';
  @Input() variant: 'primary' | 'secondary' | 'muted' = 'primary';
  @Input() loading = false;
}
