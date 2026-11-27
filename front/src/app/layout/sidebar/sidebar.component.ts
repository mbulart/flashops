import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';
import { CanPermissionDirective } from '../../shared/directives/can-permission.directive';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/services/auth.service';
import { OnboardingAlertsService } from '../../core/services/onboarding-alerts.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  permission: string | string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const STORAGE_KEY = 'flashops_sidebar_groups_open';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, CanPermissionDirective],
  template: `
    <aside class="app-sidebar" [class.collapsed]="collapsed">
      <div class="sidebar-brand">
        @if (brandLogo()) {
          <img class="sidebar-brand-logo" [src]="brandLogo()" [alt]="appName()" />
        } @else {
          <span class="brand-mark">{{ appShortName() }}</span>
        }
        @if (!collapsed) {
          <span class="brand-text">{{ appName() }}</span>
        }
      </div>

      <nav class="sidebar-nav">
        @for (group of visibleGroups(); track group.label) {
          <div class="sidebar-group" [class.is-open]="isGroupOpen(group.label)" [class.is-closed]="!isGroupOpen(group.label)">
            @if (!collapsed) {
              <button
                type="button"
                class="sidebar-group-toggle"
                (click)="toggleGroup(group.label)"
                [attr.aria-expanded]="isGroupOpen(group.label)"
                [attr.aria-controls]="'nav-group-' + groupKey(group.label)"
              >
                <span class="sidebar-group-label">{{ group.label }}</span>
                <i class="bi" [class.bi-chevron-down]="isGroupOpen(group.label)" [class.bi-chevron-right]="!isGroupOpen(group.label)"></i>
              </button>
            }
            <div
              class="sidebar-group-items"
              [id]="'nav-group-' + groupKey(group.label)"
              [class.is-collapsed]="!collapsed && !isGroupOpen(group.label)"
              [attr.aria-hidden]="!collapsed && !isGroupOpen(group.label) ? 'true' : null"
            >
              <div class="sidebar-group-items-inner">
                @for (item of group.items; track item.path) {
                  <ng-container *appCanPermission="item.permission">
                    <a
                      [routerLink]="item.path"
                      routerLinkActive="active"
                      [routerLinkActiveOptions]="{ exact: item.path === '/' }"
                      class="sidebar-link"
                      (click)="navigate.emit()"
                    >
                      <i [class]="item.icon"></i>
                      @if (!collapsed) {
                        <span class="sidebar-link-label">{{ item.label }}</span>
                        @if (badge(item.path); as n) {
                          <span class="sidebar-count">{{ n > 99 ? '99+' : n }}</span>
                        }
                      } @else if (badge(item.path)) {
                        <span class="sidebar-count is-dot" aria-hidden="true"></span>
                      }
                    </a>
                  </ng-container>
                }
              </div>
            </div>
          </div>
        }
      </nav>
    </aside>
  `,
  styles: `
    .sidebar-group-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      width: 100%;
      margin: 0;
      padding: 0.35rem 0.85rem 0.15rem;
      border: 0;
      background: transparent;
      color: var(--text-muted);
      cursor: pointer;
      border-radius: 0.4rem;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .sidebar-group-toggle:hover {
      background: var(--flash-gray-100, rgba(0, 0, 0, 0.04));
      color: var(--text-primary);
    }

    :host-context([data-bs-theme='dark']) .sidebar-group-toggle:hover {
      background: #2a2a2a;
    }

    .sidebar-group-toggle .sidebar-group-label {
      padding: 0;
      text-align: left;
    }

    .sidebar-group-toggle i {
      font-size: 0.75rem;
      opacity: 0.75;
      flex: 0 0 auto;
      transition: transform 0.22s ease;
    }

    .sidebar-group-items {
      display: grid;
      grid-template-rows: 1fr;
      opacity: 1;
      transition:
        grid-template-rows 0.28s ease,
        opacity 0.22s ease;
    }

    .sidebar-link-label { flex: 1; min-width: 0; }
    .sidebar-count {
      margin-left: auto;
      min-width: 1.35rem;
      height: 1.35rem;
      padding: 0 0.35rem;
      border-radius: 999px;
      background: #e11d2e;
      color: #fff;
      font-size: 0.72rem;
      font-weight: 700;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .sidebar-count.is-dot {
      position: absolute;
      top: 0.35rem;
      right: 0.35rem;
      min-width: 0.55rem;
      width: 0.55rem;
      height: 0.55rem;
      padding: 0;
    }
    .sidebar-link { position: relative; }

    .sidebar-group-items.is-collapsed {
      grid-template-rows: 0fr;
      opacity: 0;
      pointer-events: none;
    }

    .sidebar-group-items-inner {
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
  `,
})
export class SidebarComponent implements OnInit {
  @Input() collapsed = false;
  @Output() navigate = new EventEmitter<void>();

  private readonly appSettings = inject(AppSettingsService);
  private readonly theme = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly alerts = inject(OnboardingAlertsService);

  private readonly openGroups = signal<Record<string, boolean>>({});

  readonly appName = computed(() => this.appSettings.settings().app_name);
  readonly appShortName = computed(() => this.appSettings.settings().app_short_name);
  readonly brandLogo = computed(() => {
    const settings = this.appSettings.settings();
    return this.theme.mode() === 'dark'
      ? settings.logo_dark || settings.logo_light
      : settings.logo_light || settings.logo_dark;
  });

  readonly navGroups: NavGroup[] = [
    {
      label: 'Flash OPS',
      items: [
        { label: 'Tableau de bord', path: '/', icon: 'bi bi-speedometer2', permission: 'dashboard.voir' },
        { label: 'Agences', path: '/agences', icon: 'bi bi-building', permission: 'agences.lire' },
        {
          label: 'Transactions',
          path: '/transactions',
          icon: 'bi bi-receipt',
          permission: ['transactions.lire', 'dashboard.voir'],
        },
      ],
    },
    {
      label: 'Appros',
      items: [
        {
          label: 'Appro. MOMO',
          path: '/approvisionnement-vas/momo',
          icon: 'bi bi-phone',
          permission: 'approvisionnement.vas.lire',
        },
        {
          label: 'Appro. TELCO',
          path: '/approvisionnement-vas/telco',
          icon: 'bi bi-reception-4',
          permission: 'approvisionnement.vas.lire',
        },
      ],
    },
    {
      label: 'Onboarding',
      items: [
        {
          label: 'Candidatures',
          path: '/onboarding/candidatures',
          icon: 'bi bi-person-badge',
          permission: 'onboarding.candidatures.lire',
        },
        {
          label: 'Mes tâches',
          path: '/onboarding/taches',
          icon: 'bi bi-list-check',
          permission: 'onboarding.taches.lire',
        },
        {
          label: 'Administration',
          path: '/onboarding/admin',
          icon: 'bi bi-sliders',
          permission: ['onboarding.admin', 'workflow.admin'],
        },
      ],
    },
    {
      label: 'Paramétrages',
      items: [
        {
          label: 'Utilisateurs',
          path: '/parametrages/utilisateurs',
          icon: 'bi bi-people',
          permission: 'auth.utilisateurs.lire',
        },
        {
          label: 'Rôles',
          path: '/parametrages/roles',
          icon: 'bi bi-shield',
          permission: 'auth.roles.lire',
        },
        {
          label: 'Permissions',
          path: '/parametrages/permissions',
          icon: 'bi bi-key',
          permission: 'auth.permissions.lire',
        },
        {
          label: 'Réglages système',
          path: '/parametrages/systeme',
          icon: 'bi bi-gear',
          permission: 'auth.parametres.lire',
        },
        {
          label: 'Référentiels',
          path: '/parametrages/referentiels',
          icon: 'bi bi-globe2',
          permission: ['referentiels.geo.synchroniser', 'referentiels.zones.ecrire'],
        },
        {
          label: 'Actions utilisateur',
          path: '/parametrages/actions',
          icon: 'bi bi-journal-text',
          permission: 'audit.actions.lire',
        },
      ],
    },
  ];

  readonly visibleGroups = computed(() =>
    this.navGroups
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => this.canSee(item.permission)),
      }))
      .filter((g) => g.items.length > 0)
  );

  ngOnInit(): void {
    this.alerts.start();
    this.openGroups.set(this.loadOpenState());
    this.ensureActiveGroupOpen(this.router.url);
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      this.ensureActiveGroupOpen(e.urlAfterRedirects || e.url);
    });
  }

  isGroupOpen(label: string): boolean {
    const state = this.openGroups();
    if (label in state) return state[label];
    return true;
  }

  toggleGroup(label: string): void {
    const next = { ...this.openGroups(), [label]: !this.isGroupOpen(label) };
    this.openGroups.set(next);
    this.persistOpenState(next);
  }

  badge(path: string): number {
    return path === '/onboarding/candidatures' ? this.alerts.count() : 0;
  }

  groupKey(label: string): string {
    return label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-');
  }

  private ensureActiveGroupOpen(url: string): void {
    const path = url.split('?')[0] || '/';
    const group = this.navGroups.find((g) =>
      g.items.some((item) => {
        if (item.path === '/') return path === '/';
        return path === item.path || path.startsWith(item.path + '/');
      })
    );
    if (!group) return;
    if (this.isGroupOpen(group.label)) return;
    const next = { ...this.openGroups(), [group.label]: true };
    this.openGroups.set(next);
    this.persistOpenState(next);
  }

  private loadOpenState(): Record<string, boolean> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return Object.fromEntries(this.navGroups.map((g) => [g.label, true]));
      }
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      const state: Record<string, boolean> = {};
      for (const g of this.navGroups) {
        state[g.label] = g.label in parsed ? !!parsed[g.label] : true;
      }
      return state;
    } catch {
      return Object.fromEntries(this.navGroups.map((g) => [g.label, true]));
    }
  }

  private persistOpenState(state: Record<string, boolean>): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota / private mode */
    }
  }

  private canSee(permission: string | string[]): boolean {
    const list = Array.isArray(permission) ? permission : [permission];
    return list.some((p) => this.auth.can(p));
  }
}
