import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastType } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fi-toast-stack" aria-live="polite" aria-atomic="true">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="fi-toast"
          [class.fi-toast--leaving]="toast.leaving"
          [attr.data-type]="toast.type"
          role="status"
        >
          <div class="fi-toast-icon" aria-hidden="true">
            <i [class]="iconFor(toast.type)"></i>
          </div>

          <div class="fi-toast-body">
            @if (toast.title) {
              <strong class="fi-toast-title">{{ toast.title }}</strong>
            }
            <p class="fi-toast-message">{{ toast.message }}</p>
          </div>

          <button
            type="button"
            class="fi-toast-close"
            (click)="toastService.dismiss(toast.id)"
            aria-label="Fermer la notification"
          >
            <i class="bi bi-x-lg"></i>
          </button>

          @if (!toast.leaving) {
            <span
              class="fi-toast-progress"
              [style.animation-duration.ms]="toast.durationMs"
            ></span>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .fi-toast-stack {
      position: fixed;
      top: max(1rem, env(safe-area-inset-top, 0px));
      right: max(1rem, env(safe-area-inset-right, 0px));
      z-index: 1200;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      width: min(24rem, calc(100vw - 2rem));
      pointer-events: none;
    }
    @media (max-width: 575.98px) {
      .fi-toast-stack {
        left: max(0.75rem, env(safe-area-inset-left, 0px));
        right: max(0.75rem, env(safe-area-inset-right, 0px));
        width: auto;
      }
      .fi-toast {
        transform-origin: top center;
      }
    }

    .fi-toast {
      position: relative;
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.85rem 0.9rem 0.95rem;
      overflow: hidden;
      border: 1px solid var(--card-border, #e5e7eb);
      border-radius: 0.85rem;
      background: var(--card-bg, #fff);
      box-shadow:
        0 10px 15px -3px rgba(15, 23, 42, 0.12),
        0 4px 6px -4px rgba(15, 23, 42, 0.08);
      pointer-events: auto;
      transform-origin: top right;
      animation: fi-toast-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    .fi-toast--leaving {
      animation: fi-toast-out 280ms cubic-bezier(0.4, 0, 1, 1) both;
    }

    .fi-toast-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: 999px;
      font-size: 0.95rem;
      flex: 0 0 2rem;
    }

    .fi-toast-body {
      min-width: 0;
      padding-top: 0.1rem;
    }

    .fi-toast-title {
      display: block;
      margin-bottom: 0.15rem;
      font-size: 0.84rem;
      font-weight: 700;
      color: var(--text-primary, #111);
    }

    .fi-toast-message {
      margin: 0;
      font-size: 0.82rem;
      line-height: 1.35;
      color: var(--text-muted, #6b7280);
    }

    .fi-toast-close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.65rem;
      height: 1.65rem;
      margin-top: -0.1rem;
      border: 0;
      border-radius: 0.4rem;
      background: transparent;
      color: var(--text-muted, #6b7280);
      font-size: 0.75rem;
      line-height: 1;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .fi-toast-close:hover {
      background: rgba(15, 23, 42, 0.06);
      color: var(--text-primary, #111);
    }

    .fi-toast-progress {
      position: absolute;
      left: 0;
      bottom: 0;
      height: 3px;
      width: 100%;
      transform-origin: left center;
      animation-name: fi-toast-progress;
      animation-timing-function: linear;
      animation-fill-mode: forwards;
    }

    .fi-toast[data-type='success'] .fi-toast-icon {
      background: rgba(34, 197, 94, 0.14);
      color: #16a34a;
    }
    .fi-toast[data-type='success'] .fi-toast-progress {
      background: #22c55e;
    }

    .fi-toast[data-type='danger'] .fi-toast-icon {
      background: rgba(239, 68, 68, 0.14);
      color: #dc2626;
    }
    .fi-toast[data-type='danger'] .fi-toast-progress {
      background: #ef4444;
    }

    .fi-toast[data-type='warning'] .fi-toast-icon {
      background: rgba(255, 213, 0, 0.22);
      color: #a16207;
    }
    .fi-toast[data-type='warning'] .fi-toast-progress {
      background: #eab308;
    }

    .fi-toast[data-type='info'] .fi-toast-icon {
      background: rgba(59, 130, 246, 0.14);
      color: #2563eb;
    }
    .fi-toast[data-type='info'] .fi-toast-progress {
      background: #3b82f6;
    }

    [data-bs-theme='dark'] .fi-toast {
      box-shadow:
        0 12px 24px -8px rgba(0, 0, 0, 0.45),
        0 4px 10px -4px rgba(0, 0, 0, 0.35);
    }

    [data-bs-theme='dark'] .fi-toast-close:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #f3f4f6;
    }

    @keyframes fi-toast-in {
      from {
        opacity: 0;
        transform: translateX(1.25rem) translateY(-0.35rem) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateX(0) translateY(0) scale(1);
      }
    }

    @keyframes fi-toast-out {
      from {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
      to {
        opacity: 0;
        transform: translateX(1.1rem) scale(0.96);
      }
    }

    @keyframes fi-toast-progress {
      from {
        transform: scaleX(1);
      }
      to {
        transform: scaleX(0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .fi-toast,
      .fi-toast--leaving,
      .fi-toast-progress {
        animation: none !important;
      }
    }
  `,
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);

  iconFor(type: ToastType): string {
    switch (type) {
      case 'success':
        return 'bi bi-check-circle-fill';
      case 'danger':
        return 'bi bi-x-circle-fill';
      case 'warning':
        return 'bi bi-exclamation-triangle-fill';
      default:
        return 'bi bi-info-circle-fill';
    }
  }
}
