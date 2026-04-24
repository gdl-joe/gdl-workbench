# GDL-UI-Studio - Quick Start Guide

## 🚀 Schnellstart

### 1. Dashboard öffnen
Öffnen Sie im Browser:
```
http://localhost:8888/gdl-ui-studio/public/dashboard.html
```

### 2. Arbeitsablauf

#### A. Neues Projekt erstellen
1. Klicken Sie auf **"➕ Neues Projekt"**
2. Geben Sie Projektname ein
3. Klicken Sie auf die Projektkarte zum Öffnen

#### B. Neues Objekt erstellen
1. Sie werden zur Objektauswahl weitergeleitet
2. Klicken Sie auf **"➕ Neues Objekt"**
3. Geben Sie Objektname ein (z.B. "Fenster_01.gsm")
4. Klicken Sie auf die Objektkarte zum Öffnen

#### C. Parameter verwalten
1. Sie werden zur Parameterverwaltung weitergeleitet
2. Oben sehen Sie: 📁 Projektname 📄 Objektname

**Parameter hinzufügen**:
- Klicken Sie **"➕ Neuen Parameter hinzufügen"**
- Oder: **"⬇️ Nach Auswahl einfügen"** (nach ausgewählter Zeile)

**Parameter bearbeiten**:
- Klicken Sie direkt in die Tabellenzelle
- Änderungen werden **automatisch gespeichert** ✓
- Keine Save-Button notwendig!

**Parameter löschen**:
- Checkbox anhaken
- Klicken Sie **"🗑️ Ausgewählte löschen"**

**Parameter sortieren**:
- Ziehen Sie Zeilen mit dem Handle (⋮⋮)
- Reihenfolge wird automatisch gespeichert

## ✨ Neue Features

### Auto-Save
- Alle Änderungen werden sofort gespeichert
- Kein manuelles Speichern mehr nötig
- Status zeigt: "✓ Automatisch gespeichert"

### Parameter an Position einfügen
1. Klicken Sie auf eine Zeile (wird aktiv)
2. Klicken Sie **"⬇️ Nach Auswahl einfügen"**
3. Neuer Parameter erscheint **nach** dieser Zeile

### Farbcodierung
- Jeder Parametertyp hat eine eigene Farbe
- Farbiger Indikator (■) neben Typ-Auswahl
- Bessere Übersicht in großen Listen

### Projekt/Objekt duplizieren
- **Dashboard**: Klicken Sie "📋 Duplizieren" auf Projektkarte
- **Objektauswahl**: Klicken Sie "📋 Duplizieren" auf Objektkarte
- Alle Parameter werden mitkopiert!

### Status-Management
- **Aktiv** (grün): Aktuelle Arbeitsprojekte
- **WIP** (orange): Work in Progress
- **Dringend** (rot): Hohe Priorität
- **Archiv** (grau): Abgeschlossene Projekte

## 🎨 Navigation

```
[Projektverwaltung] → Dashboard mit allen Projekten
[Objektverwaltung]  → Objekte des aktuellen Projekts
[Parameterverwaltung] → Parameter des aktuellen Objekts
[UI Designer]       → (zukünftig)
```

## 💡 Tipps

### Schnell navigieren
- Klicken Sie auf **"Projektverwaltung"** um zum Dashboard zurückzukehren
- Klicken Sie auf **"Objektverwaltung"** um Objekt zu wechseln

### Suchen & Filtern
- Nutzen Sie die Suchleiste oben
- Filtern Sie nach Status (Alle, Aktiv, WIP, Dringend, Archiv)
- In Parameterverwaltung: Filtern nach Name oder Beschreibung

### Ordnerpfad verknüpfen
- **Dashboard**: Bearbeiten → Ordnerpfad eingeben
- **Objektauswahl**: Bearbeiten → Dateipfad eingeben
- Ermöglicht später automatische Synchronisation

### XML Import/Export
- **Import**: XML-Datei hochladen → Parameter werden automatisch erstellt
- **Export**: Download-Button → XML-Datei mit allen Parametern

## 🔑 Keyboard Shortcuts

- **Tab**: Nächstes Feld in Tabelle
- **Enter**: Bestätigen & nächste Zeile
- **Escape**: Bearbeitung abbrechen

## ⚡ Häufige Aktionen

### Projekt anlegen und bearbeiten
```
Dashboard → Neues Projekt → Name eingeben → 
Projekt öffnen → Neues Objekt → Name eingeben → 
Parameter hinzufügen → Direkt bearbeiten (Auto-Save!)
```

### Bestehende Projekte bearbeiten
```
Dashboard → Projekt-Karte klicken → 
Objekt-Karte klicken → 
Parameter bearbeiten
```

### Parameter importieren
```
Parameterverwaltung → 📥 XML Parameter Import → 
Datei auswählen → Fertig!
```

## 🐛 Problemlösung

### "Kein Objekt geladen"
→ Wählen Sie Projekt und Objekt über die Navigation

### Parameter werden nicht gespeichert
→ Prüfen Sie: Ist MAMP gestartet?
→ Testen Sie: http://localhost:8888/gdl-ui-studio/backend/public/api/projects

### Farben werden nicht angezeigt
→ Seite neu laden (Strg+R / Cmd+R)

## 📱 Browser-Empfehlung

Getestet mit:
- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari
- ✅ Edge

## 🎯 Nächste Schritte

1. **Erkunden Sie das Dashboard** - alle Projekte im Überblick
2. **Erstellen Sie ein Test-Projekt** - lernen Sie die Features kennen
3. **Importieren Sie XML-Daten** - schneller Start mit bestehenden Daten
4. **Nutzen Sie Auto-Save** - einfach bearbeiten, ohne ans Speichern zu denken

---

**Viel Erfolg! 🚀**

Bei Fragen: Siehe `AGENTS.md` für vollständige Dokumentation
