import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { describe, expect, it, vi } from 'vitest';
import { CostEntry } from '../../models/cost-entry';
import { EditEntryDialog, EditEntryDialogData } from './edit-entry-dialog';

describe('EditEntryDialog recurrence interval', () => {
  function createDialog(entry: CostEntry) {
    const close = vi.fn();
    const data: EditEntryDialogData = { entry, selectedMonth: '2026-10' };
    TestBed.configureTestingModule({
      imports: [EditEntryDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });

    return {
      dialog: TestBed.createComponent(EditEntryDialog).componentInstance,
      close,
    };
  }

  it('initializes with and saves a changed recurrence interval', () => {
    const entry: CostEntry = {
      id: 'insurance',
      type: 'expense',
      amount: 120,
      description: 'Versicherung',
      category: 'Versicherung',
      month: '2026-01',
      isRecurring: true,
      recurrenceInterval: 'yearly',
      isActive: true,
      endedAtMonth: null,
    };
    const { dialog, close } = createDialog(entry);

    expect(dialog.recurrenceInterval).toBe('yearly');
    dialog.recurrenceInterval = 'quarterly';
    dialog.save();

    expect(close).toHaveBeenCalledWith(expect.objectContaining({
      recurrenceInterval: 'quarterly',
    }));
  });
});
