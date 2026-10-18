# Garden State Academy Stats — Professional Redesign

Independent, unofficial MLS NEXT Academy Division U13 Garden State Conference statistics site. Static GitHub Pages deployment; no backend required.

## Upload

1. Extract the ZIP.
2. In `https://github.com/adambaldari-max/garden-state-stats`, upload `index.html`, `style.css`, `app.js`, and the `data` folder **at the repository root**, replacing existing files.
3. Commit changes on `main`. GitHub Pages should deploy automatically.
4. Open `https://adambaldari-max.github.io/garden-state-stats/?v=pro-20261018` and hard refresh if needed.

## Important

- `data/stats.json` must remain inside the `data` directory.
- Standings are recalculated from completed match scores using 3/1/0 points and sorted by PPM, then GD, then GF. AB7 is first at 3.00 PPM.
- The 2026-10-16 data snapshot is preserved, not live-updated.
- Golden Boot data is provisional and excludes unresolved or inferred player-club attribution.
- No official MLS NEXT affiliation or endorsement is implied.

## Files

- `index.html`: page layout and content
- `style.css`: responsive visual styling
- `app.js`: tabs, standings calculation, filters, and match archive
- `data/stats.json`: source snapshot
