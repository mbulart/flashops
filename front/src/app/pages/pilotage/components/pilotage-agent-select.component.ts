import { Component, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { map } from 'rxjs';
import { PilotageAgenceScope } from '../../../core/models/pilotage.models';
import { PilotageService } from '../../../core/services/pilotage.service';
import { SearchSelectOption } from '../../../shared/components/search-select/search-select.component';
import { SearchMultiSelectComponent } from '../../../shared/components/search-multi-select/search-multi-select.component';

@Component({
  selector: 'app-pilotage-agent-select',
  standalone: true,
  imports: [CommonModule, SearchMultiSelectComponent],
  template: `
    <app-search-multi-select
      #select
      placeholder="Agent…"
      searchPlaceholder="Nom…"
      [loader]="loadAgents"
      [initialLimit]="10"
      [searchLimit]="20"
      [prefetchOnInit]="true"
      autocompleteField="flash-pilotage-agent-q"
      [selectedIds]="selectedIds"
      (selectedIdsChange)="selectedIdsChange.emit($event)"
    />
  `,
})
export class PilotageAgentSelectComponent {
  private readonly pilotage = inject(PilotageService);

  @ViewChild('select') select?: SearchMultiSelectComponent;

  /** Une seule agence : filtre la recherche agents ; plusieurs ou aucune : tous les agents. */
  @Input() agenceIds: number[] = [];
  @Input() agenceScope: PilotageAgenceScope = {};
  @Input() selectedIds: number[] = [];
  @Output() selectedIdsChange = new EventEmitter<number[]>();

  loadAgents = (search: string, limit: number) => {
    const scopeAgenceId = this.agenceIds.length === 1 ? this.agenceIds[0] : null;
    return this.pilotage.searchAgents(search, scopeAgenceId, limit, this.agenceScope).pipe(
      map((rows) =>
        rows.map(
          (a): SearchSelectOption => ({
            id: a.agentId,
            label: a.nom,
          })
        )
      )
    );
  };

  reset(): void {
    this.select?.reset();
  }
}
