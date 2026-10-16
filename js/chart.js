// Етап 4. Полотно: осі, сітка, легенда, криві, залишки, маркери
function niceTicks(min, max, n) {
  const raw = (max - min) / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), nr = raw / mag;
  const step = (nr < 1.5 ? 1 : nr < 3 ? 2 : nr < 7 ? 5 : 10) * mag, t = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) t.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return { t, step };
}
const fmtT = (v, step) => v.toFixed(Math.max(0, -Math.floor(Math.log10(step) + 1e-9)));

// Автоматичне масштабування: min/max беруться з усіх елементів, що реально малюються
function autoView(spec, padY = 0.08) {
  let ys = [];
  spec.curves.forEach(c => c.pts.forEach(p => ys.push(p[1])));
  spec.points.forEach(p => ys.push(p.y));
  (spec.segs || []).forEach(s => ys.push(s.y0, s.y1));
  if (spec.includeZero) ys.push(0);
  ys = ys.filter(Number.isFinite);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (!isFinite(lo)) { lo = -1; hi = 1; }
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const xs = spec.xRange, dx = (xs[1] - xs[0]) * 0.04 || 1;
  return { xmin: xs[0] - dx, xmax: xs[1] + dx, ymin: lo - (hi - lo) * padY, ymax: hi + (hi - lo) * padY };
}

class Chart {
  constructor(cv, compact) { this.cv = cv; this.ctx = cv.getContext('2d'); this.compact = !!compact; this.resize(); }
  resize() {
    const r = this.cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    this.W = r.width; this.H = r.height; this.cv.width = r.width * d; this.cv.height = r.height * d;
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  draw(s, v) {
    const c = this.ctx, W = this.W, H = this.H, k = this.compact;
    const m = this.m = { l: k ? 40 : 56, r: 14, t: k ? 24 : (s.legend ? 46 : s.title ? 26 : 14), b: k ? 26 : 40 };
    this.v = v;
    this.px = x => m.l + (x - v.xmin) / (v.xmax - v.xmin) * (W - m.l - m.r);
    this.py = y => H - m.b - (y - v.ymin) / (v.ymax - v.ymin) * (H - m.t - m.b);
    c.clearRect(0, 0, W, H); c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
    c.font = (k ? 10 : 12) + 'px system-ui,sans-serif';
    const X = niceTicks(v.xmin, v.xmax, k ? 4 : 9), Y = niceTicks(v.ymin, v.ymax, k ? 4 : 7);
    c.lineWidth = 1; c.strokeStyle = '#e3e6ea'; c.fillStyle = '#555';
    c.textAlign = 'center'; c.textBaseline = 'top';
    X.t.forEach(t => { const x = this.px(t); c.beginPath(); c.moveTo(x, m.t); c.lineTo(x, H - m.b); c.stroke(); c.fillText(fmtT(t, X.step), x, H - m.b + 5); });
    c.textAlign = 'right'; c.textBaseline = 'middle';
    Y.t.forEach(t => { const y = this.py(t); c.beginPath(); c.moveTo(m.l, y); c.lineTo(W - m.r, y); c.stroke(); c.fillText(fmtT(t, Y.step), m.l - 6, y); });
    c.strokeStyle = '#333'; c.strokeRect(m.l, m.t, W - m.l - m.r, H - m.t - m.b);
    if (!k) {
      c.fillStyle = '#222'; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText('x', (m.l + W - m.r) / 2, H - 2);
      c.save(); c.translate(13, (m.t + H - m.b) / 2); c.rotate(-Math.PI / 2); c.textBaseline = 'top'; c.fillText(s.ylabel || 'y', 0, 0); c.restore();
    }
    c.save(); c.beginPath(); c.rect(m.l, m.t, W - m.l - m.r, H - m.t - m.b); c.clip();
    if (v.ymin < 0 && v.ymax > 0) {
      const y0 = this.py(0); c.strokeStyle = '#111'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(m.l, y0); c.lineTo(W - m.r, y0); c.stroke();
      if (s.zeroLabel) { c.fillStyle = '#111'; c.textAlign = 'left'; c.textBaseline = 'bottom'; c.fillText(s.zeroLabel, m.l + 6, y0 - 3); }
    }
    (s.segs || []).forEach(g => { c.strokeStyle = g.color || '#2ca02c'; c.lineWidth = s.segWidth || 2; c.beginPath(); c.moveTo(this.px(g.x), this.py(g.y0)); c.lineTo(this.px(g.x), this.py(g.y1)); c.stroke(); });
    s.curves.forEach(cu => {
      c.strokeStyle = cu.color; c.lineWidth = k ? 1.8 : 2.4; c.beginPath();
      cu.pts.forEach((p, i) => { const a = this.px(p[0]), b = this.py(p[1]); i ? c.lineTo(a, b) : c.moveTo(a, b); });
      c.stroke();
    });
    s.points.forEach(p => {
      const x = this.px(p.x), y = this.py(p.y);
      c.beginPath(); c.arc(x, y, (p.active ? 8 : k ? 3.5 : 5) * (p.scale || 1), 0, 7);
      c.fillStyle = p.active ? '#ff7f0e' : (p.color || '#111'); c.fill();
      c.lineWidth = 1.5; c.strokeStyle = '#fff'; c.stroke();
      if (p.active) { c.beginPath(); c.arc(x, y, 12, 0, 7); c.strokeStyle = '#ff7f0e'; c.lineWidth = 2; c.stroke(); }
    });
    if (s.guideX != null) { c.setLineDash([4, 4]); c.strokeStyle = '#888'; c.lineWidth = 1; c.beginPath(); c.moveTo(this.px(s.guideX), m.t); c.lineTo(this.px(s.guideX), H - m.b); c.stroke(); c.setLineDash([]); }
    c.restore();
    if (s.title) { c.fillStyle = '#111'; c.font = 'bold ' + (k ? 11 : 13) + 'px system-ui,sans-serif'; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(s.title, m.l + 4, 4); }
    if (s.note) { c.fillStyle = '#444'; c.font = '13px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s.note, (m.l + W - m.r) / 2, m.t + 22); }
    if (s.legend && !k) {                                    // легенда в окремому рядку над полем
      c.font = '12px system-ui,sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
      let x = m.l + 4; const y = 32;
      s.legend.forEach(l => {
        c.strokeStyle = c.fillStyle = l.color; c.lineWidth = 2.4;
        if (l.dot) { c.beginPath(); c.arc(x + 7, y, 4.5, 0, 7); c.fill(); } else { c.beginPath(); c.moveTo(x, y); c.lineTo(x + 18, y); c.stroke(); }
        c.fillStyle = '#222'; c.fillText(l.text, x + 24, y); x += 24 + c.measureText(l.text).width + 14;
      });
    }
  }
}
