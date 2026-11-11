// King John's Castle on King's Island, east bank, north. Built from about 1200 (sources: 1200-1212).
// Keepless: a rough quadrangle of grey limestone curtain walls with battlements, large round drum towers at the
// corners (the NW and SW ones on the river), a twin-towered gatehouse in the middle of the NORTH wall (its towers
// cut flat on the courtyard side), and the WEST wall rising straight from the Shannon embankment.
// A low modern visitor centre sits inside, against the inland (east) wall. Stylised, not to scale.
//
// All the stone is merged into one mesh (one draw call) and the arrow slits into another, so the castle stays
// cheap and still works in every machine view (depth override, segmentation swap).
import { THREE, scene, box, M, stoneTex } from '../core.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TILE = 7; // world units per repeat of the stone texture (about one course every 0.4 units)

/** Box mapping: give a world-placed geometry UVs from its world position, so courses line up and never stretch. */
function planarUV(geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ay >= ax && ay >= az) uv.setXY(i, p.getX(i) / TILE, p.getZ(i) / TILE);
    else if (ax >= az) uv.setXY(i, p.getZ(i) / TILE, p.getY(i) / TILE);
    else uv.setXY(i, p.getX(i) / TILE, p.getY(i) / TILE);
  }
  return geo;
}
/** Collects geometry per material and merges it at the end. */
class Parts {
  constructor() { this.stone = []; this.dark = []; }
  /** A box of size (w,h,d) centred at (x,y,z), turned rot about y. */
  box(x, y, z, w, h, d, rot = 0, key = 'stone') {
    const g = new THREE.BoxGeometry(w, h, d);
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(rot).setPosition(x, y, z));
    this[key].push(planarUV(g));
  }
  /** A cylinder (optionally a part of one) standing on the ground at (x,z), UVs scaled to the stone tile. */
  cyl(x, z, rTop, rBot, h, y0 = 0, thetaStart = 0, thetaLen = Math.PI * 2) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, 32, 1, false, thetaStart, thetaLen);
    const uv = g.attributes.uv, circ = rBot * thetaLen;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * circ) / TILE, (uv.getY(i) * h) / TILE);
    g.translate(x, y0 + h / 2, z); this.stone.push(g);
  }
  mesh(key, mat) { return new THREE.Mesh(mergeGeometries(this[key], false), mat); }
}

/** A straight curtain wall from (x0,z0) to (x1,z1): battered base, wall, wall-walk parapet and merlons on the outer face. */
function wall(P, x0, z0, x1, z1, H, out) {
  const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0), rot = -ang;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  // outward normal (out = +1 / -1 picks the side that faces away from the courtyard)
  const nx = -Math.sin(ang) * out, nz = Math.cos(ang) * out;
  P.box(cx, H / 2, cz, len, H, 3, rot);
  P.box(cx + nx * 1.1, 1.6, cz + nz * 1.1, len, 3.2, 3.4, rot); // battered plinth
  P.box(cx + nx * 1.55, H - 0.4, cz + nz * 1.55, len, 0.5, 0.5, rot); // string course under the battlements
  const n = Math.floor(len / 3.2);
  for (let i = 1; i < n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
    P.box(x + nx * 1.0, H + 0.9, z + nz * 1.0, 1.7, 1.8, 1.0, rot);
  }
  P.box(cx - nx * 1.1, H + 0.35, cz - nz * 1.1, len, 0.7, 0.8, rot); // low inner parapet of the wall-walk
}
/** Merlons around the rim of a round tower (or an arc of it). */
function rim(P, x, z, r, y, a0 = 0, a1 = Math.PI * 2) {
  const n = Math.max(4, Math.floor(((a1 - a0) * r) / 3.0));
  const full = a1 - a0 >= Math.PI * 2 - 1e-3;
  for (let i = 0; i < (full ? n : n + 1); i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    P.box(x + Math.sin(a) * (r - 0.5), y + 0.9, z + Math.cos(a) * (r - 0.5), 1.6, 1.8, 1.0, a);
  }
}
/** A big round drum tower: flared base, shaft, string course, battlements, a few slits facing `face` (radians). */
function drum(P, x, z, r, h, face) {
  P.cyl(x, z, r * 1.02, r * 1.16, 4, 0);
  P.cyl(x, z, r, r * 1.02, h - 4, 4);
  P.cyl(x, z, r + 0.35, r + 0.35, 0.5, h - 0.9);
  rim(P, x, z, r + 0.2, h);
  for (const [da, y] of [[-0.45, h * 0.42], [0.35, h * 0.62], [0.05, h * 0.28], [-0.1, h * 0.8]]) {
    const a = face + da; P.box(x + Math.sin(a) * (r + 0.02), y, z + Math.cos(a) * (r + 0.02), 0.55, 2.2, 0.3, a, 'dark');
  }
}
/** One gatehouse tower: a half-round facing north (-z) and cut flat on the courtyard (south) side. */
function dTower(P, x, z, r, h) {
  P.cyl(x, z, r * 1.02, r * 1.14, 3.5, 0, Math.PI / 2, Math.PI);
  P.cyl(x, z, r, r * 1.02, h - 3.5, 3.5, Math.PI / 2, Math.PI);
  P.box(x, h / 2, z + 3, r * 2, h, 6); // the flat-backed rear half
  rim(P, x, z, r + 0.1, h, Math.PI / 2, Math.PI * 1.5);
  for (const dx of [-r + 0.5, r - 0.5]) P.box(x + dx, h + 0.9, z + 4.5, 1.0, 1.8, 1.6);
  P.box(x, h * 0.55, z - r - 0.02, 0.55, 2.2, 0.3, 0, 'dark');
}

export default {
  name: 'castle',
  build(w) {
    const castle = new THREE.Group();
    const P = new Parts();
    const X0 = 38, X1 = 104, Z0 = -192, Z1 = -128, H = 13;
    // curtain walls (out: which side faces away from the courtyard)
    wall(P, X0, Z1, X0, Z0, H, -1); // WEST, the river wall
    wall(P, X0, Z0, 64, Z0, H, -1); wall(P, 78, Z0, X1, Z0, H, -1); // NORTH, either side of the gatehouse
    wall(P, X1, Z0, X1, Z1, H, -1); // EAST
    wall(P, X1, Z1, X0, Z1, H, -1); // SOUTH
    // corner drum towers: the two on the river are the biggest
    drum(P, X0, Z0, 8.5, 22, -Math.PI / 2 - 0.4); // NW
    drum(P, X0, Z1, 9, 22, -Math.PI / 2 + 0.3); // SW
    drum(P, X1, Z0, 7, 19, Math.PI); // NE
    drum(P, X1, Z1, 6, 16, 0); // SE (smaller; the real corner was later rebuilt, so kept plain)
    // the twin-towered gatehouse in the middle of the north wall
    const GX = 71;
    dTower(P, GX - 6, Z0, 5, 19); dTower(P, GX + 6, Z0, 5, 19);
    P.box(GX, 8, Z0 + 1.5, 4, 16, 9); // gate passage block between the towers
    for (let i = 0; i < 2; i++) P.box(GX - 1 + i * 2, 16.9, Z0 - 2.4, 1.0, 1.8, 1.0);
    P.box(GX, 3.2, Z0 - 3.05, 3.4, 6.4, 0.3, 0, 'dark'); // the gateway
    P.box(GX, 6.4, Z0 - 3.05, 2.4, 1.0, 0.3, 0, 'dark');
    // a few small openings in the river wall
    for (const z of [-178, -164, -150, -140]) P.box(X0 - 1.52, 7.5, z, 0.3, 2.0, 0.55, 0, 'dark');
    const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, color: 0xaaa79c, roughness: 0.88 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x0c0e12, roughness: 1 });
    castle.add(P.mesh('stone', stoneMat), P.mesh('dark', darkMat));
    w.add(castle, 'castle'); w.reserve(71, -160, 80, 80);

    // the modern visitor centre: a low block inside, against the inland (east) wall, its glazed front to the courtyard
    const vc = new THREE.Group();
    const glass = new THREE.MeshStandardMaterial({ color: 0x1a2430, emissive: 0xffc98a, emissiveIntensity: 0.35, roughness: 0.2 });
    const body = box(12, 6.5, 30, [M.dark, M.dark, M.roof, M.dark, M.dark, M.dark]); body.position.set(95, 3.25, -160); vc.add(body);
    const front = box(0.3, 4.6, 27, glass); front.position.set(88.9, 2.6, -160); vc.add(front);
    w.add(vc, 'building');

    // floodlights from the far bank and the bridge (as in the prototype)
    const f1 = new THREE.SpotLight(0xffc27a, 9000, 260, 0.55, 0.6, 1.5); f1.position.set(-10, 2, -150); f1.target.position.set(40, 10, -160); scene.add(f1, f1.target);
    const f2 = new THREE.SpotLight(0xffd59a, 5000, 220, 0.5, 0.6, 1.5); f2.position.set(10, 1, -215); f2.target.position.set(45, 12, -190); scene.add(f2, f2.target);
    return { obj: castle, visitorCentre: vc, center: new THREE.Vector3(71, 10, -160), detect: [{ obj: castle, label: 'castle 0.97' }] };
  },
};
