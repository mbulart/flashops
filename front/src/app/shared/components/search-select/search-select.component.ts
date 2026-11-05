import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { SkeletonComponent } from '../skeleton/skeleton.component';

export interface SearchSelectOption {
  id: number;
  label: string;
  hint?: string;
}

@Component({
  selector: 'app-search-select',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonComponent],
  template: `
    <div class="search-select position-relative">
      <form class="search-select-input-wrap" autocomplete="off" (submit)="$event.preventDefault()">
        <i class="bi bi-search search-select-icon"></i>
        <input
          type="text"
          class="form-control search-select-input"
          [placeholder]="placeholder"
          [attr.name]="autocompleteField"
          [attr.id]="autocompleteField"
          [(ngModel)]="query"
          [ngModelOptions]="{ standalone: true }"
          (input)="onInput()"
          (focus)="onFocus()"
          (blur)="onBlur()"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          data-lpignore="true"
          data-1p-ignore
          data-form-type="other"
        />
        @if (selected()) {
          <button
            type="button"
            class="btn btn-sm btn-link search-select-clear"
            (mousedown)="$event.preventDefault(); clear()"
            aria-label="Effacer la sélection"
          >
            <i class="bi bi-x-lg"></i>
          </button>
        } @else {
          <i class="bi bi-chevron-down search-select-chevron"></i>
        }
      </form>

      @if (panelOpen()) {
        <div class="search-select-panel shadow-sm" (mousedown)="$event.preventDefault()">
          @if (loading()) {
            <app-skeleton type="search" />
          } @else if (options().length) {
            <ul class="list-group list-group-flush mb-0">
              @if (allowClear) {
                <li>
                  <button
                    type="button"
                    class="list-group-item list-group-item-action py-1 text-muted"
                    (mousedown)="$event.preventDefault(); clear()"
                  >
                    {{ emptyLabel }}
                  </button>
                </li>
              }
              @for (opt of options(); track opt.id) {
                <li>
                  <button
                    type="button"
                    class="list-group-item list-group-item-action py-1"
                    [class.active]="selected()?.id === opt.id"
                    (mousedown)="$event.preventDefault(); pick(opt)"
                  >
                    <span class="fw-medium">{{ opt.label }}</span>
                    @if (opt.hint) {
                      <small class="text-muted d-block">{{ opt.hint }}</small>
                    }
                  </button>
                </li>
              }
            </ul>
          } @else {
            <div class="search-select-hint">Aucun résultat</div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .search-select-input-wrap {
        position: relative;
      }
      .search-select-icon {
        position: absolute;
        left: 0.75rem;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted, #6b7280);
        pointer-events: none;
        font-size: 0.9rem;
      }
      .search-select-chevron {
        position: absolute;
        right: 0.65rem;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted, #6b7280);
        pointer-events: none;
        font-size: 0.75rem;
      }
      .search-select-clear {
        position: absolute;
        right: 0.35rem;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted, #6b7280);
        padding: 0;
        line-height: 1;
      }
      .search-select-input {
        padding-left: 2.25rem;
        padding-right: 2rem;
      }
      .search-select-panel {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        z-index: 1050;
        max-height: 260px;
        overflow-y: auto;
        border: 1px solid var(--card-border, #e5e7eb);
        border-radius: 0.5rem;
        background: var(--card-bg, #fff);
      }
      .search-select-hint {
        padding: 0.65rem 0.85rem;
        font-size: 0.85rem;
        color: var(--text-muted, #6b7280);
      }
      .list-group-item.active {
        background: rgba(255, 213, 0, 0.18);
        border-color: transparent;
        color: inherit;
      }
    `,
  ],
})
export class SearchSelectComponent implements OnDestroy {
  @Input() placeholder = 'Rechercher…';
  @Input() emptyLabel = 'Toutes';
  @Input() allowClear = true;
  @Input() autocompleteField = 'flash-search-select-q';
  @Input() initialLimit = 50;
  @Input() searchLimit = 50;
  @Input() minSearchLength = 2;
  @Input({ required: true }) loader!: (search: string, limit: number) => Observable<SearchSelectOption[]>;

  @Output() selectedIdChange = new EventEmitter<number | null>();

  query = '';
  readonly options = signal<SearchSelectOption[]>([]);
  readonly selected = signal<SearchSelectOption | null>(null);
  readonly panelOpen = signal(false);
  readonly loading = signal(false);

  private debounce?: ReturnType<typeof setTimeout>;
  private blurTimer?: ReturnType<typeof setTimeout>;
  private initialLoaded = false;
  /** Évite d’effacer la sélection quand on met à jour query après pick(). */
  private syncingQuery = false;

  ngOnDestroy(): void {
    if (this.debounce) clearTimeout(this.debounce);
    if (this.blurTimer) clearTimeout(this.blurTimer);
  }

  onFocus(): void {
    this.panelOpen.set(true);
    const term = this.query.trim();
    if (term.length >= this.minSearchLength) {
      this.fetch(term, this.searchLimit);
    } else if (!this.initialLoaded) {
      this.fetch('', this.initialLimit);
    }
  }

  onInput(): void {
    if (this.syncingQuery) return;

    const sel = this.selected();
    if (sel && this.query === sel.label) return;

    if (sel) {
      this.selected.set(null);
      this.selectedIdChange.emit(null);
    }
    this.scheduleFetch();
  }

  onBlur(): void {
    if (this.blurTimer) clearTimeout(this.blurTimer);
    this.blurTimer = setTimeout(() => {
      this.panelOpen.set(false);
      const sel = this.selected();
      if (sel) {
        this.setQuery(sel.label);
      }
    }, 150);
  }

  pick(opt: SearchSelectOption): void {
    if (this.debounce) clearTimeout(this.debounce);
    if (this.blurTimer) clearTimeout(this.blurTimer);
    this.selected.set(opt);
    this.setQuery(opt.label);
    this.panelOpen.set(false);
    this.selectedIdChange.emit(opt.id);
  }

  clear(): void {
    if (this.debounce) clearTimeout(this.debounce);
    this.selected.set(null);
    this.setQuery('');
    this.initialLoaded = false;
    this.options.set([]);
    this.panelOpen.set(false);
    this.selectedIdChange.emit(null);
  }

  reset(): void {
    this.clear();
  }

  private setQuery(value: string): void {
    this.syncingQuery = true;
    this.query = value;
    queueMicrotask(() => {
      this.syncingQuery = false;
    });
  }

  private scheduleFetch(): void {
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      const term = this.query.trim();
      if (term.length >= this.minSearchLength) {
        this.fetch(term, this.searchLimit);
      } else {
        this.fetch('', this.initialLimit);
      }
    }, 280);
  }

  private fetch(search: string, limit: number): void {
    if (!this.loader) return;
    this.loading.set(true);
    this.panelOpen.set(true);
    this.loader(search, limit).subscribe({
      next: (items) => {
        this.options.set(items);
        this.loading.set(false);
        if (!search) this.initialLoaded = true;
      },
      error: () => this.loading.set(false),
    });
  }
}
