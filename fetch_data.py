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

PULSE_HEADERS = {
    "Origin": "https://www.premierleague.com",
    "Referer": "https://www.premierleague.com/",
}


def fetch(url, headers=None):
    hdrs = {"User-Agent": "fpl-draft-viewer/0.1"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, headers=hdrs)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def load_jersey_overrides():
    """Hand-maintained shirt-number corrections for Pulse data-quality quirks.

    Format: JSON array of {"code": <fpl element code>, "shirt": <number>, "name": <optional>}.
    `code` matches FPL's element.code (== Pulse Opta id numeric). Applied on top of
    the Pulse-derived map, so entries here always win.
    """
    path = DATA_DIR / "jersey_overrides.json"
    if not path.exists():
        return {}
    try:
        entries = json.loads(path.read_text())
    except Exception as exc:
        print(f"  jersey_overrides.json parse failed: {exc}")
        return {}
    result = {}
    for e in entries:
        try:
            result[int(e["code"])] = int(e["shirt"])
        except (KeyError, ValueError, TypeError):
            pass
    return result


def fetch_jersey_numbers():
    """Return {fpl_element_code: shirt_number} sourced from the Premier League Pulse API.

    FPL's own `squad_number` field is exposed but never populated. Pulse publishes
    shirt numbers, and each Pulse player's Opta id numeric equals FPL's `code`,
    giving us a clean join with no name matching required.
    """
    seasons = fetch(
        "https://footballapi.pulselive.com/football/competitions/1/compseasons?page=0&pageSize=5",
        headers=PULSE_HEADERS,
    )
    content = seasons.get("content") or []
    if not content:
        return {}
    season_id = int(content[0]["id"])
    print(f"GET pulse jerseys (season {season_id})")
    numbers = {}
    for page in range(20):
        url = (
            "https://footballapi.pulselive.com/football/players"
            f"?pageSize=100&compSeasons={season_id}&altIds=true&page={page}"
            "&type=player&compIds=1"
        )
        data = fetch(url, headers=PULSE_HEADERS)
        for p in data.get("content") or []:
            shirt = (p.get("info") or {}).get("shirtNum")
            opta = (p.get("altIds") or {}).get("opta") or ""
            if shirt is None or not opta.startswith("p"):
                continue
            try:
                numbers[int(opta[1:])] = int(shirt)
            except (ValueError, TypeError):
                pass
        info = data.get("pageInfo") or {}
        if page >= (info.get("numPages") or 0) - 1:
            break
        time.sleep(0.1)
    return numbers


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

    try:
        jerseys = fetch_jersey_numbers()
    except Exception as exc:
        print(f"  jersey fetch failed: {exc}")
        jerseys = {}
    overrides = load_jersey_overrides()
    if overrides:
        jerseys.update(overrides)
        print(f"  applied {len(overrides)} jersey override(s)")
    if jerseys:
        (DATA_DIR / "jersey_numbers.json").write_text(
            json.dumps({str(k): v for k, v in sorted(jerseys.items())}, indent=2)
        )
        print(f"  wrote data/jersey_numbers.json ({len(jerseys)} players)")

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    (DATA_DIR / "last_refresh.txt").write_text(stamp + "\n")
    print(f"  wrote data/last_refresh.txt ({stamp})")


if __name__ == "__main__":
    main()
