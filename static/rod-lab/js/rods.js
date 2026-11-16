/* Rod Lab — rod colors and rod elements. */
(function (RL) {
  'use strict';

  var CELL = 34;

  /* Rod colors by group size. `edge` outlines the rod; `line` separates its unit cells. */
  var PALETTE = {
    1: { fill: '#F4F1EA', edge: '#8A8578', line: 'rgba(0,0,0,0.42)' },
    2: { fill: '#D7393B', edge: '#E3E3E3', line: 'rgba(255,255,255,0.88)' },
    3: { fill: '#8BCB5A', edge: '#4D7E2C', line: 'rgba(0,0,0,0.42)' },
    4: { fill: '#8E5BB8', edge: '#E3E3E3', line: 'rgba(255,255,255,0.88)' },
    5: { fill: '#F2CC3A', edge: '#9C7E0F', line: 'rgba(0,0,0,0.42)' },
    6: { fill: '#2F7D4F', edge: '#E3E3E3', line: 'rgba(255,255,255,0.88)' },
    7: { fill: '#2B2B2E', edge: '#E3E3E3', line: 'rgba(255,255,255,0.88)' },
    8: { fill: '#8B5A2B', edge: '#E3E3E3', line: 'rgba(255,255,255,0.88)' },
    9: { fill: '#3A72C9', edge: '#E3E3E3', line: 'rgba(255,255,255,0.88)' },
    10: { fill: '#EE8A2A', edge: '#9A520E', line: 'rgba(0,0,0,0.42)' }
  };

  function colors(size) { return PALETTE[size] || PALETTE[10]; }

  /* A rod: optional number badge above a bar of `size` cells. */
  function makeRod(size, opts) {
    opts = opts || {};
    var cell = opts.cell || CELL;
    var c = colors(size);
    var el = document.createElement('div');
    el.className = 'rod' + (opts.className ? ' ' + opts.className : '');
    if (opts.badge !== false) {
      var badge = document.createElement('span');
      badge.className = 'rod-badge';
      badge.textContent = opts.label != null ? opts.label : String(size);
      el.appendChild(badge);
    }
    var bar = document.createElement('span');
    bar.className = 'rod-bar';
    bar.style.borderColor = c.edge;
    bar.style.setProperty('--cell-line', c.line);
    bar.style.setProperty('--cell-line-w', (cell >= 24 ? 2 : 1) + 'px');
    for (var i = 0; i < size; i++) {
      var s = document.createElement('span');
      s.className = 'cell';
      s.dataset.i = String(i);
      s.style.width = cell + 'px';
      s.style.height = cell + 'px';
      s.style.background = c.fill;
      bar.appendChild(s);
    }
    el.appendChild(bar);
    return el;
  }

  function rodWidth(size, cell) { return size * (cell || CELL) + 4; }

  RL.rods = { CELL: CELL, PALETTE: PALETTE, colors: colors, makeRod: makeRod, rodWidth: rodWidth };
})(window.RL = window.RL || {});
