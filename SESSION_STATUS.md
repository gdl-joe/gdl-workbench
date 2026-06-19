# Projektstand — GDL Workbench
Zuletzt aktualisiert: 2026-06-20

## Was wurde gemacht

### GitHub Repository
- Neues öffentliches Repo angelegt: https://github.com/gdl-joe/gdl-workbench
- `.env` aus der gesamten Git-History entfernt (`git filter-repo`)
- `DB_PASSWORD=root` in Markdown-Doku durch Platzhalter ersetzt
- `backend/settings.json` zu `.gitignore` hinzugefügt

### Bugfixes
- **Projektverwaltung leer:** MySQL-Port 3307 fehlte im DSN → `port=` in config.php ergänzt
- **DB-Name falsch:** `.env` hatte `DB_NAME=gdl-workbench` statt `gdl_ui_studio_db` → korrigiert
- **KI-Chat-Insert:** AI-Button setzte `generatedCode` nicht → "In Editor einfügen" funktioniert jetzt
- **KI-Chat verschwindet bei Tab-Wechsel:** `aiHistory` wird jetzt in `localStorage` persistiert

### KI-Funktionalität entfernt
- `AiController.php` gelöscht
- AI-Routes aus `routes.php` entfernt
- KI-Assistent-Panel aus `codeschmiede.html` entfernt (CSS + HTML + JS)
- Grid-Layout Codeschmiede: 3 → 2 Spalten

### README neu geschrieben
- Vollständig aktualisiert auf v1.6.0
- Kein „GDL-Studio" oder „GDL-UI-Studio" mehr — überall „GDL Workbench"
- Alle aktuellen Features dokumentiert (Codeschmiede, Script Editor, UI Designer, Build Tasks, Mehrsprachigkeit)
- API-Tabelle, Projektstruktur, korrekter Workflow

### Workspace-Verzeichnis im Dashboard (neues Feature)
- Neues Panel ganz oben in der Projektverwaltung: zeigt aktuellen Workspace-Pfad
- „Ändern"-Button → Inline-Eingabe → Speichern → Projektliste lädt automatisch neu
- Backend: `SettingsController.php` + Routes `GET/POST /api/local/settings`
- Pfad wird in `backend/settings.json` gespeichert (gitignored), hat Vorrang vor `.env`

## Aktueller Stand
- Alle 7 Seiten funktionieren: Projektverwaltung, Objektverwaltung, Parameterverwaltung, UI Designer, Script Editor, Codeschmiede, Build Tasks
- GitHub aktuell (öffentlich, keine sensiblen Daten): https://github.com/gdl-joe/gdl-workbench
- Lokale `.env`: `DB_NAME=gdl_ui_studio_db`, `DB_PORT=3307`, `LOCAL_WORKSPACE_ROOT=/Users/Jochen/Documents/1_GDL_DEVELOP`

## Nächste Schritte
- (offen)

## Offene Probleme / Blockaden
- Keine
