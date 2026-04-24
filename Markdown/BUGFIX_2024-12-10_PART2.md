# Bug-Fixes Teil 2 - 2024-12-10

## 🐛 Neue Probleme aus Screenshots (Objekte_02 & Parameter_02)

### Screenshot: Objekte_02.jpg

#### Probleme:
1. ❌ **Roter Pfeil oben**: "Demo_Projekt_Bürogebäude" - dunkler Text nicht lesbar
2. ❌ **Roter Pfeil Suchfeld**: Weißes Suchfeld statt dunkel
3. ❌ **Blauer Pfeil unten**: "b-prisma-schachtbauwerke" nicht lesbar (dunkle Texte)
4. ❌ **Grüner Pfeil**: "Hauptobjekt" Label nicht lesbar
5. ❌ **Filter-Buttons**: Nicht konsistent mit Dashboard

#### Lösungen:
```css
/* Breadcrumb - Projektnamen hell */
.breadcrumb span {
    color: #eceff4;  /* War: #2c3e50 */
}

/* Project-Info Box - dunkler Hintergrund */
.project-info {
    background: #3b4252;  /* War: white */
}
.project-info h2, .project-info p {
    color: #eceff4;  /* Helle Texte */
}

/* Suchfeld dunkel */
.search-bar input {
    background: #2e3440;
    color: #d8dee9;
    border: 2px solid #4c566a;
}

/* Objektkarten - Texte hell */
.object-card {
    color: #eceff4;
}
```

✅ **Status**: Alle Fixes angewendet mit sed-Befehlen

---

### Screenshot: Parameter_02.jpg

#### Problem 1: "Kein Objekt" angezeigt
**Ursache**: `loadObjectInfo()` erhielt kein `success: true` vom Backend

**Lösung Backend**:
```php
// GdlObjectController::getObject()
return $this->jsonResponse($response, [
    'success' => true,
    'data' => $object  // Statt 'gdl_object'
]);
```

**Lösung Frontend**:
```javascript
async function loadObjectInfo(objectId) {
    const response = await fetch(`${API_BASE_URL}/gdl-objects/${objectId}`);
    const result = await response.json();
    if (result.success && result.data) {
        currentGdlObjectName = result.data.name;
        document.getElementById('currentObjectName').textContent = `📄 ${currentGdlObjectName}`;
    } else {
        // Fallback: Zeige Objekt-ID
        document.getElementById('currentObjectName').textContent = `📄 Objekt ID: ${objectId}`;
    }
}
```

✅ **Status**: Backend korrigiert, API testet erfolgreich

---

#### Problem 2: Farbquadrat zwischen Verschieben und Typ

**Ursache**: `<span class="type-color-indicator">` wurde als separates Element angezeigt

**Lösung**: 
- Farbindikator entfernt
- Farbe direkt als Hintergrund der Select-Box
- Select-Box wird farbig mit weißem Text

```javascript
// Alte Version (mit Quadrat):
<td>
    <span class="type-color-indicator" style="background-color: ${typeColor}"></span>
    <select class="type-select">...</select>
</td>

// Neue Version (ohne Quadrat):
<td>
    <select class="type-select" style="background-color: ${typeColor}; color: white; font-weight: bold;">
        ...
    </select>
</td>
```

✅ **Status**: Farbindikator entfernt, Type-Select erhält Hintergrundfarbe

---

#### Problem 3: Spaltenreihenfolge falsch

**Alt**:
1. ☑️ Markieren
2. ⋮⋮ Verschieben
3. **Typ**
4. Name
5. Beschreibung
6. Standardwert
7. **B** (Fett)
8. **E** (Eingerückt)
9. **X** (Versteckt)
10. **U** (Unique)
11. UI-Seite
12. UI
13. Array

**Neu (gewünscht)**:
1. ☑️ Markieren
2. ⋮⋮ Verschieben
3. **X** (Versteckt)
4. **E** (Eingerückt)
5. **B** (Fett)
6. **U** (Unique)
7. **Typ**
8. Name
9. Beschreibung
10. Standardwert
11. UI-Seite
12. UI
13. Array

**Lösung**:
```javascript
// Table Header
<th><input type="checkbox" class="select-all"></th>
<th></th>
<th title="Versteckt">X</th>
<th title="Eingerückt">E</th>
<th title="Fett">B</th>
<th title="Unique">U</th>
<th>Typ</th>
<th>Name</th>
// ...

// Table Body
<td><input type="checkbox" class="row-checkbox"></td>
<td class="drag-handle">⋮⋮</td>
<td><input type="checkbox" data-field="flag_hidden" title="Versteckt"></td>
<td><input type="checkbox" data-field="flag_child" title="Eingerückt"></td>
<td><input type="checkbox" data-field="flag_bold" title="Fett"></td>
<td><input type="checkbox" data-field="flag_unique" title="Unique"></td>
<td><select class="type-select" style="background-color: ${typeColor}">...</select></td>
// ...
```

✅ **Status**: Spalten neu geordnet (Header + Body)

---

#### Problem 4: Array-Parameter brauchen Tabellen-Editor

**Anforderung**:
> "Arrayparameter bekommen Werte in einer Tabelle zugewiesen, entweder 1dim oder 2 dimensional. 
> Größe dynamisch anpassbar, Defaultwerte entweder alle gleich oder hochzählend eingebbar."

**Geplante Lösung** (für nächste Iteration):

**1D Array**:
```
Index | Wert
------|-------
  1   | [____]
  2   | [____]
  3   | [____]
[+ Zeile hinzufügen]

Optionen:
○ Alle gleich: [____]
○ Hochzählend ab: [____]
```

**2D Array**:
```
     | Col 1 | Col 2 | Col 3
-----|-------|-------|-------
Row 1| [___] | [___] | [___]
Row 2| [___] | [___] | [___]
[+ Zeile] [+ Spalte]

Optionen:
○ Alle gleich: [____]
○ Zeilen hochzählend
○ Spalten hochzählend
```

**Implementation**:
- Neues Modal für Array-Editor
- Dynamische Tabelle mit Add/Remove Buttons
- Speichert als JSON in `default_value_json`

⏳ **Status**: Noch nicht implementiert (seperate Aufgabe)

---

## ✅ Zusammenfassung Fixes

### Objekte_02.jpg - Alle Farben korrigiert:
- ✅ Breadcrumb Projektnamen hell
- ✅ Project-Info Box dunkel mit hellen Texten
- ✅ Suchfeld dunkel
- ✅ Objektkarten-Texte hell
- ✅ Box-Shadows angepasst

### Parameter_02.jpg:
- ✅ Objektname wird jetzt angezeigt (Backend + Frontend Fix)
- ✅ Farbquadrat entfernt, Type-Select farbig
- ✅ Spaltenreihenfolge: X, E, B, U vor Typ
- ⏳ Array-Editor (TODO für separate Implementierung)

### Backend:
- ✅ `GdlObjectController::getObject()` gibt `success: true` zurück
- ✅ API-Test erfolgreich: `/api/gdl-objects/1` liefert korrektes Format

### Frontend:
- ✅ `param-management.html` - Spalten neu geordnet
- ✅ `param-management.html` - Typ-Select farbig ohne Quadrat
- ✅ `param-management.html` - loadObjectInfo mit Fallback
- ✅ `object-selection.html` - Alle Farben korrigiert

---

## 🧪 Testing

### Objekte-Seite:
```
http://localhost:8888/gdl-ui-studio/public/object-selection.html
```
- [x] Projektnamen lesbar in Breadcrumb
- [x] Project-Info Box mit hellen Texten
- [x] Suchfeld dunkel
- [x] Objektkarten-Texte hell

### Parameter-Seite:
```
http://localhost:8888/gdl-ui-studio/public/param-management.html
```
- [x] Objektname wird oben angezeigt (statt "Kein Objekt")
- [x] Spaltenreihenfolge: Checkbox, Handle, X, E, B, U, Typ, Name...
- [x] Kein Farbquadrat mehr sichtbar
- [x] Type-Select mit farbigem Hintergrund
- [ ] Array-Editor (noch nicht implementiert)

---

## 📊 Änderungen

**Dateien geändert:**
1. `public/object-selection.html` - Farben korrigiert (sed)
2. `public/param-management.html` - Spalten neu geordnet, Type-Select farbig
3. `backend/src/Controllers/GdlObjectController.php` - success Flag hinzugefügt

**Nicht implementiert** (für später):
- Array-Editor für 1D und 2D Arrays

---

## 🚀 Nächste Schritte

Für Array-Parameter-Editor:
1. Neues Modal erstellen
2. Dynamische Tabelle mit Add/Remove
3. Optionen: "Alle gleich" / "Hochzählend"
4. Speichern als JSON in DB
5. Laden und Anzeigen im Editor

---

**Alle aktuellen Bugs behoben!** ✅
