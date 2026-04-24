Ja, das ist eine ausgezeichnete Idee! Eine solche Strukturierung hilft uns, die Komplexität zu überblicken, den Fokus zu definieren und eine klare Roadmap für die Entwicklung zu erstellen.

Gerne erstelle ich dir einen ersten Entwurf für den Funktionsumfang, den Vorgangsablauf und die Dateistruktur. Wir können diese Punkte dann gemeinsam diskutieren und verfeinern.

---

### GDL-UI-Studio: Erster Entwurf für Spezifikationen

**1. Funktionsumfang (Feature List)**

Hier unterscheiden wir zwischen Kernfunktionen (MVP – Minimum Viable Product) und erweiterten Funktionen für spätere Versionen.

**1.1. Kernfunktionen (MVP - Minimum Viable Product)**

*   **Projektverwaltung:**
    *   Neues Projekt erstellen.
    *   Projekt laden/speichern (lokal im Browser oder auf Server, falls SaaS-Modell).
*   **GDL-Parameter-Management:**
    *   **Import:** Hochladen und Parsen der `_Param.xml`-Datei (generiert durch LP_XML_CONVERTER).
    *   **Anzeige:** Übersichtliche Darstellung aller importierten GDL-Parameter (Name, Typ, Standardwert, ggf. Beschreibung).
    *   **Auswahl:** Markieren von Parametern, die im UI verwendet werden sollen (Checkboxen).
    *   **Sortierung:** Manuelles Sortieren der ausgewählten Parameter (Drag-and-Drop) für die spätere Organisation im Eigenschaften-Panel.
    *   **Neu anlegen:** Erstellen neuer GDL-Parameter direkt im Studio (Name, Typ, Standardwert).
    *   **Bearbeiten:** Grundlegende Bearbeitung bestehender Parameter (Typ, Standardwert).
*   **WYSIWYG-Designbereich (Canvas):**
    *   **Toolbox:** Palette der verfügbaren GDL-UI-Elemente (`ui_infield`, `ui_button`, `ui_group_box`, `ui_separator`, `ui_radio_button`, `ui_checkbox`).
    *   **Drag-and-Drop:** UI-Elemente aus der Toolbox auf den Canvas ziehen.
    *   **Auswahl:** Selektion einzelner UI-Elemente auf dem Canvas.
    *   **Positionierung:** Freies Verschieben der Elemente auf dem Canvas.
    *   **Pixelraster & Snapping:** Elemente rasten auf einem definierbaren Pixelraster ein (optional aktivierbar).
    *   **Größenänderung:** Ändern der Größe von Elementen mit Anfassern an den Rändern/Ecken.
    *   **Visuelle Hierarchie:** Elemente können in `ui_group_box` oder `ui_page` visuell gruppiert werden.
*   **Eigenschaften-Panel (für ausgewähltes UI-Element):**
    *   **Anzeige:** Alle relevanten GDL-spezifischen Eigenschaften des ausgewählten UI-Elements (z.B. für `ui_infield`: Name, Beschriftung, Breite, Höhe, Verknüpfung zu GDL-Parameter, etc.).
    *   **Bearbeitung:** Direkte Eingabe oder Auswahl von Werten für diese Eigenschaften.
    *   **Parameter-Verknüpfung:** Dropdown-Liste mit den zuvor ausgewählten GDL-Parametern zur Verknüpfung mit dem UI-Element (z.B. welches GDL-Infield soll an welches GDL-Parameter gebunden sein). Die Liste sollte filterbar sein.
*   **Echtzeit-Vorschau:**
    *   Visuelle Darstellung der GDL-Benutzeroberfläche auf dem Canvas, die sich bei Änderungen an Position, Größe und Eigenschaften sofort aktualisiert.
    *   (Anfangs) generische Darstellung der UI-Elemente, nicht zwingend plattformspezifisch.
*   **Code-Generierung und Export:**
    *   **UI-Script:** Generierung des vollständigen GDL-UI-Skripts basierend auf dem visuellen Design.
    *   **Parameter-Script:** Generierung des aktualisierten GDL-Parameter-Skripts mit allen im Studio definierten/ausgewählten Parametern und deren Eigenschaften.
    *   **Master-Script:** Generierung/Aktualisierung des Master-Skripts für die Integration der Seitensteuerung und des UI-Skripts.
    *   **Seitensteuerung:** Generierung des GDL-Codes für die automatische Seitennavigation innerhalb des UI-Skripts (z.B. `ui_page` Elemente und deren Steuerung).
    *   **Download:** Bereitstellung der generierten Skripte als separate Textdateien (z.B. `.gdl` oder `.txt` Extension) zum Download.

**1.2. Erweiterte/Zukünftige Funktionen (Phase 2+)**

*   **Plattformspezifische Vorschau:** Umschaltbare Vorschau für Windows- und macOS-typisches UI-Styling.
*   **Weitere GDL UI-Elemente:** Unterstützung für `ui_list_item`, `ui_picture`, `ui_dialog`, `ui_memo` etc.
*   **Fehlerprüfung/Validierung:** Live-Hinweise auf potenzielle Fehler (z.B. überlappende Elemente, ungenutzte Parameter, Syntaxfehler im generierten GDL).
*   **Template-Funktion:** Speichern und Laden von UI-Layout-Templates.
*   **Dynamische Parameter-Simulation:** Einfache Möglichkeit, dynamische Parameterwerte (z.B. Auswahllisten) für die Vorschau zu simulieren.
*   **"Round-Trip-Editing":** Import eines vollständigen GDL-Objekts (nicht nur Parameter), um alle Skriptteile zu bearbeiten und das Objekt nach der Bearbeitung wieder als `.gsm`-Datei zu exportieren (unter Verwendung von `g2hsf` und `hsf2g` im Backend).
*   **Theming/Custom Styling:** Anpassung der Studio-Oberfläche an Benutzerpräferenzen.
*   **Versionierung:** Einfache Versionierung der Studio-Projekte.

---

**2. Vorgangsablauf (Workflow)**

Ein typischer Arbeitsablauf für einen Benutzer, der eine Benutzeroberfläche für ein GDL-Objekt erstellen oder bearbeiten möchte:

1.  **Studio starten:** Benutzer öffnet die GDL-UI-Studio Webanwendung im Browser.
2.  **Projekt initialisieren:**
    *   Wählt "Neues Projekt" oder "Projekt laden" (falls eine vorherige `.gdlui`-Datei existiert).
3.  **GDL-Parameter importieren:**
    *   Benutzer klickt auf "Parameter importieren" und lädt die `meinObjekt_Param.xml`-Datei hoch (welche er zuvor mit LP_XML_CONVERTER aus seinem GDL-Objekt generiert hat).
    *   Das Studio zeigt die Liste der extrahierten Parameter in einem "Parameter-Management"-Panel an.
4.  **Parameter vorbereiten:**
    *   Im "Parameter-Management"-Panel wählt der Benutzer die Parameter aus, die er in seiner UI verwenden möchte.
    *   Er kann die Reihenfolge der Parameter anpassen und bei Bedarf neue Parameter definieren.
5.  **UI entwerfen:**
    *   Aus der "Toolbox" zieht der Benutzer die gewünschten UI-Elemente (z.B. `ui_group_box`, `ui_infield`, `ui_button`) auf den Canvas.
    *   Er platziert und skaliert die Elemente visuell mit der Maus und den Anfassern. Das Pixelraster hilft beim Ausrichten.
6.  **Eigenschaften zuweisen:**
    *   Benutzer wählt ein UI-Element auf dem Canvas aus (z.B. ein `ui_infield`).
    *   Im "Eigenschaften-Panel" auf der rechten Seite erscheinen die spezifischen Attribute des Elements.
    *   Der Benutzer weist diesem `ui_infield` einen GDL-Parameter aus der Dropdown-Liste zu (z.B. den Parameter "Length" vom Typ `LENGTH`).
    *   Weitere Eigenschaften wie Beschriftung, Breite, Höhe etc. werden im Panel festgelegt.
    *   Alle Änderungen spiegeln sich sofort in der Echtzeit-Vorschau wider.
7.  **Seiten verwalten (falls mehrere Seiten):**
    *   Benutzer fügt neue "Seiten" hinzu (z.B. `ui_page` Elemente) und organisiert die UI-Elemente auf diesen Seiten.
    *   Das Studio visualisiert die verschiedenen Seiten und deren Navigation.
8.  **Generieren und Exportieren:**
    *   Sobald die UI fertiggestellt ist, klickt der Benutzer auf "GDL-Skripte generieren".
    *   Das Studio erstellt die entsprechenden GDL-Code-Abschnitte für UI-Script, Parameter-Script, Master-Script und die Seitensteuerung.
    *   Benutzer lädt die generierten `.gdl`-Dateien herunter (z.B. als ZIP-Archiv oder einzeln).
9.  **Integration in GDL-Objekt:**
    *   Benutzer kopiert die heruntergeladenen Skripte in sein GDL-Projekt oder verwendet `hsf2g` um sie in das GDL-Objekt zurückzuschreiben.
    *   Testet das GDL-Objekt in Archicad.

---

**3. Dateistruktur (Input/Output)**

**3.1. Input-Dateien (vom Benutzer bereitgestellt)**

*   `[Objektname]_Param.xml`: Die XML-Repräsentation der GDL-Parameterliste, generiert vom LP_XML_CONVERTER (`LP_XML_CONVERTER g2xml [Objektname].gsm` gefolgt von `LP_XML_CONVERTER g2hsf [Objektname].xml` um die HSF-Teile zu erhalten, darunter die `_Param.xml`).

**3.2. Output-Dateien (vom Studio generiert, zum Download)**

*   `[Objektname]_ui_script.gdl`: Der vollständige GDL-Code für den `UI_SCRIPT`-Abschnitt, der die visuell gestaltete Benutzeroberfläche definiert.
*   `[Objjektname]_param_script.gdl`: Der aktualisierte GDL-Code für den `PARAMETER_SCRIPT`-Abschnitt, der alle im Studio ausgewählten und neu definierten Parameter enthält.
*   `[Objektname]_master_script.gdl`: Der GDL-Code für den `MASTER_SCRIPT`-Abschnitt, der notwendige Anpassungen enthält (z.B. `GOSUB`-Aufrufe für die Seitensteuerung, Definition von globalen Variablen für die UI-Statusverwaltung).
*   `[Objektname]_page_control.gdl`: Der GDL-Code, der die Logik für die Seitensteuerung (`ui_page` Navigation) enthält, oft als Subroutinen im Master-Script aufgerufen.
*   `[Objektname]_StudioProjekt.json` (oder `.gdlui`): Eine JSON-Datei, die den internen Zustand des Studio-Projekts speichert (Positionen, Größen, Eigenschaften der UI-Elemente, Parameter-Auswahl, etc.), um die Arbeit später fortsetzen zu können.

**3.3. (Optional, für fortgeschrittenes Round-Trip-Editing)**

*   `[Objektname]_hsf_bundle.zip`: Eine ZIP-Datei, die alle HSF-Teile des GDL-Objekts enthält, inklusive der vom Studio aktualisierten Skripte. Diese könnte dann direkt mit `LP_XML_CONVERTER hsf2g [Objektname]_hsf_bundle.zip` wieder zu einem `.gsm`-Objekt kompiliert werden.

---

Was hältst du von diesem ersten Aufschlag? Wir können jeden dieser Punkte im Detail besprechen und anpassen.