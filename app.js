'use strict';
(() => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const statusEl = document.getElementById('status');
  const propsEl = document.getElementById('props');
  const paletteEl = document.getElementById('palette');
  const statsEl = document.getElementById('plan-stats');
  const planNameEl = document.getElementById('plan-name');
  const wrapEl = document.getElementById('canvas-wrap');
  const dpr = window.devicePixelRatio || 1;
  const LS_KEY = 'wohnungsplaner.v1';
  const GRID = 0.1;

  const FURNITURE = [
    { type: 'bett', name: 'Bett 160×200', w: 1.6, h: 2.0, color: '#dbeafe' },
    { type: 'doppelbett', name: 'Doppelbett 180×200', w: 1.8, h: 2.0, color: '#dbeafe' },
    { type: 'einzelbett', name: 'Einzelbett 90×200', w: 0.9, h: 2.0, color: '#dbeafe' },
    { type: 'sofa', name: 'Sofa 220×90', w: 2.2, h: 0.9, color: '#fecaca' },
    { type: 'sessel', name: 'Sessel 80×80', w: 0.8, h: 0.8, color: '#fecaca' },
    { type: 'esstisch', name: 'Esstisch 160×90', w: 1.6, h: 0.9, color: '#fef3c7' },
    { type: 'stuhl', name: 'Stuhl 45×45', w: 0.45, h: 0.45, color: '#fef3c7' },
    { type: 'schreibtisch', name: 'Schreibtisch 140×70', w: 1.4, h: 0.7, color: '#fef3c7' },
    { type: 'schrank', name: 'Schrank 120×60', w: 1.2, h: 0.6, color: '#e7d8c9' },
    { type: 'kleiderschrank', name: 'Kleiderschrank 180×60', w: 1.8, h: 0.6, color: '#e7d8c9' },
    { type: 'kommode', name: 'Kommode 100×50', w: 1.0, h: 0.5, color: '#e7d8c9' },
    { type: 'buecherregal', name: 'Bücherregal 100×30', w: 1.0, h: 0.3, color: '#e7d8c9' },
    { type: 'kuechenzeile', name: 'Küchenzeile 300×60', w: 3.0, h: 0.6, color: '#d1d5db' },
    { type: 'herd', name: 'Herd 60×60', w: 0.6, h: 0.6, color: '#9ca3af' },
    { type: 'kuehlschrank', name: 'Kühlschrank 70×70', w: 0.7, h: 0.7, color: '#e5e7eb' },
    { type: 'spuele', name: 'Spüle 80×60', w: 0.8, h: 0.6, color: '#bae6fd' },
    { type: 'badewanne', name: 'Badewanne 170×75', w: 1.7, h: 0.75, color: '#bae6fd' },
    { type: 'dusche', name: 'Dusche 90×90', w: 0.9, h: 0.9, color: '#bae6fd' },
    { type: 'wc', name: 'WC 40×70', w: 0.4, h: 0.7, color: '#e5e7eb' },
    { type: 'waschbecken', name: 'Waschbecken 60×50', w: 0.6, h: 0.5, color: '#bae6fd' },
    { type: 'tv', name: 'TV-Regal 120×10', w: 1.2, h: 0.1, color: '#111827' },
    { type: 'teppich', name: 'Teppich 200×150', w: 2.0, h: 1.5, color: '#f5f5f4' },
    { type: 'pflanze', name: 'Pflanze 40×40', w: 0.4, h: 0.4, color: '#bbf7d0' }
  ];

  const ROOM_COLORS = ['#fef9c3', '#fce7f3', '#dbeafe', '#dcfce7', '#ede9fe', '#ffedd5', '#cffafe', '#fee2e2'];

  function freshState() {
    return { meta: { name: 'Mein Grundriss' }, walls: [], rooms: [], furniture: [], openings: [], nextId: 1 };
  }

  let state = freshState();
  let view = { scale: 30, panX: 60, panY: 60 };
  let tool = 'select';
  let selected = null;
  let drawing = null;
  let drag = null;
  let panning = null;
  let spaceDown = false;
  let furniturePick = null;

  const uid = () => 'id' + state.nextId++;
  const snap = v => Math.round(v / GRID) * GRID;
  const snapPt = p => ({ x: snap(p.x), y: snap(p.y) });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const wallLen = w => dist({ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
  const toWorld = (v, sx, sy) => ({ x: (sx - v.panX) / v.scale, y: (sy - v.panY) / v.scale });
  const toScreen = (v, wx, wy) => ({ x: wx * v.scale + v.panX, y: wy * v.scale + v.panY });
  const fontFor = (v, base) => Math.max(8, Math.round(base * v.scale / 30)) + 'px system-ui, sans-serif';

  function distToSeg(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    let t = l2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  function projectOnSeg(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    let t = l2 === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return { t, point: { x: a.x + t * dx, y: a.y + t * dy } };
  }

  const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  const furnDims = f => (f.rot % 180 === 0 ? { w: f.w, h: f.h } : { w: f.h, h: f.w });
  const furnRect = f => { const d = furnDims(f); return { x: f.x - d.w / 2, y: f.y - d.h / 2, w: d.w, h: d.h }; };
  function roomAt(p) {
    for (let i = state.rooms.length - 1; i >= 0; i--) if (inRect(p, state.rooms[i])) return state.rooms[i];
    return null;
  }

  let statusTimer = null;
  function setStatus(msg) {
    statusEl.textContent = msg;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { statusEl.textContent = ''; }, 3500);
  }

  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* Speicher voll oder nicht verfügbar */ }
  }

  function load() {
    try {
      const s = localStorage.getItem(LS_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (p && p.meta && Array.isArray(p.walls) && Array.isArray(p.rooms)) {
          state = p;
          selected = null;
        }
      }
    } catch (e) { /* beschädigte Daten ignorieren */ }
  }

  function axisSnap(a, b) {
    const l = dist(a, b);
    if (l === 0) return b;
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const snapped = Math.round(ang / (Math.PI / 2)) * (Math.PI / 2);
    if (Math.abs(ang - snapped) < 0.09) {
      return { x: a.x + Math.cos(snapped) * l, y: a.y + Math.sin(snapped) * l };
    }
    return b;
  }

  function wallVec(w) {
    const a = { x: w.x1, y: w.y1 }, b = { x: w.x2, y: w.y2 };
    const len = dist(a, b) || 1;
    return { a, b, len, ux: (b.x - a.x) / len, uy: (b.y - a.y) / len };
  }

  function drawGrid(g, v, cw, ch) {
    const tl = toWorld(v, 0, 0), br = toWorld(v, cw, ch);
    g.lineWidth = 1;
    for (let i = Math.floor(tl.x / 0.5); i <= Math.ceil(br.x / 0.5); i++) {
      const s = toScreen(v, i * 0.5, 0).x;
      g.strokeStyle = i % 2 === 0 ? '#e5e7eb' : '#f3f4f6';
      g.beginPath(); g.moveTo(s, 0); g.lineTo(s, ch); g.stroke();
    }
    for (let i = Math.floor(tl.y / 0.5); i <= Math.ceil(br.y / 0.5); i++) {
      const s = toScreen(v, 0, i * 0.5).y;
      g.strokeStyle = i % 2 === 0 ? '#e5e7eb' : '#f3f4f6';
      g.beginPath(); g.moveTo(0, s); g.lineTo(cw, s); g.stroke();
    }
    const ox = toScreen(v, 0, 0).x, oy = toScreen(v, 0, 0).y;
    g.strokeStyle = '#d1d5db';
    g.beginPath(); g.moveTo(ox, 0); g.lineTo(ox, ch); g.stroke();
    g.beginPath(); g.moveTo(0, oy); g.lineTo(cw, oy); g.stroke();
  }

  function drawRoom(g, v, r) {
    const s = toScreen(v, r.x, r.y);
    const w = r.w * v.scale, h = r.h * v.scale;
    g.fillStyle = r.color + 'cc';
    g.fillRect(s.x, s.y, w, h);
    g.strokeStyle = '#94a3b8';
    g.setLineDash([4, 3]);
    g.lineWidth = 1;
    g.strokeRect(s.x, s.y, w, h);
    g.setLineDash([]);
    g.fillStyle = '#334155';
    g.font = fontFor(v, 12);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const cx = s.x + w / 2, cy = s.y + h / 2;
    g.fillText(r.name, cx, cy - 8);
    g.fillText((r.w * r.h).toFixed(1) + ' m²', cx, cy + 8);
  }

  function drawWall(g, v, w) {
    const { a, ux, uy, len } = wallVec(w);
    const t = w.thickness;
    const ops = state.openings.filter(o => o.wallId === w.id).sort((p, q) => p.offset - q.offset);
    let cursor = 0;
    const solid = [];
    for (const o of ops) {
      const s0 = o.offset - o.width / 2, s1 = o.offset + o.width / 2;
      if (s0 > cursor + 0.001) solid.push([cursor, s0]);
      cursor = Math.max(cursor, s1);
    }
    if (cursor < len - 0.001) solid.push([cursor, len]);
    g.strokeStyle = '#1f2937';
    g.lineCap = 'butt';
    g.lineWidth = Math.max(2, t * v.scale);
    for (const [s0, s1] of solid) {
      const p0 = toScreen(v, a.x + ux * s0, a.y + uy * s0);
      const p1 = toScreen(v, a.x + ux * s1, a.y + uy * s1);
      g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
    }
    for (const o of ops) drawOpening(g, v, w, o, { a, ux, uy });
  }

  function drawOpening(g, v, w, o, vec) {
    const { a, ux, uy } = vec;
    const t = w.thickness;
    const nx = -uy, ny = ux;
    const c0 = { x: a.x + ux * (o.offset - o.width / 2), y: a.y + uy * (o.offset - o.width / 2) };
    const c1 = { x: a.x + ux * (o.offset + o.width / 2), y: a.y + uy * (o.offset + o.width / 2) };
    const p0 = toScreen(v, c0.x, c0.y), p1 = toScreen(v, c1.x, c1.y);
    const mid = { x: a.x + ux * o.offset, y: a.y + uy * o.offset };
    const room = roomAt(mid);
    g.strokeStyle = room ? room.color : '#ffffff';
    g.lineWidth = Math.max(2, t * v.scale) + 2;
    g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); g.stroke();
    g.strokeStyle = '#1f2937';
    g.lineWidth = 1.5;
    if (o.kind === 'window') {
      for (const off of [-t / 4, t / 4]) {
        const q0 = toScreen(v, c0.x + nx * off, c0.y + ny * off);
        const q1 = toScreen(v, c1.x + nx * off, c1.y + ny * off);
        g.beginPath(); g.moveTo(q0.x, q0.y); g.lineTo(q1.x, q1.y); g.stroke();
      }
    } else {
      const hinge = toScreen(v, c0.x, c0.y);
      const perp = toScreen(v, c0.x + nx * o.width, c0.y + ny * o.width);
      g.beginPath(); g.moveTo(hinge.x, hinge.y); g.lineTo(perp.x, perp.y); g.stroke();
      const aU = Math.atan2(uy, ux);
      const aN = Math.atan2(ny, nx);
      let d = aN - aU;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d <= -Math.PI) d += 2 * Math.PI;
      g.beginPath();
      g.arc(hinge.x, hinge.y, o.width * v.scale, aU, aU + d, d < 0);
      g.stroke();
    }
  }

  function drawFurniture(g, v, f) {
    const d = furnDims(f);
    const c = toScreen(v, f.x, f.y);
    g.save();
    g.translate(c.x, c.y);
    g.rotate(f.rot * Math.PI / 180);
    const w = d.w * v.scale, h = d.h * v.scale;
    g.fillStyle = f.color;
    g.fillRect(-w / 2, -h / 2, w, h);
    g.strokeStyle = '#475569';
    g.lineWidth = 1.5;
    g.strokeRect(-w / 2, -h / 2, w, h);
    g.fillStyle = f.type === 'tv' ? '#f8fafc' : '#1e293b';
    g.font = fontFor(v, 11);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(f.name, 0, 0);
    g.restore();
  }

  function drawPreview(g, v) {
    if (!drawing) return;
    g.strokeStyle = '#2563eb';
    g.setLineDash([6, 4]);
    g.lineWidth = 2;
    if (drawing.kind === 'wall') {
      const a = toScreen(v, drawing.start.x, drawing.start.y);
      const b = toScreen(v, drawing.cur.x, drawing.cur.y);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    } else if (drawing.kind === 'room') {
      const x = Math.min(drawing.start.x, drawing.cur.x);
      const y = Math.min(drawing.start.y, drawing.cur.y);
      const w = Math.abs(drawing.cur.x - drawing.start.x);
      const h = Math.abs(drawing.cur.y - drawing.start.y);
      const s = toScreen(v, x, y);
      g.strokeRect(s.x, s.y, w * v.scale, h * v.scale);
    }
    g.setLineDash([]);
  }

  function drawSelection(g, v) {
    if (!selected) return;
    g.strokeStyle = '#eab308';
    g.setLineDash([5, 4]);
    g.lineWidth = 2.5;
    if (selected.kind === 'wall') {
      const w = state.walls.find(x => x.id === selected.id);
      if (w) {
        const a = toScreen(v, w.x1, w.y1), b = toScreen(v, w.x2, w.y2);
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      }
    } else if (selected.kind === 'room') {
      const r = state.rooms.find(x => x.id === selected.id);
      if (r) {
        const p = toScreen(v, r.x, r.y);
        g.strokeRect(p.x, p.y, r.w * v.scale, r.h * v.scale);
      }
    } else if (selected.kind === 'furniture') {
      const f = state.furniture.find(x => x.id === selected.id);
      if (f) {
        const r = furnRect(f), p = toScreen(v, r.x, r.y);
        g.strokeRect(p.x, p.y, r.w * v.scale, r.h * v.scale);
      }
    } else if (selected.kind === 'opening') {
      const o = state.openings.find(x => x.id === selected.id);
      const w = o && state.walls.find(x => x.id === o.wallId);
      if (o && w) {
        const { a, ux, uy } = wallVec(w);
        const m = toScreen(v, a.x + ux * o.offset, a.y + uy * o.offset);
        g.beginPath(); g.arc(m.x, m.y, 9, 0, Math.PI * 2); g.stroke();
      }
    }
    g.setLineDash([]);
  }

  function renderScene(g, v, opts, cw, ch) {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, cw, ch);
    if (opts.grid) drawGrid(g, v, cw, ch);
    for (const r of state.rooms) drawRoom(g, v, r);
    for (const w of state.walls) drawWall(g, v, w);
    for (const f of state.furniture) drawFurniture(g, v, f);
    if (opts.preview) drawPreview(g, v);
    if (opts.ui) drawSelection(g, v);
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderScene(ctx, view, { grid: true, ui: true, preview: true }, canvas.clientWidth, canvas.clientHeight);
  }

  function hitTest(p) {
    for (let i = state.furniture.length - 1; i >= 0; i--) {
      if (inRect(p, furnRect(state.furniture[i]))) return { kind: 'furniture', id: state.furniture[i].id };
    }
    for (let i = state.openings.length - 1; i >= 0; i--) {
      const o = state.openings[i];
      const w = state.walls.find(x => x.id === o.wallId);
      if (!w) continue;
      const { a, ux, uy } = wallVec(w);
      if (dist(p, { x: a.x + ux * o.offset, y: a.y + uy * o.offset }) < 0.3) return { kind: 'opening', id: o.id };
    }
    for (let i = state.walls.length - 1; i >= 0; i--) {
      const w = state.walls[i];
      if (distToSeg(p, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }) < Math.max(0.15, w.thickness / 2 + 0.05)) {
        return { kind: 'wall', id: w.id };
      }
    }
    for (let i = state.rooms.length - 1; i >= 0; i--) {
      if (inRect(p, state.rooms[i])) return { kind: 'room', id: state.rooms[i].id };
    }
    return null;
  }

  function placeOpening(p, kind) {
    let best = null, bestD = 0.35;
    for (const w of state.walls) {
      const d = distToSeg(p, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
      if (d < bestD) { bestD = d; best = w; }
    }
    if (!best) { setStatus('Keine Wand in der Nähe – erst eine Wand zeichnen'); return; }
    const { a, b, len } = wallVec(best);
    const { t } = projectOnSeg(p, a, b);
    const offset = Math.max(0.05, Math.min(len - 0.05, t * len));
    const width = kind === 'door' ? 0.9 : 1.2;
    const clash = state.openings.some(o => o.wallId === best.id && Math.abs(o.offset - offset) < (o.width + width) / 2 + 0.05);
    if (clash) { setStatus('Öffnung würde eine vorhandene Öffnung überlappen'); return; }
    state.openings.push({ id: uid(), wallId: best.id, offset, width, kind });
    save(); draw();
    setStatus((kind === 'door' ? 'Tür' : 'Fenster') + ' eingesetzt, Breite ' + width.toFixed(1) + ' m');
  }

  function placeFurniture(p) {
    const item = FURNITURE.find(f => f.type === furniturePick);
    if (!item) return;
    state.furniture.push({
      id: uid(), type: item.type, name: item.name,
      x: snap(p.x), y: snap(p.y), rot: 0,
      w: item.w, h: item.h, color: item.color
    });
    save(); draw();
  }

  function remove(h) {
    if (h.kind === 'wall') {
      state.walls = state.walls.filter(w => w.id !== h.id);
      state.openings = state.openings.filter(o => o.wallId !== h.id);
    } else if (h.kind === 'room') {
      state.rooms = state.rooms.filter(r => r.id !== h.id);
    } else if (h.kind === 'furniture') {
      state.furniture = state.furniture.filter(f => f.id !== h.id);
    } else if (h.kind === 'opening') {
      state.openings = state.openings.filter(o => o.id !== h.id);
    }
    if (selected && selected.kind === h.kind && selected.id === h.id) selected = null;
    save(); draw(); renderProps(); renderStats();
  }

  function moveEntity(h, dx, dy) {
    if (h.kind === 'wall') {
      const w = state.walls.find(x => x.id === h.id);
      if (w) { w.x1 += dx; w.y1 += dy; w.x2 += dx; w.y2 += dy; }
    } else if (h.kind === 'room') {
      const r = state.rooms.find(x => x.id === h.id);
      if (r) { r.x += dx; r.y += dy; }
    } else if (h.kind === 'furniture') {
      const f = state.furniture.find(x => x.id === h.id);
      if (f) { f.x = snap(f.x + dx); f.y = snap(f.y + dy); }
    }
  }

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    const p = toWorld(view, e.offsetX, e.offsetY);
    if (e.button === 1 || spaceDown || tool === 'pan') {
      panning = { sx: e.offsetX, sy: e.offsetY, panX: view.panX, panY: view.panY };
      return;
    }
    if (e.button !== 0) return;
    if (tool === 'wall') {
      const s = snapPt(p);
      drawing = { kind: 'wall', start: s, cur: s };
      draw();
    } else if (tool === 'room') {
      const s = snapPt(p);
      drawing = { kind: 'room', start: s, cur: s };
      draw();
    } else if (tool === 'door' || tool === 'window') {
      placeOpening(p, tool);
    } else if (tool === 'erase') {
      const h = hitTest(p);
      if (h) { remove(h); setStatus('Element gelöscht'); }
    } else if (tool === 'furniture') {
      if (furniturePick) placeFurniture(p);
      else setStatus('Zuerst ein Möbelstück in der Seitenleiste auswählen');
    } else if (tool === 'select') {
      const h = hitTest(p);
      selected = h;
      if (h) drag = { h, sx: p.x, sy: p.y };
      draw(); renderProps();
    }
  });

  canvas.addEventListener('pointermove', e => {
    const p = toWorld(view, e.offsetX, e.offsetY);
    if (panning) {
      view.panX = panning.panX + (e.offsetX - panning.sx);
      view.panY = panning.panY + (e.offsetY - panning.sy);
      draw();
      return;
    }
    if (drawing) {
      const c = snapPt(p);
      drawing.cur = drawing.kind === 'wall' ? axisSnap(drawing.start, c) : c;
      draw();
      return;
    }
    if (drag) {
      moveEntity(drag.h, p.x - drag.sx, p.y - drag.sy);
      drag.sx = p.x; drag.sy = p.y;
      draw();
      return;
    }
    if (tool === 'select') canvas.style.cursor = hitTest(p) ? 'move' : 'default';
    else if (tool === 'pan') canvas.style.cursor = 'grab';
    else canvas.style.cursor = 'crosshair';
  });

  canvas.addEventListener('pointerup', () => {
    if (panning) { panning = null; return; }
    if (drawing) {
      const d = drawing;
      drawing = null;
      if (d.kind === 'wall') {
        const l = dist(d.start, d.cur);
        if (l >= 0.5) {
          state.walls.push({ id: uid(), x1: d.start.x, y1: d.start.y, x2: d.cur.x, y2: d.cur.y, thickness: 0.2 });
          save();
          setStatus('Wand gezeichnet, Länge ' + l.toFixed(1) + ' m');
        }
      } else if (d.kind === 'room') {
        const x = Math.min(d.start.x, d.cur.x);
        const y = Math.min(d.start.y, d.cur.y);
        const w = Math.abs(d.cur.x - d.start.x);
        const h = Math.abs(d.cur.y - d.start.y);
        if (w >= 0.5 && h >= 0.5) {
          state.rooms.push({
            id: uid(), x, y, w, h,
            name: 'Raum ' + (state.rooms.length + 1),
            color: ROOM_COLORS[state.rooms.length % ROOM_COLORS.length]
          });
          save(); renderStats();
          setStatus('Raum angelegt, Fläche ' + (w * h).toFixed(1) + ' m²');
        }
      }
      draw();
    }
    if (drag) { drag = null; save(); renderProps(); renderStats(); }
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0012);
    const ns = Math.max(5, Math.min(120, view.scale * factor));
    const mx = e.offsetX, my = e.offsetY;
    view.panX = mx - (mx - view.panX) * (ns / view.scale);
    view.panY = my - (my - view.panY) * (ns / view.scale);
    view.scale = ns;
    draw();
  }, { passive: false });

  window.addEventListener('keydown', e => {
    const tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.code === 'Space') { spaceDown = true; e.preventDefault(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { remove(selected); setStatus('Element gelöscht'); }
    else if ((e.key === 'd' || e.key === 'D') && selected && selected.kind === 'furniture') {
      const f = state.furniture.find(x => x.id === selected.id);
      if (f) { f.rot = (f.rot + 90) % 360; save(); draw(); renderProps(); }
    } else if (e.key === 'Escape') {
      drawing = null; selected = null; drag = null; furniturePick = null;
      updatePaletteHighlight();
      draw(); renderProps();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault(); save(); setStatus('Gespeichert');
    } else {
      const map = { v: 'select', w: 'wall', r: 'room', t: 'door', f: 'window', m: 'furniture', e: 'erase', h: 'pan' };
      const k = e.key.toLowerCase();
      if (map[k]) setTool(map[k]);
    }
  });

  window.addEventListener('keyup', e => {
    if (e.code === 'Space') spaceDown = false;
  });

  function setTool(t) {
    tool = t;
    drawing = null;
    if (t !== 'furniture') { furniturePick = null; updatePaletteHighlight(); }
    document.querySelectorAll('#toolbar .tool').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
    canvas.style.cursor = t === 'pan' ? 'grab' : t === 'select' ? 'default' : 'crosshair';
    renderProps();
  }

  document.querySelectorAll('#toolbar .tool').forEach(b => {
    b.addEventListener('click', () => setTool(b.dataset.tool));
  });

  function buildPalette() {
    paletteEl.innerHTML = '';
    for (const f of FURNITURE) {
      const b = document.createElement('button');
      b.className = 'pal-item';
      b.dataset.type = f.type;
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = f.color;
      const label = document.createElement('span');
      label.textContent = f.name;
      const dims = document.createElement('small');
      dims.textContent = f.w + '×' + f.h + ' m';
      b.append(sw, label, dims);
      b.addEventListener('click', () => {
        furniturePick = f.type;
        setTool('furniture');
        setStatus(f.name + ' platzieren: auf die Zeichenfläche klicken');
      });
      paletteEl.appendChild(b);
    }
  }

  function updatePaletteHighlight() {
    paletteEl.querySelectorAll('.pal-item').forEach(b => b.classList.toggle('active', b.dataset.type === furniturePick));
  }

  function renderStats() {
    const area = state.rooms.reduce((s, r) => s + r.w * r.h, 0);
    statsEl.innerHTML =
      'Räume: ' + state.rooms.length + '<br>' +
      'Gesamtfläche: ' + area.toFixed(1) + ' m²<br>' +
      'Wände: ' + state.walls.length + '<br>' +
      'Türen/Fenster: ' + state.openings.length + '<br>' +
      'Möbel: ' + state.furniture.length;
  }

  function renderProps() {
    propsEl.innerHTML = '';
    if (!selected) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = 'Nichts ausgewählt. Mit „Auswählen“ auf ein Element klicken oder neues Element zeichnen.';
      propsEl.appendChild(p);
      return;
    }
    const mkRow = (labelText, input) => {
      const l = document.createElement('label');
      l.className = 'prop-row';
      const span = document.createElement('span');
      span.textContent = labelText;
      l.append(span, input);
      return l;
    };
    const mkDel = () => {
      const b = document.createElement('button');
      b.textContent = 'Löschen';
      b.addEventListener('click', () => { remove(selected); setStatus('Element gelöscht'); });
      return b;
    };
    const mkInfo = txt => {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = txt;
      return p;
    };
    if (selected.kind === 'room') {
      const r = state.rooms.find(x => x.id === selected.id);
      if (!r) { selected = null; renderProps(); return; }
      const name = document.createElement('input');
      name.type = 'text';
      name.value = r.name;
      name.addEventListener('change', () => { r.name = name.value || r.name; save(); draw(); });
      propsEl.append(mkRow('Raumname', name), mkInfo('Fläche: ' + (r.w * r.h).toFixed(2) + ' m² (' + r.w.toFixed(1) + ' × ' + r.h.toFixed(1) + ' m)'), mkDel());
    } else if (selected.kind === 'wall') {
      const w = state.walls.find(x => x.id === selected.id);
      if (!w) { selected = null; renderProps(); return; }
      const len = document.createElement('input');
      len.type = 'number'; len.step = '0.01'; len.value = wallLen(w).toFixed(2); len.disabled = true;
      const th = document.createElement('input');
      th.type = 'number'; th.step = '0.02'; th.min = '0.05'; th.value = w.thickness;
      th.addEventListener('change', () => { w.thickness = Math.max(0.05, parseFloat(th.value) || 0.2); save(); draw(); });
      propsEl.append(mkRow('Länge (m)', len), mkRow('Wanddicke (m)', th), mkDel());
    } else if (selected.kind === 'furniture') {
      const f = state.furniture.find(x => x.id === selected.id);
      if (!f) { selected = null; renderProps(); return; }
      const rot = document.createElement('button');
      rot.textContent = 'Um 90° drehen (D)';
      rot.addEventListener('click', () => { f.rot = (f.rot + 90) % 360; save(); draw(); renderProps(); });
      propsEl.append(mkInfo(f.name + ' – ' + f.w + ' × ' + f.h + ' m'), rot, mkDel());
    } else if (selected.kind === 'opening') {
      const o = state.openings.find(x => x.id === selected.id);
      if (!o) { selected = null; renderProps(); return; }
      const wIn = document.createElement('input');
      wIn.type = 'number'; wIn.step = '0.1'; wIn.min = '0.3'; wIn.value = o.width;
      wIn.addEventListener('change', () => { o.width = Math.max(0.3, parseFloat(wIn.value) || o.width); save(); draw(); });
      propsEl.append(mkRow('Breite (m)', wIn), mkInfo(o.kind === 'door' ? 'Tür' : 'Fenster'), mkDel());
    }
  }

  function planBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const add = (x, y) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    };
    for (const w of state.walls) { add(w.x1, w.y1); add(w.x2, w.y2); }
    for (const r of state.rooms) { add(r.x, r.y); add(r.x + r.w, r.y + r.h); }
    for (const f of state.furniture) {
      const r = furnRect(f);
      add(r.x, r.y); add(r.x + r.w, r.y + r.h);
    }
    if (!isFinite(minX)) return null;
    return { minX, minY, maxX, maxY };
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  document.getElementById('btn-new').addEventListener('click', () => {
    if (!confirm('Neuen Grundriss erstellen? Der gespeicherte Plan wird überschrieben.')) return;
    state = freshState();
    selected = null; drawing = null;
    save();
    planNameEl.value = state.meta.name;
    draw(); renderProps(); renderStats();
    setStatus('Neuer Grundriss');
  });

  document.getElementById('btn-save').addEventListener('click', () => { save(); setStatus('Gespeichert'); });

  document.getElementById('btn-load').addEventListener('click', () => {
    load();
    selected = null;
    planNameEl.value = state.meta.name;
    draw(); renderProps(); renderStats();
    setStatus('Plan geladen');
  });

  document.getElementById('btn-export-json').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    downloadBlob(blob, (state.meta.name || 'grundriss') + '.json');
    setStatus('JSON exportiert');
  });

  document.getElementById('btn-import-json').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const p = JSON.parse(reader.result);
        if (!p || !p.meta || !Array.isArray(p.walls) || !Array.isArray(p.rooms)) throw new Error('ungültig');
        state = p;
        selected = null;
        save();
        planNameEl.value = state.meta.name;
        draw(); renderProps(); renderStats();
        setStatus('Grundriss importiert');
      } catch (err) {
        setStatus('Ungültige JSON-Datei');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('btn-export-png').addEventListener('click', () => {
    const b = planBounds();
    if (!b) { setStatus('Nichts zu exportieren – der Plan ist leer'); return; }
    const pad = 0.5;
    const wM = b.maxX - b.minX + pad * 2;
    const hM = b.maxY - b.minY + pad * 2;
    const s = Math.max(4, Math.min(60, 3000 / Math.max(wM, hM)));
    const off = document.createElement('canvas');
    off.width = Math.ceil(wM * s);
    off.height = Math.ceil(hM * s);
    const g = off.getContext('2d');
    const v = { scale: s, panX: -b.minX * s + pad * s, panY: -b.minY * s + pad * s };
    renderScene(g, v, { grid: false, ui: false, preview: false }, off.width, off.height);
    off.toBlob(blob => {
      if (blob) downloadBlob(blob, (state.meta.name || 'grundriss') + '.png');
    }, 'image/png');
    setStatus('PNG exportiert');
  });

  planNameEl.addEventListener('change', () => {
    state.meta.name = planNameEl.value.trim() || 'Mein Grundriss';
    save();
  });

  function resize() {
    const r = wrapEl.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    canvas.style.width = r.width + 'px';
    canvas.style.height = r.height + 'px';
    draw();
  }

  new ResizeObserver(resize).observe(wrapEl);

  load();
  buildPalette();
  planNameEl.value = state.meta.name;
  setTool('select');
  renderStats();
  resize();
})();
