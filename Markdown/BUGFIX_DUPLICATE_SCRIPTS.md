# Bugfix: Doppelte Scripte bei der Scriptgenerierung

## Problem

Bei der Scriptgenerierung wurden immer wieder doppelte Scripte eingefügt, insbesondere beim:
- Wechseln zwischen verschiedenen Scripts
- Mehrfachen Klicken auf den Speichern-Button
- Wiederholten Speichern aus dem UI Designer

## Ursachen

### 1. **Unzureichendes REGEX-Pattern** (`GdlScriptService.php`)
- Das Pattern erkannte nicht alle Varianten von Whitespace
- Trailing Whitespace am Ende von Header/Footer-Zeilen wurde nicht berücksichtigt
- Führte dazu, dass existierende Blöcke nicht gefunden und entfernt wurden

### 2. **Überschreiben statt Mergen** (`GdlObjectController.php`)
- Beim Update eines Objekts wurden Scripts komplett überschrieben
- Kein Merge mit existierendem Content
- Führte zu Datenverlust oder Duplikaten

### 3. **Einfache String-Suche** (`LocalFileService.php`)
- Verwendete `strpos()` statt robustem REGEX
- Konnte nur das erste Vorkommen finden
- Mehrfach vorhandene Blöcke blieben bestehen

### 4. **Doppelte Datei-Einträge** (`ui-designer.js`)
- Master Script wurde zweimal zum ZIP hinzugefügt
- 2D und 3D Scripts wurden ebenfalls doppelt hinzugefügt

## Implementierte Lösungen

### 1. Verbessertes REGEX-Pattern (`GdlScriptService.php`)

**Änderung:**
```php
// ALT: Zu restriktiv
$pattern = '/(?:\n' . $quotedHeader . '\n)+.*?\n' . $quotedFooter . '\n/s';

// NEU: Flexibel und robust
$quotedHeader = preg_quote(trim($header), '/');
$quotedFooter = preg_quote(trim($footer), '/');
$pattern = '/(?:\r?\n\s*' . $quotedHeader . '\s*\r?\n)+.*?\r?\n\s*' . $quotedFooter . '\s*\r?\n/s';
```

**Vorteile:**
- ✅ Erkennt trailing Whitespace
- ✅ Unterstützt Unix (\n) und Windows (\r\n) Zeilenenden
- ✅ Findet ALLE Duplikate, nicht nur das erste
- ✅ Logging bei Duplikat-Erkennung

### 2. Duplikat-Zählung und Logging (`GdlScriptService.php`)

**Neu hinzugefügt:**
```php
// Zähle alle Vorkommnisse
preg_match_all($pattern, $variableContent, $allMatches);
$matchCount = count($allMatches[0]);

// Entferne ALLE Duplikate
$cleanedVariable = preg_replace($pattern, '', $variableContent);

// Debug-Logging
if ($matchCount > 1) {
    error_log("GdlScriptService: Found and removed $matchCount duplicate blocks for header: $header");
}
```

### 3. Merge statt Überschreiben (`GdlObjectController.php`)

**Geänderte Logik:**
```php
// Hole aktuelles Objekt
$currentObject = $stmt->fetch(\PDO::FETCH_ASSOC);

// Merge neue Scripte mit existierenden
foreach ($scriptFields as $field => $markers) {
    if (isset($data[$field])) {
        $newContent = $data[$field];
        $existingContent = $currentObject[$field] ?? '';
        
        // Merge nur wenn neuer Content nicht leer/Placeholder
        if (!$scriptService->isPlaceholderContent($newContent)) {
            $mergedContent = $scriptService->mergeContent(
                $existingContent,
                $newContent,
                $markers['header'],
                $markers['footer']
            );
            $updateFields[] = "$field = ?";
            $updateValues[] = $mergedContent;
        }
    }
}
```

**Script-Marker:**
```php
$scriptFields = [
    'script_parameter' => [
        'header' => '! --- AUTO GENERATED VALUES ---', 
        'footer' => '! --- END VALUES ---'
    ],
    'script_master' => [
        'header' => '! --- AUTO GENERATED ARRAYS ---', 
        'footer' => '! --- END ARRAYS ---'
    ],
    'script_ui' => [
        'header' => '! --- UI-DESIGNER AUTO-CODE START ---', 
        'footer' => '! --- UI-DESIGNER AUTO-CODE END ---'
    ],
    // ... weitere Scripts mit Standard-Markern
];
```

### 4. Integration in LocalFileService (`LocalFileService.php`)

**Verbesserte mergeScript-Funktion:**
```php
public function mergeScript($objectPath, $scriptFilename, $newContent, $markerHeader)
{
    $scriptService = new GdlScriptService();
    
    // Konvertiere 3-Zeilen-Header zu einfachem Format
    $simpleHeader = "! --- " . trim($markerHeader) . " ---";
    
    // Nutze robuste mergeContent-Funktion
    $fullContent = $scriptService->mergeContent(
        $currentContent,
        $newContent,
        $simpleHeader,
        $endMarker
    );
    
    return file_put_contents($filePath, $fullContent) !== false;
}
```

### 5. Frontend-Bereinigung (`ui-designer.js`)

**Entfernte Duplikate:**
```javascript
// ALT: Doppelte Einträge
zip.file("1-Master.gdl", obj.script_master || "");  // Zeile 1
zip.file("1-Master.gdl", obj.script_master || this.generateMasterScript() || "");  // DUPLIKAT!
zip.file("2-2D.gdl", obj.script_2d || "");  // Zeile 1
zip.file("2-2D.gdl", obj.script_2d || "");  // DUPLIKAT!

// NEU: Nur einmal
zip.file("1-Master.gdl", obj.script_master || this.generateMasterScript() || "");
zip.file("2-2D.gdl", obj.script_2d || "");
zip.file("3-3D.gdl", obj.script_3d || "");
// ... etc.
```

### 6. LocalController Merge-Logik (`LocalController.php`)

**Komplette Merge-Pipeline:**
1. Lese existierende Scripts aus Dateien
2. Merge neue Scripte mit existierenden (Duplikat-Bereinigung)
3. Speichere gemergete Scripts in Dateien
4. Merge auch in Datenbank

## Test-Ergebnisse

### Real-World-Test (test_merge_real.php)

```
✓ Schritt 1: Erste Speicherung - 1 Block (erwartet: 1)
✓ Schritt 2: Zweite Speicherung (identisch) - 1 Block (erwartet: 1)
✓ Schritt 3: Dritte Speicherung (erweitert) - 1 Block (erwartet: 1)
✓ Schritt 4: Mit künstlichem Duplikat - 1 Block (erwartet: 1)

RESULTAT: ✓ ERFOLGREICH
```

### Weitere Tests

```
✓ Duplikat-Erkennung: 2 Duplikate gefunden und entfernt
✓ Placeholder-Erkennung: Alle Placeholders korrekt erkannt
✓ Header-Stripping: Header entfernt, Code erhalten
```

## Betroffene Dateien

1. ✅ `backend/src/Services/GdlScriptService.php` - Verbessertes REGEX + Logging
2. ✅ `backend/src/Controllers/GdlObjectController.php` - Merge-Logik implementiert
3. ✅ `backend/src/Controllers/LocalController.php` - Merge-Pipeline integriert
4. ✅ `backend/src/Services/LocalFileService.php` - GdlScriptService integriert
5. ✅ `public/ui-designer.js` - Doppelte ZIP-Einträge entfernt

## Vorteile der Lösung

✅ **Automatische Bereinigung** - Bereits vorhandene Duplikate werden beim nächsten Speichern entfernt  
✅ **Robuste Erkennung** - Funktioniert unabhängig von Whitespace-Varianten  
✅ **Debug-Logging** - Zeigt an, wenn Duplikate gefunden wurden  
✅ **Konsistenz** - Gleiche Lösung über alle Services hinweg  
✅ **Benutzer-Code sicher** - Nur Auto-Generated-Blöcke werden gemerged  
✅ **Abwärtskompatibel** - Funktioniert mit existierenden Scripts  

## Verwendung

Die Lösung wird automatisch bei folgenden Aktionen angewendet:

1. **UI Designer Speichern** - Script-Blöcke werden gemerged
2. **Script Editor Speichern** - Über updateObject-Endpoint
3. **ZIP Export** - Keine doppelten Dateien mehr
4. **Local Export** - Merge in lokale Dateien
5. **Parameter-Änderungen** - VALUES/VALUES2 Arrays werden korrekt gemerged

## Migration

**Keine manuelle Migration erforderlich!**

- Bestehende Duplikate werden automatisch beim nächsten Speichern bereinigt
- Keine Datenbank-Migration notwendig
- Keine Datei-Anpassungen erforderlich

## Monitoring

Überprüfen Sie die PHP Error Logs für Meldungen wie:

```
GdlScriptService: Found and removed X duplicate blocks for header: ! --- AUTO GENERATED ARRAYS ---
```

Dies zeigt an, dass Duplikate erkannt und automatisch bereinigt wurden.

## Datum

**Implementiert:** 2026-02-08  
**Status:** ✅ Vollständig getestet und funktionsfähig
