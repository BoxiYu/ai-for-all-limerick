// AI for All · A Winter's Night in Limerick.
// The city is the talk. Eight lit windows, one ordinary evening (see places.js). The presenter presses → to fly into the
// next window; the window grows to full screen while a narrator tells what is happening (assets/voice/<id>.mp3). Inside,
// a short conversation between a person and AI plays out in four beats (tryit.js): You ask → AI looks/listens →
// AI answers → You decide; → moves it on. A card gives the line to remember; → goes back to the city, where the
// window stays lit. After all eight, → shows what is behind them (journey.js: phone, network, data centre, chips,
// power, home), then the finale.
// Reuses the world (core.js + world.js); it does not load the old chapters.
//
// Keys: → / Enter / Space / PageDown next · ← / Esc / PageUp back · 1–8 a window · J the journey · 0 overview · V narration on/off · C captions
//       N speaker notes · F full screen · B black screen · H hide text · Home restart.
// Test hooks: ?still adds window.__tick(n), __open(id), __back(), __finale(), __state(); ?shot settles the scene and
// reads the hash: #intro, #city, #lit, #<id> (in front of the window), #<id>-full (first ring), #<id>-done, #<id>-card,
// #journey0 (then → steps), #finale.
// ?check runs the whole talk fast and prints a JSON report into <pre id="check-out">.
import { THREE, scene, camera, renderer, composer, diffuse, grade, reduced, $, V } from './core.js';
import { world } from './world.js';
import { PLACES as BASE, quayWindow } from './places.js';
import { startTry, TRY_CSS } from './tryit.js';
import { startJourney, JOURNEY_CSS } from './journey.js';
document.head.append(Object.assign(document.createElement('style'), { textContent: TRY_CSS + JOURNEY_CSS }));

const Q = new URLSearchParams(location.search);
const CHECK = Q.has('check'), STILL = Q.has('still') || Q.has('shot') || CHECK;
const FAST = CHECK ? 0.02 : 1;                     // the self-check runs every timing at 2%
const errors = [];
addEventListener('error', (e) => errors.push(String(e.message)));
addEventListener('unhandledrejection', (e) => errors.push(String(e.reason?.message || e.reason)));

// ---------- places ----------
const v3 = (o) => V(o.x, o.y, o.z);
const LIB = { c: V(56.9, 16.2, 34), w: 3.4, h: 8.4, arch: true, near: { pos: V(28, 16.6, 34), at: V(57, 16.2, 34) }, spot: V(57, 31, 34), focus: '38% 45%' };
const PLACES = BASE.map((p, i) => {
  const q = p.library ? LIB : quayWindow(p);
  return {
    ...p, key: String(i + 1),
    still: `limerick/assets/video/${p.id}-start.jpg`, video: null, voice: `limerick/assets/voice/${p.id}.mp3`,
    focus: q.focus || '50% 50%',
    win: { c: v3(q.c), w: q.w, h: q.h, arch: !!q.arch },
    near: { pos: v3(q.near.pos), at: v3(q.near.at) },
    spot: v3(q.spot),
  };
});
const OVERVIEW = { pos: V(-150, 128, 330), at: V(8, 0, 48) };
const FINALE = { pos: V(-170, 165, 360), at: V(10, 0, 40) };
const winLM = world.lm.windows;

// ---------- camera (eased flights, a gentle drift at rest) ----------
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const cam = { pos: OVERVIEW.pos.clone(), at: OVERVIEW.at.clone(), from: null, to: null, atFrom: null, atTo: null, t: 1, dur: 1, onDone: null };
function fly(shot, dur, onDone) {
  cam.from = cam.pos.clone(); cam.to = shot.pos.clone(); cam.atFrom = cam.at.clone(); cam.atTo = shot.at.clone();
  cam.t = reduced ? 1 : 0; cam.dur = dur * FAST; cam.onDone = onDone || null;
  if (reduced) { cam.pos.copy(cam.to); cam.at.copy(cam.atTo); const f = cam.onDone; cam.onDone = null; f?.(); }
}
function jump(shot) { cam.t = 1; cam.onDone = null; cam.pos.copy(shot.pos); cam.at.copy(shot.at); }

// ---------- hotspots ----------
const spotsEl = $('#spots');
for (const p of PLACES) {
  const b = document.createElement('button');
  b.className = 'spot'; b.type = 'button';
  b.innerHTML = `<i aria-hidden="true"></i><span class="ui-chip human"><small>${p.key}</small> ${p.label}</span>`;
  b.setAttribute('aria-label', `${p.label}: open`);
  b.addEventListener('click', (e) => { e.stopPropagation(); open(p); });
  spotsEl.append(b); p.el = b;
}
const pv = new THREE.Vector3();
function toScreen(p) { pv.copy(p).project(camera); return { x: (pv.x + 1) / 2 * innerWidth, y: (1 - pv.y) / 2 * innerHeight, behind: pv.z > 1 }; }
function placeSpots() {
  for (const p of PLACES) {
    const s = toScreen(p.spot);
    p.el.style.left = `${s.x}px`; p.el.style.top = `${s.y}px`;
    p.el.classList.toggle('off', state !== 'city' || s.behind);
  }
}
/** The window's rectangle on screen, from its four corners (every window lies in a plane x = const). */
function windowRect(p) {
  const { c, w, h } = p.win, pts = [];
  for (const dy of [-h / 2, h / 2]) for (const dz of [-w / 2, w / 2]) pts.push(toScreen(V(c.x, c.y + dy, c.z + dz)));
  const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// ---------- narration ----------
// One <audio> for the narrator. While it speaks, the video's own sound is lowered so the words stay clear.
const voice = new Audio(); voice.preload = 'auto';
window.__voice = voice;                          // for checking playback from the console
let voiceOn = !Q.has('mute');
const cap = $('#cap');
function say(src, text) {
  cap.textContent = text || ''; cap.classList.toggle('on', !!text && !document.body.classList.contains('nocap'));
  if (!voiceOn || CHECK) return Promise.resolve(false);
  voice.src = src; voice.currentTime = 0;
  return new Promise((res) => {
    const done = () => { voice.onended = voice.onerror = null; res(true); };
    voice.onended = done; voice.onerror = () => { voice.onended = voice.onerror = null; res(false); };
    voice.play().catch(() => res(false));
  });
}
function hush() { voice.pause(); voice.onended?.(); cap.classList.remove('on'); }
const NARRATION = {};   // id -> text, loaded from NARRATION.md so the captions always match the recording
fetch('limerick/NARRATION.md').then((r) => r.text()).then((md) => {
  for (const [, id, txt] of md.matchAll(/^## (\w+)\n([\s\S]+?)(?=\n## |$)/gm)) NARRATION[id] = txt.trim();
}).catch(() => {});

// ---------- portal ----------
const portal = $('#portal'), img = portal.querySelector('img'), video = portal.querySelector('video');
const card = $('#card'), hint = $('#hint'), title = $('#title'), closing = $('#closing');
let state = 'intro', current = null;           // intro | city | flying | opening | playing | card | closing | finale
const visited = new Set();
let token = 0;                                  // bumps on every open/back so stale timers do nothing

function setRect(r, radius) {
  Object.assign(portal.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px`, borderRadius: radius });
}
const archRadius = (r) => `${r.w / 2}px ${r.w / 2}px 2px 2px / ${r.w / 2}px ${r.w / 2}px 2px 2px`;
const after = (ms) => new Promise((res) => setTimeout(res, reduced ? 0 : ms * FAST));
/** Run fn(k) for k 0→1 over ms (eased); timer-driven so it also runs in headless checks. */
const animate = (ms, fn) => new Promise((res) => {
  const dur = reduced ? 0 : ms * FAST, t0 = performance.now();
  const step = () => { const k = dur ? Math.min(1, (performance.now() - t0) / dur) : 1; fn(ease(k)); if (k < 1) setTimeout(step, 16); else res(); };
  step();
});
const tryEl = $('#try');
let tryRun = null;
/** The picture's rectangle on screen (object-fit: cover, 16:9, with the place's focus point). */
function coverRect(focus = '50% 50%') {
  const W = innerWidth, H = innerHeight, w = Math.max(W, H * 16 / 9), hh = w * 9 / 16;
  const [fx, fy] = focus.split(' ').map((v) => parseFloat(v) / 100);
  return { x: (W - w) * fx, y: (H - hh) * fy, w, h: hh };
}
function placeTry() { const r = coverRect(current?.focus); Object.assign(tryEl.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` }); }
const fx2 = new Audio();
function playFx(src) {
  hush();                                         // the narrator steps aside for the phone's own voice
  if (CHECK || !voiceOn) return Promise.resolve(false);
  fx2.src = src; fx2.currentTime = 0;
  return new Promise((res) => { fx2.onended = () => res(true); fx2.onerror = () => res(false); fx2.play().catch(() => res(false)); });
}
function flash() { const f = document.createElement('div'); f.className = 'tp-flash'; document.body.append(f); setTimeout(() => f.remove(), 600); }
function stopTry() { tryRun?.stop(); tryRun = null; fx2.pause(); tryEl.classList.remove('carded', 'on'); }
const videoReady = (src) => new Promise((res) => {
  if (CHECK) return res(false);
  const ok = () => { clear(); res(true); }, bad = () => { clear(); res(false); };
  const clear = () => { video.removeEventListener('loadeddata', ok); video.removeEventListener('error', bad); };
  video.addEventListener('loadeddata', ok); video.addEventListener('error', bad);
  video.src = src; video.load();
  setTimeout(bad, 4000);
});

async function open(p) {
  if (!['city', 'intro'].includes(state)) return;
  const my = ++token;
  hideIntro(); hush();
  state = 'flying'; current = p; hint.classList.add('out');
  img.src = p.still; portal.style.setProperty('--focus', p.focus);
  const hasVideo = p.video ? videoReady(p.video) : Promise.resolve(false);
  fly(p.near, 2.4, async () => {
    if (my !== token) return;
    // 1. the lit window: its picture appears inside the window shape
    state = 'opening';
    const r = windowRect(p);
    portal.classList.remove('grow', 'full', 'playing', 'kb'); setRect(r, p.win.arch ? archRadius(r) : '2px');
    portal.style.opacity = '0'; portal.getBoundingClientRect();
    portal.classList.add('grow'); portal.style.opacity = '1';
    await after(650); if (my !== token) return;
    // 2. it grows to fill the screen while the camera keeps leaning in
    fly({ pos: p.near.pos.clone().lerp(p.near.at, 0.55), at: p.near.at }, 1.5);
    setRect({ x: 0, y: 0, w: innerWidth, h: innerHeight }, '0px'); portal.classList.add('full');
    await after(1550); if (my !== token) return;
    // 3. inside: the video (its first frame is the same picture) and the narrator together
    state = 'playing';
    const vid = p.video ? await hasVideo : false; if (my !== token) return;
    let played = false;
    if (vid) {
      try { video.currentTime = 0; video.volume = 1; await video.play(); played = true; } catch { /* the still stays */ }
      if (my !== token) { video.pause(); return; }
      if (played) portal.classList.add('playing');
    }
    if (voiceOn) video.volume = 0.35;                             // duck any clip under the narrator…
    say(p.voice, NARRATION[p.id]).then((ok) => { if (my === token) video.volume = 1; return ok; }); // …and restore it after
    // the conversation: You ask → AI looks/listens → AI answers → You decide. → moves it on; then the card.
    placeTry(); tryEl.classList.add('on');
    tryRun = startTry(tryEl, p.id, { wait: after, animate, play: playFx, flash, still: p.still,
      onDone: () => { if (my === token && state === 'playing') showCard(); } });
  });
}
function showCard() {
  const p = current; state = 'card'; tryEl.classList.add('carded');
  cap.classList.remove('on');
  card.querySelector('.ui-kicker').textContent = p.kicker;
  card.querySelector('.ui-line').textContent = p.line;
  card.querySelector('.ui-src span').textContent = p.src;
  card.classList.add('on');
}
async function back() {
  if (!current || !['playing', 'card', 'opening'].includes(state)) return;
  const my = ++token;
  const p = current; state = 'closing';
  card.classList.remove('on'); video.pause(); hush(); stopTry();
  // shrink the picture back into the window, then let the city return
  fly(p.near, 1.5);
  await after(80); if (my !== token) return;
  const r = nearRect(p);
  setRect(r, p.win.arch ? archRadius(r) : '2px'); portal.classList.remove('full');
  await after(1500); if (my !== token) return;
  portal.style.opacity = '0';
  visited.add(p.id); p.el.classList.add('visited'); winLM?.setLit(p.id, 1.35);
  await after(500); if (my !== token) return;
  portal.classList.remove('grow', 'playing', 'kb');
  fly(OVERVIEW, 2.6, () => {
    if (my !== token) return;
    state = 'city'; current = null;
    if (visited.size === PLACES.length) { hint.textContent = journeyDone ? 'Press → for the last word.' : 'Every window is lit. Press → to see what is behind them.'; hint.classList.remove('out'); }
  });
}
/** Where the window will be on screen once the camera is back at `near` (computed with a temporary camera). */
function nearRect(p) {
  const saved = { pos: camera.position.clone(), q: camera.quaternion.clone() };
  camera.position.copy(p.near.pos); camera.lookAt(p.near.at); camera.updateMatrixWorld();
  const r = windowRect(p);
  camera.position.copy(saved.pos); camera.quaternion.copy(saved.q); camera.updateMatrixWorld();
  return r;
}
card.querySelector('#back').addEventListener('click', back);

// ---------- intro and finale ----------
function hideIntro() { title.classList.add('out'); }
async function intro() {
  // first press: the title gives way, the narrator sets the scene over the city
  if (state !== 'intro') return;
  hideIntro(); state = 'city';
  fly({ pos: V(-120, 92, 250), at: V(10, 4, 40) }, 9);
  const my = token;
  const spoke = await say('limerick/assets/voice/intro.mp3', NARRATION.intro);
  if (!spoke && my === token) await after(6000);            // no narrator: leave the caption up long enough to read
  if (my !== token || state !== 'city') return;
  cap.classList.remove('on');
  hint.textContent = 'Press → to look inside the first window.'; hint.classList.remove('out');
}
async function finale() {
  const my = ++token;
  state = 'finale'; hint.classList.add('out');
  for (const p of PLACES) winLM?.setLit(p.id, 1.6);
  glowTo(1.35, 5);
  fly(FINALE, 6);
  await after(2500); if (my !== token) return;
  closing.classList.add('on');
  const spoke = await say('limerick/assets/voice/finale.mp3', NARRATION.finale);
  if (!spoke) await after(9000);                            // no narrator: leave the closing words up to read
  if (my !== token) return;
  cap.classList.remove('on');
}
// ---------- behind every window: the question's journey (journey.js) ----------
let jr = null, journeyDone = false;
function journey() {
  if (state !== 'city') return;
  ++token; hush(); state = 'journey'; hint.classList.add('out');
  jr = startJourney($('#journey'), { world, fly, after, animate, say, NARRATION, setLit: (id, k) => winLM?.setLit(id, k),
    onDone: () => { jr = null; journeyDone = true; hush(); state = 'city'; finale(); } });
}
let glow = { from: 1, to: 1, t: 1, dur: 1 };
function glowTo(v, dur) { glow = { from: world.cityGlow.value, to: v, t: 0, dur: dur * FAST }; }
function restart() {
  ++token; hush(); video.pause(); stopTry(); jr?.stop(); jr = null; journeyDone = false;
  visited.clear(); for (const p of PLACES) { p.el.classList.remove('visited'); winLM?.setLit(p.id, winLM.rest); }
  card.classList.remove('on'); closing.classList.remove('on'); portal.classList.remove('grow', 'full', 'playing', 'kb'); portal.style.opacity = '0';
  title.classList.remove('out'); hint.classList.add('out'); hint.textContent = '';
  glowTo(1, 1); state = 'intro'; current = null; fly(OVERVIEW, 2);
}

// ---------- speaker notes ----------
const notes = $('#notes');
function renderNotes() {
  const p = current || PLACES.find((q) => !visited.has(q.id));
  if (state === 'journey') { const j = `journey${Math.max(0, jr?.step ?? 0)}`; $('#notes-h').textContent = `Behind every window · step ${(jr?.step ?? 0) + 1}/6`; $('#notes-body').innerHTML = `<p>Let the pictures carry it. Phone → mast → fibre as light → data centre → chips → power → back home. The point: it is real machinery and real electricity, not magic.</p><p class="next"><b>Narrator says:</b> ${NARRATION[j] || ''}</p>`; return; }
  const k = state === 'intro' ? 'intro' : state === 'finale' || !p ? 'finale' : p.id;
  const label = k === 'intro' ? 'Opening' : k === 'finale' ? 'Close' : `${p.key}. ${p.label}`;
  const extra = k === 'intro' ? 'Welcome everyone. A show of hands: who has tried one of these AI assistants? Whatever your answer, tonight is a walk through one winter evening in Limerick. Say once: every picture and the narrator\'s voice tonight were made with AI tools (Nano Banana Pro, Gemini). The stories and conversations are prepared examples, not live AI.'
    : k === 'finale' ? 'Free help to start: AIReady.ie, and ask at your library about the Age-Friendly AI programme. Then hand over to Patrick or open the floor.' : p.notes;
  $('#notes-h').textContent = `${label} · ${visited.size}/${PLACES.length} windows lit`;
  $('#notes-body').innerHTML = `<p>${extra}</p><p class="next"><b>Narrator says:</b> ${NARRATION[k] || '(narration not loaded)'}</p>`;
}
document.querySelector('#notes [data-close]').onclick = () => notes.close();

// ---------- keys (clicker friendly) ----------
const NEXT = ['ArrowRight', 'PageDown', 'Enter', ' '], BACK = ['ArrowLeft', 'PageUp', 'Escape', 'Backspace'];
function next() {
  if (state === 'intro') intro();
  else if (state === 'city') {
    const p = PLACES.find((q) => !visited.has(q.id));
    if (p) open(p); else if (!journeyDone) journey(); else finale();
  } else if (state === 'journey') jr?.next(); else if (state === 'playing') tryRun?.next();
  else if (state === 'card') back();
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1600); }
addEventListener('keydown', (e) => {
  const k = e.key;
  if (e.target?.tagName === 'INPUT') { if (k === 'Enter') { e.preventDefault(); next(); } else if (k === 'Escape') e.target.blur(); return; }
  if (notes.open && !/^[nN]$/.test(k)) return;
  if (NEXT.includes(k)) { e.preventDefault(); next(); }
  else if (BACK.includes(k)) { e.preventDefault(); back(); }
  else if (k === '0' && state === 'city') fly(OVERVIEW, 2.2);
  else if ((k === 'j' || k === 'J') && state === 'city') journey();
  else if (k === 'Home') restart();
  else if (k === 'v' || k === 'V') {
    voiceOn = !voiceOn; if (!voiceOn) { hush(); video.volume = 1; }   // hush() also lets a waiting card appear
    toast(voiceOn ? 'Narration on' : 'Narration off');
  } else if (k === 'n' || k === 'N') { if (notes.open) notes.close(); else { renderNotes(); notes.showModal(); } }
  else if (k === 'f' || k === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); }
  else if (k === 'b' || k === 'B') document.body.classList.toggle('blackout');
  else if (k === 'h' || k === 'H') document.body.classList.toggle('hide-ui');
  else if (k === 'c' || k === 'C') { document.body.classList.toggle('nocap'); toast(document.body.classList.contains('nocap') ? 'Captions off' : 'Captions on'); }
  else { const p = PLACES.find((q) => q.key === k); if (p) { if (state === 'intro') hideIntro(), state = 'city'; open(p); } }
});
canvasClick();
function canvasClick() { $('#gl').addEventListener('click', () => { if (state === 'intro') next(); }); }

// ---------- loop ----------
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(Math.max(0.75, Math.min(devicePixelRatio, 1.5, 2200 / w)));
  composer.setPixelRatio(renderer.getPixelRatio());
  renderer.setSize(w, h, false); composer.setSize(w, h);
  camera.aspect = w / h; camera.fov = w / h < 1 ? 62 : 42; camera.updateProjectionMatrix();
  diffuse.uniforms.uRes.value.set(w, h);
  if (state === 'playing' || state === 'card' || (state === 'opening' && portal.classList.contains('full'))) setRect({ x: 0, y: 0, w, h }, '0px');
  if (tryRun) placeTry();
}
addEventListener('resize', resize);
diffuse.enabled = false; grade.enabled = false;
scene.fog.density = 0.0021;
const clock = new THREE.Clock();
let T = 0;
function tick(dt, render = true) {
  T += dt;
  if (cam.t < 1) {
    cam.t = Math.min(1, cam.t + dt / cam.dur); const k = ease(cam.t);
    cam.pos.lerpVectors(cam.from, cam.to, k); cam.at.lerpVectors(cam.atFrom, cam.atTo, k);
    if (cam.t >= 1 && cam.onDone) { const f = cam.onDone; cam.onDone = null; f(); }
  }
  if (glow.t < 1) { glow.t = Math.min(1, glow.t + dt / glow.dur); world.cityGlow.value = glow.from + (glow.to - glow.from) * ease(glow.t); }
  const d = reduced || !['city', 'intro', 'finale', 'journey'].includes(state) || cam.t < 1 ? 0 : 1.2;
  camera.position.set(cam.pos.x + Math.sin(T * 0.07) * d, cam.pos.y + Math.sin(T * 0.11) * d * 0.2, cam.pos.z + Math.cos(T * 0.06) * d * 0.6);
  camera.lookAt(cam.at);
  world.update(dt, T, camera);
  jr?.update(dt);
  placeSpots();
  if (render && !(state === 'playing' || state === 'card')) composer.render(dt);
}
function frame() { tick(Math.min(clock.getDelta(), 0.05)); requestAnimationFrame(frame); }

// ---------- boot, deep links for screenshots, self-check ----------
resize();
Object.assign(window, { __state: () => state });
if (STILL) {
  document.body.classList.add('still');
  Object.assign(window, { __tick: (n = 60, dt = 0.05) => { for (let i = 0; i < n; i++) tick(dt); return state; }, __open: (id) => open(PLACES.find((p) => p.id === id)), __back: back, __finale: finale });
}
if (Q.has('shot')) {
  const h = location.hash.slice(1) || 'intro', [id, mode] = h.split('-'), p = PLACES.find((q) => q.id === id);
  if (h === 'city') { hideIntro(); state = 'city'; }
  if (h === 'lit') { hideIntro(); state = 'city'; for (const q of PLACES) { visited.add(q.id); q.el.classList.add('visited'); winLM?.setLit(q.id, 1.35); } }
  if (/^journey\d$/.test(h)) { hideIntro(); state = 'city'; for (const q of PLACES) { visited.add(q.id); q.el.classList.add('visited'); winLM?.setLit(q.id, 1.35); }
    journey(); const want = +h.slice(7); (async () => { for (let n = 0; n < want; n++) { await new Promise((r) => setTimeout(r, 9000)); jr?.next(); } })(); }
  if (h === 'finale') { hideIntro(); state = 'finale'; for (const q of PLACES) winLM?.setLit(q.id, 1.6); world.cityGlow.value = 1.35; jump(FINALE); closing.classList.add('on'); }
  if (p) {
    hideIntro(); state = 'city'; jump(p.near);
    if (['full', 'done', 'card'].includes(mode)) {
      current = p; state = 'card'; img.src = p.still; portal.style.setProperty('--focus', p.focus);
      portal.classList.add('full'); portal.style.opacity = '1'; setRect({ x: 0, y: 0, w: innerWidth, h: innerHeight }, '0px');
      state = 'playing'; placeTry(); tryEl.classList.add('on');
      tryRun = startTry(tryEl, p.id, { wait: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 5))), animate: (ms, f) => { f(1); return Promise.resolve(); }, play: () => Promise.resolve(), flash() {}, still: p.still, onDone: () => { if (mode === 'card') showCard(); } });
      if (mode === 'done' || mode === 'card') (async () => { for (let n = 0; n < 8; n++) { tryRun?.next(); await new Promise((r) => setTimeout(r, 1200)); } })();
    }
  }
  for (let i = 0; i < 160; i++) tick(0.05, false);
}
window.__booted = true;
requestAnimationFrame(() => { $('#loading').classList.add('gone'); clock.getDelta(); frame(); });

if (CHECK) (async () => {
  setInterval(() => tick(0.05, false), 20);     // headless Chrome may not run animation frames: keep the flights moving
  const log = [];
  const until = async (pred, ms = 20000) => { const t0 = performance.now(); while (!pred()) { if (performance.now() - t0 > ms) return false; await new Promise((r) => setTimeout(r, 30)); } return true; };
  const missing = [];
  for (const p of PLACES) for (const u of [p.still, p.voice]) { const r = await fetch(u, { method: 'HEAD' }).catch(() => null); if (!r?.ok) missing.push(u); }
  for (const u of ['limerick/assets/voice/intro.mp3', 'limerick/assets/voice/finale.mp3']) { const r = await fetch(u, { method: 'HEAD' }).catch(() => null); if (!r?.ok) missing.push(u); }
  const videos = [];
  for (const p of PLACES) { const r = await fetch(p.video, { method: 'HEAD' }).catch(() => null); if (r?.ok) videos.push(p.id); }
  next(); await until(() => state === 'city');
  for (const p of PLACES) {
    next(); await until(() => state === 'playing');
    for (let n = 0; n < 12 && state === 'playing'; n++) { next(); await new Promise((r) => setTimeout(r, 400)); }
    const inside = await until(() => state === 'card');
    next(); const out = await until(() => state === 'city');
    log.push({ id: p.id, inside, out, lit: visited.has(p.id) });
  }
  next(); await until(() => state === 'journey');
  const journeySteps = [];
  for (let n = 0; n < 10 && state === 'journey'; n++) { journeySteps.push(jr?.step); next(); await new Promise((r) => setTimeout(r, 900)); }
  await until(() => closing.classList.contains('on'));
  const pre = document.createElement('pre'); pre.id = 'check-out';
  pre.textContent = JSON.stringify({ errors, missing, videos, places: log, journey: journeySteps, finale: state === 'finale', narration: Object.keys(NARRATION).length }, null, 1);
  document.body.append(pre);
})();
