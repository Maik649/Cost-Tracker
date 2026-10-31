import { Injectable, signal } from '@angular/core';
import {
  CostEntry,
  createBackupJson,
  normalizeCostEntry,
  parseStoredCostEntries,
} from '../models/cost-entry';

const databaseName = 'timeTracker';
const databaseVersion = 2;
const objectStoreName = 'costEntries';
const backupSettingsStoreName = 'backupSettings';
const backupFileHandleKey = 'fileHandle';
const legacyStorageKey = 'lastCost';

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
