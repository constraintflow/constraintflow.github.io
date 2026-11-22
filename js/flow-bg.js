// Background network: a real DeepPoly analysis whose bounds appear layer by layer as the page scrolls.
(() => {
  const canvas = document.getElementById('flow-bg');
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLOR = '90, 45, 94';             // --primary as rgb
  const GOLD = '168, 132, 47';            // --gold as rgb
  const FONT = '12px "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

  // Network: 3 inputs in [-1, 1], three ReLU layers, 2 affine outputs.
  // NET[i][j] is neuron j of layer i+1: weights w on neurons `preds` of the previous layer, bias b.
  // Every drawn edge is a nonzero weight.
  const SIZES = [3, 4, 4, 3, 2];
  const INPUT = [-1, 1];
  const NET = [
    [{ preds: [0], w: [0.5], b: 0 }, { preds: [0, 1], w: [-0.5, 1], b: 0 },
     { preds: [1, 2], w: [-0.5, -1], b: 0.5 }, { preds: [2], w: [1], b: 0.5 }],
    [{ preds: [0, 1], w: [-1, 1], b: -0.5 }, { preds: [0, 1, 2], w: [0.5, 1, 0.5], b: 0 },
     { preds: [1, 2, 3], w: [-1, -0.5, 1], b: -0.5 }, { preds: [2, 3], w: [-1, 0.5], b: -0.5 }],
    [{ preds: [0, 1], w: [-1, -1], b: 0.5 }, { preds: [1, 2], w: [0.5, 1], b: 0 },
     { preds: [2, 3], w: [1, -0.5], b: 0.5 }],
    [{ preds: [0, 1], w: [0.5, 1], b: 0.5 }, { preds: [1, 2], w: [1, -1], b: -0.5 }],
  ];

  // ---- DeepPoly ----------------------------------------------------------
  // Each symbol has linear lower/upper bounds over earlier symbols ({terms: Map(sym -> coef), c})
  // and concrete bounds [l, u]. Symbols are numbered in topological order.
  const syms = [];
  const newSym = (name, lo, up) => (syms.push({ name, lo, up, l: 0, u: 0 }), syms.length - 1);

  // Bound an expression by back-substituting to the inputs, then concretizing.
  function backsub(terms, c, lower) {
    terms = new Map(terms);
    for (;;) {
      let s = -1;
      terms.forEach((_, k) => { if (syms[k].lo && k > s) s = k; });
      if (s < 0) break;
      const a = terms.get(s); terms.delete(s);
      const e = (a > 0) === lower ? syms[s].lo : syms[s].up;
      c += a * e.c;
      e.terms.forEach((v, k) => terms.set(k, (terms.get(k) || 0) + a * v));
    }
    terms.forEach((a, k) => { c += a * ((a > 0) === lower ? syms[k].l : syms[k].u); });
    return c;
  }
  function bound(s) {
    const { lo, up } = syms[s];
    syms[s].l = backsub(lo.terms, lo.c, true);
    syms[s].u = backsub(up.terms, up.c, false);
  }

  // Display helpers; lower ends round down and upper ends round up, so printed bounds stay sound.
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const sub = k => String(k).split('').map(d => SUB[d]).join('');
  const fmt = v => { const s = String(Math.round(Math.abs(v) * 100) / 100); return (v < 0 && s !== '0' ? '−' : '') + s; };
  const down = v => fmt(Math.floor(v * 100 + 1e-9) / 100);
  const upr = v => fmt(Math.ceil(v * 100 - 1e-9) / 100);
  const affine = (names, w, b) => names.map((n, k) => {
    const a = Math.abs(w[k]), sign = w[k] < 0 ? (k ? ' − ' : '−') : (k ? ' + ' : '');
    return sign + (a === 1 ? '' : fmt(a) + '·') + n;
  }).join('') + (b ? (b < 0 ? ' − ' : ' + ') + fmt(Math.abs(b)) : '');

  // Layout: evenly spaced, mirror-symmetric, in unit coordinates; scaled on resize.
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  // The outputs sit out in the margins so the certified property stays visible.
  const layers = SIZES.map((n, i) => Array.from({ length: n }, (_, j) => ({
    ux: i === SIZES.length - 1 ? 0.1 + 0.8 * j / (n - 1) : (j + 0.5) / n,
    uy: 0.12 + 0.72 * i / (SIZES.length - 1), x: 0, y: 0,
  })));
  const edges = [];
  const last = SIZES.length - 1;
  let id = 0;
  layers[0].forEach(n => {
    n.sym = newSym('x' + sub(++id), null, null);
    syms[n.sym].l = INPUT[0]; syms[n.sym].u = INPUT[1];
    n.lines = [`${syms[n.sym].name} ∈ [${fmt(INPUT[0])}, ${fmt(INPUT[1])}]`];
  });
  NET.forEach((layer, li) => layer.forEach((p, j) => {
    const i = li + 1, n = layers[i][j];
    p.preds.forEach(k => edges.push({ a: layers[i - 1][k], b: n, layer: li, phase: rand() }));
    const idx = i === last ? j + 1 : ++id;
    const zName = i === last ? 'y' + sub(idx) : 'z' + sub(idx);
    const e = { terms: new Map(p.preds.map((k, t) => [layers[i - 1][k].sym, p.w[t]])), c: p.b };
    const z = newSym(zName, e, e);
    bound(z);
    const { l, u } = syms[z];
    const def = `${zName} = ${affine(p.preds.map(k => syms[layers[i - 1][k].sym].name), p.w, p.b)}`;
    const range = `∈ [${down(l)}, ${upr(u)}]`;
    if (i === last) { n.lines = [def, `${zName} ${range}`]; n.sym = z; return; }
    n.lines = [def, `${zName} ${range}`];
    // ReLU x = max(0, z): DeepPoly relaxation, as in deeppoly.cf (lower bound z when l + u >= 0).
    const xName = 'x' + sub(idx), one = new Map([[z, 1]]), zero = { terms: new Map(), c: 0 };
    let lo, up, line;
    if (u <= 0) { lo = up = zero; line = `${xName} = 0`; }
    else if (l >= 0) { lo = up = { terms: one, c: 0 }; line = `${xName} = ${zName}`; }
    else {
      const lam = u / (u - l);
      up = { terms: new Map([[z, lam]]), c: -lam * l };
      lo = u >= -l ? { terms: one, c: 0 } : zero;
      line = `${u >= -l ? zName : '0'} ≤ ${xName} ≤ ${upr(lam)}·(${zName} + ${upr(-l)})`;
    }
    n.sym = newSym(xName, lo, up);
    bound(n.sym);
    syms[n.sym].l = Math.max(0, syms[n.sym].l);   // a ReLU output is never negative
    n.lines.push(line);
  }));
  // Property: y1 > y2, checked by back-substituting y1 - y2 itself.
  const [y1, y2] = layers[last];
  const margin = backsub(new Map([[y1.sym, 1], [y2.sym, -1]]), 0, true);
  y1.lines.push(`${syms[y1.sym].name} − ${syms[y2.sym].name} ≥ ${down(margin)} ${margin > 0 ? '> 0 ✓' : '✗'}`);

  // ---- Drawing -----------------------------------------------------------
  let w = 0, h = 0;
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = FONT;
    const main = document.querySelector('main').getBoundingClientRect();
    layers.flat().forEach(n => {
      n.x = n.ux * w; n.y = n.uy * h;
      const half = Math.max(...n.lines.map(l => ctx.measureText(l).width)) / 2;
      let x = n.x;
      // Labels of margin neurons stay clear of the content column when there is room.
      if (n.x < main.left) x = Math.min(x, main.left - 8 - half);
      if (n.x > main.right) x = Math.max(x, main.right + 8 + half);
      n.labelX = Math.min(Math.max(x, 4 + half), w - 4 - half);   // and always on screen
    });
  }

  // Front position in layers: 0 = input reached, last = output reached.
  const target = () => {
    const max = document.documentElement.scrollHeight - h;
    const p = max > 1 ? window.scrollY / max : 1;
    return Math.min(1, p) * last;
  };
  let front = 0;
  // Edges into layer i finish drawing at front = i; the layer fades in over the last
  // ARRIVE of that, so its bounds appear exactly as the flow reaches the neurons.
  const ARRIVE = 0.15;
  const litAt = i => Math.max(0, Math.min(1, 1 + (front - i) / ARRIVE));

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    const r = Math.max(3, Math.min(w, h) * 0.006);

    edges.forEach(e => {
      const lit = Math.max(0, Math.min(1, front - e.layer));
      ctx.strokeStyle = `rgba(${COLOR}, 0.08)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke();
      if (lit <= 0) return;
      ctx.strokeStyle = `rgba(${COLOR}, 0.28)`;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y);
      ctx.lineTo(e.a.x + (e.b.x - e.a.x) * lit, e.a.y + (e.b.y - e.a.y) * lit); ctx.stroke();
      if (!reduceMotion) {                  // dot travelling along the lit part of the edge
        const s = ((t / 2600 + e.phase) % 1) * lit;
        ctx.fillStyle = `rgba(${COLOR}, 0.45)`;
        ctx.beginPath();
        ctx.arc(e.a.x + (e.b.x - e.a.x) * s, e.a.y + (e.b.y - e.a.y) * s, 1.8, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    layers.forEach((layer, i) => layer.forEach(n => {
      // Nodes turn gold once the flow reaches them.
      const lit = litAt(i);
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(${COLOR}, ${0.10 * (1 - lit)})`; ctx.fill();
      ctx.fillStyle = `rgba(${GOLD}, ${0.55 * lit})`; ctx.fill();
    }));

    // Bounds under each reached neuron, with a white halo so edges don't cut through them.
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    layers.forEach((layer, i) => {
      const lit = litAt(i);
      if (lit <= 0) return;
      layer.forEach(n => n.lines.forEach((l, k) => {
        const y = n.y + r * 2 + 4 + k * 15;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * lit})`;
        ctx.lineWidth = 4;
        ctx.strokeText(l, n.labelX, y);
        ctx.fillStyle = `rgba(${COLOR}, ${0.8 * lit})`;
        ctx.fillText(l, n.labelX, y);
      }));
    });
  }

  function frame(t) {
    front += (target() - front) * (reduceMotion ? 1 : 0.08);
    draw(t);
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  resize();
  if (document.fonts) document.fonts.ready.then(resize);   // re-measure labels once the web font loads
  requestAnimationFrame(frame);
})();
