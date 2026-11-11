// Data-centre sheds on the far eastern horizon (toward Dublin). ILLUSTRATIVE: no real site is drawn and
// none of this is in Limerick. Long, low, windowless grey sheds with rows of rooftop chiller fans and a cold
// blue-white edge glow. Region x 700..1300, z -300..300. Hidden by default; chapter c8 shows it.
//
// HANDLE API (used by chapters): obj (group), center (Vector3), feeds (Vector3[] where the grid lines arrive),
//   show(on: boolean)   toggle visibility of the whole site.
import { THREE, box } from '../core.js';

// Small local seeded PRNG so this module never disturbs the shared city layout (core.rnd).
function prng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

export default {
  name: 'datacentres',
  build(w) {
    const r = prng(2025);
    const site = new THREE.Group();
    site.name = 'datacentres';

    // A faint cold emissive keeps the walls and roofs reading as grey solids from far away (with moonlight only they
    // went black and the glow strips looked like floating outlines).
    const body = new THREE.MeshStandardMaterial({ color: 0x59606c, roughness: 0.75, metalness: 0.15, emissive: 0x1c2532 });
    const roof = new THREE.MeshStandardMaterial({ color: 0x4a515c, roughness: 0.9, emissive: 0x161d28 });
    const housing = new THREE.MeshStandardMaterial({ color: 0x8c939e, roughness: 0.6, metalness: 0.3, emissive: 0x262f3c });
    const fanMat = new THREE.MeshStandardMaterial({ color: 0x1a1e25, roughness: 0.5 });
    // Edge glow: a cold blue-white line along the top edges (bright enough to bloom a little, not a lot).
    const edge = new THREE.MeshBasicMaterial({ color: 0xbfeeff }); edge.color.multiplyScalar(1.6);
    const ground = new THREE.MeshStandardMaterial({ color: 0x2c333e, roughness: 1 });

    // Sheds: [x, z, length (along x), depth (along z)]. Arranged as a loose campus in three clusters.
    const SHEDS = [
      [860, -150, 170, 46], [860, -86, 170, 46], [1060, -170, 150, 50],
      [900, 40, 190, 50], [900, 110, 190, 50], [1110, 60, 160, 56],
      [1010, 210, 150, 46], [1180, -40, 120, 50],
    ];
    const H = 15;
    const fans = []; // [x, z] per chiller unit
    for (const [x, z, L, D] of SHEDS) {
      const s = box(L, H, D, [body, body, roof, roof, body, body]); s.position.set(x, H / 2, z); site.add(s);
      // a plinth / yard around each shed so it sits on its ground rather than floating on the plain
      const yard = box(L + 24, 0.4, D + 22, ground); yard.position.set(x, 0.2, z); site.add(yard);
      // edge glow strips along the four top edges and a faint line at the base
      for (const sz of [-1, 1]) {
        const top = box(L, 0.6, 0.6, edge); top.position.set(x, H + 0.1, z + sz * D / 2); site.add(top);
        const low = box(L, 0.35, 0.35, edge); low.position.set(x, 1.4, z + sz * (D / 2 + 0.2)); site.add(low);
        const side = box(0.6, 0.6, D, edge); side.position.set(x + sz * L / 2, H + 0.1, z); site.add(side);
      }
      // rows of chiller units on the roof
      const cols = Math.floor((L - 12) / 9), rows = Math.max(2, Math.floor((D - 10) / 12));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        fans.push([x - L / 2 + 8 + i * 9 + (r() - 0.5) * 0.4, z - D / 2 + 8 + j * ((D - 16) / Math.max(1, rows - 1))]);
      }
    }
    // Chillers: one InstancedMesh for the housings, one for the fan discs (two draw calls for hundreds of units).
    const housingGeo = new THREE.BoxGeometry(7, 2.2, 7), fanGeo = new THREE.CylinderGeometry(2.6, 2.6, 0.5, 14);
    const hI = new THREE.InstancedMesh(housingGeo, housing, fans.length), fI = new THREE.InstancedMesh(fanGeo, fanMat, fans.length);
    const m = new THREE.Matrix4();
    fans.forEach(([fx, fz], i) => {
      hI.setMatrixAt(i, m.makeTranslation(fx, H + 1.1, fz));
      fI.setMatrixAt(i, m.makeTranslation(fx, H + 2.35, fz));
    });
    site.add(hI, fI);

    // Ground-level security lights: a few cold points along the perimeter (one InstancedMesh, no PointLights).
    const pts = [];
    for (let i = 0; i < 40; i++) pts.push([760 + r() * 500, -230 + r() * 480]);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xd8f4ff }); dotMat.color.multiplyScalar(2.2);
    const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 6, 4), dotMat, pts.length);
    pts.forEach(([px, pz], i) => dots.setMatrixAt(i, m.makeTranslation(px, 6, pz)));
    site.add(dots);

    w.add(site, 'dc');
    // A cold haze over the site so it reads as a glow on the horizon from far away (sprite: not part of segmentation).
    const haze = new THREE.Sprite(new THREE.SpriteMaterial({
      map: canvasGlow(), color: 0x9fdcff, transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      // no depth test: the lower half of the sprite sits below ground level, and the ground cut it into a hard
      // horizontal edge in the wide shot. Additive and faint, so drawing over the near ground just reads as glow.
      depthTest: false,
    }));
    haze.renderOrder = 2;
    haze.position.set(1000, 20, 20); haze.scale.set(1000, 200, 1); site.add(haze);

    site.visible = false;
    w.reserve(1000, 0, 600, 600);
    return {
      obj: site, haze, center: new THREE.Vector3(1000, 8, 20),
      // where the overhead lines come in (west side of the campus)
      feeds: [new THREE.Vector3(760, 0, -120), new THREE.Vector3(760, 0, 0), new THREE.Vector3(760, 0, 120)],
      show(on) { site.visible = !!on; },
    };
  },
};

/** Soft horizontal glow texture for the horizon haze. */
function canvasGlow() {
  // drawn as a circle in a square canvas; the sprite is scaled wide so it becomes a soft ellipse fading to 0 at every edge
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,.6)'); gr.addColorStop(0.35, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
