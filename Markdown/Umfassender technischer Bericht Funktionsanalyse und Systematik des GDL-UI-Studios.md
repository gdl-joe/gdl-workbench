

## 1. Strategische Projektsteuerung über das Dashboard

Das Dashboard fungiert als das zentrale Nervenzentrum des GDL-UI-Studios. In der Architektur der GDL-Entwicklung (Geometric Description Language) übernimmt es die Rolle einer übergeordneten Steuerungseinheit, die komplexe Entwicklungsstränge konsolidiert und eine effiziente Verwaltung der Projekte ermöglicht. Durch die Bündelung aller relevanten Metriken an einem Ort transformiert das Dashboard die lose Objektsammlung in ein strukturiertes Portfolio-Management.

### Struktur der Projektverwaltung und Status-Hierarchie

Die Systematik der Projektverwaltung folgt einer logischen Zustandsmaschine (State Machine), die den gesamten Lebenszyklus einer Entwicklung abbildet. Diese Status-Hierarchie optimiert den Workflow des Entwicklers durch eine klare funktionale Trennung:

- **Aktiv:** Projekte im unmittelbaren Fokus der aktuellen Entwicklungssession.
- **WIP (Work In Progress):** Aktive Bearbeitungsphasen ohne sofortige Deadline-Priorität.
- **Dringend:** Kritische Aufgabenbereiche, die eine sofortige Intervention erfordern (z. B. Hotfixes).
- **Archiv:** Dokumentierte Bestandsdaten, die für Referenzzwecke vorgehalten werden.

### Quantitative Projekt-Metriken

Um eine faktenbasierte Projektsteuerung zu gewährleisten, aggregiert das System die Daten in einer zentralen Übersicht:

|   |   |
|---|---|
|Metrik|Definition und Relevanz|
|**Projekte Gesamt**|Summe aller in der Datenbank erfassten GDL-Projekte.|
|**Aktiv**|Anzahl der Projekte mit aktiver Bearbeitungsberechtigung.|
|**WIP**|Maßstab für die parallele Auslastung der Entwicklungskapazitäten.|
|**Dringend**|Indikator für kritische Meilensteine im aktuellen Entwicklungszyklus.|

Die Differenzierung zwischen „WIP“ und „Dringend“ stellt einen wesentlichen „So-What“-Layer der Systematik dar: Während „WIP“ die allgemeine Kapazitätsauslastung widerspiegelt, fungiert der Status „Dringend“ als proaktives Warnsystem für das Zeitmanagement. Diese Trennung verhindert Engpässe und stellt sicher, dass Ressourcen zielgerichtet dort eingesetzt werden, wo der höchste Fertigstellungsdruck herrscht.

Von dieser globalen Projektübersicht führt der Workflow nahtlos zur granularen Ebene der Objektverwaltung, in der die spezifischen Komponenten eines GDL-Projekts definiert werden.

## 2. Strukturierte Objektverwaltung und -auswahl

Innerhalb eines GDL-Projekts ist eine granulare Objekthierarchie zwingend erforderlich, um die strukturelle Komplexität der `.gsm`-Dateien handhabbar zu halten. Das GDL-UI-Studio ermöglicht die Verwaltung multipler Objekte innerhalb eines Projekts, was die Entwicklung modularer Bibliotheken massiv vereinfacht.

### Parameter der Objektauswahl

Die Objekterstellung ist als integrierter Prozess gestaltet, der eine schnelle Skalierung ermöglicht. Analog zur Projektlogik nutzt das Studio ein Filtersystem, um die Übersichtlichkeit bei wachsenden Bibliotheken zu wahren:

|   |   |
|---|---|
|Filteroption|Funktionale Bedeutung im Entwicklungszyklus|
|**Alle**|Vollständige Inventur aller Objekte innerhalb des Projektcontainers.|
|**Aktiv**|Objekte, die derzeit für den Export oder die Integration bereitstehen.|
|**WIP**|Objekte in der aktiven Scripting- oder Testphase.|
|**Dringend**|Objekte mit bekannten Bug-Reports oder dringenden Anpassungswünschen.|
|**Archiv**|Versionierte Zwischenstände zur Vermeidung von Datenverlust bei Refactoring.|

Eine konsistente Statusverfolgung auf Objektebene fungiert als primäres Instrument der Qualitätssicherung. Sie verhindert Fehlentwicklungen, indem sie einen klaren Freigabeprozess erzwingt: Nur Objekte, die den Validierungsprozess durchlaufen haben, verlassen den WIP-Status. Diese methodische Vorfilterung bildet die notwendige technische Basis für die nachfolgende Definition der Parameterdaten.

## 3. Parameterverwaltung: Die technische Datenbasis

Parameter bilden die essenzielle Brücke zwischen der geometrischen Logik und der Benutzeroberfläche eines GDL-Objekts. Sie sind das Fundament, auf dem die Interaktionsfähigkeit des Objekts in der CAD-Umgebung ruht.

### Analyse der GDL-Parameterliste und Visual CRUD Operations

Die Parameterverwaltung stellt dem Architekten vier zentrale Operationen zur Verfügung, die als visuelle CRUD-Funktionen (Create, Read, Update, Delete) verstanden werden können:

- **X (Delete):** Entfernen redundanter Datenfelder.
- **E (Edit):** Modifikation bestehender Parametereigenschaften.
- **B (Block):** Bestätigung und Sperrung von Parametern. Das „Blocking“ markiert Parameter als Read-only oder schützt sie vor unbeabsichtigten Änderungen während der UI-Konfiguration.
- **U (Update/Reorder):** Manuelle Sortierung der Parameter-Reihenfolge zur Strukturierung des GDL-Scripts.

Zudem erlaubt die XML-Import-Funktion eine schnelle Visualisierung und Re-Integration externer Parameterstrukturen in die Studio-Umgebung.

### Technische Spezifikation der Attributfelder

Jeder Parameter wird durch ein präzises Schema definiert, das die Datenintegrität sichert:

|   |   |
|---|---|
|Attribut|Funktionale Beschreibung|
|**Typ**|Bestimmt den GDL-Datentyp (z.B. Länge, Ganzzahl, Material).|
|**Name**|Eindeutiger Variablenname für die interne Script-Logik.|
|**Beschreibung (DE)**|Lokalisierte Bezeichnung für das User Interface.|
|**Standardwert (DE)**|Initialwert bei der Instanziierung des Objekts.|
|**UI-Seite**|Zuordnung zu einer spezifischen Registerkarte im UI-Dialog.|
|**UI**|Checkbox/Flag zur Steuerung der Sichtbarkeit im User Interface.|
|**Array-Typ**|Definition der Array-Dimension (1D oder 2D), falls zutreffend.|

Die Restriktion für die Typen **TITLE**, **SEPARATOR** und **DICTIONARY**, für welche die Funktion „VALUES“ nicht zur Verfügung steht, ist architektonisch begründet: Da diese Typen als rein strukturelle Organisationseinheiten oder komplexe Datenbehälter fungieren, besitzen sie keine skalaren Einzelwerte. Diese Einschränkung im Studio verhindert logische Inkonsistenzen im GDL-Parameterblock bereits vor der Generierung. Durch Keywords wie `CUSTOM` für freie Eingaben oder die präzise Syntax von `RANGE[min, max]` (inklusiv) und `RANGE(min, max)` (exklusiv) wird sichergestellt, dass das resultierende Script unmittelbar compile-ready ist.

Diese Parameterdefinitionen legen den Grundstein für die Verwaltung komplexer, nicht-skalarer Datenstrukturen im Array-Editor.

## 4. Der Array-Parameter Editor: Management komplexer Strukturen

Für fortgeschrittene GDL-Entwicklungen, wie tabellarische Materiallisten oder dynamische Größenmatrizen, sind Arrays unverzichtbar. Der Editor automatisiert die Dateneingabe, um die bei manueller Skriptierung hohe Fehlerquote zu eliminieren.

### Eingabemodi und Index-Logik

Der Editor bietet drei spezialisierte Modi zur effizienten Datenmanipulation:

1. **Manuell eingeben:** Für individuelle, nicht-lineare Datensätze.
2. **Alle gleich:** Massen-Update zur Konsistenzprüfung über alle Array-Indizes.
3. **Hochzählend:** Automatisierte Sequenzgenerierung mittels Platzhaltern.

Hierbei ist die Nutzung der Platzhalter **'i'** und **'s'** von zentraler Bedeutung. Das System nutzt einen **1-basierten Index ('i')**, der spaltenweise von oben nach unten zählt. Die explizite Wahl des 1-basierten Index ist eine kritische Anpassung an die GDL-Syntax, die sich – im Gegensatz zu vielen 0-basierten C-Sprachen – strikt an dieser Zählweise orientiert. Der Startwert **'s'** erlaubt zudem flexible Initialisierungen.

### Struktureller Vergleich: 1D vs. 2D

- **1D Array:** Lineare Zuordnung von Index zu Wert; ideal für einfache Auswahlkataloge.
- **2D Array:** Matrix-Struktur zur Abbildung komplexer Abhängigkeiten (z.B. Profilabmessungen über mehrere Typen hinweg).

Der Effizienzgewinn durch die automatisierte Hochzähl-Funktion ist insbesondere bei großen Datensätzen signifikant, da sie händische Tippfehler ausschließt und die logische Integrität über hunderte Zeilen hinweg garantiert. Diese validierten Daten werden im nächsten Schritt visuell aufbereitet.

## 5. UI Designer: Visuelle Konfiguration und Element-Toolbox

Die Akzeptanz eines GDL-Objekts beim Endnutzer korreliert direkt mit der Usability des Interfaces. Der UI Designer ermöglicht eine intuitive visuelle Gestaltung der Dialogseiten.

### Element-Toolbox und Interaktion

Die Gestaltung erfolgt über eine Toolbox und eine Canvas-Interaktion (Drag & Drop). Die verfügbaren Elemente korrespondieren direkt mit GDL-Befehlen:

|   |   |
|---|---|
|UI-Element|GDL-Entsprechung / Funktion|
|**UI_INFIELD**|Editierbares Feld für Parameterwerte.|
|**UI_OUTFIELD**|Reine Textanzeige von Parameterwerten oder Labels.|
|**UI_BUTTON / UI_LINK**|Auslöser für Skripte oder externe Verknüpfungen.|
|**UI_SEPARATOR**|Linien-Element zur visuellen Gruppierung von Parametern.|
|**UI_RADIO_BUTTON**|Auswahl aus einem vordefinierten Set an Optionen.|
|**UI_PICT**|Einbindung von Vorschaubildern oder technischen Illustrationen.|

### Layout-Management und Eigenschaften

Zur Feinjustierung der Oberfläche bietet der Designer Werkzeuge wie **Y-Achsen-Steuerung** zur präzisen vertikalen Ausrichtung und eine **Zoom-Funktion (100%)** zur Kontrolle der realen Darstellungsgrenzen. Eigenschaften wie „Ausgegrauter Text“ visualisieren den Status „Read-only“ oder inaktive Abhängigkeiten, während „Originalgröße verwenden“ die Integrität grafischer Ressourcen bei `UI_PICT` sichert.

Die strikte Trennung von grafischer Repräsentation und logischer Parameterdefinition erlaubt eine iterative Interface-Gestaltung, bei der die Optik optimiert werden kann, ohne die zugrunde liegende Datenstruktur zu gefährden.

## 6. Zusammenfassende Beantwortung systemischer Fragestellungen

Das GDL-UI-Studio fungiert als integrierte Entwicklungsumgebung (IDE), die alle funktionalen Aspekte der Objekterstellung in einem geschlossenen System vereint.

### Synthese der Funktionalität

1. **Sicherung der Datenintegrität:** Durch das Validierungsschema „Alle Werte sind gültig“ und die proaktive Keyword-Prüfung werden Syntaxfehler im Vorfeld unterbunden. Das Studio stellt sicher, dass nur logisch konsistente Parameterkombinationen in den Script-Generator fließen.
2. **Rolle der Keywords:** Keywords wie `CUSTOM` und `RANGE` (in den Varianten `[min, max]` und `(min, max)`) dienen als Steuerbefehle für die automatisierte Script-Generierung. Sie automatisieren die Erstellung komplexer `VALUES`-Befehle im GDL-Parameter-Script.
3. **Unterstützung der Lokalisierung:** Die konsequente Trennung zwischen technischen Parameternamen und deutschen Beschreibungen (DE) ermöglicht die Erstellung professioneller, lokalisierter Benutzeroberflächen ohne manuelle String-Manipulation im Code.

Das GDL-UI-Studio reduziert die Komplexität der GDL-Entwicklung fundamental, indem es die technische Logik und die visuelle Gestaltung in einem geführten, validierten Workflow synchronisiert. Dies stellt einen entscheidenden Fortschritt zur Standardisierung und Professionalisierung der digitalen Bauteilmodellierung dar.