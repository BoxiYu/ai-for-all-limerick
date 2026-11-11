// The Treaty Stone on Clancy's Strand: west (Clare) bank, just south of the west end of Thomond Bridge, facing the
// castle across the river. A rough, irregular, slab-like limestone block about table height, on a tall STEPPED
// square cut-stone pedestal (on a pedestal since 1865; moved to this spot in 1990). Two people pass in the snow.
// The slab shape is what makes the detector's "bench" guess plausible (c1).
//
// HANDLE API: obj (whole monument), rock (the stone itself), people, center, top (world point on the rock's top),
//   detect entries (the stone's has truth 'Treaty Stone').
import { THREE, box, M, stoneTex, warmLight } from '../core.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Small local PRNG so this landmark never touches the shared city random sequence. */
function prng(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** The rough block: a subdivided box, every vertex pushed by a few low-frequency lumps plus a little grit, its corners
 *  knocked off and its top left fairly flat, so it reads as a weathered quarried lump rather than a cut block. */
function roughSlab(r, w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d, 7, 3, 5);
  const p = g.attributes.position, seen = new Map();
  // three random "lumps" (direction-dependent bulges and hollows)
  const lumps = [0, 1, 2].map(() => ({ fx: 1 + r() * 2.2, fz: 1 + r() * 2.2, fy: 1 + r() * 2, ph: r() * 6.28, a: 0.035 + r() * 0.04 }));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`; // move shared vertices together so no cracks open
    if (!seen.has(key)) {
      const top = y > h / 2 - 1e-3, bot = y < -h / 2 + 1e-3;
      const ex = Math.abs(x) / (w / 2), ez = Math.abs(z) / (d / 2), ey = Math.abs(y) / (h / 2);
      const corner = Math.max(0, ex + ez + ey - 2.2); // > 0 only near the eight corners
      let bump = 0; for (const L of lumps) bump += Math.sin(x * L.fx + z * L.fz + y * L.fy + L.ph) * L.a;
      const grit = () => (r() - 0.5) * 0.07;
      // push outward along the face normal-ish direction; shrink hard at corners so they round off and chip
      const s = 1 + bump - corner * (0.2 + r() * 0.15);
      seen.set(key, [
        x * s + grit(),
        top ? y - corner * 0.3 + (r() - 0.5) * 0.06 + bump * 0.4 : bot ? y : y * (1 + bump * 0.5) + grit(),
        z * s + grit(),
      ]);
    }
    p.setXYZ(i, ...seen.get(key));
  }
  g.computeVertexNormals();
  return g;
}

export default {
  name: 'stone',
  build(w) {
    const r = prng(1691);
    const stone = new THREE.Group();
    // stepped square pedestal: three steps, a tall dressed shaft with a dark inscription panel, and a moulded cap
    const parts = [];
    const add = (wd, h, dp, y) => { const g = new THREE.BoxGeometry(wd, h, dp); g.translate(0, y + h / 2, 0); parts.push(g); };
    add(6.4, 0.55, 6.4, 0); add(5.4, 0.55, 5.4, 0.55); add(4.4, 0.55, 4.4, 1.1);
    add(3.2, 0.5, 3.2, 1.65); add(2.9, 2.5, 2.9, 2.15); add(3.3, 0.35, 3.3, 4.65); add(3.6, 0.3, 3.6, 5.0);
    const ashlar = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0xb9b4a8, roughness: 0.8 });
    const ped = new THREE.Mesh(mergeGeometries(parts, false), ashlar); stone.add(ped);
    const plaque = box(0.08, 1.4, 1.9, new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.5, metalness: 0.2 }));
    plaque.position.set(1.47, 3.4, 0); stone.add(plaque); // faces east, towards the castle
    // the stone itself: dark, cool grey weathered limestone (kept cooler than the dressed pedestal so it reads apart), slab-like, roughly table height against the people
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x55595e, roughness: 1, flatShading: true }); // no coursed texture: it is one lump
    const rock = new THREE.Mesh(roughSlab(r, 3.7, 1.7, 2.5), rockMat);
    rock.position.set(0.05, 5.3 + 0.82, 0); rock.rotation.set(0.03, 0.18, -0.05); stone.add(rock);
    stone.position.set(-40, 0, -200); stone.rotation.y = -0.08;
    w.add(stone, 'stone'); w.reserve(-40, -200, 10, 10);
    warmLight(-34, 8, -194, 260, 32); // the strand's own lamp glow on the pedestal

    // walkers stand to the stone's south (screen-right in the castle shot) so their boxes never cover the stone's
    const p1 = w.person(-36, -185, 2.4, true), p2 = w.person(-40, -178, 2.0, false);
    return {
      obj: stone, rock, people: [p1, p2], center: new THREE.Vector3(-40, 4, -200), top: new THREE.Vector3(-40, 7.3, -200),
      detect: [{ obj: p1, label: 'person 0.89' }, { obj: p2, label: 'person 0.84' }, { obj: stone, label: 'bench 0.64', truth: 'Treaty Stone' }],
    };
  },
};
