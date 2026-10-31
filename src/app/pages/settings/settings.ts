import { Component, inject, OnInit, signal } from '@angular/core';
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

export class Settings implements OnInit {
  private readonly costEntryStore = inject(CostEntryStore);
  readonly backupStore = this.costEntryStore;
  backupMessage = signal('');
  backupIsError = signal(false);

  ngOnInit(): void {
    void this.costEntryStore.loadAutomaticBackupSettings();
  }

  async selectAutomaticBackupFile(): Promise<void> {
    try {
      await this.costEntryStore.selectAutomaticBackupFile();
      this.showMessage('Backup-Datei ausgewählt und automatisch aktualisiert.', false);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      this.showMessage(errorMessage(error), true);
    }
  }

  async updateAutomaticBackupNow(): Promise<void> {
    try {
      await this.costEntryStore.updateAutomaticBackupNow();
      this.showMessage('Backup-Datei wurde aktualisiert.', false);
    } catch (error) {
      this.showMessage(errorMessage(error), true);
    }
  }

  async disableAutomaticBackup(): Promise<void> {
    if (!window.confirm('Automatisches Backup ausschalten? Die Backup-Datei bleibt erhalten.')) {
      return;
    }

    try {
      await this.costEntryStore.disableAutomaticBackup();
      this.showMessage('Automatisches Backup wurde ausgeschaltet.', false);
    } catch (error) {
      this.showMessage(errorMessage(error), true);
    }
  }

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
