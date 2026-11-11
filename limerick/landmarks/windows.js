// The lit windows of "AI for All" (see ../places.js): one quay house per place, with a large 16:9 ground-floor window
// that shows the place's still picture (the first frame of its Google Flow video). The talk grows that window into
// the video. A small strip of quay in front of each window is kept free of lamps so the camera sees it cleanly.
//
// Built only when <body data-windows> (limerick.html); the first talk (limerick-v1.html) gets an empty handle.
// HANDLE API: windows { [id]: { mesh, mat, light } }, setLit(id, k)  k 0..1.6 (0.75 at rest, 1.3 visited).
import { THREE, box, M, warmLight } from '../core.js';
import { PLACES, QUAY, WIN, quayWindow } from '../places.js';

const DEPTH = 12, WIDTH = 15, HEIGHT = 16;
const REST = 0.75;
const loader = new THREE.TextureLoader();

export default {
  name: 'windows',
  build(w) {
    // Only the AI for All talk (limerick.html, <body data-windows>) builds these; the first talk keeps its own shots.
    if (!document.body?.hasAttribute('data-windows') && !document.documentElement.hasAttribute('data-windows')) return { windows: {}, setLit() {}, rest: REST };
    const windows = {};
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c1a17, roughness: 0.7 });
    const sillMat = new THREE.MeshStandardMaterial({ color: 0xcfc6b3, roughness: 0.9 });
    for (const p of PLACES) {
      if (p.library) continue;
      const s = p.bank === 'e' ? 1 : -1, win = quayWindow(p);
      // the house: front plane on the quay line, facing the river
      w.building(s * (QUAY + DEPTH / 2), p.z, WIDTH, DEPTH, HEIGHT, s > 0 ? -Math.PI / 2 : Math.PI / 2, p.kind);
      w.reserve(s * (QUAY - 5), p.z, 5, 12);                      // no quay lamp in front of the window

      const g = new THREE.Group();
      const map = loader.load(new URL(`../assets/video/${p.id}-start.jpg`, import.meta.url).href);
      map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
      const mat = new THREE.MeshBasicMaterial({ map, toneMapped: false });
      mat.color.setScalar(REST);
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w, WIN.h), mat);
      g.add(pic);
      // a dark painted frame, a stone sill and a lintel, a little proud of the picture
      const t = 0.32;
      for (const [dx, dy, bw, bh] of [[0, WIN.h / 2 + t / 2, WIN.w + 2 * t, t], [0, -WIN.h / 2 - t / 2, WIN.w + 2 * t, t], [-WIN.w / 2 - t / 2, 0, t, WIN.h], [WIN.w / 2 + t / 2, 0, t, WIN.h]]) {
        const f = box(bw, bh, 0.3, frameMat); f.position.set(dx, dy, 0.1); g.add(f);
      }
      const sill = box(WIN.w + 1.4, 0.35, 0.9, sillMat); sill.position.set(0, -WIN.h / 2 - t - 0.17, 0.35); g.add(sill);
      const lintel = box(WIN.w + 1.2, 0.5, 0.5, sillMat); lintel.position.set(0, WIN.h / 2 + t + 0.25, 0.2); g.add(lintel);
      // a soft glow behind the glass edge so the window reads from far away
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w * 1.5, WIN.h * 1.7), new THREE.MeshBasicMaterial({
        map: haloTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffc078, opacity: 0.35 }));
      halo.position.z = -0.05; g.add(halo);

      g.position.set(win.c.x, win.c.y, win.c.z);
      g.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      w.add(g, 'building');
      pic.userData.cls = 'window'; halo.userData.cls = 'window';
      const light = warmLight(win.c.x - s * 9, 2, win.c.z, 40, 26);
      windows[p.id] = { mesh: pic, mat, light, halo };
    }
    const setLit = (id, k) => {
      const o = windows[id]; if (!o) return;
      o.mat.color.setScalar(k); o.halo.material.opacity = 0.2 + 0.25 * k; o.light.intensity = 30 + 30 * k;
    };
    return { windows, setLit, rest: REST };
  },
};

let _halo;
function haloTex() {
  if (_halo) return _halo;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 10, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  _halo = new THREE.CanvasTexture(c); return _halo;
}
