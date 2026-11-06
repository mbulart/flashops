import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionAnyGuard, permissionGuard } from './core/guards/auth.guard';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPageComponent),
    canActivate: [guestGuard],
  },
  {
    path: 'carte',
    loadComponent: () =>
      import('./pages/public/agences-carte.page').then((m) => m.AgencesCartePageComponent),
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/pilotage/pilotage.page').then((m) => m.PilotagePageComponent),
        canActivate: [permissionGuard('dashboard.voir')],
      },
      {
        path: 'agences',
        loadComponent: () => import('./pages/agences/agences.page').then((m) => m.AgencesPageComponent),
        canActivate: [permissionGuard('agences.lire')],
      },
      {
        path: 'profil',
        loadComponent: () => import('./pages/profile/profile.page').then((m) => m.ProfilePageComponent),
      },
      {
        path: 'parametrages',
        loadComponent: () =>
          import('./pages/parametrages/parametrages-layout.page').then((m) => m.ParametragesLayoutPageComponent),
        canActivate: [
          permissionAnyGuard(
            'auth.utilisateurs.lire',
            'auth.roles.lire',
            'auth.permissions.lire',
            'auth.parametres.lire',
            'audit.actions.lire',
            'referentiels.geo.synchroniser',
            'referentiels.zones.ecrire'
          ),
        ],
        children: [
          { path: '', redirectTo: 'utilisateurs', pathMatch: 'full' },
          {
            path: 'utilisateurs',
            loadComponent: () =>
              import('./pages/parametrages/parametrages-users.page').then((m) => m.ParametragesUsersPageComponent),
            canActivate: [permissionGuard('auth.utilisateurs.lire')],
          },
          {
            path: 'roles',
            loadComponent: () =>
              import('./pages/parametrages/parametrages-roles.page').then((m) => m.ParametragesRolesPageComponent),
            canActivate: [permissionGuard('auth.roles.lire')],
          },
          {
            path: 'permissions',
            loadComponent: () =>
              import('./pages/parametrages/parametrages-permissions.page').then(
                (m) => m.ParametragesPermissionsPageComponent
              ),
            canActivate: [permissionGuard('auth.permissions.lire')],
          },
          {
            path: 'systeme',
            loadComponent: () =>
              import('./pages/parametrages/parametrages-system.page').then((m) => m.ParametragesSystemPageComponent),
            canActivate: [permissionGuard('auth.parametres.lire')],
          },
          {
            path: 'actions',
            loadComponent: () =>
              import('./pages/parametrages/parametrages-actions.page').then((m) => m.ParametragesActionsPageComponent),
            canActivate: [permissionGuard('audit.actions.lire')],
          },
          {
            path: 'referentiels',
            loadComponent: () =>
              import('./pages/parametrages/parametrages-referentiels.page').then(
                (m) => m.ParametragesReferentielsPageComponent
              ),
            canActivate: [
              permissionAnyGuard('referentiels.geo.synchroniser', 'referentiels.zones.ecrire'),
            ],
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
