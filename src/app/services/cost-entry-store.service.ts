import { Injectable, signal } from '@angular/core';
import {
  CostEntry,
  createBackupJson,
  normalizeCostEntry,
  parseStoredCostEntries,
} from '../models/cost-entry';
import { getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { DB_Link } from '../../environments/environment';
import {
  guestSessionStorageKey,
  legacyDataMigrationStorageKey,
  newAccountMigrationStorageKey,
} from './auth.service';

const databaseName = 'costTracker';
const legacyDatabaseName = 'timeTracker';
const databaseVersion = 2;
const objectStoreName = 'costEntries';
const backupSettingsStoreName = 'backupSettings';
const backupFileHandleKey = 'fileHandle';
const legacyStorageKey = 'lastCost';
export const guestEntriesStorageKey = 'costTracker.guestEntries';

interface BackupFileHandle {
  name: string;
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>;
  createWritable(): Promise<BackupWritableStream>;
}

interface BackupWritableStream {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

interface FilePickerWindow extends Window {
  showOpenFilePicker?: (options: {
    multiple: false;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<BackupFileHandle[]>;
}

@Injectable({ providedIn: 'root' })
export class CostEntryStore {
  private databasePromise?: Promise<IDBDatabase>;
  private automaticBackupQueue: Promise<void> = Promise.resolve();

  readonly automaticBackupSupported = typeof window !== 'undefined'
    && typeof (window as FilePickerWindow).showOpenFilePicker === 'function';
  readonly automaticBackupSettingsLoaded = signal(false);
  readonly automaticBackupFileName = signal<string | null>(null);
  readonly automaticBackupError = signal('');
  readonly automaticBackupLastSaved = signal<string | null>(null);

  async loadCostEntries(): Promise<CostEntry[]> {
    if (isGuestSession()) {
      return parseStoredCostEntries(localStorage.getItem(guestEntriesStorageKey));
    }

    const userId = await this.getCurrentFirebaseUserId();
    if (userId) {
      return this.loadFirebaseCostEntries(userId);
    }

    return this.loadIndexedDbCostEntries();
  }

  private async loadIndexedDbCostEntries(): Promise<CostEntry[]> {
    const database = await this.openDatabase();

    return new Promise<CostEntry[]>((resolve, reject) => {
      const transaction = database.transaction(objectStoreName, 'readwrite');
      const store = transaction.objectStore(objectStoreName);
      let entries: CostEntry[] = [];
      let migratedLegacyData = false;
      let failure: unknown;

      transaction.oncomplete = () => {
        try {
          if (migratedLegacyData) {
            localStorage.removeItem(legacyStorageKey);
          }
          resolve(entries);
        } catch (error) {
          reject(error);
        }
      };
      transaction.onerror = () => reject(
        failure ?? transaction.error ?? new Error('Einträge konnten nicht geladen werden.'),
      );
      transaction.onabort = () => reject(
        failure ?? transaction.error ?? new Error('Einträge konnten nicht geladen werden.'),
      );

      const request = store.getAll();
      request.onsuccess = () => {
        try {
          if (request.result.length > 0) {
            entries = (request.result as CostEntry[]).map(normalizeCostEntry);
            return;
          }

          const legacyData = localStorage.getItem(legacyStorageKey);
          entries = parseStoredCostEntries(legacyData);
          if (legacyData !== null) {
            migratedLegacyData = true;
            for (const entry of entries) {
              store.put(entry);
            }
          }
        } catch (error) {
          failure = error;
          transaction.abort();
        }
      };
      request.onerror = () => {
        failure = request.error ?? new Error('Einträge konnten nicht geladen werden.');
        transaction.abort();
      };
    });
  }

  async saveCostEntries(entries: CostEntry[]): Promise<void> {
    if (isGuestSession()) {
      localStorage.setItem(guestEntriesStorageKey, JSON.stringify(entries));
      return;
    }

    const userId = await this.getCurrentFirebaseUserId();
    if (userId) {
      await this.saveFirebaseCostEntries(userId, entries);
      void this.queueAutomaticBackup(entries);
      return;
    }

    const database = await this.openDatabase();

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(objectStoreName, 'readwrite');
      const store = transaction.objectStore(objectStoreName);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Einträge konnten nicht gespeichert werden.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Einträge konnten nicht gespeichert werden.'));

      store.clear();
      for (const entry of entries) {
        store.put(entry);
      }
    });

    void this.queueAutomaticBackup(entries);
  }

  private async loadFirebaseCostEntries(userId: string): Promise<CostEntry[]> {
    const databaseSdk = await import('firebase/database');
    const entriesReference = databaseSdk.ref(
      databaseSdk.getDatabase(getApp(), DB_Link),
      `users/${userId}/costEntries`,
    );
    const newAccountStorageKey = newAccountMigrationStorageKey(userId);
    const isNewAccount = localStorage.getItem(newAccountStorageKey) === 'true';
    const snapshot = await databaseSdk.get(entriesReference);
    if (snapshot.exists()) {
      const entries = parseFirebaseCostEntries(snapshot.val());
      if (isNewAccount) {
        localStorage.removeItem(newAccountStorageKey);
      } else {
        localStorage.setItem(legacyDataMigrationStorageKey, 'true');
      }
      return entries;
    }

    let entriesToMigrate: CostEntry[] = [];
    if (!isNewAccount && localStorage.getItem(legacyDataMigrationStorageKey) !== 'true') {
      const [legacyEntries, localEntries] = await Promise.all([
        this.loadLegacyDatabaseEntries(),
        this.loadIndexedDbCostEntries(),
      ]);
      entriesToMigrate = mergeCostEntries(legacyEntries, localEntries);
    }

    await databaseSdk.set(entriesReference, createFirebaseEntriesDocument(entriesToMigrate));
    if (isNewAccount) {
      localStorage.removeItem(newAccountStorageKey);
    } else {
      localStorage.setItem(legacyDataMigrationStorageKey, 'true');
    }
    return entriesToMigrate;
  }

  private async saveFirebaseCostEntries(userId: string, entries: CostEntry[]): Promise<void> {
    const databaseSdk = await import('firebase/database');
    await databaseSdk.set(
      databaseSdk.ref(
        databaseSdk.getDatabase(getApp(), DB_Link),
        `users/${userId}/costEntries`,
      ),
      createFirebaseEntriesDocument(entries),
    );
  }

  private async getCurrentFirebaseUserId(): Promise<string | null> {
    if (!getApps().some(app => app.name === '[DEFAULT]')) {
      return null;
    }

    const auth = getAuth(getApp());
    await auth.authStateReady();
    return auth.currentUser?.uid ?? null;
  }

  private async loadLegacyDatabaseEntries(): Promise<CostEntry[]> {
    if (typeof indexedDB === 'undefined') {
      return [];
    }

    if (typeof indexedDB.databases === 'function') {
      const databases = await indexedDB.databases();
      if (!databases.some(database => database.name === legacyDatabaseName)) {
        return [];
      }
    }

    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(legacyDatabaseName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(
        request.error ?? new Error('Die bisherige IndexedDB konnte nicht geöffnet werden.'),
      );
      request.onblocked = () => reject(
        new Error('Die bisherige IndexedDB ist durch einen anderen Tab blockiert.'),
      );
    });

    if (!database.objectStoreNames.contains(objectStoreName)) {
      database.close();
      return [];
    }

    return new Promise<CostEntry[]>((resolve, reject) => {
      const transaction = database.transaction(objectStoreName, 'readonly');
      const request = transaction.objectStore(objectStoreName).getAll();
      request.onsuccess = () => {
        try {
          resolve((request.result as CostEntry[]).map(normalizeCostEntry));
        } catch (error) {
          reject(error);
        } finally {
          database.close();
        }
      };
      request.onerror = () => {
        database.close();
        reject(request.error ?? new Error('Die bisherigen Einträge konnten nicht gelesen werden.'));
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error ?? new Error('Die bisherige IndexedDB konnte nicht gelesen werden.'));
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error ?? new Error('Das Lesen der bisherigen IndexedDB wurde abgebrochen.'));
      };
    });
  }

  async loadAutomaticBackupSettings(): Promise<void> {
    try {
      const handle = await this.getBackupFileHandle();
      this.automaticBackupFileName.set(handle?.name ?? null);
      this.automaticBackupSettingsLoaded.set(true);
    } catch (error) {
      this.automaticBackupError.set(`Backup-Einstellungen konnten nicht geladen werden: ${errorMessage(error)}`);
      this.automaticBackupSettingsLoaded.set(true);
    }
  }

  async selectAutomaticBackupFile(): Promise<void> {
    const pickerWindow = typeof window === 'undefined' ? null : window as FilePickerWindow;
    if (!pickerWindow?.showOpenFilePicker) {
      throw new Error('Automatische Dateisicherung wird von diesem Browser nicht unterstützt.');
    }

    const [handle] = await pickerWindow.showOpenFilePicker({
      multiple: false,
      types: [{ description: 'JSON-Backup', accept: { 'application/json': ['.json'] } }],
    });
    if (!handle) {
      throw new Error('Es wurde keine Backup-Datei ausgewählt.');
    }

    await this.requestWritePermission(handle);
    await this.storeBackupFileHandle(handle);
    this.automaticBackupFileName.set(handle.name);
    this.automaticBackupError.set('');

    const entries = await this.loadCostEntries();
    await this.queueAutomaticBackup(entries, handle);
    if (this.automaticBackupError()) {
      throw new Error(this.automaticBackupError());
    }
  }

  async updateAutomaticBackupNow(): Promise<void> {
    const handle = await this.getBackupFileHandle();
    if (!handle) {
      throw new Error('Wähle zuerst eine Backup-Datei aus.');
    }

    await this.requestWritePermission(handle);
    const entries = await this.loadCostEntries();
    await this.queueAutomaticBackup(entries, handle);
    if (this.automaticBackupError()) {
      throw new Error(this.automaticBackupError());
    }
  }

  async disableAutomaticBackup(): Promise<void> {
    await this.automaticBackupQueue;
    const database = await this.openDatabase();

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(backupSettingsStoreName, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(
        transaction.error ?? new Error('Backup-Ziel konnte nicht entfernt werden.'),
      );
      transaction.onabort = () => reject(
        transaction.error ?? new Error('Backup-Ziel konnte nicht entfernt werden.'),
      );
      transaction.objectStore(backupSettingsStoreName).delete(backupFileHandleKey);
    });

    this.automaticBackupFileName.set(null);
    this.automaticBackupError.set('');
    this.automaticBackupLastSaved.set(null);
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise) {
      return this.databasePromise;
    }

    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB ist in diesem Browser nicht verfügbar.'));
    }

    this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, databaseVersion);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(objectStoreName)) {
          database.createObjectStore(objectStoreName, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(backupSettingsStoreName)) {
          database.createObjectStore(backupSettingsStoreName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB konnte nicht geöffnet werden.'));
      request.onblocked = () => reject(new Error('Die IndexedDB-Datenbank ist durch einen anderen Tab blockiert.'));
    });

    return this.databasePromise;
  }

  private async getBackupFileHandle(): Promise<BackupFileHandle | null> {
    const database = await this.openDatabase();

    return new Promise<BackupFileHandle | null>((resolve, reject) => {
      const transaction = database.transaction(backupSettingsStoreName, 'readonly');
      const request = transaction.objectStore(backupSettingsStoreName).get(backupFileHandleKey);

      request.onsuccess = () => {
        const handle: unknown = request.result;
        if (handle === undefined) {
          resolve(null);
        } else if (isBackupFileHandle(handle)) {
          resolve(handle);
        } else {
          reject(new Error('Das gespeicherte Backup-Ziel ist ungültig. Bitte wähle es erneut aus.'));
        }
      };
      request.onerror = () => reject(
        request.error ?? new Error('Backup-Ziel konnte nicht geladen werden.'),
      );
      transaction.onerror = () => reject(
        transaction.error ?? new Error('Backup-Ziel konnte nicht geladen werden.'),
      );
    });
  }

  private async storeBackupFileHandle(handle: BackupFileHandle): Promise<void> {
    const database = await this.openDatabase();

    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(backupSettingsStoreName, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(
        transaction.error ?? new Error('Backup-Ziel konnte nicht gespeichert werden.'),
      );
      transaction.onabort = () => reject(
        transaction.error ?? new Error('Backup-Ziel konnte nicht gespeichert werden.'),
      );
      transaction.objectStore(backupSettingsStoreName).put(handle, backupFileHandleKey);
    });
  }

  private async requestWritePermission(handle: BackupFileHandle): Promise<void> {
    let permission = await handle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      permission = await handle.requestPermission({ mode: 'readwrite' });
    }
    if (permission !== 'granted') {
      throw new Error('Schreibzugriff wurde nicht freigegeben. Erlaube den Zugriff auf die Backup-Datei.');
    }
  }

  private queueAutomaticBackup(entries: CostEntry[], target?: BackupFileHandle): Promise<void> {
    const queuedBackup = this.automaticBackupQueue
      .catch(() => undefined)
      .then(async () => {
        const handle = target ?? await this.getBackupFileHandle();
        if (!handle) {
          return;
        }

        const permission = await handle.queryPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
          throw new Error('Schreibzugriff fehlt. Öffne Einstellungen und gib den Zugriff erneut frei.');
        }

        const writable = await handle.createWritable();
        await writable.write(createBackupJson(entries));
        await writable.close();
        this.automaticBackupFileName.set(handle.name);
        this.automaticBackupError.set('');
        this.automaticBackupLastSaved.set(new Date().toLocaleString('de-DE'));
      })
      .catch(error => {
        this.automaticBackupError.set(`Automatisches Backup fehlgeschlagen: ${errorMessage(error)}`);
      });

    this.automaticBackupQueue = queuedBackup;
    return queuedBackup;
  }
}

function isGuestSession(): boolean {
  return typeof localStorage !== 'undefined'
    && localStorage.getItem(guestSessionStorageKey) === 'true';
}

function createFirebaseEntriesDocument(entries: CostEntry[]): {
  schemaVersion: number;
  entries: CostEntry[];
} {
  return {
    schemaVersion: 1,
    entries: parseStoredCostEntries(JSON.stringify(entries)),
  };
}

function mergeCostEntries(legacyEntries: CostEntry[], currentEntries: CostEntry[]): CostEntry[] {
  const entriesById = new Map(legacyEntries.map(entry => [entry.id, entry]));
  for (const entry of currentEntries) {
    entriesById.set(entry.id, entry);
  }
  return [...entriesById.values()];
}

function parseFirebaseCostEntries(value: unknown): CostEntry[] {
  if (!isRecord(value) || value['schemaVersion'] !== 1) {
    throw new Error('Die gespeicherten Firebase-Einträge haben ein ungültiges Format.');
  }

  const savedEntries = toFirebaseArray(value['entries']);
  if (savedEntries === undefined) {
    return [];
  }
  return parseStoredCostEntries(JSON.stringify(savedEntries.map(normalizeFirebaseEntry)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toFirebaseArray(value: unknown): unknown[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (isRecord(value)) {
    return Object.values(value);
  }

  throw new Error('Die gespeicherten Firebase-Einträge sind keine gültige Liste.');
}

function normalizeFirebaseEntry(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const entry = { ...value };
  const recurrencePeriods = toFirebaseArray(entry['recurrencePeriods']);
  if (recurrencePeriods) {
    entry['recurrencePeriods'] = recurrencePeriods.map(period =>
      isRecord(period) && period['endMonth'] === undefined
        ? { ...period, endMonth: null }
        : period,
    );
  }

  const amountPeriods = toFirebaseArray(entry['amountPeriods']);
  if (amountPeriods) {
    entry['amountPeriods'] = amountPeriods;
  }

  return entry;
}

function isBackupFileHandle(value: unknown): value is BackupFileHandle {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const handle = value as Partial<BackupFileHandle>;
  return typeof handle.name === 'string'
    && typeof handle.queryPermission === 'function'
    && typeof handle.requestPermission === 'function'
    && typeof handle.createWritable === 'function';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unbekannter Fehler.';
}
