# Wohnungsplaner für den Commodore Amiga

Ein Grundriss-Editor in **AmigaBASIC** – läuft auf jedem Amiga (A500/A1000/A2000/…,
OS 1.x bis 3.x), denn AmigaBASIC lag jeder AmigaOS-Version auf der Diskette **„Extras“** bei.
Ein nackter Amiga kann kein HTML/JavaScript ausführen, deshalb gibt es hier die
AmigaBASIC-Portierung.

## Dateien

- `Wohnungsplaner.bas` – das Programm (AmigaBASIC-Listing, ASCII-Text)
- `Wohnungsplaner.adf` – fertiges 880-KB-ADF-Disk-Image (AmigaDOS OFS) mit der Datei `WOHNUNGSPLANER.BAS`
- `make_adf.py` – Skript, mit dem das ADF erzeugt und verifiziert wurde

## Variante A: Emulator (FS-UAE, WinUAE, …)

1. `Wohnungsplaner.adf` als DF0: einlegen
2. Amiga booten (Workbench + AmigaBASIC von der Extras-Disk)
3. Im CLI/Shell:
   ```
   LOAD "WOHNUNGSPLANER.BAS"
   RUN
   ```

## Variante B: Echter Amiga mit Diskettenlaufwerk

1. `Wohnungsplaner.adf` mit einem Tool wie **ADF Opus**, **EasyADF**, KryoFlux/Greaseweazle
   oder `xdftool` auf eine echte DD-Diskette (880 KB) schreiben
2. Diskette einlegen, Amiga mit Workbench booten
3. AmigaBASIC von der Extras-Disk starten, dann:
   ```
   LOAD "DF0:WOHNUNGSPLANER.BAS"
   RUN
   ```

## Bedienung

- **Mausklick** zeichnet (je nach Werkzeug)
- Tasten (im Statusfenster oben angezeigt):
  - `1` Wand zeichnen (2 Klicks: Anfang/Ende) – mit Längenangabe in m
  - `2` Raum zeichnen (2 Klicks = gegenüberliegende Ecken) – mit Fläche in m²
  - `3` Möbel platzieren (F wählt das nächste Möbel aus der Liste, inkl. Zimmerpflanzen)
  - `4` Löschen (Klick auf Wand/Raum)
  - `B` Bemaßungslinien an/aus, `M` komplette Maßliste, `+`/`-` Zoom
  - `S` speichern / `L` laden (als `DF0:WPPLAN.TXT`), `N` neuer Plan, `Q` Ende
- Koordinaten in Metern, Rasterfang 10 cm; Möbel-Abmessungen (Breite × Länge) erscheinen
  im Statusfenster bzw. in der Maßliste (Taste `M`)

## Hinweise

- Falls die Maus-Koordinaten auf einem echten Amiga versetzt sind: in Zeile 120 des
  Listings `MX0`/`MY0` anpassen.
- Das ADF wurde maschinell erzeugt und verifiziert (Bootblock-, Rootblock-, Bitmap-,
  Datei-Header- und Datenblock-Checksummen, Hash-Tabelle, Datei-Inhalt byte-identisch).
  Zum erneuten Bauen: `python3 make_adf.py Wohnungsplaner.bas Wohnungsplaner.adf`
