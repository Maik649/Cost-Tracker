import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DocView } from './doc-view';
import { currentMonthKey } from '../../models/cost-entry';
import { vi } from 'vitest';

describe('DocView', () => {
  let component: DocView;
  let fixture: ComponentFixture<DocView>;

  beforeEach(async () => {
    localStorage.removeItem('lastCost');
    await TestBed.configureTestingModule({
      imports: [DocView],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(DocView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('allows the yearly month summary to be expanded and collapsed', () => {
    fixture.detectChanges();
    const details = fixture.nativeElement.querySelector('.yearly-overview') as HTMLDetailsElement;
    const summary = details.querySelector('summary') as HTMLElement;

    expect(details.open).toBe(true);
    summary.click();
    expect(details.open).toBe(false);
    summary.click();
    expect(details.open).toBe(true);
  });

  it('uses the shared button component and Material icons throughout the view', () => {
    fixture.detectChanges();
    const buttonComponents = fixture.nativeElement.querySelectorAll('app-button-components');

    expect(buttonComponents.length).toBeGreaterThan(0);
    expect(fixture.nativeElement.querySelectorAll('button').length).toBe(buttonComponents.length);
    expect(fixture.nativeElement.querySelectorAll('app-button-components mat-icon').length)
      .toBe(buttonComponents.length);
    expect(
      Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
        .every(button => button.textContent?.trim() || button.getAttribute('aria-label')),
    ).toBe(true);
  });

  it('shows recurring entries from their start month and calculates monthly totals', () => {
    component.selectedMonth.set('2026-10');
    component.kostenList.set([
      {
        id: 'salary',
        type: 'income',
        amount: 2800,
        description: 'Gehalt',
        category: 'Arbeit',
        month: '2026-09',
        isRecurring: true,
        isActive: true,
        endedAtMonth: null,
      },
      {
        id: 'rent',
        type: 'expense',
        amount: 950,
        description: 'Miete',
        category: 'Wohnen',
        month: '2026-10',
        isRecurring: false,
        isActive: true,
        endedAtMonth: null,
      },
      {
        id: 'future',
        type: 'expense',
        amount: 50,
        description: 'Noch nicht aktiv',
        category: 'Test',
        month: '2026-11',
        isRecurring: true,
        isActive: true,
        endedAtMonth: null,
      },
      {
        id: 'paused',
        type: 'expense',
        amount: 20,
        description: 'Pausiert',
        category: 'Test',
        month: '2026-08',
        isRecurring: true,
        isActive: false,
        endedAtMonth: '2026-10',
      },
    ]);

    expect(component.monthlyEntries().map(entry => entry.id)).toEqual(['salary', 'rent']);
    expect(component.totalIncome()).toBe(2800);
    expect(component.totalExpense()).toBe(950);
    expect(component.balance()).toBe(1850);
    expect(component.inactiveRecurringEntries().map(entry => entry.id)).toEqual(['paused']);

    component.selectedMonth.set('2026-09');
    expect(component.monthlyEntries().map(entry => entry.id)).toEqual(['salary', 'paused']);

    component.selectedYear.set(2026);
    expect(component.yearlyMonths()).toHaveLength(12);
    expect(component.yearlyMonths()[0]).toMatchObject({
      key: '2026-01',
      name: 'Januar',
      income: 0,
      expense: 0,
      balance: 0,
    });
    expect(component.yearlyMonths()[7]).toMatchObject({
      key: '2026-08',
      income: 0,
      expense: 20,
      balance: -20,
    });
    expect(component.yearlyMonths()[8]).toMatchObject({
      key: '2026-09',
      income: 2800,
      expense: 20,
      balance: 2780,
    });
    expect(component.yearlyMonths()[9]).toMatchObject({
      key: '2026-10',
      income: 2800,
      expense: 950,
      balance: 1850,
    });
    expect(component.yearlyMonths()[10]).toMatchObject({
      key: '2026-11',
      income: 2800,
      expense: 50,
      balance: 2750,
    });
    expect(component.yearlyMonths()[11]).toMatchObject({
      key: '2026-12',
      income: 2800,
      expense: 50,
      balance: 2750,
    });
    expect(component.yearlyIncome()).toBe(11200);
    expect(component.yearlyExpense()).toBe(1090);
    expect(component.yearlyBalance()).toBe(10110);

    component.showMonth('2026-11');
    expect(component.selectedMonth()).toBe('2026-11');
    expect(component.monthlyEntries().map(entry => entry.id)).toEqual(['salary', 'future']);
  });

  it('keeps a paused recurring entry in the current month and removes it from following months', () => {
    const currentMonth = currentMonthKey();
    const [year, monthNumber] = currentMonth.split('-').map(Number);
    const followingMonth = monthNumber === 12
      ? `${year + 1}-01`
      : `${year}-${String(monthNumber + 1).padStart(2, '0')}`;
    component.selectedMonth.set(currentMonth);
    component.kostenList.set([{
      id: 'internet',
      type: 'expense',
      amount: 40,
      description: 'Internet',
      category: 'Wohnen',
      month: '2000-01',
      isRecurring: true,
      isActive: true,
      endedAtMonth: null,
    }]);

    component.deactivateRecurring('internet');
    expect(component.monthlyEntries()).toHaveLength(1);
    expect(component.inactiveRecurringEntries()).toHaveLength(1);

    component.selectedMonth.set(followingMonth);
    expect(component.monthlyEntries()).toHaveLength(0);

    component.selectedMonth.set('2000-01');
    expect(component.monthlyEntries()).toHaveLength(1);
  });

  it('reactivates a recurring entry from this month while preserving its previous active period', () => {
    const currentMonth = currentMonthKey();
    const previousYear = Number(currentMonth.slice(0, 4)) - 1;
    component.selectedMonth.set(currentMonth);
    component.kostenList.set([{
      id: 'gym',
      type: 'expense',
      amount: 35,
      description: 'Fitnessstudio',
      category: 'Freizeit',
      month: `${previousYear}-01`,
      isRecurring: true,
      isActive: false,
      endedAtMonth: `${previousYear}-04`,
      recurrencePeriods: [{
        startMonth: `${previousYear}-01`,
        endMonth: `${previousYear}-04`,
      }],
    }]);

    component.reactivateRecurring('gym');

    expect(component.monthlyEntries()).toHaveLength(1);
    expect(component.inactiveRecurringEntries()).toHaveLength(0);
    expect(component.kostenList()[0].recurrencePeriods).toEqual([
      { startMonth: `${previousYear}-01`, endMonth: `${previousYear}-04` },
      { startMonth: currentMonth, endMonth: null },
    ]);
    expect(JSON.parse(localStorage.getItem('lastCost') ?? '[]')[0].isActive).toBe(true);

    component.selectedMonth.set(`${previousYear}-03`);
    expect(component.monthlyEntries()).toHaveLength(1);
    component.selectedMonth.set(`${previousYear}-05`);
    expect(component.monthlyEntries()).toHaveLength(0);
  });

  it('edits entry details without changing the recurrence schedule', () => {
    const entry = {
      id: 'rent',
      type: 'expense' as const,
      amount: 950,
      description: 'Miete',
      category: 'Wohnen',
      month: '2026-01',
      isRecurring: true,
      isActive: true,
      endedAtMonth: null,
      recurrencePeriods: [
        { startMonth: '2026-01', endMonth: '2026-06' },
        { startMonth: '2026-09', endMonth: null },
      ],
    };
    component.kostenList.set([entry]);
    component.startEditing(entry);
    component.editAmount.set(1000);
    component.editDescription.set('Wohnungsmiete');

    component.saveEditedEntry();

    expect(component.kostenList()[0]).toMatchObject({
      amount: 1000,
      description: 'Wohnungsmiete',
      isRecurring: true,
      recurrencePeriods: entry.recurrencePeriods,
    });
  });

  it('changes a recurring amount from the selected month without changing previous months', () => {
    const entry = {
      id: 'electricity',
      type: 'expense' as const,
      amount: 100,
      description: 'Strom',
      category: 'Wohnen',
      month: '2026-01',
      isRecurring: true,
      isActive: true,
      endedAtMonth: null,
    };
    component.selectedMonth.set('2026-03');
    component.kostenList.set([entry]);
    component.startEditing(entry);
    component.editAmount.set(125);

    expect(component.editEffectiveMonth()).toBe('2026-03');
    component.saveEditedEntry();

    expect(component.kostenList()[0].amountPeriods).toEqual([
      { startMonth: '2026-01', amount: 100 },
      { startMonth: '2026-03', amount: 125 },
    ]);
    expect(component.totalExpense()).toBe(125);

    component.selectedMonth.set('2026-02');
    expect(component.totalExpense()).toBe(100);
    component.selectedMonth.set('2026-04');
    expect(component.totalExpense()).toBe(125);

    component.selectedYear.set(2026);
    expect(component.yearlyMonths()[0].expense).toBe(100);
    expect(component.yearlyMonths()[1].expense).toBe(100);
    expect(component.yearlyMonths()[2].expense).toBe(125);
    expect(component.yearlyExpense()).toBe(1450);
  });

  it('deletes an entry only after confirmation', () => {
    component.kostenList.set([{
      id: 'coffee',
      type: 'expense',
      amount: 4,
      description: 'Kaffee',
      category: 'Essen',
      month: currentMonthKey(),
      isRecurring: false,
      isActive: true,
      endedAtMonth: null,
    }]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    component.deleteEntry('coffee');
    expect(component.kostenList()).toHaveLength(1);

    confirmSpy.mockReturnValue(true);
    component.deleteEntry('coffee');
    expect(component.kostenList()).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem('lastCost') ?? '[]')).toHaveLength(0);

    confirmSpy.mockRestore();
  });
});
