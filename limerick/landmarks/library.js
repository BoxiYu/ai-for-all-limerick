// The library: a dignified, generic civic library on the east quay, with a sign over the door.
// It STANDS IN for Limerick City Library, which since November 2021 has been in temporary premises at Barrow House,
// Michael Street, while the new central library is built at the Opera Site. No real building is drawn here.
//
// Look: pale limestone, rusticated ground floor with tall round-headed windows (warm reading rooms, shelf silhouettes),
// a slightly projecting centre bay with glazed doors, a dark teal sign above the door, a tall reading-room window above,
// a cornice and a raised attic over the centre. Footprint x 56..84, z 10..58; the river facade is the plane x = 58.
//
// HANDLE API (used by chapters): obj, facadeX, center, poemAt, sign (mesh),
//   setSign(lines: string[])  redraw the sign with 1–2 lines (e.g. another language), resetSign().
import { THREE, box, M, warmLight } from '../core.js';

const DEFAULT = ['City Library'];
const X0 = 58, X1 = 82, Z0 = 12, Z1 = 56, H = 22; // main block (the river facade is x = X0)
const CZ = 34, BAY = 16;                           // centre bay: z 26..42
const PX = 2 / 1;                                  // facade texture aspect (44 x 22 units)

/** Small local PRNG (mulberry32) so this landmark never touches the shared city random sequence. */
function prng(seed) {
  return () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- the sign ----------
function drawSign(canvas, lines) {
  const g = canvas.getContext('2d'), wd = canvas.width, h = canvas.height;
  g.clearRect(0, 0, wd, h);
  // dark teal panel with a soft inner gradient and a thin brass rule
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#11474b'); gr.addColorStop(1, '#0a3236');
  g.fillStyle = gr; g.fillRect(0, 0, wd, h);
  g.strokeStyle = '#c9a65e'; g.lineWidth = 5; g.strokeRect(14, 14, wd - 28, h - 28);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const two = lines.length > 1;
  // Avenir Next's Cyrillic л looks like a Greek Λ to most readers, so non-Latin text uses Helvetica Neue / Arial.
  const sans = /[^\u0000-\u024f]/.test(lines.join('')) ? '"Helvetica Neue", Arial, sans-serif' : '"Avenir Next", "Segoe UI", system-ui, sans-serif';
  const fit = (text, px, weight) => { let s = px; g.font = `${weight} ${s}px ${sans}`; while (g.measureText(text).width > wd - 110 && s > 30) { s -= 4; g.font = `${weight} ${s}px ${sans}`; } };
  g.fillStyle = '#f6ead0';
  fit(lines[0], two ? 104 : 128, 600); g.fillText(lines[0], wd / 2, two ? h * 0.37 : h / 2);
  if (two) {
    g.fillStyle = 'rgba(201,166,94,.8)'; g.fillRect(wd / 2 - 70, h * 0.565, 140, 3);
    g.fillStyle = '#d9e6df'; fit(lines[1], 72, 500); g.fillText(lines[1], wd / 2, h * 0.74);
  }
}

// ---------- facade textures ----------
/** Ashlar stone: horizontal courses, staggered joints, rusticated (deeper joints) below `rustY` (px from top). */
function stone(g, w, h, r, rustY = h) {
  g.fillStyle = '#b8b0a0'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 18) for (let x = (y / 18) % 2 ? -22 : 0; x < w; x += 44) {
    const v = 168 + r() * 26; g.fillStyle = `rgb(${v},${v - 6},${v - 18})`; g.fillRect(x + 1, y + 1, 42, 16);
  }
  g.fillStyle = 'rgba(40,34,28,.55)';
  for (let y = rustY; y < h; y += 18) g.fillRect(0, y, w, 3);
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(30,28,24,${r() * 0.08})`; g.fillRect(r() * w, r() * h, 2 + r() * 4, 2); }
}
/** A lit window: warm interior; with shelves, a reading room seen through the glass. emit = draw the emissive map. */
function windowPane(g, x, y, w, h, r, { emit, arch = false, shelves = true, lit = 1 }) {
  g.save();
  g.beginPath();
  if (arch) { g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath(); } else g.rect(x, y, w, h);
  g.clip();
  if (emit) {
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, `rgba(255,224,170,${lit})`); gr.addColorStop(0.5, `rgba(250,196,120,${lit})`); gr.addColorStop(1, `rgba(214,150,82,${lit})`);
    g.fillStyle = '#000'; g.fillRect(x, y, w, h); g.fillStyle = gr; g.fillRect(x, y, w, h);
    if (shelves) {
      // shelf units in silhouette: dark uprights and boards, books as dim coloured spines
      const top = y + h * 0.36, unitW = Math.max(18, w / 3);
      for (let ux = x + 2; ux < x + w - 4; ux += unitW) {
        g.fillStyle = 'rgba(40,22,10,.92)'; g.fillRect(ux, top, unitW - 4, y + h - top);
        for (let sy = top + 4; sy < y + h - 8; sy += 14) {
          for (let bx = ux + 3; bx < ux + unitW - 8;) {
            const bw = 2 + r() * 3, bh = 8 + r() * 4, v = 0.25 + r() * 0.35;
            g.fillStyle = `rgba(${Math.round(255 * v)},${Math.round(170 * v)},${Math.round(95 * v)},1)`; g.fillRect(bx, sy + 12 - bh, bw, bh); bx += bw + 0.8;
          }
          g.fillStyle = 'rgba(30,16,8,1)'; g.fillRect(ux, sy + 12, unitW - 4, 2);
        }
      }
    }
    // a pendant light glow near the top
    const rg = g.createRadialGradient(x + w / 2, y + h * 0.2, 1, x + w / 2, y + h * 0.2, w * 0.6);
    rg.addColorStop(0, 'rgba(255,240,205,.55)'); rg.addColorStop(1, 'rgba(255,240,205,0)'); g.fillStyle = rg; g.fillRect(x, y, w, h);
  } else { g.fillStyle = '#1e1a16'; g.fillRect(x, y, w, h); }
  g.restore();
  // glazing bars and stone surround (colour map only: frames are not lit)
  if (!emit) {
    g.strokeStyle = '#d8d0bf'; g.lineWidth = 5;
    g.beginPath();
    if (arch) { g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); } else g.rect(x, y, w, h);
    g.stroke();
    g.fillStyle = '#d8d0bf'; g.fillRect(x - 6, y + h, w + 12, 7); // sill
  } else {
    g.fillStyle = '#000'; g.fillRect(x + w / 2 - 1.5, y, 3, h); // mullion
    for (let k = 1; k < 3; k++) g.fillRect(x, y + (h * k) / 3, w, 2.5);
  }
}

/** Wing facade texture for the river side (the centre bay is a separate projecting slab). */
function riverFacade(emit) {
  const W = 1024, Hp = W / PX, u = W / (Z1 - Z0), r = prng(41);
  const c = document.createElement('canvas'); c.width = W; c.height = Hp; const g = c.getContext('2d');
  if (emit) { g.fillStyle = '#000'; g.fillRect(0, 0, W, Hp); } else stone(g, W, Hp, r, Hp - 9.5 * u);
  const yOf = (y) => Hp - y * u; // world height -> px
  // three bays per wing; tall round-headed ground-floor windows, upper windows with shelves in some
  for (const [a, b] of [[Z0, CZ - BAY / 2], [CZ + BAY / 2, Z1]]) {
    const bay = (b - a) / 3;
    for (let i = 0; i < 3; i++) {
      const zc = a + bay * (i + 0.5), x = (zc - Z0) * u;
      windowPane(g, x - 1.35 * u, yOf(8.6), 2.7 * u, 6.8 * u, r, { emit, arch: true, shelves: true });
      windowPane(g, x - 1.2 * u, yOf(20), 2.4 * u, 6.2 * u, r, { emit, shelves: i !== 1, lit: 0.85 + r() * 0.15 });
    }
  }
  if (!emit) { // string course between floors and a frieze line under the cornice
    g.fillStyle = '#cfc7b6'; g.fillRect(0, yOf(10.4), W, 0.55 * u);
    g.fillStyle = 'rgba(40,34,28,.35)'; g.fillRect(0, yOf(9.85), W, 3);
  }
  return c;
}
/** Centre bay: glazed double doors, a sign band (the sign mesh sits on it), and a tall reading-room window. */
function centreFacade(emit) {
  const W = 512, u = W / BAY, Hp = Math.round(H * u), r = prng(77);
  const c = document.createElement('canvas'); c.width = W; c.height = Hp; const g = c.getContext('2d');
  if (emit) { g.fillStyle = '#000'; g.fillRect(0, 0, W, Hp); } else stone(g, W, Hp, r, Hp - 10.6 * u);
  const yOf = (y) => Hp - y * u, xOf = (z) => (z + BAY / 2) * u;
  // tall reading-room window (three lights) above the sign
  for (const dz of [-4.2, 0, 4.2]) windowPane(g, xOf(dz - 1.7), yOf(20.4), 3.4 * u, 8.4 * u, r, { emit, arch: dz === 0, shelves: true });
  // doorway: warm glass doors in a stone surround
  if (emit) {
    const gr = g.createLinearGradient(0, yOf(6), 0, yOf(0)); gr.addColorStop(0, '#c79a62'); gr.addColorStop(1, '#a8743e'); // a touch below the windows so the doorway does not bloom out
    g.fillStyle = gr; g.fillRect(xOf(-2.3), yOf(6.1), 4.6 * u, 5.2 * u);
    g.fillStyle = '#000'; g.fillRect(xOf(-0.08), yOf(6.1), 0.16 * u, 5.2 * u); g.fillRect(xOf(-2.3), yOf(4.9), 4.6 * u, 0.12 * u);
  } else {
    g.fillStyle = '#2a2420'; g.fillRect(xOf(-2.3), yOf(6.1), 4.6 * u, 5.2 * u);
    g.strokeStyle = '#ddd5c4'; g.lineWidth = 0.45 * u; g.strokeRect(xOf(-2.5), yOf(6.3), 5 * u, 5.6 * u);
  }
  return c;
}
/** Plainer stone with two rows of windows for the side and back walls. */
function sideFacade(emit, wUnits) {
  const W = 512, u = W / wUnits, Hp = Math.round(H * u), r = prng(5);
  const c = document.createElement('canvas'); c.width = W; c.height = Hp; const g = c.getContext('2d');
  if (emit) { g.fillStyle = '#000'; g.fillRect(0, 0, W, Hp); } else stone(g, W, Hp, r, Hp - 9.5 * u);
  const n = Math.max(2, Math.round(wUnits / 6));
  for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n) * W;
    windowPane(g, x - 1.2 * u, Hp - 8.2 * u, 2.4 * u, 6 * u, r, { emit, arch: true, shelves: false, lit: 0.7 });
    windowPane(g, x - 1.1 * u, Hp - 19.6 * u, 2.2 * u, 5.6 * u, r, { emit, shelves: false, lit: i % 2 ? 0.25 : 0.75 });
  }
  return c;
}
function tex(canvas) { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function facadeMaterial(draw) {
  return new THREE.MeshStandardMaterial({ map: tex(draw(false)), emissiveMap: tex(draw(true)), emissive: 0xffffff, emissiveIntensity: 0.95, roughness: 0.92 });
}

export default {
  name: 'library',
  build(w) {
    const library = new THREE.Group();
    const trim = new THREE.MeshStandardMaterial({ color: 0xd2cab9, roughness: 0.85 });
    const river = facadeMaterial(riverFacade), sideZ = facadeMaterial((e) => sideFacade(e, X1 - X0)), back = facadeMaterial((e) => sideFacade(e, Z1 - Z0));

    // main block. BoxGeometry face order: +x, -x, +y, -y, +z, -z (the -x face is the river facade, u runs along +z).
    const b = box(X1 - X0, H, Z1 - Z0, [back, river, M.roof, M.dark, sideZ, sideZ]);
    b.position.set((X0 + X1) / 2, H / 2, (Z0 + Z1) / 2); library.add(b);
    // plinth, cornice and parapet
    const plinth = box(X1 - X0 + 0.8, 1, Z1 - Z0 + 0.8, trim); plinth.position.set((X0 + X1) / 2, 0.5, (Z0 + Z1) / 2); library.add(plinth);
    const cornice = box(X1 - X0 + 1.4, 0.9, Z1 - Z0 + 1.4, trim); cornice.position.set((X0 + X1) / 2, H + 0.45, (Z0 + Z1) / 2); library.add(cornice);
    for (const [px, pz, pw, pd] of [[X0 - 0.2, (Z0 + Z1) / 2, 0.7, Z1 - Z0 + 1], [X1 + 0.2, (Z0 + Z1) / 2, 0.7, Z1 - Z0 + 1], [(X0 + X1) / 2, Z0 - 0.2, X1 - X0 + 1, 0.7], [(X0 + X1) / 2, Z1 + 0.2, X1 - X0 + 1, 0.7]]) {
      const p = box(pw, 1.5, pd, trim); p.position.set(px, H + 1.65, pz); library.add(p);
    }
    // projecting centre bay (1 unit proud of the facade), its own cornice and a raised attic
    const centre = facadeMaterial(centreFacade);
    const bay = box(1, H, BAY, [trim, centre, trim, trim, trim, trim]); bay.position.set(X0 - 0.5, H / 2, CZ); library.add(bay);
    const bc = box(2.2, 1, BAY + 1.2, trim); bc.position.set(X0 - 0.4, H + 0.5, CZ); library.add(bc);
    const attic = box(1.4, 2.6, BAY - 1, trim); attic.position.set(X0 - 0.2, H + 2.3, CZ); library.add(attic);
    for (const s of [-1, 1]) { const pil = box(0.6, H, 1.1, trim); pil.position.set(X0 - 1.25, H / 2, CZ + s * (BAY / 2 - 0.55)); library.add(pil); }
    // door canopy and two shallow steps (stay inside x >= 56)
    const canopy = box(0.8, 0.3, 6.4, M.dark); canopy.position.set(X0 - 1.4, 6.35, CZ); library.add(canopy);
    for (let i = 0; i < 2; i++) { const st = box(1 - i * 0.5, 0.45, 8 - i * 1.2, trim); st.position.set(X0 - 1.5 + i * 0.25, 0.225 + i * 0.45, CZ); library.add(st); }

    // the sign: a dark teal panel on the band between the door and the reading-room window
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 320;
    drawSign(cv, DEFAULT);
    const stex = tex(cv);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(13.4, 13.4 * 320 / 1024), new THREE.MeshBasicMaterial({ map: stex }));
    sign.material.color.setScalar(1.0); // keep below the bloom threshold so the letters stay crisp
    sign.position.set(X0 - 1.28, 8.6, CZ); sign.rotation.y = -Math.PI / 2; library.add(sign);
    const signBack = box(0.25, 13.4 * 320 / 1024 + 0.5, 13.7, M.dark); signBack.position.set(X0 - 1.13, 8.6, CZ); library.add(signBack);

    // two small wall lanterns beside the door (not w.lamp: that would shift the shared lamp list)
    const lanterns = [];
    const glow = new THREE.MeshBasicMaterial({ color: 0xffd9a0 }); glow.color.multiplyScalar(1.15);
    for (const s of [-1, 1]) {
      const lg = new THREE.Group();
      const arm = box(0.8, 0.2, 0.2, M.dark); arm.position.set(-0.4, 0.9, 0); lg.add(arm);
      const head = box(0.7, 1.1, 0.7, glow); head.position.set(-0.6, 0.3, 0); lg.add(head);
      lg.position.set(X0 - 1.0, 4.4, CZ + s * 3.6); library.add(lg); lanterns.push(lg);
    }

    w.add(library, 'building');
    sign.userData.cls = 'sign'; signBack.userData.cls = 'sign';
    for (const lg of lanterns) lg.traverse((o) => { if (o.isMesh) o.userData.cls = 'lamp'; });
    w.reserve(70, 34, 28, 48);
    warmLight(47, 2.5, CZ, 240, 40); // the doorway's warm spill onto the quay (held off the facade so the door surround does not burn out)

    const setSign = (lines) => { drawSign(cv, lines?.length ? lines : DEFAULT); stex.needsUpdate = true; };
    return {
      obj: library, sign, facadeX: X0, center: new THREE.Vector3(70, 12, CZ),
      // the limerick hangs over the river beside the library (see c2)
      poemAt: new THREE.Vector3(4, 0, 44),
      setSign, resetSign: () => setSign(DEFAULT),
    };
  },
};
