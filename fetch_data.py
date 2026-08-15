"""Fetch FPL draft data locally so the browser can read it without CORS issues."""
import json
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


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    for filename, url in ENDPOINTS.items():
        print(f"GET {url}")
        req = urllib.request.Request(url, headers={"User-Agent": "fpl-draft-viewer/0.1"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.load(resp)
        (DATA_DIR / filename).write_text(json.dumps(data, indent=2))
        print(f"  wrote data/{filename}")

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    (DATA_DIR / "last_refresh.txt").write_text(stamp + "\n")
    print(f"  wrote data/last_refresh.txt ({stamp})")


if __name__ == "__main__":
    main()
