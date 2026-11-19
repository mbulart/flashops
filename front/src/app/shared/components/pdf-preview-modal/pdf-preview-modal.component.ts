import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DocumentShareModalComponent } from '../document-share-modal/document-share-modal.component';

@Component({
  selector: 'app-pdf-preview-modal',
  standalone: true,
  imports: [CommonModule, DocumentShareModalComponent],
  template: `
    @if (open) {
      <div class="modal d-block pdf-preview-backdrop" tabindex="-1">
        <div class="modal-dialog modal-xl modal-dialog-centered modal-fullscreen-lg-down">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">{{ title }}</h5>
              <button type="button" class="btn-close" aria-label="Fermer" (click)="close()"></button>
            </div>
            <div class="modal-body p-0 pdf-preview-body">
              @if (safeUrl) {
                <iframe [src]="safeUrl" class="pdf-preview-frame" [title]="title"></iframe>
              } @else {
                <div class="p-5 text-center text-muted">
                  <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                  Chargement de l’aperçu…
                </div>
              }
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" (click)="close()">Fermer</button>
              <button type="button" class="btn btn-outline-primary" (click)="openShare()" [disabled]="!buffer">
                <i class="bi bi-envelope me-1"></i>
                Partager
              </button>
              <button type="button" class="btn btn-primary" (click)="download()" [disabled]="!pdfUrl">
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
      [subject]="shareSubject"
      [filename]="shareFilename"
      contentType="application/pdf"
      [buffer]="buffer"
      (closed)="shareOpen.set(false)"
    />
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .pdf-preview-backdrop {
        position: fixed;
        inset: 0;
        z-index: 2000;
        background: rgba(0, 0, 0, 0.5);
      }

      .pdf-preview-body {
        min-height: 70vh;
        background: #f3f4f6;
      }

      .pdf-preview-frame {
        width: 100%;
        height: 70vh;
        border: 0;
        display: block;
        background: #fff;
      }
    `,
  ],
})
export class PdfPreviewModalComponent implements OnChanges {
  private readonly sanitizer = inject(DomSanitizer);

  @Input({ required: true }) open = false;
  @Input() title = 'Aperçu PDF';
  @Input() pdfUrl: string | null = null;
  @Input() filename = 'document.pdf';
  @Input() buffer: ArrayBuffer | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() downloadRequested = new EventEmitter<void>();

  readonly shareOpen = signal(false);

  safeUrl: SafeResourceUrl | null = null;

  get shareSubject(): string {
    return this.title;
  }

  get shareFilename(): string {
    return this.filename.endsWith('.pdf') ? this.filename : `${this.filename}.pdf`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('pdfUrl' in changes) {
      this.safeUrl = this.pdfUrl
        ? this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfUrl)
        : null;
    }
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
    if (!this.pdfUrl) return;
    this.downloadRequested.emit();
    const name = this.filename.endsWith('.pdf') ? this.filename : `${this.filename}.pdf`;
    const anchor = document.createElement('a');
    anchor.href = this.pdfUrl;
    anchor.download = name;
    anchor.click();
  }
}
