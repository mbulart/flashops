import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { RuntimeConfigService } from '../services/runtime-config.service';

function requestPath(url: string): string {
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return url.split('?')[0] ?? url;
  }
}

function cloneWithAuth(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    body: req.body,
    setHeaders: {
      Authorization: `Bearer ${token}`,
      'X-Retry': '1',
    },
  });
}

function isPublicAuthRoute(path: string): boolean {
  return (
    /\/auth\/login\/?$/i.test(path) ||
    /\/auth\/refresh\/?$/i.test(path) ||
    /\/auth\/login\/token\/?$/i.test(path)
  );
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const toast = inject(ToastService);
  const runtime = inject(RuntimeConfigService);
  const path = requestPath(req.url);
  const token = auth.accessToken;
  const isAuthRoute = isPublicAuthRoute(path);
  const isAccountSelfService =
    /\/auth\/profile\/?$/i.test(path) ||
    /\/auth\/password\/?$/i.test(path) ||
    /\/auth\/profile-photo\/?$/i.test(path) ||
    /\/auth\/profile-photo\/\d+\/?$/i.test(path);
  const isPublicRoute =
    req.url.includes('/config/public') || req.url.includes('/public/agences');

  let authedReq = req;
  if (token && !isAuthRoute) {
    if (!req.headers.has('Authorization')) {
      authedReq = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
    }
  }

  return next(authedReq).pipe(
    catchError((err: HttpErrorResponse) => {
      const canRetrySession =
        (err.status === 401 || err.status === 403) &&
        !isAuthRoute &&
        !isPublicRoute &&
        !req.headers.has('X-Retry') &&
        (!!token || !!auth.refreshToken);
      if (canRetrySession) {
        return from(auth.tryRefresh()).pipe(
          switchMap((newToken) => {
            if (!newToken) return throwError(() => err);
            const retry = cloneWithAuth(authedReq, newToken);
            return next(retry);
          })
        );
      }

      if (isPublicRoute) {
        return throwError(() => err);
      }
      if (err.status === 403 && !isAuthRoute && !isAccountSelfService) {
        toast.warning('Accès refusé — permissions insuffisantes.');
      } else if (err.status === 429) {
        toast.warning('Trop de requêtes — réessayez dans quelques instants.');
      } else if (err.status === 502) {
        toast.error('API Flash OPS indisponible (bad gateway).');
      } else if (err.status === 0) {
        toast.error(
          `Impossible de joindre l'API (${runtime.apiUrl}). Démarrez le backend Spring Boot sur le port 8080.`
        );
      }

      return throwError(() => err);
    })
  );
};
