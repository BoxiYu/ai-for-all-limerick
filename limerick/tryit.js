// "Try it": inside each window, one short conversation between a person and AI, always in the same four beats:
//   1 You ask (amber, a person's bubble and an action: a photo, holding up the phone, typing)
//   2 AI looks / listens / reads / searches (the picture switches to the AI's view: a cyan scan, outlines, boxes)
//   3 AI answers (a cyan bubble, typed)
//   4 You decide (amber again: the person has the last word)
// A strip at the top shows which beat we are on. Everything is prepared in advance and runs offline; nothing calls a
// live AI model. The presenter presses → (or clicks the glowing ring) to move on; the AI beats run by themselves.
// Positions are percent of the window still (assets/video/<id>-start.jpg), measured on the pictures.
const A = 'limerick/assets/';
const h = (tag, cls, html, style) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (style) e.style.cssText = style; return e; };
const pos = (x, y, w, hh) => `left:${x}%;top:${y}%;${w != null ? `width:${w}%;` : ''}${hh != null ? `height:${hh}%;` : ''}`;

let ac;
function shutter() {
  try {
    ac ||= new AudioContext();
    const n = ac.sampleRate * 0.09, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n / 6));
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = 'bandpass'; f.frequency.value = 2400; g.gain.value = 0.5;
    s.buffer = b; s.connect(f).connect(g).connect(ac.destination); s.start();
  } catch { /* silence is fine */ }
}

// ---------------------------------------------------------------- the eight conversations
// beat: { who: 'you', text, ring: [x, y, label], act?: 'photo' | 'listen', input?: true }
//       { who: 'ai', sense?: fn(ctx) (the AI's view on the picture), text?: string | string[], attach?: fn(ctx, bubble), note? }
const SCRIPTS = {
  kitchen: { verb: 'looks', beats: [
    { who: 'you', ring: [45, 40, 'Take a photo'], act: 'photo', text: 'What could I make tonight with this?' },
    { who: 'ai', sense: (c) => c.see([['eggs', 10, 29, 10, 8], ['eggs', 31, 24, 7.5, 4.5], ['leeks', 28, 37, 16, 11], ['cheese', 8, 51, 10.5, 12], ['potatoes', 30, 64, 11, 16], ['milk', 42.5, 66.5, 6, 14]]),
      text: ['I can see eggs, leeks, cheese, potatoes and milk. You could make:', '· leek and potato soup', '· a cheesy leek omelette', '· leek and potato gratin'] },
    { who: 'you', ring: [80, 76, 'She decides'], text: 'Soup it is. I\'ll add a bit of the cheese on top.' },
  ] },
  nature: { verb: 'listens', beats: [
    { who: 'you', ring: [44, 49, 'Hold up the phone'], act: 'listen', text: 'Who is that singing out there?' },
    { who: 'ai', sense: (c) => c.listen([14, 37, 12, 20]), text: 'That sounds like a European robin.', note: 'Probably. It can be wrong when it\'s noisy.' },
    { who: 'you', ring: [80, 76, 'He decides'], text: 'A robin, singing at night! I\'ll put out some seed for him.' },
  ] },
  library: { verb: 'explains', beats: [
    { who: 'you', ring: [80, 30, 'Ask'], text: 'What is "the cloud"?' },
    { who: 'ai', text: 'Data and software kept on remote servers in data centres, which you reach over the internet instead of from your own device.' },
    { who: 'you', ring: [80, 55, 'Ask again'], text: 'Can you explain that more simply?' },
    { who: 'ai', text: 'Your photos and files are kept on big computers somewhere else, and you reach them through the internet.' },
    { who: 'you', ring: [80, 70, 'Ask again'], text: 'Give me an example.' },
    { who: 'ai', text: 'It\'s like keeping your good china at your sister\'s house instead of in your own press: it\'s safe there, and you can get it whenever you like.' },
    { who: 'you', ring: [80, 80, 'She decides'], text: 'Now I get it. I\'ll write that down.', note: 'Ask as often as you like. For things that matter, check.' },
  ] },
  travel: { verb: 'reads', beats: [
    { who: 'you', ring: [80, 30, 'Point the camera'], act: 'photo', text: 'What does this menu say?' },
    { who: 'ai', sense: (c) => c.menu(), text: 'Here it is in English.', note: 'Download the language before you go, and it works without the internet.' },
    { who: 'you', ring: [80, 76, 'They decide'], text: 'The risotto with porcini mushrooms, per favore!' },
  ] },
  photos: { verb: 'searches', beats: [
    { who: 'you', ring: [81, 52, 'Type'], text: 'dog beach', typed: true },
    { who: 'ai', sense: (c) => c.dim(), text: 'Found 3 photos with a dog on a beach.', attach: (c, b) => c.grid(b) },
    { who: 'you', ring: [80, 82, 'They decide'], text: 'Ah, would you look at her. That\'s the one for the frame.' },
  ] },
  card: { verb: 'looks', beats: [
    { who: 'you', ring: [59.5, 54, 'Take a photo'], act: 'photo', text: 'Can you read my card to me?' },
    { who: 'ai', sense: (c) => c.see([['card', 41, 46.5, 9.5, 20], ['robin', 43.5, 51, 5.2, 7.5]]), voice: `${A}voice/cardread.mp3`,
      text: 'A Christmas card with a painting of a robin on a holly branch. Inside, in neat handwriting: "Happy Christmas, Nana! We miss you, and we can\'t wait to see you. Love, Aoife."' },
    { who: 'you', ring: [80, 80, 'She decides'], text: 'Read it again, slowly. And then I\'ll ring her.' },
  ] },
  verse: { verb: 'writes', beats: [
    { who: 'you', ring: [80, 30, 'Ask'], text: 'A short Christmas verse for my daughter in Australia, please.' },
    { who: 'ai', text: 'Here is one idea:', attach: (c, b) => c.verse(b) },
    { who: 'you', ring: [26, 70, 'Your own last line'], input: true, text: 'Love always, Mam xx' },
  ] },
  weather: { verb: 'forecasts', beats: [
    { who: 'you', ring: [80, 30, 'Ask'], text: 'What\'s it like tomorrow? Can we go to the beach?' },
    { who: 'ai', sense: (c) => c.forecast(), text: 'Tomorrow on the west coast: bright and crisp, a light breeze.', note: 'Behind the forecast, Europe\'s weather centre runs an AI forecast alongside its usual one. Forecasters decide what to tell us.' },
    { who: 'you', ring: [80, 82, 'They decide'], text: 'Wellies on, everyone. We\'re going to Kilkee!' },
  ] },
};

const VERSE = ['From frosty Limerick, warm and bright,', 'we send you love this Christmas night.', 'Though oceans keep us far apart,', 'you\'re always close, here in my heart.'];
const MENU = [['Zuppa del giorno', 'Soup of the day'], ['Risotto ai funghi porcini', 'Risotto with porcini mushrooms'],
  ['Saltimbocca alla romana', 'Veal with sage and ham, Roman style'], ['Pesce del giorno alla griglia', 'Grilled fish of the day'],
  ['Tiramisù della casa', 'House tiramisu'], ['Caffè corretto', 'Espresso with a dash of grappa']];
const PHOTOS = ['cake', 'dog2', 'wedding', 'garden', 'xmas', 'dog1', 'hurling', 'hills', 'baby', 'dog3', 'caravan', 'swan'];

// ---------------------------------------------------------------- the engine
/**
 * Mount one window's conversation into `root` (a box exactly over the picture).
 * api: { wait(ms), animate(ms, fn(k)), play(src) → Promise, still (img src), onDone() }
 * Returns { next(), stop(), done } ; next() is what → does.
 */
export function startTry(root, id, api) {
  const S = SCRIPTS[id]; if (!S) { api.onDone(); return { next() {}, stop() {} }; }
  const { wait, animate } = api;
  root.innerHTML = '';
  let stopped = false, busy = false, i = 0, waitingRing = null, raf = 0;
  const steps = h('ol', 'tp-steps', ['You ask', `AI ${S.verb}`, 'AI answers', 'You decide'].map((t, k) => `<li data-k="${k}"><b>${k + 1}</b>${t}</li>`).join(''));
  const chat = h('div', 'tp-chat', '<div class="tp-msgs"></div>');
  const msgs = chat.querySelector('.tp-msgs');
  const fx = h('div', 'tp-fx');                         // the AI's view sits here, over the picture
  root.append(fx, chat, steps);
  const mark = (k) => steps.querySelectorAll('li').forEach((li, j) => { li.classList.toggle('on', j === k); li.classList.toggle('past', j < k); });
  const scroll = () => { msgs.scrollTop = msgs.scrollHeight; };

  async function typeInto(el, text, cps = 45) {
    el.textContent = '';
    for (let k = 0; k < text.length; k++) { if (stopped) return; el.textContent += text[k]; if (k % 2) await wait(2000 / cps); scroll(); }
  }
  const bubble = (who) => {
    const b = h('div', `tp-msg ${who}`, `<span class="tp-who">${who === 'you' ? '' : '✦'}</span><div class="tp-body"><p class="tp-text"></p></div>`);
    msgs.append(b); requestAnimationFrame(() => b.classList.add('on')); scroll(); return b;
  };

  // ---- the AI's view (the old talk's "machine view", in a small form) ----
  const ctx = {
    /** Scan line sweeps down; behind it the painting turns into cyan outlines; then boxes with names. */
    async see(boxes) {
      const cv = edges(api.still); fx.append(cv); const scan = h('div', 'tp-scan'); fx.append(scan);
      fx.classList.add('on');
      await animate(1400, (k) => { cv.style.clipPath = `inset(0 0 ${100 - k * 100}% 0)`; scan.style.top = `${k * 100}%`; });
      scan.remove();
      for (const [name, x, y, w, hh] of boxes) { fx.append(h('div', 'tp-box', `<b>${name}</b>`, pos(x, y, w, hh))); await wait(220); }
      await wait(500);
      cv.classList.add('fade');                         // the outlines fade; the boxes stay as what it "saw"
    },
    async listen(box) {
      const cv = h('canvas', 'tp-spec'); cv.width = 640; cv.height = 200;
      const b = msgs.lastElementChild?.classList.contains('ai') ? msgs.lastElementChild : null;
      const panel = h('div', 'tp-specwrap', '<p class="tp-small">Listening…</p>'); panel.append(cv);
      (b ? b.querySelector('.tp-body') : msgs).append(panel); scroll();
      const g = cv.getContext('2d'); let t = 0;
      const draw = () => {
        t++; const x = (t * 3) % cv.width; if (x < 3) g.clearRect(0, 0, cv.width, cv.height);
        g.fillStyle = 'rgba(8,12,22,.12)'; g.fillRect(x, 0, 6, cv.height);
        if (Math.sin(t * 0.045) > -0.2) for (let k = 0; k < 3; k++) {
          const y = 30 + 140 * (0.5 + 0.45 * Math.sin(t * (0.21 + k * 0.07) + k * 2));
          g.fillStyle = `rgba(143,233,255,${0.6 + 0.4 * Math.random()})`; g.fillRect(x, y, 4, 8 + Math.random() * 16);
        }
        raf = requestAnimationFrame(draw);
      };
      draw(); fx.classList.add('on');
      await wait(2600);
      fx.append(h('div', 'tp-box', '<b>robin</b>', pos(...box)));
      panel.querySelector('.tp-small').textContent = 'Sound ID';
      await wait(500);
    },
    async menu() {
      const sheet = (en) => `<p class="tp-menu-h">${en ? 'Menu' : 'Menù'}</p>${MENU.map(([it, e]) => `<p>${en ? e : it}</p>`).join('')}`;
      const m = h('div', 'tp-menu', `<div class="tp-menu-it">${sheet(false)}</div><div class="tp-menu-en">${sheet(true)}</div><div class="tp-lens"><span>English</span></div>`, pos(12, 8, 40, 82));
      const en = m.querySelector('.tp-menu-en'), lens = m.querySelector('.tp-lens');
      const place = (fy) => { const top = Math.max(0, Math.min(84, fy)); lens.style.top = `${top}%`; en.style.clipPath = `inset(${top}% 0 ${Math.max(0, 100 - top - 26)}% 0)`; };
      let drag = false;
      lens.addEventListener('pointerdown', (e) => { drag = true; lens.setPointerCapture(e.pointerId); });
      lens.addEventListener('pointermove', (e) => { if (!drag) return; const r = m.getBoundingClientRect(); place(((e.clientY - r.top) / r.height) * 100 - 13); });
      lens.addEventListener('pointerup', () => { drag = false; });
      fx.append(m); place(-30); fx.classList.add('on'); await wait(60); m.classList.add('on'); await wait(600);
      await animate(3800, (k) => place(-10 + k * 94));
      await animate(1200, (k) => place(84 - k * 59));          // back up to the risotto
    },
    async dim() { fx.classList.add('on', 'dark'); await wait(700); },
    async grid(b) {
      const g = h('div', 'tp-grid', PHOTOS.map((n) => `<img data-n="${n}" src="${A}photos/${n}.jpg" alt="">`).join(''));
      b.querySelector('.tp-body').append(g); scroll(); await wait(900);
      g.classList.add('found'); g.querySelectorAll('img').forEach((im) => im.classList.toggle('hit', /^dog/.test(im.dataset.n)));
      await wait(900);
    },
    async verse(b) {
      const p = h('p', 'tp-hand'); b.querySelector('.tp-body').append(p);
      for (const line of VERSE) { const s = h('span'); p.append(s, h('br')); await typeInto(s, line, 32); }
    },
    async forecast() {
      const tv = h('div', 'tp-tv', '<div class="tp-sky"></div><p class="tp-when">Tonight</p><p class="tp-wx">Snow showers</p>', pos(7.6, 33.4, 18.6, 33.6));
      const sky = tv.querySelector('.tp-sky');
      fx.append(tv); fx.classList.add('on'); await wait(60); tv.classList.add('on'); await wait(800);
      await animate(2800, (k) => { sky.style.setProperty('--k', k); if (k > 0.5) { tv.querySelector('.tp-when').textContent = 'Tomorrow'; tv.querySelector('.tp-wx').textContent = 'Bright and crisp'; } });
    },
  };

  // ---- the card for the verse: the AI's lines plus the room's own last line ----
  let input = null;
  function showRing(b) {
    const [x, y, label] = b.ring;
    const r = h('button', 'tp-ring', `<i></i><span>${label}</span>`, pos(x, y)); r.type = 'button';
    r.addEventListener('click', (e) => { e.stopPropagation(); next(); });
    root.append(r); waitingRing = r;
    if (b.input) {
      const card = msgs.querySelector('.tp-hand');
      const line = h('p', 'tp-hand tp-own');
      input = h('input', 'tp-input'); input.type = 'text'; input.maxLength = 60; input.placeholder = 'Type the room\'s last line…';
      line.append(input); card?.after(line); scroll();
      setTimeout(() => input?.focus(), 50);
    }
  }
  async function runAI(b) {
    mark(1);
    const bub = bubble('ai'); bub.querySelector('.tp-text').innerHTML = '<span class="tp-dots"><i></i><i></i><i></i></span>';
    if (b.sense) await b.sense(ctx);
    if (stopped) return;
    mark(2);
    const voice = b.voice ? api.play(b.voice) : null;
    const lines = [].concat(b.text || []);
    const t = bub.querySelector('.tp-text'); t.textContent = '';
    for (const [k, line] of lines.entries()) { const s = h('span', k ? 'tp-line' : ''); t.append(s); await typeInto(s, line, b.voice ? 17 : 45); }
    if (b.attach) await b.attach(ctx, bub);
    if (b.note) bub.querySelector('.tp-body').append(h('p', 'tp-small', b.note));
    scroll();
    if (voice) await voice;
  }
  async function runYou(b) {
    mark(i === S.beats.length - 1 ? 3 : 0);
    if (b.act === 'photo') { api.flash(); shutter(); await wait(300); }
    const bub = bubble('you'); const t = bub.querySelector('.tp-text');
    if (b.input) {
      const text = input?.value.trim() || b.text;
      input?.parentElement && (input.parentElement.textContent = text); input = null;
      t.textContent = 'That\'s the last line, in my own words.';
      return;
    }
    await typeInto(t, b.text, b.typed ? 9 : 50);
  }
  // advance: run the waiting "you" beat, then every AI beat after it, then show the next ring (or finish)
  async function next() {
    if (busy || stopped) return;
    const b = S.beats[i]; if (!b) return;
    busy = true; waitingRing?.remove(); waitingRing = null;
    await runYou(b); i++;
    while (!stopped && S.beats[i]?.who === 'ai') { await runAI(S.beats[i]); i++; }
    busy = false;
    if (stopped) return;
    if (S.beats[i]) { mark(i === S.beats.length - 1 ? 3 : 0); showRing(S.beats[i]); }
    else { mark(3); steps.classList.add('done'); await wait(1400); if (!stopped) api.onDone(); }
  }
  mark(0); showRing(S.beats[0]);
  return {
    next, get typing() { return document.activeElement === input; },
    stop() { stopped = true; cancelAnimationFrame(raf); root.innerHTML = ''; },
    finish: async () => { while (!stopped && i < S.beats.length) { await next(); } },   // the self-check runs it all
  };
}

/** The AI's view of a picture: a Sobel edge map drawn as thin cyan lines on dark blue (like the old talk's machine view). */
function edges(src) {
  const img = new Image(); img.src = src;
  const W = 640, H = 360, cv = h('canvas', 'tp-edges'); cv.width = W; cv.height = H;
  const draw = () => {
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H), p = d.data, L = new Float32Array(W * H);
    for (let k = 0; k < W * H; k++) L[k] = p[k * 4] * 0.3 + p[k * 4 + 1] * 0.59 + p[k * 4 + 2] * 0.11;
    const out = g.createImageData(W, H), o = out.data;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const k = y * W + x;
      const gx = -L[k - W - 1] - 2 * L[k - 1] - L[k + W - 1] + L[k - W + 1] + 2 * L[k + 1] + L[k + W + 1];
      const gy = -L[k - W - 1] - 2 * L[k - W] - L[k - W + 1] + L[k + W - 1] + 2 * L[k + W] + L[k + W + 1];
      const m = Math.min(1, Math.hypot(gx, gy) / 260);
      o[k * 4] = 10 + 133 * m; o[k * 4 + 1] = 18 + 215 * m; o[k * 4 + 2] = 34 + 221 * m; o[k * 4 + 3] = 235;
    }
    g.putImageData(out, 0, 0);
  };
  if (img.complete) draw(); else img.onload = draw;
  return cv;
}

export const TRY_CSS = `
#try{position:fixed;z-index:3;pointer-events:none}
#try>*{position:absolute}
#try .tp-ring,#try .tp-chat,#try .tp-menu{pointer-events:auto}
.tp-fx{inset:0;pointer-events:none}
.tp-fx.dark::before{content:"";position:absolute;inset:0;background:rgba(3,8,18,.55);transition:opacity .6s}
.tp-edges{position:absolute;inset:0;width:100%;height:100%;transition:opacity 1.6s;mix-blend-mode:normal}
.tp-edges.fade{opacity:.0}
.tp-scan{position:absolute;left:0;right:0;height:3px;background:var(--cyan);box-shadow:0 0 22px 6px rgba(143,233,255,.7)}
.tp-ring{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:8px;background:none;border:0;cursor:pointer;color:var(--amber);font:inherit;padding:0;z-index:2}
.tp-ring i{width:58px;height:58px;border-radius:50%;border:3px solid var(--amber);box-shadow:0 0 24px rgba(255,198,90,.6),inset 0 0 18px rgba(255,198,90,.35);position:relative}
.tp-ring i::after{content:"";position:absolute;inset:-3px;border-radius:50%;border:3px solid var(--amber);animation:ping 1.8s ease-out infinite}
.tp-ring span{font:700 clamp(16px,1.2vw,24px) var(--sans);background:rgba(8,12,22,.82);border:1px solid rgba(255,198,90,.5);padding:.3em .8em;border-radius:999px;white-space:nowrap}
@keyframes ping{from{transform:scale(1);opacity:.8}to{transform:scale(2.1);opacity:0}}
.tp-flash{position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:6;animation:tpflash .5s ease-out}
@keyframes tpflash{0%{opacity:.85}100%{opacity:0}}
.tp-box{position:absolute;border:3px solid var(--cyan);border-radius:6px;box-shadow:0 0 16px rgba(143,233,255,.55),inset 0 0 14px rgba(143,233,255,.18);animation:tpin .35s ease-out}
.tp-box b{position:absolute;left:-3px;bottom:100%;background:var(--cyan);color:#04131a;font:700 clamp(15px,1.1vw,22px)/1 var(--sans);padding:5px 8px;border-radius:5px 5px 0 0;white-space:nowrap}
@keyframes tpin{from{opacity:0;transform:scale(1.15)}to{opacity:1;transform:none}}

/* the steps strip: You ask → AI … → AI answers → You decide */
.tp-steps{left:50%;top:3%;transform:translateX(-50%);display:flex;gap:6px;margin:0;padding:6px;list-style:none;background:rgba(8,12,22,.78);border-radius:999px;
  border:1px solid rgba(244,239,227,.18);white-space:nowrap}
.tp-steps li{display:flex;align-items:center;gap:.45em;padding:.35em .9em;border-radius:999px;font:600 clamp(14px,1.05vw,21px) var(--sans);color:rgba(244,239,227,.45);transition:all .4s}
.tp-steps li b{display:grid;place-items:center;width:1.5em;height:1.5em;border-radius:50%;border:1.5px solid currentColor;font-size:.8em}
.tp-steps li:nth-child(1).on,.tp-steps li:nth-child(4).on{background:rgba(255,198,90,.16);color:var(--amber)}
.tp-steps li:nth-child(2).on,.tp-steps li:nth-child(3).on{background:rgba(143,233,255,.14);color:var(--cyan)}
.tp-steps li.past{color:rgba(244,239,227,.75)}

/* the conversation: the person's bubbles amber on the right, the AI's cyan on the left */
.tp-chat{right:2.5%;top:12%;width:33%;max-height:66%;display:flex;flex-direction:column;background:rgba(8,12,22,.8);border:1px solid rgba(244,239,227,.16);
  border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:14px}
.tp-msgs{overflow:auto;display:flex;flex-direction:column;gap:12px;scrollbar-width:none}
.tp-msg{display:flex;gap:10px;align-items:flex-start;opacity:0;transform:translateY(10px);transition:opacity .45s,transform .45s}
.tp-msg.on{opacity:1;transform:none}
.tp-msg.you{flex-direction:row-reverse}
.tp-who{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font:700 18px var(--sans)}
.tp-msg.you .tp-who{background:rgba(255,198,90,.2);border:2px solid var(--amber)}
.tp-msg.you .tp-who::before{content:"";width:12px;height:12px;border-radius:50%;background:var(--amber);box-shadow:0 10px 0 -1px var(--amber)}
.tp-msg.ai .tp-who{background:rgba(143,233,255,.14);border:2px solid var(--cyan);color:var(--cyan)}
.tp-body{max-width:86%;padding:.55em .85em;border-radius:14px}
.tp-msg.you .tp-body{background:rgba(255,198,90,.15);border:1px solid rgba(255,198,90,.45);border-top-right-radius:4px}
.tp-msg.ai .tp-body{background:rgba(143,233,255,.09);border:1px solid rgba(143,233,255,.4);border-top-left-radius:4px}
.tp-text{margin:0;font:500 clamp(17px,1.3vw,27px)/1.38 var(--sans)}
.tp-msg.you .tp-text{color:#ffe2a8}.tp-msg.ai .tp-text{color:#d9f6ff}
.tp-line{display:block}
.tp-small{font:italic 500 clamp(14px,1vw,19px)/1.35 var(--serif);color:var(--soft);margin:.5em 0 0}
.tp-dots{display:inline-flex;gap:5px}.tp-dots i{width:8px;height:8px;border-radius:50%;background:var(--cyan);animation:dots 1s infinite}
.tp-dots i:nth-child(2){animation-delay:.15s}.tp-dots i:nth-child(3){animation-delay:.3s}
@keyframes dots{0%,100%{opacity:.25}50%{opacity:1}}
.tp-specwrap{margin-top:10px}.tp-spec{width:100%;height:auto;border-radius:10px;background:#081018;display:block}
.tp-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:.5em}
.tp-grid img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:5px;transition:all .8s cubic-bezier(.65,0,.35,1)}
.tp-grid.found img{opacity:.12;filter:grayscale(1);transform:scale(.88)}
.tp-grid.found img.hit{opacity:1;filter:none;transform:scale(1.06);box-shadow:0 0 0 3px var(--amber)}
.tp-hand{margin:.5em 0 0;padding:.5em .7em;background:#fbf6ea;color:#24324a;border-radius:4px;
  font:400 clamp(20px,1.55vw,32px)/1.4 "Snell Roundhand","Segoe Script","Bradley Hand","Brush Script MT",cursive}
.tp-hand.tp-own{color:#7a2e1a;margin-top:2px;border-top:1px dashed rgba(122,46,26,.3)}
.tp-input{width:100%;font:inherit;color:#7a2e1a;background:transparent;border:0;outline:none}
.tp-menu{position:absolute;background:#f5ecd9;color:#3a2a1a;border-radius:6px;box-shadow:0 20px 60px rgba(0,0,0,.6);transform:rotate(-1.5deg);opacity:0;transition:opacity .8s;overflow:hidden}
.tp-menu.on{opacity:1}
.tp-menu>div{position:absolute;inset:0;padding:7% 9%}
.tp-menu p{font:400 clamp(20px,1.7vw,34px)/1.2 var(--serif);margin:0 0 .9em;text-align:center}
.tp-menu .tp-menu-h{font:italic 700 clamp(30px,2.6vw,52px) var(--serif);color:#7a2e1a;margin-bottom:1em}
.tp-menu-en{background:#eaf7ff;color:#0b3550;clip-path:inset(100% 0 0 0)}
.tp-menu-en p{font-family:var(--sans);font-weight:600}
.tp-lens{position:absolute;left:4%;right:4%;height:26%;border:4px solid var(--cyan);border-radius:22px;box-shadow:0 0 22px rgba(143,233,255,.6);cursor:grab;touch-action:none}
.tp-lens span{position:absolute;right:10px;top:-15px;background:var(--cyan);color:#04131a;font:700 14px var(--sans);padding:3px 8px;border-radius:6px}
.tp-tv{position:absolute;overflow:hidden;border-radius:4px;opacity:0;transition:opacity .8s;display:flex;flex-direction:column;justify-content:flex-end;padding:6%}
.tp-tv.on{opacity:1}
.tp-sky{position:absolute;inset:0;--k:0;
  background:radial-gradient(circle at calc(30% + 10% * var(--k)) calc(70% - 40% * var(--k)),rgba(255,214,90,var(--k)) 0,rgba(255,214,90,calc(var(--k) * .9)) 9%,transparent 10%),
    linear-gradient(rgb(calc(30 + 120 * var(--k)),calc(45 + 160 * var(--k)),calc(80 + 170 * var(--k))),rgb(calc(60 + 150 * var(--k)),calc(80 + 150 * var(--k)),calc(120 + 120 * var(--k))))}
.tp-sky::after{content:"";position:absolute;inset:0;opacity:calc(1 - var(--k));
  background-image:radial-gradient(2px 2px at 20% 30%,#fff,transparent),radial-gradient(2px 2px at 60% 20%,#fff,transparent),radial-gradient(2px 2px at 80% 60%,#fff,transparent),radial-gradient(2px 2px at 35% 70%,#fff,transparent),radial-gradient(2px 2px at 50% 45%,#fff,transparent),radial-gradient(2px 2px at 10% 80%,#fff,transparent);
  background-size:60px 60px;animation:tpsnow 3s linear infinite}
@keyframes tpsnow{to{background-position:0 60px}}
.tp-when,.tp-wx{position:relative;margin:0;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.6)}
.tp-when{font:700 clamp(18px,1.4vw,28px) var(--sans)}.tp-wx{font:500 clamp(14px,1vw,20px) var(--sans)}
@media (prefers-reduced-motion:reduce){.tp-ring i::after,.tp-sky::after,.tp-dots i{animation:none}}
`;
