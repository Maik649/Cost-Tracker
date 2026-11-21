import { computed, Injectable, signal } from '@angular/core';
import { FirebaseError, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  User,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { firebaseConfig } from '../../environments/environment';

export const guestSessionStorageKey = 'costTracker.guestSession';
export const legacyDataMigrationStorageKey = 'costTracker.legacyDataMigrated';

export function newAccountMigrationStorageKey(userId: string): string {
  return `costTracker.newAccount.${userId}`;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<User | null>(null);
  private readonly guestMode = signal(readGuestMode());
  readonly isGuest = computed(() => this.guestMode() && this.currentUser() === null);
  readonly isAuthenticated = computed(() => this.isGuest() || this.currentUser() !== null);
  readonly headerUserLabel = computed(() => {
    if (this.isGuest()) {
      return 'Gast';
    }

    const email = this.currentUser()?.email;
    return email ? initialsFromEmail(email) : 'Nutzer';
  });

  private readonly auth: Auth | null;
  private readonly authStateReady: Promise<void>;

  constructor() {
    if (!isFirebaseConfigured()) {
      this.auth = null;
      this.authStateReady = Promise.resolve();
      return;
    }

    const app = getApps().some(existingApp => existingApp.name === '[DEFAULT]')
      ? getApp()
      : initializeApp(firebaseConfig);
    this.auth = getAuth(app);
    this.authStateReady = this.auth.authStateReady().then(() => {
      this.updateUser(this.auth?.currentUser ?? null);
    });

    onAuthStateChanged(this.auth, user => this.updateUser(user));
  }

  async signIn(email: string, password: string): Promise<User> {
    const credential = await signInWithEmailAndPassword(
      this.requireAuth(),
      email.trim(),
      password,
    );
    this.updateUser(credential.user);
    return credential.user;
  }

  async signUp(email: string, password: string): Promise<User> {
    const credential = await createUserWithEmailAndPassword(
      this.requireAuth(),
      email.trim(),
      password,
    );
    localStorage.setItem(newAccountMigrationStorageKey(credential.user.uid), 'true');
    this.updateUser(credential.user);
    return credential.user;
  }

  async signInAsGuest(): Promise<void> {
    await this.authStateReady;
    if (this.auth?.currentUser) {
      await signOut(this.auth);
    }

    this.updateUser(null);
    localStorage.setItem(guestSessionStorageKey, 'true');
    this.guestMode.set(true);
  }

  async logout(): Promise<void> {
    await this.authStateReady;
    if (this.auth?.currentUser) {
      await signOut(this.auth);
    }

    localStorage.removeItem(guestSessionStorageKey);
    this.guestMode.set(false);
    this.updateUser(null);
  }

  async waitForAuthState(): Promise<boolean> {
    await this.authStateReady;
    return this.isAuthenticated();
  }

  authErrorMessage(error: unknown): string {
    if (!(error instanceof FirebaseError)) {
      return error instanceof Error
        ? error.message
        : 'Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut.';
    }

    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'E-Mail-Adresse oder Passwort ist nicht korrekt.';
      case 'auth/invalid-email':
        return 'Bitte gib eine gültige E-Mail-Adresse ein.';
      case 'auth/email-already-in-use':
        return 'Für diese E-Mail-Adresse gibt es bereits ein Konto.';
      case 'auth/weak-password':
        return 'Das Passwort ist zu schwach. Verwende mindestens 6 Zeichen.';
      case 'auth/operation-not-allowed':
        return 'Diese Anmeldemethode ist in der Firebase Console nicht aktiviert.';
      case 'auth/unauthorized-domain':
        return 'Diese Domain ist in Firebase Authentication nicht freigegeben.';
      case 'auth/too-many-requests':
        return 'Zu viele Versuche. Bitte warte kurz und versuche es erneut.';
      case 'auth/network-request-failed':
        return 'Firebase ist nicht erreichbar. Bitte prüfe deine Internetverbindung.';
      default:
        return `Firebase-Anmeldung fehlgeschlagen (${error.code}): ${error.message}`;
    }
  }

  private requireAuth(): Auth {
    if (!this.auth) {
      throw new Error(
        'Die Firebase-Konfiguration fehlt. Trage die Web-App-Werte in src/environments/environment.ts ein.',
      );
    }

    return this.auth;
  }

  private updateUser(user: User | null): void {
    if (user) {
      localStorage.removeItem(guestSessionStorageKey);
      this.guestMode.set(false);
    }

    this.currentUser.set(user);
  }
}

function readGuestMode(): boolean {
  return typeof localStorage !== 'undefined'
    && localStorage.getItem(guestSessionStorageKey) === 'true';
}

function initialsFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? '';
  const nameParts = localPart.split(/[._+-]+/).filter(Boolean);
  if (nameParts.length > 1) {
    return nameParts.slice(0, 2)
      .map(part => Array.from(part)[0] ?? '')
      .join('')
      .toLocaleUpperCase('de-DE');
  }

  return Array.from(nameParts[0] ?? '')
    .slice(0, 2)
    .join('')
    .toLocaleUpperCase('de-DE') || '?';
}

function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey
    && firebaseConfig.authDomain
    && firebaseConfig.projectId
    && firebaseConfig.appId,
  );
}
