"""Fetch FPL draft data locally so the browser can read it without CORS issues."""
import json
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

LEAGUE_ID = 24629
DATA_DIR = Path(__file__).parent / "data"

ENDPOINTS = {
    "details.json": f"https://draft.premierleague.com/api/league/{LEAGUE_ID}/details",
    "element_status.json": f"https://draft.premierleague.com/api/league/{LEAGUE_ID}/element-status",
    "bootstrap.json": "https://draft.premierleague.com/api/bootstrap-static",
}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "fpl-draft-viewer/0.1"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    for filename, url in ENDPOINTS.items():
        print(f"GET {url}")
        (DATA_DIR / filename).write_text(json.dumps(fetch(url), indent=2))
        print(f"  wrote data/{filename}")

    # Live per-team picks for the current gameweek. Lets the UI compute
    # provisional points instead of waiting for the GW to settle (the
    # league standings endpoint only publishes event_total after the GW ends).
    bootstrap = json.loads((DATA_DIR / "bootstrap.json").read_text())
    details = json.loads((DATA_DIR / "details.json").read_text())
    current_event = bootstrap.get("events", {}).get("current")
    picks_path = DATA_DIR / "picks.json"
    if current_event:
        picks = {}
        for entry in details.get("league_entries", []):
            entry_id = entry["entry_id"]
            url = f"https://draft.premierleague.com/api/entry/{entry_id}/event/{current_event}"
            print(f"GET {url}")
            try:
                data = fetch(url)
                picks[str(entry_id)] = data.get("picks", [])
            except Exception as exc:
                print(f"  failed: {exc}")
            time.sleep(0.15)
        picks_path.write_text(json.dumps({"event": current_event, "picks": picks}, indent=2))
        print(f"  wrote data/picks.json (event {current_event}, {len(picks)} teams)")
    elif picks_path.exists():
        picks_path.unlink()
        print("  removed stale data/picks.json (no live gameweek)")

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    (DATA_DIR / "last_refresh.txt").write_text(stamp + "\n")
    print(f"  wrote data/last_refresh.txt ({stamp})")


if __name__ == "__main__":
    main()
