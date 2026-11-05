import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

interface SubNavItem {
  label: string;
  path: string;
  permission: string;
}

@Component({
  selector: 'app-parametrages-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, PageHeaderComponent],
  template: `
    <div class="parametrages-shell">
      <app-page-header title="Paramétrages" subtitle="Administration de l'application" />

      <nav class="parametrages-subnav-bar nav" aria-label="Sections paramétrages">
        @for (item of visibleNav; track item.path) {
          <a class="nav-link" [routerLink]="item.path" routerLinkActive="active">{{ item.label }}</a>
        }
      </nav>

      <router-outlet />
    </div>
  `,
})
export class ParametragesLayoutPageComponent {
  private readonly auth = inject(AuthService);

  private readonly items: SubNavItem[] = [
    { label: 'Utilisateurs', path: '/parametrages/utilisateurs', permission: 'auth.utilisateurs.lire' },
    { label: 'Rôles', path: '/parametrages/roles', permission: 'auth.roles.lire' },
    { label: 'Permissions', path: '/parametrages/permissions', permission: 'auth.permissions.lire' },
    { label: 'Réglages système', path: '/parametrages/systeme', permission: 'auth.parametres.lire' },
    { label: 'Référentiels', path: '/parametrages/referentiels', permission: 'referentiels.geo.lire' },
    { label: 'Actions utilisateur', path: '/parametrages/actions', permission: 'audit.actions.lire' },
  ];

  get visibleNav(): SubNavItem[] {
    return this.items.filter((i) => {
      if (i.path === '/parametrages/referentiels') {
        return this.auth.can('referentiels.geo.lire') || this.auth.can('referentiels.zones.lire');
      }
      return this.auth.can(i.permission);
    });
  }
}
