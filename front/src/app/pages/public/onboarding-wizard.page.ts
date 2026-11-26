import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  CandidatureDocument,
  CandidatureDraft,
  GeoLieu,
  OnboardingOption,
  OnboardingReferentiels,
} from '../../core/models/onboarding.models';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { ToastService } from '../../core/services/toast.service';

const STORAGE_REFERENCE = 'flashops_onboarding_reference';
const STORAGE_TOKEN = 'flashops_onboarding_jeton';
const MAX_FILE = 8 * 1024 * 1024;

interface OutletGeo {
  provinceId: number | null;
  villeId: number | null;
  villes: GeoLieu[];
  communes: GeoLieu[];
}

interface PreviewState {
  typeCode: string;
  name: string;
  url: string;
  kind: 'image' | 'pdf';
  mode: 'confirm' | 'view';
  file?: File;
}

@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <main class="wizard-shell">
      <header>
        <a routerLink="/devenir-distributeur" class="brand" aria-label="Flash">
          <img [src]="logoUrl()" alt="Flash" class="brand-logo" />
        </a>
        <a routerLink="/devenir-distributeur/suivi" class="btn btn-outline-secondary btn-sm">Suivre un dossier</a>
      </header>

      <section class="wizard-card">
        <div class="wizard-title">
          <div>
            <span class="text-muted small">Candidature distributeur</span>
            <h1>{{ steps[step()].label }}</h1>
          </div>
          <span class="small text-muted">Étape {{ step() + 1 }} / {{ steps.length }}</span>
        </div>
        <div class="progress" role="progressbar" [attr.aria-valuenow]="progress()">
          <div class="progress-bar" [style.width.%]="progress()"></div>
        </div>

        @if (loading()) {
          <div class="py-4 text-center"><span class="spinner-border spinner-border-sm me-2"></span>Chargement…</div>
        } @else if (loadError()) {
          <p class="form-alert" role="alert">{{ loadError() }}</p>
        } @else {
          <div class="step-viewport" [attr.data-dir]="slideDir()" [attr.data-phase]="slidePhase()">
            <div class="step-panel">
              @if (formError()) {
                <p class="form-alert" role="alert">{{ formError() }}</p>
              }
              @switch (step()) {
                @case (0) {
                  <div class="form-grid">
                    <label>
                      Adresse e-mail <span class="req">*</span>
                      <input class="form-control form-control-sm" type="email" [(ngModel)]="draft.email" (ngModelChange)="touch()" [class.is-invalid]="!!err('email')" />
                      @if (err('email')) { <small class="field-error">{{ err('email') }}</small> }
                    </label>
                    <label>
                      Téléphone <span class="req">*</span>
                      <input class="form-control form-control-sm" [(ngModel)]="draft.telephone" (ngModelChange)="touch()" [class.is-invalid]="!!err('telephone')" />
                      @if (err('telephone')) { <small class="field-error">{{ err('telephone') }}</small> }
                    </label>
                  </div>
                }
                @case (1) {
                  <div class="form-grid">
                    <label>
                      Nom <span class="req">*</span>
                      <input class="form-control form-control-sm" [(ngModel)]="draft.representant.nom" (ngModelChange)="touch()" [class.is-invalid]="!!err('nom')" />
                      @if (err('nom')) { <small class="field-error">{{ err('nom') }}</small> }
                    </label>
                    <label>
                      Prénom <span class="req">*</span>
                      <input class="form-control form-control-sm" [(ngModel)]="draft.representant.prenom" (ngModelChange)="touch()" [class.is-invalid]="!!err('prenom')" />
                      @if (err('prenom')) { <small class="field-error">{{ err('prenom') }}</small> }
                    </label>
                    <label>
                      Téléphone
                      <input class="form-control form-control-sm" [(ngModel)]="draft.representant.telephone" (ngModelChange)="touch()" [class.is-invalid]="!!err('telGerant')" />
                      @if (err('telGerant')) { <small class="field-error">{{ err('telGerant') }}</small> }
                    </label>
                    <label>
                      E-mail
                      <input class="form-control form-control-sm" type="email" [(ngModel)]="draft.representant.email" (ngModelChange)="touch()" [class.is-invalid]="!!err('emailGerant')" />
                      @if (err('emailGerant')) { <small class="field-error">{{ err('emailGerant') }}</small> }
                    </label>
                  </div>
                }
                @case (2) {
                  <div class="form-grid">
                    <label>
                      Raison sociale <span class="req">*</span>
                      <input class="form-control form-control-sm" [(ngModel)]="draft.entreprise.raison_sociale" (ngModelChange)="touch()" [class.is-invalid]="!!err('raison')" />
                      @if (err('raison')) { <small class="field-error">{{ err('raison') }}</small> }
                    </label>
                    <label>
                      Nom commercial
                      <input class="form-control form-control-sm" [(ngModel)]="draft.entreprise.nom_commercial" />
                    </label>
                    <label>
                      Forme juridique <span class="req">*</span>
                      <select class="form-select form-select-sm" [(ngModel)]="draft.entreprise.forme_juridique" (ngModelChange)="touch()" [class.is-invalid]="!!err('forme')">
                        <option value="">Sélectionner</option>
                        @for (option of refs().formes_juridiques || []; track option.code) {
                          <option [value]="option.code">{{ option.libelle }}</option>
                        }
                      </select>
                      @if (err('forme')) { <small class="field-error">{{ err('forme') }}</small> }
                    </label>
                    <label class="span-2">
                      Adresse <span class="req">*</span>
                      <input class="form-control form-control-sm" [(ngModel)]="draft.entreprise.adresse" (ngModelChange)="touch()" [class.is-invalid]="!!err('adresse')" />
                      @if (err('adresse')) { <small class="field-error">{{ err('adresse') }}</small> }
                    </label>
                    <label>
                      Province <span class="req">*</span>
                      <select class="form-select form-select-sm" [ngModel]="entProvinceId" (ngModelChange)="onEntProvince($event)" [class.is-invalid]="!!err('province')">
                        <option [ngValue]="null">Sélectionner</option>
                        @for (p of provinces; track p.id) { <option [ngValue]="p.id">{{ p.libelle }}</option> }
                      </select>
                      @if (err('province')) { <small class="field-error">{{ err('province') }}</small> }
                    </label>
                    <label>
                      Ville <span class="req">*</span>
                      <select class="form-select form-select-sm" [ngModel]="entVilleId" (ngModelChange)="onEntVille($event)" [disabled]="!entProvinceId" [class.is-invalid]="!!err('ville')">
                        <option [ngValue]="null">Sélectionner</option>
                        @for (v of entVilles; track v.id) { <option [ngValue]="v.id">{{ v.libelle }}</option> }
                      </select>
                      @if (err('ville')) { <small class="field-error">{{ err('ville') }}</small> }
                    </label>
                    @if (entCommunes.length) {
                      <label>
                        Commune <span class="req">*</span>
                        <select class="form-select form-select-sm" [ngModel]="entCommuneId" (ngModelChange)="onEntCommune($event)" [class.is-invalid]="!!err('commune')">
                          <option [ngValue]="null">Sélectionner</option>
                          @for (c of entCommunes; track c.id) { <option [ngValue]="c.id">{{ c.libelle }}</option> }
                        </select>
                        @if (err('commune')) { <small class="field-error">{{ err('commune') }}</small> }
                      </label>
                    }
                  </div>
                }
                @case (3) {
                  @if (err('services')) { <p class="field-error mb-2">{{ err('services') }}</p> }
                  @for (family of serviceFamilies(); track family.name) {
                    <fieldset class="choice-group"><legend>{{ family.name }}</legend>
                      <div class="choice-grid">
                        @for (service of family.items; track service.code) {
                          <label class="form-check">
                            <input class="form-check-input" type="checkbox" [checked]="draft.services.includes(service.code)" (change)="toggleService(service.code, $any($event.target).checked)" />
                            <span class="form-check-label">{{ service.libelle }}</span>
                          </label>
                        }
                      </div>
                    </fieldset>
                  } @empty { <p class="text-muted mb-0">Aucun service disponible.</p> }
                }
                @case (4) {
                  <div class="d-flex justify-content-between align-items-center mb-2">
                    <p class="text-muted small mb-0">Au moins un emplacement. <span class="req">*</span></p>
                    <button type="button" class="btn btn-outline-dark btn-sm" (click)="addOutlet()"><i class="bi bi-plus-lg me-1"></i>Ajouter</button>
                  </div>
                  @if (err('points')) { <p class="field-error">{{ err('points') }}</p> }
                  @for (outlet of draft.points_vente; track $index) {
                    <div class="outlet">
                      <div class="form-grid">
                        <label>
                          Nom <span class="req">*</span>
                          <input class="form-control form-control-sm" [(ngModel)]="outlet.nom" (ngModelChange)="touch()" [class.is-invalid]="!!err('pv' + $index + 'nom')" />
                          @if (err('pv' + $index + 'nom')) { <small class="field-error">{{ err('pv' + $index + 'nom') }}</small> }
                        </label>
                        <label>
                          Adresse <span class="req">*</span>
                          <input class="form-control form-control-sm" [(ngModel)]="outlet.adresse" (ngModelChange)="touch()" [class.is-invalid]="!!err('pv' + $index + 'adresse')" />
                          @if (err('pv' + $index + 'adresse')) { <small class="field-error">{{ err('pv' + $index + 'adresse') }}</small> }
                        </label>
                        <label>
                          Province <span class="req">*</span>
                          <select class="form-select form-select-sm" [ngModel]="outletGeo[$index].provinceId" (ngModelChange)="onOutletProvince($index, $event)" [class.is-invalid]="!!err('pv' + $index + 'province')">
                            <option [ngValue]="null">Sélectionner</option>
                            @for (p of provinces; track p.id) { <option [ngValue]="p.id">{{ p.libelle }}</option> }
                          </select>
                          @if (err('pv' + $index + 'province')) { <small class="field-error">{{ err('pv' + $index + 'province') }}</small> }
                        </label>
                        <label>
                          Ville <span class="req">*</span>
                          <select class="form-select form-select-sm" [ngModel]="outletGeo[$index].villeId" (ngModelChange)="onOutletVille($index, $event)" [disabled]="!outletGeo[$index].provinceId" [class.is-invalid]="!!err('pv' + $index + 'ville')">
                            <option [ngValue]="null">Sélectionner</option>
                            @for (v of outletGeo[$index].villes; track v.id) { <option [ngValue]="v.id">{{ v.libelle }}</option> }
                          </select>
                          @if (err('pv' + $index + 'ville')) { <small class="field-error">{{ err('pv' + $index + 'ville') }}</small> }
                        </label>
                        @if (outletGeo[$index].communes.length) {
                          <label>
                            Commune <span class="req">*</span>
                            <select class="form-select form-select-sm" [ngModel]="outletCommuneId($index)" (ngModelChange)="onOutletCommune($index, $event)" [class.is-invalid]="!!err('pv' + $index + 'commune')">
                              <option [ngValue]="null">Sélectionner</option>
                              @for (c of outletGeo[$index].communes; track c.id) { <option [ngValue]="c.id">{{ c.libelle }}</option> }
                            </select>
                            @if (err('pv' + $index + 'commune')) { <small class="field-error">{{ err('pv' + $index + 'commune') }}</small> }
                          </label>
                        }
                      </div>
                      <div class="d-flex justify-content-between mt-1">
                        <label class="form-check mb-0"><input type="radio" class="form-check-input" name="principal" [checked]="outlet.principal" (change)="setPrincipal($index)" /> Point principal</label>
                        <button type="button" class="btn btn-link btn-sm text-danger" (click)="removeOutlet($index)">Retirer</button>
                      </div>
                    </div>
                  }
                }
                @case (5) {
                  <p class="text-muted small mb-2">PDF ou image, 8 Mo maximum. La prévisualisation s’ouvre avant validation.</p>
                  @for (doc of draft.documents; track doc.type_code) {
                    <div class="document-row">
                      <div>
                        <strong>{{ docLabel(doc) }} @if (docRequired(doc.type_code)) { <span class="req">*</span> }</strong>
                        <small class="d-block text-muted">{{ doc.a_fichier ? 'Fourni' : 'À fournir' }}</small>
                        @if (err('doc' + doc.type_code)) { <small class="field-error">{{ err('doc' + doc.type_code) }}</small> }
                      </div>
                      <div class="doc-actions">
                        @if (doc.a_fichier) {
                          <button type="button" class="btn btn-link btn-sm p-0" (click)="openStored(doc)">{{ doc.nom_fichier || 'Voir' }}</button>
                          <button type="button" class="btn btn-link btn-sm text-danger p-0" (click)="removeDocument(doc)">Retirer</button>
                        } @else {
                          <label class="btn btn-outline-secondary btn-sm mb-0">
                            Choisir un fichier
                            <input type="file" hidden accept="application/pdf,image/jpeg,image/png,image/webp,image/gif" (change)="pickDocument(doc, $event)" />
                          </label>
                        }
                      </div>
                    </div>
                  } @empty { <p class="text-muted mb-0">Aucun type de document n’est configuré.</p> }
                }
                @case (6) {
                  <div class="recap">
                    <div><span>Contact</span><strong>{{ draft.email || '—' }} · {{ draft.telephone || '—' }}</strong></div>
                    <div><span>Gérant</span><strong>{{ draft.representant.prenom }} {{ draft.representant.nom }}</strong></div>
                    <div><span>Entreprise</span><strong>{{ draft.entreprise.raison_sociale || '—' }}</strong></div>
                    <div><span>Lieu</span><strong>{{ lieuLabel(draft.entreprise.province, draft.entreprise.ville, draft.entreprise.commune) }}</strong></div>
                    <div><span>Services</span><strong>{{ draft.services.length }}</strong></div>
                    <div><span>Points de vente</span><strong>{{ draft.points_vente.length }}</strong></div>
                    <div><span>Documents fournis</span><strong>{{ fichiersFournis() }} / {{ draft.documents.length }}</strong></div>
                  </div>
                  <div class="alert alert-warning mt-3 mb-0 py-2">Après soumission, votre dossier sera transmis pour traitement.</div>
                }
              }
            </div>
          </div>
        }

        <footer>
          <button type="button" class="btn btn-outline-secondary btn-sm" [disabled]="step() === 0 || saving() || sliding()" (click)="previous()">Précédent</button>
          @if (step() < steps.length - 1) {
            <button type="button" class="btn btn-primary btn-sm" [disabled]="saving() || sliding() || !!loadError()" (click)="next()">{{ saving() ? 'Enregistrement…' : 'Continuer' }}</button>
          } @else {
            <button type="button" class="btn btn-primary btn-sm" [disabled]="saving() || submitting() || sliding()" (click)="submit()">{{ submitting() ? 'Envoi…' : 'Soumettre la candidature' }}</button>
          }
        </footer>
      </section>
    </main>

    @if (preview(); as file) {
      <div class="file-modal" role="dialog" aria-modal="true" (click)="closePreview()">
        <div class="file-dialog" (click)="$event.stopPropagation()">
          <header>
            <strong>{{ file.name }}</strong>
            <button type="button" class="btn-close" aria-label="Fermer" [disabled]="previewBusy()" (click)="closePreview()"></button>
          </header>
          <div class="file-stage">
            @if (file.kind === 'image') {
              <img [src]="file.url" [alt]="file.name" />
            } @else {
              @if (previewUrl(); as src) {
                <iframe [src]="src" title="Aperçu PDF"></iframe>
              }
            }
          </div>
          @if (previewError()) { <p class="field-error px-3 mb-0">{{ previewError() }}</p> }
          <footer>
            @if (file.mode === 'confirm') {
              <button type="button" class="btn btn-outline-secondary btn-sm" [disabled]="previewBusy()" (click)="closePreview()">Annuler</button>
              <button type="button" class="btn btn-primary btn-sm" [disabled]="previewBusy()" (click)="confirmPreview()">{{ previewBusy() ? 'Envoi…' : 'Valider' }}</button>
            } @else {
              <button type="button" class="btn btn-outline-danger btn-sm" [disabled]="previewBusy()" (click)="deletePreview()">Supprimer</button>
              <label class="btn btn-outline-secondary btn-sm mb-0">
                Remplacer
                <input type="file" hidden accept="application/pdf,image/jpeg,image/png,image/webp,image/gif" (change)="replacePreview($event)" />
              </label>
              <button type="button" class="btn btn-primary btn-sm" [disabled]="previewBusy()" (click)="closePreview()">Fermer</button>
            }
          </footer>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display:block; min-height:100vh; background:#f5f5f3; }
    .wizard-shell { max-width:860px; margin:auto; padding:.75rem .75rem 2rem; }
    header { display:flex; justify-content:space-between; align-items:center; margin-bottom:.75rem; }
    .brand { display:inline-flex; align-items:center; text-decoration:none; }
    .brand-logo { height:1.85rem; width:auto; display:block; object-fit:contain; }
    .wizard-card { background:var(--bs-body-bg); border:1px solid var(--bs-border-color); border-radius:.85rem; padding:1rem 1.1rem; box-shadow:0 8px 24px rgba(0,0,0,.05); }
    .wizard-title, footer { display:flex; justify-content:space-between; align-items:center; gap:.75rem; }
    h1 { font-size:1.25rem; margin:.1rem 0 0; }
    .progress { height:.3rem; background:#f0e7b0; border-radius:999px; overflow:hidden; margin:.65rem 0 .85rem; }
    .progress-bar { background:#ffd500 !important; transition:width .35s ease; }
    .step-viewport { overflow:hidden; position:relative; }
    .step-panel { will-change:transform, opacity; }
    .step-viewport[data-phase='out'][data-dir='next'] .step-panel { animation:wizard-out-left .22s ease forwards; }
    .step-viewport[data-phase='out'][data-dir='prev'] .step-panel { animation:wizard-out-right .22s ease forwards; }
    .step-viewport[data-phase='in'][data-dir='next'] .step-panel { animation:wizard-in-right .24s ease both; }
    .step-viewport[data-phase='in'][data-dir='prev'] .step-panel { animation:wizard-in-left .24s ease both; }
    @keyframes wizard-out-left { from { transform:translateX(0); opacity:1; } to { transform:translateX(-18%); opacity:0; } }
    @keyframes wizard-out-right { from { transform:translateX(0); opacity:1; } to { transform:translateX(18%); opacity:0; } }
    @keyframes wizard-in-right { from { transform:translateX(18%); opacity:0; } to { transform:translateX(0); opacity:1; } }
    @keyframes wizard-in-left { from { transform:translateX(-18%); opacity:0; } to { transform:translateX(0); opacity:1; } }
    @media (prefers-reduced-motion: reduce) {
      .step-viewport[data-phase] .step-panel { animation:none !important; }
      .progress-bar { transition:none; }
    }
    .form-grid { display:grid; grid-template-columns:1fr 1fr; gap:.55rem .75rem; }
    label { font-size:.78rem; font-weight:600; color:var(--bs-secondary-color); }
    label input, label select { margin-top:.2rem; }
    .span-2 { grid-column:span 2; }
    .req { color:#c0392b; }
    .field-error { display:block; color:#c0392b; font-size:.72rem; font-weight:600; margin-top:.15rem; }
    .form-alert { background:#fdecea; color:#9b2c2c; border-radius:.45rem; padding:.45rem .65rem; font-size:.82rem; margin:0 0 .7rem; }
    .choice-group { border:0; margin:0 0 .75rem; padding:0; }
    legend { font-size:.85rem; font-weight:700; border-bottom:1px solid var(--bs-border-color); padding-bottom:.3rem; }
    .choice-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:.35rem .6rem; }
    .outlet { border:1px solid var(--bs-border-color); border-radius:.55rem; padding:.65rem .7rem; margin-bottom:.55rem; }
    .document-row { display:grid; grid-template-columns:1fr auto; gap:.75rem; align-items:center; border-bottom:1px solid var(--bs-border-color); padding:.45rem 0; }
    .doc-actions { display:flex; align-items:center; gap:.65rem; }
    .recap { display:grid; grid-template-columns:1fr 1fr; gap:.55rem; }
    .recap div { border:1px solid var(--bs-border-color); border-radius:.5rem; padding:.55rem .7rem; display:grid; }
    .recap span { color:var(--bs-secondary-color); font-size:.72rem; }
    footer { border-top:1px solid var(--bs-border-color); margin-top:.9rem; padding-top:.75rem; }
    .file-modal { position:fixed; inset:0; z-index:1080; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; padding:1rem; }
    .file-dialog { width:min(920px, 100%); max-height:min(92vh, 820px); background:#fff; border-radius:.75rem; display:flex; flex-direction:column; overflow:hidden; }
    .file-dialog header, .file-dialog footer { display:flex; align-items:center; justify-content:space-between; gap:.5rem; padding:.65rem .85rem; }
    .file-dialog header { border-bottom:1px solid var(--bs-border-color); }
    .file-dialog footer { border-top:1px solid var(--bs-border-color); justify-content:flex-end; }
    .file-stage { flex:1; min-height:240px; background:#f3f3f1; display:flex; align-items:center; justify-content:center; }
    .file-stage img, .file-stage iframe { width:100%; height:min(68vh, 640px); border:0; object-fit:contain; background:#fff; }
    @media(max-width:600px) {
      .form-grid,.choice-grid,.recap,.document-row { grid-template-columns:1fr; }
      .span-2 { grid-column:auto; }
      .doc-actions { justify-content:flex-start; }
    }
  `,
})
export class OnboardingWizardPageComponent implements OnInit {
  private readonly service = inject(OnboardingService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly appSettings = inject(AppSettingsService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly logoUrl = computed(
    () => this.appSettings.settings().logo_light || '/branding/logo-light1.png'
  );

  readonly steps = [
    { label: 'Identification' },
    { label: 'Gérant' },
    { label: 'Entreprise' },
    { label: 'Services' },
    { label: 'Points de vente' },
    { label: 'Documents' },
    { label: 'Récapitulatif' },
  ];
  readonly step = signal(0);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly submitting = signal(false);
  readonly sliding = signal(false);
  readonly slideDir = signal<'next' | 'prev'>('next');
  readonly slidePhase = signal<'idle' | 'out' | 'in'>('idle');
  readonly refs = signal<OnboardingReferentiels>({});
  readonly errors = signal<Record<string, string>>({});
  readonly formError = signal('');
  readonly loadError = signal('');
  readonly preview = signal<PreviewState | null>(null);
  readonly previewBusy = signal(false);
  readonly previewError = signal('');
  readonly previewUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.preview()?.url;
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
  readonly progress = computed(() => ((this.step() + 1) / this.steps.length) * 100);
  readonly serviceFamilies = computed(() => {
    const groups = new Map<string, OnboardingOption[]>();
    for (const item of this.refs().services || []) {
      const name = item.famille || 'Autres services';
      groups.set(name, [...(groups.get(name) || []), item]);
    }
    return [...groups.entries()].map(([name, items]) => ({ name, items }));
  });

  provinces: GeoLieu[] = [];
  entProvinceId: number | null = null;
  entVilleId: number | null = null;
  entCommuneId: number | null = null;
  entVilles: GeoLieu[] = [];
  entCommunes: GeoLieu[] = [];
  outletGeo: OutletGeo[] = [this.emptyGeo()];
  private readonly villeCache = new Map<number, GeoLieu[]>();
  private readonly communeCache = new Map<number, GeoLieu[]>();

  draft: CandidatureDraft = {
    email: '',
    telephone: '',
    representant: { nom: '', prenom: '', telephone: '', email: '' },
    entreprise: {
      raison_sociale: '',
      nom_commercial: '',
      forme_juridique: '',
      adresse: '',
      ville: '',
      province: '',
      commune: '',
    },
    services: [],
    points_vente: [{ nom: '', adresse: '', ville: '', province: '', commune: '', principal: true }],
    documents: [],
  };
  private draftId?: number | string;
  private token = '';

  async ngOnInit(): Promise<void> {
    try {
      const [refs, provinces] = await Promise.all([
        firstValueFrom(this.service.referentiels()),
        firstValueFrom(this.service.provinces()).catch(() => [] as GeoLieu[]),
      ]);
      this.refs.set(refs || {});
      this.provinces = provinces || [];
      this.draft.documents = (refs?.types_documents || []).map((item) => ({
        type_code: item.code,
        type_libelle: item.libelle,
        statut: 'À fournir',
        a_fichier: false,
      }));
    } catch {
      this.loadError.set('Impossible de charger le formulaire. Rechargez la page.');
    } finally {
      this.loading.set(false);
    }
  }

  err(key: string): string {
    return this.errors()[key] || '';
  }

  touch(): void {
    if (this.formError()) this.formError.set('');
    if (Object.keys(this.errors()).length) this.errors.set({});
  }

  docLabel(doc: CandidatureDocument): string {
    if (doc.type_code === 'PIECE_RL') return "Pièce d'identité du gérant";
    return doc.type_libelle || doc.type_code;
  }

  docRequired(code: string): boolean {
    return !!this.refs().types_documents?.find((item) => item.code === code)?.obligatoire;
  }

  fichiersFournis(): number {
    return this.draft.documents.filter((doc) => doc.a_fichier).length;
  }

  lieuLabel(province?: string, ville?: string, commune?: string): string {
    return [commune, ville, province].filter(Boolean).join(', ') || '—';
  }

  toggleService(code: string, checked: boolean): void {
    this.touch();
    this.draft.services = checked
      ? [...new Set([...this.draft.services, code])]
      : this.draft.services.filter((item) => item !== code);
  }

  addOutlet(): void {
    this.draft.points_vente.push({
      nom: '',
      adresse: '',
      ville: '',
      province: '',
      commune: '',
      principal: false,
    });
    this.outletGeo = [...this.outletGeo, this.emptyGeo()];
  }

  removeOutlet(index: number): void {
    if (this.draft.points_vente.length === 1) return;
    const wasPrincipal = this.draft.points_vente[index].principal;
    this.draft.points_vente.splice(index, 1);
    this.outletGeo.splice(index, 1);
    this.outletGeo = [...this.outletGeo];
    if (wasPrincipal) this.draft.points_vente[0].principal = true;
  }

  setPrincipal(index: number): void {
    this.draft.points_vente.forEach((item, i) => (item.principal = i === index));
  }

  async onEntProvince(value: number | null): Promise<void> {
    this.touch();
    const id = this.asId(value);
    this.entProvinceId = id;
    this.entVilleId = null;
    this.entCommuneId = null;
    this.entVilles = [];
    this.entCommunes = [];
    this.draft.entreprise.ville = '';
    this.draft.entreprise.commune = '';
    this.draft.entreprise.province = this.provinces.find((item) => item.id === id)?.libelle || '';
    if (id) this.entVilles = await this.villesOf(id);
  }

  async onEntVille(value: number | null): Promise<void> {
    this.touch();
    const id = this.asId(value);
    this.entVilleId = id;
    this.entCommuneId = null;
    this.entCommunes = [];
    this.draft.entreprise.commune = '';
    this.draft.entreprise.ville = this.entVilles.find((item) => item.id === id)?.libelle || '';
    if (id) this.entCommunes = await this.communesOf(id);
  }

  onEntCommune(value: number | null): void {
    this.touch();
    const id = this.asId(value);
    this.entCommuneId = id;
    this.draft.entreprise.commune = this.entCommunes.find((item) => item.id === id)?.libelle || '';
  }

  async onOutletProvince(index: number, value: number | null): Promise<void> {
    this.touch();
    const id = this.asId(value);
    const outlet = this.draft.points_vente[index];
    outlet.province = this.provinces.find((item) => item.id === id)?.libelle || '';
    outlet.ville = '';
    outlet.commune = '';
    const villes = id ? await this.villesOf(id) : [];
    this.outletGeo[index] = { provinceId: id, villeId: null, villes, communes: [] };
    this.outletGeo = [...this.outletGeo];
  }

  async onOutletVille(index: number, value: number | null): Promise<void> {
    this.touch();
    const id = this.asId(value);
    const geo = this.outletGeo[index];
    const outlet = this.draft.points_vente[index];
    outlet.ville = geo.villes.find((item) => item.id === id)?.libelle || '';
    outlet.commune = '';
    const communes = id ? await this.communesOf(id) : [];
    this.outletGeo[index] = { ...geo, villeId: id, communes };
    this.outletGeo = [...this.outletGeo];
  }

  onOutletCommune(index: number, value: number | null): void {
    this.touch();
    const id = this.asId(value);
    const commune = this.outletGeo[index].communes.find((item) => item.id === id);
    this.draft.points_vente[index].commune = commune?.libelle || '';
  }

  outletCommuneId(index: number): number | null {
    const name = this.draft.points_vente[index]?.commune;
    if (!name) return null;
    return this.outletGeo[index]?.communes.find((item) => item.libelle === name)?.id ?? null;
  }

  async next(): Promise<void> {
    if (this.sliding() || this.saving()) return;
    const found = this.validate(this.step());
    this.errors.set(found);
    if (Object.keys(found).length) {
      this.formError.set('Corrigez les champs indiqués.');
      return;
    }
    this.formError.set('');
    if (!(await this.persist())) {
      this.formError.set("L'enregistrement a échoué. Réessayez.");
      return;
    }
    await this.goToStep(Math.min(this.step() + 1, this.steps.length - 1), 'next');
  }

  async previous(): Promise<void> {
    if (this.sliding() || this.saving() || this.step() === 0) return;
    this.errors.set({});
    this.formError.set('');
    await this.persist();
    await this.goToStep(Math.max(this.step() - 1, 0), 'prev');
  }

  async submit(): Promise<void> {
    for (let index = 0; index < this.steps.length - 1; index++) {
      const found = this.validate(index);
      if (Object.keys(found).length) {
        this.errors.set(found);
        this.formError.set('Corrigez les champs indiqués.');
        await this.goToStep(index, index < this.step() ? 'prev' : 'next');
        return;
      }
    }
    if (!(await this.persist()) || !this.draftId || !this.token) {
      this.formError.set("L'enregistrement a échoué. Réessayez.");
      return;
    }
    this.submitting.set(true);
    try {
      const result = await firstValueFrom(this.service.submit(this.draftId, this.token));
      this.persistAccess(result.reference, result.jeton || this.token);
      this.toast.success('Votre candidature a été soumise.');
      await this.router.navigate(['/devenir-distributeur/suivi'], {
        queryParams: { reference: result.reference, jeton: result.jeton || this.token },
      });
    } catch {
      this.toast.error("La candidature n'a pas pu être soumise.");
    } finally {
      this.submitting.set(false);
    }
  }

  pickDocument(doc: CandidatureDocument, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.stageFile(doc.type_code, file);
  }

  replacePreview(event: Event): void {
    const current = this.preview();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!current || !file) return;
    this.stageFile(current.typeCode, file);
  }

  async confirmPreview(): Promise<void> {
    const current = this.preview();
    if (!current?.file || this.previewBusy()) return;
    this.previewBusy.set(true);
    this.previewError.set('');
    try {
      if (!(await this.persist()) || !this.draftId || !this.token) {
        this.previewError.set("L'enregistrement a échoué. Réessayez.");
        return;
      }
      const saved = await firstValueFrom(
        this.service.uploadDocument(this.draftId, current.typeCode, current.file, this.token)
      );
      const row = this.draft.documents.find((item) => item.type_code === current.typeCode);
      if (row) {
        row.a_fichier = true;
        row.nom_fichier = saved.nom_fichier || current.file.name;
        row.content_type = saved.content_type || current.file.type;
        row.statut = 'Fourni';
        row.id = saved.id;
      }
      this.touch();
      this.closePreview(true);
    } catch {
      this.previewError.set("Le fichier n'a pas pu être enregistré.");
    } finally {
      this.previewBusy.set(false);
    }
  }

  async openStored(doc: CandidatureDocument): Promise<void> {
    if (!doc.a_fichier || !this.draftId || !this.token) return;
    this.previewBusy.set(true);
    try {
      const blob = await firstValueFrom(
        this.service.downloadDocument(this.draftId, doc.type_code, this.token)
      );
      const kind = blob.type.startsWith('image/') ? 'image' : 'pdf';
      this.setPreview({
        typeCode: doc.type_code,
        name: doc.nom_fichier || this.docLabel(doc),
        url: URL.createObjectURL(blob),
        kind,
        mode: 'view',
      });
    } catch {
      this.formError.set('Impossible d’ouvrir le fichier.');
    } finally {
      this.previewBusy.set(false);
    }
  }

  async removeDocument(doc: CandidatureDocument): Promise<void> {
    if (!this.draftId || !this.token) {
      doc.a_fichier = false;
      doc.nom_fichier = undefined;
      return;
    }
    try {
      await firstValueFrom(this.service.deleteDocument(this.draftId, doc.type_code, this.token));
      doc.a_fichier = false;
      doc.nom_fichier = undefined;
      doc.content_type = undefined;
      doc.statut = 'À fournir';
    } catch {
      this.formError.set('Impossible de retirer le fichier.');
    }
  }

  async deletePreview(): Promise<void> {
    const current = this.preview();
    if (!current) return;
    const doc = this.draft.documents.find((item) => item.type_code === current.typeCode);
    if (doc) await this.removeDocument(doc);
    if (!doc?.a_fichier) this.closePreview(true);
  }

  closePreview(force = false): void {
    if (this.previewBusy() && !force) return;
    const current = this.preview();
    if (current?.url) URL.revokeObjectURL(current.url);
    this.preview.set(null);
    this.previewError.set('');
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.preview()) this.closePreview();
  }

  private stageFile(typeCode: string, file: File): void {
    const kind = this.fileKind(file);
    if (!kind) {
      this.previewError.set('Format accepté : PDF ou image.');
      this.formError.set('Format accepté : PDF ou image.');
      return;
    }
    if (file.size > MAX_FILE) {
      this.formError.set('Fichier trop volumineux (8 Mo max).');
      this.previewError.set('Fichier trop volumineux (8 Mo max).');
      return;
    }
    this.formError.set('');
    this.previewError.set('');
    this.setPreview({
      typeCode,
      name: file.name,
      url: URL.createObjectURL(file),
      kind,
      mode: 'confirm',
      file,
    });
  }

  private setPreview(next: PreviewState): void {
    const current = this.preview();
    if (current?.url && current.url !== next.url) URL.revokeObjectURL(current.url);
    this.preview.set(next);
  }

  private fileKind(file: File): 'image' | 'pdf' | null {
    const name = file.name.toLowerCase();
    if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
    if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/.test(name)) return 'image';
    return null;
  }

  private async villesOf(provinceId: number): Promise<GeoLieu[]> {
    const cached = this.villeCache.get(provinceId);
    if (cached) return cached;
    try {
      const rows = await firstValueFrom(this.service.villes(provinceId));
      this.villeCache.set(provinceId, rows);
      return rows;
    } catch {
      this.formError.set('Impossible de charger les villes.');
      return [];
    }
  }

  private async communesOf(villeId: number): Promise<GeoLieu[]> {
    const cached = this.communeCache.get(villeId);
    if (cached) return cached;
    try {
      const rows = await firstValueFrom(this.service.communes(villeId));
      this.communeCache.set(villeId, rows);
      return rows;
    } catch {
      this.formError.set('Impossible de charger les communes.');
      return [];
    }
  }

  private validate(step: number): Record<string, string> {
    const found: Record<string, string> = {};
    const need = (key: string, value?: string | null) => {
      if (!value || !value.trim()) found[key] = 'Champ obligatoire.';
    };
    if (step === 0) {
      need('email', this.draft.email);
      if (this.draft.email?.trim() && !this.emailOk(this.draft.email)) found['email'] = 'Adresse e-mail invalide.';
      need('telephone', this.draft.telephone);
      if (this.draft.telephone?.trim() && !this.phoneOk(this.draft.telephone)) {
        found['telephone'] = 'Numéro de téléphone invalide.';
      }
    }
    if (step === 1) {
      need('nom', this.draft.representant.nom);
      need('prenom', this.draft.representant.prenom);
      if (this.draft.representant.email?.trim() && !this.emailOk(this.draft.representant.email)) {
        found['emailGerant'] = 'Adresse e-mail invalide.';
      }
      if (this.draft.representant.telephone?.trim() && !this.phoneOk(this.draft.representant.telephone)) {
        found['telGerant'] = 'Numéro de téléphone invalide.';
      }
    }
    if (step === 2) {
      need('raison', this.draft.entreprise.raison_sociale);
      need('forme', this.draft.entreprise.forme_juridique);
      need('adresse', this.draft.entreprise.adresse);
      need('province', this.draft.entreprise.province);
      need('ville', this.draft.entreprise.ville);
      if (this.entCommunes.length) need('commune', this.draft.entreprise.commune);
    }
    if (step === 3 && !this.draft.services.length) {
      found['services'] = 'Sélectionnez au moins un service.';
    }
    if (step === 4) {
      if (!this.draft.points_vente.length) found['points'] = 'Ajoutez un point de vente.';
      this.draft.points_vente.forEach((outlet, index) => {
        need(`pv${index}nom`, outlet.nom);
        need(`pv${index}adresse`, outlet.adresse);
        need(`pv${index}province`, outlet.province);
        need(`pv${index}ville`, outlet.ville);
        if (this.outletGeo[index]?.communes.length) need(`pv${index}commune`, outlet.commune);
      });
    }
    if (step === 5) {
      for (const doc of this.draft.documents) {
        if (this.docRequired(doc.type_code) && !doc.a_fichier) {
          found['doc' + doc.type_code] = 'Document obligatoire.';
        }
      }
    }
    return found;
  }

  private emailOk(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  private phoneOk(value: string): boolean {
    return value.replace(/\D/g, '').length >= 8;
  }

  private async persist(): Promise<boolean> {
    this.saving.set(true);
    try {
      const result =
        this.draftId && this.token
          ? await firstValueFrom(this.service.updateDraft(this.draftId, this.draft, this.token))
          : await firstValueFrom(this.service.createDraft(this.draft));
      this.draftId = result.id;
      this.token = result.jeton || this.token;
      this.persistAccess(result.reference, this.token);
      this.mergeDocs(result.documents);
      return !!this.draftId && !!this.token;
    } catch {
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private mergeDocs(docs: CandidatureDocument[] | undefined): void {
    for (const server of docs || []) {
      const local = this.draft.documents.find((item) => item.type_code === server.type_code);
      if (!local) continue;
      local.id = server.id ?? local.id;
      if (server.a_fichier) {
        local.a_fichier = true;
        local.nom_fichier = server.nom_fichier || local.nom_fichier;
        local.content_type = server.content_type || local.content_type;
        local.statut = 'Fourni';
      }
    }
  }

  private async goToStep(target: number, dir: 'next' | 'prev'): Promise<void> {
    if (target === this.step()) return;
    this.sliding.set(true);
    this.slideDir.set(dir);
    this.slidePhase.set('out');
    await wait(220);
    this.step.set(target);
    this.slidePhase.set('in');
    await wait(240);
    this.slidePhase.set('idle');
    this.sliding.set(false);
  }

  private persistAccess(reference?: string, token?: string): void {
    if (reference) localStorage.setItem(STORAGE_REFERENCE, reference);
    if (token) localStorage.setItem(STORAGE_TOKEN, token);
  }

  private emptyGeo(): OutletGeo {
    return { provinceId: null, villeId: null, villes: [], communes: [] };
  }

  private asId(value: number | string | null): number | null {
    if (value === null || value === undefined || value === '') return null;
    const id = Number(value);
    return Number.isFinite(id) ? id : null;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
