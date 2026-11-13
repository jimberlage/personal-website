/* Rod Lab — worksheet content and answer checking.
 *
 * Each question is a short spec string:
 *   "6+4"            solve         → 6 + 4 = ☐
 *   "8+_=10"         missing number→ 8 + ☐ = 10
 *   "17/5"           divide        → 17 ÷ 5 = ☐ R ☐
 *   "3/4x8"          fraction      → 3/4 of 8 = ☐
 *   "B 11 rods=3"    build it      → Make 11 with 3 rods
 *       options: rods=N, same, max=N, neg
 * Sheets hold at most 6 questions and get harder from first to last.
 */
(function (root) {
  'use strict';

  var E = root.equation || (typeof require !== 'undefined' ? require('./equation.js').equation : null);

  var STRANDS = [
    { id: 'add', name: 'Addition', blurb: 'Join rods end to end', rod: 2, sheets: [
      ['Counting on', '2+1', '3+2', '4+3', '5+2', '6+3', 'B 9 rods=2'],
      ['Make 5', '4+1', '3+2', '2+_=5', '_+4=5', '1+_=5', 'B 5 rods=3'],
      ['Doubles', '2+2', '3+3', '4+4', '5+5', '6+6', 'B 14 same rods=2'],
      ['Make 10', '6+4', '7+3', '8+_=10', '_+5=10', 'B 11 rods=3', 'B 10 rods=3 max=4'],
      ['Three addends', '2+3+1', '3+3+2', '4+2+3', '5+4+1', '6+3+4', 'B 15 rods=3'],
      ['Missing addend', '5+_=7', '_+3=9', '6+_=11', '_+7=12', '8+_=15', 'B 13 rods=2 max=7'],
      ['Teen sums', '9+3', '8+6', '7+7', '9+8', '10+9', 'B 18 rods=2'],
      ['Mixed review', '4+5', '7+_=10', '3+4+3', '8+7', '_+9=16', 'B 20 rods=3']
    ] },
    { id: 'sub', name: 'Subtraction', blurb: 'Slide rods into the take-away area', rod: 3, sheets: [
      ['Take away', '3-1', '4-2', '5-2', '6-3', '7-4', 'B 2 neg'],
      ['Count back', '6-1', '8-2', '9-3', '10-4', '10-6', 'B 4 neg rods=2'],
      ['How many more?', '3+_=5', '4+_=7', '6+_=9', '_+3=8', '_+6=10', 'B 1 neg rods=2'],
      ['Missing part', '7-_=4', '9-_=5', '_-3=6', '10-_=3', '_-4=8', 'B 5 neg rods=3'],
      ['From 10', '10-1', '10-3', '10-5', '10-8', '10-_=4', 'B 6 neg'],
      ['Teen minus', '12-2', '13-4', '15-6', '17-9', '18-_=9', 'B 7 neg rods=2'],
      ['Add and take', '5+3-2', '6-2+4', '8+4-5', '9-3-2', '10+5-7', 'B 0 neg'],
      ['Mixed review', '9-4', '12-5', '7+6-3', '_-6=7', '3-8', 'B -2 neg']
    ] },
    { id: 'mul', name: 'Multiplication', blurb: 'Groups of the same size', rod: 4, sheets: [
      ['Equal groups', '2x2', '2x3', '3x2', '2x5', '3x3', 'B 8 same'],
      ['Doubles as × 2', '2x4', '2x6', '2x7', '2x8', '2x9', 'B 12 same rods=2'],
      ['Groups of 5', '2x5', '3x5', '4x5', '5x5', '6x5', 'B 25 same max=5'],
      ['Groups of 10', '2x10', '3x10', '5x10', '4x10+3', '6x10+5', 'B 34'],
      ['× and + together', '2x3+1', '2x4+3', '3x3+2', '2x5+4', '3x4+5', 'B 17 rods=4'],
      ['Mixed review', '3x4', '4x4', '2x6+5', '5x3-4', '3x6', 'B 24 same']
    ] },
    { id: 'div', name: 'Division', blurb: 'Scoop into groups, keep the leftovers', rod: 5, unlock: { strand: 'mul', sheet: 3 }, sheets: [
      ['Groups of', '6/2', '8/4', '9/3', '10/5', '12/3', '15/5'],
      ['Sharing out', '6/3', '8/2', '12/4', '14/7', '16/8', '18/6'],
      ['Remainders', '7/2', '9/4', '11/3', '13/5', '17/5', '19/4'],
      ['Check with ×', '10/2', '12/6', '15/3', '20/4', '21/7', '24/8'],
      ['Bigger numbers', '30/5', '32/10', '40/8', '45/9', '50/7', '63/10'],
      ['Mixed review', '9/2', '16/4', '22/5', '27/9', '35/6', '47/8']
    ] },
    { id: 'frac', name: 'Fractions', blurb: 'Cut a rod into equal parts', rod: 9, unlock: { strand: 'div', sheet: 3 }, sheets: [
      ['Halves', '1/2x2', '1/2x4', '1/2x6', '1/2x8', '1/2x10', '2/2x6'],
      ['Thirds and quarters', '1/3x3', '1/3x6', '1/4x4', '1/4x8', '2/3x9', '3/4x4'],
      ['Part of a rod', '2/4x8', '3/4x8', '2/5x10', '3/5x5', '4/5x10', '5/6x6'],
      ['Compare parts', '1/2x8', '2/4x8', '1/3x9', '2/6x6', '3/9x9', '4/8x8'],
      ['Same amount, new name', '1/2x10', '5/10x10', '2/3x6', '4/6x6', '3/4x8', '6/8x8'],
      ['Mixed review', '1/5x10', '3/7x7', '2/3x9', '5/8x8', '7/10x10', '4/9x9']
    ] }
  ];

  var DEFAULT_SETTINGS = {
    add: { showResult: false, allowMult: true, multOn: false, takeAway: false, hints: true },
    sub: { showResult: false, allowMult: true, multOn: false, takeAway: true, hints: true },
    mul: { showResult: false, allowMult: true, multOn: true, takeAway: true, hints: true },
    div: { showResult: false, allowMult: true, multOn: true, takeAway: true, hints: true },
    frac: { showResult: false, allowMult: true, multOn: false, takeAway: true, hints: true }
  };

  function pretty(spec) {
    return spec
      .replace(/x/g, ' × ').replace(/\//g, ' ÷ ').replace(/\+/g, ' + ')
      .replace(/-/g, ' − ').replace(/=/g, ' = ').replace(/_/g, '☐')
      .replace(/\s+/g, ' ').trim();
  }

  function parseQuestion(spec, index) {
    var q = { spec: spec, n: index + 1 };
    var m;
    if (/^B /.test(spec)) {
      var parts = spec.split(/\s+/);
      var b = { target: parseInt(parts[1], 10) };
      parts.slice(2).forEach(function (p) {
        if (p === 'same') b.same = true;
        else if (p === 'neg') b.neg = true;
        else if ((m = /^rods=(\d+)$/.exec(p))) b.rods = parseInt(m[1], 10);
        else if ((m = /^max=(\d+)$/.exec(p))) b.max = parseInt(m[1], 10);
      });
      q.kind = 'build';
      q.build = b;
      q.label = 'Build it';
      q.prompt = buildPrompt(b);
      q.hint = b.neg
        ? 'Put the bigger rods in the main area and slide some into the take-away area until the result is ' + E.formatNumber(b.target) + '.'
        : b.rods ? 'Start with one long rod, then add more rods until there are ' + b.rods + ' and they make ' + b.target + '.'
        : 'Start with one rod, then add more until the blocks make ' + b.target + '.';
    } else if (spec.indexOf('_') >= 0) {
      q.kind = 'missing';
      q.label = 'Missing number';
      q.prompt = pretty(spec);
      q.answer = solveMissing(spec);
      q.hint = 'Build the numbers you know, then add or take blocks until both sides match.';
    } else if ((m = /^(\d+)\/(\d+)x(\d+)$/.exec(spec))) {
      q.kind = 'fraction';
      q.label = 'Fraction';
      q.prompt = m[1] + '/' + m[2] + ' of ' + m[3] + ' = ☐';
      q.answer = parseInt(m[1], 10) * parseInt(m[3], 10) / parseInt(m[2], 10);
      q.hint = 'Type ' + m[1] + '/' + m[2] + ' x ' + m[3] + ' into the bar, then count the blocks in the parts you picked.';
    } else if ((m = /^(\d+)\/(\d+)$/.exec(spec))) {
      var a = parseInt(m[1], 10), d = parseInt(m[2], 10);
      q.kind = 'divide';
      q.label = a % d ? 'Remainder' : 'Divide';
      q.prompt = a + ' ÷ ' + d + ' = ☐';
      q.answer = { q: Math.floor(a / d), r: a % d };
      q.hint = 'Type ' + a + ' / ' + d + ' into the bar, then make groups of ' + d + ' until there are fewer than ' + d + ' left.';
    } else {
      q.kind = 'solve';
      q.label = 'Solve';
      q.prompt = pretty(spec) + ' = ☐';
      q.answer = E.evaluate(spec);
      q.hint = 'Type the problem into the bar, then count the blocks.';
    }
    return q;
  }

  function buildPrompt(b) {
    var bits = [];
    if (b.rods) bits.push('with ' + b.rods + ' rods');
    if (b.same) bits.push(b.rods ? 'all the same size' : 'using rods that are all the same size');
    if (b.max) bits.push('none longer than ' + b.max);
    if (b.neg) bits.push('using the take-away area');
    return 'Make ' + E.formatNumber(b.target) + (bits.length ? ' ' + bits.join(', ') : '');
  }

  function solveMissing(spec) {
    var sides = spec.split('=');
    for (var k = 0; k <= 100; k++) {
      var l = E.evaluate(sides[0].replace('_', String(k)));
      var r = E.evaluate(sides[1].replace('_', String(k)));
      if (l !== null && l === r) return k;
    }
    return null;
  }

  function parseNumber(text) {
    var t = String(text || '').trim().replace(/−|–/g, '-');
    if (!/^-?\d+$/.test(t)) return null;
    return parseInt(t, 10);
  }

  /* Check a typed answer, or (for build questions) the workspace model. */
  function check(q, answerText, model) {
    if (q.kind === 'build') return checkBuild(q.build, model);
    if (q.kind === 'divide') {
      var m = /^\s*(\d+)\s*(?:r|R|rem|remainder)?\s*(\d+)?\s*$/.exec(answerText || '');
      if (!m) return { ok: false, message: 'Write it like 3 R 2.' };
      var qq = parseInt(m[1], 10), rr = m[2] ? parseInt(m[2], 10) : 0;
      if (qq === q.answer.q && rr === q.answer.r) return { ok: true };
      if (qq === q.answer.q) return { ok: false, message: 'The number of groups is right. Count the leftovers again.' };
      return { ok: false, message: 'Not quite. Count the groups again.' };
    }
    var n = parseNumber(answerText);
    if (n === null) return { ok: false, message: 'Type a number in the answer box.' };
    if (n === q.answer) return { ok: true };
    return { ok: false, message: 'Not quite. Have another look at the blocks.' };
  }

  function checkBuild(b, model) {
    if (!model || model.mode !== 'normal') return { ok: false, message: 'Build this one with plain rods, without ÷.' };
    var groups = model.groups;
    if (!groups.length) return { ok: false, message: 'Drag some blocks out of the bin first.' };
    if (model.value !== b.target) {
      return { ok: false, message: 'Your blocks make ' + E.formatNumber(model.value) + '. You need ' + E.formatNumber(b.target) + '.' };
    }
    if (b.rods && groups.length !== b.rods) {
      return { ok: false, message: 'That makes ' + E.formatNumber(b.target) + ' with ' + groups.length + (groups.length === 1 ? ' rod' : ' rods') + '. Try ' + b.rods + '.' };
    }
    if (b.same) {
      var s0 = groups[0].size;
      if (groups.length < 2 || groups.some(function (g) { return g.size !== s0; })) {
        return { ok: false, message: 'Right number! Now make every rod the same size.' };
      }
    }
    if (b.max && groups.some(function (g) { return g.size > b.max; })) {
      return { ok: false, message: 'Right number! Keep every rod ' + b.max + ' or shorter.' };
    }
    if (b.neg && !groups.some(function (g) { return g.zone === 'neg'; })) {
      return { ok: false, message: 'Right number! Now use the take-away area too.' };
    }
    return { ok: true };
  }

  var cache = null;
  function all() {
    if (cache) return cache;
    cache = STRANDS.map(function (st) {
      return {
        id: st.id, name: st.name, blurb: st.blurb, rod: st.rod, unlock: st.unlock || null,
        sheets: st.sheets.map(function (sh, i) {
          return {
            id: st.id + '-' + (i + 1), strand: st.id, strandName: st.name, num: i + 1, title: sh[0],
            questions: sh.slice(1, 7).map(parseQuestion)
          };
        })
      };
    });
    return cache;
  }

  function strand(id) { return all().filter(function (s) { return s.id === id; })[0] || null; }
  function sheet(id) {
    var parts = String(id).split('-');
    var st = strand(parts[0]);
    return st ? st.sheets[parseInt(parts[1], 10) - 1] || null : null;
  }

  root.worksheets = {
    all: all, strand: strand, sheet: sheet, check: check, parseQuestion: parseQuestion,
    defaults: function (strandId) { return Object.assign({}, DEFAULT_SETTINGS[strandId] || DEFAULT_SETTINGS.add); }
  };
})(typeof window !== 'undefined' ? (window.RL = window.RL || {}) : module.exports);
