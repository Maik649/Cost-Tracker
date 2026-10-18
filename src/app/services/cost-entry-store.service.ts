import { Injectable } from '@angular/core';
import { CostEntry, parseStoredCostEntries } from '../models/cost-entry';

const databaseName = 'timeTracker';
const databaseVersion = 1;
const objectStoreName = 'costEntries';
const legacyStorageKey = 'lastCost';

@Injectable({ providedIn: 'root' })
export class CostEntryStore {
  private databasePromise?: Promise<IDBDatabase>;

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
            entries = request.result as CostEntry[];
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

    return new Promise<void>((resolve, reject) => {
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
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB konnte nicht geöffnet werden.'));
      request.onblocked = () => reject(new Error('Die IndexedDB-Datenbank ist durch einen anderen Tab blockiert.'));
    });

    return this.databasePromise;
  }
}
