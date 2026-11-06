import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom, tap } from 'rxjs';
import { AuthTokens, LoginResponse, User } from '../models/api.models';
import { RuntimeConfigService } from './runtime-config.service';

const ACCESS_KEY = 'flashops_access_token';
const REFRESH_KEY = 'flashops_refresh_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly runtime = inject(RuntimeConfigService);

  private get baseUrl(): string {
    return this.runtime.apiUrl;
  }

  private readonly userSignal = signal<User | null>(null);
  private readonly loadingSignal = signal(false);
  private refreshPromise: Promise<string | null> | null = null;

  readonly user = this.userSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.userSignal());
  readonly permissionCodes = computed(() => this.userSignal()?.permission_codes ?? []);
  readonly roleCode = computed(() => this.userSignal()?.role?.code ?? '');

  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  }

  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  }

  can(permission: string): boolean {
    if (this.roleCode() === 'SUPER_ADMIN') return true;
    return this.permissionCodes().includes(permission);
  }

  canAny(...permissions: string[]): boolean {
    if (this.roleCode() === 'SUPER_ADMIN') return true;
    const codes = this.permissionCodes();
    return permissions.some((p) => codes.includes(p));
  }

  async initSession(): Promise<void> {
    if (!this.accessToken && !this.refreshToken) return;
    this.loadingSignal.set(true);
    try {
      if (!this.accessToken) {
        await this.tryRefresh();
        return;
      }
      const res = await firstValueFrom(
        this.http.get<{ user: User }>(`${this.baseUrl}/auth/me`, this.authOptions())
      );
      this.userSignal.set(res.user);
    } catch {
      await this.tryRefresh();
    } finally {
      this.loadingSignal.set(false);
    }
  }

  /** Garantit un jeton d'accès valide (ping /me ou refresh). */
  async ensureAccessForWrite(): Promise<boolean> {
    if (!this.accessToken && !this.refreshToken) return false;
    try {
      if (this.accessToken) {
        await firstValueFrom(
          this.http.get<{ user: User }>(`${this.baseUrl}/auth/me`, this.authOptions())
        );
        return true;
      }
    } catch {
      /* refresh ci-dessous */
    }
    return !!(await this.tryRefresh());
  }

  login(email: string, password: string) {
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/login`, { email, password }).pipe(
      tap((res) => this.persistSession(res))
    );
  }

  loginWithToken(token: string) {
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/login/token`, { token }).pipe(
      tap((res) => this.persistSession(res))
    );
  }

  changePassword(currentPassword: string, newPassword: string) {
    const current = currentPassword ?? '';
    const next = newPassword ?? '';
    return this.http.post<{
      message: string;
      logout_required?: boolean;
      sessions_revoked?: boolean;
    }>(
      `${this.baseUrl}/auth/password`,
      {
        current_password: current,
        new_password: next,
        currentPassword: current,
        newPassword: next,
      },
      this.authOptions()
    );
  }

  async uploadProfilePhotoAfterSessionCheck(file: Blob): Promise<{ user: User }> {
    const ready = await this.ensureAccessForWrite();
    if (!ready) {
      throw new Error('missing access token');
    }

    const url = `${this.baseUrl}/auth/profile-photo`;
    const attempt = async (token: string): Promise<Response> => {
      const form = new FormData();
      form.append('file', file, 'profile.jpg');
      return fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
        credentials: 'same-origin',
      });
    };

    let token = this.accessToken;
    if (!token) {
      throw new Error('missing access token');
    }

    let response = await attempt(token);
    if (response.status === 401 || response.status === 403) {
      const refreshed = await this.tryRefresh();
      if (!refreshed) {
        throw new Error('missing access token');
      }
      token = refreshed;
      response = await attempt(token);
    }

    if (!response.ok) {
      let payload: { error?: string } = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }
      throw { status: response.status, error: payload };
    }

    const data = (await response.json()) as { user: User };
    this.userSignal.set(data.user);
    return data;
  }

  deleteProfilePhoto() {
    return this.http
      .delete<{ user: User }>(`${this.baseUrl}/auth/profile-photo`, this.authOptions())
      .pipe(tap((res) => this.userSignal.set(res.user)));
  }

  updateProfile(email: string, fullName: string) {
    return this.http
      .patch<{ user: User }>(
        `${this.baseUrl}/auth/profile`,
        {
          email,
          full_name: fullName,
        },
        this.authOptions()
      )
      .pipe(tap((res) => this.userSignal.set(res.user)));
  }

  logout(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    this.userSignal.set(null);
    this.router.navigate(['/login']);
  }

  async tryRefresh(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise;
    const refresh = this.refreshToken;
    if (!refresh) {
      this.logout();
      return null;
    }

    this.refreshPromise = (async () => {
      try {
        const tokenRes = await firstValueFrom(
          this.http.post<{ tokens: AuthTokens }>(`${this.baseUrl}/auth/refresh`, {
            refresh_token: refresh,
          })
        );
        localStorage.setItem(ACCESS_KEY, tokenRes.tokens.access_token);
        if (tokenRes.tokens.refresh_token) {
          localStorage.setItem(REFRESH_KEY, tokenRes.tokens.refresh_token);
        }
        const meRes = await firstValueFrom(
          this.http.get<{ user: User }>(`${this.baseUrl}/auth/me`, this.authOptions())
        );
        this.userSignal.set(meRes.user);
        return tokenRes.tokens.access_token;
      } catch {
        this.logout();
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  private persistSession(res: LoginResponse): void {
    localStorage.setItem(ACCESS_KEY, res.tokens.access_token);
    localStorage.setItem(REFRESH_KEY, res.tokens.refresh_token);
    this.userSignal.set(res.user);
  }

  private authOptions(): { headers: HttpHeaders } {
    const token = this.accessToken;
    if (!token) {
      throw new Error('missing access token');
    }
    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      }),
    };
  }
}
