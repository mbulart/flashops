import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { DemandeNonTraitee } from '../models/onboarding.models';
import { AuthService } from './auth.service';
import { OnboardingService } from './onboarding.service';

@Injectable({ providedIn: 'root' })
export class OnboardingAlertsService {
  private readonly auth = inject(AuthService);
  private readonly onboarding = inject(OnboardingService);
  private readonly router = inject(Router);
  private started = false;

  readonly count = signal(0);
  readonly items = signal<DemandeNonTraitee[]>([]);

  start(): void {
    if (this.started) return;
    this.started = true;
    this.refresh();
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.refresh());
    setInterval(() => this.refresh(), 60_000);
  }

  refresh(): void {
    if (!this.auth.isAuthenticated() || !this.auth.can('onboarding.candidatures.lire')) {
      this.count.set(0);
      this.items.set([]);
      return;
    }
    this.onboarding.untreated().subscribe({
      next: (data) => {
        this.count.set(data?.count ?? 0);
        this.items.set(data?.items ?? []);
      },
      error: () => {
        /* le menu reste utilisable si le compteur échoue */
      },
    });
  }

  label(statut: string | null | undefined): string {
    switch (statut) {
      case 'soumise':
        return 'Soumise';
      case 'en_cours':
        return 'En cours';
      case 'complement':
        return 'Complément';
      case 'suspendue':
        return 'Suspendue';
      default:
        return statut || 'En attente';
    }
  }
}
