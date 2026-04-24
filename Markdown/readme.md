# GDL-UI-Studio

Webbasierte Anwendung zur Verwaltung und zum Design von Benutzeroberflächen für GDL (Geometric Description Language) Objekte in ArchiCAD.

![Version](https://img.shields.io/badge/version-0.9-blue)
![PHP](https://img.shields.io/badge/PHP-%3E%3D7.4-purple)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🎯 Features

- ✅ **Projekt- und Objektverwaltung** - 3-stufige Hierarchie (Projekt → GDL-Objekt → Parameter)
- ✅ **XML Import/Export** - Direkte Integration mit ArchiCAD
- ✅ **Parameterverwaltung** - Vollständige CRUD-Operationen
- ✅ **Mehrsprachigkeit** - DE, EN, FR, ES, IT
- ✅ **Inline-Editing** - Direkte Bearbeitung in der Tabelle
- ✅ **Drag & Drop** - Intuitive Sortierung
- 🔄 **UI Designer** - Visueller Editor (in Planung)

---

## 📁 Projektstruktur

```
gdl-ui-studio/
├── backend/                     # PHP Backend (Slim Framework)
│   ├── config/                 # Konfiguration
│   ├── public/index.php        # API Entry Point
│   ├── src/Controllers/        # REST Controller
│   └── .env                    # DB Credentials
├── database/
│   ├── install.sql             # ⚠️ VERALTET
│   └── install_UPDATED.sql     # ✅ AKTUELL
├── public/
│   ├── index.html              # UI Designer (Mockup)
│   ├── param-management.html   # Parameterverwaltung
│   └── style.css               # Nord Theme
└── ai/                         # KI-Entwicklungshistorie
```

---

## 🗄️ Datenbank-Schema

### Hierarchie:
```
Project (Bürogebäude_2024)
  └─ GDL Object (Fenster_Standard.gsm)
      └─ Parameter (A, B, iWindowType)
          └─ Translations (DE, EN, FR, ES, IT)
```

### Tabellen:
1. `projects` - Hauptprojekte
2. `gdl_objects` - GDL-Objekte pro Projekt **(NEU!)**
3. `parameters` - Parameter pro Objekt (verwendet `gdl_object_id`)
4. `parameter_translations` - Mehrsprachige Übersetzungen

---

## 🚀 Installation

### Voraussetzungen:
- PHP >= 7.4
- MySQL/MariaDB >= 5.7
- Composer
- Webserver (MAMP/XAMPP)

### Setup-Schritte:

1. **Backend Dependencies installieren:**
   ```bash
   cd backend
   composer install
   ```

2. **Datenbank konfigurieren:**
   
   Datei `backend/.env` bearbeiten:
   ```env
   DB_HOST=localhost
   DB_NAME=gdl_ui_studio_db
   DB_USER=root
   DB_PASSWORD=root
   ```

3. **Datenbank erstellen:**
   ```bash
   mysql -u root -p < database/install_UPDATED.sql
   ```
   
   ⚠️ **WICHTIG:** Verwende `install_UPDATED.sql`, nicht `install.sql`!

4. **Anwendung öffnen:**
   ```
   http://localhost:8888/gdl-ui-studio/public/param-management.html
   ```

---

## 📖 Verwendung

### Workflow:

1. **Projekt erstellen**
   - Klicke "+ Button" neben Projekt-Dropdown
   - Name eingeben: z.B. "Bürogebäude_2024"

2. **GDL-Objekt erstellen**
   - Klicke "+ Button" neben Objekt-Dropdown
   - Name eingeben: z.B. "Fenster_Standard.gsm"

3. **XML Import**
   - "XML Parameter Import" Button klicken
   - XML-Datei auswählen (aus ArchiCAD exportiert)
   - Parameter werden automatisch importiert

4. **Parameter bearbeiten**
   - **Tabelle:** Direkt in Zellen klicken
   - **Rechtes Panel:** Detaillierte Bearbeitung
   - **Mehrsprachigkeit:** Tabs verwenden (DE, EN, FR, ES, IT)
   - **Sortieren:** Drag & Drop in der Tabelle

5. **XML Export**
   - "Parameter Export (XML)" Button
   - XML-Datei wird heruntergeladen
   - Zurück in ArchiCAD importieren

---

## 🔌 API Endpoints

### Base URL:
```
http://localhost:8888/gdl-ui-studio/backend/public/api
```

### Projects:
- `GET /api/projects` - Alle Projekte abrufen
- `POST /api/projects` - Projekt erstellen `{"name": "..."}`
- `PUT /api/projects/{id}` - Projekt aktualisieren
- `DELETE /api/projects/{id}` - Projekt löschen

### GDL Objects:
- `GET /api/projects/{projectId}/objects` - Objekte eines Projekts
- `POST /api/objects` - Objekt erstellen `{"project_id": 1, "name": "..."}`
- `PUT /api/objects/{id}` - Objekt aktualisieren
- `DELETE /api/objects/{id}` - Objekt löschen

### Parameters:
- `POST /api/parameters/import` - XML Import
- `GET /api/objects/{objectId}/parameters` - Parameter abrufen
- `POST /api/parameters/create` - Parameter erstellen
- `PUT /api/parameters/{id}` - Parameter aktualisieren
- `DELETE /api/parameters/{id}` - Parameter löschen
- `POST /api/parameters/bulk-delete` - Mehrere löschen
- `POST /api/parameters/reorder` - Sortierung ändern
- `GET /api/objects/{objectId}/parameters/export` - XML Export

---

## 🎨 Tech Stack

### Backend:
- PHP 7.4+ mit Slim Framework 4.0
- PHP-DI 6.0 (Dependency Injection)
- MySQL/MariaDB

### Frontend:
- HTML5/CSS3 (Nord Theme)
- Vanilla JavaScript (ES6+)
- Font Awesome 6.0
- Fetch API

---

## 🐛 Bekannte Probleme

### ⚠️ KRITISCH:
- **`database/install.sql` ist veraltet!** 
  → Fehlt `gdl_objects` Tabelle
  → Verwende stattdessen `install_UPDATED.sql`

### 🔄 In Arbeit:
- UI Designer ist nur Mockup (nicht funktional)
- CSV Import noch nicht implementiert
- Dictionary/Array Export unvollständig
- Vue.js Frontend (frontend-src/) ist leer

---

## 📚 Weitere Dokumentation

Detaillierte Dokumentation:
- **Vollständige Übersicht:** `~/GDL_UI_Studio_Projekt_Uebersicht.md`
- **GDL-Referenz:** [ArchiCAD GDL Documentation](https://gdl.graphisoft.com/)
- **Slim Framework:** [Slim 4 Docs](https://www.slimframework.com/docs/v4/)

---

## 🔧 Development

### Backend Dev-Server starten:
```bash
cd backend
php -S 0.0.0.0:8080 -t public
```

### Datenbank-Backup:
```bash
mysqldump -u root -p gdl_ui_studio_db > backup_$(date +%Y%m%d).sql
```

### Logs anzeigen:
```bash
tail -f storage/logs/app.log
```

---

## 📝 Changelog

### Version 0.9 (Dezember 2024) - Aktuell
- ✅ 3-stufige Hierarchie implementiert
- ✅ Vollständige REST API
- ✅ XML Import/Export funktionsfähig
- ✅ Inline-Editing & Drag & Drop
- ✅ Mehrsprachigkeit (5 Sprachen)
- ✅ Auto-Save mit 500ms Debouncing
- ✅ Datenbank-Schema korrigiert

### Geplant v1.0:
- 🔄 UI Designer vollständig funktional
- 🔄 CSV Import implementieren
- 🔄 Benutzer-Authentifizierung
- 🔄 Vue.js Frontend Migration

---

## 👤 Autor

**Jochen Sühlo**  
E-Mail: 25@b-prisma.de  
Lizenz: MIT

---

## 📄 Lizenz

MIT License - siehe LICENSE Datei für Details.

---

**Viel Erfolg mit GDL-UI-Studio! 🚀**
