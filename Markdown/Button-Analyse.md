# 📋 VOLLSTÄNDIGE BUTTON-ANALYSE - GDL-UI-Studio

## PARAMETERVERWALTUNG

### 1️⃣ **XML Export** (linke Sidebar)
- **Icon**: `fa-file-export` ➡️ **SOLLTE ENTFERNT WERDEN**
- **Funktion**: Generiert `Parameters.xml` aus **Datenbank**
- **Ziel**: **Browser-Download** (NICHT in lokale Datei!)
- **API**: `GET /api/local/objects/{id}/parameters/export`
- **Status**: ❌ **ÜBERFLÜSSIG** 
- **Grund**: Verwirrt Nutzer, weil es die lokale Datei NICHT aktualisiert, sondern nur einen Download erzeugt

---

### 2️⃣ **Scripte aktualisieren** (linke Sidebar)
- **Icon**: `fa-sync` ➡️ **BEHALTEN, ABER UMBENENNEN**
- **Funktion**: Generiert **nur GDL-Code** (Parameter-Script, Master-Script) aus DB
- **Ziel**: **Lokale GDL-Dateien** (Merging mit bestehendem Code)
- **API**: `POST /api/local/objects/{id}/update-scripts`
- **Status**: ⚠️ **TEILWEISE ÜBERFLÜSSIG**
- **Vorschlag**: Umbenennen in "GDL-Code neu generieren" und Icon zu `fa-folder-plus`

---

### 3️⃣ **Export to Files** (linke Sidebar)
- **Icon**: `fa-file-export` ➡️ **ÄNDERN ZU `fa-folder-open`**
- **Funktion**: Exportiert **ALLES** (Parameters.xml + alle GDL-Scripts + ui.json)
- **Ziel**: **Lokale Dateien** (vollständiger Sync)
- **API**: `POST /api/local/objects/{id}/export`
- **Status**: ✅ **WICHTIGSTER BUTTON FÜR LOKALEN EXPORT**
- **Vorschlag**: Umbenennen in "📁 Alle Dateien aktualisieren"

---

### 4️⃣ **Auto-Save aktiv** (Header oben)
- **Icon**: `💾` ➡️ **ENTFERNEN**
- **Funktion**: Zeigt nur Alert "Alle Änderungen werden automatisch gespeichert"
- **Ziel**: Nirgendwo
- **Status**: ❌ **ÜBERFLÜSSIG**
- **Vorschlag**: Als **Label** anzeigen, nicht als Button

---

### 5️⃣ **GDL-Skripte generieren** (Header oben)
- **Icon**: Keins ➡️ **HINZUFÜGEN: `fa-file-archive`**
- **Funktion**: Erzeugt ZIP-Download mit allen generierten Scripts + XML
- **Ziel**: **Browser-Download** (.zip-Datei)
- **API**: `GET /api/local/objects/{id}/export-zip`
- **Status**: ⚠️ **FRAGWÜRDIG**
- **Verwendung**: Für Export ohne lokales Projekt? Redundant mit "Export to Files"

---

## UI-DESIGNER

### 6️⃣ **Übernehmen** (linke Sidebar - Konfiguration)
- **Icon**: Keins ➡️ **HINZUFÜGEN: `fa-database`**
- **Funktion**: Übernimmt UI-Konfiguration (Breite, Höhe, Seitenanzahl) und speichert
- **Ziel**: **Datenbank** (gdl_objects.ui_config als JSON)
- **Status**: ✅ **NOTWENDIG**
- **Hinweis**: Ruft automatisch `saveUIDesign()` auf, das in DB speichert

---

## SCRIPT-EDITOR

### 7️⃣ **Speichern** (Header oben)
- **Icon**: `fa-save` ➡️ **ÄNDERN ZU `fa-database`**
- **Funktion**: Speichert **aktuelles** Script (das im Editor sichtbar ist)
- **Ziel**: **Datenbank** (immer) + **Lokale Datei** (wenn `is_local_sync=true`)
- **API**: 
  - GDL: `PUT /api/local/gdl-objects/{id}` (Body: `{script_type: code}`)
  - XML: `POST /api/local/objects/{id}/parameters/import` (Body: `{xml: code}`)
- **Status**: ✅ **WICHTIGSTER BUTTON**
- **Hinweis**: Speichert in BEIDE Ziele bei lokalen Objekten

---

### 8️⃣ **Export to Files** (linke Sidebar)
- **Icon**: `fa-file-export` ➡️ **ÄNDERN ZU `fa-folder-open`**
- **Funktion**: Exportiert **ALLE** Scripts + XML (nicht nur das aktuelle!)
- **Ziel**: **Lokale Dateien**
- **API**: `POST /api/local/objects/{id}/export`
- **Status**: ⚠️ **DOPPELT MIT PARAMETERVERWALTUNG**
- **Vorschlag**: Entweder hier oder in Parameterverwaltung entfernen

---

## 🎯 EMPFEHLUNGEN

### Buttons die **ENTFERNT** werden sollten:
1. ❌ **"XML Export"** (Parameterverwaltung) - Download statt lokale Datei verwirrt
2. ❌ **"Auto-Save aktiv"** - Kein Button nötig, als Label anzeigen
3. ⚠️ **"GDL-Skripte generieren"** - Überflüssig wenn "Export to Files" existiert

### Buttons die **ZUSAMMENGELEGT** werden sollten:
- **"Export to Files"** in Parameterverwaltung UND Script-Editor ➡️ Nur EINEN behalten (global in Header)

### Buttons die **UMBENANNT** werden sollten:
- **"Scripte aktualisieren"** ➡️ "GDL-Code neu generieren"
- **"Export to Files"** ➡️ "📁 Alle Dateien aktualisieren"

### Icon-Legende:
- **💾 / fa-database** = Speichert in **Datenbank**
- **📁 / fa-folder-open** = Speichert in **lokale Dateien**
- **📥 / fa-file-download** = **Browser-Download** (keine Datei)
- **🔄 / fa-sync** = **Generieren/Aktualisieren**

---

## 📊 SPEICHER-MATRIX

| Button | Quelle | Ziel | Icon | Notwendig |
|--------|--------|------|------|-----------|
| **Parameterverwaltung - XML Export** | DB | Browser-Download | 📥 | ❌ Nein |
| **Parameterverwaltung - Scripte aktualisieren** | DB | Lokale Dateien | 🔄 | ⚠️ Teilweise |
| **Parameterverwaltung - Export to Files** | DB | Lokale Dateien | 📁 | ✅ Ja |
| **Parameterverwaltung - Auto-Save** | - | - | - | ❌ Nein |
| **Parameterverwaltung - GDL-Skripte generieren** | DB | Browser-Download (.zip) | 📥 | ⚠️ Fragwürdig |
| **UI-Designer - Übernehmen** | UI | DB | 💾 | ✅ Ja |
| **Script-Editor - Speichern** | Editor | DB + Lokal | 💾 | ✅ Ja |
| **Script-Editor - Export to Files** | DB | Lokale Dateien | 📁 | ⚠️ Doppelt |

---

## ✅ OPTIMIERTE STRUKTUR (Vorschlag)

### **HEADER (Global)**
```
[💾 Auto-Save: aktiv] (Label, kein Button)
[📁 Export to Files] (Exportiert ALLES in lokale Dateien)
[📥 ZIP Download] (Download-Paket für Weitergabe)
```

### **PARAMETERVERWALTUNG - Sidebar**
```
[📥 XML Import]
[🔄 GDL-Code neu generieren] (Nur Scripts, kein XML)
[➕ Parameter hinzufügen]
[🗑️ Ausgewählte löschen]
```

### **UI-DESIGNER - Sidebar**
```
[Breite] [Höhe] [Seiten]
[💾 Übernehmen] (Speichert in DB)
```

### **SCRIPT-EDITOR - Header**
```
[💾 Speichern] (Aktuelles Script in DB)
[🔄 Von Dateien laden] (Reload from local)
```
