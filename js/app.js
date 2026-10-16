// Етап 4. Застосунок: стан, анімації, автомасштабування, перемикачі, підказки
const COL = { L: '#d62728', M: '#1f77b4', R: '#2ca02c', P: '#111' };
const $ = id => document.getElementById(id);
const S = { set: 5, mode: 'all', m: 2, grid: false, anim: null, speed: 1, mouse: null, view: null, rview: null, snap: true };
let main, resC, gridCharts = [], raf = 0, last = 0, cache = {};

function model(set = S.set, m = S.m) {
  const key = set + '|' + m + '|' + JSON.stringify(DATASETS[set].pts);
  if (cache[key]) return cache[key];
  const pts = DATASETS[set].pts.slice().sort((a, b) => a[0] - b[0]), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const mm = Math.min(m, xs.length - 1), w = LM.lagrangeWeights(xs), fit = LM.polyfit(xs, ys, mm);
  const yh = xs.map(x => fit.eval(x)), met = LM.metrics(ys, yh);
  const lr = LM.metrics(ys, xs.map(x => LM.lagrangeEval(xs, ys, x, w)));
  const N = 400, dif = Array.from({ length: N + 1 }, (_, i) => { const x = xs[0] + (xs[xs.length - 1] - xs[0]) * i / N; return LM.lagrangeEval(xs, ys, x, w) - fit.eval(x); });
  return cache[key] = { xs, ys, w, fit, yh, met, lr, mm, n: xs.length, xmin: xs[0], xmax: xs[xs.length - 1],
    maxDiff: Math.max(...dif.map(Math.abs)), rmsDiff: Math.sqrt(dif.reduce((s, d) => s + d * d, 0) / dif.length) };
}
const sample = (a, b, f, N = 300) => Array.from({ length: N + 1 }, (_, i) => { const x = a + (b - a) * i / N; return [x, f(x)]; });
const ease = u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const Lcurve = M => ({ color: COL.L, pts: sample(M.xmin, M.xmax, x => LM.lagrangeEval(M.xs, M.ys, x, M.w)) });
const Mcurve = M => ({ color: COL.M, pts: sample(M.xmin, M.xmax, x => M.fit.eval(x)) });

function buildSpecs(M, now) {
  let A = S.anim, t = A ? (now - A.t0) * S.speed : 0;
  if (A && ((A.type === 'interp' && t >= A.step * (M.n - 1)) || (A.type === 'mnk' && t >= A.T))) { S.anim = A = null; $('status').textContent = 'Анімацію завершено.'; }
  const pts = M.xs.map((x, i) => ({ x, y: M.ys[i] }));
  let curves = [], points = pts, segs = [], rp = [], rs = [], note = null, legend = [{ text: 'Експериментальні точки', color: COL.P, dot: true }];
  const showL = S.mode !== 'mnk', showM = S.mode !== 'interp';
  const Lf = k => x => LM.lagrangeEval(M.xs.slice(0, k), M.ys.slice(0, k), x);
  if (A && A.type === 'interp') {
    const idx = Math.floor(t / A.step), k = idx + 2, u = ease((t % A.step) / A.step), Lp = Lf(k - 1), Ln = Lf(k);
    const xe = M.xs[k - 2] + (M.xs[k - 1] - M.xs[k - 2]) * u;
    curves = [{ color: COL.L, pts: sample(M.xs[0], xe, x => (1 - u) * Lp(x) + u * Ln(x), 200) }];
    points = pts.slice(0, k).map((p, i) => ({ ...p, active: i === k - 1, scale: i === k - 1 ? .6 + .4 * u : 1 }));
    legend.push({ text: 'Лагранж (вузлів: ' + k + ')', color: COL.L }, { text: 'Активний вузол', color: '#ff7f0e', dot: true });
    note = 'Інтерполяція: r_i = 0 у вузлах'; rp = points.map(p => ({ x: p.x, y: 0, color: COL.L }));
    $('status').textContent = `Крок ${idx + 1}/${M.n - 1}: додано вузол №${k} (${M.xs[k - 1]}; ${M.ys[k - 1]}), степінь полінома ${k - 1}`;
  } else if (A && A.type === 'mnk') {
    const p = clamp(t / A.T, 0, 1), s = ease(p), c = M.fit.c.map((v, j) => j === 0 ? (1 - s) * M.met.mean + s * v : s * v);
    curves = [{ color: COL.M, pts: sample(M.xmin, M.xmax, x => M.fit.evalT(c, x)) }];
    M.xs.forEach((x, i) => {
      const yh = M.fit.evalT(c, x), f = clamp(p * M.n * 1.3 - i * 0.9, 0, 1), y1 = M.ys[i] + (yh - M.ys[i]) * f;
      segs.push({ x, y0: M.ys[i], y1: M.ys[i] + (yh - M.ys[i]) * f }); rs.push({ x, y0: 0, y1: (M.ys[i] - yh) * f }); rp.push({ x, y: (M.ys[i] - yh) * f, color: COL.R });
    });
    legend.push({ text: `МНК (m=${M.mm}), ріст ${Math.round(p * 100)}%`, color: COL.M }, { text: 'Залишки', color: COL.R });
    $('status').textContent = `МНК: коефіцієнти ростуть від горизонталі ŷ=ȳ=${M.met.mean.toFixed(3)} до остаточного полінома (${Math.round(p * 100)}%)`;
  } else {
    if (showL) { curves.push(Lcurve(M)); legend.push({ text: `Лагранж (степінь ${M.n - 1})`, color: COL.L }); }
    if (showM) {
      curves.push(Mcurve(M)); legend.push({ text: `МНК (m=${M.mm})`, color: COL.M }, { text: 'Залишки', color: COL.R });
      M.xs.forEach((x, i) => { segs.push({ x, y0: M.ys[i], y1: M.yh[i] }); rs.push({ x, y0: 0, y1: M.met.r[i] }); rp.push({ x, y: M.met.r[i], color: COL.R }); });
    } else { note = 'Інтерполяція: r_i = 0 у вузлах (max|r| = ' + M.lr.maxAbs.toExponential(1) + ')'; rp = M.xs.map(x => ({ x, y: 0, color: COL.L })); }
    if (showL && showM) rp = rp.concat(M.xs.map(x => ({ x, y: 0, color: COL.L, small: 1 })));
  }
  let gx = null;
  if (S.mouse && main.px && S.mouse.mx > main.m.l && S.mouse.mx < main.W - main.m.r) gx = main.v.xmin + (S.mouse.mx - main.m.l) / (main.W - main.m.l - main.m.r) * (main.v.xmax - main.v.xmin);
  const xr = [M.xmin, M.xmax];
  return {
    main: { curves, points, segs, xRange: xr, legend, title: DATASETS[S.set].title, guideX: gx, segWidth: 1.6 },
    res: { curves: [], points: rp, segs: rs, xRange: xr, includeZero: true, zeroLabel: 'r = 0', ylabel: 'r', segWidth: 4, note, title: 'Діаграма залишків', legend: null }
  };
}
function lerpView(cur, tgt, a) { if (!cur || S.snap) return { ...tgt }; for (const k in tgt) cur[k] += (tgt[k] - cur[k]) * a; return cur; }
const settled = (a, b) => Object.keys(b).every(k => Math.abs(a[k] - b[k]) < 1e-3 * (Math.abs(b.ymax - b.ymin) || 1));

function render(now, dt) {
  const M = model(), sp = buildSpecs(M, now), a = 1 - Math.exp(-dt / 110);
  const tv = autoView(sp.main), tr = autoView(sp.res);
  S.view = lerpView(S.view, tv, a); S.rview = lerpView(S.rview, tr, a); S.snap = false;
  main.draw(sp.main, S.view); resC.draw(sp.res, S.rview);
  updateTip(M, sp);
  return !settled(S.view, tv) || !settled(S.rview, tr);
}
function frame(now) {
  raf = 0; const dt = Math.min(100, last ? now - last : 16); last = now;
  if (S.grid) return;
  const dirty = render(now, dt);
  if (S.anim || dirty) kick(); else last = 0;
}
function kick() { if (!raf) raf = requestAnimationFrame(frame); }

function updateTip(M, sp) {
  const tip = $('tip'); if (!S.mouse || !main.px) { tip.style.display = 'none'; return; }
  const { mx, my } = S.mouse; let html = null;
  const hit = sp.main.points.map((p, i) => ({ p, i, d: Math.hypot(main.px(p.x) - mx, main.py(p.y) - my) })).sort((a, b) => a.d - b.d)[0];
  if (hit && hit.d < 14) {
    const i = hit.i; html = `<b>Вузол ${i + 1}</b><br>x = ${M.xs[i]}, y = ${M.ys[i]}<br>ŷ<sub>МНК</sub> = ${M.yh[i].toFixed(4)}<br>похибка r = ${M.met.r[i].toFixed(4)}`;
  } else if (sp.main.guideX != null && sp.main.curves.length) {
    const x = sp.main.guideX; html = `<b>x = ${x.toFixed(3)}</b>`;
    if (S.mode !== 'mnk' && !(S.anim && S.anim.type === 'mnk')) html += `<br><span style="color:${COL.L}">Лагранж:</span> ${LM.lagrangeEval(M.xs, M.ys, x, M.w).toFixed(4)}`;
    if (S.mode !== 'interp' && !(S.anim && S.anim.type === 'interp')) html += `<br><span style="color:${COL.M}">МНК:</span> ${M.fit.eval(x).toFixed(4)}`;
  }
  if (!html) { tip.style.display = 'none'; return; }
  tip.innerHTML = html; tip.style.display = 'block';
  const r = main.cv.getBoundingClientRect(); tip.style.left = Math.min(r.left + window.scrollX + mx + 14, window.scrollX + innerWidth - 190) + 'px'; tip.style.top = (r.top + window.scrollY + my + 14) + 'px';
}

// ---------- таблиці/метрики ----------
function eqStr(M) { return 'ŷ = ' + M.fit.mono.map((a, j) => (j ? (a < 0 ? ' − ' : ' + ') + Math.abs(a).toFixed(4) : a.toFixed(4)) + (j ? '·x' + (j > 1 ? '<sup>' + j + '</sup>' : '') : '')).join(''); }
function updateInfo() {
  const M = model(), f = v => v.toFixed(4);
  $('mdeg').max = 4; const warn = S.m > M.mm ? ` (для ${M.n} точок обмежено m=${M.mm})` : '';
  $('metrics').innerHTML = `<table><tr><th></th><th>Лагранж</th><th>МНК</th></tr>
   <tr><td>Степінь</td><td>${M.n - 1}</td><td>${M.mm}${warn}</td></tr>
   <tr><td>SSE = Σr²</td><td>${M.lr.sse.toExponential(2)}</td><td>${f(M.met.sse)}</td></tr>
   <tr><td>RMSE</td><td>${M.lr.rmse.toExponential(2)}</td><td>${f(M.met.rmse)}</td></tr>
   <tr><td>max |r|</td><td>${M.lr.maxAbs.toExponential(2)}</td><td>${f(M.met.maxAbs)}</td></tr>
   <tr><td>R²</td><td>1</td><td>${M.met.r2.toFixed(5)}</td></tr>
   <tr><td colspan=3>Розбіжність кривих на [x₀;xₙ]: max = ${f(M.maxDiff)}, RMS = ${f(M.rmsDiff)}</td></tr></table>
   <p class="eq">${eqStr(M)}</p>`;
  $('points').innerHTML = '<table><tr><th>i</th><th>x</th><th>y</th><th>ŷ МНК</th><th>r</th></tr>' + M.xs.map((x, i) => `<tr><td>${i + 1}</td><td>${x}</td><td>${M.ys[i]}</td><td>${f(M.yh[i])}</td><td>${f(M.met.r[i])}</td></tr>`).join('') + '</table>';
  $('pts').value = DATASETS[S.set].pts.map(p => `(${p[0]}, ${p[1]})`).join(', ');
}

// ---------- сітка 6 графіків ----------
function buildGrid() {
  const g = $('grid'); g.innerHTML = ''; gridCharts = [];
  ['L', 'M'].forEach(meth => [5, 10, 20].forEach(set => {
    const d = document.createElement('div'); d.className = 'cell'; const cv = document.createElement('canvas'); d.appendChild(cv); g.appendChild(d); gridCharts.push({ cv, meth, set });
  }));
  gridCharts.forEach(o => o.ch = new Chart(o.cv, true));
}
function drawGrid() {
  gridCharts.forEach(o => {
    o.ch.resize(); const M = model(o.set), L = o.meth === 'L';
    const spec = { curves: [L ? Lcurve(M) : Mcurve(M)], points: M.xs.map((x, i) => ({ x, y: M.ys[i] })), xRange: [M.xmin, M.xmax],
      segs: L ? [] : M.xs.map((x, i) => ({ x, y0: M.ys[i], y1: M.yh[i] })), title: (L ? 'Лагранж' : `МНК (m=${M.mm})`) + ', ' + DATASETS[o.set].pts.length + ' т.' };
    o.ch.draw(spec, autoView(spec));
  });
}

// ---------- керування ----------
function setSet(n) { S.set = n; S.anim = null; S.snap = false; document.querySelectorAll('[data-set]').forEach(b => b.classList.toggle('on', +b.dataset.set === n)); $('status').textContent = ''; updateInfo(); kick(); }
function setMode(m) { S.mode = m; S.anim = null; $('status').textContent = ''; document.querySelector(`input[name=mode][value=${m}]`).checked = true; kick(); }
function startAnim(type) {
  setGrid(false); const M = model(); setMode(type === 'interp' ? 'interp' : 'mnk');
  S.anim = { type, t0: performance.now(), step: Math.min(1100, 12000 / (M.n - 1)), T: 4500 }; S.view = null; S.rview = null; S.snap = true; kick();
}
function setGrid(on) { S.grid = on; $('single').hidden = on; $('grid').hidden = !on; $('gridBtn').classList.toggle('on', on); if (on) { S.anim = null; S.mouse = null; $('tip').style.display = 'none'; if (!gridCharts.length) buildGrid(); drawGrid(); } else { main.resize(); resC.resize(); S.snap = true; kick(); } }

window.addEventListener('DOMContentLoaded', () => {
  main = new Chart($('cv'), false); resC = new Chart($('rcv'), false);
  document.querySelectorAll('[data-set]').forEach(b => b.onclick = () => setSet(+b.dataset.set));
  document.querySelectorAll('input[name=mode]').forEach(r => r.onchange = () => setMode(r.value));
  $('mdeg').onchange = e => { S.m = +e.target.value; updateInfo(); S.grid ? drawGrid() : kick(); };
  $('aInterp').onclick = () => startAnim('interp'); $('aMnk').onclick = () => startAnim('mnk');
  $('aStop').onclick = () => { S.anim = null; kick(); };
  $('speed').oninput = e => { S.speed = +e.target.value; };
  $('gridBtn').onclick = () => setGrid(!S.grid);
  $('apply').onclick = () => {
    const p = LM.parsePoints($('pts').value), xs = new Set(p.map(q => q[0]));
    if (p.length < 2 || xs.size !== p.length) { $('status').textContent = 'Помилка: потрібно ≥2 точок з різними x.'; return; }
    DATASETS[S.set] = { title: `Користувацький набір (${p.length} точок)`, pts: p }; setSet(S.set); S.snap = true; S.grid && drawGrid();
  };
  $('reset').onclick = () => { DATASETS[S.set] = JSON.parse(JSON.stringify(DEFAULTS[S.set])); setSet(S.set); S.snap = true; S.grid && drawGrid(); };
  const cv = $('cv');
  cv.onmousemove = e => { const r = cv.getBoundingClientRect(); S.mouse = { mx: e.clientX - r.left, my: e.clientY - r.top }; kick(); };
  cv.onmouseleave = () => { S.mouse = null; kick(); };
  window.addEventListener('resize', () => { if (S.grid) { drawGrid(); return; } main.resize(); resC.resize(); S.snap = true; kick(); });
  updateInfo(); kick();
});
