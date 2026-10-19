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

## Automation

`.github/workflows/footyaccess-collect.yml` runs Tuesday and Wednesday at
4:30 AM Eastern. It collects FootyAccess player statistics and, only if every
validation check passes, updates the player records inside `index.html`.
Run it manually from the **Actions** tab with **Run workflow**.

## Settings in `index.html`

- `CONTACT_EMAIL`: set to a public address to show the footer
  "Report a correction" link. Leave it empty to hide the link.
- `SITE_URL`: the address printed on the Instagram standings graphic.
