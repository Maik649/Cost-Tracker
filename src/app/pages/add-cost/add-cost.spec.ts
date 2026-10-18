import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AddCost } from './add-cost';
import { CostEntry, parseStoredCostEntries } from '../../models/cost-entry';
import { CostEntryStore } from '../../services/cost-entry-store.service';
import { vi } from 'vitest';

describe('AddCost', () => {
  let component: AddCost;
  let fixture: ComponentFixture<AddCost>;
  const costEntryStore = {
    loadCostEntries: vi.fn(async () => [] as CostEntry[]),
    saveCostEntries: vi.fn(async (_entries: CostEntry[]) => undefined),
  };

  beforeEach(async () => {
    costEntryStore.loadCostEntries.mockReset().mockResolvedValue([]);
    costEntryStore.saveCostEntries.mockReset().mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [AddCost],
      providers: [
        provideRouter([]),
        { provide: CostEntryStore, useValue: costEntryStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddCost);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('saves a typed entry for the selected month', async () => {
    component.costType.set('income');
    component.amount.set(2800);
    component.description.set('Gehalt');
    component.category.set('Arbeit');
    component.month.set('2026-10');
    component.isRecurring.set(true);

    await component.addCost();

    const savedEntries = costEntryStore.saveCostEntries.mock.calls[0][0];
    expect(savedEntries).toHaveLength(1);
    expect(savedEntries[0]).toMatchObject({
      type: 'income',
      amount: 2800,
      description: 'Gehalt',
      category: 'Arbeit',
      month: '2026-10',
      isRecurring: true,
      isActive: true,
    });
    expect(component.successMessage()).toBe('Eintrag wurde erfolgreich gespeichert.');
    expect(component.errorMessage()).toBe('');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent)
      .toContain('Eintrag wurde erfolgreich gespeichert.');
  });

  it('does not show success when the entry cannot be saved', async () => {
    component.amount.set(25);
    costEntryStore.saveCostEntries.mockRejectedValue(new Error('Storage is full'));

    await component.addCost();

    expect(component.successMessage()).toBe('');
    expect(component.errorMessage()).toContain('Der Eintrag konnte nicht gespeichert werden');
    expect(component.costEntries()).toHaveLength(0);

  });

  it('does not show success for an invalid amount', () => {
    component.amount.set(0);

    component.addCost();

    expect(component.successMessage()).toBe('');
    expect(component.errorMessage()).toContain('Betrag größer als 0');
  });

  it('migrates saved entries from the previous format', () => {
    const migrated = parseStoredCostEntries(JSON.stringify([{
      income: 2800,
      expense: 0,
      description: 'Gehalt',
      art: 'Arbeit',
      isIncome: true,
      isExpense: false,
    }]));

    expect(migrated).toHaveLength(1);
    expect(migrated[0]).toMatchObject({
      type: 'income',
      amount: 2800,
      description: 'Gehalt',
      category: 'Arbeit',
      isRecurring: true,
      isActive: true,
    });
    expect(migrated[0].month).toMatch(/^\d{4}-\d{2}$/);
  });
});
