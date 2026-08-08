// Vanilla JS + Plotly.js: fetch the CSV, parse it, and render an interactive
// scatter chart. Dots can be colored by ward (default) or by party, and
// hovering a dot shows the candidate, office, party, and ward.

const CHART_EL = document.getElementById("chart");
const statusEl = document.getElementById("status");
const statsEl = document.getElementById("stats");

const WARD_COLORS = [
  "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
  "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
  "#aec7e8", "#ffbb78", "#98df8a", "#ff9896",
];

const PARTY_COLORS = {
  Democratic: "#1f77b4",
  Republican: "#d62728",
  Libertarian: "#ffbf00",
  Green: "#2ca02c",
  Nonpartisan: "#7f7f7f",
};

let rows = [];
let view = "candidate";
let colorBy = "ward";
let voteFilter = "all";
let hideUnopposed = true;

function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

// Minimal RFC 4180 CSV parser: handles quoted fields, escaped quotes, and
// commas inside quotes (candidate names like 'ANTHONY T. BRANDON, JR.').
function parseCSV(text) {
  const out = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length) out.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); out.push(row); }
  return out;
}

async function loadData() {
  const csvText = await fetch("/election/data/election_data.csv").then((res) => {
    if (!res.ok) throw new Error(`Could not load election data (HTTP ${res.status})`);
    return res.text();
  });
  const table = parseCSV(csvText);
  const parsed = table.slice(1).map((c) => ({
    ward: Number(c[0]),
    office: c[1],
    party: c[2],
    candidate: c[3],
    total: Number(c[4]),
  }));

  // Normalize percentages across party lines: each candidate's votes divided
  // by the sum of all votes for the same office in the same ward (the CSV's
  // own percentage column is within-party and is ignored here).
  const sums = new Map();
  const counts = new Map();
  for (const r of parsed) {
    const key = r.ward + "|" + r.office;
    sums.set(key, (sums.get(key) || 0) + r.total);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  rows = parsed.map((r) => {
    const sum = sums.get(r.ward + "|" + r.office) || 0;
    return { ...r, pct: sum > 0 ? (r.total / sum) * 100 : 0 };
  });

  // Tag each row as a candidate race or a ballot proposition (all-Yes/No),
  // and whether the candidate ran unopposed (only contender in the office).
  const namesByOffice = new Map();
  for (const r of parsed) {
    if (!namesByOffice.has(r.office)) namesByOffice.set(r.office, new Set());
    namesByOffice.get(r.office).add(r.candidate);
  }
  rows = rows.map((r) => ({
    ...r,
    type: officeType(r.office, namesByOffice),
    unopposed: counts.get(r.ward + "|" + r.office) === 1,
  }));
}

// An office is a ballot proposition when every option is a Yes/No choice.
function officeType(office, namesByOffice) {
  const names = namesByOffice.get(office);
  return names && names.size > 0 && [...names].every((n) => /^(yes|no)\s*-/i.test(n))
    ? "proposition"
    : "candidate";
}

const HOVER_TEMPLATE =
  "<b>%{text}</b><br>" +
  "Office: %{customdata[0]}<br>" +
  "Party: %{customdata[1]}<br>" +
  "Ward: %{customdata[2]}<br>" +
  "Votes: %{x:,}<br>" +
  "Share: %{y:.2f}%<extra></extra>";

function traceFor(points, name, color) {
  return {
    type: "scatter",
    mode: "markers",
    name,
    x: points.map((p) => p.total),
    y: points.map((p) => p.pct),
    text: points.map((p) => p.candidate),
    customdata: points.map((p) => [p.office, p.party, p.ward]),
    marker: { color, size: 8, opacity: 0.85, line: { width: 0 } },
    hovertemplate: HOVER_TEMPLATE,
    hoverlabel: { namelength: -1 },
  };
}

function activeRows() {
  return rows.filter((r) => {
    if (r.type !== view) return false;
    if (hideUnopposed && r.unopposed) return false;
    if (view === "candidate" && candidateMulti.selected.size > 0 && !candidateMulti.selected.has(r.candidate)) return false;
    if (officeMulti.selected.size > 0 && !officeMulti.selected.has(r.office)) return false;
    if (voteFilter === "unpopular" && !(r.total < 500 && r.pct <= 20)) return false;
    if (voteFilter === "very-unpopular" && !(r.total < 100 && r.pct <= 20)) return false;
    return true;
  });
}

function buildTraces() {
  const active = activeRows();
  if (colorBy === "ward") {
    const groups = new Map();
    for (const r of active) {
      if (!groups.has(r.ward)) groups.set(r.ward, []);
      groups.get(r.ward).push(r);
    }
    return [...groups.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ward, pts]) => traceFor(pts, `Ward ${ward}`, WARD_COLORS[ward - 1]));
  }

  const groups = new Map();
  for (const r of active) {
    if (!groups.has(r.party)) groups.set(r.party, []);
    groups.get(r.party).push(r);
  }
  const known = Object.keys(PARTY_COLORS).filter((p) => groups.has(p));
  const unknown = [...groups.keys()].filter((p) => !PARTY_COLORS[p]).sort();
  return [...known, ...unknown].map((party) =>
    traceFor(groups.get(party), party, PARTY_COLORS[party] || "#999999")
  );
}

function buildLayout() {
  const active = activeRows();
  const yTop =
    voteFilter === "all"
      ? 105
      : Math.max(5, Math.ceil((active.reduce((m, r) => Math.max(m, r.pct), 0) * 1.25) / 5) * 5);
  return {
    title: {
      text: "Ward-by-Ward Votes",
      font: { size: 16 },
    },
    xaxis: { title: { text: "Total votes in ward" }, rangemode: "tozero" },
    yaxis: { title: { text: "Share of the vote (%)" }, range: [0, yTop] },
    legend: {
      orientation: "h",
      y: -0.22,
      x: 0.5,
      xanchor: "center",
      yanchor: "top",
      font: { size: 11 },
    },
    hovermode: "closest",
    margin: { t: 60, r: 12, b: 50, l: 40 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "#fbfcfe",
    autosize: true,
    modebar: { orientation: "v" },
  };
}

function render() {
  const active = activeRows();
  const wardCount = new Set(active.map((r) => r.ward)).size;
  statsEl.textContent = `${active.length.toLocaleString()} results · ${wardCount} wards`;
  Plotly.react(CHART_EL, buildTraces(), buildLayout(), {
    responsive: true,
    displaylogo: false,
  });
}

document.getElementById("hide-unopped").addEventListener("change", (e) => {
  hideUnopposed = e.target.checked;
  render();
});

document.getElementById("vote-filter").addEventListener("change", (e) => {
  voteFilter = e.target.value;
  render();
});

let candidateMulti, officeMulti;

function initMultiSelect(rootEl, { allLabel, countLabel, getOptions }) {
  const btn = rootEl.querySelector(".multi-btn");
  const panel = rootEl.querySelector(".multi-panel");
  const list = rootEl.querySelector(".multi-list");
  const search = rootEl.querySelector(".multi-search");
  const clear = rootEl.querySelector(".multi-clear");
  const selected = new Set();

  for (const opt of getOptions()) {
    const label = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = opt;
    cb.addEventListener("change", () => {
      if (cb.checked) selected.add(opt);
      else selected.delete(opt);
      update();
      render();
    });
    label.appendChild(cb);
    const span = document.createElement("span");
    span.textContent = opt;
    label.appendChild(span);
    label.dataset.name = opt;
    list.appendChild(label);
  }

  function update() {
    btn.textContent = selected.size === 0 ? allLabel : `${countLabel} (${selected.size})`;
  }

  btn.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
  });

  document.addEventListener("click", (e) => {
    if (!rootEl.contains(e.target)) panel.hidden = true;
  });

  search.addEventListener("input", () => {
    const q = search.value.trim().toLowerCase();
    list.querySelectorAll("label").forEach((l) => {
      l.hidden = q.length > 0 && !l.dataset.name.toLowerCase().includes(q);
    });
  });

  clear.addEventListener("click", () => {
    list.querySelectorAll("input").forEach((cb) => (cb.checked = false));
    selected.clear();
    update();
    render();
  });

  return { selected, panel, root: rootEl };
}

document.querySelectorAll("[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (view === btn.dataset.view) return;
    view = btn.dataset.view;
    document.querySelectorAll("[data-view]").forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
    candidateMulti.root.hidden = view !== "candidate";
    candidateMulti.panel.hidden = true;
    render();
  });
});

document.querySelectorAll("[data-color-by]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (colorBy === btn.dataset.colorBy) return;
    colorBy = btn.dataset.colorBy;
    document.querySelectorAll("[data-color-by]").forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
    render();
  });
});

async function main() {
  setStatus("Loading election data…");
  await loadData();
  candidateMulti = initMultiSelect(document.getElementById("candidate-multi"), {
    allLabel: "All candidates",
    countLabel: "Candidates",
    getOptions: () =>
      [...new Set(rows.filter((r) => r.type === "candidate").map((r) => r.candidate))].sort(
        (a, b) => a.localeCompare(b)
      ),
  });
  officeMulti = initMultiSelect(document.getElementById("office-multi"), {
    allLabel: "All offices",
    countLabel: "Offices",
    getOptions: () => [...new Set(rows.map((r) => r.office))].sort((a, b) => a.localeCompare(b)),
  });
  setStatus("Ready");
  render();
}

main().catch((err) => {
  console.error(err);
  setStatus("Error: " + err);
});
