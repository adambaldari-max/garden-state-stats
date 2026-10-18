# Garden State Academy Stats — GitHub Pages

Independent, unofficial MLS NEXT Academy Division U13 Garden State Conference statistics dashboard.

## Included

- `index.html`: accessible responsive website with five tabs
- `style.css`: navy, white, gold design
- `app.js`: standings, player filters, AB7 and match archive
- `data/stats.json`: frozen snapshot based on official schedule and audited available Footy Access events, through Oct 16, 2026

## Publish with GitHub Pages

1. Create a new **public** GitHub repository, e.g. `garden-state-u13-stats`.
2. Upload the four files and the `data` folder, preserving paths. Commit them to the `main` branch.
3. Open the repository's **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, `main`, and `/ (root)`, then **Save**.
5. After deployment, open `https://YOUR-USERNAME.github.io/garden-state-u13-stats/` (replace YOUR-USERNAME with your actual username). Publication can take several minutes.

## Preview locally

In the extracted folder run `py -m http.server 8000` on Windows, then open `http://localhost:8000`. Do not double-click `index.html`: browsers can block local JSON loading.

## Update later

Replace `data/stats.json` with a newly generated and audited snapshot, commit, and GitHub Pages will republish. Do **not** edit goals manually without source evidence. A separate update script can later regenerate this file from official schedule and Footy Access exports.

## Data rules

- Official scores are used for the table and match archive.
- Golden Boot includes only source-attributed goals. Inferred team assignments, unresolved events, and own goals are excluded.
- The AB7 roster-matched standings are separately audited; one U12-listed player is noted.
- Player statistics are provisional and are not endorsed by MLS NEXT.
- No private youth player information is included.

## Disclaimer

Independent, unofficial statistical coverage. Not affiliated with or endorsed by MLS NEXT or its clubs.
