/* Rod Lab — the shared workspace: equation bar + block board.
 *
 * The board state is the source of truth; the equation bar is a view of it.
 * Typing in the bar re-parses on every keystroke and rebuilds the blocks when
 * the text is valid. While the bar has focus, board changes never rewrite it;
 * on blur it is normalized from the board.
 */
(function (RL) {
  'use strict';

  var E = RL.equation;
  var R = RL.rods;
  var CELL = R.CELL;
  var ROD_H = 66;            // badge + gap + bar
  var BAR_OFFSET = 28;       // bar top inside a rod element
  var SNAP = 14;             // px between ends that counts as touching
  var HOLD_MS = 450;         // press-and-hold before a split
  var MOVE_SLOP = 6;         // px of movement before a press becomes a drag
  var BIN = { w: 170, h: 158 }; // keep-out box for the unit-block bin
  var PART_NAMES = { 1: 'Whole', 2: 'Halves', 3: 'Thirds', 4: 'Quarters', 5: 'Fifths', 6: 'Sixths', 7: 'Sevenths', 8: 'Eighths', 9: 'Ninths', 10: 'Tenths' };

  var LOCK_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>';
  var UNDO_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"></path><path d="M4 9h11a5 5 0 0 1 0 10h-3"></path></svg>';
  var PLUS_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>';
  var GRIP_SVG = '<svg width="6" height="28" viewBox="0 0 6 28" aria-hidden="true"><circle cx="3" cy="4" r="2"></circle><circle cx="3" cy="14" r="2"></circle><circle cx="3" cy="24" r="2"></circle></svg>';

  var TEMPLATE =
    '<section class="eqbar" aria-label="Equation bar">' +
      '<label class="eyebrow" for="ws-eq">Equation</label>' +
      '<input id="ws-eq" class="eq-input" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-describedby="ws-eq-msg">' +
      '<span class="eq-equals" aria-hidden="true">=</span>' +
      '<output class="eq-result" for="ws-eq">' + LOCK_SVG + '<span class="eq-result-text"></span></output>' +
      '<p id="ws-eq-msg" class="eq-msg" aria-live="polite"></p>' +
    '</section>' +
    '<div class="ws-toolbar">' +
      '<div class="tb-left">' +
        '<button class="switch" type="button" aria-pressed="false" data-act="mult"><span class="switch-track"><span class="switch-knob"></span></span>Multiplication</button>' +
        '<span class="tb-hint"></span>' +
      '</div>' +
      '<div class="tb-right">' +
        '<button class="btn" type="button" data-act="undo">' + UNDO_SVG + 'Undo</button>' +
        '<button class="btn" type="button" data-act="clear">Clear</button>' +
      '</div>' +
    '</div>' +
    '<div class="mode-strip" hidden></div>' +
    '<section class="board" aria-label="Block workspace">' +
      '<div class="area area-pos">' +
        '<div class="bin">' +
          '<span class="eyebrow">Unit blocks</span>' +
          '<div class="bin-stack" aria-hidden="true" title="Drag a block out"><span></span><span></span><span></span></div>' +
          '<button class="btn btn-sm" type="button" data-act="add">' + PLUS_SVG + 'Add a block</button>' +
        '</div>' +
        '<div class="layer layer-pos"></div>' +
      '</div>' +
      '<div class="divider"><button class="divider-handle" type="button" aria-label="Resize the take-away area. Use the left and right arrow keys.">' + GRIP_SVG + '</button></div>' +
      '<div class="area area-neg">' +
        '<div class="side-head"><span class="side-sign" aria-hidden="true">−</span><span class="side-title">Take away</span></div>' +
        '<div class="side-drop"><div class="layer layer-neg"></div><p class="side-empty">Blocks dropped here count as negative.</p></div>' +
      '</div>' +
      '<div class="area area-rem" hidden>' +
        '<div class="side-head"><span class="side-sign side-sign-r" aria-hidden="true">R</span><span class="side-title">Remainder</span></div>' +
        '<div class="side-drop rem-drop"><div class="rem-units"></div><p class="side-empty rem-text"></p></div>' +
      '</div>' +
      '<div class="fraction-board" hidden>' +
        '<div class="fr-main"></div>' +
        '<aside class="fr-side">' +
          '<h3>Reading the bar</h3>' +
          '<p><b>/</b> is the same key as division: 3/4 means “cut into 4, take 3.” Right before × it reads as a fraction, so 3/4 × 8 means “3/4 of 8.”</p>' +
          '<p>Tap a part to pick it or put it back. The bar follows along.</p>' +
          '<p>The whole can be any rod from 1 to 10, so only cuts that make equal rods are offered.</p>' +
        '</aside>' +
      '</div>' +
    '</section>' +
    '<p class="ws-status" aria-live="polite"></p>' +
    '<div class="rod-menu" role="menu" hidden></div>' +
    '<div class="drag-layer" aria-hidden="true"></div>' +
    '<div class="drag-hint" hidden></div>' +
    '<div class="snap-ghost" hidden></div>';

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }
  function within(r, x, y) { return r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }

  function Workspace(root, opts) {
    opts = opts || {};
    this.root = root;
    this.opts = opts;
    this.settings = Object.assign({ showResult: true, allowMult: true, multOn: false, takeAway: true, allowDivision: false }, opts.settings || {});
    this.revealed = !!this.settings.showResult;
    this.onChange = opts.onChange || function () {};
    this.state = {
      mode: 'normal',
      mult: !!this.settings.multOn,
      groups: [],
      nextId: 1,
      negFrac: 0.26,
      divide: { dividend: 0, divisor: 5, made: 0 },
      fraction: { whole: 8, parts: 4, picked: [true, true, true, false] }
    };
    this.history = [];
    this.drag = null;
    this.typingSnapshot = false;
    this.lastError = null;
    this._build();
    this._render();
  }

  var P = Workspace.prototype;

  /* ---------- setup ---------- */

  P._build = function () {
    var self = this;
    var el = document.createElement('div');
    el.className = 'ws';
    el.innerHTML = TEMPLATE;
    this.root.appendChild(el);
    this.el = el;
    var q = function (s) { return el.querySelector(s); };
    this.$ = {
      eqbar: q('.eqbar'), tbLeft: q('.tb-left'),
      input: q('.eq-input'), result: q('.eq-result'), resultText: q('.eq-result-text'), msg: q('.eq-msg'),
      mult: q('[data-act="mult"]'), tbHint: q('.tb-hint'), strip: q('.mode-strip'),
      board: q('.board'), areaPos: q('.area-pos'), areaNeg: q('.area-neg'), areaRem: q('.area-rem'),
      bin: q('.bin'), binStack: q('.bin-stack'), layerPos: q('.layer-pos'), layerNeg: q('.layer-neg'),
      divider: q('.divider'), dividerHandle: q('.divider-handle'), negEmpty: q('.area-neg .side-empty'),
      remUnits: q('.rem-units'), remText: q('.rem-text'), fraction: q('.fraction-board'), frMain: q('.fr-main'),
      status: q('.ws-status'), menu: q('.rod-menu'), dragLayer: q('.drag-layer'), hint: q('.drag-hint'), ghost: q('.snap-ghost')
    };
    if (!this.settings.allowMult) this.$.mult.hidden = true;
    this._clearError();

    var $ = this.$;
    $.input.addEventListener('input', function () { self._onType(); });
    $.input.addEventListener('blur', function () { self.typingSnapshot = false; self._syncBar(true); });
    $.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); self._syncBar(true); }
    });

    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      var act = b.dataset.act;
      if (act === 'mult') self._commit(function (s) { s.mult = !s.mult; });
      else if (act === 'undo') self.undo();
      else if (act === 'clear') self.clear();
      else if (act === 'add') self._addUnit();
      else if (act === 'scoop') self._scoop();
      else if (act === 'divisor') self._commit(function (s) { s.divide.divisor = clamp(s.divide.divisor + Number(b.dataset.d), 1, 10); s.divide.made = 0; });
      else if (act === 'whole') self._setWhole(self.state.fraction.whole + Number(b.dataset.d));
      else if (act === 'parts') self._setParts(Number(b.dataset.n));
      else if (act === 'part') self._commit(function (s) { var i = Number(b.dataset.i); s.fraction.picked[i] = !s.fraction.picked[i]; });
      else if (act === 'menu-break') self._breakApart(Number(b.dataset.id));
      else if (act === 'menu-zone') self._toggleZone(Number(b.dataset.id));
      else if (act === 'menu-remove') self._remove(Number(b.dataset.id));
    });

    // Rods, bin and divisor rod start drags.
    el.addEventListener('pointerdown', function (e) { self._onPointerDown(e); });
    this._onMove = function (e) { self._onPointerMove(e); };
    this._onUp = function (e) { self._onPointerUp(e); };
    this._onDocDown = function (e) {
      if (!self.$.menu.hidden && !e.target.closest('.rod-menu') && !e.target.closest('.rod')) self._closeMenu();
    };
    this._onKey = function (e) {
      if (e.key === 'Escape') { self._closeMenu(); if (self.drag) self._cancelDrag(); }
      var inField = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
      if (!inField && (e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); self.undo(); }
    };
    this._onResize = function () { self._render(); };
    document.addEventListener('pointerdown', this._onDocDown, true);
    document.addEventListener('keydown', this._onKey);
    window.addEventListener('resize', this._onResize);

    // Keyboard on rods.
    el.addEventListener('keydown', function (e) {
      var rodEl = e.target.closest('.rod[data-id]');
      if (rodEl) self._onRodKey(e, Number(rodEl.dataset.id));
    });

    // Divider: drag or arrow keys.
    $.divider.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      self.drag = { kind: 'divider', pointerId: e.pointerId, before: deepCopy(self.state) };
      self.$.divider.classList.add('is-active');
      document.addEventListener('pointermove', self._onMove);
      document.addEventListener('pointerup', self._onUp);
      document.addEventListener('pointercancel', self._onUp);
    });
    $.dividerHandle.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowLeft' ? 0.04 : e.key === 'ArrowRight' ? -0.04 : 0;
      if (d) { e.preventDefault(); self._commit(function (s) { s.negFrac = clamp(s.negFrac + d, 0.16, 0.7); }); }
    });
  };

  P.destroy = function () {
    document.removeEventListener('pointerdown', this._onDocDown, true);
    document.removeEventListener('keydown', this._onKey);
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('pointermove', this._onMove);
    document.removeEventListener('pointerup', this._onUp);
    document.removeEventListener('pointercancel', this._onUp);
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
  };

  /* ---------- public API ---------- */

  P.setRevealed = function (v) { this.revealed = !!v; this._renderResult(); };

  P.getModel = function () {
    var s = this.state;
    var m = { mode: s.mode, text: this.format() };
    if (s.mode === 'normal') {
      m.groups = s.groups.map(function (g) { return { size: g.size, zone: g.zone }; });
      m.value = E.valueOfGroups(s.groups);
    } else if (s.mode === 'divide') {
      var d = s.divide;
      m.dividend = d.dividend; m.divisor = d.divisor;
      m.q = Math.floor(d.dividend / d.divisor); m.r = d.dividend % d.divisor;
      m.made = d.made;
    } else {
      var f = s.fraction;
      m.num = this._pickedCount(); m.den = f.parts; m.whole = f.whole;
      m.value = m.num * f.whole / f.parts;
    }
    return m;
  };

  P.format = function () {
    var s = this.state;
    if (s.mode === 'divide') return s.divide.dividend + ' ÷ ' + s.divide.divisor;
    if (s.mode === 'fraction') return this._pickedCount() + '/' + s.fraction.parts + ' × ' + s.fraction.whole;
    return E.formatGroups(s.groups, s.mult);
  };

  /* Load an equation as the starting point (no undo step). */
  P.setText = function (text) {
    this.$.input.value = text;
    this._onType();
    this._syncBar(true);
    this.history = [];
    this.typingSnapshot = false;
  };

  P.undo = function () {
    if (!this.history.length) return;
    this.state = this.history.pop();
    this._closeMenu();
    this._afterChange();
  };

  P.clear = function () {
    if (this.state.mode === 'divide') {
      this._commit(function (s) { s.divide.made = 0; });
      return;
    }
    this._commit(function (s) {
      s.mode = 'normal'; s.groups = [];
      s.divide = { dividend: 0, divisor: s.divide.divisor, made: 0 };
    });
    this._clearError();
    this.$.input.value = '';
  };

  /* ---------- state changes ---------- */

  P._snapshot = function () {
    this.history.push(deepCopy(this.state));
    if (this.history.length > 200) this.history.shift();
  };

  P._commit = function (fn) {
    this._snapshot();
    fn.call(this, this.state);
    this._afterChange();
  };

  P._afterChange = function () {
    this._render();
    this._syncBar(false);
    this.onChange(this.getModel());
  };

  P._newGroup = function (size, x, y, zone) {
    var g = { id: this.state.nextId++, size: size, x: x, y: y, zone: zone || 'pos' };
    this.state.groups.push(g);
    return g;
  };

  P._group = function (id) {
    for (var i = 0; i < this.state.groups.length; i++) if (this.state.groups[i].id === id) return this.state.groups[i];
    return null;
  };

  P._addUnit = function () {
    if (this.state.mode === 'divide') { this._commit(function (s) { s.divide.dividend = Math.min(E.MAX_BLOCKS, s.divide.dividend + 1); }); return; }
    if (this.state.mode !== 'normal') { this._commit(function (s) { s.mode = 'normal'; s.groups = []; }); }
    var self = this;
    var spot = this._freeSpot(1, 'pos');
    this._commit(function () { self._newGroup(1, spot.x, spot.y, 'pos'); });
  };

  P._remove = function (id) {
    this._closeMenu();
    this._commit(function (s) { s.groups = s.groups.filter(function (g) { return g.id !== id; }); });
  };

  P._toggleZone = function (id) {
    this._closeMenu();
    var self = this;
    var g = this._group(id);
    if (!g) return;
    var to = g.zone === 'neg' ? 'pos' : 'neg';
    var spot = this._freeSpot(g.size, to);
    this._commit(function () { var gg = self._group(id); gg.zone = to; gg.x = spot.x; gg.y = spot.y; });
  };

  P._breakApart = function (id) {
    this._closeMenu();
    var self = this;
    var g = this._group(id);
    if (!g || g.size < 2) return;
    var size = this._layerSize(g.zone);
    this._commit(function (s) {
      var gg = self._group(id);
      s.groups = s.groups.filter(function (x) { return x.id !== id; });
      var x = gg.x, y = gg.y;
      for (var i = 0; i < gg.size; i++) {
        if (x + R.rodWidth(1) > size.w) { x = gg.zone === 'pos' && y < BIN.h ? BIN.w + 14 : 12; y += ROD_H + 8; }
        self._newGroup(1, x, y + (i % 2 ? 8 : 0), gg.zone);
        x += CELL + 12;
      }
    });
  };

  P._scoop = function () {
    var d = this.state.divide;
    if (d.dividend - d.made * d.divisor < d.divisor) return;
    this._commit(function (s) { s.divide.made++; });
  };

  P._setWhole = function (w) {
    w = clamp(w, 1, 10);
    this._commit(function (s) {
      var f = s.fraction;
      f.whole = w;
      if (w % f.parts !== 0 || f.parts > w) {
        var best = 1;
        for (var k = 1; k <= Math.min(f.parts, w); k++) if (w % k === 0) best = k;
        f.parts = best;
      }
      f.picked = resizePicked(f.picked, f.parts);
    });
  };

  P._setParts = function (n) {
    this._commit(function (s) {
      var f = s.fraction;
      if (f.whole % n !== 0) return;
      var picked = f.picked.filter(Boolean).length;
      f.parts = n;
      f.picked = [];
      for (var i = 0; i < n; i++) f.picked.push(i < Math.min(picked, n));
    });
  };

  function resizePicked(picked, n) {
    var count = picked.filter(Boolean).length;
    var out = [];
    for (var i = 0; i < n; i++) out.push(i < Math.min(count, n));
    return out;
  }

  P._pickedCount = function () { return this.state.fraction.picked.filter(Boolean).length; };

  /* ---------- equation bar ---------- */

  P._onType = function () {
    var text = this.$.input.value;
    var res = E.read(text);
    if (!res.ok) { this._showError(text, res); return; }
    if (res.mode === 'divide' && !this.settings.allowDivision) {
      var at = text.search(/[\/÷]/);
      this._showError(text, { pos: at < 0 ? text.length : at, message: 'Division is only on division sheets. For a fraction, type 3/4 × 8.' });
      return;
    }
    if (res.mode === 'normal' && res.neg.length && !this.settings.takeAway) {
      this._showError(text, { pos: text.search(/[-−–]/), message: 'The take-away area is turned off for this sheet.' });
      return;
    }
    this._clearError();
    if (this._matches(res)) { this._renderResult(); return; }
    if (!this.typingSnapshot) { this._snapshot(); this.typingSnapshot = true; }
    this._apply(res);
    this._render();
    this.onChange(this.getModel());
  };

  P._matches = function (res) {
    var s = this.state;
    if (res.mode !== s.mode) return false;
    if (res.mode === 'divide') return res.dividend === s.divide.dividend && res.divisor === s.divide.divisor;
    if (res.mode === 'fraction') return res.whole === s.fraction.whole && res.den === s.fraction.parts && res.num === this._pickedCount();
    var key = function (arr) { return arr.slice().sort(function (a, b) { return a - b; }).join(','); };
    var pos = s.groups.filter(function (g) { return g.zone !== 'neg'; }).map(function (g) { return g.size; });
    var neg = s.groups.filter(function (g) { return g.zone === 'neg'; }).map(function (g) { return g.size; });
    return key(pos) === key(res.pos) && key(neg) === key(res.neg);
  };

  P._apply = function (res) {
    var s = this.state;
    s.mode = res.mode;
    if (res.mode === 'divide') {
      s.divide = { dividend: res.dividend, divisor: res.divisor, made: 0 };
    } else if (res.mode === 'fraction') {
      var picked = [];
      for (var i = 0; i < res.den; i++) picked.push(i < res.num);
      s.fraction = { whole: res.whole, parts: res.den, picked: picked };
    } else {
      s.groups = [];
      this._layoutZone(res.pos, 'pos');
      this._layoutZone(res.neg, 'neg');
    }
  };

  /* Place rods left to right, wrapping into rows, keeping clear of the bin. */
  P._layoutZone = function (sizes, zone) {
    var area = this._layerSize(zone);
    var gap = 26;
    var y = zone === 'pos' ? 34 : 14;
    var rowStart = function (yy) { return zone === 'pos' && yy < BIN.h ? BIN.w + 18 : 16; };
    var x = rowStart(y);
    for (var i = 0; i < sizes.length; i++) {
      var w = R.rodWidth(sizes[i]);
      if (x + w > area.w - 8 && x > rowStart(y)) { y += ROD_H + 12; x = rowStart(y); }
      this._newGroup(sizes[i], x, y, zone);
      x += w + gap;
    }
  };

  P._syncBar = function (force) {
    var focused = document.activeElement === this.$.input;
    if (force || !focused) {
      this.$.input.value = this.format();
      this._clearError();
    }
    this._renderResult();
  };

  P._showError = function (text, res) {
    var pos = res.pos >= 0 ? res.pos : text.length;
    this.lastError = res;
    this.$.input.setAttribute('aria-invalid', 'true');
    var msg = this.$.msg;
    msg.textContent = '';
    msg.className = 'eq-msg is-error';
    var echo = document.createElement('span');
    echo.className = 'eq-echo';
    echo.appendChild(document.createTextNode(text.slice(0, pos)));
    var bad = document.createElement('mark');
    bad.textContent = text.slice(pos, pos + 1) || ' ';
    echo.appendChild(bad);
    echo.appendChild(document.createTextNode(text.slice(pos + 1)));
    msg.appendChild(echo);
    msg.appendChild(document.createTextNode(' ' + res.message + ' The blocks stay as they were.'));
    this._renderResult();
  };

  P._clearError = function () {
    this.lastError = null;
    this.$.input.removeAttribute('aria-invalid');
    this.$.msg.className = 'eq-msg';
    this.$.msg.innerHTML = 'Type numbers, spaces and <b>+ − x</b> (or <b>/</b> for a fraction). Try <b>(2 × 3) + 5</b> or <b>3/4 x 8</b>.';
  };

  P._renderResult = function () {
    var s = this.state;
    var text, negative = false;
    if (s.mode === 'divide') {
      var q = Math.floor(s.divide.dividend / s.divide.divisor), r = s.divide.dividend % s.divide.divisor;
      text = r ? q + ' R ' + r : String(q);
    } else if (s.mode === 'fraction') {
      text = String(this._pickedCount() * s.fraction.whole / s.fraction.parts);
    } else {
      var v = E.valueOfGroups(s.groups);
      negative = v < 0;
      text = E.formatNumber(v);
    }
    var res = this.$.result;
    if (!this.revealed) {
      this.$.resultText.textContent = '?';
      res.setAttribute('aria-label', 'Result hidden until you check your answer');
      res.classList.remove('is-negative');
    } else {
      this.$.resultText.textContent = text;
      res.setAttribute('aria-label', 'Result, not editable: ' + text.replace('−', 'minus ').replace(' R ', ' remainder '));
      res.classList.toggle('is-negative', negative);
    }
  };

  /* ---------- rendering ---------- */

  P._layerSize = function (zone) {
    var layer = zone === 'neg' ? this.$.layerNeg : this.$.layerPos;
    var r = layer.getBoundingClientRect();
    return { w: r.width || 800, h: r.height || 480 };
  };

  P._render = function () {
    var s = this.state, $ = this.$;
    var normal = s.mode === 'normal', divide = s.mode === 'divide', fraction = s.mode === 'fraction';
    var showNeg = normal && this.settings.takeAway;

    $.mult.setAttribute('aria-pressed', String(s.mult));
    $.mult.hidden = !this.settings.allowMult || !normal;
    $.tbHint.textContent = !normal ? '' : s.mult
      ? 'On: groups of the same size count together, wherever they sit.'
      : 'Off: every group is its own term.';

    $.eqbar.hidden = divide;
    $.tbLeft.hidden = divide;
    $.areaPos.hidden = fraction;
    $.bin.hidden = divide || fraction;
    $.areaNeg.hidden = !showNeg;
    $.divider.hidden = !showNeg;
    $.areaRem.hidden = !divide;
    $.fraction.hidden = !fraction;
    $.board.classList.toggle('is-divide', divide);
    $.areaNeg.style.flexBasis = (s.negFrac * 100) + '%';

    this._renderStrip();
    $.layerPos.innerHTML = '';
    $.layerNeg.innerHTML = '';
    $.layerPos.classList.toggle('is-flow', divide);

    if (normal) this._renderGroups();
    else if (divide) this._renderDivide();
    else this._renderFraction();
    this._renderResult();
  };

  P._renderGroups = function () {
    var self = this, $ = this.$;
    var sizes = { pos: this._layerSize('pos'), neg: this._layerSize('neg') };
    var negCount = 0, negBlocks = 0, blocks = 0;
    var posRods = [];
    this.state.groups.forEach(function (g) {
      if (g.zone === 'neg' && !self.settings.takeAway) g.zone = 'pos';
      var sz = sizes[g.zone];
      var w = R.rodWidth(g.size);
      g.x = clamp(g.x, 0, Math.max(0, sz.w - w));
      g.y = clamp(g.y, 0, Math.max(0, sz.h - ROD_H));
      if (g.zone === 'pos' && g.x < BIN.w && g.y < BIN.h) g.x = BIN.w + 4;
      var el = R.makeRod(g.size, { label: g.zone === 'neg' ? '−' + g.size : String(g.size) });
      var label = g.size + '-rod' + (g.zone === 'neg' ? ' in the take-away area' : '');
      el.dataset.id = String(g.id);
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-haspopup', 'menu');
      el.setAttribute('aria-label', label + '. Arrow keys move it, Enter opens actions.');
      el.style.left = g.x + 'px';
      el.style.top = g.y + 'px';
      (g.zone === 'neg' ? $.layerNeg : $.layerPos).appendChild(el);
      if (g.zone === 'neg') { negCount++; negBlocks += g.size; }
      else posRods.push({ el: el, label: label });
      blocks += g.size;
    });

    /* Each block in the take-away area crosses out its counterpart in the
     * main area. Start with the rightmost cells so the untouched blocks stay
     * together on the left. */
    var remaining = negBlocks;
    posRods.forEach(function (r) {
      if (remaining <= 0) return;
      var cells = r.el.querySelectorAll('.cell');
      var count = Math.min(cells.length, remaining);
      for (var i = cells.length - count; i < cells.length; i++) {
        var x = document.createElement('span');
        x.className = 'cell-x';
        x.setAttribute('aria-hidden', 'true');
        x.textContent = '\u00D7';
        cells[i].classList.add('is-taken');
        cells[i].appendChild(x);
      }
      r.el.setAttribute('aria-label', r.label + ', ' + count + (count === 1 ? ' block' : ' blocks') +
        ' taken away. Arrow keys move it, Enter opens actions.');
      remaining -= count;
    });

    $.negEmpty.hidden = negCount > 0;
    var n = this.state.groups.length;
    $.status.textContent = n
      ? n + (n === 1 ? ' group · ' : ' groups · ') + blocks + (blocks === 1 ? ' block' : ' blocks') + '. Hold a block to split its rod; tap a rod for more.'
      : 'Drag a block out of the bin, or type an equation above.';
  };

  P._renderDivide = function () {
    var $ = this.$, d = this.state.divide;
    var loose = d.dividend - d.made * d.divisor;
    var leftover = loose < d.divisor;
    var wrap = document.createElement('div');
    wrap.className = 'div-flow';

    if (!leftover && loose > 0) {
      var pileBox = document.createElement('div');
      pileBox.className = 'div-pile';
      pileBox.innerHTML = '<span class="eyebrow">Loose blocks · ' + loose + '</span>';
      var pile = document.createElement('div');
      pile.className = 'pile-units';
      for (var i = 0; i < loose; i++) pile.appendChild(R.makeRod(1, { badge: false, className: 'unit' }));
      pileBox.appendChild(pile);
      wrap.appendChild(pileBox);
    }
    if (d.made) {
      var groups = document.createElement('div');
      groups.className = 'div-groups';
      for (var k = 0; k < d.made; k++) {
        var row = document.createElement('div');
        row.className = 'div-group';
        var lab = document.createElement('span');
        lab.className = 'div-label';
        lab.textContent = 'Group ' + (k + 1);
        row.appendChild(lab);
        row.appendChild(R.makeRod(d.divisor, { badge: false }));
        groups.appendChild(row);
      }
      wrap.appendChild(groups);
    }
    if (!d.dividend) {
      var empty = document.createElement('p');
      empty.className = 'div-empty';
      empty.textContent = 'Add blocks from the bin to divide them.';
      wrap.appendChild(empty);
    }
    $.layerPos.appendChild(wrap);

    $.remUnits.innerHTML = '';
    if (leftover) {
      for (var j = 0; j < loose; j++) $.remUnits.appendChild(R.makeRod(1, { badge: false, className: 'unit' }));
      if (!d.dividend) {
        $.remText.textContent = 'Blocks left after the groups are made show up here.';
      } else if (loose) {
        $.remText.innerHTML = '<b>' + loose + (loose === 1 ? ' block left.' : ' blocks left.') + '</b> Not enough to make another ' + d.divisor + ', so ' + (loose === 1 ? 'it stays' : 'they stay') + ' here.';
      } else {
        $.remText.innerHTML = '<b>Nothing left over.</b> ' + d.dividend + ' splits evenly into groups of ' + d.divisor + '.';
      }
    } else {
      $.remText.textContent = 'Blocks left after the groups are made show up here.';
    }
    $.status.textContent = d.made + (d.made === 1 ? ' group' : ' groups') + ' of ' + d.divisor + ' made from ' + d.dividend + ' blocks.' +
      (loose ? (leftover ? ' ' + loose + (loose === 1 ? ' block' : ' blocks') + ' left over.' : ' ' + loose + ' still loose.') : ' Nothing left over.');
  };

  P._renderFraction = function () {
    var f = this.state.fraction, $ = this.$;
    var size = f.whole / f.parts;
    var picked = this._pickedCount();
    var main = $.frMain;
    main.innerHTML = '';

    var avail = (main.getBoundingClientRect().width || 700) - 88 - 106 - 16;
    var cell = clamp(Math.floor(avail / f.whole), 18, 40);
    var wholeW = f.whole * cell + 4;
    var partCell = (wholeW / f.parts - 4) / size;
    var row1 = document.createElement('div');
    row1.className = 'fr-row';
    row1.innerHTML = '<span class="fr-label">Whole</span>';
    row1.appendChild(R.makeRod(f.whole, { cell: cell }));
    main.appendChild(row1);

    var row2 = document.createElement('div');
    row2.className = 'fr-row';
    row2.innerHTML = '<span class="fr-label">' + PART_NAMES[f.parts] + '</span>';
    var parts = document.createElement('div');
    parts.className = 'fr-parts';
    for (var i = 0; i < f.parts; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'fr-part' + (f.picked[i] ? ' is-picked' : '');
      b.dataset.act = 'part';
      b.dataset.i = String(i);
      b.setAttribute('aria-pressed', String(!!f.picked[i]));
      b.setAttribute('aria-label', 'Part ' + (i + 1) + ' of ' + f.parts + (f.picked[i] ? ', picked' : ', not picked'));
      b.appendChild(R.makeRod(size, { cell: partCell, badge: false }));
      var lab = document.createElement('span');
      lab.className = 'fr-part-label';
      lab.textContent = '1/' + f.parts;
      b.appendChild(lab);
      parts.appendChild(b);
    }
    row2.appendChild(parts);
    main.appendChild(row2);

    var sum = document.createElement('div');
    sum.className = 'fr-sum';
    sum.innerHTML = '<span class="fr-label"></span><span class="fr-total">' + picked + '/' + f.parts + ' of ' + f.whole + ' = ' + (picked * size) + '</span>';
    main.appendChild(sum);
    $.status.textContent = picked + ' of ' + f.parts + ' equal parts picked. Each part is a ' + size + '-rod.';
  };

  P._renderStrip = function () {
    var s = this.state, strip = this.$.strip;
    if (s.mode === 'normal') { strip.hidden = true; strip.innerHTML = ''; return; }
    strip.hidden = false;
    strip.innerHTML = '';
    if (s.mode === 'divide') {
      var d = s.divide;
      var loose = d.dividend - d.made * d.divisor;
      var limit = d.divisor === 1 ? 'no blocks are left' : 'fewer than ' + d.divisor + ' blocks are left';
      var hint = loose < d.divisor
        ? (loose ? loose + (loose === 1 ? ' block is' : ' blocks are') + ' left over.' : 'Nothing is left over.')
        : 'Press the button until ' + limit + '. You can also drag the ' + d.divisor + '-rod.';
      strip.innerHTML =
        '<span class="eyebrow">Divide by</span>' +
        '<div class="slot">' +
          '<button class="btn btn-icon" type="button" data-act="divisor" data-d="-1" aria-label="Smaller divisor"' + (d.divisor <= 1 ? ' disabled' : '') + '>−</button>' +
          '<span class="slot-rod" title="Drag onto the loose blocks"></span>' +
          '<span class="slot-text">÷ ' + d.divisor + '</span>' +
          '<button class="btn btn-icon" type="button" data-act="divisor" data-d="1" aria-label="Bigger divisor"' + (d.divisor >= 10 ? ' disabled' : '') + '>+</button>' +
        '</div>' +
        '<button class="btn btn-primary" type="button" data-act="scoop"' + (loose < d.divisor ? ' disabled' : '') + '>Make a group of ' + d.divisor + '</button>' +
        '<span class="strip-hint">' + hint + '</span>';
      var rod = R.makeRod(d.divisor, { cell: 16, badge: false, className: 'divisor-rod' });
      rod.dataset.divisor = '1';
      strip.querySelector('.slot-rod').appendChild(rod);
    } else {
      var f = s.fraction;
      var chips = '';
      for (var n = 1; n <= 10; n++) {
        var ok = n <= f.whole && f.whole % n === 0;
        chips += '<button type="button" class="chip' + (n === f.parts ? ' is-on' : '') + '" data-act="parts" data-n="' + n + '" aria-pressed="' + (n === f.parts) + '"' +
          (ok ? '' : ' disabled title="' + f.whole + ' can’t be cut into ' + n + ' equal rods"') + '>' + n + '</button>';
      }
      strip.innerHTML =
        '<span class="eyebrow">Whole</span>' +
        '<div class="slot">' +
          '<button class="btn btn-icon" type="button" data-act="whole" data-d="-1" aria-label="Smaller whole"' + (f.whole <= 1 ? ' disabled' : '') + '>−</button>' +
          '<span class="slot-text">' + f.whole + '</span>' +
          '<button class="btn btn-icon" type="button" data-act="whole" data-d="1" aria-label="Bigger whole"' + (f.whole >= 10 ? ' disabled' : '') + '>+</button>' +
        '</div>' +
        '<span class="eyebrow">Cut into</span>' +
        '<div class="chips" role="group" aria-label="Number of equal parts">' + chips + '</div>';
    }
  };

  /* ---------- menu ---------- */

  P._openMenu = function (id) {
    var g = this._group(id);
    var rodEl = this.el.querySelector('.rod[data-id="' + id + '"]');
    if (!g || !rodEl) return;
    var m = this.$.menu;
    var html = '';
    if (g.size > 1) html += '<button type="button" role="menuitem" data-act="menu-break" data-id="' + id + '">Break into 1s</button>';
    if (this.settings.takeAway) html += '<button type="button" role="menuitem" data-act="menu-zone" data-id="' + id + '">' + (g.zone === 'neg' ? 'Move to main area' : 'Move to take-away') + '</button>';
    html += '<button type="button" role="menuitem" data-act="menu-remove" data-id="' + id + '">Put back in the bin</button>';
    m.innerHTML = html;
    m.hidden = false;
    var r = rodEl.getBoundingClientRect();
    m.style.left = Math.round(r.left) + 'px';
    m.style.top = Math.round(r.bottom + 8) + 'px';
    this.el.querySelectorAll('.rod.is-selected').forEach(function (x) { x.classList.remove('is-selected'); });
    rodEl.classList.add('is-selected');
    this.menuFor = id;
    var first = m.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  };

  P._closeMenu = function () {
    this.$.menu.hidden = true;
    this.menuFor = null;
    this.el.querySelectorAll('.rod.is-selected').forEach(function (x) { x.classList.remove('is-selected'); });
  };

  /* ---------- keyboard on rods ---------- */

  P._onRodKey = function (e, id) {
    var g = this._group(id);
    if (!g) return;
    var step = e.shiftKey ? 8 : CELL;
    var dx = 0, dy = 0;
    if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;
    else if (e.key === 'ArrowUp') dy = -step;
    else if (e.key === 'ArrowDown') dy = step;
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._openMenu(id); return; }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this._remove(id); return; }
    else return;
    e.preventDefault();
    var self = this;
    this._commit(function () { var gg = self._group(id); gg.x += dx; gg.y += dy; });
    var el = this.el.querySelector('.rod[data-id="' + id + '"]');
    if (el) el.focus();
  };

  /* ---------- free spot ---------- */

  P._freeSpot = function (size, zone) {
    var area = this._layerSize(zone);
    var w = R.rodWidth(size);
    var others = this.state.groups.filter(function (g) { return g.zone === zone; });
    for (var y = zone === 'pos' ? 34 : 14; y + ROD_H <= area.h; y += ROD_H + 12) {
      for (var x = zone === 'pos' && y < BIN.h ? BIN.w + 18 : 16; x + w <= area.w; x += CELL + 10) {
        var hit = others.some(function (g) {
          return x < g.x + R.rodWidth(g.size) + 12 && x + w + 12 > g.x && y < g.y + ROD_H && y + ROD_H > g.y;
        });
        if (!hit) return { x: x, y: y };
      }
    }
    return { x: zone === 'pos' ? BIN.w + 18 : 16, y: 34 };
  };

  /* ---------- dragging ---------- */

  P._onPointerDown = function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    var t = e.target;
    var rodEl = t.closest('.rod[data-id]');
    var fromBin = t.closest('.bin-stack');
    var divisorRod = t.closest('.divisor-rod');
    if (!rodEl && !fromBin && !divisorRod) return;
    if (this.drag) return;
    e.preventDefault();
    var base = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, before: deepCopy(this.state) };

    if (rodEl && this.state.mode === 'normal') {
      var id = Number(rodEl.dataset.id);
      var g = this._group(id);
      var cellEl = t.closest('.cell');
      var self = this;
      this.drag = Object.assign(base, { kind: 'group', id: id, el: rodEl, cellIndex: cellEl ? Number(cellEl.dataset.i) : -1, holdReady: false });
      this._closeMenu();
      if (g && g.size > 1 && cellEl) {
        this.drag.holdTimer = setTimeout(function () {
          if (!self.drag || self.drag.moved) return;
          self.drag.holdReady = true;
          self._showCut(rodEl, self.drag.cellIndex);
          if (navigator.vibrate) { try { navigator.vibrate(15); } catch (_) { /* ignore */ } }
        }, HOLD_MS);
      }
    } else if (fromBin && this.state.mode !== 'fraction') {
      this.drag = Object.assign(base, { kind: 'new' });
    } else if (divisorRod) {
      this.drag = Object.assign(base, { kind: 'divisor' });
    } else {
      return;
    }
    document.addEventListener('pointermove', this._onMove);
    document.addEventListener('pointerup', this._onUp);
    document.addEventListener('pointercancel', this._onUp);
  };

  P._showCut = function (rodEl, k) {
    var seam = (k === 0 ? 1 : k) * CELL + 2;
    var cut = document.createElement('span');
    cut.className = 'cut-line';
    cut.style.left = seam + 'px';
    rodEl.appendChild(cut);
    rodEl.classList.add('split-ready');
    var cells = rodEl.querySelectorAll('.cell');
    var from = k === 0 ? 0 : k, to = k === 0 ? 1 : cells.length;
    for (var i = from; i < to; i++) cells[i].classList.add('is-lifting');
    this._showHint(rodEl.getBoundingClientRect(), 'Pull to split here', 'is-info');
  };

  P._onPointerMove = function (e) {
    var d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    if (d.kind === 'divider') {
      var br = this.$.board.getBoundingClientRect();
      var frac = clamp((br.right - e.clientX) / br.width, 0.16, 0.7);
      this.state.negFrac = frac;
      this.$.areaNeg.style.flexBasis = (frac * 100) + '%';
      return;
    }
    if (!d.moved) {
      if (Math.abs(e.clientX - d.startX) < MOVE_SLOP && Math.abs(e.clientY - d.startY) < MOVE_SLOP) return;
      d.moved = true;
      clearTimeout(d.holdTimer);
      this._hideHint();
      this._beginDrag(e);
    }
    if (!d.floatEl) return;
    d.floatEl.style.left = (e.clientX - d.offX) + 'px';
    d.floatEl.style.top = (e.clientY - d.offY) + 'px';
    this._updateTarget(e);
  };

  P._beginDrag = function (e) {
    var d = this.drag;
    var el;
    if (d.kind === 'group') {
      if (d.holdReady) this._split(d);
      el = this.el.querySelector('.rod[data-id="' + d.id + '"]');
      d.size = this._group(d.id).size;
    } else if (d.kind === 'new') {
      el = R.makeRod(1);
      d.size = 1;
      var stack = this.$.binStack.getBoundingClientRect();
      el.style.left = stack.left + 'px';
      el.style.top = (stack.top - BAR_OFFSET + 8) + 'px';
      this.$.dragLayer.appendChild(el);
    } else if (d.kind === 'divisor') {
      el = R.makeRod(this.state.divide.divisor, { badge: false });
      d.size = this.state.divide.divisor;
      el.style.left = (e.clientX - 20) + 'px';
      el.style.top = (e.clientY - 20) + 'px';
      this.$.dragLayer.appendChild(el);
    }
    if (!el) { this.drag = null; return; }
    var r = el.getBoundingClientRect();
    if (d.kind === 'new') { d.offX = CELL / 2; d.offY = BAR_OFFSET + CELL / 2; }
    else if (d.kind === 'divisor') { d.offX = 20; d.offY = 20; }
    else { d.offX = e.clientX - r.left; d.offY = e.clientY - r.top; }
    el.classList.add('is-dragging');
    el.style.left = (e.clientX - d.offX) + 'px';
    el.style.top = (e.clientY - d.offY) + 'px';
    if (el.parentNode !== this.$.dragLayer) this.$.dragLayer.appendChild(el);
    d.floatEl = el;
  };

  /* Split the held rod: the grabbed block and those after it come away
   * (holding the first block takes just that one). */
  P._split = function (d) {
    var g = this._group(d.id);
    var k = d.cellIndex;
    if (!g || g.size < 2) return;
    var piece;
    if (k <= 0) {
      piece = this._newGroup(1, g.x, g.y, g.zone);
      g.size -= 1; g.x += CELL;
    } else {
      piece = this._newGroup(g.size - k, g.x + k * CELL, g.y, g.zone);
      g.size = k;
    }
    d.splitFrom = g.id;
    d.id = piece.id;
    this._render();
  };

  P._zoneAt = function (x, y) {
    if (!this.$.bin.hidden && within(this.$.bin.getBoundingClientRect(), x, y)) return 'bin';
    if (!this.$.areaNeg.hidden && within(this.$.areaNeg.getBoundingClientRect(), x, y)) return 'neg';
    if (!this.$.areaPos.hidden && within(this.$.areaPos.getBoundingClientRect(), x, y)) return 'pos';
    return null;
  };

  /* Find a group whose end touches the dragged bar. */
  P._findSnap = function (zone) {
    var d = this.drag;
    var bar = d.floatEl.querySelector('.rod-bar').getBoundingClientRect();
    var layer = zone === 'neg' ? this.$.layerNeg : this.$.layerPos;
    var best = null;
    var self = this;
    layer.querySelectorAll('.rod[data-id]').forEach(function (el) {
      var id = Number(el.dataset.id);
      if (id === d.id) return;
      var tb = el.querySelector('.rod-bar').getBoundingClientRect();
      if (Math.abs(bar.top - tb.top) > CELL * 0.7) return;
      var right = bar.left - tb.right;   // dragged sits to the right of target
      var left = tb.left - bar.right;    // dragged sits to the left of target
      var cand = null;
      if (right > -CELL / 2 && right < SNAP) cand = { side: 'right', dist: Math.abs(right) };
      if (left > -CELL / 2 && left < SNAP && (!cand || Math.abs(left) < cand.dist)) cand = { side: 'left', dist: Math.abs(left) };
      if (cand && (!best || cand.dist < best.dist)) {
        cand.id = id; cand.el = el; cand.rect = tb; cand.size = self._group(id).size;
        best = cand;
      }
    });
    return best;
  };

  P._updateTarget = function (e) {
    var d = this.drag;
    this._clearTarget();
    if (d.kind === 'divisor') {
      var pile = this.el.querySelector('.div-pile');
      if (pile && within(pile.getBoundingClientRect(), e.clientX, e.clientY)) {
        pile.classList.add('is-hot');
        this._showHint(pile.getBoundingClientRect(), 'Drop to scoop up ' + d.size);
        d.target = 'pile';
      }
      return;
    }
    var zone = this._zoneAt(e.clientX, e.clientY);
    d.zone = zone;
    if (zone === 'bin') {
      if (this.state.mode !== 'normal') return;
      this.$.bin.classList.add('is-hot');
      this._showHint(this.$.bin.getBoundingClientRect(), 'Drop to put it back');
      return;
    }
    if (!zone || this.state.mode !== 'normal') return;
    var snap = this._findSnap(zone);
    if (!snap) return;
    var total = snap.size + d.size;
    if (total > E.MAX_ROD) {
      this._showHint(snap.el.getBoundingClientRect(), 'Too long: 10 is the most', 'is-warn');
      return;
    }
    d.snap = snap;
    snap.el.classList.add('snap-target');
    var g = this.$.ghost;
    var w = R.rodWidth(d.size);
    g.style.width = w + 'px';
    g.style.height = (CELL + 4) + 'px';
    g.style.top = snap.rect.top + 'px';
    g.style.left = (snap.side === 'right' ? snap.rect.right - 2 : snap.rect.left - w + 2) + 'px';
    g.hidden = false;
    this._showHint(snap.el.getBoundingClientRect(), 'Drop to make ' + total);
  };

  P._clearTarget = function () {
    var d = this.drag;
    if (d) { d.snap = null; d.target = null; }
    this.el.querySelectorAll('.snap-target').forEach(function (x) { x.classList.remove('snap-target'); });
    this.$.bin.classList.remove('is-hot');
    var pile = this.el.querySelector('.div-pile.is-hot');
    if (pile) pile.classList.remove('is-hot');
    this.$.ghost.hidden = true;
    this._hideHint();
  };

  P._showHint = function (rect, text, cls) {
    var h = this.$.hint;
    h.textContent = text;
    h.className = 'drag-hint' + (cls ? ' ' + cls : '');
    h.hidden = false;
    h.style.left = Math.round(rect.left) + 'px';
    h.style.top = Math.round(rect.top - 36) + 'px';
  };

  P._hideHint = function () { this.$.hint.hidden = true; };

  P._endListeners = function () {
    document.removeEventListener('pointermove', this._onMove);
    document.removeEventListener('pointerup', this._onUp);
    document.removeEventListener('pointercancel', this._onUp);
  };

  P._cancelDrag = function () {
    var d = this.drag;
    if (!d) return;
    clearTimeout(d.holdTimer);
    this._endListeners();
    this._clearTarget();
    this.state = d.before;
    this.drag = null;
    this.$.dragLayer.innerHTML = '';
    this._render();
  };

  P._onPointerUp = function (e) {
    var d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    clearTimeout(d.holdTimer);
    this._endListeners();

    if (d.kind === 'divider') {
      this.drag = null;
      this.$.divider.classList.remove('is-active');
      this.history.push(d.before);
      this._render();
      return;
    }

    if (!d.moved) {
      this.drag = null;
      this._hideHint();
      if (d.kind === 'group') {
        if (d.holdReady) { this._render(); return; }
        var id = d.id;
        if (this.menuFor === id) this._closeMenu(); else this._openMenu(id);
      } else if (d.kind === 'new') {
        this._addUnit();
      } else if (d.kind === 'divisor') {
        this._scoop();
      }
      return;
    }

    var snap = d.snap, target = d.target, zone = d.zone;
    var float = d.floatEl;
    var fr = float ? float.getBoundingClientRect() : null;
    this._clearTarget();
    this.$.dragLayer.innerHTML = '';
    this.drag = null;

    var changed = false;
    var s = this.state;

    if (d.kind === 'divisor') {
      if (target === 'pile' && s.divide.dividend - s.divide.made * s.divide.divisor >= s.divide.divisor) { s.divide.made++; changed = true; }
    } else if (s.mode === 'divide') {
      if (d.kind === 'new' && (zone === 'pos' || zone === 'neg')) { s.divide.dividend = Math.min(E.MAX_BLOCKS, s.divide.dividend + 1); changed = true; }
    } else {
      var g = d.kind === 'group' ? this._group(d.id) : null;
      if (zone === 'bin') {
        if (g) { s.groups = s.groups.filter(function (x) { return x.id !== g.id; }); changed = true; }
      } else if (zone === 'pos' || zone === 'neg') {
        if (!g) g = this._newGroup(d.size, 0, 0, zone);
        if (snap && this._group(snap.id)) {
          var t = this._group(snap.id);
          if (snap.side === 'left') t.x -= g.size * CELL;
          t.size += g.size;
          s.groups = s.groups.filter(function (x) { return x.id !== g.id; });
        } else {
          var layer = zone === 'neg' ? this.$.layerNeg : this.$.layerPos;
          var lr = layer.getBoundingClientRect();
          g.zone = zone;
          g.x = Math.round(fr.left - lr.left);
          g.y = Math.round(fr.top - lr.top);
        }
        changed = true;
      } else if (d.splitFrom) {
        changed = true; // a split piece dropped outside stays where it was split
      }
    }

    if (changed) {
      this.history.push(d.before);
      if (this.history.length > 200) this.history.shift();
    } else {
      this.state = d.before;
    }
    this._afterChange();
  };

  RL.Workspace = Workspace;
})(window.RL = window.RL || {});
