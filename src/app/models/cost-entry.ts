export type CostType = 'income' | 'expense';

export interface CostEntry {
  id: string;
  type: CostType;
  amount: number;
  description: string;
  category: string;
  month: string;
  isRecurring: boolean;
  isActive: boolean;
  endedAtMonth: string | null;
  recurrencePeriods?: RecurrencePeriod[];
  amountPeriods?: AmountPeriod[];
}

export interface RecurrencePeriod {
  startMonth: string;
  endMonth: string | null;
}

export interface AmountPeriod {
  startMonth: string;
  amount: number;
}

export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function parseStoredCostEntries(savedEntries: string | null): CostEntry[] {
  if (savedEntries === null) {
    return [];
  }

  const parsedEntries: unknown = JSON.parse(savedEntries);
  if (!Array.isArray(parsedEntries)) {
    throw new Error('Gespeicherte Einträge müssen eine Liste sein.');
  }

  return parsedEntries.flatMap((entry: unknown, index: number) => {
    if (isCostEntry(entry)) {
      return [{
        ...entry,
        endedAtMonth: entry.endedAtMonth ?? null,
        recurrencePeriods: getRecurrencePeriods(entry),
        amountPeriods: getAmountPeriods(entry),
      }];
    }

    if (isLegacyCostEntry(entry)) {
      return migrateLegacyEntry(entry, index);
    }

    throw new Error(`Gespeicherter Eintrag an Position ${index + 1} ist ungültig.`);
  });
}

export function createBackupJson(entries: CostEntry[]): string {
  return JSON.stringify({ app: 'timeTracker', version: 1, exportedAt: new Date().toISOString(), entries }, null, 2);
}

export function parseBackupJson(text: string): CostEntry[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Die Datei enthält kein gültiges JSON.');
  }

  const list = Array.isArray(data) ? data : (data as { entries?: unknown } | null)?.entries;
  if (!Array.isArray(list)) {
    throw new Error('Die Datei enthält keine Liste von Einträgen.');
  }

  const ids = new Set<string>();
  return list.map((entry: unknown, index: number) => {
    if (!isCostEntry(entry)) {
      throw new Error(`Eintrag ${index + 1} ist ungültig.`);
    }
    if (ids.has(entry.id)) {
      throw new Error(`Eintrag ${index + 1} hat eine doppelte ID.`);
    }
    ids.add(entry.id);
    return {
      ...entry,
      endedAtMonth: entry.endedAtMonth ?? null,
      recurrencePeriods: getRecurrencePeriods(entry),
      amountPeriods: getAmountPeriods(entry),
    };
  });
}

function isCostEntry(value: unknown): value is CostEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return typeof entry['id'] === 'string'
    && (entry['type'] === 'income' || entry['type'] === 'expense')
    && typeof entry['amount'] === 'number'
    && Number.isFinite(entry['amount'])
    && typeof entry['description'] === 'string'
    && typeof entry['category'] === 'string'
    && isMonthKey(entry['month'])
    && typeof entry['isRecurring'] === 'boolean'
    && typeof entry['isActive'] === 'boolean'
    && (entry['endedAtMonth'] === undefined || entry['endedAtMonth'] === null || isMonthKey(entry['endedAtMonth']))
    && (entry['recurrencePeriods'] === undefined
      || (Array.isArray(entry['recurrencePeriods']) && entry['recurrencePeriods'].every(isRecurrencePeriod)))
    && (entry['amountPeriods'] === undefined
      || (Array.isArray(entry['amountPeriods']) && entry['amountPeriods'].every(isAmountPeriod)));
}

function isLegacyCostEntry(value: unknown): value is {
  income: number;
  expense: number;
  description?: string;
  art?: string;
  isIncome?: boolean;
  isExpense?: boolean;
} {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return typeof entry['income'] === 'number'
    && Number.isFinite(entry['income'])
    && typeof entry['expense'] === 'number'
    && Number.isFinite(entry['expense'])
    && (entry['description'] === undefined || typeof entry['description'] === 'string')
    && (entry['art'] === undefined || typeof entry['art'] === 'string')
    && (entry['isIncome'] === undefined || typeof entry['isIncome'] === 'boolean')
    && (entry['isExpense'] === undefined || typeof entry['isExpense'] === 'boolean');
}

function migrateLegacyEntry(
  entry: {
    income: number;
    expense: number;
    description?: string;
    art?: string;
    isIncome?: boolean;
    isExpense?: boolean;
  },
  index: number,
): CostEntry[] {
  const month = currentMonthKey();
  const commonFields = {
    description: entry.description ?? '',
    category: entry.art ?? '',
    month,
    isActive: true,
    endedAtMonth: null,
    recurrencePeriods: [],
  };
  const migratedEntries: CostEntry[] = [];

  if (entry.income > 0) {
    migratedEntries.push({
      ...commonFields,
      id: `migrated-${index}-income`,
      type: 'income',
      amount: entry.income,
      isRecurring: entry.isIncome ?? false,
    });
  }

  if (entry.expense > 0) {
    migratedEntries.push({
      ...commonFields,
      id: `migrated-${index}-expense`,
      type: 'expense',
      amount: entry.expense,
      isRecurring: entry.isExpense ?? false,
    });
  }

  return migratedEntries;
}

function isMonthKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function isRecurrencePeriod(value: unknown): value is RecurrencePeriod {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const period = value as Record<string, unknown>;
  return isMonthKey(period['startMonth'])
    && (period['endMonth'] === null || isMonthKey(period['endMonth']));
}

export function getRecurrencePeriods(entry: CostEntry): RecurrencePeriod[] {
  if (entry.recurrencePeriods && entry.recurrencePeriods.length > 0) {
    return entry.recurrencePeriods;
  }

  return [{
    startMonth: entry.month,
    endMonth: entry.isActive ? null : entry.endedAtMonth,
  }];
}

export function getAmountPeriods(entry: CostEntry): AmountPeriod[] {
  if (entry.amountPeriods && entry.amountPeriods.length > 0) {
    return [...entry.amountPeriods].sort((first, second) =>
      first.startMonth.localeCompare(second.startMonth),
    );
  }

  return [{ startMonth: entry.month, amount: entry.amount }];
}

export function amountForMonth(entry: CostEntry, month: string): number {
  const effectivePeriod = getAmountPeriods(entry)
    .filter(period => period.startMonth <= month)
    .at(-1);

  return effectivePeriod?.amount ?? entry.amount;
}

export function setAmountFromMonth(entry: CostEntry, month: string, amount: number): AmountPeriod[] {
  return [
    ...getAmountPeriods(entry).filter(period => period.startMonth < month),
    { startMonth: month, amount },
  ].sort((first, second) => first.startMonth.localeCompare(second.startMonth));
}

function isAmountPeriod(value: unknown): value is AmountPeriod {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const period = value as Record<string, unknown>;
  return isMonthKey(period['startMonth'])
    && typeof period['amount'] === 'number'
    && Number.isFinite(period['amount'])
    && period['amount'] > 0;
}
