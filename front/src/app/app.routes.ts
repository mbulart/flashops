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
    path: 'devenir-distributeur',
    loadComponent: () =>
      import('./pages/public/onboarding-landing.page').then((m) => m.OnboardingLandingPageComponent),
  },
  {
    path: 'devenir-distributeur/candidature',
    loadComponent: () =>
      import('./pages/public/onboarding-wizard.page').then((m) => m.OnboardingWizardPageComponent),
  },
  {
    path: 'devenir-distributeur/suivi',
    loadComponent: () =>
      import('./pages/public/onboarding-suivi.page').then((m) => m.OnboardingSuiviPageComponent),
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
        path: 'transactions',
        loadComponent: () =>
          import('./pages/transactions/transactions.page').then((m) => m.TransactionsPageComponent),
        canActivate: [permissionGuard('dashboard.voir')],
      },
      {
        path: 'approvisionnement-vas',
        redirectTo: 'approvisionnement-vas/momo',
        pathMatch: 'full',
      },
      {
        path: 'approvisionnement-vas/momo',
        loadComponent: () =>
          import('./pages/approvisionnement-vas/approvisionnement-vas.page').then(
            (m) => m.ApprovisionnementVasPageComponent
          ),
        canActivate: [permissionGuard('approvisionnement.vas.lire')],
      },
      {
        path: 'approvisionnement-vas/momo/nouvelle',
        loadComponent: () =>
          import('./pages/approvisionnement-vas/approvisionnement-vas.page').then(
            (m) => m.ApprovisionnementVasPageComponent
          ),
        canActivate: [permissionGuard('approvisionnement.vas.ecrire')],
      },
      {
        path: 'approvisionnement-vas/telco',
        loadComponent: () =>
          import('./pages/approvisionnement-vas/approvisionnement-vas.page').then(
            (m) => m.ApprovisionnementVasPageComponent
          ),
        canActivate: [permissionGuard('approvisionnement.vas.lire')],
      },
      {
        path: 'approvisionnement-vas/telco/nouvelle',
        loadComponent: () =>
          import('./pages/approvisionnement-vas/approvisionnement-vas.page').then(
            (m) => m.ApprovisionnementVasPageComponent
          ),
        canActivate: [permissionGuard('approvisionnement.vas.ecrire')],
      },
      {
        path: 'approvisionnement-vas/:id',
        loadComponent: () =>
          import('./pages/approvisionnement-vas/approvisionnement-vas.page').then(
            (m) => m.ApprovisionnementVasPageComponent
          ),
        canActivate: [permissionGuard('approvisionnement.vas.lire')],
      },
      {
        path: 'profil',
        loadComponent: () => import('./pages/profile/profile.page').then((m) => m.ProfilePageComponent),
      },
      {
        path: 'onboarding/candidatures',
        loadComponent: () =>
          import('./pages/onboarding/onboarding-candidatures.page').then(
            (m) => m.OnboardingCandidaturesPageComponent
          ),
        canActivate: [permissionGuard('onboarding.candidatures.lire')],
      },
      {
        path: 'onboarding/candidatures/:id',
        loadComponent: () =>
          import('./pages/onboarding/onboarding-candidature-detail.page').then(
            (m) => m.OnboardingCandidatureDetailPageComponent
          ),
        canActivate: [permissionGuard('onboarding.candidatures.lire')],
      },
      {
        path: 'onboarding/taches',
        loadComponent: () =>
          import('./pages/onboarding/onboarding-taches.page').then(
            (m) => m.OnboardingTachesPageComponent
          ),
        canActivate: [permissionGuard('onboarding.taches.lire')],
      },
      {
        path: 'onboarding/admin',
        loadComponent: () =>
          import('./pages/onboarding/onboarding-admin.page').then(
            (m) => m.OnboardingAdminPageComponent
          ),
        canActivate: [permissionAnyGuard('onboarding.admin', 'workflow.admin')],
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
