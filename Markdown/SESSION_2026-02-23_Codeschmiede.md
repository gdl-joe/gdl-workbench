# Session 2026-02-23 – Codeschmiede: Suche, DB-Snippets, POLY2_B-Bogen

**Version:** 1.6.0
**Datum:** 23. Februar 2026
**Bearbeitet:** `public/codeschmiede.html`, `public/codeschmiede.js`, `backend/src/routes.php`, `backend/src/Controllers/CodeschmiedeController.php`, `database/migrations/003_add_codeschmiede_snippets.sql`

---

## 1. Bugfix: i18n-Schlüssel `nav_codeschmiede`

**Problem:** In der Hauptnavigation aller Seiten stand „nav_codeschmiede" statt dem übersetzten Text „Codeschmiede", weil der Schlüssel in keiner der vier Sprachdateien vorhanden war.

**Fix:** Schlüssel in alle vier JSON-Dateien ergänzt:

| Datei | Wert |
|---|---|
| `public/lang/de.json` | `"Codeschmiede"` |
| `public/lang/en.json` | `"Code Forge"` |
| `public/lang/fr.json` | `"Forge de code"` |
| `public/lang/es.json` | `"Forja de código"` |

---

## 2. Feature: Befehlsbaum-Suche

**Ziel:** Schnelles Filtern des Befehlsbaums bei vielen GDL-Befehlen.

### CSS (`codeschmiede.html`)
- `.tree-search-wrap` – Suchfeld-Container unterhalb der Panel-Überschrift
- `.tree-search` – Eingabefeld mit Fokus-Highlight
- `.tree-search-icon` – Font-Awesome-Lupe als Overlay
- `.tree-no-results` – „Keine Befehle gefunden"-Anzeige

### HTML
```html
<div class="tree-search-wrap">
    <input type="text" id="treeSearch" class="tree-search" placeholder="Befehl suchen …">
    <i class="fas fa-search tree-search-icon"></i>
</div>
<div class="tree-no-results" id="treeNoResults">…</div>
```

### JS – `filterTree(query)`
- Durchsucht `cmd.label`, `cmd.category`, `cmd.subcategory`
- Blendet nicht passende `.cmd-item`-Elemente aus
- Verbirgt leere Unterkategorien und Kategorien
- Zeigt `#treeNoResults` wenn kein Treffer

```javascript
el('treeSearch')?.addEventListener('input', e => filterTree(e.target.value));
```

---

## 3. Feature: Snippets in MySQL-Datenbank

**Ziel:** Bisher in `localStorage` gespeicherte Snippets in der MySQL-Datenbank persistieren.

### DB-Migration: `database/migrations/003_add_codeschmiede_snippets.sql`
```sql
CREATE TABLE IF NOT EXISTS codeschmiede_snippets (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    command_id  VARCHAR(100)  NOT NULL,
    name        VARCHAR(255)  NOT NULL,
    params_json JSON          NOT NULL,
    created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_command_id (command_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
> **Hinweis:** Diese Migration muss manuell in phpMyAdmin oder per CLI eingespielt werden.

### PHP-Controller: `backend/src/Controllers/CodeschmiedeController.php`

| Methode | Route | Beschreibung |
|---|---|---|
| `getSnippets` | `GET /api/local/snippets[?command_id=…]` | Alle oder gefilterte Snippets; `params_json` → `params` |
| `createSnippet` | `POST /api/local/snippets` | Body: `{command_id, name, params}` |
| `deleteSnippet` | `DELETE /api/local/snippets/{id}` | Löscht Snippet, gibt 404 wenn nicht vorhanden |

### Routing: `backend/src/routes.php`
```php
use App\Controllers\CodeschmiedeController;
// …
$local->get('/snippets', CodeschmiedeController::class . ':getSnippets');
$local->post('/snippets', CodeschmiedeController::class . ':createSnippet');
$local->delete('/snippets/{id}', CodeschmiedeController::class . ':deleteSnippet');
```

### JS-Änderungen (`codeschmiede.js`)
- `SNIPPETS_KEY` localStorage-Konstante **entfernt**
- Neues State-Objekt: `cachedSnippets = {}` (keyed by `command_id`)
- `loadSnippets(forceRefresh)` – lädt per `GET /snippets`, befüllt `cachedSnippets`
- `apiDeleteSnippet(id, name)` – `DELETE`-Request, danach Tree neu rendern
- `promptSaveSnippet()` – `POST`-Request statt localStorage
- `renderTree()` liest aus `cachedSnippets[cmd.id]`, zeigt `snip.created_at` als Tooltip
- `await loadSnippets()` vor `renderTree()` in `DOMContentLoaded`

---

## 4. Neuer GDL-Befehl: POLY2_B – Polygon mit Bogenkanten (`poly2b_arc`)

**Ziel:** Erzeugung von GDL-Code für beliebige Polygone mit gemischten geraden und gebogenen Kanten via Stichhöhe.

### Neue Typen und Hilfsfunktionen

```javascript
const GDL_TYPE_MAP = {
    // …
    length_array: 'Length',   // 1D-Array von Length-Werten
    integer_array: 'Integer'  // 1D-Array von Integer-Werten
};

function resolveParamType(paramType) {
    const isArray = paramType?.endsWith('_array') ?? false;
    const base    = isArray ? paramType.replace('_array', '') : paramType;
    return { gdlType: GDL_TYPE_MAP[base] || 'Length', isArray };
}
```

### Parameter des Befehls

| ID | Typ | Beschreibung | Default |
|---|---|---|---|
| `varN` | var-value (integer, role:'count') | Punktanzahl | `int_poly_n = 4` |
| `varX` | text (length_array) | X-Array | `x_poly` |
| `varY` | text (length_array) | Y-Array | `y_poly` |
| `varZ` | text (length_array) | Stichhöhen-Array | `z_poly` |
| `coordTable` | coord-table | Koordinaten-Tabelle | — |
| `varCont` | var-value (pen) | Konturlinie | `poly_cont = L_` |
| `varFill` | var-value (fill) | Füllung | `poly_fill = 1` |
| `varFillPen` | var-value (pen) | Füllstift | `poly_fill_pen = 1` |
| `varBgPen` | var-value (pen) | Hintergrundstift | `poly_bg_pen = 0` |
| `varAddX/Y` | var-value (length) | ADD2-Versatz | `0` |
| `varKontTyp` | var-value (integer) | Konturtyp | `kont_typ = 7` |

### Modus "→ Parameter": Array-Parameter korrekt anlegen
In `saveAsParameters()`:
- `countParam` (role: `'count'`) ermittelt die Array-Dimension
- Array-Felder erhalten `array_type: '1D'`, `array_first_dim: countVal`
- Wird an `POST /api/local/parameters/create` übergeben

### Generiertes GDL-Script (optimierte Fassung)
```gdl
int_poly_n      = 4

DIM x_poly[], y_poly[], z_poly[]

x_poly[1] = 0 : y_poly[1] = 0 : z_poly[1] = 0
x_poly[2] = 1 : y_poly[2] = 0 : z_poly[2] = 0
x_poly[3] = 1 : y_poly[3] = 1 : z_poly[3] = 0
x_poly[4] = 0 : y_poly[4] = 1 : z_poly[4] = 0

nix             = 0.0001
eps             = 0.0001

DIM arc_xm[], arc_ym[], arc_ang[]

FOR i = 1 TO int_poly_n
    ii     = (i MOD int_poly_n) + 1
    dx     = x_poly[ii] - x_poly[i]
    dy     = y_poly[ii] - y_poly[i]
    seg_r  = MAX(nix, SQR(dx^2 + dy^2))
    r2     = seg_r / 2
    dx     = dx / seg_r
    dy     = dy / seg_r
    xm     = (x_poly[i] + x_poly[ii]) / 2
    ym     = (y_poly[i] + y_poly[ii]) / 2
    IF ABS(z_poly[i]) < eps THEN   ! gerade Kante
        arc_xm[i]  = 0
        arc_ym[i]  = 0
        arc_ang[i] = 0
    ELSE
        xs         = (r2^2 - z_poly[i]^2) / (2 * z_poly[i])
        xs_r       = ABS(xs + z_poly[i])            ! Radius
        arc_xm[i]  = xm - dy * xs                  ! Mittelpunkt X
        arc_ym[i]  = ym + dx * xs                  ! Mittelpunkt Y
        arc_ang[i] = ASN(r2 / xs_r) * SGN(z_poly[i])  ! Abweichungswinkel
    ENDIF
NEXT i

FOR i = 1 TO int_poly_n
    PUT x_poly[i], y_poly[i], 1
    IF ABS(z_poly[i]) > eps THEN   ! B O G E N
        PUT arc_xm[i], arc_ym[i], 900
        PUT 0, 2 * arc_ang[i], 4000
    ENDIF
NEXT i

kont_typ        = 7
poly_cont       = L_
poly_fill       = 1
…
PEN poly_cont
FILL poly_fill
ADD2 poly_addx, poly_addy
POLY2_B NSP/3, kont_typ, poly_fill_pen, poly_bg_pen, GET(NSP)
DEL 1
```

---

## 5. Feature: Koordinaten-Tabelle (`coord-table`)

**Ziel:** In den Modi „Manuell" und „→ Parameter" können die Polygon-Koordinaten direkt in einer interaktiven Tabelle eingegeben werden statt manuell Arrays zuzuweisen.

### CSS (`codeschmiede.html`)
```css
.coord-table-wrap   /* grid-column: 1/-1, volle Breite */
.coord-table        /* border-collapse, JetBrains Mono */
.coord-table th     /* Header-Styling */
.coord-table td.ct-i /* Zeilennummer-Spalte */
.ct-inp             /* Transparent, rechtsbündig, Fokus-Highlight */
```

### JS-Hilfsfunktionen
| Funktion | Beschreibung |
|---|---|
| `_getCoordTableConfig(param, cmd)` | Liest `n` (aus varN_val) und `colNames` (aus varX/varY/varZ) live aus dem DOM |
| `_readCoordTableData(paramId)` | Liest alle Tabellenzeilen als `[{x, y, z}]` aus dem DOM |
| `_syncCoordTableHidden(paramId)` | Schreibt JSON in das versteckte `<input>` (`param_coordTable`) |
| `_rebuildCoordTableRows(param, cmd, prevData)` | Baut tbody neu auf (Resize), übernimmt vorhandene Werte |

### Rendering in `renderForm()`
- **Modus b (Aus Parametern):** Nur verstecktes Input, keine Tabelle
- **Modi a/c:** Vollständige Tabelle mit `<thead>` (dynamische Spaltenköpfe) und `<tbody>`
- **Post-render-Wiring:**
  - `varN_val` Input → Tabelle resizen, Code regenerieren
  - `varX/varY/varZ` Inputs → Spaltenköpfe aktualisieren

### State-Persistenz
- `collectParams()` liest `el('param_coordTable').value` (JSON-String)
- `saveState()` / `loadState()` persistieren die Tabelle via localStorage
- Snippets speichern die Tabellenwerte als JSON in `params.coordTable`

---

## 6. Optimierung: Schleifen-Merge und Array-Eliminierung

**Ausgangsproblem:** Der ursprüngliche POLY2_B-Script hatte:
- 2 separate FOR-Schleifen + `GOSUB 12` + Subroutine mit `RETURN`
- 6 intermediäre Arrays: `poly_dx[]`, `poly_dy[]`, `poly_r[]`, `r2[]`, `xm[]`, `ym[]`

**Erkenntnis:** Schleife 2 / Subroutine 12 braucht für Iteration `i` ausschließlich Werte aus Iteration `i` von Schleife 1. Keine Cross-Referenzen.

**Optimierung:**
1. Schleifen zusammengeführt → eine FOR-Schleife
2. Subroutine inline ins Schleifenende gehoben → kein GOSUB/RETURN/END
3. Intermediäre Arrays → skalare Temp-Variablen (`dx`, `dy`, `seg_r`, `r2`, `xm`, `ym`)
4. `DIM poly_dx[], …` vollständig entfernt
5. `xs_r` war schon korrekt als lokale Skalarvariable (bestätigt)

**Ergebnis:** Kompakterer, verständlicherer Code ohne Subroutinen-Overhead.

---

## 7. GDL Syntax Highlighter erweitert

Neue Keywords in `highlightGDL()`:
```
FOR TO NEXT IF THEN ELSE ENDIF END GOSUB RETURN
DIM PUT GET MOD MAX MIN ABS SQR ASN SGN NOT AND OR NSP
```

---

## Dateiübersicht

| Datei | Änderungen |
|---|---|
| `public/codeschmiede.html` | CSS: tree-search, coord-table; HTML: Suchfeld, tree-no-results |
| `public/codeschmiede.js` | Snippets-API, filterTree(), coord-table-Helfer, poly2b_arc-Befehl, GDL-Highlighter |
| `public/lang/de.json` | `nav_codeschmiede: "Codeschmiede"` |
| `public/lang/en.json` | `nav_codeschmiede: "Code Forge"` |
| `public/lang/fr.json` | `nav_codeschmiede: "Forge de code"` |
| `public/lang/es.json` | `nav_codeschmiede: "Forja de código"` |
| `backend/src/routes.php` | 3 neue Snippet-Routen + `use CodeschmiedeController` |
| `backend/src/Controllers/CodeschmiedeController.php` | Neu: GET/POST/DELETE Snippets |
| `database/migrations/003_add_codeschmiede_snippets.sql` | Neu: MySQL-Tabelle `codeschmiede_snippets` |
| `public/dashboard.html` | Version auf 1.6.0 aktualisiert |
| `public/release_notes.html` | v1.6.0 Eintrag ergänzt |
