import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard } from './core/guards/auth.guard';
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
        children: [
          { path: '', redirectTo: 'utilisateurs', pathMatch: 'full' },
          {
            path: 'utilisateurs',
            loadComponent: () =>
              import('./pages/parametrages/parametrages-users.page').then((m) => m.ParametragesUsersPageComponent),
          },
          {
            path: 'roles',
            loadComponent: () =>
              import('./pages/parametrages/parametrages-roles.page').then((m) => m.ParametragesRolesPageComponent),
          },
          {
            path: 'permissions',
            loadComponent: () =>
              import('./pages/parametrages/parametrages-permissions.page').then(
                (m) => m.ParametragesPermissionsPageComponent
              ),
          },
          {
            path: 'systeme',
            loadComponent: () =>
              import('./pages/parametrages/parametrages-system.page').then((m) => m.ParametragesSystemPageComponent),
          },
          {
            path: 'actions',
            loadComponent: () =>
              import('./pages/parametrages/parametrages-actions.page').then((m) => m.ParametragesActionsPageComponent),
          },
          {
            path: 'referentiels',
            loadComponent: () =>
              import('./pages/parametrages/parametrages-referentiels.page').then(
                (m) => m.ParametragesReferentielsPageComponent
              ),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
