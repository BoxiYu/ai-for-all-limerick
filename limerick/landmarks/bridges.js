// Thomond Bridge (north, by the castle) and Sarsfield Bridge (south). Both cross the river along x.
//
// Thomond Bridge (James & George Pain, c.1836-40; NIAH 21508001): SEVEN low segmental arches in rock-faced grey
//   limestone, pointed cutwaters with half-conical caps, a plain solid parapet with continuous coping, short
//   abutments, and the Pains' small Gothic toll house at the west (Thomondgate) end.
// Sarsfield Bridge (Alexander Nimmo, opened 1835; NIAH 21512010): FIVE wide, flat elliptical arches in tooled ashlar,
//   cutwaters with rounded caps, recessed panels above each cutwater, a balustraded parapet, cast-iron lamp standards,
//   and a short, darker steel swing span at the east (city) end. Wider and flatter than Thomond.
// Stylised, not to scale (1 unit ≈ 2 m). Each bridge is drawn in world coordinates: its side elevation is a 2D shape
// (deck profile on top, arch openings as holes) extruded across the deck width; details are merged per material so
// each bridge costs only a handful of draw calls.
//
// HANDLE: thomond, sarsfield (groups), thomondZ, sarsfieldZ, center, detect, tollHouse,
//   sarsfieldDeckY (road height on the level part of Sarsfield Bridge), sarsfieldSpan (the steel swing span group).
import { THREE, scene, canvasTex, M, warmLight } from '../core.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const THOMOND_Z = -212, SARSFIELD_Z = 110;
const WATER_Y = -1.6, FOUND_Y = -3.6, HOLE_Y = -2.6; // foundations sit under the water plane

// ---------- a small local PRNG (never the shared rnd(): that would reshuffle the city) ----------
function prng(seed) {
  return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- stone textures (drawn once; colour map + bump map) ----------
/** Rock-faced limestone: irregular coursed blocks with a rough, shaded face (Thomond). */
function rockFaced(r) {
  const blocks = [];
  for (let y = 0, row = 0; y < 256; row++) {
    const h = 22 + Math.floor(r() * 3) * 6; let x = -Math.floor(r() * 30);
    while (x < 256) { const w = 30 + Math.floor(r() * 34); blocks.push([x, y, w, h, r()]); x += w; }
    y += h;
  }
  const draw = (bump) => (g, W, H) => {
    g.fillStyle = bump ? '#202020' : '#3c3d3f'; g.fillRect(0, 0, W, H); // mortar
    for (const [x, y, w, h, v] of blocks) {
      const base = bump ? 150 + v * 50 : 112 + v * 34;
      const gr = g.createRadialGradient(x + w * 0.4, y + h * 0.35, 2, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
      gr.addColorStop(0, bump ? `rgb(${base + 60},${base + 60},${base + 60})` : `rgb(${base + 18},${base + 17},${base + 14})`);
      gr.addColorStop(1, bump ? `rgb(${base - 40},${base - 40},${base - 40})` : `rgb(${base - 22},${base - 22},${base - 20})`);
      g.fillStyle = gr; g.fillRect(x + 2, y + 2, w - 4, h - 4);
      for (let i = 0; i < 26; i++) { // pitted, rough face
        const k = bump ? 0 : 0.18; g.fillStyle = `rgba(${bump ? '0,0,0' : '20,20,24'},${(r() * (bump ? 0.5 : k)).toFixed(2)})`;
        g.fillRect(x + 3 + r() * (w - 8), y + 3 + r() * (h - 8), 2 + r() * 5, 2 + r() * 4);
      }
    }
  };
  return wrap(canvasTex(256, 256, draw(false)), canvasTex(256, 256, draw(true), false));
}
/** Tooled ashlar: regular courses of smooth, paler blocks with fine joints (Sarsfield). */
function ashlar(r) {
  const draw = (bump) => (g, W, H) => {
    g.fillStyle = bump ? '#3a3a3a' : '#6c6a64'; g.fillRect(0, 0, W, H);
    for (let y = 0, row = 0; y < H; y += 32, row++) for (let x = row % 2 ? -40 : 0; x < W; x += 80) {
      const v = r();
      g.fillStyle = bump ? `rgb(${190 + v * 30},${190 + v * 30},${190 + v * 30})` : `rgb(${150 + v * 22},${147 + v * 22},${138 + v * 20})`;
      g.fillRect(x + 1.5, y + 1.5, 77, 29);
      g.fillStyle = bump ? 'rgba(0,0,0,.18)' : 'rgba(40,38,34,.08)'; // tooling: fine vertical drafts
      for (let k = 6; k < 76; k += 4) g.fillRect(x + k, y + 3, 1, 25);
    }
  };
  return wrap(canvasTex(256, 256, draw(false)), canvasTex(256, 256, draw(true), false));
}
function wrap(map, bumpMap) { for (const t of [map, bumpMap]) t.wrapS = t.wrapT = THREE.RepeatWrapping; return { map, bumpMap }; }

// ---------- geometry helpers ----------
const V2 = (x, y) => new THREE.Vector2(x, y);
/** World-space box-projected UVs (s units per texture repeat), so every stone face shares one scale. */
function boxUV(geo, s) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ax >= ay && ax >= az ? [p.getZ(i), p.getY(i)] : ay >= az ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)];
    uv[i * 2] = u / s; uv[i * 2 + 1] = v / s;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
/** Collects geometries per material and merges them into one mesh each. */
class Parts {
  constructor() { this.lists = new Map(); }
  add(mat, geo, x = 0, y = 0, z = 0, ry = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!this.lists.has(mat)) this.lists.set(mat, []);
    this.lists.get(mat).push(g); return g;
  }
  box(mat, w, h, d, x, y, z, ry = 0) { return this.add(mat, new THREE.BoxGeometry(w, h, d), x, y, z, ry); }
  build(group, uvScale = 6) {
    for (const [mat, list] of this.lists) {
      const geo = mergeGeometries(list); list.forEach((g) => g.dispose());
      boxUV(geo, uvScale); geo.computeBoundingSphere();
      group.add(new THREE.Mesh(geo, mat));
    }
    return group;
  }
}
/** Extrude a 2D elevation (x,y) across z, centred on zc (depth along z). */
function extrudeZ(shape, depth, zc, curveSegments = 10) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments });
  g.translate(0, 0, zc - depth / 2); return g;
}
/** A band shape between two profiles y0(x) and y1(x), for x in [xa, xb] (parapets, copings, road). */
function band(xa, xb, y0, y1, step = 1.5) {
  const n = Math.max(2, Math.ceil((xb - xa) / step)), s = new THREE.Shape();
  for (let i = 0; i <= n; i++) { const x = xa + ((xb - xa) * i) / n; i ? s.lineTo(x, y1(x)) : s.moveTo(x, y1(x)); }
  for (let i = n; i >= 0; i--) { const x = xa + ((xb - xa) * i) / n; s.lineTo(x, y0(x)); }
  s.closePath(); return s;
}
/** Points of an arch intrados from left springing to right springing. kind 'seg' (segmental) or 'ell' (elliptical). */
function archPts(cx, a, rise, spring, kind, grow = 0, n = 18) {
  const pts = [];
  if (kind === 'ell') {
    for (let i = 0; i <= n; i++) { const t = Math.PI * (1 - i / n); pts.push(V2(cx + (a + grow) * Math.cos(t), spring + (rise + grow) * Math.sin(t))); }
  } else {
    const R = (a * a + rise * rise) / (2 * rise), yc = spring + rise - R, f0 = Math.asin((R - rise) / R);
    for (let i = 0; i <= n; i++) { const t = Math.PI - f0 - ((Math.PI - 2 * f0) * i) / n; pts.push(V2(cx + (R + grow) * Math.cos(t), yc + (R + grow) * Math.sin(t))); }
  }
  return pts;
}
/**
 * Side elevation of an arcade: solid from FOUND_Y up to top(x) over [xa, xb], with arch openings as holes.
 * Openings reach down below the water so the river shows through each arch.
 */
function arcade(xa, xb, top, arches, kind) {
  const s = new THREE.Shape(), n = Math.ceil((xb - xa) / 1.5);
  s.moveTo(xa, FOUND_Y);
  for (let i = 0; i <= n; i++) { const x = xa + ((xb - xa) * i) / n; s.lineTo(x, top(x)); }
  s.lineTo(xb, FOUND_Y); s.closePath();
  for (const { cx, a, rise, spring } of arches) {
    const h = new THREE.Path(), pts = archPts(cx, a, rise, spring, kind);
    h.moveTo(cx - a, HOLE_Y); for (const p of pts) h.lineTo(p.x, p.y); h.lineTo(cx + a, HOLE_Y); h.closePath();
    s.holes.push(h);
  }
  return s;
}
/** A thin raised arch ring (voussoirs) on one face of the bridge. */
function archRing(arch, kind, thick, faceZ, proud) {
  const { cx, a, rise, spring } = arch, outer = archPts(cx, a, rise, spring, kind, thick), inner = archPts(cx, a, rise, spring, kind, -0.04);
  const s = new THREE.Shape(); s.moveTo(outer[0].x, spring);
  outer.forEach((p) => s.lineTo(p.x, p.y)); s.lineTo(inner[inner.length - 1].x, spring);
  inner.reverse().forEach((p) => s.lineTo(p.x, p.y)); s.closePath();
  return extrudeZ(s, proud * 2, faceZ, 1);
}
/** Spans of n equal arches between xa and xb with piers of width p. Returns arches and pier centres. */
function spans(xa, xb, n, p, rise, spring) {
  const s = (xb - xa - (n - 1) * p) / n, arches = [], piers = [];
  for (let i = 0; i < n; i++) { const x0 = xa + i * (s + p); arches.push({ cx: x0 + s / 2, a: s / 2, rise, spring }); if (i) piers.push(x0 - p / 2); }
  return { arches, piers, span: s };
}
/** A pointed cutwater against a pier face: triangular in plan, pointing away from the bridge (dir ±1 along z). */
function cutwater(parts, mat, capMat, x, faceZ, dir, pierW, h, cap) {
  const r = pierW / Math.sqrt(3) * 1.02; // equilateral triangle whose back edge spans the pier
  const body = new THREE.CylinderGeometry(r, r * 1.08, h, 3); // corner at +z
  parts.add(mat, body, x, FOUND_Y + h / 2, faceZ + dir * (r / 2 - 0.05), dir > 0 ? 0 : Math.PI);
  const top = FOUND_Y + h;
  if (cap === 'cone') parts.add(capMat, new THREE.ConeGeometry(r * 1.05, 1.6, 3), x, top + 0.8, faceZ + dir * (r / 2 - 0.05), dir > 0 ? 0 : Math.PI);
  else { // rounded "clam-shell" cap: a quarter dome against the spandrel
    const g = new THREE.SphereGeometry(r * 0.95, 12, 6, 0, Math.PI, 0, Math.PI / 2);
    parts.add(capMat, g, x, top, faceZ - dir * 0.05, dir > 0 ? 0 : Math.PI);
  }
}

// ---------- materials ----------
function stoneMat(tex, color, bump) { return new THREE.MeshStandardMaterial({ map: tex.map, bumpMap: tex.bumpMap, bumpScale: bump, color, roughness: 0.92 }); }

export default {
  name: 'bridges',
  build(w) {
    const r = prng(1835);
    const rock = rockFaced(r), ash = ashlar(r);
    const mat = {
      rock: stoneMat(rock, 0x9a9da3, 2.2), rockCap: stoneMat(ash, 0xa9aaa8, 0.8),
      ash: stoneMat(ash, 0xd0c8b8, 1.0), ashTrim: stoneMat(ash, 0xe4dccb, 0.6), panel: stoneMat(ash, 0x8e877b, 0.6),
      road: new THREE.MeshStandardMaterial({ color: 0x2b313b, roughness: 0.95 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x55626f, roughness: 0.6, metalness: 0.25 }),
      iron: new THREE.MeshStandardMaterial({ color: 0x15181d, roughness: 0.5, metalness: 0.6 }),
    };

    // =============== THOMOND BRIDGE: seven low segmental arches ===============
    const thomond = new THREE.Group(), tp = new Parts();
    {
      const Z = THOMOND_Z, W = 10, END = 45;
      // road: a gentle hump over the river, easing down to the quays
      const top = (x) => { const ax = Math.abs(x); return ax <= 33 ? 3.0 + 0.9 * (1 - (ax / 33) ** 2) : 3.0 - 2.75 * ((ax - 33) / (END - 33)); };
      const { arches, piers } = spans(-29.6, 29.6, 7, 2.0, 1.9, -0.3);
      tp.add(mat.rock, extrudeZ(arcade(-END, END, top, arches, 'seg'), W, Z));
      for (const a of arches) for (const s of [-1, 1]) tp.add(mat.rockCap, archRing(a, 'seg', 0.55, Z + s * W / 2, 0.12));
      for (const x of piers) for (const s of [-1, 1]) cutwater(tp, mat.rock, mat.rockCap, x, Z + s * W / 2, s, 2.0, 3.2, 'cone');
      // short quadrant abutments: rounded wing walls where the bridge meets each quay
      for (const sx of [-1, 1]) for (const s of [-1, 1]) {
        const g = new THREE.CylinderGeometry(2.6, 2.9, 5.8, 10, 1, false, 0, Math.PI / 2);
        tp.add(mat.rock, g, sx * 31.2, FOUND_Y + 2.9, Z + s * W / 2, sx > 0 ? (s > 0 ? 0 : Math.PI / 2) : (s > 0 ? -Math.PI / 2 : Math.PI));
      }
      // plain solid parapet with a continuous coping, and the road between
      for (const s of [-1, 1]) {
        tp.add(mat.rock, extrudeZ(band(-END + 0.5, END - 0.5, top, (x) => top(x) + 1.25), 0.7, Z + s * (W / 2 - 0.35)));
        tp.add(mat.rockCap, extrudeZ(band(-END + 0.3, END - 0.3, (x) => top(x) + 1.25, (x) => top(x) + 1.5), 0.95, Z + s * (W / 2 - 0.35)));
      }
      tp.add(mat.road, extrudeZ(band(-END, END, top, (x) => top(x) + 0.08), W - 1.4, Z));
      tp.build(thomond, 7);
      thomond.userData.top = top;
    }
    w.add(thomond, 'bridge');
    // a low wash on the downstream face so the seven arches read from Clancy's Strand (the c1 castle shot)
    warmLight(-14, 1.5, THOMOND_Z + 20, 1100, 55, 0xffc48a);

    // the Pains' Gothic toll house at the west (Thomondgate) end, north of the road
    const tollHouse = new THREE.Group();
    {
      const hp = new Parts(), X = -46, Z = THOMOND_Z - 11;
      hp.box(mat.rock, 6, 4.4, 5, X, 2.2, Z);
      const gable = new THREE.Shape([V2(-3.3, 0), V2(3.3, 0), V2(0, 2.6)]); // pitched roof, ridge along z
      hp.add(mat.panel, extrudeZ(gable, 5.6, 0), X, 4.4, Z);  // stone gables
      const pa = Math.atan2(2.6, 3.3), pl = Math.hypot(3.3, 2.6) + 0.3;     // two slate slopes over them, like the city
      for (const s of [-1, 1]) hp.add(M.roof, new THREE.BoxGeometry(pl, 0.16, 5.9).rotateZ(-s * pa), X + s * (1.65 + Math.sin(pa) * 0.08), 4.4 + 1.3 + Math.cos(pa) * 0.08, Z);
      for (const [x, z] of [[-3, -2.5], [3, -2.5], [-3, 2.5], [3, 2.5]]) { // corner pinnacles
        hp.box(mat.rockCap, 0.6, 5.2, 0.6, X + x, 2.6, Z + z);
        hp.add(mat.rockCap, new THREE.ConeGeometry(0.45, 1.6, 4), X + x, 6.0, Z + z, Math.PI / 4);
      }
      // pointed-arch (lancet) windows and door, as dark insets on the road side and the river side
      const lancet = (wd, ht) => { const s = new THREE.Shape(); s.moveTo(-wd / 2, 0); s.lineTo(-wd / 2, ht - wd * 0.6); s.quadraticCurveTo(-wd / 2, ht - wd * 0.1, 0, ht); s.quadraticCurveTo(wd / 2, ht - wd * 0.1, wd / 2, ht - wd * 0.6); s.lineTo(wd / 2, 0); s.closePath(); return s; };
      const glow = new THREE.MeshStandardMaterial({ color: 0x241a10, emissive: 0xffb45e, emissiveIntensity: 0.9, roughness: 0.8 });
      for (const [dx, wd, ht, y] of [[-1.6, 1.0, 2.0, 1.4], [1.6, 1.0, 2.0, 1.4]]) hp.add(glow, extrudeZ(lancet(wd, ht), 0.12, 0), X + dx, y, Z + 2.52);
      hp.add(mat.iron, extrudeZ(lancet(1.3, 2.9), 0.12, 0), X + 3.02, 0, Z, Math.PI / 2); // door to the river side
      hp.build(tollHouse, 7);
    }
    w.add(tollHouse, 'building');
    w.reserve(-46, THOMOND_Z - 11, 9, 8);

    // =============== SARSFIELD BRIDGE: five wide, flat elliptical arches + steel swing span ===============
    const sarsfield = new THREE.Group(), sp = new Parts();
    const SW = 15, DECK = 4.4, S_END = 49, STEEL0 = 21.6, STEEL1 = 30.6;
    const stop = (x) => { const ax = Math.abs(x); return ax <= 32 ? DECK : DECK - (DECK - 0.25) * ((ax - 32) / (S_END - 32)); };
    const sarsLampXs = [];
    let span;
    {
      const Z = SARSFIELD_Z;
      const { arches, piers } = spans(-30.6, 18.6, 5, 2.4, 2.25, -0.4);
      // west part: approach + five arches + the pier that carries the swing span
      sp.add(mat.ash, extrudeZ(arcade(-S_END, STEEL0, stop, arches, 'ell'), SW, Z));
      // east abutment on the city quay
      sp.add(mat.ash, extrudeZ(arcade(STEEL1, S_END, stop, [], 'ell'), SW, Z));
      for (const a of arches) for (const s of [-1, 1]) sp.add(mat.ashTrim, archRing(a, 'ell', 0.6, Z + s * SW / 2, 0.1));
      for (const x of [...piers, 20.1]) for (const s of [-1, 1]) {
        const pw = x > 19 ? 3.0 : 2.4;
        // tall enough that the rounded cap sits against the spandrel, just under the panel, not at the waterline
        cutwater(sp, mat.ash, mat.ashTrim, x, Z + s * SW / 2, s, pw, 3.6, 'dome');
        // recessed panel above each cutwater: a darker inset framed by a slim raised border
        if (x < 19) {
          sp.box(mat.panel, 1.7, 1.7, 0.1, x, 2.45, Z + s * (SW / 2 + 0.02));
          for (const [w2, h2, dx, dy] of [[2.1, 0.18, 0, 1.0], [2.1, 0.18, 0, -1.0], [0.18, 2.1, 1.0, 0], [0.18, 2.1, -1.0, 0]]) sp.box(mat.ashTrim, w2, h2, 0.2, x + dx, 2.45 + dy, Z + s * (SW / 2 + 0.05));
        }
      }
      // string course under the parapet along both faces
      for (const s of [-1, 1]) {
        sp.add(mat.ashTrim, extrudeZ(band(-S_END + 0.6, STEEL0, (x) => stop(x) - 0.45, (x) => stop(x) - 0.05), 0.5, Z + s * (SW / 2 + 0.1)));
        sp.add(mat.ashTrim, extrudeZ(band(STEEL1, S_END - 0.6, (x) => stop(x) - 0.45, (x) => stop(x) - 0.05), 0.5, Z + s * (SW / 2 + 0.1)));
      }
      // balustraded parapet: plinth, turned balusters, coping, and solid pedestals over the piers
      const baluster = new THREE.LatheGeometry([V2(0.0, 0), V2(0.2, 0), V2(0.2, 0.08), V2(0.13, 0.18), V2(0.24, 0.42), V2(0.11, 0.72), V2(0.15, 0.82), V2(0.17, 0.9), V2(0.0, 0.9)], 6);
      const pedXs = [-S_END + 1.2, -30.6, ...piers, STEEL0 - 0.8, STEEL1 + 0.8, S_END - 1.2];
      for (const [xa, xb] of [[-S_END + 0.6, STEEL0], [STEEL1, S_END - 0.6]]) for (const s of [-1, 1]) {
        const zc = Z + s * (SW / 2 - 0.45);
        sp.add(mat.ashTrim, extrudeZ(band(xa, xb, stop, (x) => stop(x) + 0.32), 0.9, zc));
        sp.add(mat.ashTrim, extrudeZ(band(xa, xb, (x) => stop(x) + 1.22, (x) => stop(x) + 1.45), 1.0, zc));
        for (let x = xa + 0.6; x < xb - 0.4; x += 0.62) if (!pedXs.some((p) => Math.abs(p - x) < 0.9)) sp.add(mat.ashTrim, baluster.clone(), x, stop(x) + 0.32, zc);
      }
      for (const x of pedXs) for (const s of [-1, 1]) {
        sp.box(mat.ash, 1.4, 1.7, 1.15, x, stop(x) + 0.75, Z + s * (SW / 2 - 0.45));
        sp.box(mat.ashTrim, 1.6, 0.2, 1.3, x, stop(x) + 1.6, Z + s * (SW / 2 - 0.45));
      }
      sarsLampXs.push(-30.6, ...piers, STEEL0 - 0.8);
      sp.add(mat.road, extrudeZ(band(-S_END, S_END, stop, (x) => stop(x) + 0.08), SW - 2, Z));
      sp.build(sarsfield, 6);

      // the steel swing span: a darker box girder with low lattice side trusses
      const st = new Parts(); span = new THREE.Group();
      const L = STEEL1 - STEEL0, cx = (STEEL0 + STEEL1) / 2;
      st.box(mat.steel, L + 0.2, 1.6, SW - 2.4, cx, DECK - 0.8, Z);                    // box girder under the deck
      st.box(mat.road, L + 0.2, 0.1, SW - 2, cx, DECK + 0.04, Z);                      // road surface
      for (const s of [-1, 1]) {
        const zc = Z + s * (SW / 2 - 0.6);
        st.box(mat.steel, L, 0.35, 0.45, cx, DECK + 0.2, zc);                           // bottom chord
        st.box(mat.steel, L, 0.35, 0.45, cx, DECK + 2.0, zc);                           // top chord
        st.box(mat.steel, L + 0.4, 0.5, 0.2, cx, DECK - 0.9, Z + s * (SW / 2 - 1.1));   // fascia plate
        const n = 6;
        for (let i = 0; i <= n; i++) st.box(mat.steel, 0.3, 1.8, 0.35, STEEL0 + (L * i) / n, DECK + 1.1, zc);
        for (let i = 0; i < n; i++) {                                                     // diagonals, alternating
          const x0 = STEEL0 + (L * i) / n, x1 = STEEL0 + (L * (i + 1)) / n, len = Math.hypot(x1 - x0, 1.8);
          const g = new THREE.BoxGeometry(len, 0.18, 0.22); g.rotateZ((i % 2 ? 1 : -1) * Math.atan2(1.8, x1 - x0));
          st.add(mat.steel, g, (x0 + x1) / 2, DECK + 1.1, zc);
        }
      }
      // the pivot drum on the pier beneath the span's west end
      st.add(mat.steel, new THREE.CylinderGeometry(1.4, 1.6, 0.6, 16), STEEL0 + 1.6, DECK - 1.9, Z);
      st.build(span, 4);
      sarsfield.add(span);
    }
    w.add(sarsfield, 'bridge');
    // a soft warm wash on the downstream face (the side the c4 camera sees), as if from the quay lamps
    warmLight(4, 2.5, SARSFIELD_Z + 26, 1400, 70, 0xffc48a);

    // reserve the bridge ends and approaches so the city fill keeps them clear
    w.reserve(37, THOMOND_Z, 18, 14); w.reserve(-38, THOMOND_Z, 16, 14);
    w.reserve(41, SARSFIELD_Z, 22, 22); w.reserve(-41, SARSFIELD_Z, 22, 22);

    // ---------- lamps ----------
    // Thomond first (world.detect uses w.lamps[2], the lamp at x = 20 by the castle), on the north parapet.
    const ttop = thomond.userData.top;
    for (const x of [-20, 0, 20]) w.lamp(x, ttop(x) + 1.5, THOMOND_Z - 4.65);
    // Sarsfield: cast-iron lamp standards on the pedestals over the piers, both sides
    const lampAt = (x, y, z) => {
      const ip = new Parts(), gp = new Parts(), g = new THREE.Group();
      ip.add(mat.iron, new THREE.CylinderGeometry(0.34, 0.42, 0.7, 8), 0, 0.35, 0);           // fluted base
      ip.add(mat.iron, new THREE.CylinderGeometry(0.11, 0.17, 4.6, 8), 0, 3.0, 0);            // column
      for (const yy of [1.0, 2.6, 5.15]) ip.add(mat.iron, new THREE.CylinderGeometry(0.2, 0.2, 0.14, 8), 0, yy, 0); // collars
      ip.add(mat.iron, new THREE.CylinderGeometry(0.32, 0.12, 0.35, 4), 0, 5.4, 0, Math.PI / 4);  // lantern seat
      gp.add(M.lampGlow, new THREE.CylinderGeometry(0.42, 0.28, 0.95, 4), 0, 6.05, 0, Math.PI / 4); // glass
      ip.add(mat.iron, new THREE.ConeGeometry(0.58, 0.55, 4), 0, 6.8, 0, Math.PI / 4);         // cap
      ip.add(mat.iron, new THREE.SphereGeometry(0.1, 6, 4), 0, 7.15, 0);                        // finial
      ip.build(g, 2); gp.build(g, 2);
      g.position.set(x, y, z); w.add(g, 'lamp'); w.lamps.push(g); return g;
    };
    const sarsLamps = [];
    for (const x of sarsLampXs) for (const s of [-1, 1]) sarsLamps.push(lampAt(x, stop(x) + 1.7, SARSFIELD_Z + s * (SW / 2 - 0.45)));

    // The quayside lamp rows in world.js are placed after the landmarks, and two of them would stand in the
    // middle of a bridge road. Hide any lamp (not ours) that lands on a bridge deck, once the world has finished.
    const mine = new Set([...w.lamps]);
    queueMicrotask(() => {
      for (const l of w.lamps) {
        if (mine.has(l)) continue;
        const { x, z } = l.position;
        if ((Math.abs(z - THOMOND_Z) < 6.5 && Math.abs(x) < 47) || (Math.abs(z - SARSFIELD_Z) < 9 && Math.abs(x) < 51)) l.visible = false;
      }
    });

    // detection proxy: an invisible box over Thomond's river span only, so 'bridge 0.95' does not also frame
    // the toll house and the Treaty Stone on the west bank.
    const thomondSpan = new THREE.Mesh(new THREE.BoxGeometry(68, 11, 11), new THREE.MeshBasicMaterial({ visible: false }));
    thomondSpan.position.set(0, 3, THOMOND_Z); scene.add(thomondSpan);
    return {
      thomond, sarsfield, thomondZ: THOMOND_Z, sarsfieldZ: SARSFIELD_Z, tollHouse, sarsfieldDeckY: DECK, sarsfieldSpan: span, sarsLamps,
      center: new THREE.Vector3(0, 7, SARSFIELD_Z),
      detect: [{ obj: thomondSpan, label: 'bridge 0.95' }],
    };
  },
};
