# MLS NEXT Academy Division source discovery

Authoritative match scores and standings: https://www.mlssoccer.com/mlsnext/schedule/academy_division/

## Current status
The site renders its schedule dynamically. The underlying filtered endpoint and response schema have **not** been verified. Do not guess URLs, claim successful scraping, or substitute MLS first-team fixtures.

## Capture the real request (one time)
1. In Chrome or Edge, open the official Academy Division schedule.
2. Press F12 > Network. Choose Fetch/XHR, enable Preserve log, and clear the list.
3. Set the date range from 2026-09-01 through today and select U13.
4. Click the site's Apply/Search button if present. Identify the request whose response contains the U13 match fixtures and scores.
5. Right-click that request > Copy > Copy as cURL (bash), or use **Save all as HAR with content**. HAR/cURL can include login tokens and cookies: **do not upload or commit those secrets**. Instead share a sanitized request URL, HTTP method, nonsecret query/body filter parameters, and a redacted sample response.
6. Repeat for U14 and note whether the same endpoint supports a different age filter.
7. Confirm the exact Garden State Conference filter value and whether the page paginates.
8. Preserve the response's event IDs, match status, home/away names, date, scores, and official source URL.

## Collector acceptance criteria
- Only Academy Division U13 and U14 Garden State Conference matches.
- Full season-to-date window on each run (provisionally 2026-09-01 onward).
- Official scores and fixture identities only; no guessed scores.
- Pagination and date-range boundaries tested.
- Explicit errors on failed/empty fetches, changed response schema, duplicate IDs, or unknown clubs.
- Output conforms to `examples/source-snapshot.example.json` and is reviewed by `scripts/weekly-reconcile.mjs`.
- No automatic approvals, modifications to production HTML, or publishing.

## Notes
A plain HTTP page fetch is not sufficient to identify the filtered schedule data. A browser network trace from the actual filter interaction is needed before a reliable collector can be implemented.
