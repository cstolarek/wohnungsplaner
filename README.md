# Wohnungsplaner

Eigenständiger Grundriss-Editor als Web-App – komplett im Browser, ohne Installation
und ohne externe Abhängigkeiten (reines HTML/CSS/JavaScript).

## Starten

```bash
cd wohnungsplaner
python3 -m http.server 8000
```

Dann im Browser öffnen: <http://localhost:8000>

(Direktes Öffnen der `index.html` per Doppelklick funktioniert ebenfalls in den gängigen Browsern.)

## Funktionen

- **Wände zeichnen** – zwei Punkte klicken/ziehen; achsiale Ausrichtung rastet automatisch ein (Rasterfang 10 cm)
- **Räume anlegen** – Rechteck aufziehen, mit Name und automatischer Flächenangabe in m²
- **Türen und Fenster** – per Klick in eine bestehende Wand einsetzen (werden als Aussparung mit Symbol gezeichnet)
- **Möbel platzieren** – aus der Bibliothek (Bett, Sofa, Küchenzeile, Badewanne …) per Klick setzen, verschieben und um 90° drehen
- **Verschieben & Zoomen** – Elemente per Drag verschieben, Mausrad zoomt um den Mauszeiger, mittlere Maustaste/Leertaste verschiebt die Ansicht
- **Eigenschaften** – Raumname, Wanddicke und Öffnungsbreite bearbeiten; Flächen und Gesamtfläche werden live angezeigt
- **Speichern & Laden** – automatisch im Browser (localStorage), plus JSON-Export/Import und PNG-Export des gesamten Grundrisses

## Tastenkürzel

| Taste | Aktion |
| --- | --- |
| V / W / R / T / F / M / E / H | Werkzeug wechseln (Auswählen, Wand, Raum, Tür, Fenster, Möbel, Löschen, Hand) |
| Entf | Auswahl löschen |
| D | Möbel drehen |
| Esc | Zeichnen/Auswahl abbrechen |
| Strg+S | Speichern |

## Dateien

- `index.html` – Aufbau der Oberfläche
- `style.css` – Gestaltung
- `app.js` – gesamte Anwendungslogik (Canvas-Rendering, Werkzeuge, Persistenz)

Pläne werden als JSON im localStorage des Browsers abgelegt und können als JSON-Datei
exportiert/importiert werden.
