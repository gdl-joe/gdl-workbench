# GDL Workbench

Webbasierte Entwicklungsumgebung für GDL (Geometric Description Language) Objekte in ArchiCAD.

![Version](https://img.shields.io/badge/version-1.6.0-blue)
![PHP](https://img.shields.io/badge/PHP-%3E%3D8.0-purple)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

### Projektverwaltung
- Liest lokale GDL-Projekte direkt aus dem Dateisystem (`.project`-Ordner)
- Status-Verwaltung: Aktiv / In Arbeit / Dringend / Archiv
- Suche, Sortierung und Filterung
- Workspace-Verzeichnis direkt in der App konfigurierbar

### Objektverwaltung
- Alle GDL-Objekte eines Projekts auf einen Blick
- Import und Export von GDL-Objekten (`.gsm`)
- Synchronisation mit lokalen Dateien

### Parameterverwaltung
- Import aus ArchiCAD XML-Export
- Vollständige CRUD-Operationen (Erstellen, Bearbeiten, Löschen)
- Drag & Drop Sortierung
- Inline-Editing direkt in der Tabelle
- Mehrsprachige Beschriftungen (DE, EN, FR, ES)
- Farbcodierung nach Parametertypen
- Array-Parameter-Editor

### Skript Editor
- Monaco Editor (VS Code Engine) für alle 6 GDL-Skripttypen:  
  Master, 2D, 3D, UI, Parameter, Properties
- GDL-spezifisches Syntax Highlighting
- Direkte Bearbeitung der `Parameters.xml`
- Export der Skripte in lokale Dateien

### UI Designer
- Visueller Editor für GDL-Benutzeroberflächen
- Echtzeit-Vorschau
- Template-Bibliothek (b-prisma Standard, Graphisoft Standard Navigation)

### Codeschmiede
- Interaktiver GDL-Code-Generator aus Eingabemasken
- Drei Modi: Manuell / Aus Parametern / → Parameter
- Befehlsbaum mit Live-Suche (alle 2D/3D GDL-Befehle)
- Snippet-Speicherung in der Datenbank
- Code direkt in den Skript Editor übertragen

### Build Tasks
- Automatisierbare Build-Prozesse für GDL-Objekte

### Mehrsprachigkeit
- Interface in Deutsch, Englisch, Französisch und Spanisch

---

## Tech Stack

**Backend:** PHP 8+ · Slim Framework 4 · PHP-DI · MySQL/MariaDB  
**Frontend:** Vanilla JS (ES6+) · Monaco Editor · Font Awesome 6  
**Lokalbetrieb:** Laravel Herd / Valet / MAMP

---

## Installation

### Voraussetzungen
- PHP >= 8.0
- MySQL/MariaDB
- Composer
- Laravel Herd, Valet oder MAMP

### Setup

1. **Backend-Dependencies installieren:**
   ```bash
   cd backend
   composer install
   ```

2. **Konfiguration anlegen:**
   ```bash
   cp backend/.env.example backend/.env
   ```
   `backend/.env` bearbeiten:
   ```env
   DB_HOST=127.0.0.1
   DB_PORT=3306        # Herd: typischerweise 3307
   DB_NAME=gdl_ui_studio_db
   DB_USER=root
   DB_PASSWORD=dein_passwort

   # Verzeichnis mit deinen *.project-Ordnern
   LOCAL_WORKSPACE_ROOT=/pfad/zu/deinen/GDL-Projekten
   ```
   > Das Workspace-Verzeichnis kann alternativ direkt in der App unter **Projektverwaltung** eingestellt werden.

3. **Datenbank erstellen:**
   ```bash
   mysql -h 127.0.0.1 -P 3306 -u root -p < database/install.sql
   ```

4. **Server starten:**
   - **Herd/Valet:** Projekt verlinken → `https://gdl-workbench.test/dashboard.html`
   - **PHP Dev-Server:** `cd backend && php -S localhost:8080 -t public`

---

## Projektstruktur

```
gdl-workbench/
├── backend/
│   ├── config/             # Slim-Konfiguration, DI-Container
│   ├── public/index.php    # API Entry Point
│   ├── src/
│   │   ├── Controllers/    # REST Controller
│   │   ├── Services/       # Business Logic
│   │   └── Helpers/
│   └── .env                # Lokale Konfiguration (nicht im Repo)
├── database/
│   └── install.sql         # Vollständiges Datenbankschema
├── knowledge/              # GDL-Referenz für die Codeschmiede
└── public/
    ├── dashboard.html      # Projektverwaltung
    ├── object-selection.html
    ├── param-management.html
    ├── script-editor.html
    ├── index.html          # UI Designer
    ├── codeschmiede.html
    └── build-tasks.html
```

---

## Workflow

1. **Projektverwaltung** öffnen → Workspace-Verzeichnis einmalig einstellen
2. GDL-Projekte werden automatisch aus dem Dateisystem gelesen
3. Objekt auswählen → Parameter aus `Parameters.xml` importieren
4. Parameter bearbeiten, Skripte anpassen
5. Skripte exportieren → zurück in ArchiCAD

---

## API (Auszug)

Basis-URL: `../backend/public/api/local`

| Methode | Endpunkt | Beschreibung |
|---------|----------|--------------|
| GET | `/projects` | Alle lokalen Projekte |
| GET | `/objects` | Objekte eines Projekts |
| GET | `/objects/{id}/parameters` | Parameter eines Objekts |
| POST | `/parameters/import` | XML-Import |
| GET | `/objects/{id}/parameters/export` | XML-Export |
| POST | `/objects/{id}/update-scripts` | Skripte in Dateien schreiben |
| GET | `/snippets` | Codeschmiede-Snippets |
| GET | `/settings` | Workspace-Einstellungen lesen |
| POST | `/settings` | Workspace-Einstellungen speichern |

---

## Autor

**Jochen Sühlo** · b-prisma · [b-prisma.de](https://b-prisma.de)  
Lizenz: MIT
