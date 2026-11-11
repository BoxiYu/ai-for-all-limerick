// Core: renderer, scene, camera, post-processing and shared helpers/materials.
// Every other module imports from here. Nothing here knows about chapters.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export { THREE };
export const $ = (s) => document.querySelector(s);
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let seed = 7;
/** Deterministic random in [0,1). The city layout depends on call order. */
export const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const FS_QUAD = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }';

// ---------- renderer ----------
export const canvas = $('#gl');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }) // the composer target does the anti-aliasing (samples: 4);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
export const scene = new THREE.Scene();
/** Night fog, matched to the sky shader's horizon colour so long views have no dark band at the horizon. */
export const FOG_COLOR = new THREE.Color().setRGB(0.05, 0.075, 0.15, THREE.LinearSRGBColorSpace);
scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0024);
export const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 6000);

export const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
composer.addPass(new RenderPass(scene, camera));
// Guard: a few over-bright or invalid (NaN/Inf) pixels make the bloom flash as big squares. Clamp them first.
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: FS_QUAD,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      if (!(c.r == c.r) || !(c.g == c.g) || !(c.b == c.b) || c.r > 6e4 || c.g > 6e4 || c.b > 6e4) c = vec4(0., 0., 0., 1.);
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 12.0), 1.0); }`,
}));
export const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.5, 0.88);
composer.addPass(bloom);
/** Image-generator look: uAmt 1 = pure noise, 0 = clean picture. */
export const diffuse = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uAmt: { value: 0 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: FS_QUAD,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uAmt, uTime; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      if (uAmt <= 0.001) { gl_FragColor = c; return; }
      float r = uAmt * 26.0;
      vec3 acc = c.rgb; float n = 1.0;
      for (int i = 0; i < 12; i++) { float a = float(i) * 0.5236; vec2 o = vec2(cos(a), sin(a)) * r / uRes;
        acc += texture2D(tDiffuse, vUv + o).rgb + texture2D(tDiffuse, vUv + o * 0.5).rgb; n += 2.0; }
      vec3 b = acc / n;
      vec2 px = floor(vUv * uRes / max(1.0, uAmt * 5.0));
      float t = floor(uTime * 6.0); // slow reseed: no fast full-screen flicker (photosensitivity)
      float g = h(px + t);
      vec3 noise = mix(vec3(g), vec3(g, h(px + t + 17.1), h(px + t + 41.7)), 0.25) * 0.13; // mostly dark grey grain (linear; ~40% grey after tone mapping)
      float k = smoothstep(0.0, 1.0, uAmt);
      gl_FragColor = vec4(mix(b, noise, k * k), 1.0);
    }`,
});
composer.addPass(diffuse);
/** Optional colour grade for chapters (e.g. a "screen" look). uMix 0 = off. */
export const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uMix: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) }, uVignette: { value: 0.0 } },
  vertexShader: FS_QUAD,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uMix, uVignette; uniform vec3 uTint; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299,0.587,0.114));
      vec3 g = mix(c.rgb, l * uTint, uMix);
      float v = smoothstep(0.85, 0.2, length(vUv - 0.5)) ; g *= mix(1.0, v, uVignette);
      gl_FragColor = vec4(g, 1.0); }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());

// ---------- textures ----------
export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export const stoneTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#9a9384'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? -12 : 0; x < w; x += 26) {
    const v = 120 + rnd() * 50; g.fillStyle = `rgb(${v},${v - 6},${v - 18})`; g.fillRect(x + 1, y + 1, 24, 14);
  }
});
stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;

// ---------- classes (segmentation view) ----------
// Tag every mesh with a class so the "machine vision" views can recolour it. Add new classes here if needed.
export const CLS = {
  building: '#c0613f', castle: '#f0b429', church: '#e8772e', bridge: '#9b5de5', water: '#2f6fe0', ground: '#7a4f9a',
  person: '#ff2d55', swan: '#f6f6f6', lamp: '#fff35c', tree: '#5fa83a', sky: '#a8dcff', stone: '#14d9a0', snow: '#ffffff', dc: '#00e5ff',
  vehicle: '#00b4d8', boat: '#48cae4', sign: '#ffd166', market: '#e76f51', museum: '#f4a261', stadium: '#2a9d8f',
};
export const segMats = new Proxy({}, {
  get(cache, k) { return cache[k] ??= new THREE.MeshBasicMaterial({ color: CLS[k] || '#888888', fog: false, side: THREE.DoubleSide }); },
});
export function tag(obj, cls) { obj.traverse((o) => { if (o.isMesh) o.userData.cls = cls; }); return obj; }

// ---------- materials ----------
export const M = {
  ground: new THREE.MeshStandardMaterial({ color: 0x3a4352, roughness: 0.95 }),
  quay: new THREE.MeshStandardMaterial({ map: stoneTex, color: 0x8a8578, roughness: 0.9 }),
  stone: new THREE.MeshStandardMaterial({ map: stoneTex, color: 0xb5ad9c, roughness: 0.85 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x8a95a5, roughness: 0.78, flatShading: true }),   // slate, see below
  dark:new THREE.MeshStandardMaterial({ color: 0x1b2028, roughness: 0.8 }),
  coat: new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.7 }),
  umbrella: new THREE.MeshStandardMaterial({ color: 0x7a1f2b, roughness: 0.5 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.6 }),
  beak: new THREE.MeshStandardMaterial({ color: 0xe0782a }),
  lampGlow: new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
  tree: new THREE.MeshStandardMaterial({ color: 0x2c3b2e, roughness: 1 }),
  bark: new THREE.MeshStandardMaterial({ color: 0x2a221c }),
  brick: new THREE.MeshStandardMaterial({ color: 0x7a4a3a, roughness: 0.9 }),
};
M.lampGlow.color.multiplyScalar(4);

// Slate for every landmark roof, matched to the city fill's roofs (city.js roofMat shares this texture). Landmark
// geometry has no roof UVs, so the slate is mapped by world position, 7 units per tile like the city: flat faces are
// projected on xz, pitched (and vertical) faces along the slope, courses running level. The face is taken from screen
// derivatives, so it works on any geometry. Upward faces get a faint dusting of snow on the slate edges, never a sheet.
export const slateTex = new THREE.TextureLoader().load(new URL('./assets/roof-slate.jpg', import.meta.url).href);
slateTex.colorSpace = THREE.SRGBColorSpace; slateTex.wrapS = slateTex.wrapT = THREE.RepeatWrapping; slateTex.anisotropy = 4;
M.roof.onBeforeCompile = (sh) => {
  sh.uniforms.uSlate = { value: slateTex };
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vRoofP; varying vec3 vRoofN;')
    .replace('#include <project_vertex>', `#include <project_vertex>
      vec4 roofP = vec4(transformed, 1.0); vec3 roofN = objectNormal;
      #ifdef USE_INSTANCING
        roofP = instanceMatrix * roofP; roofN = mat3(instanceMatrix) * roofN;
      #endif
      vRoofP = (modelMatrix * roofP).xyz; vRoofN = mat3(modelMatrix) * roofN;`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vRoofP; varying vec3 vRoofN; uniform sampler2D uSlate;')
    .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 fn = normalize(cross(dFdx(vRoofP), dFdy(vRoofP)));
      fn *= dot(fn, vRoofN) < 0.0 ? -1.0 : 1.0;
      vec2 ruv;
      if (fn.y > 0.97) ruv = vRoofP.xz / 7.0;
      else { vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fn)); ruv = vec2(dot(vRoofP, rt), dot(vRoofP, cross(fn, rt))) / 7.0; }
      diffuseColor.rgb *= texture2D(uSlate, ruv).rgb;
      float edge = smoothstep(0.012, 0.03, dot(diffuseColor.rgb, vec3(0.333)));
      float up = smoothstep(0.55, 0.95, fn.y);   // flat and shallow faces face the moon squarely: less snow tint and self-light, to sit with the city
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.20, 0.23, 0.28), up * (0.03 + 0.09 * edge));
      float roofAmb = 0.18 * mix(1.0, 0.7, up);`)
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * roofAmb;');
};
M.roof.customProgramCacheKey = () => 'landmark-slate';

/** Glowing text on a camera-facing sprite. h = world height. */
export function textSprite(text, { size = 64, color = '#f4efe3', glow = 'rgba(255,190,90,.55)', font = 'Iowan Old Style, Georgia, serif', weight = 500, italic = true, h = 4 } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const f = `${italic ? 'italic ' : ''}${weight} ${size}px ${font}`;
  g.font = f; const w = Math.ceil(g.measureText(text).width) + size;
  c.width = Math.max(2, w); c.height = Math.ceil(size * 1.6);
  g.font = f; g.textBaseline = 'middle'; g.shadowColor = glow; g.shadowBlur = size * 0.35; g.fillStyle = color;
  g.fillText(text, size / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  s.scale.set((h * c.width) / c.height, h, 1);
  return s;
}
export function disposeTree(obj) {
  obj.traverse((o) => { o.geometry?.dispose?.(); const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m?.map?.dispose?.(); m?.dispose?.(); }); });
}
export function warmLight(x, y, z, i = 900, d = 160, color = 0xffb764) { const l = new THREE.PointLight(color, i, d, 1.6); l.position.set(x, y, z); scene.add(l); return l; }
/** Inject a chapter's own CSS once. */
export function css(id, text) { if (document.getElementById(`css-${id}`)) return; const s = document.createElement('style'); s.id = `css-${id}`; s.textContent = text; document.head.append(s); }
