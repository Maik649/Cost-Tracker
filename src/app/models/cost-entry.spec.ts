import { describe, expect, it } from 'vitest';
import { occursInMonth, parseStoredCostEntries } from './cost-entry';

describe('cost-entry recurrence intervals', () => {
  it('migrates the previous yearly flag to yearly recurrence', () => {
    const [entry] = parseStoredCostEntries(JSON.stringify([{
      id: 'legacy-yearly',
      type: 'expense',
      amount: 80,
      description: 'Versicherung',
      category: 'Versicherung',
      month: '2025-06',
      isRecurring: false,
      isYearly: true,
      isActive: true,
      endedAtMonth: null,
    }]));

    expect(entry.isRecurring).toBe(true);
    expect(entry.recurrenceInterval).toBe('yearly');
    expect(occursInMonth(entry, '2026-06')).toBe(true);
    expect(occursInMonth(entry, '2026-07')).toBe(false);
  });

  it('defaults older recurring entries to monthly without changing their schedule', () => {
    const [entry] = parseStoredCostEntries(JSON.stringify([{
      id: 'legacy-monthly',
      type: 'expense',
      amount: 50,
      description: 'Miete',
      category: 'Wohnen',
      month: '2025-01',
      isRecurring: true,
      isActive: true,
      endedAtMonth: null,
    }]));

    expect(entry.recurrenceInterval).toBe('monthly');
    expect(occursInMonth(entry, '2025-04')).toBe(true);
  });
});
