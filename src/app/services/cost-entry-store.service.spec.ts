import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CostEntry } from '../models/cost-entry';
import { CostEntryStore } from './cost-entry-store.service';

describe('CostEntryStore automatic backup', () => {
  let originalIndexedDb: PropertyDescriptor | undefined;
  let originalFilePicker: PropertyDescriptor | undefined;
  let originalLegacyData: string | null;

  const entry: CostEntry = {
    id: 'entry-1',
    type: 'expense',
    amount: 12.5,
    description: 'Test',
    category: 'Sonstiges',
    month: '2026-10',
    isRecurring: false,
    isActive: true,
    endedAtMonth: null,
  };

  beforeEach(() => {
    originalIndexedDb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    originalFilePicker = Object.getOwnPropertyDescriptor(window, 'showOpenFilePicker');
    originalLegacyData = localStorage.getItem('lastCost');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalIndexedDb) {
      Object.defineProperty(globalThis, 'indexedDB', originalIndexedDb);
    } else {
      Reflect.deleteProperty(globalThis, 'indexedDB');
    }
    if (originalFilePicker) {
      Object.defineProperty(window, 'showOpenFilePicker', originalFilePicker);
    } else {
      Reflect.deleteProperty(window, 'showOpenFilePicker');
    }
    if (originalLegacyData === null) {
      localStorage.removeItem('lastCost');
    } else {
      localStorage.setItem('lastCost', originalLegacyData);
    }
  });

  it('writes the current data to the selected file and updates it after each save', async () => {
    const writes: string[] = [];
    const handle = {
      name: 'cost-tracker-backup.json',
      queryPermission: vi.fn(async () => 'granted' as PermissionState),
      requestPermission: vi.fn(async () => 'granted' as PermissionState),
      createWritable: vi.fn(async () => ({
        write: vi.fn(async (data: string) => writes.push(data)),
        close: vi.fn(async () => undefined),
      })),
    };
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: vi.fn(async () => [handle]),
    });
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: createFakeIndexedDb(),
    });
    const store = new CostEntryStore();

    await store.selectAutomaticBackupFile();
    expect(store.automaticBackupFileName()).toBe(handle.name);
    expect(JSON.parse(writes[0]).entries).toEqual([]);

    await store.saveCostEntries([entry]);
    await vi.waitFor(() => expect(writes).toHaveLength(2));
    expect(JSON.parse(writes[1]).entries).toEqual([entry]);
    expect(store.automaticBackupError()).toBe('');
  });

  it('does not report IndexedDB saves as failed when the file backup cannot be written', async () => {
    const handle = {
      name: 'cost-tracker-backup.json',
      queryPermission: vi.fn(async () => 'granted' as PermissionState),
      requestPermission: vi.fn(async () => 'granted' as PermissionState),
      createWritable: vi.fn(async () => {
        throw new Error('Datei ist schreibgeschützt.');
      }),
    };
    Object.defineProperty(window, 'showOpenFilePicker', {
      configurable: true,
      value: vi.fn(async () => [handle]),
    });
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: createFakeIndexedDb(),
    });
    const store = new CostEntryStore();

    await expect(store.selectAutomaticBackupFile()).rejects.toThrow('Datei ist schreibgeschützt.');
    await expect(store.saveCostEntries([entry])).resolves.toBeUndefined();
    await vi.waitFor(() => expect(store.automaticBackupError()).toContain('Datei ist schreibgeschützt.'));
  });
});

function createFakeIndexedDb(): IDBFactory {
  const stores = new Map<string, Map<string, unknown>>();

  const database = {
    objectStoreNames: {
      contains: (name: string) => stores.has(name),
    },
    createObjectStore: (name: string) => {
      stores.set(name, new Map());
      return {};
    },
    transaction: (storeName: string) => {
      let completionScheduled = false;
      const transaction: {
        error: DOMException | null;
        oncomplete: ((event: Event) => void) | null;
        onerror: ((event: Event) => void) | null;
        onabort: ((event: Event) => void) | null;
        objectStore: (name: string) => object;
      } = {
        error: null,
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore: name => {
          const values = stores.get(name);
          if (!values) {
            throw new Error(`Unknown object store: ${name}`);
          }

          const scheduleCompletion = () => {
            if (completionScheduled) {
              return;
            }
            completionScheduled = true;
            queueMicrotask(() => transaction.oncomplete?.(new Event('complete')));
          };

          const createRequest = <T>(getResult: () => T) => {
            const request: {
              result: T;
              error: DOMException | null;
              onsuccess: ((event: Event) => void) | null;
              onerror: ((event: Event) => void) | null;
            } = {
              result: undefined as T,
              error: null,
              onsuccess: null,
              onerror: null,
            };
            queueMicrotask(() => {
              request.result = getResult();
              request.onsuccess?.(new Event('success'));
              scheduleCompletion();
            });
            return request;
          };

          return {
            getAll: () => createRequest(() => [...values.values()]),
            get: (key: IDBValidKey) => createRequest(() => values.get(String(key))),
            put: (value: unknown, key?: IDBValidKey) => {
              const entryKey = key ?? (value as { id?: string }).id;
              if (entryKey === undefined) {
                throw new Error('A key is required.');
              }
              values.set(String(entryKey), value);
              scheduleCompletion();
              return {};
            },
            clear: () => {
              values.clear();
              scheduleCompletion();
              return {};
            },
            delete: (key: IDBValidKey) => {
              values.delete(String(key));
              scheduleCompletion();
              return {};
            },
          };
        },
      };
      return transaction;
    },
  };

  return {
    open: (_name: string, _version?: number) => {
      const request: {
        result: typeof database | undefined;
        error: DOMException | null;
        onupgradeneeded: ((event: Event) => void) | null;
        onsuccess: ((event: Event) => void) | null;
        onerror: ((event: Event) => void) | null;
        onblocked: ((event: Event) => void) | null;
      } = {
        result: undefined,
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        onblocked: null,
      };
      queueMicrotask(() => {
        request.result = database;
        request.onupgradeneeded?.(new Event('upgradeneeded'));
        request.onsuccess?.(new Event('success'));
      });
      return request;
    },
  } as IDBFactory;
}
