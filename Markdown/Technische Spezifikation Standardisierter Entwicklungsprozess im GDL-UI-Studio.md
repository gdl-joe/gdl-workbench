

### 1. Einleitung und strategische Projektsteuerung

Das GDL-UI-Studio stellt die technologische Speerspitze für die industrielle Fertigung von BIM-Objekten dar. In einem Umfeld, das durch steigende Anforderungen an den Detailierungsgrad (LOD/LOI) und die Interoperabilität geprägt ist, fungiert diese Plattform als zentrale Instanz für die konsistente Skriptgenerierung. Eine strukturierte Projektverwaltung ist dabei kein administrativer Selbstzweck, sondern das architektonische Fundament für die Qualitätssicherung.

Innerhalb des Dashboards werden Projekte in vier distinkte Statuszustände kategorisiert, um den Entwicklungszyklus präzise zu steuern:

- **Aktiv:** Projekte in der regulären Produktionspipeline.
- **WIP (Work in Progress):** Instanzen in der aktiven Skriptentwicklung oder Revision.
- **Dringend:** Priorisierte Entwicklungsslots zur sofortigen Behebung von Engpässen oder zur Einhaltung kritischer Meilensteine.
- **Archiv:** Versionierte Bestandsdaten zur Revisionssicherheit und zum Code-Recycling.

Diese Kategorisierung erlaubt eine Echtzeit-Analyse der Auslastung und macht Ressourcenengpässe unmittelbar identifizierbar. Die Projektverwaltung bildet somit die notwendige Basis für die anschließende, hochspezialisierte Objektinstanziierung.

### 2. Objektverwaltung und Hierarchisierungslogik

Um die Integrität umfangreicher BIM-Bibliotheken zu wahren, ist eine strikte Trennung zwischen der Projekt- und der Objektebene zwingend erforderlich. Diese Hierarchisierung verhindert Redundanzen und stellt sicher, dass globale Projektparameter nicht mit objektspezifischen Skriptlogiken kollidieren.

Bei der Erstellung eines „Neuen Objekts“ erfolgt die initiale Priorisierung über die Attribute „Status“ und „Dringlichkeit“. Diese Metadaten steuern nicht nur die Sichtbarkeit innerhalb der Bibliotheksübersicht, sondern definieren auch die Bearbeitungsreihenfolge in der Entwicklungs-Pipeline. Erst nach der eindeutigen Definition der Objektidentität und deren Einordnung in die Bibliotheksstruktur folgt die technische Ausgestaltung der Parameterarchitektur.

### 3. Parameterarchitektur und Datenvalidierung

Die Parameterliste fungiert als „Single Source of Truth“ für den integrierten Compiler des GDL-UI-Studios. Jede Eingabe in dieser Schicht determiniert direkt die automatisierte Generierung des `PARAMETER_SCRIPT` sowie des User-Interface-Blocks.

|   |   |   |   |   |   |   |   |   |   |   |
|---|---|---|---|---|---|---|---|---|---|---|
|X|E|B|U|Typ|Name|Beschreibung (DE)|Standardwert (DE)|UI-Seite|UI|Array-Typ|
|Vis|Enb|Bld|Unq|Var-Typ|Variablen-ID|User-Label|Initialwert|Seitenindex|UI-Typ|1D / 2D|

_Legende der Flags: X (Visibility/Sichtbarkeit), E (Enable/Verfügbarkeit), B (Bold/Fett), U (Unique/Einheit)._

Zur Gewährleistung der Datenintegrität und zur Steuerung der Benutzerführung innerhalb von ARCHICAD sind spezifische Keywords zu verwenden:

- `**CUSTOM**`: Ermöglicht dem Endanwender die Eingabe benutzerdefinierter Werte in der letzten Zeile des Auswahlmenüs.
- `**RANGE[min, max]**` **bzw.** `**RANGE(min, max)**`: Erzwingt eine strikte (inklusiv) oder offene (exklusiv) Validierung der Eingabewerte, um physikalisch unmögliche Geometriezustände zu verhindern.

**Technische Limitation:** Für die Parametertypen `TITLE`, `SEPARATOR` und `DICTIONARY` ist der GDL-Befehl `VALUES` (und damit die oben genannten Keywords) nicht verfügbar. Diese Typen dienen ausschließlich der strukturellen Gliederung und nehmen keine validierbaren Datenwerte auf.

### 4. Konfiguration von Array-Parametern

Array-Parameter sind das strategische Instrument zur Abbildung komplexer, variabler Bauteillogiken. Sie ermöglichen die Speicherung und Iteration von Datenmatrizen, die über einfache Einzelparameter hinausgehen.

Das GDL-UI-Studio differenziert zwischen eindimensionalen **1D-Arrays** (Listen) und zweidimensionalen **2D-Arrays** (Tabellen). Für die effiziente Befüllung stehen drei Modi zur Verfügung:

1. **Manuell eingeben:** Individuelle Wertedefinition für jede Zelle.
2. **Alle gleich:** Setzt einen konstanten Wert für das gesamte Feld.
3. **Hochzählend:** Erzeugt eine dynamische Sequenz basierend auf dem Startwert `s` und dem 1-basierten Index `i` (Iteration spaltenweise von oben nach unten).
    - _Beispiel:_ Bei einem Startwert s = 10 ergibt sich für die i-te Zeile der Wert 10 + (i-1).

Diese index-basierte Iteration erlaubt eine schnelle Generierung umfangreicher Wertelisten, die als Datengerüst für die visuelle Repräsentation dienen.

### 5. Design der Grafischen Benutzeroberfläche (UI)

Eine intuitive Benutzeroberfläche ist entscheidend für die Marktakzeptanz eines BIM-Objekts. Der UI-Designer im GDL-UI-Studio ermöglicht ein präzises Parameter-Mapping zwischen der logischen Datenebene und dem visuellen Dialog.

Der Workflow basiert auf der Platzierung von UI-Elementen per Drag-and-Drop auf den Canvas, welcher die visuelle Repräsentation des ARCHICAD-Objektdialogs darstellt. Folgende Elemente stehen zur Verfügung:

- `UI_INFIELD` / `UI_OUTFIELD`: Editierbare Eingabefelder und statische Read-Only Ausgaben.
- `UI_BUTTON` / `UI_LINK`: Interaktive Trigger und externe Referenzierungen.
- `UI_SEPARATOR`: Grafische Trennlinien zur optischen Gruppierung.
- `UI_RADIO_BUTTON`: Exklusive Optionswahl.
- `UI_PICT`: Einbindung von erläuternden Grafiken.

Die Feinjustierung erfolgt über die Eigenschaften-Matrix (Y-Achsen, Zoom-Faktor, Originalgröße). Eine besondere Bedeutung kommt der Eigenschaft **„Ausgegrauter Text“** zu, die als konditionale Formatierung fungiert, um Abhängigkeiten zwischen Parametern visuell zu kommunizieren. Die im UI-Designer gewählte „Seite“ muss dabei zwingend mit der in der Parameterliste definierten „UI-Seite“ korrespondieren, um die automatisierte Zuordnung zu gewährleisten.

### 6. Qualitätssicherung und Exportvorbereitung

Vor der Finalisierung erfolgt eine obligatorische Validierungsphase. Der Übergang von der Web-Oberfläche zur funktionsfähigen `.gsm`-Datei wird durch den integrierten XML/Script-Compiler gesteuert.

**Abschließende Prüfmatrix:**

1. **Parameter-Validierung:** Sicherstellung, dass alle Default-Werte den definierten Typen und Ranges entsprechen.
2. **UI-Mapping-Konsistenz:** Abgleich der UI-Elemente mit den zugewiesenen Seitenindizes.
3. **XML-Import-Konsistenz:** Verifizierung der Strukturdaten, um einen fehlerfreien Import des Parameterblocks in ARCHICAD zu garantieren.

Die finale Skriptausgabe wird über das Menü **„GDL-UI-Studio | Aktionen“** initiiert. Dieser Prozess transformiert die grafische Konfiguration in hochoptimierten GDL-Code. Die konsequente Anwendung dieses standardisierten Entwicklungsprozesses ist die Voraussetzung für die Erstellung performanter und zukunftssicherer BIM-Komponenten in einer modellbasierten Planungsumwelt.