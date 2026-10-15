import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AddCost } from './add-cost';
import { loadCostEntries } from '../../models/cost-entry';
import { vi } from 'vitest';

describe('AddCost', () => {
  let component: AddCost;
  let fixture: ComponentFixture<AddCost>;

  beforeEach(async () => {
    localStorage.removeItem('lastCost');
    await TestBed.configureTestingModule({
      imports: [AddCost],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AddCost);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('saves a typed entry for the selected month', () => {
    component.costType.set('income');
    component.amount.set(2800);
    component.description.set('Gehalt');
    component.category.set('Arbeit');
    component.month.set('2026-10');
    component.isRecurring.set(true);

    component.addCost();

    const savedEntries = JSON.parse(localStorage.getItem('lastCost') ?? '[]');
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

  it('does not show success when the entry cannot be saved', () => {
    component.amount.set(25);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage is full');
    });

    component.addCost();

    expect(component.successMessage()).toBe('');
    expect(component.errorMessage()).toContain('Der Eintrag konnte nicht gespeichert werden');
    expect(component.lastCost()).toHaveLength(0);

    setItem.mockRestore();
  });

  it('does not show success for an invalid amount', () => {
    component.amount.set(0);

    component.addCost();

    expect(component.successMessage()).toBe('');
    expect(component.errorMessage()).toContain('Betrag größer als 0');
  });

  it('migrates saved entries from the previous format', () => {
    localStorage.setItem('lastCost', JSON.stringify([{
      income: 2800,
      expense: 0,
      description: 'Gehalt',
      art: 'Arbeit',
      isIncome: true,
      isExpense: false,
    }]));

    const migrated = loadCostEntries();

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
