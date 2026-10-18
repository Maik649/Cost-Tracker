import { Component, inject, signal } from '@angular/core';
import { ButtonComponents } from '../../components/button-components/button-components';
import { SubHeader } from '../../components/sub-header/sub-header';
import { createBackupJson, parseBackupJson } from '../../models/cost-entry';
import { CostEntryStore } from '../../services/cost-entry-store.service';

@Component({
  selector: 'app-settings',
  imports: [ButtonComponents, SubHeader],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})

export class Settings {
  private readonly costEntryStore = inject(CostEntryStore);
  backupMessage = signal('');
  backupIsError = signal(false);

  async exportBackup(): Promise<void> {
    try {
      const entries = await this.costEntryStore.loadCostEntries();
      const blob = new Blob([createBackupJson(entries)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cost-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      this.showMessage(`${entries.length} Einträge exportiert.`, false);
    } catch (error) {
      this.showMessage(`Backup konnte nicht aus IndexedDB geladen werden: ${errorMessage(error)}`, true);
    }
  }

  async importBackup(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    try {
      const entries = parseBackupJson(await file.text());
      if (!window.confirm(`${entries.length} Einträge importieren? Alle aktuellen Einträge werden ersetzt.`)) {
        return;
      }
      await this.costEntryStore.saveCostEntries(entries);
      this.showMessage(`${entries.length} Einträge importiert.`, false);
    } catch (error) {
      this.showMessage(errorMessage(error), true);
    }
  }

  private showMessage(message: string, isError: boolean): void {
    this.backupMessage.set(message);
    this.backupIsError.set(isError);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unbekannter Fehler.';
}
