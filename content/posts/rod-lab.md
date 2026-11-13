---
title: "Rod Lab — A Miquon-Inspired Math App"
date: 2026-11-13
description: "An interactive math app built around Cuisenaire-style rods: 34 worksheets plus one shared block workspace for equations, take-away, multiplication, division, and fractions."
tags: [math, education, interactive]
---

Rod Lab is a small math app built around Cuisenaire-style rods: each length has its own color, and everything the worksheets ask is built or solved with the same pieces. It pairs a set of worksheets with a free block workspace, and the two share the same manipulatives.

It's plain HTML, CSS, and JavaScript — no build step and no dependencies. Progress is saved in the browser's local storage, so there's no account and nothing to sync.

<div class="rod-lab-embed">
  <div class="rod-lab-bar">
    <span>Interactive — drag, tap, and type right in the frame.</span>
    <a class="rod-lab-open" href="/rod-lab/" target="_blank" rel="noopener">Open full screen ↗</a>
  </div>
  <iframe id="rod-lab-frame" class="rod-lab-frame" src="/rod-lab/" title="Rod Lab" loading="lazy"></iframe>
</div>

## What's in it

**Worksheets.** Five strands, 34 sheets, up to six questions each, getting harder from first to last. On a sheet the result shows `?` until the answer is checked; grown-ups can change that and other settings per sheet.

**The workspace.** Type an equation in the bar (numbers, spaces, `+ - x /`), or drag unit blocks out of the bin. The bar and the blocks stay in sync.

- Blocks that touch end to end form a group, colored by size. A hint appears only while a dragged piece is near another group's end.
- Hold a block for half a second, then pull, to split a rod. Tap a rod for Break into 1s, Move to take-away, and Put back.
- Groups in the take-away area on the right count as negative. Drag the divider to resize it. Negative results are allowed.
- The multiplication switch shows same-size groups as `2 × 3` wherever they sit.
- `17 / 5` switches to division: make groups of 5, and leftovers go to the Remainder tray (`3 R 2`).
- `3/4 x 8` switches to fractions: pick parts of a whole rod.

Undo with the button or Cmd/Ctrl+Z. Rods can also be moved with the arrow keys, and Enter opens their actions.

## Notes

Progress and sheet settings live in this browser only, and each sheet can be reset from its settings panel. The app is touch-friendly, so it works on a tablet as well as a laptop.

**License.** Rod Lab — the app, worksheets, and this post — is licensed under [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/). Share it, remix it, and build on it, with credit.

<link rel="stylesheet" href="/rod-lab/embed.css">

<script src="/rod-lab/embed.js"></script>
