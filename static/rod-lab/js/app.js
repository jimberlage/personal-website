/* Rod Lab — pages and routing.
 *   #/                    worksheet library
 *   #/sheet/<id>          one worksheet (up to 6 questions)
 *   #/sheet/<id>/q/<n>    a question in the workspace
 *   #/play                free play workspace
 */
(function (RL) {
  'use strict';

  var W = RL.worksheets, S = RL.store, R = RL.rods, E = RL.equation;
  var app = document.getElementById('app');
  var current = null; // active Workspace, destroyed on navigation

  var LOGO = '<svg width="34" height="26" viewBox="0 0 34 26" aria-hidden="true"><rect x="1" y="1" width="10" height="24" rx="3" fill="#D7393B"></rect><rect x="12" y="7" width="10" height="18" rx="3" fill="#F2CC3A"></rect><rect x="23" y="13" width="10" height="12" rx="3" fill="#3A72C9"></rect></svg>';
  var CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"></path></svg>';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  function header(page, right) {
    return '<header class="topbar">' +
      '<div class="topbar-left">' +
        '<a class="brand" href="#/">' + LOGO + '<span>Rod Lab</span></a>' +
        '<nav aria-label="Main" class="nav">' +
          '<a href="#/"' + (page === 'sheets' ? ' aria-current="page"' : '') + '>Worksheets</a>' +
          '<a href="#/play"' + (page === 'play' ? ' aria-current="page"' : '') + '>Workspace</a>' +
        '</nav>' +
      '</div>' +
      '<div class="topbar-right">' + (right || '') +
        '<a class="license" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="license noopener" title="Creative Commons Attribution 4.0 International">CC BY 4.0</a>' +
      '</div>' +
    '</header>';
  }

  function teardown() {
    if (current) { current.destroy(); current = null; }
  }

  function isUnlocked(st) {
    if (!st.unlock || S.get('unlockAll')) return true;
    var need = W.strand(st.unlock.strand).sheets[st.unlock.sheet - 1];
    return S.doneCount(need.id) >= need.questions.length;
  }

  function sheetState(sh) {
    var done = S.doneCount(sh.id);
    if (done >= sh.questions.length) return 'done';
    if (done > 0 || S.get('lastSheet') === sh.id) return 'current';
    return 'new';
  }

  /* ---------- library ---------- */

  function renderLibrary() {
    var last = S.get('lastSheet') && W.sheet(S.get('lastSheet'));
    var html = header('sheets', '') + '<main class="page page-library">' +
      '<div class="lib-top">' +
        '<div class="lib-intro"><h1>Worksheets</h1><p>Each sheet has up to 6 questions that start easy and finish with a stretch.</p></div>';
    if (last) {
      var nextQ = firstOpenQuestion(last);
      html += '<a class="continue" href="#/sheet/' + last.id + (nextQ ? '/q/' + nextQ : '') + '">' +
        '<span class="continue-text"><span class="eyebrow">Keep going</span><span class="continue-title">' + esc(last.strandName) + ' · Sheet ' + last.num + ': ' + esc(last.title) + '</span>' +
        '<span class="continue-sub">' + (nextQ ? 'Question ' + nextQ + ' of ' + last.questions.length : 'All done. Pick another sheet.') + '</span></span>' +
        '<span class="continue-btn">Continue</span></a>';
    }
    html += '</div>';

    W.all().forEach(function (st) {
      var unlocked = isUnlocked(st);
      var doneSheets = st.sheets.filter(function (sh) { return sheetState(sh) === 'done'; }).length;
      var lockNote = st.unlock ? 'Opens after ' + W.strand(st.unlock.strand).name + ' ' + st.unlock.sheet : '';
      html += '<section class="strand" aria-label="' + esc(st.name) + '">' +
        '<div class="strand-head"><span class="strand-rod" data-rod="' + st.rod + '"></span><h2>' + esc(st.name) + '</h2>' +
        '<span class="strand-blurb">' + esc(st.blurb) + '</span>' +
        '<span class="strand-progress">' + (unlocked ? doneSheets + ' of ' + st.sheets.length + ' sheets' : esc(lockNote)) + '</span></div>' +
        '<div class="tiles">';
      st.sheets.forEach(function (sh) {
        var state = unlocked ? sheetState(sh) : 'locked';
        var done = S.doneCount(sh.id);
        var sub = state === 'done' ? sh.questions.length + ' of ' + sh.questions.length
          : state === 'locked' ? 'Opens later'
          : done ? done + ' of ' + sh.questions.length + ' done' : sh.questions.length + ' questions';
        var mark = state === 'done' ? '✓' : state === 'current' ? '•' : '';
        var inner = '<span class="tile-top">Sheet ' + sh.num + '<span class="tile-dot">' + mark + '</span></span>' +
          '<span class="tile-title">' + esc(sh.title) + '</span><span class="tile-sub">' + sub + '</span>';
        var label = 'Sheet ' + sh.num + ': ' + sh.title + ', ' + sub;
        html += state === 'locked'
          ? '<span class="tile is-locked" aria-label="' + esc(label) + '">' + inner + '</span>'
          : '<a class="tile is-' + state + '" href="#/sheet/' + sh.id + '" aria-label="' + esc(label) + '">' + inner + '</a>';
      });
      html += '</div></section>';
    });

    html += '<div class="lib-foot"><label class="check"><input type="checkbox" id="unlock-all"' + (S.get('unlockAll') ? ' checked' : '') + '> Grown-ups: open every strand</label></div>';
    html += '</main>';
    app.innerHTML = html;

    app.querySelectorAll('.strand-rod').forEach(function (el) {
      el.appendChild(R.makeRod(Number(el.dataset.rod), { cell: 12, badge: false }));
    });
    document.getElementById('unlock-all').addEventListener('change', function (e) {
      S.set('unlockAll', e.target.checked);
      renderLibrary();
    });
    document.title = 'Rod Lab · Worksheets';
  }

  function firstOpenQuestion(sh) {
    for (var i = 1; i <= sh.questions.length; i++) if (!S.isDone(sh.id, i)) return i;
    return null;
  }

  /* ---------- one sheet ---------- */

  var SETTING_ROWS = [
    ['showResult', 'Show live result', 'Off: the result reads ? until Check'],
    ['allowMult', 'Multiplication switch', 'Let the child turn × on and off'],
    ['multOn', 'Start with × on', 'Same-size groups read as 2 × 3'],
    ['takeAway', 'Take-away area', 'Show the subtraction zone'],
    ['hints', 'Hint after 2 tries', 'Show a nudge after two misses']
  ];

  function sheetSettings(sh) { return S.settings(sh.id, W.defaults(sh.strand)); }

  function renderSheet(sh) {
    S.set('lastSheet', sh.id);
    var done = S.doneCount(sh.id);
    var total = sh.questions.length;
    var settings = sheetSettings(sh);
    var nextQ = firstOpenQuestion(sh);

    var html = header('sheets', '') + '<main class="page page-sheet">' +
      '<div class="sheet-main">' +
        '<div class="sheet-head"><a href="#/" class="back">← ' + esc(sh.strandName) + '</a>' +
        '<h1>Sheet ' + sh.num + ': ' + esc(sh.title) + '</h1>' +
        '<div class="sheet-progress"><span>' + done + ' of ' + total + ' done</span>' +
        '<div class="progress" role="progressbar" aria-label="Sheet progress" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + done + '"><div style="width:' + (100 * done / total) + '%"></div></div></div></div>' +
        '<div class="qgrid">';
    sh.questions.forEach(function (q) {
      var isDone = S.isDone(sh.id, q.n);
      var state = isDone ? 'done' : q.n === nextQ ? 'current' : 'upcoming';
      var answer = S.sheet(sh.id).done[q.n];
      html += '<article class="qtile is-' + state + '" aria-label="Question ' + q.n + ', ' + state + '">' +
        '<div class="qtile-head"><span class="qtile-num">Question ' + q.n + '</span><span class="tag">' + (q.n === total && total === 6 ? 'Stretch' : esc(q.label)) + '</span></div>' +
        levelBars(q.n) +
        '<p class="qtile-prompt">' + esc(q.prompt) + '</p>' +
        (isDone
          ? '<div class="qtile-done">' + CHECK + (answer === true || answer === 'true' ? 'Done' : 'Answered ' + esc(answer)) + '</div><a class="link-btn" href="#/sheet/' + sh.id + '/q/' + q.n + '">Look again</a>'
          : '<a class="btn ' + (state === 'current' ? 'btn-primary' : '') + ' btn-block" href="#/sheet/' + sh.id + '/q/' + q.n + '">' + (state === 'current' ? 'Open in workspace' : 'Open') + '</a>') +
        '</article>';
    });
    html += '</div></div>' +
      '<aside class="settings" aria-label="Sheet settings for grown-ups"><h2>Sheet settings</h2><p class="muted">For grown-ups. Applies to this sheet only.</p>';
    SETTING_ROWS.forEach(function (r) {
      html += '<div class="setting"><div><span class="setting-label">' + r[1] + '</span><span class="setting-help">' + r[2] + '</span></div>' +
        '<button type="button" class="switch switch-bare" data-setting="' + r[0] + '" aria-pressed="' + !!settings[r[0]] + '" aria-label="' + r[1] + '"><span class="switch-track"><span class="switch-knob"></span></span></button></div>';
    });
    html += '<button type="button" class="btn btn-block" data-reset>Start this sheet over</button></aside></main>';
    app.innerHTML = html;

    app.querySelectorAll('[data-setting]').forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.dataset.setting;
        var v = b.getAttribute('aria-pressed') !== 'true';
        S.setSetting(sh.id, key, v);
        b.setAttribute('aria-pressed', String(v));
      });
    });
    app.querySelector('[data-reset]').addEventListener('click', function () {
      S.resetSheet(sh.id);
      renderSheet(sh);
    });
    document.title = 'Rod Lab · ' + sh.strandName + ' sheet ' + sh.num;
  }

  function levelBars(n) {
    var html = '<div class="levels" aria-label="Difficulty ' + n + ' of 6">';
    for (var i = 1; i <= 6; i++) html += '<span class="' + (i <= n ? 'on' : '') + '" style="height:' + (6 + i * 3) + 'px"></span>';
    return html + '</div>';
  }

  /* ---------- a question in the workspace ---------- */

  function renderQuestion(sh, n) {
    var q = sh.questions[n - 1];
    if (!q) { location.hash = '#/sheet/' + sh.id; return; }
    S.set('lastSheet', sh.id);
    var total = sh.questions.length;
    var settings = sheetSettings(sh);
    var solved = S.isDone(sh.id, n);

    var dots = '<span class="dots" aria-hidden="true">';
    for (var i = 1; i <= total; i++) dots += '<span class="' + (S.isDone(sh.id, i) ? 'is-done' : '') + (i === n ? ' is-here' : '') + '"></span>';
    dots += '</span>';
    var crumb = '<span class="crumb">' + esc(sh.strandName) + ' · Sheet ' + sh.num + ' · Question ' + n + ' of ' + total + '</span>' + dots;

    var typed = q.kind !== 'build';
    app.innerHTML = header('sheets', crumb) + '<main class="page page-ws">' +
      '<section class="qcard" aria-label="Question">' +
        '<div class="qcard-head"><a class="back" href="#/sheet/' + sh.id + '">← Sheet ' + sh.num + '</a>' +
        '<span class="tag">' + esc(q.label) + '</span>' + levelBars(n) + '</div>' +
        '<p class="qcard-prompt">' + esc(q.prompt) + '</p>' +
        '<form class="qcard-answer" novalidate>' +
          (typed ? '<label for="answer">Your answer</label><input id="answer" class="answer-input' + (q.kind === 'divide' ? ' is-divide' : '') + '" type="text" inputmode="' + (q.kind === 'divide' ? 'text' : 'numeric') + '" autocomplete="off" placeholder="' + (q.placeholder ? esc(q.placeholder) : '') + '">' : '') +
          '<button type="submit" class="btn btn-primary">' + (typed ? 'Check' : 'Check my blocks') + '</button>' +
        '</form>' +
        '<p class="qcard-feedback" aria-live="polite"></p>' +
        '<div class="qcard-next" hidden></div>' +
      '</section>' +
      '<div id="ws-root"></div>' +
    '</main>';

    var wsRoot = document.getElementById('ws-root');
    current = new RL.Workspace(wsRoot, {
      settings: Object.assign({}, settings, { showResult: settings.showResult || solved }),
      onChange: function () { S.setWork(sh.id, n, current.format()); }
    });
    var saved = S.work(sh.id, n);
    if (saved) current.setText(saved);
    else if (q.kind === 'divide') current.setText(q.spec);

    var form = app.querySelector('.qcard-answer');
    var feedback = app.querySelector('.qcard-feedback');
    var nextBox = app.querySelector('.qcard-next');
    var answerInput = app.querySelector('#answer');

    function showNext() {
      var nq = n < total ? n + 1 : null;
      nextBox.hidden = false;
      nextBox.innerHTML = nq
        ? '<a class="btn btn-primary" href="#/sheet/' + sh.id + '/q/' + nq + '">Next question →</a>'
        : '<a class="btn btn-primary" href="#/sheet/' + sh.id + '">Back to the sheet</a>';
    }

    if (solved) {
      feedback.className = 'qcard-feedback is-ok';
      feedback.innerHTML = CHECK + ' You’ve already solved this one.';
      showNext();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var res = W.check(q, answerInput ? answerInput.value : '', current.getModel());
      if (res.ok) {
        var given = answerInput ? answerInput.value.trim() : null;
        S.markDone(sh.id, n, given);
        current.setRevealed(true);
        feedback.className = 'qcard-feedback is-ok';
        feedback.innerHTML = CHECK + ' ' + praise(q, total);
        showNext();
        app.querySelectorAll('.dots span')[n - 1].classList.add('is-done');
        return;
      }
      var tries = S.addTry(sh.id, n);
      feedback.className = 'qcard-feedback is-miss';
      feedback.textContent = res.message;
      if (settings.hints && tries >= 2) {
        var hint = document.createElement('span');
        hint.className = 'hint';
        hint.textContent = 'Hint: ' + q.hint;
        feedback.appendChild(hint);
      }
    });

    if (answerInput) answerInput.focus({ preventScroll: true });
    document.title = 'Rod Lab · ' + q.prompt;
  }

  function praise(q, total) {
    if (q.n === total && total === 6) return 'You got the stretch one!';
    if (q.kind === 'build') return 'Nice building!';
    return ['That’s it!', 'Right!', 'Yes, well done.', 'Exactly right.', 'Spot on!'][(q.n - 1) % 5];
  }

  /* ---------- free play ---------- */

  function renderPlay() {
    app.innerHTML = header('play', '<span class="crumb">Free play · live result on</span>') +
      '<main class="page page-ws"><div id="ws-root"></div></main>';
    current = new RL.Workspace(document.getElementById('ws-root'), {
      settings: { showResult: true, allowMult: true, multOn: S.get('playMult') == null ? true : !!S.get('playMult'), takeAway: true },
      onChange: function () { S.set('playWork', current.format()); S.set('playMult', current.state.mult); }
    });
    var saved = S.get('playWork');
    current.setText(saved != null ? saved : '(2 × 3) + 5');
    document.title = 'Rod Lab · Workspace';
  }

  /* ---------- router ---------- */

  function route() {
    teardown();
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/').filter(Boolean);
    window.scrollTo(0, 0);
    if (parts[0] === 'play') return renderPlay();
    if (parts[0] === 'sheet') {
      var sh = W.sheet(parts[1]);
      if (!sh) { location.hash = '#/'; return; }
      var st = W.strand(sh.strand);
      if (!isUnlocked(st)) { location.hash = '#/'; return; }
      if (parts[2] === 'q') return renderQuestion(sh, parseInt(parts[3], 10));
      return renderSheet(sh);
    }
    return renderLibrary();
  }

  window.addEventListener('hashchange', route);
  route();
})(window.RL = window.RL || {});
