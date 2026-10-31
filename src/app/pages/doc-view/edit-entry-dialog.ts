import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  CostEntry,
  CostType,
  getRecurrenceInterval,
  RecurrenceInterval,
} from '../../models/cost-entry';

export interface EditEntryDialogData {
  entry: CostEntry;
  selectedMonth: string;
}

export interface EditEntryResult {
  type: CostType;
  amount: number;
  description: string;
  category: string;
  effectiveMonth: string;
  recurrenceInterval: RecurrenceInterval;
}

@Component({
  selector: 'app-edit-entry-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './edit-entry-dialog.html',
  styleUrl: './edit-entry-dialog.scss',
})
export class EditEntryDialog {
  readonly data = inject<EditEntryDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<EditEntryDialog, EditEntryResult>>(MatDialogRef);

  type = this.data.entry.type;
  amount: number | null = this.data.entry.amount;
  description = this.data.entry.description;
  category = this.data.entry.category;
  recurrenceInterval = getRecurrenceInterval(this.data.entry);

  effectiveMonth =
    this.data.selectedMonth >= this.data.entry.month
      ? this.data.selectedMonth
      : this.data.entry.month;

  error = '';

  readonly categories = [
    'Miete', 'Nebenkosten', 'Gehalt', 'Einkauf', 'Sparen',
    'Bank', 'Versicherung', 'KFZ', 'Freizeit', 'Gesundheit',
    'Garten', 'Bildung', 'Bestellungen', 'Sonstiges',
  ];

  save(): void {
    if (this.amount === null || !Number.isFinite(this.amount) || this.amount <= 0) {
      this.error = 'Bitte gib einen Betrag größer als 0 ein.';
      return;
    }

    if (
      this.data.entry.isRecurring &&
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(this.effectiveMonth)
    ) {
      this.error = 'Bitte wähle einen gültigen Wirksamkeitsmonat aus.';
      return;
    }

    if (
      this.data.entry.isRecurring &&
      this.effectiveMonth < this.data.entry.month
    ) {
      this.error = 'Der Wirksamkeitsmonat darf nicht vor dem Start liegen.';
      return;
    }

    if (!this.category.trim()) {
      this.error = 'Bitte wähle eine Kategorie aus.';
      return;
    }

    this.dialogRef.close({
      type: this.type,
      amount: this.amount,
      description: this.description,
      category: this.category,
      effectiveMonth: this.effectiveMonth,
      recurrenceInterval: this.recurrenceInterval,
    });
  }
}