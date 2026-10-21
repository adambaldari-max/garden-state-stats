# Garden State Academy Stats

Independent standings, Golden Boot, team profiles and match results for the
MLS NEXT Academy Division **Garden State Conference** (U13 and U14), published at
https://mlsnextacademystats.com/ via GitHub Pages.

Not affiliated with, sponsored by, or endorsed by MLS NEXT or Major League Soccer.

## How the site is built

- **`index.html` is the whole site.** Styles, JavaScript and both data snapshots
  (`const DATA_U13=…` and `const DATA_U14=…`) are embedded in this one file.
  There are no other data files to keep in sync.
- Standings are calculated in the browser from the completed matches in each
  snapshot (3 points for a win, 1 for a draw, ranked by points per match).
- Golden Boot shows Garden State conference goals only (`conference_goals`).
  The `goals` field holds MLS NEXT-wide totals and is never displayed as a
  conference count.
- `og-image.png` and `favicon.svg` are the link-preview image and browser icon.
- `logos/` holds the 15 club crests (128×128 PNG, from the FootyAccess/Kitman team feed),
  named by club, e.g. `logos/tsf-academy.png`.
- Match objects may carry `kickoff` (Eastern local time, `YYYY-MM-DDTHH:MM`) and `venue`
  from FootyAccess fixtures. They are only filled when the FootyAccess date matches the
  schedule date; otherwise the site shows "Time TBA".

## All conferences

A **Conference** dropdown next to U13/U14 switches between all 20 MLS NEXT
Academy Division conferences. Garden State is the default and keeps its
hand-checked Golden Boot; other conferences show standings, results, team
profiles, Best Defense and Club View (no Golden Boot). A conference can be
linked directly, e.g. `?conference=northeast`.

Their data lives in `data/academy-u13.json` and `data/academy-u14.json`, loaded
only when someone picks another conference.

## Automation

`.github/workflows/official-update.yml` runs every night (about 4:15 AM Eastern)
and on Saturday/Sunday evenings. `scripts/official-update.mjs` downloads the
official MLS NEXT Academy Division schedule and standings feeds (the data behind
mlssoccer.com/mlsnext/standings/academy_division/), rewrites the two
`data/academy-*.json` files and refreshes the Garden State matches embedded in
`index.html` (scores, dates, kickoff times, fields). Player/Golden Boot data is
never touched by that step. If the feed looks incomplete the script stops without writing.

The same job then runs `scripts/golden-boot-update.mjs`, which rebuilds the Garden State
Golden Boot (U13 and U14) from the named goal events in each completed match's FootyAccess
match report. A match counts only when its goal events add up to the final score (own goals
credited to the benefiting team); others are listed as awaiting scorer details. If
FootyAccess can't be reached, the Golden Boot is left as it was.
Run it on demand from **Actions → Nightly official MLS NEXT update → Run workflow**.


`.github/workflows/footyaccess-collect.yml` runs Tuesday and Wednesday at
4:30 AM Eastern. It collects FootyAccess player statistics and, only if every
validation check passes, updates the player records inside `index.html`.
Run it manually from the **Actions** tab with **Run workflow**.

## Settings in `index.html`

- `CONTACT_EMAIL`: public contact address (currently contact@mlsnextacademystats.com),
  shown as the footer "Contact / corrections" link and in the About section.
  Leave it empty to hide both.
- `SITE_URL`: the address printed on the Instagram standings graphic.
