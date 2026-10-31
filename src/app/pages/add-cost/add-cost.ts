import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SubHeader } from '../../components/sub-header/sub-header';
import { ButtonComponents } from '../../components/button-components/button-components';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import {
  CostEntry,
  CostType,
  currentMonthKey,
  RecurrenceInterval,
} from '../../models/cost-entry';
import { CostEntryStore } from '../../services/cost-entry-store.service';

@Component({
  imports: [FormsModule, SubHeader, ButtonComponents, CommonModule, MatIconModule],
  selector: 'app-add-cost',
  styleUrls: ['./add-cost.scss'],
  templateUrl: './add-cost.html',
})

export class AddCost implements OnInit {
  private readonly costEntryStore = inject(CostEntryStore);
  costType = signal<CostType>('expense');
  amount = signal<number | null>(null);
  description = signal('');
  category = signal('');
  month = signal(currentMonthKey());
  isRecurring = signal(false);
  recurrenceInterval = signal<RecurrenceInterval>('monthly');
  errorMessage = signal('');
  successMessage = signal('');
  loadingEntries = signal(true);
  saving = signal(false);
  costEntries = signal<CostEntry[]>([]);

  ngOnInit(): void {
    void this.loadEntries();
  }

  private async loadEntries(): Promise<void> {
    try {
      this.costEntries.set(await this.costEntryStore.loadCostEntries());
    } catch (error) {
      this.errorMessage.set(
        `Gespeicherte Einträge konnten nicht aus IndexedDB geladen werden: ${errorMessage(error)}`,
      );
    } finally {
      this.loadingEntries.set(false);
    }
  }

  updateAmount(value: number | string | null): void {
    this.amount.set(value === null || value === '' ? null : Number(value));
  }

  async addCost(): Promise<void> {
    this.successMessage.set('');
    if (this.loadingEntries() || this.errorMessage()) {
      return;
    }

    if (this.saving()) {
      return;
    }

    const amount = this.amount();
    if (amount === null || !Number.isFinite(amount) || amount <= 0) {
      this.errorMessage.set('Bitte gib einen Betrag!.');
      return;
    }

    if (!this.month()) {
      this.errorMessage.set('Bitte wähle einen Monat aus.');
      return;
    }

    if (!this.category()) {
      this.errorMessage.set('Bitte wähle eine Kategorie aus.');
      return;
    }

    this.errorMessage.set('');
    const entry: CostEntry = {
      id: crypto.randomUUID(),
      type: this.costType(),
      amount,
      description: this.description().trim(),
      category: this.category().trim(),
      month: this.month(),
      isRecurring: this.isRecurring(),
      recurrenceInterval: this.recurrenceInterval(),
      isActive: true,
      endedAtMonth: null,
    };

    const updatedEntries = [...this.costEntries(), entry];
    this.saving.set(true);
    try {
      await this.costEntryStore.saveCostEntries(updatedEntries);
    } catch (error) {
      this.errorMessage.set(`Der Eintrag konnte nicht in IndexedDB gespeichert werden: ${errorMessage(error)}`);
      return;
    } finally {
      this.saving.set(false);
    }

    this.costEntries.set(updatedEntries);
    setTimeout(() => this.successMessage.set(''), 3000);
    this.successMessage.set('Eintrag wurde erfolgreich gespeichert.');
    this.amount.set(null);
    this.description.set('');
    this.category.set('');
    this.isRecurring.set(false);
    this.recurrenceInterval.set('monthly');
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unbekannter Speicherfehler.';
}
