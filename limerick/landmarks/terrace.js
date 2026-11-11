// Georgian Newtown Pery: four red-brick terraces on a strict grid, south-east of Sarsfield Bridge on the east bank.
// Four storeys over basement, flat parapets, tall sash windows that get smaller on the higher floors, coloured doors
// under semicircular fanlights, stone steps over the basement area and black iron railings.
// One house in row B holds the lit kitchen used by c5/c6 (a real window opening with a small room behind it, frost in a
// Limerick-lace pattern in the glass corners, a phone propped on the table). One window in row D, across the rooftops,
// is the "call back" window that lights up at the end of c5.
//
// Region: x 60..230, z 135..300. Streets run east-west (along x); rows face each other across them.
//   row A  front z=172 faces +z (south)   body z 158..172
//   street 1 (kitchen street)  z 172..196, centre z=184
//   row B  front z=196 faces -z (north)   body z 196..210   <- kitchen: house 4, middle ground-floor window, x=109
//   mews   z 210..220
//   row C  front z=234 faces +z           body z 220..234
//   street 2  z 234..258
//   row D  front z=258 faces -z           body z 258..272   <- call-back window
// Scale as elsewhere: a person is about 4 units tall; one storey is about 5 units.
//
// HANDLE API (used by chapters c5 and c6):
//   kitchen: { window: V (centre of the kitchen window on the facade), phone: V (centre of the phone screen) }
//   setScreen(draw)        redraw the 3D phone screen: draw(g, w, h) on a 256x512 canvas
//   callback: { pos: V, glow: material (opacity 0..1), light: PointLight (intensity 0 = off) }
//   steam                  Group of steam puffs over the teapot (set .visible; it animates itself only while visible)
//   kitchenLight           the warm PointLight in the kitchen (always on)
//   shots                  camera shots for the kitchen chapters
import { THREE, scene, box, M, canvasTex } from '../core.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Local seeded PRNG so this landmark never disturbs the shared city layout (core.js rnd()).
function prng(seed) {
  return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const R = prng(1769); // the year of the Newtown Pery plan

// ---------- dimensions (world units) ----------
const HW = 10, N = 16, X0 = 64, X1 = X0 + N * HW, DEPTH = 14, H = 23;
const BAYS = [1.67, 5, 8.33];                 // bay centres from the viewer's left edge of a house
const WIN_W = 2.0;
const FLOORS = [[3.4, 7.0], [8.6, 12.8], [14.1, 17.1], [18.4, 20.6]]; // ground, first (tallest), second, third
const BASEMENT = [0.5, 2.2], GROUND = 2.6;   // ground-floor level sits over a half-sunk basement
const ROWS = [
  { id: 'A', front: 172, facing: 1 },
  { id: 'B', front: 196, facing: -1 },
  { id: 'C', front: 234, facing: 1 },
  { id: 'D', front: 258, facing: -1 },
];
const KITCHEN = { row: 'B', house: 4, bay: 1 };                // world x = 109
const CALLBACK = { row: 'D', house: 6, bay: 1, floor: 2 };     // second floor, world x = 129
const BRICKS = ['#8a3b2a', '#7d3426', '#93432f', '#74301f', '#86402c', '#7a3a2c'];
const DOORS = ['#1d3b5a', '#6b1e24', '#1f4a35', '#c9a227', '#141414', '#3a6f8f', '#7a2e4f', '#2d5d3a'];
const WARM = ['#ffd38a', '#ffc070', '#ffe2b0', '#f6b26b'];
const CURTAINS = ['rgba(120,30,30,.7)', 'rgba(60,70,40,.65)', 'rgba(140,90,40,.6)', 'rgba(40,50,90,.6)'];

const houseX = (i) => X0 + i * HW;
/** World x of a bay, given which way the row faces (the viewer's left is west for +z rows, east for -z rows). */
const bayX = (row, i, b) => (row.facing > 0 ? houseX(i) + BAYS[b] : houseX(i) + HW - BAYS[b]);

// ---------- facade painting ----------
/** Paint one house into a facade canvas. px/W/Hp are canvas pixels; units are world units, y up from the ground. */
function paintHouse(g, px, W, Hp, h, emit, detail) {
  const sx = W / HW, sy = Hp / H;
  const rect = (x0, y0, x1, y1) => g.fillRect(px + x0 * sx, Hp - y1 * sy, (x1 - x0) * sx, (y1 - y0) * sy);
  if (!emit) {
    g.fillStyle = h.brick; rect(0, 0, HW, H);
    // brick courses: individual bricks on the detailed facade, tinted noise elsewhere
    if (detail) {
      const ch = 0.27, bl = 0.72;
      for (let r = 0, y = 0; y < H; r++, y += ch) for (let x = (r % 2) * -bl / 2; x < HW; x += bl) {
        const v = R(); g.fillStyle = v < 0.33 ? 'rgba(0,0,0,.14)' : v < 0.66 ? 'rgba(255,190,150,.07)' : 'rgba(40,10,0,.06)';
        rect(Math.max(0, x + 0.03), y + 0.03, Math.min(HW, x + bl - 0.03), y + ch - 0.03);
      }
      g.fillStyle = 'rgba(210,200,185,.18)';
      for (let y = 0; y < H; y += ch) rect(0, y, HW, y + 0.025);
    } else {
      for (let k = 0; k < 140; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,200,160'},${R() * 0.1})`; const x = R() * HW, y = R() * H; rect(x, y, x + 0.8, y + 0.3); }
    }
    g.fillStyle = 'rgba(0,0,0,.35)'; rect(HW - 0.06, 0, HW, H);              // party-wall line
    g.fillStyle = '#d6cdb8'; rect(0, GROUND - 0.25, HW, GROUND + 0.05);       // plinth band over the basement
    g.fillStyle = '#d9d0bd'; rect(0, H - 0.45, HW, H);                       // parapet coping
    g.fillStyle = 'rgba(0,0,0,.25)'; rect(0, H - 0.55, HW, H - 0.45);
  } else { g.fillStyle = '#000'; rect(0, 0, HW, H); }

  // a lit pane: warm light, a little darker towards the sill, curtains drawn back at the sides
  const litGlass = (xc, y0, y1, col) => {
    const a = xc - WIN_W / 2 + 0.07, b = xc + WIN_W / 2 - 0.07;
    g.fillStyle = col; rect(a, y0 + 0.07, b, y1 - 0.07);
    const gr = g.createLinearGradient(0, Hp - y1 * sy, 0, Hp - y0 * sy); gr.addColorStop(0, 'rgba(255,240,210,.15)'); gr.addColorStop(1, 'rgba(110,50,15,.45)');
    g.fillStyle = gr; rect(a, y0 + 0.07, b, y1 - 0.07);
    g.fillStyle = h.curtain; rect(a, y0 + 0.07, a + 0.36, y1 - 0.07); rect(b - 0.36, y0 + 0.07, b, y1 - 0.07);
  };
  const win = (xc, y0, y1, key) => {
    const lit = h.lit[key];
    if (h.hole === key) { // the kitchen: a real opening, painted transparent
      if (!emit) { g.clearRect(px + (xc - 1.1) * sx, Hp - (y1 + 0.05) * sy, 2.2 * sx, (y1 - y0 + 0.1) * sy); g.fillStyle = '#d9d0bd'; rect(xc - 1.3, y0 - 0.4, xc + 1.3, y0 - 0.06); }
      return;
    }
    const hw = WIN_W / 2, mid = y0 + (y1 - y0) * 0.5, small = y1 - y0 < 2.5;
    if (!emit) {
      g.fillStyle = 'rgba(255,170,130,.18)'; rect(xc - hw - 0.25, y1 + 0.05, xc + hw + 0.25, y1 + 0.5); // flat gauged-brick arch
      g.fillStyle = '#e8e4da'; rect(xc - hw - 0.08, y0 - 0.05, xc + hw + 0.08, y1 + 0.05);           // painted frame
      if (lit) litGlass(xc, y0, y1, lit);
      else {
        const gr = g.createLinearGradient(0, Hp - y1 * sy, 0, Hp - y0 * sy); gr.addColorStop(0, '#2b3546'); gr.addColorStop(1, '#0f141d');
        g.fillStyle = gr; rect(xc - hw + 0.07, y0 + 0.07, xc + hw - 0.07, y1 - 0.07);
      }
      g.fillStyle = '#d9d0bd'; rect(xc - hw - 0.25, y0 - 0.3, xc + hw + 0.25, y0 - 0.05);           // stone sill
    } else if (lit) litGlass(xc, y0, y1, lit);
    // glazing bars: six over six (three over three on the small top windows); black on the emissive map
    g.fillStyle = emit ? '#000' : '#e8e4da';
    const bw = detail ? 0.06 : 0.1;
    for (const f of [-1 / 3, 1 / 3]) rect(xc + f * WIN_W - bw / 2, y0, xc + f * WIN_W + bw / 2, y1);
    rect(xc - hw, mid - bw, xc + hw, mid + bw);
    if (!small) { rect(xc - hw, (mid + y1) / 2 - bw / 2, xc + hw, (mid + y1) / 2 + bw / 2); rect(xc - hw, (y0 + mid) / 2 - bw / 2, xc + hw, (y0 + mid) / 2 + bw / 2); }
  };
  // door with fanlight in the viewer's left bay
  const dx = BAYS[0];
  if (!emit) {
    g.fillStyle = '#e3dccb'; rect(dx - 1.3, GROUND, dx + 1.3, 7.75);                        // door surround
    g.fillStyle = h.door; rect(dx - 0.9, GROUND, dx + 0.9, 6.3);
    g.fillStyle = 'rgba(0,0,0,.28)';
    for (const [a, b] of [[2.9, 4.0], [4.25, 6.05]]) { rect(dx - 0.75, a, dx - 0.1, b); rect(dx + 0.1, a, dx + 0.75, b); }
    g.fillStyle = '#d8b25a'; rect(dx - 0.08, 4.7, dx + 0.08, 4.86);                        // brass knocker
  }
  const cx = px + dx * sx, cy = Hp - 6.35 * sy, r = 0.88 * sx;
  g.save(); g.translate(cx, cy); g.scale(1, sy / sx);
  g.beginPath(); g.arc(0, 0, r, Math.PI, 0); g.closePath(); g.fillStyle = emit ? (h.fan ? '#ffc979' : '#000') : (h.fan ? '#f2c27a' : '#1a202a'); g.fill();
  g.strokeStyle = emit ? '#000' : '#efe9dc'; g.lineWidth = Math.max(1, r * 0.08);
  for (let k = 1; k < 6; k++) { const a = Math.PI + (k / 6) * Math.PI; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.stroke(); }
  g.beginPath(); g.arc(0, 0, r * 0.35, Math.PI, 0); g.stroke();
  g.restore();
  // windows
  win(BAYS[1], FLOORS[0][0], FLOORS[0][1], '0.1'); win(BAYS[2], FLOORS[0][0], FLOORS[0][1], '0.2');
  for (let f = 1; f < 4; f++) for (let b = 0; b < 3; b++) win(BAYS[b], FLOORS[f][0], FLOORS[f][1], `${f}.${b}`);
  // basement windows (half hidden down in the area)
  for (const b of [1, 2]) {
    if (!emit) { g.fillStyle = '#0c1016'; rect(BAYS[b] - 0.9, BASEMENT[0], BAYS[b] + 0.9, BASEMENT[1]); }
    else if (h.lit[`b.${b}`]) { g.fillStyle = '#7a5530'; rect(BAYS[b] - 0.8, BASEMENT[0], BAYS[b] + 0.8, BASEMENT[1]); }
  }
}
function houseData(row, i) {
  const lit = {};
  for (let f = 0; f < 4; f++) for (let b = 0; b < 3; b++) if (R() < (f === 0 ? 0.42 : 0.3)) lit[`${f}.${b}`] = WARM[Math.floor(R() * WARM.length)];
  for (const b of [1, 2]) lit[`b.${b}`] = R() < 0.25;
  const h = { brick: BRICKS[Math.floor(R() * BRICKS.length)], door: DOORS[Math.floor(R() * DOORS.length)], lit, fan: R() < 0.7, curtain: CURTAINS[Math.floor(R() * CURTAINS.length)] };
  if (row.id === KITCHEN.row && i === KITCHEN.house) { h.hole = `0.${KITCHEN.bay}`; h.lit['0.2'] = '#ffcf8a'; h.lit['1.1'] = null; h.fan = true; h.door = '#1f4a35'; }
  if (row.id === CALLBACK.row && i === CALLBACK.house) h.lit[`${CALLBACK.floor}.${CALLBACK.bay}`] = null; // dark until c5 calls back
  return h;
}
/** Paint a run of houses [i0, i1) of a row into a facade texture pair. */
function paintSegment(row, houses, i0, i1, pxPerHouse, pxH, detail) {
  const n = i1 - i0, Wp = n * pxPerHouse;
  const draw = (emit) => (g) => {
    for (let i = i0; i < i1; i++) {
      const k = row.facing > 0 ? i - i0 : i1 - 1 - i; // -z rows read east to west for the viewer
      paintHouse(g, k * pxPerHouse, pxPerHouse, pxH, houses[i], emit, detail);
    }
  };
  return { map: canvasTex(Wp, pxH, draw(false)), emissiveMap: canvasTex(Wp, pxH, draw(true)) };
}

// ---------- materials shared by all rows ----------
const sideMat = new THREE.MeshStandardMaterial({ color: 0x6e3326, roughness: 0.95 });
const roofMat = M.roof;   // the flat roofs behind the parapets: the city slate with a faint dusting of snow (core.js)
const iron = new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.5, metalness: 0.4 });
const snowMat = new THREE.MeshStandardMaterial({ color: 0xeef3fa, roughness: 1 });
// rear elevations: plainer brick with a few lit windows, one texture repeated along every row
const back = (() => {
  const W = 512, Hp = 256, lit = [];
  for (let i = 0; i < 4 * 2 * 4; i++) lit.push(R() < 0.28);
  const draw = (emit) => (g) => {
    g.fillStyle = emit ? '#000' : '#6a3124'; g.fillRect(0, 0, W, Hp);
    for (let hh = 0; hh < 4; hh++) for (let f = 0; f < 4; f++) for (let b = 0; b < 2; b++) {
      const on = lit[(hh * 4 + f) * 2 + b], x = hh * 128 + 28 + b * 52, y = Hp - (FLOORS[f][1] / H) * Hp;
      g.fillStyle = on ? '#ffc778' : emit ? '#000' : '#141a24'; g.fillRect(x, y, 22, ((FLOORS[f][1] - FLOORS[f][0]) / H) * Hp * 0.9);
    }
  };
  return { map: canvasTex(W, Hp, draw(false)), emissiveMap: canvasTex(W, Hp, draw(true)) };
})();
const backMat = (n) => {
  const map = back.map.clone(), em = back.emissiveMap.clone();
  for (const t of [map, em]) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = n / 4; t.needsUpdate = true; }
  return new THREE.MeshStandardMaterial({ map, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.95 });
};

export default {
  name: 'terrace',
  build(w) {
    const group = new THREE.Group();
    w.reserve(145, 217.5, 170, 165); // the whole quarter: terraces, streets and the camera's standing ground
    const rowsById = {};

    // ---------- the terrace rows ----------
    for (const row of ROWS) {
      rowsById[row.id] = row;
      row.houses = Array.from({ length: N }, (_, i) => houseData(row, i));
      const zc = row.front - row.facing * DEPTH / 2;
      // row B is split so the kitchen house and its neighbours get a sharp facade and a real window opening
      const segs = row.id === KITCHEN.row ? [[0, 3, false], [3, 6, true], [6, N, false]] : [[0, N, false]];
      for (const [i0, i1, detail] of segs) {
        const n = i1 - i0;
        const tex = detail ? paintSegment(row, row.houses, i0, i1, 680, 1024, true) : paintSegment(row, row.houses, i0, i1, 128, 256, false);
        const front = new THREE.MeshStandardMaterial({ ...tex, emissive: 0xffffff, emissiveIntensity: detail ? 0.5 : 0.85, roughness: 0.9, alphaTest: detail ? 0.5 : 0 });
        const mats = [sideMat, sideMat, roofMat, M.dark, sideMat, sideMat];
        mats[row.facing > 0 ? 4 : 5] = front; mats[row.facing > 0 ? 5 : 4] = backMat(n);
        const b = box(n * HW, H, DEPTH, mats);
        b.position.set(houseX(i0) + (n * HW) / 2, H / 2, zc);
        b.userData.cls = 'building'; group.add(b);
      }
    }

    // ---------- instanced street furniture: steps, railings, chimneys, snow on the parapets ----------
    const unit = new THREE.BoxGeometry(1, 1, 1), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const steps = [], rails = [], stacks = [], snow = [];
    const put = (list, x, y, z, sx, sy, sz) => list.push(m4.compose(p.set(x, y, z), q, s.set(sx, sy, sz)).clone());
    for (const row of ROWS) {
      const f = row.facing, area = row.front + f * 3;
      const doors = [];
      for (let i = 0; i < N; i++) {
        const dx = bayX(row, i, 0); doors.push(dx);
        // stone stoop bridging the area, then two steps down to the pavement
        put(steps, dx, GROUND / 2, row.front + f * 0.8, 2.6, GROUND, 1.6);
        put(steps, dx, GROUND * 0.6 / 2, row.front + f * 2.1, 2.6, GROUND * 0.6, 1.0);
        put(steps, dx, GROUND * 0.3 / 2, row.front + f * 3.0, 2.6, GROUND * 0.3, 0.9);
        // chimney stack on the party wall, set back from the parapet
        put(stacks, houseX(i) + (i === 0 ? 0.9 : 0), H + 1.6, row.front - f * DEPTH * 0.45, 1.6, 3.2, 3.6);
      }
      // railings along the area edge, broken at each set of steps
      let x = X0 + 0.2;
      const gaps = doors.map((d) => [d - 1.45, d + 1.45]).sort((a, b) => a[0] - b[0]);
      const runs = []; for (const [a, b] of gaps) { if (a > x) runs.push([x, a]); x = b; } if (x < X1 - 0.2) runs.push([x, X1 - 0.2]);
      for (const [a, b] of runs) {
        for (let xx = a; xx <= b; xx += 0.42) put(rails, xx, 1.1, area, 0.07, 2.2, 0.07);
        put(rails, (a + b) / 2, 2.15, area, b - a, 0.09, 0.12); put(rails, (a + b) / 2, 0.35, area, b - a, 0.07, 0.1);
        put(snow, (a + b) / 2, 2.24, area, b - a, 0.08, 0.16);
      }
      put(snow, (X0 + X1) / 2, H + 0.07, row.front - f * 0.3, X1 - X0, 0.14, 0.7);           // snow along the parapet coping
    }
    const inst = (list, geo, mat, cls) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((mm, i) => im.setMatrixAt(i, mm));
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.userData.cls = cls; group.add(im); return im;
    };
    inst(steps, unit, new THREE.MeshStandardMaterial({ color: 0x9d988c, roughness: 0.95 }), 'building');
    inst(rails, unit, iron, 'building');
    inst(stacks, unit, sideMat, 'building');
    inst(snow, unit, snowMat, 'snow');

    // ---------- streets: dark basement areas, snowy pavements, the road ----------
    const flat = (x0, x1, z0, z1, y, mat, cls) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat); m.rotation.x = -Math.PI / 2;
      m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.userData.cls = cls; group.add(m); return m;
    };
    const areaMat = new THREE.MeshStandardMaterial({ color: 0x07090d, roughness: 1 });
    const paveMat = new THREE.MeshStandardMaterial({ color: 0x8e99ab, roughness: 1 });
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x4d5668, roughness: 1 });
    for (const row of ROWS) { const a = row.front, b = row.front + row.facing * 3; flat(X0, X1, Math.min(a, b), Math.max(a, b), 0.03, areaMat, 'ground'); }
    for (const [z0, z1] of [[172, 196], [234, 258]]) {
      flat(X0 - 4, X1 + 4, z0 + 3, z0 + 8, 0.05, paveMat, 'ground'); flat(X0 - 4, X1 + 4, z1 - 8, z1 - 3, 0.05, paveMat, 'ground');
      flat(X0 - 4, X1 + 4, z0 + 8, z1 - 8, 0.02, roadMat, 'ground');
      // kerbs
      for (const zk of [z0 + 8, z1 - 8]) { const k = box(X1 - X0 + 8, 0.25, 0.3, M.stone); k.position.set((X0 + X1) / 2, 0.12, zk); k.userData.cls = 'ground'; group.add(k); }
    }

    // ---------- street lamps (own meshes: w.lamp would shift the shared lamp list other chapters index into) ----------
    const lampSpots = [[80, 179.4], [150, 179.4], [196, 179.4], [86, 188.6], [140, 188.6], [210, 188.6], [96, 241.4], [176, 241.4], [120, 250.6], [200, 250.6]];
    const post = new THREE.CylinderGeometry(0.16, 0.24, 7, 6), head = new THREE.SphereGeometry(0.62, 12, 8), lamps = new THREE.Group();
    for (const [x, z] of lampSpots) {
      const pm = new THREE.Mesh(post, M.dark); pm.position.set(x, 3.5, z); lamps.add(pm);
      const hm = new THREE.Mesh(head, M.lampGlow); hm.position.set(x, 7.2, z); lamps.add(hm);
    }
    lamps.traverse((o) => { if (o.isMesh) o.userData.cls = 'lamp'; }); group.add(lamps);

    // ---------- the kitchen (row B, house 4, middle bay of the ground floor) ----------
    const rowB = rowsById[KITCHEN.row], kx = bayX(rowB, KITCHEN.house, KITCHEN.bay), fz = rowB.front; // kx = 109, fz = 196
    const kitchen = new THREE.Group();
    const wall = canvasTex(512, 256, (g, W, Hp) => {
      g.fillStyle = '#e8d6ae'; g.fillRect(0, 0, W, Hp);
      for (let x = 0; x < W; x += 32) { g.fillStyle = 'rgba(150,110,60,.13)'; g.fillRect(x, 0, 6, Hp); }
      for (let k = 0; k < 60; k++) { g.fillStyle = 'rgba(170,90,60,.16)'; g.beginPath(); g.arc((k % 16) * 32 + 19, Math.floor(k / 16) * 64 + 30, 5, 0, 7); g.fill(); }
      g.fillStyle = '#5a7d6a'; g.fillRect(0, Hp * 0.62, W, Hp * 0.38);   // painted dado below
      g.fillStyle = '#e9e1cf'; g.fillRect(0, Hp * 0.6, W, Hp * 0.035);
    });
    wall.wrapS = THREE.RepeatWrapping; wall.repeat.x = 2;
    const wallMat = new THREE.MeshStandardMaterial({ map: wall, roughness: 0.9, side: THREE.BackSide });
    const floorMat = new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g) => { for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#2a2420' : '#b9ad96'; g.fillRect(x * 32, y * 32, 32, 32); } }), roughness: 0.8, side: THREE.BackSide });
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf1e7d2, roughness: 1, side: THREE.BackSide });
    // inward-facing box: from outside, its near face is culled, so the window shows the far walls
    const room = box(8.8, 5.2, 7, [wallMat, wallMat, ceilMat, floorMat, wallMat, wallMat]);
    room.position.set(kx, GROUND + 2.6, fz + 0.35 + 3.5); kitchen.add(room);
    // window reveal, stone sill with snow, painted sash frame with six-over-six glazing bars
    const y0 = FLOORS[0][0] - 0.05, y1 = FLOORS[0][1] + 0.05, wy = (y0 + y1) / 2, wh = y1 - y0;
    const revealMat = new THREE.MeshStandardMaterial({ color: 0xd8cfbd, roughness: 0.9 });
    for (const [x, y, sw, sh] of [[kx - 1.16, wy, 0.12, wh + 0.24], [kx + 1.16, wy, 0.12, wh + 0.24], [kx, y1 + 0.06, 2.44, 0.12]]) {
      const r = box(sw, sh, 0.36, revealMat); r.position.set(x, y, fz + 0.18); kitchen.add(r);
    }
    const sill = box(2.8, 0.2, 0.75, M.stone); sill.position.set(kx, y0 - 0.12, fz - 0.15); kitchen.add(sill);
    const sillSnow = box(2.7, 0.1, 0.6, snowMat); sillSnow.position.set(kx, y0 + 0.02, fz - 0.2); sillSnow.userData.cls = 'snow'; kitchen.add(sillSnow);
    const bars = [];
    const bar = (x, y, bw, bh) => { const gg = new THREE.BoxGeometry(bw, bh, 0.07); gg.translate(x, y, 0); bars.push(gg); };
    bar(kx - 1.04, wy, 0.1, wh); bar(kx + 1.04, wy, 0.1, wh); bar(kx, y1 - 0.05, 2.18, 0.1); bar(kx, y0 + 0.05, 2.18, 0.14);
    bar(kx, wy, 2.1, 0.11);                                                              // meeting rail
    for (const f of [-1 / 3, 1 / 3]) bar(kx + f * 2.0, wy, 0.05, wh);
    for (const yy of [(y0 + wy) / 2, (wy + y1) / 2]) bar(kx, yy, 2.1, 0.05);
    const sash = new THREE.Mesh(mergeGeometries(bars), new THREE.MeshStandardMaterial({ color: 0xf0ece2, roughness: 0.6 }));
    sash.position.z = fz + 0.3; kitchen.add(sash);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.1, wh), new THREE.MeshBasicMaterial({ color: 0x9fb6d0, transparent: true, opacity: 0.07, depthWrite: false }));
    glass.position.set(kx, wy, fz + 0.28); glass.rotation.y = Math.PI; kitchen.add(glass);
    // Limerick-lace frost: a fine hexagonal net with little flowers, only in the corners of the glass
    const lace = canvasTex(512, 880, (g, W, Hp) => {
      const L = prng(1830); // Limerick lace dates from the 1830s
      // the net is kept faint so the flowers read as lace rather than wire mesh in the close shot
      g.strokeStyle = 'rgba(245,240,228,.4)'; g.lineWidth = 1;
      const hx = 14, hy = hx * 0.866;
      for (let r = 0; r * hy < Hp + hy; r++) for (let c = 0; c * hx < W + hx; c++) {
        const x = c * hx + (r % 2) * hx / 2, y = r * hy; g.beginPath();
        for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; g.lineTo(x + Math.cos(a) * hx * 0.55, y + Math.sin(a) * hx * 0.55); }
        g.stroke();
      }
      // tambour-work flowers and tendrils
      g.lineWidth = 3; g.strokeStyle = 'rgba(255,252,244,.95)';
      for (const [cx, cy, sgx, sgy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, Hp, 1, -1], [W, Hp, -1, -1]]) for (let k = 0; k < 5; k++) {
        const fx = cx + sgx * (40 + L() * 120), fy = cy + sgy * (40 + L() * 140), rr = 12 + L() * 12;
        for (let pIdx = 0; pIdx < 5; pIdx++) { const a = (pIdx / 5) * Math.PI * 2 + L(); g.beginPath(); g.ellipse(fx + Math.cos(a) * rr, fy + Math.sin(a) * rr, rr * 0.7, rr * 0.38, a, 0, 7); g.stroke(); }
        g.beginPath(); g.moveTo(fx, fy); g.bezierCurveTo(fx + sgx * 60, fy + sgy * 10, fx + sgx * 20, fy + sgy * 80, fx + sgx * 90, fy + sgy * 100); g.stroke();
      }
      // keep the frost to the corners
      g.globalCompositeOperation = 'destination-in';
      const m = document.createElement('canvas'); m.width = W; m.height = Hp; const mg = m.getContext('2d');
      for (const [cx, cy] of [[0, 0], [W, 0], [0, Hp], [W, Hp]]) {
        const gr = mg.createRadialGradient(cx, cy, 0, cx, cy, W * 0.62); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        mg.fillStyle = gr; mg.fillRect(0, 0, W, Hp);
      }
      g.drawImage(m, 0, 0);
    });
    const frost = new THREE.Mesh(new THREE.PlaneGeometry(2.1, wh), new THREE.MeshBasicMaterial({ map: lace, transparent: true, opacity: 0.4, depthWrite: false }));
    frost.position.set(kx, wy, fz + 0.33); frost.rotation.y = Math.PI; frost.renderOrder = 2; kitchen.add(frost);

    // furniture: a dresser with blue-and-white plates, a table with a check cloth, teapot, mug, pendant lamp
    const tz = fz + 2.9, ty = GROUND + 1.75;
    const dresserFront = canvasTex(256, 320, (g, W, Hp) => {
      g.fillStyle = '#5b3a26'; g.fillRect(0, 0, W, Hp);
      g.fillStyle = '#3d2618'; for (const y of [70, 140, 210]) g.fillRect(8, y, W - 16, 8);
      for (const [y, r] of [[38, 24], [108, 24], [178, 22]]) for (let k = 0; k < 4; k++) {
        const x = 36 + k * 61; g.fillStyle = '#eef2f7'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        g.strokeStyle = '#3c64a8'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, r * 0.72, 0, 7); g.stroke();
      }
      g.fillStyle = '#4a2f1f'; g.fillRect(8, 228, W / 2 - 12, 84); g.fillRect(W / 2 + 4, 228, W / 2 - 12, 84);
    });
    const dresser = box(3.4, 4.3, 0.8, [M.brick, M.brick, M.brick, M.brick, new THREE.MeshStandardMaterial({ map: dresserFront, roughness: 0.8 }), M.brick]);
    dresser.rotation.y = Math.PI; dresser.position.set(kx + 0.3, GROUND + 2.15, fz + 6.9); kitchen.add(dresser);
    const cloth = canvasTex(256, 256, (g) => { g.fillStyle = '#f3efe6'; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(190,40,40,.55)'; for (let k = 0; k < 256; k += 32) { g.fillRect(k, 0, 16, 256); g.fillRect(0, k, 256, 16); } });
    const top = box(3.6, 0.12, 2.0, new THREE.MeshStandardMaterial({ map: cloth, roughness: 0.9 })); top.position.set(kx + 0.2, ty, tz); kitchen.add(top);
    const wood = new THREE.MeshStandardMaterial({ color: 0x4a3122, roughness: 0.8 });
    for (const [dx, dz] of [[-1.6, -0.8], [1.6, -0.8], [-1.6, 0.8], [1.6, 0.8]]) { const l = box(0.14, ty - GROUND, 0.14, wood); l.position.set(kx + 0.2 + dx, (ty + GROUND) / 2, tz + dz); kitchen.add(l); }
    const delft = new THREE.MeshStandardMaterial({ color: 0x2c4f7c, roughness: 0.35, metalness: 0.1 });
    const pot = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), delft); pot.scale.y = 0.82; pot.position.set(kx - 1.0, ty + 0.4, tz + 0.25); kitchen.add(pot);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.5, 8), delft); spout.rotation.z = -0.9; spout.position.set(kx - 0.6, ty + 0.5, tz + 0.25); kitchen.add(spout);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.38, 14), new THREE.MeshStandardMaterial({ color: 0xf2e6cc, roughness: 0.5 })); mug.position.set(kx + 1.15, ty + 0.25, tz - 0.1); kitchen.add(mug);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.45, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0x2f4a3c, roughness: 0.6, side: THREE.DoubleSide }));
    shade.position.set(kx + 0.2, GROUND + 4.6, tz); kitchen.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), M.lampGlow); bulb.position.set(kx + 0.2, GROUND + 4.38, tz); kitchen.add(bulb);
    const cord = box(0.03, 0.6, 0.03, M.dark); cord.position.set(kx + 0.2, GROUND + 5.0, tz); kitchen.add(cord);

    // the phone, propped up on the table facing the window, with a canvas screen the chapters redraw
    const scr = document.createElement('canvas'); scr.width = 256; scr.height = 512;
    const scrTex = new THREE.CanvasTexture(scr); scrTex.colorSpace = THREE.SRGBColorSpace; scrTex.anisotropy = 4;
    const setScreen = (draw) => { const g = scr.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 256, 512); g.fillStyle = '#05070b'; g.fillRect(0, 0, 256, 512); draw?.(g, 256, 512); scrTex.needsUpdate = true; };
    setScreen(null);
    const phone = new THREE.Group();
    const body = box(0.64, 1.22, 0.07, new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.4, metalness: 0.3 })); phone.add(body);
    const screenMat = new THREE.MeshBasicMaterial({ map: scrTex }); screenMat.color.multiplyScalar(1.15);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 1.14), screenMat); screen.position.z = 0.04; phone.add(screen);
    const stand = box(0.5, 0.5, 0.1, wood); stand.position.set(0, -0.3, -0.18); stand.rotation.x = 0.6; phone.add(stand);
    phone.rotation.set(-0.28, Math.PI, 0, 'YXZ'); // face the window (-z), lean back a little
    phone.position.set(kx + 0.15, ty + 0.66, tz - 0.25); kitchen.add(phone);

    // steam over the teapot (a few soft sprites; only animated while visible)
    const puff = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
    const steam = new THREE.Group(); steam.visible = false;
    for (let k = 0; k < 6; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, opacity: 0 })); sp.userData.t = k / 6; steam.add(sp); }
    const steamFrom = new THREE.Vector3(kx - 0.4, ty + 0.75, tz + 0.25);
    kitchen.add(steam);
    w.onUpdate((dt) => {
      if (!steam.visible) return;
      steam.children.forEach((sp, k) => {
        const u = (sp.userData.t = (sp.userData.t + dt * 0.25) % 1);
        sp.position.set(steamFrom.x + Math.sin(u * 5 + k) * 0.15, steamFrom.y + u * 1.6, steamFrom.z);
        sp.scale.setScalar(0.25 + u * 0.7); sp.material.opacity = Math.sin(u * Math.PI) * 0.35;
      });
    });

    kitchen.traverse((o) => { if (o.isMesh) o.userData.cls ??= 'building'; });
    group.add(kitchen);
    // one warm light in the kitchen: lights the room and, with no shadows in this scene, spills onto the snow outside
    const kitchenLight = new THREE.PointLight(0xffc483, 30, 24, 1.4); kitchenLight.position.set(kx + 0.2, GROUND + 4.1, tz - 0.6); scene.add(kitchenLight);

    // ---------- the call-back window across the rooftops (row D) ----------
    const rowD = rowsById[CALLBACK.row], [cy0, cy1] = FLOORS[CALLBACK.floor];
    const cbPos = new THREE.Vector3(bayX(rowD, CALLBACK.house, CALLBACK.bay), (cy0 + cy1) / 2, rowD.front - 0.06);
    const glow = new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0, depthWrite: false });
    glow.color.multiplyScalar(1.6);
    const cbWin = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W - 0.14, cy1 - cy0 - 0.14), glow);
    cbWin.position.copy(cbPos); cbWin.rotation.y = Math.PI; cbWin.userData.cls = 'building'; group.add(cbWin);
    const cbLight = new THREE.PointLight(0xffb764, 0, 26, 1.6); cbLight.position.set(cbPos.x, cbPos.y, cbPos.z - 2.5); scene.add(cbLight);

    // ---------- a few people out in the snow ----------
    w.person(124, 177.5, 1.4, true); w.person(176, 190.5, -1.7, false); w.person(150, 252, 1.6, true);

    w.add(group);
    return {
      obj: group,
      center: new THREE.Vector3(144, 12, 215),
      kitchen: { window: new THREE.Vector3(kx, wy, fz), phone: phone.position.clone() },
      setScreen, steam, kitchenLight,
      callback: { pos: cbPos, glow, light: cbLight },
      shots: {
        kitchen: { pos: new THREE.Vector3(kx + 4.6, 6.3, fz - 12.5), at: new THREE.Vector3(kx + 2.4, 5.4, fz), drift: 0.6 },
      },
    };
  },
};
