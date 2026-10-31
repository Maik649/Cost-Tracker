import { CommonModule, registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  amountForMonth,
  CostEntry,
  currentMonthKey,
  occursInMonth,
} from '../../models/cost-entry';
import { SubHeader } from '../../components/sub-header/sub-header';
import { CostEntryStore } from '../../services/cost-entry-store.service';
import { LoadingSpinner } from '../../components/loading-spinner/loading-spinner';

registerLocaleData(localeDe);

interface CategoryTotal {
  category: string;
  amount: number;
  barWidth: number;
}

@Component({
  imports: [CommonModule, SubHeader, LoadingSpinner],
  selector: 'app-diagram',
  styleUrls: ['./diagram.scss'],
  templateUrl: './diagram.html',
  standalone: true,
})
export class Diagram implements OnInit {
  private readonly costEntryStore = inject(CostEntryStore);
  private costEntries: CostEntry[] = [];

  selectedMonth = signal(currentMonthKey());
  categoryTotals = signal<CategoryTotal[]>([]);
  totalExpenses = signal(0);
  loadingEntries = signal(true);
  errorMessage = signal('');

  ngOnInit(): void {
    setTimeout(
      () => {
        this.loadingEntries.set(true);
        void this.loadCostEntries();
      },
      500);
  }

  private async loadCostEntries(): Promise<void> {
    try {
      this.costEntries = await this.costEntryStore.loadCostEntries();
      this.updateTotals();
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Unbekannter Speicherfehler.',
      );
    } finally {
      this.loadingEntries.set(false);
    }
  }

  selectMonth(month: string): void {
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      this.selectedMonth.set(month);
      this.updateTotals();
    }
  }

  monthLabel(month: string): string {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' })
      .format(new Date(year, monthNumber - 1, 1));
  }

  private updateTotals(): void {
    const categoryTotals = this.getCategoryTotals(this.costEntries, this.selectedMonth());
    this.categoryTotals.set(categoryTotals);
    this.totalExpenses.set(categoryTotals.reduce((total, category) => total + category.amount, 0));
  }

  private getCategoryTotals(entries: CostEntry[], month: string): CategoryTotal[] {
    const totals = new Map<string, { category: string; amount: number }>();

    const addAmount = (entry: CostEntry): void => {
      const category = entry.category.trim() || 'Ohne Kategorie';
      const key = category.toLocaleLowerCase('de');
      const total = totals.get(key) ?? { category, amount: 0 };
      total.amount += amountForMonth(entry, month);
      totals.set(key, total);
    };

    for (const entry of entries) {
      if (entry.type !== 'expense') {
        continue;
      }

      if (occursInMonth(entry, month)) {
        addAmount(entry);
      }
    }

    const categoryAmounts = [...totals.values()].sort((first, second) =>
      second.amount - first.amount || first.category.localeCompare(second.category, 'de'),
    );
    const largestAmount = categoryAmounts[0]?.amount ?? 0;

    return categoryAmounts.map(category => ({
      ...category,
      barWidth: largestAmount > 0 ? (category.amount / largestAmount) * 100 : 0,
    }));
  }
}
