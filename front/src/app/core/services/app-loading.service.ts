import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppLoadingService {
  private depth = 0;
  private readonly visibleSignal = signal(false);
  private readonly messageSignal = signal('Chargement…');

  readonly visible = this.visibleSignal.asReadonly();
  readonly message = this.messageSignal.asReadonly();

  show(message = 'Chargement…'): void {
    this.depth += 1;
    this.messageSignal.set(message);
    this.visibleSignal.set(true);
  }

  hide(): void {
    this.depth = Math.max(0, this.depth - 1);
    if (this.depth === 0) {
      this.visibleSignal.set(false);
    }
  }

  forceHide(): void {
    this.depth = 0;
    this.visibleSignal.set(false);
  }

  async run<T>(task: () => Promise<T>, message = 'Chargement…'): Promise<T> {
    this.show(message);
    try {
      return await task();
    } finally {
      this.hide();
    }
  }
}
