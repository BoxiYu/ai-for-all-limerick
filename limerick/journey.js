// "Behind every window": the ninth stop. Mary's question about her fridge leaves her phone, goes up a phone mast,
// travels as light through fibre to a data centre on the horizon, is worked out on chips, which run on electricity
// from the grid and wind farms, and the answer comes all the way home. Six steps; → moves on.
// Facts (no numbers on screen): fibre carries data as pulses of light; AI chips do very many small calculations at
// the same time; data centres use a large share of Ireland's electricity (CSO; see FACTS4/FACTS5 notes).
import { THREE, scene, V } from './core.js';

const KITCHEN = V(38.6, 3.5, -98), MAST = V(62, 36, -92);
// drawn above the rooftops so it can be seen (the real cables run underground: the labels say so)
const ROUTE = [KITCHEN, V(46, 12, -96), MAST, V(110, 42, -76), V(210, 40, -50), V(360, 36, -25), V(530, 31, -5), V(690, 22, 10), V(790, 13, 22), V(860, 9, 30)];
const POWER = [V(1330, 30, 470), V(1180, 24, 360), V(1020, 24, 250), V(880, 24, 160), V(780, 22, 110), V(860, 9, 70)];

/** A glowing tube that reveals itself along its length (uP 0→1) with pulses running along it (towards uDir). */
function trail(points, color, radius) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const geo = new THREE.TubeGeometry(curve, 400, radius, 8, false);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uP: { value: 0 }, uT: { value: 0 }, uDir: { value: 1 }, uC: { value: new THREE.Color(color) }, uA: { value: 1 } },
    vertexShader: 'varying float u; void main(){ u = uv.x; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float uP, uT, uDir, uA; uniform vec3 uC; varying float u;
      void main(){
        float shown = uDir > 0. ? step(u, uP) : step(1. - uP, u);
        float pulse = pow(fract(u * 30. - uT * 1.4 * uDir), 6.);
        float head = smoothstep(0.03, 0., abs((uDir > 0. ? u : 1. - u) - uP)) * 2.5;
        gl_FragColor = vec4(uC * (0.55 + 1.6 * pulse + head), shown * uA * (0.5 + 0.5 * pulse) + head * 0.6);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 3;
  return { mesh, mat, curve };
}

function glowSprite(color, size) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.setScalar(size); s.renderOrder = 4; return s;
}

function buildProps() {
  const g = new THREE.Group(); g.visible = false;
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.8 });
  const white = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.6, emissive: 0x20262e });
  // the phone mast on a rooftop behind the kitchen
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.9, 36, 6), dark); mast.position.set(MAST.x, 18, MAST.z); g.add(mast);
  for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4, 1.4), white); const a = k * 2.1; p.position.set(MAST.x + Math.cos(a) * 1.4, 33, MAST.z + Math.sin(a) * 1.4); p.rotation.y = -a; g.add(p); }
  const red = glowSprite(0xff4a3a, 4); red.position.set(MAST.x, 36.8, MAST.z); g.add(red);
  // wind turbines south-east of the data centres
  const blades = [];
  for (const [x, z] of [[1250, 430], [1330, 470], [1410, 510], [1200, 530], [1290, 580], [1380, 620], [1460, 560]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 62, 8), white); t.position.set(x, 31, z); g.add(t);
    const hub = new THREE.Group(); hub.position.set(x - 1.6, 62, z); g.add(hub);
    for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 26, 1.6), white); b.position.y = 13; const arm = new THREE.Group(); arm.rotation.x = k * 2.094; arm.add(b); hub.add(arm); }
    hub.rotation.x = Math.random() * 6; blades.push(hub);
    const l = glowSprite(0xff4a3a, 3); l.position.set(x, 63.5, z); g.add(l);
  }
  // pylons along the power line
  for (let k = 1; k < POWER.length - 1; k++) {
    const p = POWER[k]; const py = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.4, 25, 4), dark); py.position.set(p.x, 12, p.z); g.add(py);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(10, 0.6, 0.6), dark); arm.position.set(p.x, 24, p.z); arm.lookAt(p.x + 1, 24, p.z + 1); g.add(arm);
  }
  scene.add(g);
  return { g, blades };
}

// ---------- the chips: a full-screen 2D picture, zooming into one chip with its cores lighting up in waves ----------
function chipLayer(el) {
  const wrap = document.createElement('div'); wrap.className = 'jr-chip';
  wrap.innerHTML = '<canvas></canvas><p class="jr-chip-l">One chip, seen from very close: thousands of tiny calculators, all working at once.</p>';
  el.insertBefore(wrap, el.querySelector('.jr-label'));
  const cv = wrap.querySelector('canvas'); let raf = 0, t = 0;
  const draw = () => {
    const W = cv.width = cv.clientWidth * devicePixelRatio, H = cv.height = cv.clientHeight * devicePixelRatio, g = cv.getContext('2d');
    g.fillStyle = '#040810'; g.fillRect(0, 0, W, H);
    const S = Math.min(W, H) * 0.78, x0 = (W - S) / 2, y0 = (H - S) / 2;
    // package, pins
    g.fillStyle = '#10151d'; g.fillRect(x0 - S * 0.06, y0 - S * 0.06, S * 1.12, S * 1.12);
    g.fillStyle = '#b8954a';
    for (let k = 0; k < 28; k++) { const o = x0 + (k + 0.5) * S / 28; g.fillRect(o - 3, y0 - S * 0.11, 6, S * 0.05); g.fillRect(o - 3, y0 + S * 1.06, 6, S * 0.05); g.fillRect(x0 - S * 0.11, o - x0 + y0 - 3, S * 0.05, 6); g.fillRect(x0 + S * 1.06, o - x0 + y0 - 3, S * 0.05, 6); }
    // the cores
    const N = 36, c = S / N;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const wave = Math.sin(i * 0.35 + j * 0.22 - t * 0.09) + Math.sin(i * 0.13 - j * 0.31 + t * 0.06) + (((i * 7 + j * 13 + (t >> 2)) % 23) === 0 ? 2.4 : 0);
      const k = Math.max(0, Math.min(1, (wave + 0.6) / 2.6));
      g.fillStyle = `rgba(${40 + 103 * k},${70 + 163 * k},${100 + 155 * k},${0.35 + 0.65 * k})`;
      g.fillRect(x0 + i * c + 1, y0 + j * c + 1, c - 2, c - 2);
    }
    t++; raf = requestAnimationFrame(draw);
  };
  requestAnimationFrame(() => { wrap.classList.add('on'); draw(); });
  return { remove() { cancelAnimationFrame(raf); wrap.classList.remove('on'); setTimeout(() => wrap.remove(), 900); } };
}

export const JOURNEY_CSS = `
#journey{position:fixed;inset:0;pointer-events:none;z-index:3}
.jr-steps{position:absolute;left:50%;top:3%;transform:translateX(-50%);display:flex;gap:4px;margin:0;padding:6px;list-style:none;background:rgba(8,12,22,.78);
  border-radius:999px;border:1px solid rgba(244,239,227,.18);white-space:nowrap;opacity:0;transition:opacity .6s}
#journey.on .jr-steps{opacity:1}
.jr-steps li{padding:.35em .85em;border-radius:999px;font:600 clamp(14px,1vw,20px) var(--sans);color:rgba(244,239,227,.45);transition:all .4s}
.jr-steps li.on{background:rgba(143,233,255,.16);color:var(--cyan)}.jr-steps li.past{color:rgba(244,239,227,.8)}
.jr-steps li.home.on{background:rgba(255,198,90,.18);color:var(--amber)}
.jr-label{z-index:1;position:absolute;left:max(4vw,20px);top:14%;max-width:min(560px,40vw);opacity:0;transform:translateY(10px);transition:opacity .7s,transform .7s}
.jr-label.on{opacity:1;transform:none}
.jr-label .ui-line{font:600 clamp(26px,2.4vw,46px)/1.15 var(--serif);margin:.15em 0 .3em}
.jr-label .ui-src{font-size:clamp(16px,1.15vw,22px);line-height:1.4}
.jr-chip{position:absolute;inset:0;opacity:0;transform:scale(.25);transition:opacity .9s,transform 1.6s cubic-bezier(.65,0,.35,1)}
.jr-chip.on{opacity:1;transform:none}
.jr-chip canvas{width:100%;height:100%;display:block}
.jr-chip-l{display:none;position:absolute;left:50%;bottom:6%;transform:translateX(-50%);margin:0;font:italic 500 clamp(18px,1.6vw,30px) var(--serif);color:var(--cyan);text-shadow:0 2px 8px #000;white-space:nowrap}
`;

/**
 * api: { world, fly(shot, dur, cb), after(ms), animate(ms, fn), say(src, text), NARRATION, setLit(id,k), onDone() }
 * Returns { next(), stop(), update(dt) }.
 */
export function startJourney(el, api) {
  const { world, fly, after, animate } = api;
  const props = startJourney.props ||= buildProps();
  const out = startJourney.trails ||= { route: trail(ROUTE, 0x8fe9ff, 0.9), power: trail(POWER, 0xffc65a, 1.1) };
  for (const t of [out.route, out.power]) { if (!t.mesh.parent) scene.add(t.mesh); t.mat.uniforms.uP.value = 0; t.mat.uniforms.uDir.value = 1; t.mat.uniforms.uA.value = 1; t.mat.uniforms.uC.value.set(t === out.route ? 0x8fe9ff : 0xffc65a); }
  const head = startJourney.head ||= glowSprite(0x8fe9ff, 7); scene.add(head); head.visible = false;
  props.g.visible = true; world.lm.datacentres?.show(true);
  const fog = scene.fog.density; scene.fog.density = 0.0009;

  el.innerHTML = `<ol class="jr-steps">${['Her phone', 'The network', 'A data centre', 'The chips', 'The power', 'Back home'].map((s, k) => `<li class="${k === 5 ? 'home' : ''}">${s}</li>`).join('')}</ol>
    <div class="jr-label ui-card"><p class="ui-kicker"></p><p class="ui-line"></p><p class="ui-src"></p></div>`;
  el.classList.add('on');
  const label = el.querySelector('.jr-label');
  const mark = (k) => el.querySelectorAll('.jr-steps li').forEach((li, j) => { li.classList.toggle('on', j === k); li.classList.toggle('past', j < k); });
  async function show(kicker, line, src) {
    label.classList.remove('on'); await after(350);
    label.querySelector('.ui-kicker').textContent = kicker; label.querySelector('.ui-line').textContent = line; label.querySelector('.ui-src').textContent = src;
    label.classList.add('on');
  }
  let stopped = false, busy = false, k = -1, chip = null, T = 0;
  const route = out.route, power = out.power;
  const run = (t, ms, from, to) => animate(ms, (e) => { t.mat.uniforms.uP.value = from + (to - from) * e; if (t === route) { head.position.copy(route.curve.getPointAt(Math.min(0.999, Math.max(0, t.mat.uniforms.uDir.value > 0 ? t.mat.uniforms.uP.value : 1 - t.mat.uniforms.uP.value)))); } });
  const SHOTS = [
    { pos: V(4, 16, -62), at: V(42, 10, -96) },
    { pos: V(-60, 170, 190), at: V(340, 0, -10) },
    { pos: V(600, 60, 160), at: V(930, 8, 20) },
    null,
    { pos: V(1010, 70, 700), at: V(1220, 40, 430) },
    { pos: V(300, 150, 160), at: V(60, 10, -80) },
  ];
  const STEPS = [
    async () => {
      fly(SHOTS[0], 3);
      await show('Behind every window', 'Where does a question go?', 'Mary asked about her fridge. Let\'s follow her question.');
      head.visible = true; head.material.color.set(0x8fe9ff);
      await run(route, 2600, 0, 0.1);
    },
    async () => {
      fly(SHOTS[1], 5);
      await show('The network', 'Up to a phone mast, then along fibre as light.', 'Fibre-optic cables carry it as pulses of light, under streets and fields.');
      await run(route, 5200, 0.1, 0.86);
    },
    async () => {
      fly(SHOTS[2], 4.5);
      await run(route, 2600, 0.86, 1);
      await show('A data centre', 'Big, quiet buildings full of computers.', 'Often far from where we live. This one is illustrative.');
    },
    async () => {
      await show('The chips', 'Very many small sums, all at the same time.', 'Special chips work out the answer in a second or two.');
      chip = chipLayer(el);
    },
    async () => {
      chip?.remove(); chip = null;
      fly(SHOTS[4], 4.5);
      await show('The power', 'All of it runs on electricity.', 'From wind farms and power stations, through the grid. Data centres use a large share of Ireland\'s electricity: a real cost, worth knowing.');
      await run(power, 4200, 0, 1);
    },
    async () => {
      fly(SHOTS[5], 6);
      await show('Back home', 'And the answer comes all the way back.', '"Leek and potato soup." In a second or two, to a kitchen in Limerick.');
      route.mat.uniforms.uC.value.set(0xffc65a); head.material.color.set(0xffc65a); route.mat.uniforms.uDir.value = -1;
      await run(route, 5000, 0, 1);
      api.setLit('kitchen', 2.2); await after(900); api.setLit('kitchen', 1.35);
    },
  ];
  async function next() {
    if (busy || stopped) return;
    if (k === STEPS.length - 1) { stop(); api.onDone(); return; }
    busy = true; k++; mark(k);
    api.say(`limerick/assets/voice/journey${k}.mp3`, api.NARRATION[`journey${k}`]);
    await STEPS[k]();
    busy = false;
  }
  function stop() {
    if (stopped) return; stopped = true;
    chip?.remove(); el.classList.remove('on'); setTimeout(() => { if (stopped) el.innerHTML = ''; }, 700);
    props.g.visible = false; world.lm.datacentres?.show(false); head.visible = false;
    for (const t of [route, power]) scene.remove(t.mesh);
    scene.fog.density = fog;
  }
  function update(dt) {
    T += dt; route.mat.uniforms.uT.value = T; power.mat.uniforms.uT.value = T;
    for (const b of props.blades) b.rotation.x += dt * 0.9;
  }
  next();
  return { next, stop, update, get step() { return k; } };
}
