// Page behaviour: .cf syntax highlighting, copy buttons, and the paper abstract / BibTeX toggles.
(() => {
  // Minimal highlighter for ConstraintFlow code; also used by example.js.
  const KW = /\b(def|func|transformer|flow|as|forward|backward|curr|prev|true|false|In)\b/;
  const TY = /\b(Float|Int|Bool|Neuron|Noise|PolyExp|SymExp|Shape|Affine|Relu|Maxpool)\b/;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const re = new RegExp([KW.source, TY.source, /\b\d+(\.\d+)?\b/.source, /\b[a-z_][a-z0-9_]*(?=\()/.source].map(s => `(${s})`).join('|'), 'g');
  window.cfHighlight = text => esc(text).replace(re, (m, kw, _k, ty, _t, num, _n, fn) =>
    kw ? `<span class="tok-kw">${m}</span>` :
    ty ? `<span class="tok-ty">${m}</span>` :
    num ? `<span class="tok-num">${m}</span>` :
    `<span class="tok-fn">${m}</span>`);
  document.querySelectorAll('pre.code.cf').forEach(pre => { pre.innerHTML = cfHighlight(pre.textContent); });

  // Copy buttons copy the text of their target element.
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.preventDefault();
      const el = document.getElementById(btn.dataset.copy);
      const text = (el.dataset.text || el.textContent).trim();
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'Copied';
      } catch {
        const range = document.createRange();            // fall back to selecting the text
        range.selectNodeContents(el);
        getSelection().removeAllRanges(); getSelection().addRange(range);
        btn.textContent = 'Press Ctrl+C';
      }
      setTimeout(() => { btn.textContent = 'Copy'; }, 1600);
    });
  });

  // Abstract / BibTeX toggles show the matching panel under each paper.
  document.querySelectorAll('.pub').forEach(pub => pub.querySelectorAll('.pub-links details').forEach(d => {
    const panel = pub.querySelector(d.textContent.trim() === 'BibTeX' ? '[data-bibtex]' : '[data-abstract]');
    d.addEventListener('toggle', () => { panel.hidden = !d.open; });
  }));

})();
