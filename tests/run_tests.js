// Етап 5. Аналітичне тестування: node tests/run_tests.js
const fs = require('fs'), vm = require('vm'), LM = require('../js/math.js');
const D = vm.runInNewContext(fs.readFileSync(__dirname + '/../js/data.js', 'utf8') + ';DATASETS');
let fail = 0; const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) fail++; };

// T1: інтерполяція точна у вузлах
const rows = [];
for (const n of [5, 10, 20]) {
  const pts = D[n].pts, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), N = xs.length, w = LM.lagrangeWeights(xs);
  const lr = LM.metrics(ys, xs.map(x => LM.lagrangeEval(xs, ys, x, w)));
  ok(lr.maxAbs < 1e-9, `Лагранж у вузлах (${N} т.): max|r| = ${lr.maxAbs.toExponential(2)}`);
  for (const m of [2, 3, 4]) {
    const mm = Math.min(m, N - 1), f = LM.polyfit(xs, ys, mm), yh = xs.map(x => f.eval(x)), me = LM.metrics(ys, yh);
    // T2: умова ортогональності залишків до стовпців дизайн-матриці (AᵀR≈0) — ознака коректного МНК
    const A = LM.designMatrix(xs.map(x => f.al * x + f.be), mm);
    const orth = Math.max(...A[0].map((_, j) => Math.abs(A.reduce((s, r, i) => s + r[j] * me.r[i], 0))));
    ok(orth < 1e-9, `МНК N=${N}, m=${mm}: |Aᵀr| = ${orth.toExponential(1)}`);
    // Лагранж vs МНК між вузлами
    let md = 0; for (let i = 0; i <= 400; i++) { const x = xs[0] + (xs[N - 1] - xs[0]) * i / 400; md = Math.max(md, Math.abs(LM.lagrangeEval(xs, ys, x, w) - f.eval(x))); }
    rows.push({ N, m: mm, sse: me.sse, rmse: me.rmse, r2: me.r2, maxr: me.maxAbs, maxDiff: md });
  }
}
// T3: ідеальна парабола відтворюється точно (y = x²+x)
{ const xs = [0, 1, 2, 3, 4, 5], ys = xs.map(x => x * x + x), f = LM.polyfit(xs, ys, 2);
  ok(Math.abs(f.mono[0]) < 1e-10 && Math.abs(f.mono[1] - 1) < 1e-10 && Math.abs(f.mono[2] - 1) < 1e-10, 'МНК відновлює y=x²+x: ' + f.mono.map(v => v.toFixed(12)).join(', ')); }
// T4: при m=N-1 МНК збігається з інтерполяцією
{ const xs = D[5].pts.map(p => p[0]), ys = D[5].pts.map(p => p[1]), f = LM.polyfit(xs, ys, 4), w = LM.lagrangeWeights(xs);
  ok(Math.abs(f.eval(3.3) - LM.lagrangeEval(xs, ys, 3.3, w)) < 1e-9, 'МНК(m=4, 5 т.) = Лагранж'); }
// T5: стійкість QR vs нормальні рівняння на кондиційно поганій матриці (демонстрація вибору методу)
{ const xs = Array.from({ length: 20 }, (_, i) => 1000 + i * 0.1), ys = xs.map(x => 2 + 0.5 * (x - 1000) + 0.1 * (x - 1000) ** 2), f = LM.polyfit(xs, ys, 2);
  const res = Math.max(...xs.map((x, i) => Math.abs(f.eval(x) - ys[i]))); ok(res < 1e-8, `QR з нормалізацією x при x≈1000: max|r| = ${res.toExponential(1)}`); }
// T6: час обчислення (мс) для 1000 точок кривої
console.log('\nN\tm\tSSE\tRMSE\tR2\tmax|r|\tmax|L-МНК|');
rows.forEach(r => console.log([r.N, r.m, r.sse.toFixed(4), r.rmse.toFixed(4), r.r2.toFixed(5), r.maxr.toFixed(4), r.maxDiff.toFixed(3)].join('\t')));
console.log('\nЧас (мс) на 1000 обчислень кривої:');
const timing = [];
for (const n of [5, 8, 20, 50, 100]) {
  const xs = Array.from({ length: n }, (_, i) => i / 3), ys = xs.map(x => Math.sin(x)), w = LM.lagrangeWeights(xs), f = LM.polyfit(xs, ys, 3);
  let t0 = process.hrtime.bigint(); for (let i = 0; i < 1000; i++) LM.lagrangeEval(xs, ys, i / 300, w); const tl = Number(process.hrtime.bigint() - t0) / 1e6;
  t0 = process.hrtime.bigint(); for (let i = 0; i < 1000; i++) f.eval(i / 300); const tm = Number(process.hrtime.bigint() - t0) / 1e6;
  t0 = process.hrtime.bigint(); LM.polyfit(xs, ys, 3); const tf = Number(process.hrtime.bigint() - t0) / 1e6;
  timing.push({ n, tl, tm, tf }); console.log(`N=${n}\tLagrange ${tl.toFixed(2)}\tMNK-eval ${tm.toFixed(2)}\tQR-fit ${tf.toFixed(3)}`);
}
fs.writeFileSync(__dirname + '/results.json', JSON.stringify({ rows, timing }, null, 1));
console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED'); process.exit(fail ? 1 : 0);
