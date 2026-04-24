# 🎬 GDL Workbench – Video-Script in 8 Teilen

> **Format:** Erklärvideo / Screencast  
> **Zielgruppe:** Archicad-Nutzer mit GDL-Kenntnissen  
> **Ton:** sachlich, klar, praxisorientiert

---

## 📋 TEIL 1 – Übersicht: Was ist die GDL Workbench?

### Intro / Hook
*(Screengrab: Logo „GDL Workbench" – Headerleiste)*

**Sprechtext:**  
Willkommen bei der GDL Workbench – dem webbasierten Entwicklungswerkzeug für GDL-Objekte in Archicad.

Wer regelmäßig eigene GDL-Objekte erstellt, kennt das Problem: Parameter verwalten, Scripte schreiben, Oberflächen gestalten, Builds ausführen – all das verteilt sich normalerweise über viele verschiedene Orte und Werkzeuge.

Die GDL Workbench bringt all das in einer einzigen, übersichtlichen Web-Oberfläche zusammen.

### Was kann die GDL Workbench?

**Sprechtext:**  
Die Anwendung ist in sieben Bereiche gegliedert, die wir in diesem Videokurs Schritt für Schritt vorstellen:

- **Projektverwaltung** – Ihr organisiert eure GDL-Projekte
- **Objektverwaltung** – Ihr wählt das aktuelle Objekt aus
- **Parameterverwaltung** – Ihr definiert alle Parameter mit Übersetzungen und Wertelisten
- **UI Designer** – Ihr gestaltet die Benutzeroberfläche visuell per Drag & Drop
- **Skript Editor** – Ihr bearbeitet alle GDL-Scripts direkt im Browser
- **Codeschmiede** – Ihr generiert GDL-Code assistiert und schnell
- **Build Tasks** – Ihr startet Konvertierungen und Batch-Prozesse mit einem Klick

### Archicad-First-Philosophie

**Sprechtext:**  
Wichtig zu verstehen: Die GDL Workbench folgt dem Prinzip „Archicad First". Das bedeutet: Projekte und Objekte werden zunächst in Archicad erstellt und verwaltet. Die Workbench synchronisiert sich mit diesen lokalen Dateien – sie überschreibt oder löscht nichts eigenmächtig. So bleibt Archicad die einzige Quelle der Wahrheit.

### Outro Teil 1

**Sprechtext:**  
In den folgenden sieben Kapiteln zeige ich euch jeden Bereich im Detail. Fangen wir an mit dem ersten Menüpunkt: der Projektverwaltung.

---

## 📁 TEIL 2 – Projektverwaltung (Dashboard)

*(Screengrab: `dashboard.html` geöffnet)*

### Einstieg

**Sprechtext:**  
Das Dashboard ist der Startpunkt der GDL Workbench. Hier seht ihr auf einen Blick alle Projekte, die in der Workbench hinterlegt sind – als übersichtliche Karten-Ansicht.

### Was ist ein Projekt?

**Sprechtext:**  
Ein Projekt in der GDL Workbench entspricht einem Verzeichnis auf eurem Rechner, in dem sich eure GDL-Objekte befinden – zum Beispiel eine Objektbibliothek für ein bestimmtes Büroprojekt oder eine Produktlinie.

Ihr seht hier den Projektnamen, den Pfad zum lokalen Ordner, und wie viele GDL-Objekte jeweils enthalten sind.

### Projekt auswählen

**Sprechtext:**  
Um mit einem Projekt zu arbeiten, wählt ihr es einfach per Klick aus. Die Workbench merkt sich die Auswahl – Projektname und aktives Objekt erscheinen dauerhaft in der Kopfzeile, auf jeder Seite der Anwendung.

### Workflow-Hinweis

**Sprechtext:**  
Neue Projekte werden nicht über die Workbench erstellt – das ist Absicht. Ordner anlegen, Objekte hinzufügen: all das macht ihr in Archicad oder direkt im Dateisystem. Die Workbench erkennt die vorhandene Struktur und liest sie ein. Das verhindert Konflikte und bewahrt die Konsistenz eurer Bibliothek.

### Outro Teil 2

**Sprechtext:**  
Sobald ein Projekt ausgewählt ist, geht es weiter mit der Objektverwaltung – dem nächsten Schritt im Workflow.

---

## 🗂️ TEIL 3 – Objektverwaltung (Objektauswahl)

*(Screengrab: `object-selection.html` geöffnet)*

### Einstieg

**Sprechtext:**  
In der Objektverwaltung seht ihr alle GDL-Objekte des aktuell ausgewählten Projekts – also alle `.gsm`-Dateien in eurem Projektordner.

Jedes Objekt wird als Karte dargestellt, mit dem Namen und dem Status: Ist es bereits in der Datenbank erfasst? Wurden Änderungen vorgenommen?

### Objekt auswählen

**Sprechtext:**  
Klickt ihr auf ein Objekt, wird es als aktives Objekt gesetzt. Von diesem Moment an arbeiten alle anderen Bereiche der Workbench mit diesem Objekt – Parameterverwaltung, Skript Editor, UI Designer, alles.

Der Header zeigt euch immer, welches Projekt und welches Objekt gerade aktiv sind.

### Synchronisation mit lokalen Dateien

**Sprechtext:**  
Die Workbench liest eure lokalen Script-Dateien – also die `.gdl`-Dateien im HSF-Ordner des Objekts – und zeigt euch deren Inhalt direkt im Browser. Änderungen können direkt gespeichert und zurück in die Dateien geschrieben werden.

### Outro Teil 3

**Sprechtext:**  
Das aktive Objekt ist gewählt – jetzt können wir seine Parameter bearbeiten. Weiter zu Teil 4: der Parameterverwaltung.

---

## ⚙️ TEIL 4 – Parameterverwaltung

*(Screengrab: `param-management.html` geöffnet)*

### Einstieg

**Sprechtext:**  
Die Parameterverwaltung ist das Herzstück der GDL Workbench. Hier definiert ihr alle Parameter eures GDL-Objekts – vollständig, mehrsprachig und mit allen GDL-spezifischen Eigenschaften.

### Tabellenansicht

**Sprechtext:**  
Die Parameter werden als bearbeitbare Tabelle dargestellt. Jede Zeile ist ein Parameter mit Name, Typ, Standardwert, Beschreibung und weiteren Eigenschaften.

Ihr könnt Zeilen direkt in der Tabelle bearbeiten – ein Klick in eine Zelle, Wert ändern, fertig. Die Änderung wird automatisch gespeichert.

### Sortierung per Drag & Drop

**Sprechtext:**  
Die Reihenfolge der Parameter bestimmt, wie sie im Archicad-Dialog erscheinen. Per Drag & Drop lassen sich die Zeilen einfach umordnen – zieht eine Zeile an die gewünschte Position.

### Mehrsprachige Beschreibungen

**Sprechtext:**  
Für jede Beschreibung könnt ihr Übersetzungen in fünf Sprachen hinterlegen: Deutsch, Englisch, Französisch, Spanisch und Italienisch. Das ist besonders wichtig für internationale Objekte oder Büros, die mit mehrsprachigen Archicad-Installationen arbeiten.

### Wertelisten: VALUES und VALUES{2}

**Sprechtext:**  
Möchtet ihr einem Parameter eine feste Auswahlliste geben, nutzt ihr die VALUES-Funktion. Die Workbench unterstützt sowohl einfache Wertelisten als auch image-basierte Listen mit `VALUES{2}`. Alles wird direkt im Panel konfiguriert.

### XML-Import und Export

**Sprechtext:**  
Habt ihr bereits eine `Parameters.xml` aus Archicad exportiert, könnt ihr sie direkt importieren. Die Workbench liest alle Parameter ein und füllt die Tabelle automatisch. Umgekehrt könnt ihr jederzeit exportieren und die XML zurück in Archicad importieren.

### Outro Teil 4

**Sprechtext:**  
Die Parameter sind definiert. Im nächsten Schritt gestalten wir die Benutzeroberfläche des GDL-Objekts – mit dem UI Designer.

---

## 🎨 TEIL 5 – UI Designer

*(Screengrab: `index.html` – UI Designer geöffnet)*

### Einstieg

**Sprechtext:**  
Der UI Designer ist das visuelle Werkzeug der GDL Workbench. Hier gestaltet ihr den Dialog, den der Nutzer in Archicad sieht, wenn er ein GDL-Objekt platziert oder editiert.

Ihr arbeitet direkt auf einem massstabsgetreuen Canvas – dem virtuellen Archicad-Dialogfenster.

### Konfiguration

**Sprechtext:**  
Zunächst legt ihr die Grundkonfiguration fest: Breite und Höhe des Dialogs in Pixeln, die Anzahl der Seiten und die Zielplattform – Windows oder Mac.

### Elemente per Drag & Drop platzieren

**Sprechtext:**  
Links in der Toolbox findet ihr alle verfügbaren UI-Elemente:

- **UI_INFIELD** – Eingabefeld, das mit einem Parameter verknüpft wird
- **UI_INFIELD mit Bild** – Bildauswahl-Feld
- **UI_OUTFIELD** – statischer Beschriftungstext
- **UI_BUTTON / UI_LINK** – Schaltfläche oder Link
- **UI_SEPARATOR** – Trennlinie
- **UI_RADIOBUTTON** – Optionsfeld für Wertauswahl
- **UI_PICT** – Bildelement

Zieht ein Element aus der Toolbox auf den Canvas, und es erscheint auf dem Dialog.

### Eigenschaften bearbeiten

**Sprechtext:**  
Ein Klick auf ein Element im Canvas öffnet rechts die Eigenschaften: Position, Größe, verknüpfter Parameter, Text, Stil und mehr. Alles könnt ihr dort präzise einstellen.

### Mehrseitige Dialoge

**Sprechtext:**  
Für komplexe Objekte mit vielen Parametern könnt ihr mehrere Seiten anlegen. Der Dialog bekommt dann Tabs, zwischen denen der Nutzer wechseln kann.

### GDL-Code generieren

**Sprechtext:**  
Der UI Designer generiert aus eurem Layout automatisch den GDL Interface Script-Code. Dieser kann direkt in den Script Editor übergeben oder als Datei exportiert werden.

### Outro Teil 5

**Sprechtext:**  
Das UI ist gestaltet. Jetzt schauen wir uns an, wie wir die GDL-Scripts direkt in der Workbench bearbeiten können.

---

## 📝 TEIL 6 – Skript Editor

*(Screengrab: `script-editor.html` geöffnet)*

### Einstieg

**Sprechtext:**  
Der Skript Editor ist ein vollwertiger Code-Editor direkt im Browser. Ihr braucht weder ArchiCAD noch einen externen Texteditor zu öffnen – alle GDL-Scripte eures Objekts sind hier zugänglich und bearbeitbar.

### Verfügbare Scripte

**Sprechtext:**  
Links in der Sidebar findet ihr alle Scripte eines GDL-Objekts:

- **Master Script** – wird als erstes ausgeführt, setzt globale Variablen
- **2D Script** – Grundrissdarstellung
- **3D Script** – dreidimensionale Darstellung
- **Parameter Script** – Parameterlogik und Abhängigkeiten
- **Interface Script** – Steuerung des UI-Dialogs
- **Properties Script** – Eigenschaftsfelder und Klassifikation
- **Forward Migration Script** – Abwärtskompatibilität beim Öffnen neuerer Objekte
- **Backward Migration Script** – Aufwärtskompatibilität

Zusätzlich gibt es den direkten Zugriff auf die `Parameters.xml`.

### Monaco Editor

**Sprechtext:**  
Der Editor selbst basiert auf **Monaco** – derselben Engine, die auch VSCode verwendet. Ihr bekommt Syntax-Highlighting für GDL, automatische Einrückung und alle gewohnten Tastenkürzel.

### Speichern und exportieren

**Sprechtext:**  
Mit dem Speichern-Button wird das Script in der Datenbank gesichert. Mit „Alle Dateien aktualisieren" werden alle Scripte gleichzeitig in die lokalen `.gdl`-Dateien auf eurem Rechner geschrieben – bereit für den nächsten Archicad-Build.

Mit „Reload from Files" ladet ihr umgekehrt den aktuellen Stand der Dateien zurück in die Datenbank – zum Beispiel nach einer Bearbeitung direkt in Archicad.

### Outro Teil 6

**Sprechtext:**  
Scripte bearbeiten war noch nie so komfortabel. Im nächsten Kapitel zeige ich euch die Codeschmiede – das intelligente Assistenzwerkzeug für GDL-Code-Generierung.

---

## 🔨 TEIL 7 – Codeschmiede

*(Screengrab: `codeschmiede.html` geöffnet)*

### Einstieg

**Sprechtext:**  
Die Codeschmiede ist das kreativste Werkzeug der GDL Workbench. Hier generiert ihr GDL-Code assistiert – ohne syntaktische Fehler, ohne Copy-Paste aus alten Scripten.

### GDL-Befehlsbaum

**Sprechtext:**  
Links seht ihr einen strukturierten Baum aller GDL-Befehle. Klickt ihr auf einen Befehl, öffnet sich rechts ein Formular – angepasst an die Parameter dieses Befehls.

Ob `LINE`, `RECT`, `CIRCLE`, `FOR`-Schleife oder `HOTSPOT2` – jeder Befehl hat sein eigenes Eingabeformular.

### Drei Eingabe-Modi

**Sprechtext:**  
Für jeden Befehl könnt ihr zwischen drei Modi wählen:

- **Manuell** – ihr gebt Variablennamen direkt ein
- **Parameter** – ihr wählt aus vorhandenen Parametern eures Objekts
- **Deklarieren** – ihr definiert neue Variablen, die gleichzeitig als Parameter angelegt werden

Das spart enorm viel Zeit, gerade bei komplexen 3D-Geometrien mit vielen Koordinaten.

### Snippets speichern

**Sprechtext:**  
Habt ihr eine Kombination aus Befehlen und Einstellungen, die ihr regelmäßig braucht? Speichert sie als Snippet. Snippets stehen euch jederzeit wieder zur Verfügung und können für andere Objekte wiederverwendet werden.

### Code übernehmen

**Sprechtext:**  
Mit einem Klick auf „In Script einfügen" wird der generierte Code direkt in den aktiven Script Editor übertragen. Kein Copy-Paste, kein Tippfehler.

### Globale Variablen-Einstellungen

**Sprechtext:**  
In der Sidebar der Codeschmiede könnt ihr außerdem die globalen Variablennamen festlegen – zum Beispiel den Namen der Epsilon-Variable, des Hotspot-Zählers oder der Schleifenvariablen. Das sorgt für Konsistenz über alle eurer Objekte hinweg.

### Outro Teil 7

**Sprechtext:**  
Die Codeschmiede macht GDL-Entwicklung schneller und sicherer. Im letzten Kapitel schauen wir uns an, wie ihr mit den Build Tasks den Entwicklungszyklus abschließt.

---

## ⚡ TEIL 8 – Build Tasks

*(Screengrab: `build-tasks.html` geöffnet)*

### Einstieg

**Sprechtext:**  
Build Tasks ist die Automatisierungszentrale der GDL Workbench. Hier führt ihr mit einem Klick alle wichtigen Konvertierungs- und Exportoperationen aus – direkt aus dem Browser heraus.

### Aufgaben-Kategorien

**Sprechtext:**  
Die verfügbaren Tasks sind in drei Gruppen gegliedert:

**Allgemeine Tasks:**
- **XML zu GSM (Alle)** – Konvertiert alle XML-Dateien eurer Objekte zu fertigen `.gsm`-Dateien, bereit für Archicad
- **GSM zu XML (Alle)** – Entpackt alle GSM-Dateien eures Projekts in editierbare XML/HSF-Verzeichnisse
- **LCF Container erstellen** – Packt alle Objekte in einen Archicad Library Container

**Ressourcen & Bilder:**
- **Picture.xml aktualisieren** – Erneuert die Bilddatei des Objekts aus den vorhandenen Bild-Ressourcen
- **SVG zu TIFF konvertieren** – Wandelt SVG-Vektorgrafiken in TIFF-Bitmaps um, wie GDL sie benötigt
- **Parameter CSV Export** – Exportiert alle Parameter tabellarisch als CSV-Datei

**HSF Konvertierung:**
- **GSM zu HSF (Alle)** – Entpackt `.gsm`-Dateien in das offene HSF-Format (editierbare Ordnerstruktur)
- **HSF zu GSM (Alle)** – Packt HSF-Ordner zurück in fertige `.gsm`-Dateien

### Build-Konsole

**Sprechtext:**  
Rechts seht ihr die Build-Konsole. Sie zeigt euch in Echtzeit, was bei der Ausführung passiert: Fortschritt, Fehlermeldungen, Erfolgsbestätigungen – alles colorcodiert und übersichtlich. Mit dem Kopier-Button könnt ihr den Log-Inhalt in die Zwischenablage übernehmen.

### Statusanzeige

**Sprechtext:**  
Der Status-Badge im Header zeigt euch jederzeit, ob ein Task läuft, abgeschlossen ist oder ein Fehler aufgetreten ist.

### Outro Teil 8 / Abschluss des gesamten Kurses

**Sprechtext:**  
Damit haben wir alle sieben Bereiche der GDL Workbench durchgearbeitet.

Von der Projektverwaltung über die Parameterdefinition, das UI-Design und das Script-Editing bis hin zur automatisierten Konvertierung – die GDL Workbench begleitet euch durch den gesamten Entwicklungsprozess für Archicad GDL-Objekte.

Wenn euch dieser Kurs gefallen hat, freue ich mich über euer Feedback. Die GDL Workbench ist ein lebendiges Projekt – mit regelmäßigen Updates und neuen Features.

Viel Erfolg bei eurer GDL-Entwicklung!

---

*© 2026 b-prisma® – Joachim Suehlo*
