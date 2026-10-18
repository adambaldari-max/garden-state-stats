# Garden State Academy Stats — Weekly workflow

Production: https://mlsnextacademystats.com
Cloudflare Pages project: `mlsnextacademydivision`

## Safety rules
- The default branch `index.html` is the authoritative production baseline.
- Do not replace verified historical scores without a source-backed correction.
- Maintain separate U13 and U14 match and player records.
- FootyAccess `goals` are MLS NEXT totals, **not** verified conference-only goals.
- Do not infer missing conference scorers.
- Keep the site self-contained: final deliverable is one `index.html`.
- Preserve styling, tabs, team profiles, AB7 Spotlight, Match Center, comparisons and Instagram graphic download.

## Weekly cycle
1. Save a dated copy of the last published `index.html`.
2. Obtain official MLS NEXT results/fixtures for U13 and U14 and FootyAccess age-group player totals; save source URLs, access dates and any screenshots/exports.
3. Match incoming fixtures by official `event_id`. If missing, reconcile date, age, home and away clubs manually before assigning a persistent identity.
4. Review new games, corrections, postponements, unknown clubs, duplicated player identities and scorer conflicts. Unverified items stay flagged; never guess.
5. Apply approved data updates on a review branch. Keep `DATA_U13` and `DATA_U14` in the single HTML.
6. Run `node scripts/weekly-audit.mjs index.html archive/previous-index.html > weekly-report.json`. The audit is read-only and exits nonzero for validation errors.
7. Independently review standings math (3 points per win, 1 per draw; site ranks by PPM), AB7 statistics, and U13/U14 comparisons.
8. Browser-test both age groups: navigation tabs, Golden Boot filtering, team profiles, results, head-to-head, club comparisons and 1080×1350 Instagram downloads.
9. Produce a change report, explicitly noting unresolved source discrepancies and verified corrections.
10. Publish only after approval; archive the exact HTML and change report, then verify the Cloudflare deployment.

## Audit scope
The initial audit checks match IDs, teams, final scores, player identities, FootyAccess totals, and compares match and player changes across snapshots. It does **not** fetch external league data, prove source accuracy, fully test UI behavior, or automatically publish.

## Baseline — 2026-10-18
| | U13 | U14 |
|---|---:|---:|
| Clubs | 15 | 15 |
| Fixtures | 180 | 180 |
| Completed | 33 | 35 |
| Player records | 417 | 451 |

These are counts extracted from the production GitHub HTML, not independent official league confirmations.
