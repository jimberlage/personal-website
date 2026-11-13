/* Rod Lab — progress and settings, kept in this browser's localStorage. */
(function (RL) {
  'use strict';

  var KEY = 'rodlab.v1';
  var data = null;

  function load() {
    if (data) return data;
    try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { data = null; }
    if (!data || typeof data !== 'object') data = {};
    data.sheets = data.sheets || {};
    data.settings = data.settings || {};
    return data;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(load())); } catch (_) { /* storage unavailable: progress lasts for this visit */ }
  }

  function sheet(id) {
    var d = load();
    if (!d.sheets[id]) d.sheets[id] = { done: {}, tries: {}, work: {} };
    var s = d.sheets[id];
    s.done = s.done || {}; s.tries = s.tries || {}; s.work = s.work || {};
    return s;
  }

  RL.store = {
    sheet: sheet,
    doneCount: function (id) { return Object.keys(sheet(id).done).length; },
    isDone: function (id, n) { return !!sheet(id).done[n]; },
    markDone: function (id, n, answer) { sheet(id).done[n] = answer == null ? true : String(answer); save(); },
    tries: function (id, n) { return sheet(id).tries[n] || 0; },
    addTry: function (id, n) { var s = sheet(id); s.tries[n] = (s.tries[n] || 0) + 1; save(); return s.tries[n]; },
    work: function (id, n) { return sheet(id).work[n] || ''; },
    setWork: function (id, n, text) { sheet(id).work[n] = text; save(); },
    resetSheet: function (id) { delete load().sheets[id]; save(); },
    settings: function (id, defaults) { return Object.assign({}, defaults, load().settings[id] || {}); },
    setSetting: function (id, key, value) { var d = load(); d.settings[id] = d.settings[id] || {}; d.settings[id][key] = value; save(); },
    get: function (key) { return load()[key]; },
    set: function (key, value) { load()[key] = value; save(); }
  };
})(window.RL = window.RL || {});
