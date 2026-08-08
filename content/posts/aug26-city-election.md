---
title: "Aug 26 STL City Election — Ward-by-Ward Visualization"
date: 2026-08-08
description: "An interactive look at the Aug 26 STL city election, plotting each ward's vote totals against share of the vote for every candidate and ballot proposition."
tags: [data, election, visualization]
---

The chart below plots **one point per result per ward**. The X axis is total votes; the Y axis is the share of the vote for that office, normalized across party lines (votes ÷ all votes cast for the office in that ward).

<div class="election">

  <p class="lead">
    Hover a point for details; use the controls to show <strong>candidates</strong> or
    <strong>propositions</strong>, to pick which <strong>candidates</strong> to keep
    (empty = all), to color dots by <strong>ward</strong> (the default) or by
    <strong>party</strong>, to filter to just the lowest-turnout results
    (<strong>Unpopular</strong>: fewer than 500 votes; <strong>Extremely unpopular</strong>:
    fewer than 100), dropping anyone who still cleared 20% of the vote, and to exclude
    candidates who ran <strong>unopposed</strong>.
  </p>

  <div class="controls">
    <div class="control-group">
      <span class="controls-label">Show</span>
      <div class="segmented" role="group" aria-label="Show">
        <button type="button" data-view="candidate" class="active">Candidates</button>
        <button type="button" data-view="proposition">Propositions</button>
      </div>
    </div>
    <span class="controls-divider"></span>
    <div class="control-group">
      <span class="controls-label">Candidates</span>
      <div class="multi" id="candidate-multi">
        <button type="button" class="multi-btn" id="candidate-multi-btn">All candidates</button>
        <div class="multi-panel" id="candidate-multi-panel" hidden>
          <input type="search" id="candidate-search" class="multi-search" placeholder="Search candidates…" autocomplete="off" />
          <div class="multi-list" id="candidate-multi-list"></div>
          <div class="multi-actions">
            <button type="button" class="multi-clear" id="candidate-clear">Clear</button>
          </div>
        </div>
      </div>
    </div>
    <span class="controls-divider"></span>
    <div class="control-group">
      <span class="controls-label">Offices</span>
      <div class="multi" id="office-multi">
        <button type="button" class="multi-btn" id="office-multi-btn">All offices</button>
        <div class="multi-panel" id="office-multi-panel" hidden>
          <input type="search" id="office-search" class="multi-search" placeholder="Search offices…" autocomplete="off" />
          <div class="multi-list" id="office-multi-list"></div>
          <div class="multi-actions">
            <button type="button" class="multi-clear" id="office-clear">Clear</button>
          </div>
        </div>
      </div>
    </div>
    <span class="controls-divider"></span>
    <div class="control-group">
      <span class="controls-label">Color by</span>
      <div class="segmented" role="group" aria-label="Color by">
        <button type="button" data-color-by="ward" class="active">Ward</button>
        <button type="button" data-color-by="party">Party</button>
      </div>
    </div>
    <span class="controls-divider"></span>
    <div class="control-group">
      <span class="controls-label">Votes</span>
      <select id="vote-filter" class="election-select" aria-label="Filter by vote total">
        <option value="all" selected>All</option>
        <option value="unpopular">Unpopular</option>
        <option value="very-unpopular">Extremely unpopular</option>
      </select>
    </div>
    <span class="controls-divider"></span>
    <label class="check" for="hide-unopped">
      <input type="checkbox" id="hide-unopped" checked />
      Exclude unopposed
    </label>
  </div>

  <div class="chart-frame">
    <div id="chart"></div>
  </div>

  <div class="stats" id="stats"></div>

</div>

Some notes on reading it:

- **Share is computed across party lines.** Each candidate's votes are divided by the total votes cast for that office in that ward, so the shares for a given office in a ward sum to 100% (barring write-ins).
- **Unopposed candidates** are excluded by default so they don't dominate the axes; toggle the checkbox to include them.
- **Ballot propositions** are shown as their Yes/No options, so you can see both how many people voted on a measure and which way they leaned.

Source data is the ward-by-ward election results file (`election_data.csv`) bundled with this page.

<link rel="stylesheet" href="/election/style.css?v=10">
<script src="/election/vendor/plotly.min.js"></script>
<script src="/election/app.js?v=10"></script>
