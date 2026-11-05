import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ExcelPreviewSheet,
  downloadExcelBuffer,
  parseExcelBufferPreview,
} from '../../utils/format.utils';
import { DocumentShareModalComponent } from '../document-share-modal/document-share-modal.component';

@Component({
  selector: 'app-excel-preview-modal',
  standalone: true,
  imports: [CommonModule, DocumentShareModalComponent],
  template: `
    @if (open) {
      <div class="modal d-block excel-preview-backdrop" tabindex="-1" style="background: rgba(0, 0, 0, 0.5)">
        <div class="modal-dialog modal-xl modal-dialog-centered modal-fullscreen-lg-down">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">{{ title }}</h5>
              <button type="button" class="btn-close" aria-label="Fermer" (click)="close()"></button>
            </div>
            <div class="modal-body excel-preview-body">
              @if (loading()) {
                <div class="p-5 text-center text-muted">
                  <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                  Préparation de l’aperçu…
                </div>
              } @else if (error()) {
                <div class="p-4 text-center text-danger">{{ error() }}</div>
              } @else if (!sheets().length) {
                <div class="p-4 text-center text-muted">Feuille vide</div>
              } @else {
                @if (sheets().length > 1) {
                  <ul class="nav nav-tabs mb-3 flex-nowrap overflow-auto">
                    @for (s of sheets(); track s.name; let i = $index) {
                      <li class="nav-item">
                        <button
                          type="button"
                          class="nav-link"
                          [class.active]="activeSheet() === i"
                          (click)="activeSheet.set(i)"
                        >
                          {{ s.name }}
                        </button>
                      </li>
                    }
                  </ul>
                }

                @if (currentSheet(); as sheet) {
                  @if (sheet.truncated) {
                    <div class="alert alert-info py-2 small mb-2">
                      Aperçu limité aux {{ sheet.rows.length }} premières lignes sur {{ sheet.totalRows }}.
                      Téléchargez le fichier pour voir l’intégralité.
                    </div>
                  }
                  <div class="table-responsive excel-preview-table-wrap">
                    <table class="table table-sm table-bordered table-hover mb-0 excel-preview-table">
                      @if (sheet.headers.length) {
                        <thead class="excel-preview-head sticky-top">
                          <tr>
                            @for (h of sheet.headers; track $index) {
                              <th>{{ h }}</th>
                            }
                          </tr>
                        </thead>
                      }
                      <tbody>
                        @for (row of sheet.rows; track $index) {
                          <tr>
                            @for (cell of padRow(row, sheet.headers.length); track $index) {
                              <td>{{ cell }}</td>
                            }
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              }
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" (click)="close()">Fermer</button>
              @if (!hideShare) {
                <button type="button" class="btn btn-outline-primary" (click)="openShare()" [disabled]="!buffer || loading()">
                  <i class="bi bi-envelope me-1"></i>
                  Partager
                </button>
              }
              <button type="button" class="btn btn-primary" (click)="download()" [disabled]="!buffer || loading()">
                <i class="bi bi-download me-1"></i>
                Télécharger
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <app-document-share-modal
      [open]="shareOpen()"
      [subject]="title"
      [filename]="shareFilename"
      contentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      [buffer]="buffer"
      (closed)="shareOpen.set(false)"
    />
  `,
  styles: [
    `
      .excel-preview-body {
        min-height: 60vh;
        max-height: 70vh;
        overflow: auto;
        background: var(--app-bg, #f9fafb);
        color: var(--text-primary, #111);
      }

      .excel-preview-table-wrap {
        max-height: 58vh;
      }

      .excel-preview-table {
        font-size: 0.75rem;
        white-space: nowrap;
        background: var(--card-bg, #fff);
        color: var(--text-primary, #111);
      }

      .excel-preview-table th,
      .excel-preview-table td {
        border-color: var(--card-border, #e5e7eb);
        color: inherit;
      }

      .excel-preview-head th {
        font-weight: 600;
        vertical-align: middle;
        background: var(--header-bg, #f8f9fb);
        color: var(--text-primary, #111);
      }
    `,
  ],
})
export class ExcelPreviewModalComponent implements OnChanges {
  @Input({ required: true }) open = false;
  @Input() title = 'Aperçu Excel';
  @Input() filename = 'export.xlsx';
  @Input() buffer: ArrayBuffer | null = null;
  @Input() hideShare = false;
  @Input() previewSheets: ExcelPreviewSheet[] | null = null;

  @Output() closed = new EventEmitter<void>();

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly sheets = signal<ExcelPreviewSheet[]>([]);
  readonly activeSheet = signal(0);
  readonly shareOpen = signal(false);

  get shareFilename(): string {
    return this.filename.endsWith('.xlsx') ? this.filename : `${this.filename}.xlsx`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('open' in changes || 'buffer' in changes || 'previewSheets' in changes) {
      if (this.open && (this.buffer || this.previewSheets?.length)) {
        void this.loadPreview();
      } else if (!this.open) {
        this.sheets.set([]);
        this.error.set(null);
        this.activeSheet.set(0);
      }
    }
  }

  currentSheet(): ExcelPreviewSheet | null {
    const list = this.sheets();
    const idx = this.activeSheet();
    return list[idx] ?? null;
  }

  padRow(row: string[], colCount: number): string[] {
    if (colCount <= 0) return row;
    const out = [...row];
    while (out.length < colCount) out.push('');
    return out.slice(0, colCount);
  }

  close(): void {
    this.shareOpen.set(false);
    this.closed.emit();
  }

  openShare(): void {
    if (!this.buffer) return;
    this.shareOpen.set(true);
  }

  download(): void {
    if (!this.buffer) return;
    downloadExcelBuffer(this.buffer, this.filename);
  }

  private async loadPreview(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      if (this.previewSheets?.length) {
        this.sheets.set(this.previewSheets);
        this.activeSheet.set(0);
        return;
      }
      if (!this.buffer) return;
      const parsed = await parseExcelBufferPreview(this.buffer);
      this.sheets.set(parsed);
      const dataIdx = parsed.findIndex((s) => s.name !== 'Synthese');
      this.activeSheet.set(dataIdx >= 0 ? dataIdx : 0);
    } catch (err) {
      console.error('excel preview', err);
      this.error.set(err instanceof Error ? err.message : 'Impossible de lire le fichier Excel');
      this.sheets.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}
