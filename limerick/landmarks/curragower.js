// Curragower Falls: tidal rapids where the Shannon runs over a rock ledge just below (south of) King John's Castle,
// between Thomond Bridge and the city quays. Not a waterfall: a broad band of white broken water and standing waves
// across the river, with a few dark rock ledges showing. Stylised (the real falls show mainly on an ebbing tide).
//
// One slightly raised, transparent foam sheet with its own shader (standing waves, broken foam, animated), plus a few
// merged rock ledges. The sheet is tagged 'water' for the segmentation view; the rocks are 'ground'.
import { THREE } from '../core.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const Z0 = -205, Z1 = -170, LEDGE = -197; // band from just below Thomond Bridge to alongside the castle; ledge line
function prng(seed) { return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const foamMat = (RIVER) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, fog: true,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
  vertexShader: `#include <common>
    #include <fog_pars_vertex>
    uniform float uTime; varying vec3 wp; varying float vBand;
    void main(){
      vec4 w = modelMatrix * vec4(position, 1.);
      // band profile: rises sharply just below the ledge, then dies away downstream
      float d = w.z - (${LEDGE.toFixed(1)});
      float band = smoothstep(-6., 0., d) * (1. - smoothstep(4., ${(Z1 - LEDGE).toFixed(1)}, d));
      band *= 1. - smoothstep(${(RIVER - 6).toFixed(1)}, ${RIVER.toFixed(1)}, abs(w.x));
      // standing waves: crests fixed in place, breathing a little
      float crest = sin(d * 1.15 + sin(w.x * 0.21) * 0.8) * (0.75 + 0.25 * sin(uTime * 1.7 + w.x * 0.37));
      w.y += crest * 0.38 * band;
      wp = w.xyz; vBand = band;
      vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader: `#include <common>
    #include <fog_pars_fragment>
    uniform float uTime; varying vec3 wp; varying float vBand;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
      return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    void main(){
      float d = wp.z - (${LEDGE.toFixed(1)});
      // broken water: noise streaming downstream (+z), stretched across the flow
      vec2 q = vec2(wp.x * 0.45, wp.z * 0.9 - uTime * 1.6);
      float m = n(q) * 0.55 + n(q * 2.3 + 7.1) * 0.3 + n(q * 5.1 - uTime * 0.7) * 0.15;
      float crest = pow(0.5 + 0.5 * sin(d * 1.15 + sin(wp.x * 0.21) * 0.8), 3.);
      float foam = smoothstep(0.42, 0.78, m * 0.75 + crest * 0.45 + vBand * 0.25) * vBand;
      foam = max(foam, smoothstep(0.55, 0.95, n(vec2(wp.x * 1.3, wp.z * 1.3 - uTime * 2.2))) * vBand * 0.6);
      // moonlit grey-white, a touch warmer on the castle side where the floodlights fall
      vec3 c = mix(vec3(0.34, 0.40, 0.50), vec3(0.78, 0.80, 0.82), foam);
      c += vec3(0.20, 0.13, 0.05) * smoothstep(-5., 28., wp.x) * foam;
      gl_FragColor = vec4(c, clamp(foam * 0.9 + vBand * 0.12, 0., 0.92));
      #include <fog_fragment>
    }`,
});

export default {
  name: 'curragower',
  build(w) {
    const R = w.RIVER, r = prng(1210);
    // the foam sheet, 0.25 above the river surface, a little wider than the band so the ends fade in the water
    const geo = new THREE.PlaneGeometry(R * 2, Z1 - Z0, 60, 70); geo.rotateX(-Math.PI / 2);
    const mat = foamMat(R); // keep our own reference: machine views swap the mesh's material
    const foam = new THREE.Mesh(geo, mat);
    foam.position.set(0, -1.35, (Z0 + Z1) / 2); foam.renderOrder = 2;
    w.add(foam, 'snow');
    // dark rock ledges just breaking the surface along the ledge line and a few below it
    const rocks = [];
    for (let i = 0; i < 9; i++) {
      const g = new THREE.DodecahedronGeometry(1, 0);
      g.scale(2 + r() * 3.5, 0.5 + r() * 0.5, 1.2 + r() * 1.6); g.rotateY(r() * Math.PI);
      const x = -25 + i * 6.2 + (r() - 0.5) * 3, z = LEDGE - 1 + (r() - 0.5) * 3 + (i % 3 === 0 ? 7 : 0);
      g.translate(x, -1.6 + r() * 0.25, z); rocks.push(g);
    }
    const ledges = new THREE.Mesh(mergeGeometries(rocks, false), new THREE.MeshStandardMaterial({ color: 0x1d2126, roughness: 0.45, flatShading: true }));
    w.add(ledges, 'ground');
    w.onUpdate((dt, T) => { mat.uniforms.uTime.value = T; });
    return { obj: foam, ledges, z0: Z0, z1: Z1, center: new THREE.Vector3(0, -1.3, (Z0 + Z1) / 2) };
  },
};
