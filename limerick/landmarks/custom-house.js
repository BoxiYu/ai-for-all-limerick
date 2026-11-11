// The Custom House (today the Hunt Museum) on the east riverfront, between St Mary's and the library.
// Davis Ducart's Palladian block of pale limestone (begun 1765): an arcaded ground floor, a pilastered upper storey,
// a cornice and roof balustrade, and lower flanking wings. Its river front faces west across the Shannon (plane x = 44).
// Scenery only — no caption, no detection box. Softly floodlit from the river. Region: x 40..95, z -42..2.
//
// HANDLE API: obj, center, frontX
import { THREE, scene, box, M, stoneTex } from '../core.js';

// ---------- layout (world units; 1 unit ≈ 2 m, stylised) ----------
const FX = 44;              // river face of the main block
const BACK = 70;            // rear wall of the main block
const ZC = -20;             // centre line of the whole front
const MAIN_W = 26;          // main block width along the river (7 bays)
const WING_W = 8.2;         // each flanking wing (2 bays); with the cornice the whole front stays inside z -42..2
const G = 8;                // ground (arcaded) storey height
const U = 8;                // upper (pilastered) storey height
const WING_H = 13;          // wings are a storey-and-a-half, lower than the main block
const WING_SET = 2;         // wings are set back from the main front

// ---------- materials (own instances; nothing shared is mutated) ----------
const limeTex = stoneTex.clone(); limeTex.needsUpdate = true; limeTex.repeat.set(3, 2);
const lime = new THREE.MeshStandardMaterial({ map: limeTex, color: 0xd9d6cc, roughness: 0.82 });
const limeTrim = new THREE.MeshStandardMaterial({ color: 0xe4e1d6, roughness: 0.7 });          // pilasters, cornice, balusters
const glassWarm = new THREE.MeshStandardMaterial({ color: 0x120d08, emissive: 0xffc27a, emissiveIntensity: 0.55, roughness: 0.4 });
const glassDim = new THREE.MeshStandardMaterial({ color: 0x06080d, emissive: 0xffb760, emissiveIntensity: 0.035, roughness: 0.25, metalness: 0.3 });
const recess = new THREE.MeshStandardMaterial({ color: 0x0b0a09, emissive: 0x6b4a2a, emissiveIntensity: 0.35, roughness: 0.9 }); // shadowed loggia behind the arches
const doorGlow = new THREE.MeshStandardMaterial({ color: 0x120c06, emissive: 0xffc888, emissiveIntensity: 0.5, roughness: 0.5 });

/**
 * An arcade slab lying in the z–y plane, front face towards the river (-x), built with the
 * bridge-arch extrusion method: a rectangle with round-headed arch holes. Returns the mesh.
 * z0..z1 along the river, height h, n arches; slab occupies x ∈ [x - depth, x].
 */
function arcade(x, z0, z1, h, n, depth = 1.4) {
  const w = z1 - z0, bay = w / n, hw = bay * 0.32, spring = h * 0.56, sill = 0.5;
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(w, 0); s.lineTo(w, h); s.lineTo(0, h); s.lineTo(0, 0);
  for (let i = 0; i < n; i++) {
    const cx = bay * (i + 0.5), hole = new THREE.Path();
    hole.moveTo(cx - hw, sill); hole.lineTo(cx + hw, sill); hole.lineTo(cx + hw, spring);
    hole.absarc(cx, spring, hw, 0, Math.PI, false);       // semicircular head
    hole.lineTo(cx - hw, sill);
    s.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 10 });
  // shape x → world z, extrusion → world x (towards the river)
  geo.rotateY(-Math.PI / 2);                       // (x, y, z) → (-z, y, x): shape x runs along +z, depth runs towards -x
  const m = new THREE.Mesh(geo, lime);
  m.position.set(x, 0, z0);                        // slab spans z0..z1 and x - depth..x
  return { mesh: m, bay, hw, spring, sill };
}

/** A row of balusters (one instanced mesh) at height y, with plinth and rail. along 'z': at x, from z0 to z1;
 *  along 'x': the roles swap (x is the z position, z0..z1 the x range). */
function balustrade(group, x, z0, z1, y, along = 'z') {
  const len = Math.abs(z1 - z0), n = Math.max(2, Math.floor(len / 0.75));
  const plinth = box(along === 'z' ? 0.9 : len, 0.35, along === 'z' ? len : 0.9, limeTrim);
  const rail = box(along === 'z' ? 1.0 : len + 0.2, 0.32, along === 'z' ? len + 0.2 : 1.0, limeTrim);
  const mid = (z0 + z1) / 2;
  if (along === 'z') { plinth.position.set(x, y + 0.17, mid); rail.position.set(x, y + 1.85, mid); }
  else { plinth.position.set(mid, y + 0.17, x); rail.position.set(mid, y + 1.85, x); }
  group.add(plinth, rail);
  const geo = new THREE.CylinderGeometry(0.17, 0.26, 1.35, 6);
  const inst = new THREE.InstancedMesh(geo, limeTrim, n);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const t = z0 + ((i + 0.5) / n) * (z1 - z0);
    m4.makeTranslation(along === 'z' ? x : t, y + 1.02, along === 'z' ? t : x);
    inst.setMatrixAt(i, m4);
  }
  group.add(inst);
  // solid pedestals at both ends
  for (const t of [z0, z1]) { const p = box(1.1, 2.3, 1.1, limeTrim); p.position.set(along === 'z' ? x : t, y + 1.15, along === 'z' ? t : x); group.add(p); }
}

/** One block (main or wing): walls, arcade, upper windows with pilasters, cornice, roof and balustrade. */
function block(group, { fx, z0, z1, h, arches, upper }) {
  const w = z1 - z0, zc = (z0 + z1) / 2;
  // walls and a low roof behind the balustrade
  const body = box(BACK - fx, h, w, lime); body.position.set((fx + BACK) / 2, h / 2, zc); group.add(body);
  const roof = box(BACK - fx - 3, 1.6, w - 3, M.roof); roof.position.set((fx + BACK) / 2 + 0.5, h + 0.8, zc); group.add(roof);
  // arcaded ground floor, standing proud of the wall: a dark loggia behind each arch, with a warm glazed door in it
  const a = arcade(fx - 0.01, z0, z1, G, arches);
  group.add(a.mesh);
  const rh = a.spring + a.hw - a.sill + 0.2, dh = (a.spring - a.sill) * 0.9;
  for (let i = 0; i < arches; i++) {
    const cz = z0 + a.bay * (i + 0.5);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(a.hw * 2 + 0.3, rh), recess);
    back.rotation.y = -Math.PI / 2; back.position.set(fx - 0.04, a.sill + rh / 2, cz); group.add(back);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(a.hw * 1.05, dh), (i + upper) % 2 ? glassDim : doorGlow);
    door.rotation.y = -Math.PI / 2; door.position.set(fx - 0.09, a.sill + dh / 2, cz); group.add(door);
  }
  // plinth band and a string course between the storeys
  const plinth = box(1.9, 0.6, w + 0.4, limeTrim); plinth.position.set(fx - 0.7, 0.3, zc); group.add(plinth);
  const string = box(1.9, 0.55, w + 0.4, limeTrim); string.position.set(fx - 0.7, G + 0.15, zc); group.add(string);
  // upper storey: one tall window per bay, a pilaster at every bay line (with a small capital)
  const bay = w / arches, top = h - 1.3;
  for (let i = 0; i < arches; i++) {
    const cz = z0 + bay * (i + 0.5), wh = (top - G) * 0.62;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(bay * 0.38, wh), (i * 3 + upper) % 4 === 1 ? glassWarm : glassDim);
    win.rotation.y = -Math.PI / 2; win.position.set(fx - 0.03, G + 0.6 + (top - G) * 0.46, cz); group.add(win);
    const sill = box(0.5, 0.25, bay * 0.5, limeTrim); sill.position.set(fx - 0.2, G + 0.6 + (top - G) * 0.46 - wh / 2 - 0.1, cz); group.add(sill);
  }
  for (let i = 0; i <= arches; i++) {
    const pz = z0 + bay * i, ph = top - G - 0.4;
    const p = box(0.7, ph, 0.95, limeTrim); p.position.set(fx - 0.35, G + 0.4 + ph / 2, pz); group.add(p);
    const cap = box(0.95, 0.45, 1.3, limeTrim); cap.position.set(fx - 0.45, top - 0.05, pz); group.add(cap);
  }
  // entablature and cornice
  const frieze = box(1.0, 1.0, w + 0.3, limeTrim); frieze.position.set(fx - 0.5, top + 0.5, zc); group.add(frieze);
  const cornice = box(2.2, 0.5, w + 1.4, limeTrim); cornice.position.set(fx - 0.6, h + 0.15, zc); group.add(cornice);
  // roof balustrade on the river front and returns along both sides
  balustrade(group, fx - 0.2, z0 + 0.2, z1 - 0.2, h + 0.4, 'z');
  balustrade(group, z0 + 0.4, fx + 0.6, fx + 10, h + 0.4, 'x');
  balustrade(group, z1 - 0.4, fx + 0.6, fx + 10, h + 0.4, 'x');
}

export default {
  name: 'custom-house',
  build(w) {
    const g = new THREE.Group();
    const m0 = ZC - MAIN_W / 2, m1 = ZC + MAIN_W / 2;
    block(g, { fx: FX, z0: m0, z1: m1, h: G + U, arches: 7, upper: 0 });
    block(g, { fx: FX + WING_SET, z0: m0 - WING_W, z1: m0, h: WING_H, arches: 2, upper: 1 });
    block(g, { fx: FX + WING_SET, z0: m1, z1: m1 + WING_W, h: WING_H, arches: 2, upper: 2 });
    // the three middle bays carry a slightly raised attic panel behind the balustrade (a quiet centre emphasis)
    const attic = box(1.2, 2.6, MAIN_W * 3 / 7, limeTrim); attic.position.set(FX + 1.6, G + U + 1.7, ZC); g.add(attic);
    w.add(g, 'museum');
    w.reserve(56, ZC, 32, 44);                      // x 40..72, z -42..2

    // soft floodlight from the river, plus a low wash so the arcade reads at night (lights made once here)
    const f = new THREE.SpotLight(0xffe2bc, 700, 140, 0.62, 0.85, 1.5);
    f.position.set(4, 3, ZC + 4); f.target.position.set(FX, 10, ZC); scene.add(f, f.target);
    return { obj: g, center: new THREE.Vector3((FX + BACK) / 2, 9, ZC), frontX: FX };
  },
};
