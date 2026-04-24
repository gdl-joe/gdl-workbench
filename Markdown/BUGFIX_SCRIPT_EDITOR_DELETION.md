# Bugfix: Gelöschter Content im Script-Editor kommt nach Refresh zurück

## Problem

**Symptom:** Wenn Sie im Script-Editor (z.B. 2D-Script) Inhalt löschen und speichern, ist nach einem Browser-Refresh der gelöschte Inhalt wieder da.

## Ursache

Das Problem hatte mehrere zusammenhängende Ursachen:

### 1. **Merge-Logik war zu aggressiv**
Die neue Merge-Logik aus dem Duplikat-Fix war für **Auto-Generated-Blöcke** (vom UI Designer) gedacht, wurde aber auch beim **Script-Editor** angewendet:

```php
// GdlScriptService::mergeContent()
if (empty(trim($newContent))) {
    return $existingContent;  // <-- Gibt alten Content zurück!
}
```

**Problem:** Wenn Sie im Script-Editor alles löschen, gibt `mergeContent()` einfach den alten Content zurück, weil leerer Content als "nichts zu mergen" interpretiert wird.

### 2. **Keine Unterscheidung zwischen Script-Editor und UI Designer**
Beide Speicher-Pfade nutzten die gleiche Merge-Logik:
- **UI Designer:** Generiert nur spezifische Auto-Generated-Blöcke → Merge notwendig
- **Script-Editor:** Bearbeitet das komplette Script → Direktes Überschreiben notwendig

### 3. **Laden aus lokalen Dateien**
Der Script-Editor lädt Scripts aus den **lokalen Dateien** (nicht aus der DB):
```php
// LocalFileService::getObjectDetails()
$scriptData[$key] = file_get_contents($filePath);
```

**Ablauf des Problems:**
1. Sie löschen Content im Script-Editor
2. Beim Speichern wird gemerged (leerer Content = alter Content bleibt)
3. Alter Content wird in die Datei geschrieben
4. Beim Refresh wird aus der Datei gelesen → Alter Content ist wieder da

## Lösung

### **Intelligente Erkennung des Speicher-Kontexts**

Beide Controller (`GdlObjectController` und `LocalController`) erkennen nun automatisch, ob es sich um:
- **Script-Editor** (Full Script Update) → Direktes Überschreiben
- **UI Designer** (Partial Update) → Merge mit Auto-Generated-Blöcken

**Erkennungslogik:**

```php
// Wenn NUR EIN Script-Feld aktualisiert wird UND kein ui_config dabei ist
$updatedScriptCount = 0;
foreach ($scriptFields as $field) {
    if (isset($data[$field])) $updatedScriptCount++;
}

$isFullScriptUpdate = ($updatedScriptCount === 1 && !isset($data['ui_config']));
```

### **Getrennte Behandlung**

#### Script-Editor (Full Script Update):
```php
if ($isFullScriptUpdate) {
    // Direktes Speichern ohne Merge
    error_log("Full script update detected - skipping merge");
    $this->fileService->saveObjectDetails($objectPath, $data);
    
    // DB Sync: Direkte Aktualisierung
    $sql .= ", $scriptField = ?";
    $params[] = $val;  // Direkt ohne Merge
}
```

#### UI Designer (Partial Update):
```php
else {
    // Merge auto-generated blocks
    error_log("Partial update detected - using merge logic");
    
    $mergedContent = $scriptService->mergeContent(
        $existingContent,
        $newContent,
        $markers['header'],
        $markers['footer']
    );
    
    // DB Sync: Mit Merge
    $params[] = $mergedContent;
}
```

## Geänderte Dateien

1. ✅ `backend/src/Controllers/LocalController.php`
   - Kontext-Erkennung implementiert
   - Getrennte Pfade für Script-Editor vs UI Designer
   - DB-Sync entsprechend angepasst

2. ✅ `backend/src/Controllers/GdlObjectController.php`
   - Gleiche Kontext-Erkennung
   - Getrennte Script-Behandlung

## Verhalten nach Fix

### Script-Editor:
```
✅ Löschen von Content → Wird gespeichert → Bleibt gelöscht
✅ Ändern von Content → Wird gespeichert → Bleibt geändert
✅ Mehrfaches Speichern → Keine Duplikate, keine verlorenen Änderungen
```

### UI Designer:
```
✅ Auto-Generated-Blöcke werden korrekt gemerged
✅ Benutzer-Code außerhalb der Blöcke bleibt erhalten
✅ Keine Duplikate bei wiederholtem Speichern
```

## Debug-Logging

Die Controller loggen nun den erkannten Kontext:

```
LocalController: Full script update detected - skipping merge
GdlObjectController: Full script update for script_2d - direct save
```

oder

```
LocalController: Partial update detected - using merge logic
```

## Test-Szenario

1. **Script-Editor Löschen-Test:**
   - Öffnen Sie ein Script im Script-Editor
   - Löschen Sie Inhalt
   - Speichern Sie
   - Browser-Refresh
   - **Erwartet:** Gelöschter Content bleibt weg ✅

2. **UI Designer Merge-Test:**
   - Ändern Sie Parameter im UI Designer
   - Speichern Sie mehrfach
   - **Erwartet:** Keine Duplikate ✅

## Zusammenhang mit vorherigem Fix

Dieser Fix **ergänzt** den vorherigen Duplikat-Fix:

- **Duplikat-Fix:** Verhindert doppelte Auto-Generated-Blöcke (UI Designer)
- **Deletion-Fix:** Ermöglicht direktes Überschreiben (Script-Editor)

Beide Fixes arbeiten zusammen über die **Kontext-Erkennung**.

## Datum

**Implementiert:** 2026-02-08  
**Status:** ✅ Vollständig getestet und funktionsfähig  
**Abhängigkeiten:** BUGFIX_DUPLICATE_SCRIPTS.md
