# Bugfix: Korrekter Datenfluss - Datenbank statt lokale Dateien

## Problem

Der **LocalController** las Scripts aus den **lokalen Dateien** statt aus der **Datenbank**, obwohl der korrekte Workflow sein sollte:

```
1. Import: Dateien → Datenbank
2. Arbeit: Datenbank (Script-Editor lesen/schreiben)
3. Export: Datenbank → Dateien (Button "Export to Files")
```

## Falscher Datenfluss (vorher)

```php
// LocalController::getObject()
$data = $this->fileService->getObjectDetails($objectPath);  // ❌ Liest aus Dateien!
```

**Symptom:**
- Änderungen im Script-Editor gehen verloren nach Refresh
- Gelöschter Content kommt zurück
- Datenbank und Dateien sind nicht synchron

## Korrekter Datenfluss (jetzt)

### 1. **Import beim ersten Laden**
```php
// Wenn Objekt nicht in DB:
$objectId = $this->importService->importObjectFromFiles($objectPath);
```

Das passiert durch `LocalImportService::importObjectFromFiles()`:
- Liest `Parameters.xml` → Import in DB
- Liest alle Script-Dateien (`1-Master-Script.gdl`, `2-Parameter-Script.gdl`, etc.) → Import in DB
- Liest `ui.json` → Import der UI-Config

### 2. **Arbeit mit Datenbank**
```php
// LocalController::getObject() - NEU
$stmt = $this->db->prepare("SELECT * FROM gdl_objects WHERE local_file_path = ? OR id = ?");
$stmt->execute([$objectPath, $id]);
$dbObject = $stmt->fetch(PDO::FETCH_ASSOC);

// Return scripts from DATABASE
$data = [
    'script_master' => $dbObject['script_master'] ?? '',
    'script_2d' => $dbObject['script_2d'] ?? '',
    'script_3d' => $dbObject['script_3d'] ?? '',
    // ...
];
```

**Script-Editor Workflow:**
1. **Laden:** Liest aus DB
2. **Bearbeiten:** Im Editor
3. **Speichern:** Schreibt in DB (via `updateObject`)
4. **Refresh:** Liest aus DB → Änderungen bleiben erhalten! ✅

### 3. **Export zu Dateien**
```php
// Button: "Export to Files"
// LocalExportService::exportObjectToFiles()
// Schreibt DB → lokale Dateien
```

## Änderungen

### `LocalController::getObject()` - Komplett überarbeitet

**ALT:**
```php
$data = $this->fileService->getObjectDetails($objectPath);  // Aus Dateien
```

**NEU:**
```php
// 1. Versuche aus DB zu laden
$stmt = $this->db->prepare("SELECT * FROM gdl_objects WHERE local_file_path = ? OR id = ?");
$stmt->execute([$objectPath, $id]);
$dbObject = $stmt->fetch(PDO::FETCH_ASSOC);

// 2. Wenn nicht in DB: Import zuerst
if (!$dbObject) {
    $objectId = $this->importService->importObjectFromFiles($objectPath);
    // Dann aus DB laden
}

// 3. Return Daten aus DB
return [
    'script_master' => $dbObject['script_master'],
    'script_2d' => $dbObject['script_2d'],
    // ...
];
```

### Auto-Import beim ersten Laden

Wenn ein Objekt zum ersten Mal geladen wird:
1. ✅ Prüfe ob in DB vorhanden
2. ✅ Wenn NICHT: Automatischer Import aus Dateien
3. ✅ Dann arbeite mit DB
4. ✅ Logging für Transparenz

## Vorteile

### ✅ Konsistenter Datenfluss
```
Dateien --[Import]→ Datenbank --[Arbeit]→ Datenbank --[Export]→ Dateien
```

### ✅ Script-Editor funktioniert korrekt
- **Laden:** Aus DB (konsistent)
- **Speichern:** In DB (mit Merge-Logik)
- **Refresh:** Aus DB (Änderungen bleiben!)
- **Löschen:** In DB (bleibt gelöscht!)

### ✅ Keine verlorenen Änderungen
- Scripts werden in DB persistent gespeichert
- Nicht mehr von lokalen Dateien überschrieben
- Export nur auf expliziten Button-Klick

### ✅ Auto-Import
- Objekte werden automatisch importiert wenn nicht in DB
- Fallback auf Dateien wenn Import fehlschlägt
- Transparent durch Logging

## Debug-Logging

```
LocalController::getObject: Object not in DB, attempting import from: /path/to/object
LocalController::getObject: Object imported successfully with ID: 123
```

oder

```
LocalController::getObject: Returning data from database (source: database)
```

## Test-Szenarien

### Szenario 1: Neu geladenes Objekt
```
1. Objekt in Object-Selection auswählen
2. Zu Script-Editor wechseln
   → Auto-Import läuft
   → Scripts aus DB geladen
3. Script bearbeiten & speichern
   → In DB gespeichert
4. Browser-Refresh
   → Aus DB geladen
   → Änderungen sind da! ✅
```

### Szenario 2: Bereits importiertes Objekt
```
1. Script-Editor öffnen
   → Direkt aus DB laden (kein Import nötig)
2. Ändern & Speichern
   → In DB
3. Refresh
   → Aus DB
   → Alles konsistent ✅
```

### Szenario 3: Export zu Dateien
```
1. Im Script-Editor arbeiten
   → Alle Änderungen in DB
2. Button "Export to Files" klicken
   → DB wird in lokale Dateien geschrieben
3. Dateien sind jetzt synchron ✅
```

## Betroffene Komponenten

### ✅ LocalController::getObject()
- Liest aus DB statt aus Dateien
- Auto-Import beim ersten Laden
- Fallback auf Dateien bei Fehlern

### ✅ LocalController::updateObject()
- Schreibt in DB (mit Merge-Logik)
- Separate Behandlung für Script-Editor vs UI Designer

### ✅ LocalExportService
- Exportiert DB → Dateien
- Wird von "Export to Files" Button aufgerufen

### ✅ LocalImportService
- Importiert Dateien → DB
- Wird automatisch beim ersten Laden aufgerufen
- Kann auch manuell für Refresh genutzt werden

## Migration

**Keine manuelle Aktion erforderlich!**

- Objekte werden automatisch beim ersten Laden importiert
- Bestehende DB-Einträge bleiben unverändert
- Keine Datenverluste

## Zusammenhang mit anderen Fixes

Dieser Fix **vervollständigt** die vorherigen Fixes:

1. **BUGFIX_DUPLICATE_SCRIPTS.md** - Verhindert Duplikate beim Mergen
2. **BUGFIX_SCRIPT_EDITOR_DELETION.md** - Direktes Speichern im Script-Editor
3. **BUGFIX_CORRECT_DATAFLOW.md** (DIESER) - Korrekter DB-basierter Workflow

Alle drei Fixes arbeiten zusammen für einen **stabilen, konsistenten Workflow**.

## Datum

**Implementiert:** 2026-02-08  
**Status:** ✅ Vollständig getestet  
**Abhängigkeiten:** BUGFIX_DUPLICATE_SCRIPTS.md, BUGFIX_SCRIPT_EDITOR_DELETION.md
