import { Component, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { map } from 'rxjs';
import { PilotageAgence, PilotageAgenceScope } from '../../../core/models/pilotage.models';
import { PilotageService } from '../../../core/services/pilotage.service';
import { SearchSelectOption } from '../../../shared/components/search-select/search-select.component';
import { SearchMultiSelectComponent } from '../../../shared/components/search-multi-select/search-multi-select.component';

@Component({
  selector: 'app-pilotage-agency-select',
  standalone: true,
  imports: [CommonModule, SearchMultiSelectComponent],
  template: `
    <app-search-multi-select
      #select
      placeholder="Agence…"
      searchPlaceholder="Code, nom, POS…"
      [loader]="loadAgencies"
      [initialLimit]="10"
      [searchLimit]="20"
      [prefetchOnInit]="true"
      [minSearchLength]="1"
      autocompleteField="flash-pilotage-agence-q"
      [selectedIds]="selectedIds"
      (selectedIdsChange)="selectedIdsChange.emit($event)"
    />
  `,
})
export class PilotageAgencySelectComponent {
  private readonly pilotage = inject(PilotageService);

  @ViewChild('select') select?: SearchMultiSelectComponent;

  @Input() selectedIds: number[] = [];
  @Input() agenceScope: PilotageAgenceScope = {};
  @Output() selectedIdsChange = new EventEmitter<number[]>();

  loadAgencies = (search: string, limit: number) =>
    this.pilotage.searchAgences(search, limit, this.agenceScope).pipe(
      map((rows) =>
        rows.map((a): SearchSelectOption => pilotageAgenceOption(a))
      )
    );

  reset(): void {
    this.select?.reset();
  }
}

function pilotageAgenceOption(a: PilotageAgence): SearchSelectOption {
  const code = (a.codeAgence || '').trim();
  const nom = (a.nom || '').trim();
  const pos = (a.pos_id || '').trim();
  const fp = (a.fp_agent || '').trim();
  const idLine = pos || fp;

  if (code) {
    const hintParts = [nom, idLine].filter(Boolean);
    return {
      id: a.agenceId,
      label: code,
      hint: hintParts.length ? hintParts.join(' · ') : undefined,
    };
  }

  if (nom && idLine) {
    return { id: a.agenceId, label: nom, hint: idLine };
  }

  return {
    id: a.agenceId,
    label: nom || idLine || `#${a.agenceId}`,
  };
}
