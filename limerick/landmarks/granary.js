// The old Granary and the Opera Site (for c3): a dark, closed stone warehouse on the east quay with site hoarding at
// its base, and a tower crane behind it with a slow-blinking red light.
// Stylised position: the real Granary is on Charlotte Quay by the Abbey River; here it sits on the Shannon quay between
// the library and Sarsfield Bridge so one camera can frame both. Region: x 46..110, z 62..100 (east bank).
//
// HANDLE API (used by c3): obj, crane, center, anchor (Vector3 where c3's thread lands on the facade),
//   lights (red crane sprites; c3 hides them in machine views).
import { THREE, box, M, canvasTex } from '../core.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Small local seeded PRNG (mulberry32) so this landmark never disturbs the shared city random sequence. */
function prng(seed) {
  return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Granary block (x 50..76, z 64..98), river face at x = 50.
const GX0 = 50, GX1 = 76, GZ0 = 64, GZ1 = 98, GH = 28, FLOORS = 6;
// Tower crane mast foot, height of the jib, jib reach (towards -z) and counter-jib (towards +z).
const CX = 96, CZ = 80, CH = 50, JIB = 50, CJIB = 16;

/** Dark stone wall with rows of blank (unlit) windows; some boarded up. */
function wallTex(rand, cols, rows) {
  return canvasTex(512, 512, (g, W, H) => {
    g.fillStyle = '#4a4740'; g.fillRect(0, 0, W, H);
    // rubble-stone courses
    for (let y = 0; y < H; y += 12) for (let x = (y / 12) % 2 ? -14 : 0; x < W; x += 28) {
      const v = 58 + rand() * 26; g.fillStyle = `rgb(${v},${v - 3},${v - 9})`; g.fillRect(x + 1, y + 1, 26, 10);
    }
    // weathering streaks
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(10,12,16,${0.05 + rand() * 0.1})`; g.fillRect(rand() * W, rand() * H * 0.6, 2 + rand() * 4, 40 + rand() * 120); }
    const cw = W / cols, rh = H / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = c * cw + cw * 0.3, y = r * rh + rh * 0.24, ww = cw * 0.4, wh = rh * 0.52;
      g.fillStyle = '#8c8676'; g.fillRect(x - 3, y - 6, ww + 6, 6);              // lintel
      g.fillStyle = '#7c776a'; g.fillRect(x - 2, y + wh, ww + 4, 4);             // sill
      g.fillStyle = rand() < 0.3 ? '#3b3127' : '#0b0e13'; g.fillRect(x, y, ww, wh); // boarded or black glass
      g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x + ww / 2 - 1, y, 2, wh);
    }
  });
}

/** Plywood site hoarding: plain dark panels with seams and a pale band. No words, no branding. */
function hoardTex() {
  const t = canvasTex(512, 64, (g, W, H) => {
    g.fillStyle = '#26332c'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#6f7d73'; g.fillRect(0, H * 0.18, W, H * 0.08);
    for (let x = 0; x < W; x += 64) { g.fillStyle = '#121915'; g.fillRect(x, 0, 3, H); }
  });
  t.wrapS = THREE.RepeatWrapping; return t;
}

/** One thin box from a to b (for lattice struts). Returns a geometry already placed in world space. */
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _z = new THREE.Vector3(0, 0, 1);
function strut(a, b, t = 0.28) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const geo = new THREE.BoxGeometry(t, t, len);
  _q.setFromUnitVectors(_z, d.normalize());
  _m.compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), _q, new THREE.Vector3(1, 1, 1));
  return geo.applyMatrix4(_m);
}
const P = (x, y, z) => new THREE.Vector3(x, y, z);

/** Tower crane: lattice mast, cab, apex, triangular jib along -z, counter-jib with counterweight. */
function buildCrane() {
  const parts = [], h = 1.25; // half-width of the mast
  // mast: four corner posts + one diagonal per face per 3-unit section
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) parts.push(strut(P(sx * h, 0, sz * h), P(sx * h, CH, sz * h), 0.34));
  for (let y = 0; y < CH - 0.1; y += 3) {
    const k = (y / 3) % 2 ? 1 : -1;
    parts.push(strut(P(-h, y, -h * k), P(-h, y + 3, h * k)), strut(P(h, y, h * k), P(h, y + 3, -h * k)));
    parts.push(strut(P(-h * k, y, -h), P(h * k, y + 3, -h)), strut(P(h * k, y, h), P(-h * k, y + 3, h)));
  }
  // jib (two bottom chords + one top chord) from the mast to the tip, and the counter-jib the other way
  const J = CH + 2.2, jt = 2.4;
  for (const [z0, z1] of [[-JIB, 0], [0, CJIB]]) {
    for (const x of [-1, 1]) parts.push(strut(P(x, J, z0), P(x, J, z1), 0.3));
    parts.push(strut(P(0, J + jt, z0 + (z0 < 0 ? 2 : 0)), P(0, J + jt, z1), 0.26));
    const n = Math.round(Math.abs(z1 - z0) / 3);
    for (let i = 0; i < n; i++) {
      const za = z0 + ((z1 - z0) * i) / n, zb = z0 + ((z1 - z0) * (i + 1)) / n;
      for (const x of [-1, 1]) parts.push(strut(P(x, J, za), P(0, J + jt, zb), 0.2));
      parts.push(strut(P(-1, J, za), P(1, J, za), 0.2));
    }
  }
  // apex (A-frame above the mast) and tie bars down to both jibs
  const A = J + 10;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) parts.push(strut(P(sx * h, J, sz * h), P(0, A, 0), 0.3));
  parts.push(strut(P(0, A, 0), P(0, J + jt, -JIB * 0.62), 0.14), strut(P(0, A, 0), P(0, J + jt, CJIB - 1), 0.14));
  const geo = mergeGeometries(parts); parts.forEach((p) => p.dispose());
  const steel = new THREE.MeshStandardMaterial({ color: 0xc89a1e, emissive: 0x2a1d00, roughness: 0.6, metalness: 0.2 });
  const crane = new THREE.Group();
  crane.add(new THREE.Mesh(geo, steel));
  const cab = box(3.2, 2.6, 3.2, new THREE.MeshStandardMaterial({ color: 0xd7d2c4, emissive: 0x1a1810, roughness: 0.6 }));
  cab.position.set(2.4, J - 1.4, -1.2); crane.add(cab);
  const weight = box(3.4, 3.2, 4, M.dark); weight.position.set(0, J - 1.0, CJIB - 2.6); crane.add(weight);
  const base = box(7, 1.2, 7, M.dark); base.position.y = 0.6; crane.add(base);
  crane.position.set(CX, 0, CZ);
  return { crane, tipY: A, jibY: J };
}

/** Soft red glow sprite (the aircraft warning light). */
function redLight(size) {
  const map = canvasTex(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    // warm amber, not red: DESIGN.md allows only amber and cyan accents, and this light must never compete with a hero
    gr.addColorStop(0, 'rgba(255,236,200,1)'); gr.addColorStop(0.18, 'rgba(255,170,80,1)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: 0xffffff, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  s.scale.set(size, size, 1); return s;
}

export default {
  name: 'granary',
  build(w) {
    const rand = prng(1987);
    const obj = new THREE.Group();

    // --- the warehouse: tall stone block, slate roof, cornice; windows dark ---
    const wd = GX1 - GX0, dp = GZ1 - GZ0;
    // a faint self-lit copy of the stone (emissiveMap = map) so the rubble courses read at night; the windows stay black
    const stoneMat = (map) => new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0x2c2a26, roughness: 0.95 });
    const longFace = stoneMat(wallTex(rand, 9, FLOORS));
    const endFace = stoneMat(wallTex(rand, 6, FLOORS));
    const body = box(wd, GH, dp, [longFace, longFace, M.dark, M.dark, endFace, endFace]);
    body.position.set((GX0 + GX1) / 2, GH / 2, (GZ0 + GZ1) / 2); obj.add(body);
    const cornice = box(wd + 1.2, 1.1, dp + 1.2, M.stone); cornice.position.set(body.position.x, GH + 0.2, body.position.z); obj.add(cornice);
    const slate = M.roof;   // the shared landmark slate (core.js), as dark as the city roofs
    // a long pitched roof: a triangular prism with its ridge running along z
    const tri = new THREE.Shape(); tri.moveTo(-wd / 2, 0); tri.lineTo(wd / 2, 0); tri.lineTo(0, 6.5); tri.lineTo(-wd / 2, 0);
    const roofGeo = new THREE.ExtrudeGeometry(tri, { depth: dp, bevelEnabled: false }); roofGeo.translate(0, 0, -dp / 2);
    const roof = new THREE.Mesh(roofGeo, slate); roof.position.set(body.position.x, GH + 0.75, body.position.z); obj.add(roof);
    // a lower annexe behind (inland), also dark
    const annexe = box(10, 16, 22, [endFace, endFace, M.dark, M.dark, endFace, endFace]);
    annexe.position.set(GX1 + 5, 8, 80); obj.add(annexe);

    // --- site hoarding round the river side and both ends ---
    const ht = hoardTex(), HH = 4.6;
    const runs = [[GX0 - 3, GZ0 - 2, GX0 - 3, GZ1 + 2], [GX0 - 3, GZ0 - 2, GX1 + 2, GZ0 - 2], [GX0 - 3, GZ1 + 2, GX1 + 2, GZ1 + 2]];
    for (const [x0, z0, x1, z1] of runs) {
      const len = Math.hypot(x1 - x0, z1 - z0), t = ht.clone(); t.needsUpdate = true; t.repeat.set(len / 16, 1);
      const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
      const panel = box(len, HH, 0.4, m); panel.position.set((x0 + x1) / 2, HH / 2, (z0 + z1) / 2);
      panel.rotation.y = -Math.atan2(z1 - z0, x1 - x0); obj.add(panel);
    }
    // small amber site lamps along the top of the river-side hoarding
    const amber = new THREE.MeshBasicMaterial({ color: 0xffa640 }); amber.color.multiplyScalar(2.2);
    for (let z = GZ0 + 2; z <= GZ1; z += 8) { const l = box(0.5, 0.5, 0.5, amber); l.position.set(GX0 - 3.2, HH + 0.3, z); obj.add(l); }

    // --- tower crane on the Opera Site, behind the Granary ---
    const { crane, tipY, jibY } = buildCrane();
    obj.add(crane);
    w.add(obj, 'building');

    // red aircraft lights: apex and jib tip (sprites; blink slowly, about once every two seconds)
    const lights = [redLight(5.5), redLight(4.2)];
    lights[0].position.set(CX, tipY + 1.2, CZ); lights[1].position.set(CX, jibY + 3, CZ - JIB + 0.5);
    for (const l of lights) w.scene.add(l);
    w.onUpdate((dt, T) => {
      const k = 0.5 + 0.5 * Math.cos(T * Math.PI); // period 2 s
      const on = Math.pow(k, 3);
      lights[0].material.opacity = 0.12 + 0.88 * on;
      lights[1].material.opacity = 0.12 + 0.88 * Math.pow(0.5 + 0.5 * Math.cos(T * Math.PI + 0.6), 3);
    });

    // ground: the Granary/crane region, and camera ground on the west bank for c3's shots
    w.reserve(78, 81, 64, 38);
    w.reserve(-75, 75, 66, 66);

    return {
      obj, crane, lights,
      center: new THREE.Vector3((GX0 + GX1) / 2, GH / 2, (GZ0 + GZ1) / 2),
      anchor: new THREE.Vector3(GX0 - 0.2, GH * 0.62, (GZ0 + GZ1) / 2),
      detect: [],
    };
  },
};
