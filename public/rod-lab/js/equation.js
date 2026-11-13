/* Rod Lab — equation bar: tokenizer, parser, interpreter and formatter.
 * Pure functions, no DOM. Loaded as a classic script (window.RL.equation)
 * and also runnable under Node for tests. */
(function (root) {
  'use strict';

  var MAX_BLOCKS = 100;
  var MAX_ROD = 10;

  var OPS = {
    '+': '+',
    '-': '-', '−': '-', '–': '-',
    'x': '*', 'X': '*', '*': '*', '×': '*',
    '/': '/', '÷': '/'
  };

  function err(pos, message) {
    return { ok: false, pos: pos, message: message };
  }

  function tokenize(text) {
    var tokens = [];
    var i = 0;
    while (i < text.length) {
      var ch = text[i];
      if (ch === ' ' || ch === '\t') { i++; continue; }
      if (ch >= '0' && ch <= '9') {
        var start = i;
        while (i < text.length && text[i] >= '0' && text[i] <= '9') i++;
        tokens.push({ type: 'num', value: parseInt(text.slice(start, i), 10), pos: start, end: i });
        continue;
      }
      if (OPS[ch]) { tokens.push({ type: 'op', value: OPS[ch], pos: i, end: i + 1 }); i++; continue; }
      if (ch === '(') { tokens.push({ type: 'lp', pos: i, end: i + 1 }); i++; continue; }
      if (ch === ')') { tokens.push({ type: 'rp', pos: i, end: i + 1 }); i++; continue; }
      return err(i, 'Only numbers, spaces and + − × ÷ can go here.');
    }
    return { ok: true, tokens: tokens };
  }

  /* Grammar:
   *   expr   := ['-'] term (('+'|'-') term)*
   *   term   := factor (('*'|'/') factor)*
   *   factor := num | '(' expr ')'
   */
  function parse(text) {
    var t = tokenize(text);
    if (!t.ok) return t;
    var toks = t.tokens;
    var k = 0;
    var failure = null;

    function peek() { return toks[k]; }
    function fail(pos, msg) { if (!failure) failure = err(pos, msg); return null; }
    function endPos() { return text.replace(/\s+$/, '').length; }

    function factor() {
      var tok = peek();
      if (!tok) return fail(endPos(), 'Finish the equation with a number.');
      if (tok.type === 'num') { k++; return { type: 'num', value: tok.value, pos: tok.pos, end: tok.end }; }
      if (tok.type === 'lp') {
        k++;
        var inner = expr(true);
        if (!inner) return null;
        var close = peek();
        if (!close || close.type !== 'rp') return fail(close ? close.pos : endPos(), 'Close the bracket with ).');
        k++;
        inner.parens = true;
        inner.pos = tok.pos; inner.end = close.end;
        return inner;
      }
      if (tok.type === 'op') return fail(tok.pos, 'Put a number before ' + displayOp(tok.value) + '.');
      return fail(tok.pos, 'This bracket has nothing to close.');
    }

    function term() {
      var left = factor();
      if (!left) return null;
      while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/')) {
        var op = toks[k++];
        var right = factor();
        if (!right) return null;
        left = { type: op.value === '*' ? 'mul' : 'div', left: left, right: right, pos: left.pos, end: right.end, opPos: op.pos };
      }
      return left;
    }

    function expr(inParens) {
      var first = peek();
      var neg = false;
      if (first && first.type === 'op' && first.value === '-') { k++; neg = true; }
      var node = term();
      if (!node) return null;
      if (neg) node = { type: 'neg', arg: node, pos: first.pos, end: node.end };
      while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
        var op = toks[k++];
        var right = term();
        if (!right) return null;
        node = { type: op.value === '+' ? 'add' : 'sub', left: node, right: right, pos: node.pos, end: right.end };
      }
      var nxt = peek();
      if (nxt && !inParens) {
        if (nxt.type === 'num' || nxt.type === 'lp') return fail(nxt.pos, 'Put + − × or ÷ between numbers.');
        if (nxt.type === 'rp') return fail(nxt.pos, 'This bracket has nothing to close.');
      }
      return node;
    }

    if (toks.length === 0) return { ok: true, ast: null };
    var ast = expr(false);
    if (!ast) return failure;
    return { ok: true, ast: ast };
  }

  function displayOp(op) {
    return { '+': '+', '-': '−', '*': '×', '/': '÷' }[op] || op;
  }

  /* Flatten +/− into signed summands. */
  function summands(node, sign, out) {
    if (node.type === 'add') { summands(node.left, sign, out); summands(node.right, sign, out); return out; }
    if (node.type === 'sub') { summands(node.left, sign, out); summands(node.right, -sign, out); return out; }
    if (node.type === 'neg') { summands(node.arg, -sign, out); return out; }
    out.push({ sign: sign, node: node });
    return out;
  }

  function containsDiv(node) {
    if (!node) return false;
    if (node.type === 'div') return true;
    return containsDiv(node.left) || containsDiv(node.right) || containsDiv(node.arg);
  }

  /* Turn an AST into what the canvas can show:
   *   {mode:'normal', pos:[sizes...], neg:[sizes...]} (sizes in term order)
   *   {mode:'divide', dividend, divisor}
   *   {mode:'fraction', num, den, whole}
   */
  function interpret(ast) {
    if (!ast) return { ok: true, mode: 'normal', pos: [], neg: [] };

    if (ast.type === 'div' && ast.left.type === 'num' && ast.right.type === 'num') {
      var a = ast.left.value, b = ast.right.value;
      if (b === 0) return err(ast.right.pos, 'You can’t make groups of 0.');
      if (b > MAX_ROD) return err(ast.right.pos, 'Divide by a rod from 1 to 10.');
      if (a > MAX_BLOCKS) return err(ast.left.pos, 'That’s more than ' + MAX_BLOCKS + ' blocks.');
      return { ok: true, mode: 'divide', dividend: a, divisor: b };
    }

    if (ast.type === 'mul' && ast.left.type === 'div' && !ast.left.parens &&
        ast.left.left.type === 'num' && ast.left.right.type === 'num' && ast.right.type === 'num') {
      var n = ast.left.left.value, d = ast.left.right.value, w = ast.right.value;
      if (w < 1 || w > MAX_ROD) return err(ast.right.pos, 'The whole has to be a rod from 1 to 10.');
      if (d < 1) return err(ast.left.right.pos, 'Cut into at least 1 part.');
      if (w % d !== 0) return err(ast.left.right.pos, w + ' can’t be cut into ' + d + ' equal rods.');
      if (n > d) return err(ast.left.left.pos, 'Pick at most ' + d + ' of the ' + d + ' parts.');
      return { ok: true, mode: 'fraction', num: n, den: d, whole: w };
    }

    if (containsDiv(ast)) {
      return err(findDiv(ast).opPos, 'Division works on its own, like 17 ÷ 5, or as a fraction, like 3/4 × 8.');
    }

    var parts = summands(ast, 1, []);
    var pos = [], neg = [];
    for (var i = 0; i < parts.length; i++) {
      var s = parts[i];
      var sizes = sizesOf(s.node);
      if (!sizes.ok) return sizes;
      var target = s.sign > 0 ? pos : neg;
      for (var j = 0; j < sizes.list.length; j++) target.push(sizes.list[j]);
    }
    var total = 0;
    pos.concat(neg).forEach(function (x) { total += x; });
    if (total > MAX_BLOCKS) return err(0, 'That’s more than ' + MAX_BLOCKS + ' blocks.');
    return { ok: true, mode: 'normal', pos: pos, neg: neg };
  }

  function findDiv(node) {
    if (!node) return null;
    if (node.type === 'div') return node;
    return findDiv(node.left) || findDiv(node.right) || findDiv(node.arg);
  }

  function splitNumber(n) {
    var out = [];
    while (n > MAX_ROD) { out.push(MAX_ROD); n -= MAX_ROD; }
    if (n > 0) out.push(n);
    return out;
  }

  function sizesOf(node) {
    if (node.type === 'num') {
      if (node.value > MAX_BLOCKS) return err(node.pos, 'That’s more than ' + MAX_BLOCKS + ' blocks.');
      return { ok: true, list: splitNumber(node.value) };
    }
    if (node.type === 'mul') {
      if (node.left.type !== 'num' || node.right.type !== 'num') {
        return err(node.opPos, 'Keep × between two numbers, like 2 × 3.');
      }
      var count = node.left.value, size = node.right.value;
      if (size > MAX_ROD && count <= MAX_ROD) { var tmp = count; count = size; size = tmp; }
      if (size > MAX_ROD) return err(node.pos, 'One side of × has to be 10 or less.');
      if (count * size > MAX_BLOCKS) return err(node.pos, 'That’s more than ' + MAX_BLOCKS + ' blocks.');
      var list = [];
      for (var i = 0; i < count; i++) if (size > 0) list.push(size);
      return { ok: true, list: list };
    }
    if (node.type === 'neg' || node.type === 'add' || node.type === 'sub') {
      return err(node.pos, 'Keep × between two numbers, like 2 × 3.');
    }
    return err(node.pos, 'I can’t build that one with blocks.');
  }

  function read(text) {
    var p = parse(text);
    if (!p.ok) return p;
    return interpret(p.ast);
  }

  /* ---------- formatting canvas → text ---------- */

  /* groups: [{size, x, y, zone:'pos'|'neg'}] */
  function termsFor(groups, mult) {
    var sorted = groups.slice().sort(function (a, b) { return (a.x - b.x) || (a.y - b.y); });
    if (!mult) return sorted.map(function (g) { return { count: 1, size: g.size }; });
    var order = [], counts = {};
    sorted.forEach(function (g) {
      if (!counts[g.size]) { counts[g.size] = 0; order.push(g.size); }
      counts[g.size]++;
    });
    return order.map(function (s) { return { count: counts[s], size: s }; });
  }

  function termText(t, wrap) {
    if (t.count > 1) {
      var s = t.count + ' × ' + t.size;
      return wrap ? '(' + s + ')' : s;
    }
    return String(t.size);
  }

  function formatGroups(groups, mult) {
    var pos = termsFor(groups.filter(function (g) { return g.zone !== 'neg'; }), mult);
    var neg = termsFor(groups.filter(function (g) { return g.zone === 'neg'; }), mult);
    var wrap = pos.length + neg.length > 1;
    var out = pos.map(function (t) { return termText(t, wrap); }).join(' + ');
    neg.forEach(function (t, i) {
      var s = termText(t, wrap || neg.length > 0 && pos.length === 0 && t.count > 1);
      if (!out) out = '−' + s;
      else out += ' − ' + s;
    });
    return out;
  }

  function valueOfGroups(groups) {
    var v = 0;
    groups.forEach(function (g) { v += g.zone === 'neg' ? -g.size : g.size; });
    return v;
  }

  function formatNumber(n) {
    return n < 0 ? '−' + Math.abs(n) : String(n);
  }

  /* Plain arithmetic used by worksheets (integers, ÷ must divide exactly). */
  function evaluate(text) {
    var p = parse(text);
    if (!p.ok || !p.ast) return null;
    function ev(n) {
      if (n.type === 'num') return n.value;
      if (n.type === 'neg') return -ev(n.arg);
      var a = ev(n.left), b = ev(n.right);
      if (a === null || b === null) return null;
      if (n.type === 'add') return a + b;
      if (n.type === 'sub') return a - b;
      if (n.type === 'mul') return a * b;
      if (n.type === 'div') return b === 0 ? null : a / b;
      return null;
    }
    return ev(p.ast);
  }

  root.equation = {
    MAX_BLOCKS: MAX_BLOCKS,
    MAX_ROD: MAX_ROD,
    tokenize: tokenize,
    parse: parse,
    interpret: interpret,
    read: read,
    termsFor: termsFor,
    formatGroups: formatGroups,
    valueOfGroups: valueOfGroups,
    formatNumber: formatNumber,
    evaluate: evaluate
  };
})(typeof window !== 'undefined' ? (window.RL = window.RL || {}) : module.exports);
