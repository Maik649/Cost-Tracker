import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SubHeader } from '../../components/sub-header/sub-header';
import { ButtonComponents } from '../../components/button-components/button-components';
import { CommonModule } from '@angular/common';
import {
  CostEntry,
  CostType,
  currentMonthKey,
  loadCostEntries,
  saveCostEntries,
} from '../../models/cost-entry';

@Component({
  imports: [FormsModule, SubHeader, ButtonComponents, CommonModule],
  selector: 'app-add-cost',
  styleUrls: ['./add-cost.scss'],
  templateUrl: './add-cost.html',
})

export class AddCost {
  costType = signal<CostType>('expense');
  amount = signal<number | null>(null);
  description = signal('');
  category = signal('');
  month = signal(currentMonthKey());
  isRecurring = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  lastCost = signal<CostEntry[]>(loadCostEntries());



  updateAmount(value: number | string | null): void {
    this.amount.set(value === null || value === '' ? null : Number(value));
  }

  addCost(): void {
    this.successMessage.set('');
    const amount = this.amount();
    if (amount === null || !Number.isFinite(amount) || amount <= 0) {
      this.errorMessage.set('Bitte gib einen Betrag größer als 0 ein.');
      return;
    }

    if (!this.month()) {
      this.errorMessage.set('Bitte wähle einen Monat aus.');
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
      isActive: true,
      endedAtMonth: null,
    };
    const updatedEntries = [...this.lastCost(), entry];
    try {
      saveCostEntries(updatedEntries);
    } catch {
      setTimeout(() => this.errorMessage.set(''), 3000);
      this.errorMessage.set('Der Eintrag konnte nicht gespeichert werden. Bitte prüfe den verfügbaren Speicherplatz.');
      return;
    }

    this.lastCost.set(updatedEntries);
    setTimeout(() => this.successMessage.set(''), 3000);
    this.successMessage.set('Eintrag wurde erfolgreich gespeichert.');
    this.amount.set(null);
    this.description.set('');
    this.category.set('');
    this.isRecurring.set(false);
  }
}
