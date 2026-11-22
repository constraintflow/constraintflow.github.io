// Ecosystem diagram: labelled arrows between the tool panels, and a detail card for the selected paper.
(() => {
  const eco = document.getElementById('eco');
  const svg = document.getElementById('eco-arrows');
  const card = document.getElementById('eco-card');
  const store = document.querySelector('#paper-store .pubs');
  if (!eco) return;
  const node = p => eco.querySelector(`.eco-node[data-paper="${p}"]`);

  // ---- Arrows, measured from the laid-out panels ----
  const EDGES = [
    { from: 'sail', to: 'constraintflow', label: 'propose\ncertifiers', kind: 'right' },
    { from: 'constraintflow', to: 'provesound', label: 'check\nsoundness', kind: 'right' },
    { from: 'provesound', to: 'sail', label: 'counterexamples', kind: 'over', dashed: true },
    { from: 'constraintflow', to: 'neuton', label: 'compile', kind: 'down' },
    { from: 'neuton', to: 'scepter', label: 'specialize', kind: 'right' },
  ];

  function drawArrows() {
    const box = eco.getBoundingClientRect();
    if (getComputedStyle(svg).display === 'none') return;
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const r = p => { const b = node(p).getBoundingClientRect(); return { l: b.left - box.left, r: b.right - box.left, t: b.top - box.top, b: b.bottom - box.top, cx: (b.left + b.right) / 2 - box.left, cy: (b.top + b.bottom) / 2 - box.top }; };
    const topRow = Math.min(...['sail', 'constraintflow', 'provesound'].map(p => r(p).t));
    let out = `<defs><marker id="eco-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="eco-head"/></marker></defs>`;
    EDGES.forEach(e => {
      const a = r(e.from), b = r(e.to);
      let d, lx, ly, anchor = 'middle';
      if (e.kind === 'right') {
        const y = Math.max(a.t, b.t) + (Math.min(a.b, b.b) - Math.max(a.t, b.t)) / 2;
        d = `M ${a.r + 6} ${y} H ${b.l - 6}`; lx = (a.r + b.l) / 2; ly = y - 8 - 14 * (e.label.split('\n').length - 1);
      } else if (e.kind === 'down') {
        const x1 = a.cx - (a.r - a.l) * 0.2, y1 = a.b + 6, x2 = b.cx, y2 = b.t - 6;
        d = `M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`;
        lx = (x1 + x2) / 2 + 10; ly = (y1 + y2) / 2 + 4; anchor = 'start';
      } else {                                   // 'over': a loop above the top row
        const y = topRow - 26;
        d = `M ${a.cx} ${a.t - 6} V ${y + 10} Q ${a.cx} ${y} ${a.cx - 10} ${y} H ${b.cx + 10} Q ${b.cx} ${y} ${b.cx} ${y + 10} V ${b.t - 6}`;
        lx = (a.cx + b.cx) / 2; ly = y - 7;
      }
      out += `<path d="${d}" class="eco-edge${e.dashed ? ' dashed' : ''}" marker-end="url(#eco-head)"/>`;
      out += `<text x="${lx}" y="${ly}" text-anchor="${anchor}" class="eco-label">` +
        e.label.split('\n').map((t, k) => `<tspan x="${lx}" dy="${k ? 14 : 0}">${t}</tspan>`).join('') + '</text>';
    });
    svg.innerHTML = out;
  }

  // ---- Detail card: the selected paper's entry, moved in from the hidden store ----
  let current = null;
  function select(paper, scroll) {
    const entry = document.getElementById(`paper-${paper}`);
    if (!entry) return;
    if (current && current !== entry) store.appendChild(current);
    card.replaceChildren(entry);
    placeCard(paper);
    current = entry;
    const abs = [...entry.querySelectorAll('.pub-links details')].find(d => d.textContent.trim() === 'Abstract');
    if (abs && !abs.open) abs.open = true;           // its toggle handler (site.js) reveals the abstract
    eco.querySelectorAll('.eco-node').forEach(n => n.classList.toggle('selected', n.dataset.paper === paper));
    if (scroll) document.getElementById('ecosystem').scrollIntoView({ behavior: 'smooth' });
  }

  // On narrow screens the diagram is a list, so the card opens right under the chosen panel.
  const narrow = matchMedia('(max-width: 900px)');
  function placeCard(paper) {
    if (narrow.matches) node(paper).after(card);
    else if (card.parentElement !== eco.parentElement) eco.after(card);
  }
  narrow.addEventListener('change', () => current && placeCard(current.id.slice('paper-'.length)));

  eco.querySelectorAll('.eco-node').forEach(n => n.addEventListener('click', () => select(n.dataset.paper)));
  // Links such as "paper" in the running example open the matching card.
  document.querySelectorAll('a[href^="#paper-"]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    select(a.getAttribute('href').slice('#paper-'.length), true);
  }));

  select('constraintflow');
  drawArrows();
  new ResizeObserver(drawArrows).observe(eco);
  if (document.fonts) document.fonts.ready.then(drawArrows);
})();
