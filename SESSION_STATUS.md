# Projektstand — GDL Workbench
Zuletzt aktualisiert: 2026-06-20

## Was wurde gemacht

### GitHub Repository
- Neues öffentliches Repo angelegt: https://github.com/gdl-joe/gdl-workbench
- `backend/settings.json` zu `.gitignore` hinzugefügt

### README neu geschrieben
- Vollständig aktualisiert auf v1.6.0

### Workspace-Verzeichnis im Dashboard (neues Feature)
- Neues Panel ganz oben in der Projektverwaltung: zeigt aktuellen Workspace-Pfad
- „Ändern"-Button → Inline-Eingabe → Speichern → Projektliste lädt automatisch neu
- Backend: `SettingsController.php` + Routes `GET/POST /api/local/settings`
- Pfad wird in `backend/settings.json` gespeichert (gitignored), hat Vorrang vor `.env`

## Aktueller Stand
- Alle 7 Seiten funktionieren: Projektverwaltung, Objektverwaltung, Parameterverwaltung, UI Designer, Script Editor, Codeschmiede, Build Tasks
- GitHub aktuell (öffentlich, keine sensiblen Daten): https://github.com/gdl-joe/gdl-workbench

## Nächste Schritte
- (offen)

## Offene Probleme / Blockaden
- Keine
