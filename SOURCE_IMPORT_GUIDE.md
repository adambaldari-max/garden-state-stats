# Weekly source reconciliation (staging only)

The source reconciliation script compares two age groups from a structured source snapshot with the authoritative production `index.html`. It **does not scrape MLS NEXT or FootyAccess**, verify source claims, edit HTML, or publish. The input file must be filled from official results/fixtures and age-filtered FootyAccess player records, with a source URL on every record.

## Commands (Node.js 20+)
```powershell
node scripts/weekly-reconcile.mjs index.html examples/source-snapshot.example.json output/reconciliation.json
```
Outputs:
- `output/reconciliation.json`: categorized new fixtures, changed matches, conflicts, unmatched player identities and unchanged event IDs for U13/U14.
- `output/reconciliation.proposed.json`: proposed edits, intentionally `approved:false` and `verified:false`. This is NOT ready to pass to the builder.

## Source snapshot fields
- `captured_at`: ISO timestamp.
- `ages.U13.matches` and `ages.U14.matches`: `event_id,date,home,away,completed,hs,as_,source_url` plus optional `source_name`.
- `ages.U13.players` and `ages.U14.players`: `player,audit_club,goals,source_url`. These are **FootyAccess MLS NEXT totals**, never conference-only goal totals.
- Use exact existing team and player names. Missing event IDs, new fixtures, ambiguous players and corrected completed scores are flagged for review rather than silently imported.

## Weekly review
1. Export/capture official MLS NEXT results and fixtures for both age groups, and FootyAccess player statistics; preserve URLs and dates.
2. Populate a copy of the snapshot JSON with the actual observations. Do not include hypothetical test scores.
3. Run reconciliation and inspect all conflicts, new events, and player identities.
4. Only after independent verification, mark specific proposed records `verified:true`, add a `correction_reason` for historical corrections, and set `approved:true` on the reviewed file.
5. Run `node scripts/weekly-build.mjs index.html reviewed-updates.json output/weekly-index.html`.
6. Run `node scripts/weekly-audit.mjs output/weekly-index.html index.html > output/weekly-audit.json`.
7. Test the generated HTML in a browser, including both age groups and Instagram downloads. Do not publish if unresolved critical errors exist.

## Important limitations
- No live MLS NEXT / FootyAccess collector has been implemented yet. Their public pages may need dynamic rendering, authenticated access, or export workflows. Never claim an automated feed exists without confirming it.
- The builder currently updates existing event IDs and existing uniquely identified players only. New fixtures and players remain manual reconciliation work.
- The audit validates structural consistency, not league-source accuracy or full browser behavior.
- Hardcoded site labels and player counts may require separate updates; do not assume the generated page automatically refreshes all descriptive text.
- Keep simulations isolated in `output/`; never use simulated results as source data.
