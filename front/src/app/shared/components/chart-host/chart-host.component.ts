import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { Chart, ChartConfiguration, ChartOptions, registerables } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(...registerables, zoomPlugin);

const ENTER_MS = 720;

@Component({
  selector: 'app-chart-host',
  standalone: true,
  template: `
    <div class="chart-host" [style.height]="height">
      <canvas #canvas [class.is-entering]="entering" (animationend)="onEnterEnd($event)"></canvas>
    </div>
  `,
  styles: [
    `
      .chart-host {
        position: relative;
        width: 100%;
        min-height: 12rem;
      }

      canvas.is-entering {
        animation: chart-panel-in 0.28s ease;
      }

      @keyframes chart-panel-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        canvas.is-entering {
          animation: none;
        }
      }
    `,
  ],
})
export class ChartHostComponent implements OnChanges, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() config: ChartConfiguration | null = null;
  /** CSS height of the chart area (e.g. 16rem, 240px). */
  @Input() height = '280px';
  /** Mouse wheel zoom (horizontal) + drag to pan when cursor is over the chart. */
  @Input() enableZoom = false;

  entering = false;

  private chart?: Chart;
  private chartType?: string;
  private zoomOn = false;
  private ticket = 0;
  private pendingFrame = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['config'] || changes['enableZoom']) {
      this.render();
    }
  }

  ngOnDestroy(): void {
    this.ticket += 1;
    this.cancelFrame();
    this.destroyChart();
  }

  onEnterEnd(event: AnimationEvent): void {
    if (event.target !== this.canvasRef?.nativeElement) return;
    this.entering = false;
  }

  private render(): void {
    const ticket = ++this.ticket;
    this.cancelFrame();
    if (!this.config) {
      this.destroyChart();
      this.entering = false;
      return;
    }
    const next = this.decorate(this.withZoomOptions(this.config));
    if (this.chart && this.chartType === next.type && this.zoomOn === this.enableZoom) {
      this.chart.data = next.data;
      this.chart.options = (next.options ?? {}) as ChartOptions;
      this.chart.update();
      return;
    }
    this.destroyChart();
    this.pendingFrame = requestAnimationFrame(() => {
      this.pendingFrame = 0;
      if (ticket !== this.ticket || !this.config) return;
      this.mount(next);
    });
  }

  private mount(config: ChartConfiguration): void {
    const canvas = this.canvasRef?.nativeElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    this.chart = new Chart(ctx, config);
    this.chartType = String(config.type);
    this.zoomOn = this.enableZoom;
    this.restartEnter();
  }

  private restartEnter(): void {
    if (this.reducedMotion()) {
      this.entering = false;
      return;
    }
    this.entering = false;
    requestAnimationFrame(() => {
      this.entering = true;
    });
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = undefined;
    this.chartType = undefined;
    this.zoomOn = false;
  }

  private cancelFrame(): void {
    if (!this.pendingFrame) return;
    cancelAnimationFrame(this.pendingFrame);
    this.pendingFrame = 0;
  }

  /**
   * Le resize responsive de Chart.js relance un update immédiat qui annulait
   * l'animation d'entrée. On lui donne la même durée pour qu'elle se joue.
   */
  private decorate(config: ChartConfiguration): ChartConfiguration {
    const options: ChartOptions = { ...(config.options ?? {}) };
    if (options.animation === false || this.reducedMotion()) {
      options.animation = false;
      return { ...config, data: config.data, options };
    }
    const current =
      typeof options.animation === 'object' && options.animation ? options.animation : {};
    options.animation = { ...current, duration: ENTER_MS, easing: 'easeOutQuart' };
    options.transitions = {
      ...(options.transitions ?? {}),
      resize: { animation: { duration: ENTER_MS, easing: 'easeOutQuart' } },
      active: { animation: { duration: 420, easing: 'easeOutQuart' } },
    };
    return { ...config, data: config.data, options };
  }

  private reducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private withZoomOptions(config: ChartConfiguration): ChartConfiguration {
    if (!this.enableZoom) return config;

    const options = { ...(config.options ?? {}) };
    const plugins = { ...(options.plugins ?? {}) };
    plugins['zoom'] = {
      pan: {
        enabled: true,
        mode: 'x',
        modifierKey: 'shift',
      },
      zoom: {
        wheel: { enabled: true, speed: 0.08 },
        pinch: { enabled: true },
        drag: { enabled: false },
        mode: 'x',
      },
      limits: {
        x: { minRange: 3 },
      },
    };
    options.plugins = plugins;
    return { ...config, options };
  }
}
