import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { CostEntry, currentMonthKey } from '../../models/cost-entry';
import { CostEntryStore } from '../../services/cost-entry-store.service';
import { Diagram } from './diagram';

describe('Diagram', () => {
  let fixture: ComponentFixture<Diagram>;
  let component: Diagram;
  let loadCostEntries: ReturnType<typeof vi.fn>;

  async function initialize(entries: CostEntry[] = []): Promise<void> {
    loadCostEntries = vi.fn().mockResolvedValue(entries);
    await TestBed.configureTestingModule({
      imports: [Diagram],
      providers: [
        { provide: CostEntryStore, useValue: { loadCostEntries } },
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Diagram);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    await vi.waitFor(() => expect(loadCostEntries).toHaveBeenCalled());
    fixture.detectChanges();
  }

  it('should create', async () => {
    await initialize();

    expect(component).toBeTruthy();
  });

  it('groups expenses for the selected month and excludes income', async () => {
    await initialize([
      makeEntry({ id: 'rent-january', category: 'miete', amount: 700, month: '2025-01' }),
      makeEntry({ id: 'rent-february', category: 'Miete', amount: 700, month: '2025-02' }),
      makeEntry({ id: 'tobacco', category: 'Tabak', amount: 40, month: '2025-02' }),
      makeEntry({ id: 'income', type: 'income', category: 'Gehalt', amount: 2000, month: '2025-02' }),
    ]);

    component.selectMonth('2025-02');
    fixture.detectChanges();

    expect(component.selectedMonth()).toBe('2025-02');
    expect(component.categoryTotals()).toEqual([
      { category: 'Miete', amount: 700, barWidth: 100 },
      { category: 'Tabak', amount: 40, barWidth: (40 / 700) * 100 },
    ]);
    expect(fixture.nativeElement.textContent).toContain('Miete');
    expect(fixture.nativeElement.textContent).toContain('Tabak');

    component.selectMonth('2025-01');
    fixture.detectChanges();

    expect(component.categoryTotals()).toEqual([
      { category: 'miete', amount: 700, barWidth: 100 },
    ]);
    expect(component.totalExpenses()).toBe(700);
  });

  it('shows recurring expenses only in active selected months using the applicable amount', async () => {
    const thisMonth = currentMonthKey();
    const previousMonth = previousMonthKey(thisMonth);
    await initialize([
      makeEntry({
        id: 'rent',
        category: 'Miete',
        amount: 75,
        month: previousMonth,
        isRecurring: true,
        recurrencePeriods: [{ startMonth: previousMonth, endMonth: null }],
        amountPeriods: [
          { startMonth: previousMonth, amount: 50 },
          { startMonth: thisMonth, amount: 75 },
        ],
      }),
    ]);

    expect(component.categoryTotals()[0]?.amount).toBe(75);

    component.selectMonth(previousMonth);

    expect(component.categoryTotals()[0]?.amount).toBe(50);
  });

  it('counts quarterly and yearly recurring expenses only in their occurrence months', async () => {
    await initialize([
      makeEntry({
        id: 'quarterly',
        category: 'Versicherung',
        amount: 30,
        month: '2025-01',
        isRecurring: true,
        recurrenceInterval: 'quarterly',
      }),
      makeEntry({
        id: 'yearly',
        category: 'Mitgliedschaft',
        amount: 80,
        month: '2024-06',
        isRecurring: true,
        recurrenceInterval: 'yearly',
      }),
    ]);

    component.selectMonth('2025-03');
    expect(component.totalExpenses()).toBe(0);

    component.selectMonth('2025-04');
    expect(component.totalExpenses()).toBe(30);

    component.selectMonth('2025-06');
    expect(component.totalExpenses()).toBe(80);

    component.selectMonth('2025-07');
    expect(component.totalExpenses()).toBe(30);
  });

  it('allows selecting future months and calculates ongoing recurring expenses there', async () => {
    await initialize([
      makeEntry({
        id: 'rent',
        category: 'Miete',
        amount: 900,
        month: '2025-01',
        isRecurring: true,
        recurrencePeriods: [{ startMonth: '2025-01', endMonth: null }],
      }),
      makeEntry({
        id: 'one-time',
        category: 'Reparatur',
        amount: 200,
        month: '2025-01',
      }),
    ]);

    component.selectMonth('2030-06');

    expect(component.selectedMonth()).toBe('2030-06');
    expect(component.categoryTotals()).toEqual([
      { category: 'Miete', amount: 900, barWidth: 100 },
    ]);
    expect(component.totalExpenses()).toBe(900);
  });
});

function makeEntry(overrides: Partial<CostEntry>): CostEntry {
  return {
    id: 'entry',
    type: 'expense',
    amount: 100,
    description: '',
    category: '',
    month: currentMonthKey(),
    isRecurring: false,
    isActive: true,
    endedAtMonth: null,
    ...overrides,
  };
}

function previousMonthKey(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return monthNumber === 1
    ? `${year - 1}-12`
    : `${year}-${String(monthNumber - 1).padStart(2, '0')}`;
}
