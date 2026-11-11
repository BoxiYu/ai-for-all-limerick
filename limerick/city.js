// The city fill: rows of attached houses with painted facades (assets/facade-*.jpg), pitched slate roofs and chimneys.
// Every house is written into a few shared vertex buffers, one per material and district chunk, so the whole city
// costs a few dozen draw calls. Facades: one storey is one quad mapped to one storey of the painting, so a house can
// be a storey taller or lower than the painting without stretching it. Lit windows come from the -em maps, switched
// on per house and per window column by a hash (aWin attribute); a painted-lit window that is switched off is darkened.
// Local frame of a house: x along the street, y up, front facade at z = +D/2 (facing +z); `rot` turns it about y.
import { THREE, tag, slateTex } from './core.js';

/** Local seeded PRNG so the city never disturbs core.js rnd() (and the city never changes when someone else draws). */
export function prng(seed) {
  return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- textures (loaded once) ----------
const loader = new THREE.TextureLoader();
function tex(file, srgb = true, onLoad) {
  const t = loader.load(new URL(`./assets/${file}`, import.meta.url).href, onLoad);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;   // 4, like the rest of the scene (phones)
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// ---------- the four paintings ----------
// rows: one entry per painted storey, bottom to top: [v0, v1, window columns across the whole tile].
// tileH: world height of the whole painting; bay: tile width of one window bay (or one painted house, for render).
// patch: a window-free square of wall in the painting [x, y, size] (image pixels) that textures side walls, gables and
// stacks; wall/stack: their tint over that patch.
export const KINDS = {
  georgian: { file: 'georgian', rows: [[0, 0.33, 5], [0.33, 0.6, 5], [0.6, 0.81, 5], [0.81, 1, 5]], tileH: 21, bay: 0.2, patch: [175, 390, 90], wall: 0xc8c0bc, stack: 0x8a807c, parapet: [0.8, 1.8], pitch: [30, 38] },
  limestone: { file: 'limestone', rows: [[0, 0.28, 5], [0.28, 0.61, 5], [0.61, 1, 5]], tileH: 16.5, bay: 0.2, patch: [192, 180, 56], wall: 0xd0ccc4, stack: 0x8e8a84, parapet: [0.6, 1.4], pitch: [28, 34] },
  render: { file: 'render', rows: [[0, 0.445, 3], [0.445, 0.73, 6], [0.73, 1, 3]], tileH: 15.5, bay: 1 / 3, patch: [20, 70, 80], wall: 0xb4aca0, stack: 0x6e675e, parapet: [0, 0], pitch: [34, 42], eaves: 0.5 },
  warehouse: { file: 'warehouse', rows: [[0, 0.165, 6], [0.165, 0.36, 6], [0.36, 0.565, 6], [0.565, 0.775, 6], [0.775, 1, 6]], tileH: 25, bay: 1 / 6, patch: [156, 70, 60], wall: 0xd8d8d8, stack: 0xa0a0a0, parapet: [0.6, 1.2], pitch: [24, 30], cycle: true },
};
/** Overall window glow of the whole city (a shared uniform): a chapter can lower it when its hero is a landmark (DESIGN §4). */
export const glow = { value: 1.0 };
const amb = { value: 0.3 };       // the painting's own night colour, so walls read away from the moonlight too
// Wall atlas: 2 x 2 cells, one per painting; each cell holds its wall patch mirrored 2 x 2 so it tiles without seams.
const ATLAS = 512, CELL = ATLAS / 2;
const atlasCanvas = document.createElement('canvas'); atlasCanvas.width = atlasCanvas.height = ATLAS;
const atlas = new THREE.CanvasTexture(atlasCanvas);
atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4;
Object.values(KINDS).forEach((k, i) => {
  k.cell = i; k.patchW = (k.patch[2] / 1024) * k.tileH;        // world size of one patch
  const paintPatch = (t) => {
    const g = atlasCanvas.getContext('2d'), [px, py, ps] = k.patch, h = CELL / 2, cx = (i % 2) * CELL, cy = (1 - Math.floor(i / 2)) * CELL;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
      g.save(); g.translate(cx + a * h + (a ? h : 0), cy + b * h + (b ? h : 0)); g.scale(a ? -1 : 1, b ? -1 : 1);
      g.drawImage(t.image, px, py, ps, ps, 0, 0, h, h); g.restore();
    }
    atlas.needsUpdate = true;
  };
  const m = new THREE.MeshStandardMaterial({
    map: tex(`facade-${k.file}.jpg`, true, paintPatch), emissiveMap: tex(`facade-${k.file}-em.png`),   // 512² (windows only, bloomed, seen from afar); 1024² originals in assets/raw
    emissive: 0xffd9a0, emissiveIntensity: 2.4, vertexColors: true, roughness: 0.92,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGlow = glow; sh.uniforms.uAmb = amb;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aWin;\nvarying vec3 vWin;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWin = aWin;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWin; uniform float uGlow, uAmb;
        float winHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`)
      // vWin = (seed of this storey, window columns per tile, share of windows lit)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 paint = diffuseColor.rgb;
        vec3 sp = pow(max(paint, vec3(0.0)), vec3(0.4545));                       // back to display values
        float lum = dot(sp, vec3(0.299, 0.587, 0.114));
        float winM = smoothstep(0.36, 0.58, lum) * clamp((sp.r - sp.b - 0.2) * 4.0, 0.0, 1.0); // painted lit glass
        float winOn = step(winHash(vec2(vWin.x, floor(vMapUv.x * vWin.y))), vWin.z);
        diffuseColor.rgb = mix(paint, vec3(0.010, 0.012, 0.018) + paint * 0.04, winM * (1.0 - winOn));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance = (totalEmissiveRadiance + paint * winM * 0.8) * winOn * uGlow + diffuseColor.rgb * uAmb;`);
  };
  m.customProgramCacheKey = () => 'city-facade';
  k.mat = m;
});
const slate = slateTex;                 // assets/roof-slate.jpg, loaded once in core.js (landmark roofs share it)
export const roofMat = new THREE.MeshStandardMaterial({ map: slate, color: 0x8a95a5, vertexColors: true, roughness: 0.78 });
roofMat.onBeforeCompile = (sh) => {
  sh.uniforms.uAmb = amb;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float aSnow;\nvarying float vSnow;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSnow = aSnow;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vSnow; uniform float uAmb;')
    // a thin line of snow along the ridge and the eaves, caught on the slate edges; never a bright sheet
    .replace('#include <color_fragment>', `#include <color_fragment>
      float edge = smoothstep(0.012, 0.03, dot(diffuseColor.rgb, vec3(0.333)));
      float sn = max(smoothstep(0.9, 0.985, vSnow), smoothstep(0.07, 0.0, vSnow) * 0.8) * (0.55 + 0.45 * edge);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.20, 0.23, 0.28), clamp(sn, 0.0, 1.0) * 0.75);`)
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uAmb * 0.6;');
};
roofMat.customProgramCacheKey = () => 'city-roof';
/** Side walls, gables and chimneys: the painting's wall patch from the atlas (aCell >= 0) or plain vertex colour (-1). */
export const plainMat = new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 0.95 });
plainMat.onBeforeCompile = (sh) => {
  sh.uniforms.uAmb = amb;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float aCell;\nvarying float vCell;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCell = aCell;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vCell; uniform float uAmb;')
    .replace('#include <map_fragment>', `if (vCell >= 0.0) {
        vec2 t = (fract(vMapUv) * 0.98 + 0.01 + vec2(mod(vCell, 2.0), floor(vCell / 2.0))) * 0.5;
        diffuseColor *= textureGrad(map, t, dFdx(vMapUv) * 0.5, dFdy(vMapUv) * 0.5);
      }`)
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uAmb;');
};
plainMat.customProgramCacheKey = () => 'city-plain';

// ---------- vertex buffers ----------
class Buf {
  constructor(mat) {
    this.mat = mat; this.pos = []; this.nor = []; this.uv = []; this.col = []; this.win = []; this.snow = []; this.cell = []; this.idx = [];
    this.useWin = !!KINDS_MATS.has(mat); this.useSnow = mat === roofMat; this.useCell = mat === plainMat;
  }
  mesh() {
    const g = new THREE.BufferGeometry(), f = (a, n) => new THREE.Float32BufferAttribute(a, n);
    g.setAttribute('position', f(this.pos, 3)); g.setAttribute('normal', f(this.nor, 3));
    g.setAttribute('color', f(this.col, 3)); g.setAttribute('uv', f(this.uv, 2));
    if (this.useWin) g.setAttribute('aWin', f(this.win, 3));
    if (this.useSnow) g.setAttribute('aSnow', f(this.snow, 1));
    if (this.useCell) g.setAttribute('aCell', f(this.cell, 1));
    g.setIndex(this.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    const m = new THREE.Mesh(g, this.mat); tag(m, 'building');
    m.matrixAutoUpdate = false; m.updateMatrix();
    return m;
  }
}
const KINDS_MATS = new Set(Object.values(KINDS).map((k) => k.mat));
/** A set of buffers keyed by material and district chunk (so far chunks can be frustum-culled). */
export class Sink {
  constructor(chunk = () => 0) { this.chunk = chunk; this.bufs = new Map(); }
  get(mat, x, z) {
    const key = `${mat.uuid}|${this.chunk(x, z)}`;
    let b = this.bufs.get(key); if (!b) this.bufs.set(key, b = new Buf(mat)); return b;
  }
  meshes() { return [...this.bufs.values()].filter((b) => b.idx.length).map((b) => b.mesh()); }
}

const _c = new THREE.Color();
const lin = (hex) => { _c.setHex(hex); return [_c.r, _c.g, _c.b]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/**
 * Write one polygon (a convex fan) of a house. T = {x, z, c, s}: the house centre and rotation; points are local
 * [x, y, z], counter-clockwise seen from outside. a: per-vertex extras {uv, win, snow} or, for wall-patch faces,
 * {cell, scale}: the UVs are then projected from the local position (one atlas cell per `scale` world units).
 */
function poly(buf, T, pts, col, a = {}) {
  const n0 = buf.pos.length / 3;
  const nl = cross(sub(pts[1], pts[0]), sub(pts[pts.length - 1], pts[0])), ln = Math.hypot(...nl);
  const nx = nl[0] / ln, ny = nl[1] / ln, nz = nl[2] / ln;
  const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
  pts.forEach((p, i) => {
    buf.pos.push(T.x + p[0] * T.c + p[2] * T.s, p[1], T.z - p[0] * T.s + p[2] * T.c);
    buf.nor.push(nx * T.c + nz * T.s, ny, -nx * T.s + nz * T.c);
    buf.col.push(...col);
    if (a.uv) buf.uv.push(a.uv[i * 2], a.uv[i * 2 + 1]);
    else if (a.scale) buf.uv.push((ax > az && ax > ay ? p[2] : p[0]) / a.scale, (ay > ax && ay > az ? p[2] : p[1]) / a.scale);
    else buf.uv.push(0, 0);
    if (buf.useWin) buf.win.push(...(a.win || [0, 0, 0]));
    if (buf.useSnow) buf.snow.push(a.snow ? a.snow[i] : 0);
    if (buf.useCell) buf.cell.push(a.cell ?? -1);
  });
  for (let i = 1; i < pts.length - 1; i++) buf.idx.push(n0, n0 + i, n0 + i + 1);
}
/** An open-bottomed box in local coordinates (chimney stacks, pots). top: colour of the top face, or false for none. */
function block(buf, T, x, y0, z, sx, sy, sz, col, a, top = col) {
  const l = x - sx / 2, r = x + sx / 2, f = z + sz / 2, k = z - sz / 2, y1 = y0 + sy;
  poly(buf, T, [[l, y0, f], [r, y0, f], [r, y1, f], [l, y1, f]], col, a);
  poly(buf, T, [[r, y0, k], [l, y0, k], [l, y1, k], [r, y1, k]], col, a);
  poly(buf, T, [[r, y0, f], [r, y0, k], [r, y1, k], [r, y1, f]], col, a);
  poly(buf, T, [[l, y0, k], [l, y0, f], [l, y1, f], [l, y1, k]], col, a);
  if (top) poly(buf, T, [[l, y1, f], [r, y1, f], [r, y1, k], [l, y1, k]], top);
}

/**
 * Describe one house. kind: a KINDS key. Options: storeys (N), width, bays (how much of the painting it shows),
 * height (scale the storeys to this total), lit (share of windows on). R: the PRNG.
 */
export function houseSpec(kindName, R, o = {}) {
  const k = KINDS[kindName], rows = k.rows, top = rows.length - 1;
  const N = Math.max(2, o.storeys ?? rows.length);
  const mids = rows.slice(1, top), pick = [rows[0]];
  for (let i = 0; i < N - 2; i++) pick.push(k.cycle ? mids[i % mids.length] : mids[Math.min(i, mids.length - 1)]);
  pick.push(rows[top]);
  let tileH = k.tileH * (0.94 + R() * 0.12);
  const raw = pick.reduce((s, r) => s + (r[1] - r[0]) * tileH, 0);
  if (o.height) tileH *= o.height / raw;
  // which part of the painting this house shows (whole bays only), and mirrored or not
  const tiles = o.tiles ?? 0, bays = o.bays ?? 3, nb = Math.round(1 / k.bay);
  let u0, u1;
  if (tiles) { u0 = Math.floor(R() * 2) * 0.5; u1 = u0 + tiles; }
  else { const b0 = Math.floor(R() * (nb - bays + 1)); u0 = b0 * k.bay; u1 = u0 + bays * k.bay; }
  const mirror = R() < 0.5;
  const t = 0.9 + R() * 0.16, warm = (R() - 0.5) * 0.08;
  return {
    k, W: o.width, D: o.depth ?? 13, rows: pick.map(([v0, v1, cols]) => ({ v0, v1, cols, h: (v1 - v0) * tileH })),
    u0: mirror ? u1 : u0, u1: mirror ? u0 : u1,
    parapet: k.parapet[0] + R() * (k.parapet[1] - k.parapet[0]), pitch: (k.pitch[0] + R() * (k.pitch[1] - k.pitch[0])) * Math.PI / 180,
    tint: [t * (1 + warm), t, t * (1 - warm)],
    // share of the painted-lit window columns that are on: about 12% of houses fully dark, the rest 0.4..0.75. Capped
    // below 1 so no house ever shows every painted window lit (DESIGN §4: nothing but the hero glows fully).
    lit: o.lit ?? (R() < 0.12 ? 0 : 0.4 + R() * 0.35),
    seed: Math.floor(R() * 997), stacks: o.stacks ?? [R() < 0.8, R() < 0.25, R() < 0.25], R,
  };
}

/** Write a house into the sink at world (x, z) with rotation rot (0: front faces +z). Returns its wall height. */
export function emitHouse(sink, h, x, z, rot = 0) {
  const T = { x, z, c: Math.cos(rot), s: Math.sin(rot) }, W = h.W, D = h.D, k = h.k, R = h.R;
  const fac = sink.get(k.mat, x, z), roof = sink.get(roofMat, x, z), plain = sink.get(plainMat, x, z);
  const hw = W / 2, hd = D / 2;
  // facades, storey by storey; the back gets the same painting with its own lit windows
  let y = 0;
  h.rows.forEach((r, i) => {
    const y1 = y + r.h;
    poly(fac, T, [[-hw, y, hd], [hw, y, hd], [hw, y1, hd], [-hw, y1, hd]], h.tint, { uv: [h.u0, r.v0, h.u1, r.v0, h.u1, r.v1, h.u0, r.v1], win: [h.seed + i * 7.31, r.cols, h.lit] });
    poly(fac, T, [[hw, y, -hd], [-hw, y, -hd], [-hw, y1, -hd], [hw, y1, -hd]], h.tint, { uv: [h.u1, r.v0, h.u0, r.v0, h.u0, r.v1, h.u1, r.v1], win: [h.seed + 500 + i * 7.31, r.cols, h.lit] });
    y = y1;
  });
  const H = y, wall = lin(k.wall).map((v, i) => v * h.tint[i]), wp = { cell: k.cell, scale: k.patchW * 2 };
  // side walls: plain where a neighbour stands against them (they show above lower neighbours); an exposed end of a
  // row (ends.L / ends.R: the house's left / right seen from the front) gets a painted side elevation with windows
  const side = (sx, painted) => {
    const s = Math.sign(sx), z0 = s * hd, z1 = -s * hd;          // viewer's left to right, looking at this side
    if (!painted) { poly(plain, T, [[sx, 0, z0], [sx, 0, z1], [sx, H, z1], [sx, H, z0]], wall, wp); return; }
    const span = Math.max(1, Math.round(D / (k.bay * k.tileH))) * k.bay, ua = h.u0 < h.u1 ? 0 : span, ub = span - ua;
    let yy = 0;
    h.rows.forEach((r, i) => {
      const y1 = yy + r.h;
      poly(fac, T, [[sx, yy, z0], [sx, yy, z1], [sx, y1, z1], [sx, y1, z0]], h.tint, { uv: [ua, r.v0, ub, r.v0, ub, r.v1, ua, r.v1], win: [h.seed + (s > 0 ? 250 : 750) + i * 7.31, r.cols, h.lit] });
      yy = y1;
    });
  };
  side(hw, h.ends?.R); side(-hw, h.ends?.L);
  // pitched slate roof, ridge along the street; parapet houses hide its foot behind the parapet
  const oh = k.eaves ?? 0, tp = Math.tan(h.pitch), e = H - h.parapet, rY = e + hd * tp, eo = e - oh * tp, Z = hd + oh;
  const sl = Math.hypot(Z, rY - eo) / 7, ul = W / 7, rk = 0.8 + R() * 0.35, rc = [rk, rk, rk * (1 + (R() - 0.5) * 0.1)];
  const ox = (x + z) / 7 + R(), snow = [0, 0, 1, 1], ruv = [ox, 0, ox + ul, 0, ox + ul, sl, ox, sl];
  poly(roof, T, [[-hw, eo, Z], [hw, eo, Z], [hw, rY, 0], [-hw, rY, 0]], rc, { uv: ruv, snow });
  poly(roof, T, [[hw, eo, -Z], [-hw, eo, -Z], [-hw, rY, 0], [hw, rY, 0]], rc, { uv: ruv, snow });
  poly(plain, T, [[hw, e, hd], [hw, e, -hd], [hw, rY, 0]], wall, wp);
  poly(plain, T, [[-hw, e, -hd], [-hw, e, hd], [-hw, rY, 0]], wall, wp);
  // chimney stacks: on the party walls astride the ridge, sometimes one on the rear slope; clay pots, a cap of snow
  const stackCol = lin(k.stack).map((v, i) => v * h.tint[i]), potCol = lin(0x5e3424), capCol = lin(0x8d97a6);
  const stack = (sx, sz) => {
    const tall = 1.4 + R() * 1.6, y0 = e, top = rY + tall, len = 2.2 + R() * 1.4;
    block(plain, T, sx, y0, sz, 1.3, top - y0, len, stackCol, wp, capCol);    // snow on the stack's top
    const pots = 2 + ((R() * 2) | 0);
    for (let p = 0; p < pots; p++) block(plain, T, sx, top, sz - len / 2 + (p + 0.5) * (len / pots), 0.42, 0.7 + R() * 0.35, 0.42, potCol, undefined, false);
  };
  const [left, right, rear] = h.stacks;
  if (left) stack(-hw + 0.65, (R() - 0.5) * 0.6);
  if (right) stack(hw - 0.65, (R() - 0.5) * 0.6);
  if (rear && W > 8) stack((R() - 0.5) * W * 0.4, -hd * 0.45);
  return H;
}
