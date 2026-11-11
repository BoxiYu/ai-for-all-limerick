// The world: sky, river, quays, shared builders, landmarks (from ./landmarks), then the city fill.
// Coordinates: the Shannon runs north (-z) to south (+z) along x = 0, banks at |x| > RIVER.
// East bank (+x): King's Island (castle, cathedral) to the north, the library and Georgian city to the south.
// West bank (-x): Thomond Bridge's west end (Treaty Stone), lower houses and trees. 1 unit ≈ 2 m. Stylised, not to scale.
import { THREE, scene, rnd, V, box, canvasTex, M, tag, CLS } from './core.js';
import { prng, KINDS, Sink, houseSpec, emitHouse, glow as cityGlow } from './city.js';
import LANDMARKS from './landmarks/index.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const RIVER = 30;
const updaters = [];
export const world = {
  RIVER, scene, lamps: [], swans: [], swanSprites: [], people: [], lm: {}, detect: [], reserved: [],
  cityGlow,                                  // { value }: the city's window glow (1 = as built); a chapter may lower it
  onUpdate(fn) { updaters.push(fn); },
  update(dt, T, camera) { for (const f of updaters) f(dt, T, camera); },
};
const w = world;
w.add = (obj, cls) => { if (cls) tag(obj, cls); scene.add(obj); return obj; };
w.reserve = (x, z, wd, dp) => { w.reserved.push([x, z, wd, dp]); };
w.free = (x, z, wd, dp) => !w.reserved.some((r) => Math.abs(r[0] - x) < (r[2] + wd) / 2 + 3 && Math.abs(r[1] - z) < (r[3] + dp) / 2 + 3);

// ---------- sky ----------
const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 p; void main(){ p = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'varying vec3 p; void main(){ float t = clamp(p.y*1.6+0.12, 0., 1.); vec3 c = mix(vec3(0.07,0.10,0.19), vec3(0.008,0.015,0.045), t); gl_FragColor = vec4(c,1.); }',
}));
sky.userData.cls = 'sky'; scene.add(sky);
w.sky = sky;
w.stars = (() => {
  const g = new THREE.BufferGeometry(), n = 1400, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 0.85 + 0.12), r = 2800; a.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3); }
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8 }));
  scene.add(p); return p;
})();
w.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128); gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.28, 'rgba(255,248,230,1)'); gr.addColorStop(0.33, 'rgba(200,215,255,.35)'); gr.addColorStop(1, 'rgba(120,150,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
}), fog: false, depthWrite: false }));
w.moon.position.set(-900, 1100, -2000); w.moon.scale.set(420, 420, 1); scene.add(w.moon);

// ---------- light ----------
scene.add(new THREE.HemisphereLight(0x5b78b8, 0x10131a, 0.55));
const moonLight = new THREE.DirectionalLight(0xa9c2ff, 0.9); moonLight.position.set(-300, 500, -400); scene.add(moonLight);

// ---------- land, river, quays ----------
for (const s of [-1, 1]) {
  const g = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), M.ground);
  g.rotation.x = -Math.PI / 2; g.position.set(s * (1500 + RIVER), 0, 0); g.userData.cls = 'ground'; scene.add(g);
  const q = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 3000), M.quay);
  q.position.set(s * (RIVER + 1.5), -1, 0); q.userData.cls = 'ground'; scene.add(q);
}
const water = new THREE.Mesh(new THREE.PlaneGeometry(RIVER * 2, 3000, 1, 1), new THREE.ShaderMaterial({
  fog: true,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
  vertexShader: `#include <common>
    #include <fog_pars_vertex>
    varying vec3 wp; void main(){ vec4 w = modelMatrix*vec4(position,1.); wp = w.xyz; vec4 mvPosition = viewMatrix*w; gl_Position = projectionMatrix*mvPosition;
    #include <fog_vertex>
    }`,
  fragmentShader: `#include <common>
    #include <fog_pars_fragment>
    uniform float uTime; varying vec3 wp;
    float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5), b=fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5), c=fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5), d=fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5); return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
    void main(){
      vec2 q = vec2(wp.x*0.35, wp.z*0.06 + uTime*0.25);
      float r = n(q*3.) * 0.6 + n(q*7. + 3.) * 0.4;
      vec3 c = vec3(0.012,0.03,0.06) + vec3(0.03,0.05,0.09) * r;
      float edge = smoothstep(${(RIVER - 9).toFixed(1)}, ${RIVER.toFixed(1)}, abs(wp.x));
      float spark = smoothstep(0.78, 0.98, n(vec2(wp.x*0.5, wp.z*0.08 + uTime*0.12))) * (0.3 + edge);
      c += vec3(1.0,0.72,0.38) * spark * 0.55;
      gl_FragColor = vec4(c,1.);
      #include <fog_fragment>
    }`,
}));
w.waterMat = water.material;
water.rotation.x = -Math.PI / 2; water.position.y = -1.6; water.userData.cls = 'water'; scene.add(water);
w.water = water;

// ---------- shared builders (landmark modules use these) ----------
/** One house with the city's look (painted facade, slate roof, chimneys), base centre at (x, z), front facing +z before
 *  rot. mat: a KINDS name ('georgian', 'limestone', 'render', 'warehouse') or a material for the facades. Reserves its ground. */
w.building = (x, z, wd, dp, h, rot = 0, mat) => {
  const kind = typeof mat === 'string' && KINDS[mat] ? mat : h > 19 ? 'georgian' : 'limestone', k = KINDS[kind];
  const R = prng(Math.round(x * 31 + z * 17) | 0);
  const spec = houseSpec(kind, R, {
    width: wd, depth: dp, height: h, storeys: Math.max(2, Math.round(h / 5.5)),
    bays: Math.min(Math.round(1 / k.bay), Math.max(1, Math.round(wd / (k.bay * k.tileH)))), tiles: kind === 'warehouse' ? Math.max(1, Math.round(wd / 12.5) / 2) : 0,
  });
  if (mat?.isMaterial) spec.k = { ...k, mat };
  spec.ends = { L: true, R: true };                              // free-standing: painted on all four sides
  const sink = new Sink(), g = new THREE.Group();
  emitHouse(sink, spec, 0, 0, 0);
  for (const m of sink.meshes()) g.add(m);
  g.position.set(x, 0, z); g.rotation.y = rot; tag(g, 'building');
  scene.add(g); w.reserve(x, z, wd, dp); return g;
};
w.crenels = (group, x0, z0, x1, z1, y, step = 3.2, mat = M.stone) => {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(len / step), ang = Math.atan2(z1 - z0, x1 - x0);
  for (let i = 0; i <= n; i++) { const t = i / n, m = box(1.8, 1.8, 1.8, mat); m.position.set(x0 + (x1 - x0) * t, y + 0.9, z0 + (z1 - z0) * t); m.rotation.y = -ang; group.add(m); }
};
w.drum = (group, x, z, r, h, mat = M.stone) => {
  const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 28), mat); t.position.set(x, h / 2, z); group.add(t);
  const n = Math.floor((2 * Math.PI * r) / 3.4);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, m = box(1.7, 1.8, 1.7, mat); m.position.set(x + Math.cos(a) * (r - 0.6), h + 0.9, z + Math.sin(a) * (r - 0.6)); m.rotation.y = -a; group.add(m); }
};
/** A stone arch bridge crossing the river along x at a given z. */
w.bridge = (z, len, arches, height, width, withRail, archShape = 'round') => {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-len / 2, -3); shape.lineTo(len / 2, -3); shape.lineTo(len / 2, height); shape.lineTo(-len / 2, height); shape.lineTo(-len / 2, -3);
  const span = len / arches;
  for (let i = 0; i < arches; i++) {
    const cx = -len / 2 + span * (i + 0.5), hw = span * 0.36, top = height - 2.4, spring = top - hw * (archShape === 'flat' ? 0.45 : 0.9);
    const hole = new THREE.Path();
    hole.moveTo(cx - hw, -3); hole.lineTo(cx - hw, spring); hole.quadraticCurveTo(cx - hw, top + hw * 0.15, cx, top);
    hole.quadraticCurveTo(cx + hw, top + hw * 0.15, cx + hw, spring); hole.lineTo(cx + hw, -3);
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  geo.translate(0, 0, -width / 2);
  g.add(new THREE.Mesh(geo, M.stone));
  const deck = box(len + 8, 0.6, width - 1, M.ground); deck.position.y = height + 0.3; g.add(deck);
  for (const s of [-1, 1]) {
    if (withRail) {
      for (let x = -len / 2; x <= len / 2; x += 1.4) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.6, 6), M.stone); p.position.set(x, height + 1.4, s * (width / 2 - 0.4)); g.add(p); }
      const rail = box(len, 0.35, 0.8, M.stone); rail.position.set(0, height + 2.3, s * (width / 2 - 0.4)); g.add(rail);
    } else { const wall = box(len, 1.6, 0.9, M.stone); wall.position.set(0, height + 1.4, s * (width / 2 - 0.45)); g.add(wall); }
  }
  g.position.set(0, -1.6, z);
  tag(g, 'bridge'); scene.add(g);
  return g;
};
const lampGeo = new THREE.CylinderGeometry(0.18, 0.25, 7, 6), lampHead = new THREE.SphereGeometry(0.7, 12, 8);
w.lamp = (x, y, z) => {
  const g = new THREE.Group();
  const p = new THREE.Mesh(lampGeo, M.dark); p.position.y = 3.5; g.add(p);
  const h = new THREE.Mesh(lampHead, M.lampGlow); h.position.y = 7.3; g.add(h);
  g.position.set(x, y, z); tag(g, 'lamp'); scene.add(g); w.lamps.push(g); return g;
};
// People are painted sprites (assets/people-umbrella.png: a couple under an umbrella; person-coat.png: one figure in a
// long coat), feet on the ground, tinted into the night. A hidden silhouette (box) keeps the 'person' class for the
// machine views and gives the detection boxes their bounds; the update yaws it to face the camera like the sprite.
// art: [file, px width, px height, world height of the whole picture]; one person is about 3.6 units tall.
const personArt = [
  ['./assets/people-umbrella.png', 694, 1005, 4.25],
  ['./assets/person-coat.png', 287, 968, 3.6],
].map(([path, pw, ph, h]) => {
  const map = new THREE.TextureLoader().load(new URL(path, import.meta.url).href, () => { flip.needsUpdate = true; });
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  // a mirrored variant (sprite shaders ignore a negative scale, so flip the UVs instead)
  const flip = map.clone(); flip.wrapS = THREE.RepeatWrapping; flip.repeat.x = -1; flip.offset.x = 1;
  const mat = (m) => new THREE.SpriteMaterial({ map: m, transparent: true, alphaTest: 0.05, depthWrite: false, fog: true, color: 0xb9b3aa });
  return { w: (h * pw) / ph, h, mats: [mat(map), mat(flip)] };
});
// silhouettes in the sprite's own proportions (1 x 1, feet at 0): one figure in a long coat; a couple under an umbrella
const personGeo = (() => {
  const fig = (cx, w, top) => {
    const body = new THREE.CylinderGeometry(w * 0.32, w * 0.5, top * 0.84, 10); body.translate(cx, top * 0.42, 0);
    const head = new THREE.SphereGeometry(w * 0.24, 10, 8); head.scale(1, 1.25, 1); head.translate(cx, top * 0.9, 0);
    return [body, head];
  };
  const one = mergeGeometries(fig(0, 0.75, 1));
  const um = () => { const u = new THREE.CylinderGeometry(0.05, 0.5, 0.17, 14, 1); u.translate(0, 0.86, 0); return u; };
  const two = (s) => mergeGeometries([...fig(-0.18 * s, 0.36, 0.84), ...fig(0.2 * s, 0.34, 0.76), um()]);
  return [[two(1), two(-1)], [one, one]];                                           // [art][mirrored]
})();
const personBounds = new THREE.Box3(V(0, 0, 0), V(0, 0, 0));          // the silhouette frames the person, not the sprite
const personSil = [];
w.person = (x, z, rot, umbrella) => {
  const g = new THREE.Group(), art = personArt[umbrella ? 0 : 1];
  const mir = Math.sin(rot) > 0 ? 1 : 0;
  const sil = new THREE.Mesh(personGeo[umbrella ? 0 : 1][mir], swanProxyMat);
  sil.scale.set(art.w, art.h, 0.6); g.add(sil);
  const sprite = new THREE.Sprite(art.mats[mir]);
  sprite.center.set(0.5, 0); sprite.scale.set(art.w, art.h, 1); sprite.boundingBox = personBounds; g.add(sprite);
  g.position.set(x, 0, z); g.rotation.y = rot; tag(g, 'person'); scene.add(g);
  w.swanSprites.push(sprite); personSil.push(g); w.people.push(g); return g;
};
// Shared local art and machine-view proxies; never dispose these per swan.
const swanLoader = new THREE.TextureLoader();
const swanArt = [
  ['./assets/swan-mute.png', 972, 646, 5.5],
  ['./assets/swan-mute-2.png', 882, 659, 5.0],
].map(([path, width, height, size]) => {
  const map = swanLoader.load(new URL(path, import.meta.url).href, () => { reflectionMap.needsUpdate = true; });
  map.colorSpace = THREE.SRGBColorSpace;
  map.generateMipmaps = true; map.minFilter = THREE.LinearMipmapLinearFilter; map.anisotropy = 4;
  // Clone shares the loaded image, but flips UVs: sprite shaders discard negative scale signs.
  const reflectionMap = map.clone(); reflectionMap.repeat.y = -1; reflectionMap.offset.y = 1;
  return {
    width: size, height: size * height / width,
    material: new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, fog: true, color: 0xc9c8cc }),
    reflectionMaterial: new THREE.SpriteMaterial({ map: reflectionMap, transparent: true, opacity: 0.2,
      depthWrite: false, depthTest: false, fog: true, color: 0x798b9c }),
  };
});
const swanProxyMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
const swanBodyGeo = new THREE.SphereGeometry(1, 10, 6);
const swanNeckGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
  V(-1.1, 0.45, 0), V(-1.65, 1.25, 0), V(-1.55, 2.05, 0), V(-1.9, 2.25, 0),
]), 6, 0.18, 6);
const swanHeadGeo = new THREE.SphereGeometry(0.3, 8, 4);
const swanProxies = [], swanReflections = [], swanBillboards = [];
const swanSpriteBounds = new THREE.Box3(V(-0.5, 0, 0), V(0.5, 1, 0));
function updateSwanVisibility() {
  // Detect vision's material swaps without importing vision.js (which imports this module).
  const machine = !!scene.overrideMaterial || (swanProxies.length > 0 && swanProxies[0].material !== swanProxyMat);
  for (let i = 0; i < w.swanSprites.length; i++) w.swanSprites[i].visible = !machine;
}
// Warm-up renders switch modes without world.update(); hide sprites before render-list collection too.
const beforeSwanRender = scene.onBeforeRender;
scene.onBeforeRender = function (renderer, renderScene, camera, target) {
  beforeSwanRender.call(this, renderer, renderScene, camera, target);
  updateSwanVisibility();
};
w.swan = (x, z, rot) => {
  const g = new THREE.Group(), art = swanArt[w.swans.length % swanArt.length];
  // Proxy silhouette lies in the group's XY plane (seen side-on from +z); the update yaws the group to the camera so
  // the seg/depth silhouette matches the billboard. swan-mute faces left (neck at -x); swan-mute-2 faces right: mirror.
  const p = new THREE.Group(); if (w.swans.length % 2) p.scale.x = -1; g.add(p);
  const b = new THREE.Mesh(swanBodyGeo, swanProxyMat); b.scale.set(2.1, 0.55, 0.8); b.position.set(0.15, 0.3, 0); p.add(b);
  p.add(new THREE.Mesh(swanNeckGeo, swanProxyMat));
  const head = new THREE.Mesh(swanHeadGeo, swanProxyMat); head.position.set(-1.95, 2.25, 0); p.add(head);
  g.position.set(x, -1.3, z); g.rotation.y = rot; g.scale.setScalar(1.2);
  const sprite = new THREE.Sprite(art.material);
  sprite.center.set(0.5, 0); sprite.position.y = (-1.6 - g.position.y) / g.scale.y;
  sprite.scale.set(art.width / g.scale.x, art.height / g.scale.y, 1);
  // Box3 ignores Sprite.center; supply bottom-anchored bounds and align them to the camera below.
  sprite.boundingBox = swanSpriteBounds;
  sprite.rotation.y = -rot; sprite.frustumCulled = false; g.add(sprite);
  const reflection = new THREE.Sprite(art.reflectionMaterial);
  reflection.center.set(0.5, 1); reflection.scale.set(art.width, art.height, 1);
  reflection.position.set(x, -1.6, z); reflection.frustumCulled = false;
  // Draw over the opaque river; keep the reflection out of the group's detection bounds.
  scene.add(reflection); swanReflections.push(reflection);
  swanProxies.push(b); swanBillboards.push(sprite); w.swanSprites.push(sprite, reflection);
  tag(g, 'swan'); scene.add(g); w.swans.push(g); return g;
};
w.tree = (x, z, s = 1) => {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 4, 6), M.bark); t.position.y = 2; g.add(t);
  const c = new THREE.Mesh(new THREE.IcosahedronGeometry(3.2, 0), M.tree); c.position.y = 6; c.scale.y = 1.3; g.add(c);
  g.position.set(x, 0, z); g.scale.setScalar(s); tag(g, 'tree'); scene.add(g); w.reserve(x, z, 6 * s, 6 * s); return g;
};

// ---------- landmarks (each module reserves its own ground before the city fills in) ----------
for (const L of LANDMARKS) {
  const handle = L.build(w) || {};
  w.lm[L.name] = handle;
  if (handle.detect) w.detect.push(...handle.detect);
}

// ---------- the city fill ----------
// Rows of attached houses (city.js): quay rows facing the river on both banks; behind them on the east bank a grid of
// terraces along east-west streets (Newtown Pery to the south, warehouses and older stock near the river and on King's
// Island); on the west bank lower, broken rows of rendered and limestone houses among trees. The fill builds only on
// ground the landmarks left free. Keep clear the ground the cameras stand on and look across (see SHOTS in chapters).
w.reserve(-75, -165, 90, 130); w.reserve(-55, 60, 50, 50); w.reserve(-90, 280, 70, 70); w.reserve(-75, 125, 60, 60);
{
  // one PRNG per bank, so a change on one bank never reshuffles the other
  let CR = prng(1651);                                           // west bank (the first siege)
  const sink = new Sink((x, z) => `${x < 0 ? 'w' : 'e'}${Math.floor((z + 340) / 220)}`);
  const pickFrom = (mix) => { let r = CR() * mix.reduce((t, m) => t + m[1], 0); for (const [k, p] of mix) if ((r -= p) <= 0) return k; return mix[0][0]; };
  /** A house picker for one block: mix of kinds, the block's usual storeys, and the row depth. */
  const picker = (mix, { storeys = 4, depth = 13, lowRise = false } = {}) => () => {
    const kind = pickFrom(mix), R = CR, vary = R() < 0.32 ? (R() < 0.5 ? -1 : 1) : 0;
    const D = depth - R() * 1.5;
    if (kind === 'georgian') { const two = R() < 0.22; return houseSpec(kind, R, { storeys: storeys + vary, width: two ? 7.6 + R() : 10.2 + R() * 1.8, bays: two ? 2 : 3, depth: D }); }
    if (kind === 'limestone') { const five = !lowRise && R() < 0.2; return houseSpec(kind, R, { storeys: (lowRise ? 2 + (R() < 0.5) : storeys - 1 + vary), width: five ? 15 + R() * 2 : 9.4 + R() * 1.6, bays: five ? 5 : 3, depth: D }); }
    if (kind === 'render') { const n = R() < 0.25 ? 1 : R() < 0.7 ? 2 : 3; return houseSpec(kind, R, { storeys: lowRise ? 2 + (R() < 0.55) : 3, width: n * (5.2 + R() * 0.6), bays: n, depth: D }); }
    const t = R() < 0.45 ? 1 : R() < 0.75 ? 1.5 : 2;
    return houseSpec(kind, R, { storeys: 4 + ((R() * 3) | 0), width: t * (23 + R() * 2), tiles: t, depth: D + 2 });
  };
  // Quiet ground (DESIGN §4, one hero glow per shot): near a shot's hero the fill stays low and mostly dark.
  // Each rule maps a house position to { top: max ridge height, bare: no chimney stacks, lit: max lit share } or false.
  const QUIET = [
    // c3: St Mary's tower (44, -70, 41 high): neighbours stay below 24 and show only a few lit windows
    (x, z) => Math.hypot(x - 44, z + 70) < 62 && { top: 24, lit: 0.15 },
    // c1: the castle from Clancy's Strand (camera -98, -132): houses behind it in that view stay at about the curtain
    // wall's line (ridges <= 15, no stacks), so the towers read against the sky
    (x, z) => { const a = Math.atan2(z + 132, x + 98) * 180 / Math.PI; return x > 108 && a > -31 && a < 8 && { top: 15, bare: true }; },
  ];
  const quiet = (h, x, z) => {
    for (const rule of QUIET) {
      const q = rule(x, z); if (!q) continue;
      const ridge = () => h.rows.reduce((s, r) => s + r.h, 0) - h.parapet + (h.D / 2) * Math.tan(h.pitch);
      if (q.top) {
        while (h.rows.length > 2 && ridge() > q.top) h.rows.splice(h.rows.length - 2, 1);   // drop middle storeys
        if (ridge() > q.top) h.pitch = Math.max(0.3, Math.atan((q.top - ridge() + (h.D / 2) * Math.tan(h.pitch)) / (h.D / 2)));
      }
      if (q.bare) h.stacks = [false, false, false];
      if (q.lit != null) h.lit = Math.min(h.lit, q.lit);
    }
  };
  /** One street-front row from a0 to a1 along axis 'x' or 'z'; front line at `front`, facing +1 or -1 along the other axis. */
  const row = (axis, a0, a1, front, facing, pick, gap = 0) => {
    const rot = axis === 'x' ? (facing > 0 ? 0 : Math.PI) : (facing > 0 ? Math.PI / 2 : -Math.PI / 2);
    const first = (axis === 'x' ? Math.cos(rot) : -Math.sin(rot)) > 0 ? 'L' : 'R', last = first === 'L' ? 'R' : 'L';
    const list = [];
    for (let a = a0; ;) {
      const h = pick(); if (a + h.W > a1) break;
      const m = a + h.W / 2, off = front - facing * h.D / 2;
      const [x, z, fw, fd] = axis === 'x' ? [m, off, h.W, h.D] : [off, m, h.D, h.W];
      list.push(w.free(x, z, fw - 1, fd - 1) ? { h, x, z } : null);
      a += h.W;
      if (gap && CR() < gap) { a += 5 + CR() * 12; list.push(null); }
    }
    // a lone narrow house (no neighbour either side) is dropped: it reads as a toy, not a street
    list.forEach((it, i) => { if (it && !list[i - 1] && !list[i + 1] && it.h.W < 9) list[i] = null; });
    // a house whose neighbour is missing shows a painted side elevation at that end of the row
    list.forEach((it, i) => {
      if (!it) return;
      quiet(it.h, it.x, it.z);
      it.h.ends = { [first]: !list[i - 1], [last]: !list[i + 1] };
      emitHouse(sink, it.h, it.x, it.z, rot);
    });
  };
  const NEWTOWN = [['georgian', 8], ['limestone', 1.2], ['render', 0.8]];
  const QUAYS = [['warehouse', 4.5], ['limestone', 3.5], ['georgian', 2]];
  const OLD = [['render', 4.5], ['limestone', 3.5], ['warehouse', 1.5]];
  const WEST = [['render', 6], ['limestone', 4]];
  // west bank: trees first (houses leave room for them), then the quay row and broken rows behind it
  for (let z = -300; z < 520; z += 22) for (let x = -50; x > -380; x -= 24) if (CR() < 0.16 && w.free(x, z, 8, 8)) w.tree(x + CR() * 6, z + CR() * 6, 0.9 + CR() * 0.5);
  for (let z = -330; z < 530;) { const z1 = z + 60 + CR() * 60; row('z', z, z1, -RIVER - 9, 1, picker(WEST, { lowRise: true, depth: 12 }), 0.1); z = z1 + 12; }
  for (let z = -330; z < 530; z += 46) for (let x = -72; x > -385;) {
    const x0 = x - 55 - CR() * 40, p = picker(WEST, { lowRise: true, depth: 11 });
    row('x', x0, x, z, -1, p, 0.1); row('x', x0, x, z + 30, 1, p, 0.1); x = x0 - 12 - CR() * 6;
  }
  CR = prng(1691);                                               // east bank (the Treaty of Limerick)
  // east bank: the quay row, then the street grid (rows back to back across a lane, streets between the pairs)
  for (let z = -330; z < 530;) { const z1 = z + 50 + CR() * 45; row('z', z, z1, RIVER + 9, -1, z < 130 ? picker(QUAYS, { depth: 16 }) : picker(NEWTOWN, { depth: 14 })); z = z1 + 14; }
  for (let z = -330; z < 530; z += 52) for (let x = 72; x < 362;) {
    const x1 = Math.min(x + 60 + CR() * 50, 364);
    const mix = z < -100 ? OLD : z < 130 ? (x < 150 ? QUAYS : NEWTOWN) : NEWTOWN, p = picker(mix, { storeys: z < -100 ? 3 : 4, depth: 14 });
    row('x', x, x1, z, -1, p); row('x', x, x1, z + 34, 1, p); x = x1 + 14 + CR() * 4;
  }
  for (const m of sink.meshes()) scene.add(m);
}
for (let z = -300; z < 520; z += 20) { if (w.free(RIVER + 4, z, 1, 1)) w.lamp(RIVER + 4, 0, z); if (w.free(-RIVER - 4, z + 10, 1, 1)) w.lamp(-RIVER - 4, 0, z + 10); } // skip lamps that would stand inside a landmark
for (const [x, z, r] of [[-6, -168, 0.4], [4, -160, 2.6], [-12, 80, 1.2], [10, 64, -0.8], [-3, 150, 3.0]]) w.swan(x, z, r);
w.detect.push({ obj: w.swans[0], label: 'swan 0.91' }, { obj: w.swans[1], label: 'swan 0.88' }, { obj: w.lamps[2], label: 'street lamp 0.81' }, { obj: w.lamps[3], label: 'street lamp 0.79' });

// ---------- snow ----------
const SNOW = 2600;
const snowGeo = new THREE.BufferGeometry();
const snowPos = new Float32Array(SNOW * 3);
for (let i = 0; i < SNOW; i++) snowPos.set([(rnd() - 0.5) * 360, rnd() * 160, (rnd() - 0.5) * 360], i * 3);
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
// Soft round flakes: a radial-gradient sprite, so flakes near the camera read as soft blurs, not hard squares.
const flake = canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
w.snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, map: flake, size: 0.7, transparent: true, opacity: 0.5, depthWrite: false }));
scene.add(w.snow);

w.onUpdate((dt, T, camera) => {
  w.waterMat.uniforms.uTime.value = T;
  updateSwanVisibility();
  for (let i = 0; i < w.swans.length; i++) {
    const s = w.swans[i], sprite = swanBillboards[i], reflection = swanReflections[i];
    s.position.y = -1.3 + Math.sin(T * 1.3 + i) * 0.12;
    s.rotation.y = Math.atan2(camera.position.x - s.position.x, camera.position.z - s.position.z); // proxy side-on to camera
    sprite.quaternion.copy(s.quaternion).invert().multiply(camera.quaternion);
    reflection.position.set(s.position.x, -1.6, s.position.z);
  }
  for (let i = 0; i < personSil.length; i++) { const p = personSil[i]; p.rotation.y = Math.atan2(camera.position.x - p.position.x, camera.position.z - p.position.z); }
  if (!w.snow.visible) return;
  const p = snowGeo.attributes.position.array, cx = camera.position.x, cz = camera.position.z, cy = Math.min(camera.position.y, 120);
  for (let i = 0; i < SNOW; i++) {
    const j = i * 3;
    p[j + 1] -= dt * (5 + (i % 7));
    p[j] += Math.sin(T + i) * dt * 0.8;
    if (p[j + 1] < cy - 80 || p[j + 1] < -2) { p[j + 1] = cy + 60 + (i % 40); p[j] = cx + ((i * 37) % 360) - 180; p[j + 2] = cz + ((i * 91) % 360) - 180; }
  }
  snowGeo.attributes.position.needsUpdate = true;
});
export { CLS };
