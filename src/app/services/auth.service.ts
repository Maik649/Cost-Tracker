import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'CostTrackerAuthenticated';
  readonly isAuthenticated = signal(
    typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem(this.storageKey) === 'true',
  );

  login(): void {
    sessionStorage.setItem(this.storageKey, 'true');
    this.isAuthenticated.set(true);
  }

  logout(): void {
    sessionStorage.removeItem(this.storageKey);
    this.isAuthenticated.set(false);
  }
}
