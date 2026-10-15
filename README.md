# Cost Tracker

Kleine Angular-Web-App zum Erfassen und Auswerten von monatlichen Einnahmen und Ausgaben. Alle Daten bleiben lokal im Browser (`localStorage`), es gibt kein Backend.

## Funktionen

- **Einträge hinzufügen:** Einnahmen und Ausgaben mit Betrag, Beschreibung und Kategorie, einmalig oder monatlich wiederkehrend.
- **Monatsauswahl:** Jahr wählen und über ein Raster aus Monats-Buttons zum gewünschten Monat springen.
- **Monatsdetails:** Einnahmen, Ausgaben und Saldo des Monats sowie alle Einträge als responsives Karten-Grid (mobil optimiert).
- **Suche:** Filtert die Einträge nach Beschreibung oder Kategorie und zeigt die Gesamtsumme der Treffer, z. B. wie viel du im Monat für „Tabak“ ausgegeben hast.
- **Bearbeiten und Löschen:** Beträge ändern (bei Wiederholungen mit Gültigkeit ab einem Monat), Einträge löschen.
- **Wiederholungen pausieren:** Monatliche Einträge pausieren und später wieder aktivieren.
- **Datensicherung:** Unter *Settings* lassen sich alle Einträge als JSON-Datei exportieren und wieder importieren, etwa nach einer Neuinstallation des Browsers.

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
- Speicherung im `localStorage` unter dem Schlüssel `lastCost`
- Datenmodell und Backup-Logik in `src/app/models/cost-entry.ts`

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

1. **Export:** *Settings* → „Backup exportieren“ lädt `timetracker-backup-JJJJ-MM-TT.json` herunter.
2. **Import:** *Settings* → „Backup importieren“ und die JSON-Datei auswählen. Die Datei wird geprüft, danach werden die aktuellen Einträge nach Bestätigung **ersetzt**.

Da die Daten nur im Browser liegen, gehen sie beim Löschen der Browserdaten verloren. Erstelle deshalb regelmäßig ein Backup.

## Hinweis

Der Login ist nur eine einfache Eingabeprüfung im Frontend und keine echte Absicherung der Daten.
