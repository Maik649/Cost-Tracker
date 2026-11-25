import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../../services/auth.service';
import { CostEntryStore } from '../../services/cost-entry-store.service';
import { CostEntry } from '../../models/cost-entry';
import { Dashboard, getUpcomingPayments } from './dashboard';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => true,
            currentUser: () => null,
            isGuest: () => true,
            headerUserLabel: () => 'Gast',
            logout: vi.fn(),
          },
        },
        {
          provide: CostEntryStore,
          useValue: { loadCostEntries: vi.fn(async () => []) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows only the three nearest upcoming recurring expenses', () => {
    const payments = getUpcomingPayments([
      costEntry({
        id: 'rent',
        description: 'Miete',
        month: '2026-05',
        isRecurring: true,
        recurrenceInterval: 'monthly',
      }),
      costEntry({ id: 'one-time', description: 'Einmalig', month: '2026-05' }),
      costEntry({
        id: 'income',
        type: 'income',
        description: 'Einnahme',
        month: '2026-05',
        isRecurring: true,
      }),
    ], new Date(2026, 4, 15));

    expect(payments.map(payment => payment.month)).toEqual([
      '2026-06',
      '2026-07',
      '2026-08',
    ]);
  });

  it('uses quarterly and yearly recurrence schedules', () => {
    const quarterlyPayments = getUpcomingPayments([
      costEntry({
        id: 'insurance',
        month: '2026-02',
        isRecurring: true,
        recurrenceInterval: 'quarterly',
      }),
    ], new Date(2026, 4, 15));
    const yearlyPayments = getUpcomingPayments([
      costEntry({
        id: 'subscription',
        month: '2025-11',
        isRecurring: true,
        recurrenceInterval: 'yearly',
      }),
    ], new Date(2026, 4, 15));

    expect(quarterlyPayments.map(payment => payment.month)).toEqual([
      '2026-08',
      '2026-11',
      '2027-02',
    ]);
    expect(yearlyPayments.map(payment => payment.month)).toEqual(['2026-11']);
  });

  it('starts from December when today is late in November', () => {
    const payments = getUpcomingPayments([
      costEntry({
        id: 'rent',
        month: '2026-01',
        isRecurring: true,
        recurrenceInterval: 'monthly',
      }),
    ], new Date(2026, 10, 25));

    expect(payments.map(payment => payment.month)).toEqual([
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
  });
});

function costEntry(overrides: Partial<CostEntry>): CostEntry {
  return {
    id: 'expense',
    type: 'expense',
    amount: 25,
    description: 'Ausgabe',
    category: 'Sonstiges',
    month: '2026-05',
    isRecurring: false,
    isActive: true,
    endedAtMonth: null,
    ...overrides,
  };
}
