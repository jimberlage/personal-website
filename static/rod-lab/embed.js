/* Resize the Rod Lab iframe to fit its content.
 * Same-origin only; if the frame is cross-origin, the CSS height stays. */
(function () {
  var frame = document.getElementById('rod-lab-frame');
  if (!frame) return;

  function fit() {
    var doc;
    try { doc = frame.contentDocument; } catch (err) { return; }
    var app = doc && doc.getElementById('app');
    if (!app) return;
    var h = Math.ceil(app.getBoundingClientRect().height);
    if (h > 0) frame.style.height = Math.max(560, h) + 'px';
  }

  function watch() {
    fit();
    try {
      var app = frame.contentDocument && frame.contentDocument.getElementById('app');
      if (app && window.ResizeObserver) new ResizeObserver(fit).observe(app);
    } catch (err) { /* cross-origin fallback: keep the CSS height */ }
  }

  frame.addEventListener('load', watch);
  window.addEventListener('resize', fit);
})();
