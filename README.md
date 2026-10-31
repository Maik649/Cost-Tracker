# Cost Tracker

Kleine Angular-Web-App zum Erfassen und Auswerten von monatlichen Einnahmen und Ausgaben. Alle Daten bleiben lokal im Browser (IndexedDB), es gibt kein Backend.

## Funktionen

- **Einträge hinzufügen:** Einnahmen und Ausgaben mit Betrag, Beschreibung und Kategorie, einmalig oder monatlich, vierteljährlich beziehungsweise jährlich wiederkehrend.
- **Monatsauswahl:** Jahr wählen und über ein Raster aus Monats-Buttons zum gewünschten Monat springen.
- **Monatsdetails:** Einnahmen, Ausgaben und Saldo des Monats sowie alle Einträge als responsives Karten-Grid (mobil optimiert).
- **Suche:** Filtert die Einträge nach Beschreibung oder Kategorie und zeigt die Gesamtsumme der Treffer, z. B. wie viel du im Monat für „Tabak“ ausgegeben hast.
- **Bearbeiten und Löschen:** Einträge bearbeiten, Wiederholungsintervalle ändern und Beträge ab einem ausgewählten Monat anpassen.
- **Wiederholungen pausieren:** Wiederkehrende Einträge pausieren und später wieder aktivieren.
- **Datensicherung:** Ein ausgewähltes JSON-Backup kann nach jeder Änderung automatisch überschrieben werden. Manueller Export und Import bleiben verfügbar.

## Seiten

| Route | Beschreibung |
| --- | --- |
| `/` | Login |
| `/dashboard` | Startseite mit Navigation |
| `/add-kosten` | Neuen Eintrag anlegen |
| `/doc-view` | Monatsübersicht, Suche, Bearbeiten |
| `/settings` | Einstellungen und Backup/Import |

## Technik

- Angular 22 (Standalone Components, Signals) und Angular Material
- Speicherung der Einträge in IndexedDB; vorhandene Daten aus `localStorage` werden beim ersten Laden migriert
- Datenmodell und Backup-Logik in `src/app/models/cost-entry.ts`, IndexedDB-Zugriff in `src/app/services/cost-entry-store.service.ts`

## Erste Schritte

Voraussetzung: [Node.js](https://nodejs.org/) und npm.

```bash
npm install
npm start
```

Die App läuft dann unter `http://localhost:4200/`.

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm start` | Entwicklungsserver starten |
| `npm run build` | Produktions-Build nach `dist/` |
| `npm test` | Unit-Tests mit Vitest |

## Backup und Import

### Automatisches Backup

Unter *Settings* kannst du „Backup-Datei auswählen“ anklicken und eine vorhandene JSON-Datei festlegen. Diese Datei wird sofort und anschließend nach jeder erfolgreich gespeicherten Änderung mit dem aktuellen Datenstand überschrieben. Der Browser muss den Schreibzugriff erlauben; nach einem Neustart kann eine erneute Freigabe nötig sein. Über „Automatisches Backup ausschalten“ wird nur die Verknüpfung entfernt, nicht die Datei gelöscht.

Der automatische Dateizugriff benötigt einen kompatiblen Browser mit File System Access API (zum Beispiel aktuelle Chromium-Browser) und einen sicheren Kontext. In anderen Browsern bleiben Export und Import nutzbar.

### Manueller Export und Import

1. **Export:** *Settings* → „Backup exportieren“ lädt `cost-tracker-backup-JJJJ-MM-TT.json` herunter.
2. **Import:** *Settings* → „Backup importieren“ und die JSON-Datei auswählen. Die Datei wird geprüft, danach werden die aktuellen Einträge nach Bestätigung **ersetzt**.

Da die Einträge nur im Browser liegen, gehen sie beim Löschen der Browserdaten verloren. Das automatische Backup schützt davor, solange der Browser weiterhin Zugriff auf die ausgewählte Datei hat. Export und Import stehen weiterhin als manuelle Alternative bereit.

## Hinweis

Der Login ist nur eine einfache Eingabeprüfung im Frontend und keine echte Absicherung der Daten.
