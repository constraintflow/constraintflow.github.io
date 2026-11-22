// Running example: pick a spec, perturb a real MNIST image with the eps slider, and reveal the
// recorded ProveSound / Neuton / Scepter results for that spec and eps (js/example-data.js).
(() => {
  const D = window.EXAMPLE;
  if (!D) return;
  const $ = id => document.getElementById(id);
  const fmt = (v, d = 2) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
  const DEVICES = D.devices || ['gpu'];
  const state = { spec: 0, eps: 0, done: {}, device: DEVICES[0] };
  const spec = () => D.specs[state.spec];
  const epsKey = () => String(D.eps[state.eps]);
  // Runs are recorded per device ({gpu: {eps: run}, cpu: ...}); older data has one device's {eps: run}.
  const byDevice = runs => (runs.gpu || runs.cpu ? runs[state.device] : runs);
  // Look runs up by numeric eps: the data may spell a stop "0.0" where JavaScript prints "0".
  const runOf = tool => { const r = byDevice(spec()[tool].runs); return r[Object.keys(r).find(k => +k === D.eps[state.eps])]; };

  // ---- Spec tabs and code ----
  const tabs = $('ex-tabs');
  D.specs.forEach((s, k) => {
    const b = document.createElement('button');
    b.className = 'ex-tab'; b.textContent = s.name; b.setAttribute('role', 'tab');
    b.addEventListener('click', () => { state.spec = k; state.done = {}; render(); });
    tabs.appendChild(b);
  });

  function renderSpec() {
    [...tabs.children].forEach((b, k) => b.classList.toggle('active', k === state.spec));
    $('ex-file').textContent = spec().file;
    const code = $('ex-code');
    code.dataset.text = spec().source;
    code.innerHTML = spec().source.replace(/\n$/, '').split('\n').map((line, k) =>
      `<span class="line${k === spec().diff_line ? ' diff' : ''}">${cfHighlight(line) || ' '}</span>`).join('');

  }

  // ---- Image: the real digit, with every pixel moved by +eps or -eps (fixed random signs) ----
  let seed = 11;
  // A fixed random change per pixel in [-1, 1], scaled by eps: one image from the allowed range.
  const signs = D.image.pixels.map(() => 2 * ((seed = (seed * 16807) % 2147483647) / 2147483647) - 1);
  const ctx = $('ex-image').getContext('2d');
  // The change is drawn MAGNIFY times stronger than eps so it is visible (the caption says so).
  const MAGNIFY = 10;
  function renderImage() {
    const e = D.eps[state.eps], img = ctx.createImageData(28, 28);
    D.image.pixels.forEach((p, i) => {
      const v = Math.round(255 * Math.min(1, Math.max(0, p + MAGNIFY * e * signs[i])));
      img.data.set([v, v, v, 255], 4 * i);
    });
    ctx.putImageData(img, 0, 0);
    $('ex-eps-val').textContent = e;
  }
  $('ex-network').textContent = `Network: ${D.network_desc}`;
  $('ex-image-desc').textContent = `Data: ${D.image.dataset}`;

  // GPU / CPU switch: changes the recorded times and memory (the bounds are the same).
  const devBox = $('ex-device');
  if (DEVICES.length > 1) DEVICES.forEach(d => {
    const b = document.createElement('button');
    b.textContent = d.toUpperCase(); b.setAttribute('role', 'radio');
    b.addEventListener('click', () => { state.device = d; renderDevice(); renderOutputs(); });
    devBox.appendChild(b);
  });
  function renderDevice() {
    [...devBox.children].forEach(b => {
      const on = b.textContent.toLowerCase() === state.device;
      b.classList.toggle('active', on); b.setAttribute('aria-checked', on);
    });
  }
  renderDevice();
  const slider = $('ex-eps');
  slider.max = D.eps.length - 1;
  const setEps = k => { state.eps = k; slider.value = k; renderImage(); renderOutputs(); renderTicks(); };
  slider.addEventListener('input', () => setEps(+slider.value));
  // One clickable label per recorded eps stop, under the slider.
  const ticks = $('ex-ticks');
  D.eps.forEach((e, k) => {
    const b = document.createElement('button');
    b.textContent = e; b.style.setProperty('--at', D.eps.length > 1 ? k / (D.eps.length - 1) : 0);
    b.addEventListener('click', () => setEps(k));
    ticks.appendChild(b);
  });
  function renderTicks() { [...ticks.children].forEach((b, k) => b.classList.toggle('active', k === state.eps)); }
  renderTicks();

  // ---- Steps ----
  const btn = step => document.querySelector(`.ex-btn[data-step="${step}"]`);
  const out = step => document.querySelector(`.ex-out[data-out="${step}"]`);
  const ORDER = ['verify', 'compile', 'specialize'];

  ORDER.forEach(step => btn(step).addEventListener('click', () => {
    const o = out(step);
    btn(step).disabled = true;
    o.hidden = false;
    o.innerHTML = '<div class="ex-running">running…</div>';
    setTimeout(() => { state.done[step] = true; render(); }, 650);   // results are recorded; the pause marks the step
  }));

  function enabled(step) {
    if (step === 'verify') return true;
    if (spec().provesound.sound === false) return false;  // an unsound certifier is not run
    return !!state.done[ORDER[ORDER.indexOf(step) - 1]];
  }

  function renderOutputs() {
    ORDER.forEach(step => {
      btn(step).disabled = !enabled(step) || !!state.done[step];
      btn(step).classList.toggle('done', !!state.done[step]);
      btn(step).title = step !== 'verify' && spec().provesound.sound === false ? 'ProveSound rejected this spec, so it is not compiled' : '';
      const o = out(step);
      o.hidden = !state.done[step];
      if (state.done[step]) o.innerHTML = { verify: verifyHTML, compile: compileHTML, specialize: specializeHTML }[step]();
    });
  }

  // Verify: per-transformer result; for an unsound spec, the ReLU counterexample plot.
  function verifyHTML() {
    const p = spec().provesound;
    if (p.sound === null) return `<p class="ex-note">${p.note}</p>`;   // not checked by ProveSound
    const items = p.transformers.map(([t, ok]) =>
      `<li class="${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'} ${t} ${ok ? 'proved sound' : 'is unsound'}</li>`).join('');
    let html = `<ul class="ex-proofs">${items}</ul>`;
    if (p.sound === false) html += reluPlot(p.counterexample) +
      `<p class="ex-note">The highlighted line halves the ReLU upper bound. ProveSound finds inputs where the true ReLU value lies above it, so the spec is rejected and not compiled.</p>`;
    return html;
  }

  function reluPlot(c) {
    const W = 360, H = 200, P = 28;
    const { l, u } = c, lam = u / (u - l);
    const X = z => P + (z - l) / (u - l) * (W - 2 * P), Y = y => H - P - y / u * (H - 2 * P);
    const zs = -0.5 * lam * l / (1 - 0.5 * lam);            // where ReLU crosses the buggy bound
    const pts = a => a.map(([z, y]) => `${X(z).toFixed(1)},${Y(y).toFixed(1)}`).join(' ');
    return `<svg class="ex-plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="ReLU with correct and buggy upper bounds">
      <polygon points="${pts([[zs, zs], [u, u], [u, 0.5 * u]])}" class="p-bad"/>
      <line x1="${X(l)}" y1="${Y(0)}" x2="${X(u)}" y2="${Y(0)}" class="p-axis"/>
      <line x1="${X(0)}" y1="${Y(0)}" x2="${X(0)}" y2="${P / 2}" class="p-axis"/>
      <polyline points="${pts([[l, 0], [0, 0], [u, u]])}" class="p-relu"/>
      <line x1="${X(l)}" y1="${Y(0)}" x2="${X(u)}" y2="${Y(u)}" class="p-correct"/>
      <line x1="${X(l)}" y1="${Y(0)}" x2="${X(u)}" y2="${Y(0.5 * u)}" class="p-buggy"/>
      <circle cx="${X(c.z)}" cy="${Y(c.relu)}" r="4" class="p-cex"/>
      <text x="${X(c.z) - 6}" y="${Y(c.relu) - 9}" text-anchor="end" class="p-label">counterexample z = ${c.z}</text>
      <text x="${X(l + 0.35 * (u - l)) - 4}" y="${Y(lam * 0.35 * (u - l)) - 8}" text-anchor="end" class="p-label">correct upper bound</text>
      <text x="${X(l + 0.55 * (u - l))}" y="${Y(0.5 * lam * 0.55 * (u - l)) + 16}" class="p-label p-label-bad">buggy upper bound</text>
      <text x="${X(l)}" y="${H - 8}" class="p-label">l = ${c.l}</text>
      <text x="${X(u)}" y="${H - 8}" text-anchor="end" class="p-label">u = ${c.u}</text>
      <text x="${X(0) + 4}" y="${P / 2 + 8}" class="p-label">ReLU(z)</text>
    </svg>`;
  }

  // Compile & run: Neuton's generated code, then the output bounds as one interval bar per class.
  // Bars use one scale per spec (across all eps), so moving the slider shows the bounds widening.
  function rangeOf(s) {
    let lo = Infinity, hi = -Infinity;
    Object.values(byDevice(s.neuton.runs)).forEach(r => { lo = Math.min(lo, ...r.lower); hi = Math.max(hi, ...r.upper); });
    return [Math.min(lo, 0), Math.max(hi, 0)];
  }

  // One bar per other class j: the bounds on y_label - y_j. Right of zero means j can never win.
  function bars(run) {
    const others = [...Array(10).keys()].filter(k => k !== D.image.label);
    const W = 420, rowH = 20, P = 58, H = 9 * rowH + 24, range = rangeOf(spec());
    const X = v => P + (v - range[0]) / (range[1] - range[0]) * (W - P - 8);
    let s = `<svg class="ex-bars" viewBox="0 0 ${W} ${H}" role="img" aria-label="Bounds on the margin of the true class over each other class">`;
    s += `<line x1="${X(0)}" y1="0" x2="${X(0)}" y2="${9 * rowH}" class="b-zero"/>`;
    others.forEach((j, k) => {
      const y = k * rowH + rowH / 2, ok = run.lower[k] >= 0;
      s += `<text x="${P - 8}" y="${y + 4}" text-anchor="end" class="b-label">y${D.image.label} − y${j}</text>`;
      s += `<line x1="${X(run.lower[k])}" y1="${y}" x2="${X(run.upper[k])}" y2="${y}" class="b-bar${ok ? ' b-ok' : ' b-no'}"/>`;
    });
    if (range[0] < 0) s += `<text x="${X(0)}" y="${H - 4}" text-anchor="middle" class="b-axis">0</text>`;
    s += `<text x="${X(range[0])}" y="${H - 4}" class="b-axis">${fmt(range[0], 1)}</text>`;
    s += `<text x="${X(range[1])}" y="${H - 4}" text-anchor="end" class="b-axis">${fmt(range[1], 1)}</text>`;
    return s + '</svg>';
  }

  const verdict = run => run.verified
    ? `<p class="ex-verdict ok">✓ Proved at ε = ${epsKey()}</p><p class="ex-why">Every image within ±${epsKey()} is classified as ${D.image.label}.</p>`
    : `<p class="ex-verdict bad">✗ Not proved at ε = ${epsKey()}</p><p class="ex-why">The certifier cannot rule out every other digit.</p>`;

  // Safety margin: the worst-case lead of the true digit's score over any other digit, i.e. the
  // smallest proved lower bound on (score of the true digit - score of j). Positive means proved.
  // The gauge spans the largest worst-case lead across all eps for this spec.
  function gaugeRange(s) {
    const m = Math.max(...Object.values(byDevice(s.neuton.runs)).map(r => Math.abs(Math.min(...r.lower))));
    return m || 1;
  }
  // The value sits just past the bar's end; near the gauge's edge it moves inside the bar so it never overflows.
  function valueLabel(lead, x, mid, half, ok) {
    const txt = `${lead >= 0 ? '+' : '−'}${Math.abs(lead).toFixed(2)}`, room = 56;
    const inside = ok ? x > mid + half - room : x < mid - half + room;
    const tx = inside ? (ok ? x - 6 : x + 6) : (ok ? x + 6 : x - 6);
    const anchor = (ok !== inside) ? 'start' : 'end';
    return `<text x="${tx}" y="28" text-anchor="${anchor}" class="g-val ${inside ? 'in' : ok ? 'ok' : 'no'}">${txt}</text>`;
  }

  function gauge(run) {
    const lead = Math.min(...run.lower), R = gaugeRange(spec());
    const W = 420, H = 58, mid = W / 2, half = W / 2 - 40;
    // Square-root scale so small leads near the crossover stay visible; the label shows the exact value.
    const x = mid + Math.sign(lead) * Math.sqrt(Math.abs(lead) / R) * half, ok = lead >= 0;
    return `<p class="gauge-q">Worst-case lead of the score of ${D.image.label} over any other digit</p>
      <svg class="gauge" viewBox="0 0 ${W} ${H}" role="img" aria-label="Worst-case lead ${lead.toFixed(2)}">
        <rect x="${mid - half}" y="16" width="${half}" height="14" class="g-half no"/>
        <rect x="${mid}" y="16" width="${half}" height="14" class="g-half ok"/>
        <rect x="${Math.min(mid, x)}" y="16" width="${Math.abs(x - mid)}" height="14" class="g-bar ${ok ? 'ok' : 'no'}"/>
        <line x1="${mid}" y1="8" x2="${mid}" y2="38" class="g-zero"/>
        <text x="${mid}" y="52" text-anchor="middle" class="g-tick">0</text>
        <text x="${mid - 8}" y="10" text-anchor="end" class="g-side no">not proved</text>
        <text x="${mid + 8}" y="10" class="g-side ok">proved</text>
        ${valueLabel(lead, x, mid, half, ok)}
      </svg>`;
  }

  function compileHTML() {
    const run = runOf('neuton');
    return `${gauge(run)}${verdict(run)}
      <details class="ex-gen"><summary>Details: bounds on the score gaps</summary>${bars(run)}</details>
      <p class="ex-stat">Neuton on ${state.device.toUpperCase()}: ${run.time_ms} ms${run.memory_mb != null ? `, ${run.memory_mb} MB peak memory` : ''}</p>`;
  }

  // Specialize: same bounds as Neuton, compared on time and memory.
  function specializeHTML() {
    const a = runOf('neuton'), b = runOf('scepter');
    const same = a.lower.every((v, k) => Math.abs(v - b.lower[k]) < 1e-3 && Math.abs(a.upper[k] - b.upper[k]) < 1e-3);
    const row = (name, v, max, unit) => `<div class="cmp-row"><span>${name}</span><span class="cmp-track"><span style="width:${Math.max(0.5, 100 * v / max).toFixed(1)}%"></span></span><span class="cmp-val">${v} ${unit}</span></div>`;
    const tm = Math.max(a.time_ms, b.time_ms), mm = Math.max(a.memory_mb, b.memory_mb);
    return `<p class="ex-verdict ${same ? 'ok' : 'bad'}">${same ? '✓ Same bounds as Neuton' : '✗ Bounds differ from Neuton'}</p>
      <div class="cmp"><div class="cmp-title">Time per run on ${state.device.toUpperCase()}: <b>${(a.time_ms / b.time_ms).toFixed(0)}× faster</b></div>
        ${row('Neuton', a.time_ms, tm, 'ms')}${row('Scepter', b.time_ms, tm, 'ms')}
        ${a.memory_mb != null && b.memory_mb != null ? `<div class="cmp-title">Peak memory</div>
        ${row('Neuton', a.memory_mb, mm, 'MB')}${row('Scepter', b.memory_mb, mm, 'MB')}` : ''}</div>`;
  }

  function render() {
    renderSpec();
    renderOutputs();
  }

  $('ex-placeholder').hidden = !D.placeholder;
  $('ex-recorded').textContent = D.placeholder ? '' :
    `Results recorded with the real tools on ${[D.recorded.gpu, D.recorded.cpu].filter(Boolean).join(' and ')}, ${D.recorded.date}.`;
  renderImage();
  render();
})();
