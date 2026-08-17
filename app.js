import { CONFIG } from '/config.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);

// ---------- static chrome ----------
$('pump').href = CONFIG.pump;
$('x').href = CONFIG.x;
$('dex').href = CONFIG.dexscreener;
const caBtn = $('ca');
caBtn.textContent = CONFIG.ca;
caBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(CONFIG.ca);
    caBtn.textContent = 'COPIED';
    setTimeout(() => { caBtn.textContent = CONFIG.ca; }, 1400);
  } catch (err) {
    caBtn.textContent = CONFIG.ca;
  }
});

const pad2 = (n) => String(n).padStart(2, '0');
function stamp(ms) {
  const t = new Date(ms);
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())} ${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}:${pad2(t.getUTCSeconds())} UTC`;
}
const clockEl = $('clock');
clockEl.textContent = stamp(Date.now());
setInterval(() => { clockEl.textContent = stamp(Date.now()); }, 250);

// ---------- deterministic hash / prng ----------
function hash(a, b) {
  let t = (a ^ (b * 2654435761)) >>> 0;
  t = Math.imul(t ^ (t >>> 16), 569420461) >>> 0;
  t = Math.imul(t ^ (t >>> 15), 1935289751) >>> 0;
  return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
}
const triangleWave = (p) => 1 - 4 * Math.abs(Math.round(p / 2) - p / 2);

// ---------- world / perspective ----------
// normalized floor: X in [-1,1] (left/right), Z in [ZNEAR,ZFAR] (camera depth, small = close)
const ZNEAR = 1.05, ZFAR = 3.35;
function roomHalfWidthAt(z) { return Math.max(0.14, 0.66 - (z - ZNEAR) * 0.185); }
function clampToRoom(x, z) {
  const zc = Math.min(ZFAR - 0.1, Math.max(ZNEAR + 0.05, z));
  const w = roomHalfWidthAt(zc);
  return { X: Math.max(-w, Math.min(w, x)), Z: zc };
}
function seededSpot(seed, zMin = 1.35, zMax = 3.05) {
  const z = zMin + hash(seed, 11) * (zMax - zMin);
  const w = roomHalfWidthAt(z) * 0.82;
  const x = (hash(seed, 12) * 2 - 1) * w;
  return { X: x, Z: z };
}

// ---------- pose library: one flat cutout, squashed/stretched/moved per behavior ----------
const REST = { X: 0, Z: 2.1, lift: 0, sx: 1, sy: 1, tilt: 0, smear: 0, shake: 0, glitch: 0, alpha: 1 };

const POSES = {
  still(t, seed) {
    const p = seededSpot(seed);
    return { ...REST, ...p, sy: 1 + 0.006 * Math.sin(t * 1.9), tilt: 0.004 * Math.sin(t * 0.7) };
  },
  sprawl(t, seed) {
    const p = seededSpot(seed, 1.6, 3.15);
    return { ...REST, ...p, sy: 0.5 + 0.012 * Math.sin(t * 1.2), sx: 1.22 };
  },
  sleep(t, seed) {
    const p = seededSpot(seed, 1.7, 3.25);
    return { ...REST, ...p, sy: 0.9 + 0.02 * Math.sin(t * 0.85), sx: 0.9, tilt: 1.4, lift: -0.28 };
  },
  groom(t, seed) {
    const p = seededSpot(seed, 1.5, 2.9);
    const w = Math.sin(t * 5.2);
    return { ...REST, ...p, sy: 0.84 + 0.05 * Math.abs(w), sx: 1.04, tilt: 0.15 * w };
  },
  pace(t, seed) {
    const zBase = seededSpot(seed, 1.8, 2.9).Z;
    const halfW = roomHalfWidthAt(zBase) * 0.82;
    const cyc = triangleWave(t / 3.4 + hash(seed, 21));
    const dir = Math.sign(triangleWave((t + 1.7) / 3.4 + hash(seed, 21)) - cyc) || 1;
    return { ...REST, Z: zBase, X: cyc * halfW, sx: dir * (0.8 + 0.06 * Math.sin(t * 7)), sy: 1 + 0.03 * Math.abs(Math.sin(t * 7)), lift: 0.012 * Math.abs(Math.sin(t * 7)) };
  },
  frap(t, seed) {
    const ang = t * 4.1 + hash(seed, 31) * 6.28;
    const wobble = 0.55 + 0.3 * Math.sin(t * 0.9);
    const z = clampToRoom(0, 2.15 + Math.cos(ang) * wobble).Z;
    const x = Math.sin(ang) * roomHalfWidthAt(z) * 0.86;
    return { ...REST, X: x, Z: z, sx: Math.cos(ang) >= 0 ? 0.74 : -0.74, sy: 1.05, lift: 0.05 * Math.abs(Math.sin(t * 9)), smear: 0.85, shake: 0.5, tilt: 0.12 * Math.sin(ang) };
  },
  vertical(t, seed) {
    const p = seededSpot(seed, 1.6, 2.85);
    const u = t % 1.7;
    const c = u < 1 ? Math.sin((u / 1) * Math.PI) : 0;
    return { ...REST, ...p, lift: c * 0.75, sy: 1 + c * 0.15 - (u > 1 ? 0.1 : 0), sx: 1 - c * 0.08, shake: c > 0.9 ? 0.2 : 0 };
  },
  spin(t, seed) {
    const p = seededSpot(seed, 1.6, 2.85);
    const u = Math.cos(t * 4.1);
    return { ...REST, ...p, sx: Math.sign(u) * (0.3 + 0.7 * Math.abs(u)), sy: 1 + 0.03 * Math.sin(t * 8.2), tilt: 0.08 * Math.sin(t * 4.1), smear: 0.32 };
  },
  hunt(t, seed) {
    const p = seededSpot(seed, 1.5, 2.75);
    const u = t % 3.4, chase = u < 1.9, drop = !chase && u < 2.7;
    const a = drop ? (u - 1.9) / 0.8 : 0, s = drop ? Math.sin(a * Math.PI) : 0;
    const e = Math.sin(t * 1.6) * 0.2;
    return { ...REST, X: p.X + e, Z: p.Z - s * 0.1, lift: s * 0.6, sy: chase ? 0.95 + 0.05 * Math.sin(t * 3.4) : 1 + s * 0.1, sx: chase ? 1 : 1 - s * 0.06, tilt: chase ? 0.2 * Math.sin(t * 2.2) : 0.1, shake: drop && a > 0.75 ? 0.25 : 0 };
  },
  pounce(t, seed) {
    const p = seededSpot(seed, 2, 3.05);
    const u = Math.min(1, t / 1.6), c = Math.max(0, Math.min(1, (t - 1.7) / 0.45)), h = Math.max(0, Math.min(1, (t - 2.2) / 0.5));
    return { ...REST, X: p.X, Z: p.Z - c * 0.8, lift: c > 0 && h < 1 ? Math.sin(c * Math.PI) * 0.3 : 0, sy: 1 - u * 0.22 + c * 0.3 - h * 0.12, sx: 1 + u * 0.1 - c * 0.06, tilt: 0.05 * Math.sin(t * 6) * (1 - u), smear: c > 0 && h < 1 ? 0.5 : 0, shake: h > 0 && h < 0.4 ? 0.3 : 0 };
  },
  dig(t, seed) {
    const p = seededSpot(seed, 1.7, 2.9);
    const u = Math.sin(t * 8.5);
    return { ...REST, ...p, X: p.X + 0.028 * u, sy: 0.88 + 0.04 * u, sx: 1.02, tilt: 0.05 * u };
  },
  stare(t, seed) {
    const p = seededSpot(seed, 1.4, 2.1);
    return { ...REST, ...p };
  },
  lens(t) {
    const T = Math.min(1, t / 2.4), u = Math.max(0, Math.min(1, (t - 7.5) / 2.5));
    const zTarget = 1.15;
    const z = 2.1 - (2.1 - zTarget) * T + (2.1 - zTarget) * u;
    return { ...REST, X: 0.05 * Math.sin(t * 0.9), Z: z, sy: 1 + 0.02 * Math.sin(t * 2.3), glitch: z < 1.35 ? 0.9 : 0.15, shake: z < 1.25 ? 0.18 : 0 };
  },
  under(t, seed) {
    const side = hash(seed, 41) > 0.5 ? 1 : -1;
    const u = Math.min(1, t / 2.2), c = Math.max(0, Math.min(1, (t - 6.4) / 2.4)), h = u - c;
    const z = 2.5 - 1.6 * h;
    return { ...REST, X: side * (0.35 + h * roomHalfWidthAt(z)), Z: z, sx: side * 0.85, alpha: 1, glitch: h > 0.9 ? 0.25 : 0 };
  }
};
function poseFor(id, t, seed) { return (POSES[id] || POSES.still)(t, seed >>> 0); }

// ---------- behavior schedule: dog-flavored, same tap/weight/duration structure as the reference site ----------
const TAP_RATES = {
  hunt: { rate: 0.0092, discharge: 0.86 },
  locomote: { rate: 0.0084, discharge: 0.9 },
  groom: { rate: 0.0042, discharge: 0.72 },
  probe: { rate: 0.0061, discharge: 0.8 },
  rest: { rate: 0.0046, discharge: 1 }
};
const ACTS = [
  { id: 'hunt', tap: 'hunt', label: 'CHASING NOTHING', secs: [9, 15], weight: 3 },
  { id: 'pounce', tap: 'hunt', label: 'POUNCE AT NOTHING', secs: [5, 8], weight: 2 },
  { id: 'dig', tap: 'hunt', label: 'DIGGING NOTHING', secs: [6, 10], weight: 1 },
  { id: 'frap', tap: 'locomote', label: 'ZOOMIES', secs: [7, 12], weight: 3 },
  { id: 'pace', tap: 'locomote', label: 'PACING', secs: [12, 20], weight: 2 },
  { id: 'vertical', tap: 'locomote', label: 'JUMPING', secs: [4, 6], weight: 1 },
  { id: 'spin', tap: 'locomote', label: 'CHASING TAIL', secs: [5, 8], weight: 1 },
  { id: 'groom', tap: 'groom', label: 'GROOMING', secs: [10, 16], weight: 3 },
  { id: 'lens', tap: 'probe', label: 'AT THE LENS', secs: [8, 13], weight: 3 },
  { id: 'stare', tap: 'probe', label: 'STARING', secs: [12, 20], weight: 2 },
  { id: 'under', tap: 'probe', label: 'OFF CAMERA', secs: [7, 12], weight: 1 },
  { id: 'sleep', tap: 'rest', label: 'SLEEPING', secs: [18, 30], weight: 3 },
  { id: 'sprawl', tap: 'rest', label: 'SPRAWL', secs: [14, 22], weight: 2 }
];
const STILL_ACT = { id: 'still', label: 'STILL' };

function dayRateCurve(hour) {
  const bump = (center) => { const d = ((hour - center + 36) % 24) - 12; return Math.exp(-(d * d) / 8.8); };
  return 0.78 + 0.8 * (bump(6) + bump(18));
}

const DAY_MS = 86400000;
function dayStart(ms) { return Math.floor(ms / DAY_MS) * DAY_MS; }

function buildDaySchedule(nowMs) {
  const t0 = dayStart(nowMs);
  const daySeed = Math.floor(t0 / DAY_MS) >>> 0;
  const level = {};
  for (const tap of Object.keys(TAP_RATES)) level[tap] = hash(daySeed, tap.charCodeAt(0)) * 0.45;

  const episodes = [];
  let simSec = 0, idx = 0, cooldownUntil = 0, justGroomed = false;

  function step() {
    const rate = dayRateCurve((simSec / 3600) % 24);
    for (const tap of Object.keys(TAP_RATES)) level[tap] += TAP_RATES[tap].rate * rate;
    simSec += 1;
    if (simSec < cooldownUntil) return;

    let firingTap = null;
    for (const tap of Object.keys(TAP_RATES)) {
      if (level[tap] >= 1 && (!firingTap || level[tap] > level[firingTap])) firingTap = tap;
    }
    if (justGroomed && level.locomote >= 1 && hash(daySeed, idx * 7 + 4) < 0.7) firingTap = 'locomote';
    if (!firingTap) return;

    const pool = ACTS.filter((a) => a.tap === firingTap);
    const totalWeight = pool.reduce((s, a) => s + a.weight, 0);
    let roll = hash(daySeed, idx * 7 + 1) * totalWeight;
    let picked = pool[pool.length - 1];
    for (const a of pool) { roll -= a.weight; if (roll <= 0) { picked = a; break; } }

    const durRoll = hash(daySeed, idx * 7 + 2);
    const dur = picked.secs[0] + durRoll * (picked.secs[1] - picked.secs[0]);
    episodes.push({ index: idx, act: picked, tap: firingTap, seed: (daySeed ^ (idx * 2654435761)) >>> 0, start: t0 + simSec * 1000, end: t0 + (simSec + dur) * 1000 });

    level[firingTap] = Math.max(0, level[firingTap] - TAP_RATES[firingTap].discharge);
    justGroomed = firingTap === 'groom';
    if (justGroomed) level.locomote = Math.max(level.locomote, 0.94);

    const gap = 6 + hash(daySeed, idx * 7 + 3) * 9;
    cooldownUntil = simSec + dur + gap;
    idx += 1;
  }

  function advanceTo(ms) {
    const targetSec = Math.min(DAY_MS, Math.max(0, ms - t0)) / 1000;
    let guard = 0;
    while (simSec < targetSec && guard++ < DAY_MS) step();
    return read(ms);
  }
  function read(ms) {
    const last = episodes[episodes.length - 1];
    const active = last && ms < last.end ? last : null;
    let pressure = 0;
    for (const tap of Object.keys(TAP_RATES)) pressure = Math.max(pressure, level[tap]);
    return { act: active ? active.act : STILL_ACT, episode: active, since: active ? ms - active.start : 0, pressure: Math.min(1, pressure), count: episodes.length, t0 };
  }
  advanceTo(nowMs);
  return { advance: advanceTo, t0, seed: daySeed };
}

// ---------- stage: procedural padded cell + squash/stretch dog cutout ----------
function createStage(canvas) {
  const ctx = canvas.getContext('2d');
  let cw = 0, ch = 0, dpr = 1;
  let roomLayer = null, roomCw = 0, roomCh = 0;
  let anchorX = 0, anchorY = 2.0;

  const dogImg = new Image();
  let dogReady = false;
  dogImg.onload = () => { dogReady = true; };
  dogImg.src = '/assets/dog.png';

  let day = buildDaySchedule(Date.now());
  let curX = 0, curZ = 2.1;
  let shakeUntil = 0, shakeMag = 0;
  const trail = [];
  let lastPose = { ...REST };
  let lastState = null;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = rect.width; ch = rect.height;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    roomLayer = null;
  }

  const HORIZON_FRAC = 0.35;

  function buildRoom() {
    const off = document.createElement('canvas');
    off.width = Math.round(cw); off.height = Math.round(ch);
    const rc = off.getContext('2d');
    const horizonY = ch * HORIZON_FRAC;
    const vpX = cw * 0.5;

    // walls: pads grow larger and spread wider toward the horizon (near), shrink toward the top (far)
    const wallGrad = rc.createLinearGradient(0, 0, 0, horizonY);
    wallGrad.addColorStop(0, '#232320');
    wallGrad.addColorStop(1, '#3c3b33');
    rc.fillStyle = wallGrad;
    rc.fillRect(0, 0, cw, horizonY);

    const rows = 6;
    for (let r = 0; r < rows; r++) {
      const t0 = r / rows, t1 = (r + 1) / rows;
      const y0 = horizonY * Math.pow(t0, 1.7);
      const y1 = horizonY * Math.pow(t1, 1.7);
      const rowH = y1 - y0;
      const padSize = Math.max(12, rowH * 0.9);
      const spread = 0.22 + 1.3 * t1;
      const cols = 3 + Math.round(4 * t1);
      for (let c = -cols; c <= cols; c++) {
        const x = vpX + (c / cols) * cw * 0.6 * spread;
        const y = y0 + rowH / 2;
        if (x < -padSize || x > cw + padSize) continue;
        const seed = hash(r * 13 + 3, c * 31 + 7);
        const base = 44 + Math.round(22 * t1) + Math.round(seed * 10);
        rc.save();
        rc.translate(x, y);
        rc.fillStyle = `rgb(${base + 20},${base + 18},${base + 12})`;
        rc.beginPath();
        rc.roundRect(-padSize / 2, -padSize / 2, padSize, padSize, padSize * 0.16);
        rc.fill();
        rc.fillStyle = `rgba(255,255,255,${0.05 + 0.05 * t1})`;
        rc.beginPath();
        rc.arc(-padSize * 0.2, -padSize * 0.22, Math.max(1, padSize * 0.15), 0, Math.PI * 2);
        rc.fill();
        rc.fillStyle = `rgba(0,0,0,${0.32 + 0.12 * t1})`;
        rc.beginPath();
        rc.arc(padSize * 0.16, padSize * 0.18, Math.max(1.2, padSize * 0.07), 0, Math.PI * 2);
        rc.fill();
        if (hash(r * 31 + 2, c * 7 + 5) > 0.94) {
          rc.fillStyle = `rgba(120,20,20,${0.15 + seed * 0.15})`;
          rc.beginPath();
          rc.ellipse(padSize * 0.12, padSize * 0.06, padSize * 0.22, padSize * 0.13, 0.4, 0, Math.PI * 2);
          rc.fill();
        }
        rc.restore();
      }
    }

    // recessed door on the left wall, converging to the same vanishing point
    rc.fillStyle = 'rgba(0,0,0,0.42)';
    rc.beginPath();
    rc.moveTo(vpX - cw * 0.1, horizonY * 0.5);
    rc.lineTo(vpX - cw * 0.19, horizonY * 0.6);
    rc.lineTo(vpX - cw * 0.18, horizonY * 0.99);
    rc.lineTo(vpX - cw * 0.08, horizonY * 0.99);
    rc.closePath();
    rc.fill();

    // floor plane, distinct from the walls, with seams converging to the horizon
    const floorGrad = rc.createLinearGradient(0, horizonY, 0, ch);
    floorGrad.addColorStop(0, '#34322b');
    floorGrad.addColorStop(0.5, '#211f1a');
    floorGrad.addColorStop(1, '#121110');
    rc.fillStyle = floorGrad;
    rc.fillRect(0, horizonY, cw, ch - horizonY);

    rc.strokeStyle = 'rgba(0,0,0,0.22)';
    rc.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      rc.beginPath();
      rc.moveTo(vpX, horizonY);
      rc.lineTo(vpX + i * cw * 0.16, ch);
      rc.stroke();
    }

    const vg = rc.createRadialGradient(cw / 2, horizonY + (ch - horizonY) * 0.3, ch * 0.1, cw / 2, ch * 0.52, ch * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.58)');
    rc.fillStyle = vg;
    rc.fillRect(0, 0, cw, ch);

    roomLayer = off; roomCw = cw; roomCh = ch;
  }

  function worldToScreen(X, Z, panX) {
    const horizonY = ch * HORIZON_FRAC, floorY = ch * 0.965;
    const focal = floorY - horizonY;
    const y = horizonY + focal / (Z / ZNEAR);
    const halfW = roomHalfWidthAt(Z);
    const x = cw / 2 + (X - panX) / (halfW || 1) * (roomHalfWidthAt(ZNEAR) * cw * 0.62) * (ZNEAR / Z);
    const scale = (ZNEAR / Z);
    return { x, y, scale };
  }

  function drawShadow(x, y, w) {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.5, w * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw(now) {
    if (!roomLayer || roomCw !== Math.round(cw) || roomCh !== Math.round(ch)) buildRoom();
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(roomLayer, 0, 0, cw, ch);

    const state = day.advance(Date.now());
    const ep = state.episode;
    const pose = poseFor(state.act.id, ep ? (Date.now() - ep.start) / 1000 : 0, ep ? ep.seed : day.seed);

    const easeRate = state.act.id === 'frap' ? 13 : state.act.id === 'under' ? 5 : 3.6;
    const dt = Math.min(0.05, 1 / 60);
    const k = 1 - Math.exp(-easeRate * dt);
    curX += (pose.X - curX) * k;
    curZ += (pose.Z - curZ) * k;
    const clamped = clampToRoom(curX, curZ);

    const deadzone = (cw < 760 ? 0.05 : 0.11) * roomHalfWidthAt(clamped.Z);
    if (clamped.X > anchorX + deadzone) anchorX = clamped.X - deadzone;
    else if (clamped.X < anchorX - deadzone) anchorX = clamped.X + deadzone;

    const proj = worldToScreen(clamped.X, clamped.Z, anchorX);
    const baseH = ch * 0.74;
    const dogH = baseH * proj.scale * Math.abs(pose.sy) * (cw < 760 ? 1.1 : 1);
    const aspect = dogReady && dogImg.naturalWidth ? dogImg.naturalWidth / dogImg.naturalHeight : 0.56;
    const dogW = dogH * aspect * Math.abs(pose.sx) * (pose.sx < 0 ? -1 : 1);
    const liftPx = pose.lift * dogH * 0.5;
    const grid = Math.max(1, proj.scale * 2.2);
    const px = Math.round(proj.x / grid) * grid;
    const py = Math.round((proj.y - liftPx) / grid) * grid;

    drawShadow(px, proj.y, Math.abs(dogW) * 0.7 * Math.max(0.3, 1 - pose.lift * 1.1));

    trail.unshift({ x: px, y: py, w: dogW, h: dogH, r: pose.tilt });
    trail.length = 10;
    if (pose.smear > 0 && dogReady) {
      for (let i = 0; i < 3; i++) {
        const s = trail[(i + 1) * 3];
        if (!s) continue;
        ctx.save();
        ctx.globalAlpha = pose.smear * (0.22 - i * 0.06);
        ctx.translate(s.x, s.y);
        ctx.rotate(s.r);
        ctx.drawImage(dogImg, -s.w / 2, -s.h, s.w, s.h);
        ctx.restore();
      }
    }

    if (dogReady) {
      ctx.save();
      ctx.globalAlpha = pose.alpha;
      ctx.translate(px, py);
      ctx.rotate(pose.tilt);
      ctx.drawImage(dogImg, -dogW / 2, -dogH, dogW, dogH);
      ctx.restore();
    }

    if (pose.shake > 0 && Date.now() > shakeUntil) { shakeMag = pose.shake; shakeUntil = Date.now() + 260; }
    document.body.classList.toggle('glitch', !reduceMotion && pose.glitch > 0.5);

    if (!lastState || lastState.act.label !== state.act.label || !!lastState.episode !== !!state.episode) {
      const actEl = $('act');
      actEl.textContent = state.act.label;
      actEl.classList.toggle('idle', !state.episode);
    }
    lastState = state;
    $('fill').style.width = `${Math.round(state.pressure * 100)}%`;
    $('gauge').classList.toggle('full', state.pressure >= 0.99);

    lastPose = pose;
    return state;
  }

  function loop() {
    draw(performance.now());
    requestAnimationFrame(loop);
  }

  function mount() {
    resize();
    window.addEventListener('resize', resize);
    if (reduceMotion) { draw(performance.now()); } else { loop(); }
  }

  return { mount, canvas, get lastState() { return lastState; } };
}

const stage = createStage($('stage'));
stage.mount();

// ---------- ask / capture ----------
let asksCount = 0;
try { asksCount = parseInt(localStorage.getItem('wwdd_asks') || '0', 10) || 0; } catch (err) { asksCount = 0; }

function drawSlate(dataUrl, label, timeStr, count) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = 1200, bandH = 128;
      const h = Math.round((img.height / img.width) * w);
      const c = document.createElement('canvas');
      c.width = w; c.height = h + bandH;
      const cx = c.getContext('2d');
      cx.fillStyle = '#000'; cx.fillRect(0, 0, c.width, c.height);
      cx.drawImage(img, 0, 0, w, h);
      cx.fillStyle = '#d8f000'; cx.fillRect(0, h, w, 3);
      cx.font = "700 46px 'Familjen Grotesk', sans-serif";
      cx.fillStyle = '#e8e8e2';
      cx.fillText(label, 40, h + 64);
      cx.font = "400 22px 'Azeret Mono', monospace";
      cx.fillStyle = '#8e8e86';
      cx.fillText(timeStr, 40, h + 100);
      cx.textAlign = 'right';
      cx.fillText(count ? `${CONFIG.ticker}  #${count}` : CONFIG.ticker, w - 40, h + 100);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const askBtn = $('ask'), dialog = $('answer'), shot = $('shot');
askBtn.addEventListener('click', async () => {
  askBtn.disabled = true;
  const time = stamp(Date.now());
  const state = stage.lastState;
  const label = state ? state.act.label : 'STILL';
  asksCount += 1;
  try { localStorage.setItem('wwdd_asks', String(asksCount)); } catch (err) { /* storage unavailable */ }

  let dataUrl = '';
  try { dataUrl = stage.canvas.toDataURL('image/png'); } catch (err) { dataUrl = ''; }

  $('verdict').textContent = label;
  $('stamp').textContent = `${time}  ·  #${asksCount}`;
  if (dataUrl) {
    shot.src = dataUrl;
    shot.hidden = false;
    shot.dataset.slate = await drawSlate(dataUrl, label, time, asksCount);
  } else {
    shot.hidden = true;
  }
  dialog.showModal();
  askBtn.disabled = false;
});

$('close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
$('save').addEventListener('click', () => {
  const url = shot.dataset.slate || shot.src;
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.download = `what-would-dog-do-${Date.now()}.png`;
  a.click();
});
