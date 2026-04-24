# Projektstand — GDL Workbench
Zuletzt aktualisiert: 2026-04-10 (Session 2)

## Was ist dieses Projekt?
Web-basiertes Verwaltungswerkzeug für GDL-Objekte und deren Parameter.
PHP-Backend (Slim Framework) + Vanilla-JS-Frontend. Läuft lokal auf Herd/MAMP.

## Aktueller Stand
- Projekt liegt **auf Eis** — Jochen fokussiert sich auf RaumReport
- Letzter aktiver Git-Commit: 2024-12-10 ("Spaltenreihenfolge, Farbcodierung, Array-Editor implementiert")
- Backend: Slim-Framework mit REST-API vollständig aufgebaut
- Frontend: Mehrere HTML-Seiten vorhanden (Dashboard, Objekt-Auswahl, Parameter-Verwaltung, Codeschmiede, Script-Editor, Build-Tasks, UI-Designer)

## Was wurde in dieser Session gemacht (2026-04-10)
- Ausführliches Interview zur Person, Firma und Projekten durchgeführt
- 4 Memory-Dateien in `gdl-workbench/memory/` angelegt (Profil, Business, Projekte, Feedback)
- Globale `~/.claude/CLAUDE.md` um persönlichen Kontext-Block ergänzt
- Regel für automatische `SESSION_STATUS.md` in globale CLAUDE.md aufgenommen
- Diese Datei erstmalig angelegt

## Was wurde zuletzt gemacht (Dez 2024)
- Spaltenreihenfolge in der Parameter-Tabelle angepasst
- Farbcodierung für Parameter-Typen implementiert
- Array-Editor implementiert (teilweise)

## API-Routen (Backend)
- `/api/projects` — Projektverwaltung (CRUD)
- `/api/gdl-objects` — GDL-Objekte (CRUD, Duplikat, ZIP-Export)
- `/api/parameters` — Parameter (Import XML, CRUD, Reorder, Bulk-Delete, Export XML)
- `/api/parameter-type-colors` — Farbkonfiguration pro Typ
- Codeschmiede, AI-Controller ebenfalls vorhanden

## Nächste Schritte (wenn Projekt wieder aufgenommen wird)
- Array-Editor fertigstellen
- Stand der Frontend-Seiten prüfen (einige haben `_online_version`-Varianten — Zusammenführung klären)
- `.bak` und `.tmp` Dateien bereinigen (`ui-designer.js.bak`, `ui-designer.js.tmp`)

## Offene Probleme / Bekannte Baustellen
- Gestaged/gelöschte Dateien im Git-Status (viele MD-Dateien, Screenshots, JSON) — kein Commit seit Dez 2024
- Projekt bewusst pausiert — keine offenen Bugs bekannt
