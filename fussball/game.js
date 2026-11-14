'use strict';
(() => {
  const W = 320, H = 256, HUD_H = 16;
  const PPM = 6;
  const VIEW_W = W / PPM;
  const VIEW_H = (H - HUD_H) / PPM;
  const PITCH_W = 105, PITCH_H = 68;
  const MID_X = PITCH_W / 2, MID_Y = PITCH_H / 2;
  const GOAL_HALF = 7.32 / 2;
  const POST_R = 0.15;
  const MARGIN = 14;
  const APRON_M = 4;
  const HALF_MIN = 45;
  const DT = 1 / 60;
  const MAX_SPEED = 7.4;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const FONT = {
    'A': ['010', '101', '111', '101', '101'], 'B': ['110', '101', '110', '101', '110'],
    'C': ['011', '100', '100', '100', '011'], 'D': ['110', '101', '101', '101', '110'],
    'E': ['111', '100', '110', '100', '111'], 'F': ['111', '100', '110', '100', '100'],
    'G': ['011', '100', '101', '101', '011'], 'H': ['101', '101', '111', '101', '101'],
    'I': ['111', '010', '010', '010', '111'], 'J': ['001', '001', '001', '101', '010'],
    'K': ['101', '101', '110', '101', '101'], 'L': ['100', '100', '100', '100', '111'],
    'M': ['101', '111', '111', '101', '101'], 'N': ['110', '101', '101', '101', '101'],
    'O': ['010', '101', '101', '101', '010'], 'P': ['110', '101', '110', '100', '100'],
    'Q': ['010', '101', '101', '110', '011'], 'R': ['110', '101', '110', '101', '101'],
    'S': ['011', '100', '010', '001', '110'], 'T': ['111', '010', '010', '010', '010'],
    'U': ['101', '101', '101', '101', '111'], 'V': ['101', '101', '101', '101', '010'],
    'W': ['101', '101', '111', '111', '101'], 'X': ['101', '101', '010', '101', '101'],
    'Y': ['101', '101', '010', '010', '010'], 'Z': ['111', '001', '010', '100', '111'],
    '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
    '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '001', '010', '010'],
    '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
    ' ': ['000', '000', '000', '000', '000'], ':': ['000', '010', '000', '010', '000'],
    '.': ['000', '000', '000', '000', '010'], '-': ['000', '000', '111', '000', '000'],
    "'": ['010', '010', '000', '000', '000'], '!': ['010', '010', '010', '000', '010'],
    '/': ['001', '001', '010', '100', '100'], '(': ['001', '010', '010', '010', '001'],
    ')': ['100', '010', '010', '010', '100'], '+': ['000', '010', '111', '010', '000'],
    '%': ['101', '001', '010', '100', '101'], '>': ['100', '010', '001', '010', '100'],
    '<': ['001', '010', '100', '010', '001'],
  };

  function drawText(c, str, x, y, s, color) {
    c.fillStyle = color;
    let cx = x;
    for (const ch of String(str).toUpperCase()) {
      const g = FONT[ch] || FONT[' '];
      for (let r = 0; r < 5; r++) {
        for (let col = 0; col < 3; col++) {
          if (g[r][col] === '1') c.fillRect(cx + col * s, y + r * s, s, s);
        }
      }
      cx += 4 * s;
    }
  }
  function textW(str, s) { return String(str).length * 4 * s - s; }
  function drawTextC(c, str, cx, y, s, color) {
    drawText(c, str, Math.round(cx - textW(str, s) / 2), y, s, color);
  }

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  ctx.imageSmoothingEnabled = false;

  function fit() {
    const s = Math.max(1, Math.floor(Math.min(window.innerWidth / W, (window.innerHeight - 48) / H)));
    canvas.style.width = W * s + 'px';
    canvas.style.height = H * s + 'px';
  }
  window.addEventListener('resize', fit);
  fit();

  function hash2(x, y) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  const world = document.createElement('canvas');
  world.width = Math.ceil((PITCH_W + 2 * MARGIN) * PPM);
  world.height = Math.ceil((PITCH_H + 2 * MARGIN) * PPM);
  const wctx = world.getContext('2d');

  function buildWorld() {
    const OX = MARGIN * PPM, OY = MARGIN * PPM;
    const APRON = APRON_M * PPM;
    wctx.fillStyle = '#141414';
    wctx.fillRect(0, 0, world.width, world.height);
    const crowdCols = ['#c8b490', '#9a8a70', '#e0e0e0', '#b04038', '#3858b0', '#3a9048', '#c09030'];
    for (let y = 0; y < world.height; y += 2) {
      for (let x = 0; x < world.width; x += 2) {
        const inApron = x >= OX - APRON && x < OX + PITCH_W * PPM + APRON &&
                        y >= OY - APRON && y < OY + PITCH_H * PPM + APRON;
        if (!inApron && hash2(x, y) < 0.55) {
          wctx.fillStyle = crowdCols[Math.floor(hash2(x + 7, y + 13) * crowdCols.length)];
          wctx.fillRect(x, y, 2, 2);
        }
      }
    }
    wctx.fillStyle = '#2c7a2e';
    wctx.fillRect(OX - APRON, OY - APRON, PITCH_W * PPM + 2 * APRON, PITCH_H * PPM + 2 * APRON);
    const stripes = 10;
    for (let i = 0; i < stripes; i++) {
      wctx.fillStyle = i % 2 ? '#379237' : '#3f9e40';
      wctx.fillRect(OX + (PITCH_W / stripes) * i * PPM, OY, (PITCH_W / stripes) * PPM + 1, PITCH_H * PPM);
    }
    const boards = [['PIXEL-FUSSBALL', '#a02020'], ['AMIGA-STYLE', '#2040a0'], ['5 GEGEN 5', '#c09010'], ['KICKOFF', '#207020']];
    for (let side = 0; side < 2; side++) {
      const by = side === 0 ? OY - APRON + 4 : OY + PITCH_H * PPM + 4;
      let bx = OX + 6;
      let bi = 0;
      while (bx < OX + PITCH_W * PPM - 30) {
        const bw = textW(boards[bi % boards.length][0], 1) + 10;
        wctx.fillStyle = boards[bi % boards.length][1];
        wctx.fillRect(bx, by, bw, APRON - 8);
        drawText(wctx, boards[bi % boards.length][0], bx + 5, by + 4, 1, '#ffffff');
        bx += bw + 6;
        bi++;
      }
    }
    wctx.strokeStyle = '#f2f2f2';
    wctx.lineWidth = 2;
    const gy1 = OY + (MID_Y - GOAL_HALF) * PPM, gy2 = OY + (MID_Y + GOAL_HALF) * PPM;
    wctx.beginPath();
    wctx.moveTo(OX, OY);
    wctx.lineTo(OX + PITCH_W * PPM, OY);
    wctx.moveTo(OX + PITCH_W * PPM, OY + PITCH_H * PPM);
    wctx.lineTo(OX, OY + PITCH_H * PPM);
    wctx.stroke();
    for (const gx of [OX, OX + PITCH_W * PPM]) {
      wctx.beginPath();
      wctx.moveTo(gx, OY);
      wctx.lineTo(gx, gy1);
      wctx.moveTo(gx, gy2);
      wctx.lineTo(gx, OY + PITCH_H * PPM);
      wctx.stroke();
    }
    wctx.beginPath();
    wctx.moveTo(OX + MID_X * PPM, OY);
    wctx.lineTo(OX + MID_X * PPM, OY + PITCH_H * PPM);
    wctx.stroke();
    wctx.beginPath();
    wctx.arc(OX + MID_X * PPM, OY + MID_Y * PPM, 9.15 * PPM, 0, Math.PI * 2);
    wctx.stroke();
    for (let s = 0; s < 2; s++) {
      const gx = OX + (s === 0 ? 0 : PITCH_W * PPM);
      const dir = s === 0 ? 1 : -1;
      const boxW = 40.32 * PPM, boxD = 16.5 * PPM;
      const smallW = 18.32 * PPM, smallD = 5.5 * PPM;
      for (const [bw, bd] of [[boxW, boxD], [smallW, smallD]]) {
        const top = OY + MID_Y * PPM - bw / 2;
        wctx.beginPath();
        wctx.moveTo(gx, top);
        wctx.lineTo(gx + dir * bd, top);
        wctx.moveTo(gx + dir * bd, top);
        wctx.lineTo(gx + dir * bd, top + bw);
        wctx.moveTo(gx + dir * bd, top + bw);
        wctx.lineTo(gx, top + bw);
        wctx.stroke();
      }
      wctx.fillStyle = '#f2f2f2';
      wctx.fillRect(gx + dir * 11 * PPM - 1, OY + MID_Y * PPM - 1, 3, 3);
      wctx.strokeStyle = '#f2f2f2';
      const spotX = gx + dir * 11 * PPM;
      const arcA0 = dir === 1 ? -0.93 : Math.PI - 0.93;
      wctx.beginPath();
      wctx.arc(spotX, OY + MID_Y * PPM, 9.15 * PPM, arcA0, arcA0 + 1.86);
      wctx.stroke();
      const back = s === 0 ? OX - 1.5 * PPM : OX + PITCH_W * PPM + 1.5 * PPM;
      const y1 = OY + (MID_Y - GOAL_HALF) * PPM, y2 = OY + (MID_Y + GOAL_HALF) * PPM;
      wctx.fillStyle = 'rgba(255,255,255,0.15)';
      wctx.fillRect(Math.min(gx, back), y1, Math.abs(back - gx), y2 - y1);
      wctx.strokeStyle = '#d8d8d8';
      wctx.strokeRect(Math.min(gx, back), y1, Math.abs(back - gx), y2 - y1);
      wctx.fillStyle = '#ffffff';
      wctx.beginPath(); wctx.arc(gx, y1, 2, 0, Math.PI * 2); wctx.fill();
      wctx.beginPath(); wctx.arc(gx, y2, 2, 0, Math.PI * 2); wctx.fill();
    }
    wctx.strokeStyle = '#f2f2f2';
    for (const [cx, cy, a0] of [
      [OX, OY, 0],
      [OX + PITCH_W * PPM, OY, Math.PI / 2],
      [OX + PITCH_W * PPM, OY + PITCH_H * PPM, Math.PI],
      [OX, OY + PITCH_H * PPM, -Math.PI / 2],
    ]) {
      wctx.beginPath();
      wctx.arc(cx, cy, 1 * PPM, a0, a0 + Math.PI / 2);
      wctx.stroke();
    }
  }
  buildWorld();

  const TEAMS = [
    { name: 'ROT', shirt: '#d42828', shorts: '#f2f2f2', gk: '#e8d020', attack: 1 },
    { name: 'BLAU', shirt: '#2848d8', shorts: '#f2f2f2', gk: '#c8c8c8', attack: -1 },
  ];
  const FORMATION = [
    { role: 'GK', x: 5, y: MID_Y },
    { role: 'DF', x: 24, y: MID_Y - 13 },
    { role: 'DF', x: 24, y: MID_Y + 13 },
    { role: 'MF', x: 42, y: MID_Y },
    { role: 'FW', x: 62, y: MID_Y },
  ];
  const POSTS = [
    { x: 0, y: MID_Y - GOAL_HALF }, { x: 0, y: MID_Y + GOAL_HALF },
    { x: PITCH_W, y: MID_Y - GOAL_HALF }, { x: PITCH_W, y: MID_Y + GOAL_HALF },
  ];

  const S = {
    state: 'title',
    half: 1,
    minute: 0,
    score: [0, 0],
    timer: 0,
    message: '',
    sub: '',
    restartPlayer: null,
    muted: false,
  };
  let players = [];
  let ball = { x: MID_X, y: MID_Y, vx: 0, vy: 0, owner: null, lastTouch: -1 };
  let cam = { x: clamp(MID_X - VIEW_W / 2, 0, PITCH_W - VIEW_W), y: clamp(MID_Y - VIEW_H / 2, 0, PITCH_H - VIEW_H) };
  let active = null;

  const keys = {};

  let AC = null, master = null, crowdGain = null;
  function audio() {
    if (AC || typeof AudioContext === 'undefined') return AC;
    try {
      AC = new AudioContext();
      master = AC.createGain();
      master.gain.value = S.muted ? 0 : 0.5;
      master.connect(AC.destination);
      const len = AC.sampleRate * 2;
      const buf = AC.createBuffer(1, len, AC.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = AC.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filt = AC.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 700;
      filt.Q.value = 0.4;
      crowdGain = AC.createGain();
      crowdGain.gain.value = 0.05;
      src.connect(filt);
      filt.connect(crowdGain);
      crowdGain.connect(master);
      src.start();
    } catch (err) {
      AC = null;
    }
    return AC;
  }
  function beep(freq, dur, type, vol, when) {
    const ac = audio();
    if (!ac) return;
    const t0 = ac.currentTime + (when || 0);
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  function whistle(long) {
    beep(2100, long ? 0.55 : 0.18, 'square', 0.14);
    beep(1750, long ? 0.55 : 0.18, 'square', 0.09, 0.03);
  }
  function kickSnd() { beep(140, 0.06, 'square', 0.22); }
  function goalSnd() {
    [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.12, 'square', 0.2, i * 0.09));
    if (crowdGain) {
      crowdGain.gain.value = 0.28;
      setTimeout(() => { if (crowdGain) crowdGain.gain.value = 0.05; }, 2400);
    }
  }

  function resetPositions(kickoffTeam) {
    players = [];
    for (let t = 0; t < 2; t++) {
      for (const f of FORMATION) {
        const x = TEAMS[t].attack === 1 ? f.x : PITCH_W - f.x;
        players.push({
          team: t, role: f.role, x, y: f.y, hx: x, hy: f.y,
          vx: 0, vy: 0, face: TEAMS[t].attack === 1 ? 0 : Math.PI,
          shirt: f.role === 'GK' ? TEAMS[t].gk : TEAMS[t].shirt,
          shorts: TEAMS[t].shorts,
          stealCd: 0, aiT: Math.random() * 0.3, gkT: 0,
        });
      }
    }
    ball = { x: MID_X, y: MID_Y, vx: 0, vy: 0, owner: null, lastTouch: kickoffTeam };
    const fwd = players.find(p => p.team === kickoffTeam && p.role === 'FW');
    ball.owner = fwd;
    active = nearestToBall(0);
    cam.x = clamp(MID_X - VIEW_W / 2, 0, PITCH_W - VIEW_W);
    cam.y = clamp(MID_Y - VIEW_H / 2, 0, PITCH_H - VIEW_H);
  }

  function nearestToBall(team) {
    let best = null, bd = Infinity;
    for (const p of players) {
      if (p.team !== team) continue;
      const d = dist(p, ball);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  function nearestTo(pos, team) {
    let best = null, bd = Infinity;
    for (const p of players) {
      if (p.team !== team) continue;
      const d = dist(p, pos);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  function inputDir() {
    let dx = 0, dy = 0;
    if (keys.ArrowLeft || keys.KeyA) dx -= 1;
    if (keys.ArrowRight || keys.KeyD) dx += 1;
    if (keys.ArrowUp || keys.KeyW) dy -= 1;
    if (keys.ArrowDown || keys.KeyS) dy += 1;
    if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
    return { dx, dy };
  }

  function movePlayer(p, dx, dy, dt) {
    if (dx || dy) {
      p.face = Math.atan2(dy, dx);
      let target = MAX_SPEED * (p.role === 'GK' ? 0.85 : 1);
      if (ball.owner === p) target *= 0.82;
      const k = Math.min(1, 10 * dt);
      p.vx += (dx * target - p.vx) * k;
      p.vy += (dy * target - p.vy) * k;
    } else {
      const damp = Math.exp(-8 * dt);
      p.vx *= damp;
      p.vy *= damp;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = clamp(p.x, 0.4, PITCH_W - 0.4);
    p.y = clamp(p.y, 0.4, PITCH_H - 0.4);
  }

  function separate() {
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const a = players[i], b = players[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.55 && d > 0.001) {
          const push = (0.55 - d) / 2;
          const nx = dx / d, ny = dy / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
        }
      }
    }
  }

  function kickBall(p, tx, ty, power) {
    const d = Math.hypot(tx - ball.x, ty - ball.y) || 1;
    ball.vx = (tx - ball.x) / d * power;
    ball.vy = (ty - ball.y) / d * power;
    ball.owner = null;
    ball.lastTouch = p.team;
    kickSnd();
  }

  function shootAtGoal(p) {
    const gx = p.team === 0 ? PITCH_W : 0;
    const aim = clamp(MID_Y + (Math.random() - 0.5) * 4, MID_Y - GOAL_HALF + 0.4, MID_Y + GOAL_HALF - 0.4);
    kickBall(p, gx, aim, 17 + Math.random() * 4);
  }

  function humanPass() {
    const p = active;
    if (!p || ball.owner !== p) return;
    const dir = inputDir();
    let dx = dir.dx, dy = dir.dy;
    if (!dx && !dy) { dx = Math.cos(p.face); dy = Math.sin(p.face); }
    let best = null, bestDot = 0.45;
    for (const m of players) {
      if (m.team !== p.team || m === p) continue;
      const d = dist(p, m);
      if (d > 26) continue;
      const dot = ((m.x - p.x) / d) * dx + ((m.y - p.y) / d) * dy;
      if (dot > bestDot) { bestDot = dot; best = m; }
    }
    if (best) {
      kickBall(p, best.x + best.vx * 0.25, best.y + best.vy * 0.25, clamp(7 + dist(p, best) * 0.4, 9, 15));
    } else {
      shootAtGoal(p);
    }
  }

  function humanShoot() {
    const p = active;
    if (!p || ball.owner !== p) return;
    const dir = inputDir();
    const gx = p.team === 0 ? PITCH_W : 0;
    const gy = clamp(MID_Y + dir.dy * 6 + (Math.random() - 0.5) * 1.2, MID_Y - GOAL_HALF + 0.3, MID_Y + GOAL_HALF - 0.3);
    kickBall(p, gx, gy, 18 + Math.random() * 4);
  }

  function aiPass(p) {
    let best = null, bestScore = -Infinity;
    for (const m of players) {
      if (m.team !== p.team || m === p) continue;
      const d = dist(p, m);
      if (d < 3 || d > 30) continue;
      const progress = (p.team === 0 ? 1 : -1) * (m.x - p.x);
      let open = 0;
      for (const q of players) if (q.team !== p.team && dist(q, m) > 2) open++;
      const s = progress * 2 + open * 0.5 - d * 0.1;
      if (s > bestScore) { bestScore = s; best = m; }
    }
    if (best) kickBall(p, best.x + best.vx * 0.25, best.y + best.vy * 0.25, clamp(8 + dist(p, best) * 0.35, 10, 16));
    else shootAtGoal(p);
  }

  function aiControl(p, dt) {
    const oppGoalX = p.team === 0 ? PITCH_W : 0;
    let tx, ty;
    if (p.role === 'GK') {
      tx = p.team === 0 ? 1.4 : PITCH_W - 1.4;
      ty = clamp(ball.y, MID_Y - 10, MID_Y + 10);
      if (!ball.owner && dist(p, ball) < 3.5) { tx = ball.x; ty = ball.y; }
    } else if (ball.owner === p) {
      tx = oppGoalX;
      ty = MID_Y + Math.sin(S.minute * 2.2 + p.hy * 0.3) * 7;
      p.aiT -= dt;
      if (p.aiT <= 0) {
        p.aiT = 0.25;
        const goalD = Math.abs(oppGoalX - p.x);
        let pressured = false;
        for (const q of players) if (q.team !== p.team && dist(q, p) < 1.7) { pressured = true; break; }
        if (goalD < 17) shootAtGoal(p);
        else if (pressured) aiPass(p);
      }
    } else if (!ball.owner) {
      const nearest = nearestToBall(p.team);
      if (nearest === p || dist(p, ball) < 6) { tx = ball.x; ty = ball.y; }
      else { tx = p.hx + (ball.x - p.hx) * 0.35; ty = p.hy + (ball.y - p.hy) * 0.35; }
    } else if (ball.owner.team === p.team) {
      const dir = p.team === 0 ? 1 : -1;
      tx = p.hx + (ball.x - p.hx) * 0.45 + dir * 8;
      ty = p.hy + (ball.y - p.hy) * 0.45;
    } else {
      const mates = players.filter(q => q.team === p.team && q.role !== 'GK');
      const sorted = mates.slice().sort((a, b) => dist(a, ball) - dist(b, ball));
      if (sorted[0] === p || sorted[1] === p || dist(p, ball) < 8) { tx = ball.x; ty = ball.y; }
      else { tx = p.hx + (ball.x - p.hx) * 0.3; ty = p.hy + (ball.y - p.hy) * 0.3; }
    }
    let dx = tx - p.x, dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.5) { dx /= d; dy /= d; } else { dx = 0; dy = 0; }
    return { dx, dy };
  }

  function gkClear(p) {
    const tx = p.team === 0 ? PITCH_W * 0.8 : PITCH_W * 0.2;
    const ty = MID_Y + (Math.random() - 0.5) * 22;
    kickBall(p, tx, ty, 15);
    p.gkT = 0;
  }

  function onGoal(team) {
    S.score[team]++;
    goalSnd();
    resetPositions(1 - team);
    S.state = 'break';
    S.timer = 2.6;
    S.message = 'TOR!';
    S.sub = TEAMS[0].name + ' ' + S.score[0] + ':' + S.score[1] + ' ' + TEAMS[1].name;
    S.restartPlayer = null;
  }

  function onOut(kind, side) {
    if (S.state !== 'play') return;
    whistle();
    ball.vx = 0;
    ball.vy = 0;
    if (kind === 'side') {
      const team = ball.lastTouch === 0 ? 1 : 0;
      ball.x = clamp(ball.x, 1, PITCH_W - 1);
      ball.y = side === 0 ? 0.7 : PITCH_H - 0.7;
      S.state = 'break';
      S.timer = 0.9;
      S.message = 'EINWURF';
      S.sub = TEAMS[team].name;
      S.restartPlayer = nearestTo(ball, team);
    } else {
      const defending = side === 0 ? 0 : 1;
      const attacking = 1 - defending;
      if (ball.lastTouch === attacking) {
        ball.x = side === 0 ? 0.8 : PITCH_W - 0.8;
        ball.y = ball.y < MID_Y ? 0.8 : PITCH_H - 0.8;
        S.state = 'break';
        S.timer = 1.0;
        S.message = 'ECKSTOSS';
        S.sub = TEAMS[attacking].name;
        S.restartPlayer = nearestTo(ball, attacking);
      } else {
        ball.x = side === 0 ? 5 : PITCH_W - 5;
        ball.y = clamp(ball.y, MID_Y - 12, MID_Y + 12);
        S.state = 'break';
        S.timer = 1.2;
        S.message = 'ABSTOSS';
        S.sub = TEAMS[defending].name;
        S.restartPlayer = players.find(p => p.team === defending && p.role === 'GK') || null;
      }
    }
  }

  function updateBall(dt) {
    if (ball.owner) {
      const p = ball.owner;
      ball.x = p.x + Math.cos(p.face) * 0.45;
      ball.y = p.y + Math.sin(p.face) * 0.45;
      ball.vx = p.vx;
      ball.vy = p.vy;
      for (const q of players) {
        if (q.team === p.team || q === p) continue;
        q.stealCd = Math.max(0, q.stealCd - dt);
        if (q.stealCd === 0 && dist(q, p) < 0.7 && Math.random() < 0.03) {
          ball.owner = q;
          ball.lastTouch = q.team;
          q.stealCd = 0.8;
          kickSnd();
        }
      }
      return;
    }
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    const damp = Math.exp(-1.6 * dt);
    ball.vx *= damp;
    ball.vy *= damp;
    if (Math.hypot(ball.vx, ball.vy) < 0.25) { ball.vx = 0; ball.vy = 0; }
    for (const p of players) {
      const d = dist(p, ball);
      if (d < 0.5 && d > 0.0001) {
        const sp = Math.hypot(ball.vx, ball.vy);
        const nx = (ball.x - p.x) / d, ny = (ball.y - p.y) / d;
        const chance = clamp(1.15 - sp / 13, 0.12, 1);
        if (sp < 9 && Math.random() < chance) {
          ball.owner = p;
          ball.lastTouch = p.team;
        } else {
          const dot = ball.vx * nx + ball.vy * ny;
          ball.vx -= 2 * dot * nx;
          ball.vy -= 2 * dot * ny;
          ball.vx *= 0.55;
          ball.vy *= 0.55;
          ball.x = p.x + nx * 0.52;
          ball.y = p.y + ny * 0.52;
        }
      }
    }
    for (const post of POSTS) {
      const d = dist(ball, post);
      if (d < POST_R + 0.12 && d > 0.0001) {
        const nx = (ball.x - post.x) / d, ny = (ball.y - post.y) / d;
        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
          ball.vx -= 2 * dot * nx;
          ball.vy -= 2 * dot * ny;
          ball.vx *= 0.6;
          ball.vy *= 0.6;
        }
        ball.x = post.x + nx * (POST_R + 0.13);
        ball.y = post.y + ny * (POST_R + 0.13);
      }
    }
    const inMouth = ball.y > MID_Y - GOAL_HALF + 0.1 && ball.y < MID_Y + GOAL_HALF - 0.1;
    if (ball.x < 0 && inMouth) return onGoal(1);
    if (ball.x > PITCH_W && inMouth) return onGoal(0);
    if (ball.x < 0) { ball.x = 0; ball.vx = Math.abs(ball.vx) * 0.6; onOut('goal', 0); }
    else if (ball.x > PITCH_W) { ball.x = PITCH_W; ball.vx = -Math.abs(ball.vx) * 0.6; onOut('goal', 1); }
    if (ball.y < 0) { ball.y = 0; ball.vy = Math.abs(ball.vy) * 0.6; onOut('side', 0); }
    else if (ball.y > PITCH_H) { ball.y = PITCH_H; ball.vy = -Math.abs(ball.vy) * 0.6; onOut('side', 1); }
  }

  function updateActive() {
    if (ball.owner && ball.owner.team === 0) {
      active = ball.owner;
      return;
    }
    const n = nearestToBall(0);
    if (!active || active.team !== 0 || dist(active, ball) > dist(n, ball) + 1.2) active = n;
  }

  function updateCam(dt) {
    const tx = clamp(ball.x + ball.vx * 0.4 - VIEW_W / 2, 0, PITCH_W - VIEW_W);
    const ty = clamp(ball.y + ball.vy * 0.4 - VIEW_H / 2, 0, PITCH_H - VIEW_H);
    const k = Math.min(1, 6 * dt);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
  }

  function endHalf() {
    whistle(true);
    if (S.half === 1) S.state = 'halftime';
    else S.state = 'fulltime';
  }

  function startMatch() {
    S.score = [0, 0];
    S.half = 1;
    S.minute = 0;
    resetPositions(0);
    S.state = 'break';
    S.timer = 1.8;
    S.message = 'ANSTOSS';
    S.sub = TEAMS[0].name + ' BEGINNT';
    S.restartPlayer = null;
    whistle();
  }

  function startSecondHalf() {
    S.half = 2;
    S.minute = 0;
    resetPositions(1);
    S.state = 'break';
    S.timer = 1.8;
    S.message = 'ANSTOSS';
    S.sub = TEAMS[1].name + ' BEGINNT';
    S.restartPlayer = null;
    whistle();
  }

  function update(dt) {
    if (S.state === 'play') {
      S.minute += dt;
      if (S.minute >= HALF_MIN) { endHalf(); return; }
      updateActive();
      const dir = inputDir();
      for (const p of players) {
        let mx, my;
        if (p === active && p.team === 0) { mx = dir.dx; my = dir.dy; }
        else {
          const a = aiControl(p, dt);
          mx = a.dx;
          my = a.dy;
        }
        movePlayer(p, mx, my, dt);
      }
      separate();
      updateBall(dt);
      if (S.state === 'play' && ball.owner && ball.owner.role === 'GK' && ball.owner.team === 1) {
        ball.owner.gkT += dt;
        if (ball.owner.gkT > 0.7) gkClear(ball.owner);
      }
      updateCam(dt);
    } else if (S.state === 'break') {
      S.timer -= dt;
      updateCam(dt);
      if (S.timer <= 0) {
        if (S.restartPlayer) {
          ball.owner = S.restartPlayer;
          ball.lastTouch = S.restartPlayer.team;
        }
        S.restartPlayer = null;
        S.state = 'play';
        whistle();
      }
    }
  }

  function drawPlayer(p) {
    const x = Math.round((p.x - cam.x) * PPM);
    const y = Math.round(HUD_H + (p.y - cam.y) * PPM);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 3, 3, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.shirt;
    ctx.fillRect(x - 2, y - 2, 4, 4);
    ctx.fillStyle = p.shorts;
    ctx.fillRect(x - 2, y + 2, 4, 2);
    ctx.fillStyle = '#e8b088';
    ctx.fillRect(x - 1, y - 5, 3, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(Math.round(x + Math.cos(p.face) * 3), Math.round(y - 1 + Math.sin(p.face) * 3), 1, 1);
    if (p === active && S.state === 'play') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x - 2, y - 6);
      ctx.lineTo(x + 2, y - 6);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawBall() {
    const x = Math.round((ball.x - cam.x) * PPM);
    const y = Math.round(HUD_H + (ball.y - cam.y) * PPM);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x - 1, y + 2, 3, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.fillStyle = '#111111';
    ctx.fillRect(x, y, 1, 1);
  }

  function drawHUD() {
    ctx.fillStyle = '#000038';
    ctx.fillRect(0, 0, W, HUD_H);
    ctx.fillStyle = '#4040c0';
    ctx.fillRect(0, HUD_H - 1, W, 1);
    drawText(ctx, TEAMS[0].name, 6, 5, 1, '#ff7070');
    drawText(ctx, String(S.score[0]), 30, 5, 1, '#ffff00');
    drawText(ctx, ':', 40, 5, 1, '#ffffff');
    drawText(ctx, String(S.score[1]), 48, 5, 1, '#ffff00');
    drawText(ctx, TEAMS[1].name, 58, 5, 1, '#7090ff');
    drawTextC(ctx, Math.floor(S.minute) + "'", W / 2, 5, 1, '#ffffff');
    drawText(ctx, (S.half === 1 ? '1.' : '2.') + 'H', W - 18, 5, 1, '#aaaaff');
  }

  function scoreLine() {
    return TEAMS[0].name + ' ' + S.score[0] + ':' + S.score[1] + ' ' + TEAMS[1].name;
  }

  function drawTitle() {
    ctx.fillStyle = '#0000aa';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, 8);
    drawTextC(ctx, 'PIXEL-FUSSBALL', W / 2, 34, 3, '#ffff00');
    drawTextC(ctx, 'IM STIL VON SENSIBLE SOCCER (AMIGA)', W / 2, 62, 1, '#ffffff');
    const px = 60, py = 78, pw = 200, ph = 76;
    ctx.fillStyle = '#379237';
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = '#3f9e40';
    ctx.fillRect(px, py, pw / 2, ph);
    ctx.strokeStyle = '#f2f2f2';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, pw, ph);
    ctx.beginPath(); ctx.moveTo(px + pw / 2, py); ctx.lineTo(px + pw / 2, py + ph); ctx.stroke();
    ctx.beginPath(); ctx.arc(px + pw / 2, py + ph / 2, 12, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#2848d8' : '#d42828';
      ctx.fillRect(px + 20 + i * 14, py + ph / 2 - 2, 4, 4);
      ctx.fillStyle = i % 2 ? '#d42828' : '#2848d8';
      ctx.fillRect(px + pw - 24 - i * 14, py + ph / 2 - 2, 4, 4);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + pw / 2 - 1, py + ph / 2 - 1, 2, 2);
    drawTextC(ctx, 'STEUERUNG', W / 2, 168, 1, '#ffff00');
    drawTextC(ctx, 'PFEILE / WASD   LAUFEN', W / 2, 180, 1, '#ffffff');
    drawTextC(ctx, 'LEERTASTE       PASSEN', W / 2, 191, 1, '#ffffff');
    drawTextC(ctx, 'SHIFT / X       SCHIESSEN', W / 2, 202, 1, '#ffffff');
    drawTextC(ctx, 'M TON  -  P PAUSE', W / 2, 213, 1, '#ffffff');
    if (Math.floor(performance.now() / 500) % 2 === 0) {
      drawTextC(ctx, 'TASTE DRUECKEN FUR START', W / 2, 236, 1, '#ffff00');
    }
  }

  function drawBreak() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, HUD_H, W, H - HUD_H);
    drawTextC(ctx, S.message, W / 2, 108, 2, '#ffff00');
    if (S.sub) drawTextC(ctx, S.sub, W / 2, 130, 1, '#ffffff');
  }

  function drawFullOverlay(title, lines, blink) {
    ctx.fillStyle = '#0000aa';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, 8);
    drawTextC(ctx, title, W / 2, 60, 2, '#ffff00');
    drawTextC(ctx, scoreLine(), W / 2, 100, 2, '#ffffff');
    let y = 130;
    for (const ln of lines) {
      drawTextC(ctx, ln, W / 2, y, 1, '#ffffff');
      y += 12;
    }
    if (Math.floor(performance.now() / 500) % 2 === 0) {
      drawTextC(ctx, blink, W / 2, 220, 1, '#ffff00');
    }
  }

  function render() {
    ctx.drawImage(world, cam.x * PPM, cam.y * PPM, W, H - HUD_H, 0, HUD_H, W, H - HUD_H);
    const ents = players.slice().sort((a, b) => a.y - b.y);
    for (const p of ents) drawPlayer(p);
    drawBall();
    drawHUD();
    if (S.state === 'title') drawTitle();
    else if (S.state === 'break') drawBreak();
    else if (S.state === 'halftime') {
      const winner = S.score[0] === S.score[1] ? 'UNENTSCHIEDEN' : (S.score[0] > S.score[1] ? TEAMS[0].name + ' FUEHRT' : TEAMS[1].name + ' FUEHRT');
      drawFullOverlay('HALBZEIT', [winner], 'TASTE FUR 2. HALFZEIT');
    } else if (S.state === 'fulltime') {
      const winner = S.score[0] === S.score[1] ? 'UNENTSCHIEDEN' : (S.score[0] > S.score[1] ? TEAMS[0].name + ' GEWINNT' : TEAMS[1].name + ' GEWINNT');
      drawFullOverlay('ENDSTAND', [winner], 'TASTE FUR NEUES SPIEL');
    } else if (S.state === 'pause') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, HUD_H, W, H - HUD_H);
      drawTextC(ctx, 'PAUSE', W / 2, 120, 2, '#ffff00');
    }
  }

  function onAction(code) {
    audio();
    if (code === 'KeyM') {
      S.muted = !S.muted;
      if (master) master.gain.value = S.muted ? 0 : 0.5;
      return;
    }
    if (S.state === 'title') { startMatch(); return; }
    if (S.state === 'halftime') { startSecondHalf(); return; }
    if (S.state === 'fulltime') { S.state = 'title'; return; }
    if (S.state === 'pause') {
      if (code === 'KeyP') S.state = 'play';
      return;
    }
    if (S.state !== 'play') return;
    if (code === 'KeyP') { S.state = 'pause'; return; }
    if (ball.owner && ball.owner.team === 0) {
      if (code === 'Space') humanPass();
      else if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyX') humanShoot();
    }
  }

  window.addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) onAction(e.code);
    keys[e.code] = true;
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', () => {
    if (S.state === 'play') S.state = 'pause';
    for (const k in keys) keys[k] = false;
  });

  let last = 0, acc = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    if (!last) last = t;
    acc += Math.min(0.1, (t - last) / 1000);
    last = t;
    while (acc >= DT) {
      update(DT);
      acc -= DT;
    }
    render();
  }
  requestAnimationFrame(frame);

  window.__fussball = {
    getState: () => ({
      state: S.state,
      half: S.half,
      minute: Math.round(S.minute * 10) / 10,
      score: S.score.slice(),
      ball: { x: Math.round(ball.x * 10) / 10, y: Math.round(ball.y * 10) / 10, vx: Math.round(ball.vx * 10) / 10, vy: Math.round(ball.vy * 10) / 10, ownerTeam: ball.owner ? ball.owner.team : null },
      players: players.length,
    }),
  };
})();
