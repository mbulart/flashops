import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { SkeletonComponent } from '../skeleton/skeleton.component';
import { SearchSelectOption } from '../search-select/search-select.component';

@Component({
  selector: 'app-search-multi-select',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonComponent],
  template: `
    <div class="search-multi-select position-relative">
      <button
        type="button"
        class="form-control search-multi-control text-start"
        (click)="togglePanel(); $event.stopPropagation()"
      >
        <span class="search-multi-value">
          @if (!selectedIds.length) {
            <span class="text-muted">{{ placeholder }}</span>
          } @else {
            @for (opt of selectedOptions(); track opt.id) {
              <span class="selected-chip">
                {{ opt.label }}
                <span
                  role="button"
                  tabindex="0"
                  class="chip-remove"
                  (click)="$event.stopPropagation(); remove(opt.id)"
                  (keydown.enter)="$event.stopPropagation(); remove(opt.id)"
                >
                  <i class="bi bi-x"></i>
                </span>
              </span>
            }
          }
        </span>
        <i class="bi bi-chevron-down search-multi-chevron"></i>
      </button>

      @if (panelOpen()) {
        <div class="search-multi-panel shadow-sm" (click)="$event.stopPropagation()">
          <div class="p-2 border-bottom">
            <form class="search-select-input-wrap position-relative" autocomplete="off" (submit)="$event.preventDefault()">
              <i class="bi bi-search search-select-icon"></i>
              <input
                #searchInput
                type="text"
                class="form-control form-control-sm search-select-input"
                [placeholder]="searchPlaceholder"
                [attr.name]="autocompleteField"
                [attr.id]="autocompleteField"
                [(ngModel)]="query"
                [ngModelOptions]="{ standalone: true }"
                autocomplete="off"
                autocapitalize="off"
                autocorrect="off"
                spellcheck="false"
                data-lpignore="true"
                data-1p-ignore
                data-form-type="other"
                (input)="onSearchInput()"
                (mousedown)="$event.stopPropagation()"
                (click)="$event.stopPropagation()"
                (keydown.escape)="close()"
              />
            </form>
          </div>
          @if (loading()) {
            <app-skeleton type="search" />
          } @else if (options().length) {
            <ul class="list-group list-group-flush mb-0 options-scroll">
              @for (opt of options(); track opt.id) {
                <li>
                  <button
                    type="button"
                    class="list-group-item list-group-item-action py-0 px-2 d-flex justify-content-between align-items-center search-multi-option"
                    [class.active]="isSelected(opt.id)"
                    (mousedown)="$event.preventDefault(); toggle(opt)"
                  >
                    <span class="search-multi-option__body">
                      <span class="search-multi-option__label">{{ opt.label }}</span>
                      @if (opt.hint) {
                        <small class="search-multi-option__hint text-muted">{{ opt.hint }}</small>
                      }
                    </span>
                    @if (isSelected(opt.id)) {
                      <i class="bi bi-check-lg search-multi-option__check"></i>
                    }
                  </button>
                </li>
              }
            </ul>
          } @else {
            <div class="search-select-hint">Aucun résultat</div>
          }
          @if (selectedIds.length) {
            <div class="p-2 border-top">
              <button
                type="button"
                class="btn btn-link btn-sm p-0 text-decoration-none"
                (mousedown)="$event.preventDefault(); clear()"
              >
                Effacer la sélection
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .search-multi-control {
        min-height: var(--flash-control-height, 30px);
        height: auto;
        padding: 0.15rem 1.75rem 0.15rem 0.4rem;
        background: var(--card-bg, #fff);
        position: relative;
        font-size: 0.75rem;
        line-height: 1.25;
      }
      .search-multi-value {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        align-items: center;
      }
      .selected-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.12rem;
        max-width: 100%;
        padding: 0.04rem 0.25rem;
        border-radius: 0.25rem;
        background: rgba(255, 213, 0, 0.22);
        font-size: 0.6875rem;
        line-height: 1.05rem;
      }
      .chip-remove {
        display: inline-flex;
        font-size: 1rem;
        color: var(--text-muted, #6b7280);
      }
      .search-multi-chevron {
        position: absolute;
        right: 0.65rem;
        top: 50%;
        transform: translateY(-50%);
        font-size: 0.75rem;
        color: var(--text-muted, #6b7280);
      }
      .search-multi-panel {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        z-index: 1050;
        width: max(100%, 15.5rem);
        max-width: min(22rem, calc(100vw - 1.5rem));
        overflow: hidden;
        border: 1px solid var(--card-border, #e5e7eb);
        border-radius: 0.5rem;
        background: var(--card-bg, #fff);
      }
      .options-scroll {
        max-height: 240px;
        overflow-x: hidden;
        overflow-y: auto;
      }
      .search-select-icon {
        position: absolute;
        left: 0.65rem;
        top: 50%;
        transform: translateY(-50%);
        color: var(--text-muted, #6b7280);
        pointer-events: none;
        font-size: 0.85rem;
      }
      .search-select-input {
        padding-left: 1.85rem;
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
      .search-multi-option {
        gap: 0.35rem;
        min-height: 1.65rem;
        font-size: 0.72rem;
        text-align: left;
      }
      .search-multi-option__body {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
      }
      .search-multi-option__label {
        font-weight: 600;
        display: block;
        line-height: 1.25;
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .search-multi-option__hint {
        display: block;
        margin-top: 0.05rem;
        font-size: 0.68rem;
        line-height: 1.2;
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .search-multi-option__check {
        flex-shrink: 0;
        font-size: 0.85rem;
      }
    `,
  ],
})
export class SearchMultiSelectComponent implements OnInit, OnChanges, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

  @Input() placeholder = 'Sélectionner…';
  @Input() searchPlaceholder = 'Rechercher…';
  @Input() initialLimit = 10;
  @Input() searchLimit = 20;
  @Input() minSearchLength = 2;
  /** Charge les N premières lignes au montage (liste prête à l’ouverture). */
  @Input() prefetchOnInit = false;
  /** Nom technique du champ (évite l’autocomplétion navigateur). */
  @Input() autocompleteField = 'flash-search-multi-q';
  @Input({ required: true }) loader!: (search: string, limit: number) => Observable<SearchSelectOption[]>;
  @Input() selectedIds: number[] = [];
  @Output() selectedIdsChange = new EventEmitter<number[]>();

  query = '';
  readonly options = signal<SearchSelectOption[]>([]);
  readonly panelOpen = signal(false);
  readonly loading = signal(false);

  private readonly onOutsideInteraction = (event: Event) => {
    if (!this.panelOpen()) return;
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.close();
    }
  };

  private readonly known = new Map<number, SearchSelectOption>();
  private debounce?: ReturnType<typeof setTimeout>;
  private initialLoaded = false;

  ngOnInit(): void {
    document.addEventListener('mousedown', this.onOutsideInteraction, true);
    document.addEventListener('focusin', this.onOutsideInteraction, true);
    this.ensureKnownLabels();
    if (this.prefetchOnInit && !this.initialLoaded) {
      this.fetch('', this.initialLimit);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedIds']) {
      this.ensureKnownLabels();
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousedown', this.onOutsideInteraction, true);
    document.removeEventListener('focusin', this.onOutsideInteraction, true);
    if (this.debounce) clearTimeout(this.debounce);
  }

  selectedOptions(): SearchSelectOption[] {
    return this.selectedIds
      .map((id) => this.known.get(id))
      .filter((opt): opt is SearchSelectOption => !!opt);
  }

  isSelected(id: number): boolean {
    return this.selectedIds.includes(id);
  }

  toggle(opt: SearchSelectOption): void {
    this.known.set(opt.id, opt);
    const next = this.isSelected(opt.id)
      ? this.selectedIds.filter((x) => x !== opt.id)
      : [...this.selectedIds, opt.id];
    this.selectedIdsChange.emit(next);
  }

  remove(id: number): void {
    this.selectedIdsChange.emit(this.selectedIds.filter((x) => x !== id));
  }

  clear(): void {
    this.known.clear();
    this.selectedIdsChange.emit([]);
  }

  reset(): void {
    this.clear();
    this.query = '';
    this.options.set([]);
    this.initialLoaded = false;
    this.close();
  }

  togglePanel(): void {
    const open = !this.panelOpen();
    this.panelOpen.set(open);
    if (open) {
      if (!this.initialLoaded) {
        this.fetch('', this.initialLimit);
      }
      setTimeout(() => this.searchInput?.nativeElement.focus(), 0);
    }
  }

  close(): void {
    this.panelOpen.set(false);
    this.query = '';
  }

  onSearchInput(): void {
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

  private ensureKnownLabels(): void {
    const missing = this.selectedIds.filter((id) => !this.known.has(id));
    if (!missing.length || !this.loader) return;
    this.loader('', Math.max(this.initialLimit, 30)).subscribe({
      next: (items) => {
        for (const item of items) {
          this.known.set(item.id, item);
        }
      },
    });
  }

  private fetch(search: string, limit: number): void {
    if (!this.loader) return;
    this.loading.set(true);
    this.loader(search, limit).subscribe({
      next: (items) => {
        for (const item of items) {
          this.known.set(item.id, item);
        }
        this.options.set(items);
        this.loading.set(false);
        if (!search) this.initialLoaded = true;
      },
      error: () => this.loading.set(false),
    });
  }
}
