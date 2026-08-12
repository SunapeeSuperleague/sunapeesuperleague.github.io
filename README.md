# FPL Draft Viewer

Local static site that displays team rosters for FPL draft league **24629**.

## How it works

The Premier League draft API blocks browser requests (CORS), so `fetch_data.py` pulls the three JSON payloads server-side and writes them to `data/`. The page then reads those local files.

## One-time setup

Requires Python 3 (already on macOS). No dependencies — uses the stdlib.

## Usage

```bash
# 1. Refresh data from the FPL API
python fetch_data.py

# 2. Serve the site (any static server works; the stdlib one is fine)
python -m http.server 8000

# 3. Open http://localhost:8000
```

Opening `index.html` directly via `file://` will not work — browsers block `fetch()` for local files. Always use a server.

## Endpoints used

| File | Endpoint |
| --- | --- |
| `data/details.json` | `https://draft.premierleague.com/api/league/24629/details` |
| `data/element_status.json` | `https://draft.premierleague.com/api/league/24629/element-status` |
| `data/bootstrap.json` | `https://draft.premierleague.com/api/bootstrap-static` |

`bootstrap.json` is what maps player IDs (the `element` field in `element_status`) to names, teams, positions, and photos.

## Files

- `fetch_data.py` — hits the three endpoints, writes JSON to `data/`
- `index.html` / `style.css` / `app.js` — the site
- `data/` — local cache; regenerate with `fetch_data.py`
- `footballbanner.png` — hero banner shown at the top
- `Eye Of The Tiger.mp3` — background loop (first 45 seconds); toggle with the button in the top-right

## Future

Once you're happy with the layout, this can be automated by having GitHub Actions run `fetch_data.py` on a cron and commit the refreshed `data/` files to a `gh-pages` branch.
