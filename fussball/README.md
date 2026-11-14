# Pixel-Fussball (Amiga-Stil)

Top-Down-Fußballspiel im Stil von Sensible Soccer auf dem Commodore Amiga –
komplett im Browser, reines HTML/CSS/JavaScript ohne Installation und ohne
externe Abhängigkeiten.

## Starten

`index.html` direkt im Browser öffnen (Doppelklick reicht) oder:

```bash
cd fussball
python3 -m http.server 8000
```

Dann im Browser öffnen: <http://localhost:8000>

## Steuerung

| Taste | Aktion |
| --- | --- |
| Pfeiltasten / WASD | Laufen (der aktive Spieler wechselt automatisch zum ballnächsten Spieler, weißer Pfeil) |
| Leertaste | Passen in Laufrichtung (schießt automatisch aufs Tor, wenn kein Mitspieler in Richtung steht) |
| Shift oder X | Schießen aufs Tor |
| M | Ton an/aus |
| P | Pause |

## Spielweise

- 5 gegen 5 (1 Torwart + 4 Feldspieler), zwei Halbzeiten à 45 Spielminuten
  (1 Sekunde Echtzeit = 1 Spielminute)
- Kamera folgt dem Ball mit etwas Vorhalt, wie beim Original
- Tore, Einwürfe, Eckstöße und Abstöße werden automatisch ausgeführt
- Der Ball haftet am Fuß des ballführenden Spielers; Gegner können ihn durch
  Kontakt abnehmen
- Torsause, Publikumsgeräusch und Pfiff als einfache WebAudio-Klänge (erst nach
  der ersten Tasteneingabe, damit der Browser sie erlaubt)

## Dateien

- `index.html` – Aufbau der Seite
- `style.css` – Darstellung (Scanlines, Pixel-Skalierung)
- `game.js` – komplette Spiellogik (320×256 Low-Res-Canvas, Pixel-Font,
  Spielfeld-Rendering, Physik, KI, HUD, Sound)
