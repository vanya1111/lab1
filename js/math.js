// Етапи 3-4. Обчислювальне ядро (без DOM): Лагранж + МНК через QR (Хаусхолдер)
(function (g) {
  // Інтерполяція Лагранжа: p(x)=Σ y_k L_k(x), L_k=Π (x-x_j)/(x_k-x_j)
  function lagrangeWeights(xs) {
    return xs.map((xk, k) => { let p = 1; xs.forEach((xj, j) => { if (j !== k) p *= xk - xj; }); return 1 / p; });
  }
  function lagrangeEval(xs, ys, x, w) {
    w = w || lagrangeWeights(xs);
    let s = 0;
    for (let k = 0; k < xs.length; k++) {
      let p = w[k];
      for (let j = 0; j < xs.length; j++) if (j !== k) p *= x - xs[j];
      s += ys[k] * p;
    }
    return s;
  }
  // МНК: дизайн-матриця + QR Хаусхолдера (нормальні рівняння НЕ використовуються)
  function designMatrix(ts, m) { return ts.map(t => Array.from({ length: m + 1 }, (_, j) => Math.pow(t, j))); }
  function qrSolve(A, b) {
    const n = A.length, p = A[0].length;
    A = A.map(r => r.slice()); b = b.slice();
    for (let k = 0; k < p; k++) {
      let nrm = 0; for (let i = k; i < n; i++) nrm += A[i][k] ** 2; nrm = Math.sqrt(nrm);
      if (nrm === 0) continue;
      const alpha = A[k][k] > 0 ? -nrm : nrm;
      const v = []; for (let i = k; i < n; i++) v.push(A[i][k]); v[0] -= alpha;
      const vv = v.reduce((s, a) => s + a * a, 0); if (vv === 0) continue;
      for (let j = k; j < p; j++) {
        let d = 0; for (let i = k; i < n; i++) d += v[i - k] * A[i][j];
        d = 2 * d / vv; for (let i = k; i < n; i++) A[i][j] -= d * v[i - k];
      }
      let d = 0; for (let i = k; i < n; i++) d += v[i - k] * b[i];
      d = 2 * d / vv; for (let i = k; i < n; i++) b[i] -= d * v[i - k];
    }
    const x = new Array(p).fill(0);
    for (let i = p - 1; i >= 0; i--) {
      let s = b[i]; for (let j = i + 1; j < p; j++) s -= A[i][j] * x[j];
      x[i] = s / A[i][i];
    }
    return x;
  }
  const horner = (c, t) => { let s = 0; for (let j = c.length - 1; j >= 0; j--) s = s * t + c[j]; return s; };

  // Нормалізація x -> t∈[-1,1] для числової стійкості
  function polyfit(xs, ys, m) {
    const a = Math.min(...xs), b = Math.max(...xs);
    const al = 2 / (b - a), be = -(a + b) / (b - a);
    const c = qrSolve(designMatrix(xs.map(x => al * x + be), m), ys);
    const mono = new Array(m + 1).fill(0); let pw = [1];     // коефіцієнти при x^j
    for (let j = 0; j <= m; j++) {
      pw.forEach((v, i) => mono[i] += c[j] * v);
      const nx = new Array(pw.length + 1).fill(0);
      pw.forEach((v, i) => { nx[i] += v * be; nx[i + 1] += v * al; }); pw = nx;
    }
    return { m, c, al, be, mono, evalT: (cc, x) => horner(cc, al * x + be), eval: x => horner(c, al * x + be) };
  }
  function metrics(ys, yh) {
    const n = ys.length, mean = ys.reduce((s, v) => s + v, 0) / n;
    const r = ys.map((y, i) => y - yh[i]);
    const sse = r.reduce((s, v) => s + v * v, 0), sst = ys.reduce((s, v) => s + (v - mean) ** 2, 0);
    return { r, sse, rmse: Math.sqrt(sse / n), r2: sst ? 1 - sse / sst : 1, maxAbs: Math.max(...r.map(Math.abs)), mean };
  }
  function parsePoints(text) {
    const re = /\(?\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\)?/g, out = []; let m;
    while ((m = re.exec(text))) out.push([+m[1].replace(',', '.'), +m[2].replace(',', '.')]);
    return out;
  }
  const api = { lagrangeWeights, lagrangeEval, designMatrix, qrSolve, polyfit, metrics, parsePoints, horner };
  if (typeof module !== 'undefined') module.exports = api; else g.LM = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
