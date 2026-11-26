import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ButtonComponents } from '../../components/button-components/button-components';
import { amountForMonth, CostEntry, occursInMonth } from '../../models/cost-entry';
import { CostEntryStore } from '../../services/cost-entry-store.service';

export interface UpcomingPayment {
  id: string;
  title: string;
  category: string;
  amount: number;
  month: string;
  monthLabel: string;
}

const upcomingPaymentLimit = 3;
const recurringLookAheadMonths = 12;
const euroFormatter = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
});

export function getUpcomingPayments(entries: CostEntry[], today = new Date()): UpcomingPayment[] {
  const recurringMonths = Array.from({ length: recurringLookAheadMonths }, (_, offset) => {
    const date = new Date(today.getFullYear(), today.getMonth() + offset + 1, 1);
    return monthKey(date.getFullYear(), date.getMonth());
  });
  const payments: UpcomingPayment[] = [];

  for (const entry of entries) {
    if (entry.type !== 'expense' || !entry.isRecurring || !entry.isActive) {
      continue;
    }

    const months = recurringMonths.filter(month => occursInMonth(entry, month));

    for (const month of months) {
      payments.push({
        id: `${entry.id}-${month}`,
        title: entry.description.trim() || entry.category.trim() || 'Ausgabe',
        category: entry.category.trim(),
        amount: amountForMonth(entry, month),
        month,
        monthLabel: formatMonth(month),
      });
    }
  }

  return payments
    .sort((first, second) =>
      monthIndex(first.month) - monthIndex(second.month)
      || first.title.localeCompare(second.title, 'de')
      || first.id.localeCompare(second.id),
    )
    .slice(0, upcomingPaymentLimit);
}

@Component({
  imports: [CommonModule, MatSidenavModule, MatIconModule, MatButtonModule, MatToolbarModule, RouterModule, ButtonComponents],
  selector: 'app-dashboard',
  styleUrls: ['./dashboard.scss'],
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly costEntryStore = inject(CostEntryStore);
  private readonly costEntries = signal<CostEntry[]>([]);
  readonly upcomingPayments = computed(() => getUpcomingPayments(this.costEntries()));
  readonly loadingUpcomingPayments = signal(true);
  readonly upcomingPaymentsError = signal('');

  

  ngOnInit(): void {
    void this.loadCostEntries();
  }

  formatAmount(amount: number): string {
    return euroFormatter.format(amount);
  }

  buttons = [
    { label: 'Kosten Übersicht', routerLink: '/doc-view' },
    { label: 'Kosten Hinzufügen', routerLink: '/add-cost' },
    { label: 'Auswertung', routerLink: '/diagram' },
  ];

  private async loadCostEntries(): Promise<void> {
    try {
      this.costEntries.set(await this.costEntryStore.loadCostEntries());
    } catch (error) {
      this.upcomingPaymentsError.set(
        `Anstehende Zahlungen konnten nicht geladen werden: ${errorMessage(error)}`,
      );
    } finally {
      this.loadingUpcomingPayments.set(false);
    }
  }
}

function monthKey(year: number, zeroBasedMonth: number): string {
  return `${year}-${String(zeroBasedMonth + 1).padStart(2, '0')}`;
}

function monthIndex(month: string): number {
  const [year, monthNumber] = month.split('-').map(Number);
  return year * 12 + monthNumber - 1;
}

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('de-DE', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, monthNumber - 1, 1));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unbekannter Fehler.';
}
