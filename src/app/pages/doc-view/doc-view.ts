import { CurrencyPipe, registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponents } from '../../components/button-components/button-components';
import { LoadingSpinner } from '../../components/loading-spinner/loading-spinner';
import { SubHeader } from '../../components/sub-header/sub-header';
import { CostType } from '../../models/cost-entry';
import {
  amountForMonth,
  CostEntry,
  currentMonthKey,
  getRecurrencePeriods,
  setAmountFromMonth,
} from '../../models/cost-entry';
import { CostEntryStore } from '../../services/cost-entry-store.service';

registerLocaleData(localeDe);

const monthsOfYear = [
  { number: 1, name: 'Jan.' },
  { number: 2, name: 'Febr.' },
  { number: 3, name: 'Mär.' },
  { number: 4, name: 'Apr.' },
  { number: 5, name: 'Mai' },
  { number: 6, name: 'Jun.' },
  { number: 7, name: 'Jul.' },
  { number: 8, name: 'Aug.' },
  { number: 9, name: 'Sept.' },
  { number: 10, name: 'Okt.' },
  { number: 11, name: 'Nov.' },
  { number: 12, name: 'Dez.' },
];

type SortMode = 'description' | 'amount' | 'none';

function entryLabel(entry: CostEntry): string {
  return entry.description.trim() || entry.category.trim() || 'Ohne Bezeichnung';
}

@Component({
  selector: 'app-doc-view',
  templateUrl: './doc-view.html',
  styleUrls: ['./doc-view.scss'],
  imports: [ButtonComponents, CurrencyPipe, FormsModule, SubHeader, LoadingSpinner],
})
export class DocView implements OnInit {
  private readonly costEntryStore = inject(CostEntryStore);
  selectedMonth = signal(currentMonthKey());
  selectedYear = signal(Number(currentMonthKey().slice(0, 4)));
  CostList = signal<CostEntry[]>([]);
  loadingEntries = signal(true);
  storageError = signal('');
  editingEntryId = signal<string | null>(null);
  editType = signal<CostType>('expense');
  editAmount = signal<number | null>(null);
  editDescription = signal('');
  editCategory = signal('');
  editEffectiveMonth = signal(currentMonthKey());
  editIsRecurring = signal(false);
  editError = signal('');

  sortMode = signal<SortMode>('description');
  searchTerm = signal('');

  ngOnInit(): void {
    setTimeout(() => {
      this.loadingEntries.set(true);
      void this.loadEntries();
    }, 600);
  }

  private async loadEntries(): Promise<void> {
    try {
      this.CostList.set(await this.costEntryStore.loadCostEntries());
    } catch (error) {
      this.storageError.set(`Gespeicherte Einträge konnten nicht aus IndexedDB geladen werden: ${errorMessage(error)}`);
    } finally {
      this.loadingEntries.set(false);
    }
  }

  private async persistEntries(entries: CostEntry[]): Promise<boolean> {
    try {
      await this.costEntryStore.saveCostEntries(entries);
      this.CostList.set(entries);
      this.storageError.set('');
      return true;
    } catch (error) {
      this.storageError.set(`Änderungen konnten nicht in IndexedDB gespeichert werden: ${errorMessage(error)}`);
      return false;
    }
  }

  monthlyEntries = computed(() => {
    const month = this.selectedMonth();
    const term = this.searchTerm().trim().toLocaleLowerCase('de');
    const entries = this.allMonthEntries().filter(entry =>
      !term || `${entry.description} ${entry.category}`.toLocaleLowerCase('de').includes(term),
    );
    const mode = this.sortMode();
    if (mode === 'none') {
      return entries;
    }
    return [...entries].sort((a, b) =>
      mode === 'amount'
        ? amountForMonth(b, month) - amountForMonth(a, month)
        : entryLabel(a).localeCompare(entryLabel(b), 'de'),
    );
  });

  searchActive = computed(() => this.searchTerm().trim().length > 0);

  searchIncome = computed(() => this.sumByType('income'));
  searchExpense = computed(() => this.sumByType('expense'));

  private sumByType(type: CostType): number {
    const month = this.selectedMonth();
    return this.monthlyEntries()
      .filter(entry => entry.type === type)
      .reduce((total, entry) => total + amountForMonth(entry, month), 0);
  }

  yearMonths = computed(() =>
    monthsOfYear.map(month => ({
      key: `${this.selectedYear()}-${String(month.number).padStart(2, '0')}`,
      name: month.name,
    })),
  );

  inactiveRecurringEntries = computed(() =>
    this.CostList().filter(entry => entry.isRecurring && !entry.isActive),
  );

  allMonthEntries = computed(() =>
    this.CostList().filter(entry => isEntryInMonth(entry, this.selectedMonth())),
  );

  totalIncome = computed(() =>
    this.allMonthEntries()
      .filter(entry => entry.type === 'income')
      .reduce((total, entry) => total + amountForMonth(entry, this.selectedMonth()), 0),
  );

  totalExpense = computed(() =>
    this.allMonthEntries()
      .filter(entry => entry.type === 'expense')
      .reduce((total, entry) => total + amountForMonth(entry, this.selectedMonth()), 0),
  );

  balance = computed(() => this.totalIncome() - this.totalExpense());

  updateYear(value: number | string | null): void {
    const year = Number(value);
    if (Number.isInteger(year) && year >= 1900 && year <= 9999) {
      this.selectedYear.set(year);
    }
  }

  showMonth(month: string): void {
    this.selectedMonth.set(month);
  }

  startEditing(entry: CostEntry): void {
    this.editingEntryId.set(entry.id);
    this.editType.set(entry.type);
    this.editAmount.set(entry.amount);
    this.editDescription.set(entry.description);
    this.editCategory.set(entry.category);
    this.editIsRecurring.set(entry.isRecurring);
    this.editEffectiveMonth.set(
      this.selectedMonth() >= entry.month ? this.selectedMonth() : entry.month,
    );
    this.editError.set('');
  }

  updateEditAmount(value: number | string | null): void {
    this.editAmount.set(value === null || value === '' ? null : Number(value));
  }

  updateEditEffectiveMonth(value: string): void {
    this.editEffectiveMonth.set(value);
  }

  amountForSelectedMonth(entry: CostEntry): number {
    return amountForMonth(entry, this.selectedMonth());
  }

  cancelEditing(): void {
    this.editingEntryId.set(null);
    this.editError.set('');
  }

  async saveEditedEntry(): Promise<void> {
    const entryId = this.editingEntryId();
    const amount = this.editAmount();
    if (entryId === null) {
      return;
    }

    if (amount === null || !Number.isFinite(amount) || amount <= 0) {
      this.editError.set('Bitte gib einen Betrag größer als 0 ein.');
      return;
    }

    const effectiveMonth = this.editEffectiveMonth();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(effectiveMonth)) {
      this.editError.set('Bitte wähle einen gültigen Wirksamkeitsmonat aus.');
      return;
    }

    const existingEntry = this.CostList().find(entry => entry.id === entryId);
    if (!existingEntry) {
      this.editError.set('Der Eintrag konnte nicht gefunden werden.');
      return;
    }

    if (existingEntry.isRecurring && effectiveMonth < existingEntry.month) {
      this.editError.set('Der Wirksamkeitsmonat darf nicht vor dem Start der Wiederholung liegen.');
      return;
    }

    const updatedEntry: CostEntry = {
      ...existingEntry,
      type: this.editType(),
      amount,
      description: this.editDescription().trim(),
      category: this.editCategory().trim(),
      ...(existingEntry.isRecurring
        ? { amountPeriods: setAmountFromMonth(existingEntry, effectiveMonth, amount) }
        : {}),
    };
    const updatedEntries = this.CostList().map(entry =>
      entry.id === entryId ? updatedEntry : entry,
    );
    if (await this.persistEntries(updatedEntries)) {
      this.cancelEditing();
    }
  }

  async deleteEntry(entryId: string): Promise<void> {
    const entry = this.CostList().find(candidate => candidate.id === entryId);
    if (!entry) {
      return;
    }

    const label = entry.description || entry.category || 'diesen Eintrag';
    if (!window.confirm(`Möchtest du „${label}“ wirklich dauerhaft löschen?`)) {
      return;
    }

    const updatedEntries = this.CostList().filter(candidate => candidate.id !== entryId);
    if (!await this.persistEntries(updatedEntries)) {
      return;
    }
    if (this.editingEntryId() === entryId) {
      this.cancelEditing();
    }
  }

  async deactivateRecurring(entryId: string): Promise<void> {
    const endedAtMonth = followingMonthKey(currentMonthKey());
    const updatedEntries = this.CostList().map(entry =>
      entry.id === entryId && entry.isRecurring && entry.isActive
        ? {
          ...entry,
          isActive: false,
          endedAtMonth,
          recurrencePeriods: getRecurrencePeriods(entry).map((period, index, periods) =>
            index === periods.length - 1 && period.endMonth === null
              ? { ...period, endMonth: endedAtMonth }
              : period,
          ),
        }
        : entry,
    );
    await this.persistEntries(updatedEntries);
  }

  async reactivateRecurring(entryId: string): Promise<void> {
    const startMonth = currentMonthKey();
    const updatedEntries = this.CostList().map(entry =>
      entry.id === entryId && entry.isRecurring && !entry.isActive
        ? {
          ...entry,
          isActive: true,
          endedAtMonth: null,
          recurrencePeriods: [
            ...getRecurrencePeriods(entry),
            { startMonth, endMonth: null },
          ],
        }
        : entry,
    );
    await this.persistEntries(updatedEntries);
  }
}

function isEntryInMonth(entry: CostEntry, month: string): boolean {
  return entry.isRecurring
    ? getRecurrencePeriods(entry).some(period =>
      period.startMonth <= month && (period.endMonth === null || month < period.endMonth),
    )
    : entry.month === month;
}

function followingMonthKey(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return monthNumber === 12
    ? `${year + 1}-01`
    : `${year}-${String(monthNumber + 1).padStart(2, '0')}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unbekannter Speicherfehler.';
}
