const POSITION_ORDER = [1, 2, 3, 4];
const POSITION_CLASS = { 1: "gk", 2: "def", 3: "mid", 4: "fwd" };
const PHOTO_BASE_SM = "https://resources.premierleague.com/premierleague/photos/players/110x140";
const PHOTO_BASE_LG = "https://resources.premierleague.com/premierleague/photos/players/250x250";
const SHIRT_BASE = "https://fantasy.premierleague.com/dist/img/shirts/standard";
const AUDIO_LOOP_SECONDS = 45;

async function loadJSON(path) {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`${path}: HTTP ${resp.status}`);
    return resp.json();
}

function photoURL(player, base) {
    if (!player.code) return null;
    return `${base}/p${player.code}.png`;
}

function shirtURL(team, isGK, size = 110) {
    if (!team) return "";
    const suffix = isGK ? "_1" : "";
    return `${SHIRT_BASE}/shirt_${team.code}${suffix}-${size}.png`;
}

function trophySVG(kind) {
    // kind: "gold" | "silver" | "bronze"
    return `<svg class="trophy trophy-${kind}" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3h10v2h4v3a5 5 0 0 1-4.6 4.98A6 6 0 0 1 13 16.9V19h4v2H7v-2h4v-2.1a6 6 0 0 1-3.4-3.92A5 5 0 0 1 3 8V5h4V3zm12 4v1a3 3 0 0 0 2-2.83V7h-2zM3 7v1.17A3 3 0 0 0 5 8V7H3z" fill="currentColor"/>
    </svg>`;
}

function statRow(label, value) {
    const v = (value === null || value === undefined || value === "") ? "—" : value;
    return `<div class="stat"><span class="stat-label">${label}</span><span class="stat-value">${v}</span></div>`;
}

function renderPlayerDetails(player, teamsById, positionsById) {
    const team = teamsById.get(player.team);
    const pos = positionsById.get(player.element_type);
    const isGK = player.element_type === 1;
    const bigPhoto = photoURL(player, PHOTO_BASE_LG);
    const shirtFallback = shirtURL(team, isGK, 110);
    const imgSrc = bigPhoto || shirtFallback;
    const imgFallback = bigPhoto ? shirtFallback : "";

    const news = player.news
        ? `<div class="player-news">${player.news}</div>`
        : "";

    const summary = [
        statRow("Points", player.total_points),
        statRow("PPG", player.points_per_game),
        statRow("Form", player.form),
        statRow("Minutes", player.minutes),
        statRow("Starts", player.starts),
        statRow("Draft rank", player.draft_rank),
    ].join("");

    const attack = [
        statRow("Goals", player.goals_scored),
        statRow("Assists", player.assists),
        statRow("xG", player.expected_goals),
        statRow("xA", player.expected_assists),
    ].join("");

    const defense = [
        statRow("Clean sheets", player.clean_sheets),
        statRow("Goals conc.", player.goals_conceded),
        isGK ? statRow("Saves", player.saves) : "",
        isGK ? statRow("Pens saved", player.penalties_saved) : "",
        statRow("Yellow", player.yellow_cards),
        statRow("Red", player.red_cards),
    ].filter(Boolean).join("");

    const underlying = [
        statRow("Bonus", player.bonus),
        statRow("BPS", player.bps),
        statRow("ICT", player.ict_index),
        statRow("Influence", player.influence),
        statRow("Creativity", player.creativity),
        statRow("Threat", player.threat),
    ].join("");

    const shirtNum = player.squad_number != null ? ` · #${player.squad_number}` : "";

    return `
        <div class="player-details">
            <img class="player-photo-lg" src="${imgSrc}" alt="" ${imgFallback ? `data-fallback="${imgFallback}"` : ""}>
            <div class="player-details-body">
                <div class="player-full-name">${player.first_name} ${player.second_name}</div>
                <div class="player-details-meta">${team ? team.name : "?"} · ${pos ? pos.singular_name : ""}${shirtNum}</div>
                ${news}
                <div class="stat-section"><h4>Summary</h4><div class="stat-grid">${summary}</div></div>
                <div class="stat-section"><h4>Attack</h4><div class="stat-grid">${attack}</div></div>
                <div class="stat-section"><h4>Defense</h4><div class="stat-grid">${defense}</div></div>
                <div class="stat-section"><h4>Underlying</h4><div class="stat-grid">${underlying}</div></div>
            </div>
        </div>
    `;
}

function renderPlayer(player, teamsById, positionsById) {
    const team = teamsById.get(player.team);
    const isGK = player.element_type === 1;
    const smallPhoto = photoURL(player, PHOTO_BASE_SM);
    const shirtFallback = shirtURL(team, isGK, 66);
    const imgSrc = smallPhoto || shirtFallback;
    const imgFallback = smallPhoto ? shirtFallback : "";
    const shirtNum = player.squad_number != null ? ` · #${player.squad_number}` : "";
    return `
        <div class="player-row" data-player-id="${player.id}">
            <img class="player-photo" src="${imgSrc}" alt="" loading="lazy" ${imgFallback ? `data-fallback="${imgFallback}"` : ""}>
            <div class="player-info">
                <span class="player-name">${player.web_name}</span>
                <span class="player-team">${team ? team.short_name : "?"} · ${positionsById.get(player.element_type)?.singular_name_short ?? ""}${shirtNum}</span>
            </div>
            <span class="player-points">${player.total_points}</span>
        </div>
    `;
}

function renderTeamCard(entry, rank, medal, ownedPlayers, gwPoints, seasonTotal, teamsById, positionsById) {
    const byPosition = new Map();
    for (const pid of POSITION_ORDER) byPosition.set(pid, []);
    for (const p of ownedPlayers) {
        if (byPosition.has(p.element_type)) byPosition.get(p.element_type).push(p);
    }
    for (const [, list] of byPosition) {
        list.sort((a, b) => a.web_name.localeCompare(b.web_name));
    }

    const gwLabel = (gwPoints !== null && gwPoints !== undefined) ? `GW: ${gwPoints} pts` : "";

    const groups = POSITION_ORDER.map(pid => {
        const players = byPosition.get(pid);
        if (!players.length) return "";
        const label = positionsById.get(pid)?.singular_name ?? "";
        return `
            <div class="position-group">
                <div class="position-label ${POSITION_CLASS[pid]}">${label} <span class="pos-count">${players.length}</span></div>
                ${players.map(p => renderPlayer(p, teamsById, positionsById)).join("")}
            </div>
        `;
    }).join("");

    const medalHTML = medal ? trophySVG(medal) : "";

    return `
        <article class="team-card" data-entry-id="${entry.entry_id}">
            <button class="team-toggle" type="button" aria-expanded="false">
                <span class="rank-badge">${rank}</span>
                <div class="team-name-block">
                    <h2>${entry.entry_name}${medalHTML}</h2>
                    <span class="manager">${entry.player_first_name} ${entry.player_last_name}</span>
                </div>
                <div class="points-block">
                    ${gwLabel ? `<span class="gw-pts">${gwLabel}</span>` : ""}
                    <span class="total-pts">Total: ${seasonTotal} pts</span>
                </div>
                <span class="chevron" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16"><path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
            </button>
            <div class="roster-wrap">
                <div class="roster-inner">
                    ${groups || `<p class="empty">No players drafted yet.</p>`}
                </div>
            </div>
        </article>
    `;
}

function renderRankedRow(player, metric, teamsById, positionsById, subtext = "") {
    const team = teamsById.get(player.team);
    const pos = positionsById.get(player.element_type);
    const isGK = player.element_type === 1;
    const smallPhoto = photoURL(player, PHOTO_BASE_SM);
    const shirtFallback = shirtURL(team, isGK, 66);
    const imgSrc = smallPhoto || shirtFallback;
    const imgFallback = smallPhoto ? shirtFallback : "";
    const subtextHTML = subtext ? `<span class="player-owner">${subtext}</span>` : "";
    const shirtNum = player.squad_number != null ? ` · #${player.squad_number}` : "";
    return `
        <div class="player-row best-row" data-player-id="${player.id}">
            <span class="best-metric">${metric}</span>
            <img class="player-photo" src="${imgSrc}" alt="" loading="lazy" ${imgFallback ? `data-fallback="${imgFallback}"` : ""}>
            <div class="player-info">
                <span class="player-name">${player.web_name}</span>
                <span class="player-team">${team ? team.short_name : "?"} · ${pos ? pos.singular_name_short : ""}${shirtNum}</span>
                ${subtextHTML}
            </div>
        </div>
    `;
}

function topN(players, keyFn, n = 10, ascending = false) {
    const scored = players
        .map(p => ({ p, k: keyFn(p) }))
        .filter(x => x.k != null);
    scored.sort((a, b) => ascending ? a.k - b.k : b.k - a.k);
    return scored.slice(0, n).map(x => x.p);
}

function setupPanel(rootEl, modes, defaultMode, teamsById, positionsById) {
    // modes: { modeKey: { players: [...], formatMetric: (p) => string, getSubtext?: (p) => string } }
    const list = rootEl.querySelector(".best-list");
    const buttons = rootEl.querySelectorAll(".mode-btn");

    function render(mode) {
        const { players, formatMetric, getSubtext } = modes[mode];
        list.innerHTML = players
            .map(p => renderRankedRow(
                p,
                formatMetric(p),
                teamsById,
                positionsById,
                getSubtext ? getSubtext(p) : "",
            ))
            .join("");
    }

    buttons.forEach(btn => {
        btn.addEventListener("click", () => {
            const mode = btn.dataset.mode;
            buttons.forEach(b => {
                const active = b === btn;
                b.classList.toggle("active", active);
                b.setAttribute("aria-selected", active ? "true" : "false");
            });
            render(mode);
        });
    });

    render(defaultMode);
}

function setupModal(playersById, teamsById, positionsById) {
    const modal = document.getElementById("player-modal");
    const body = modal.querySelector(".modal-body");

    function open(playerId) {
        const player = playersById.get(playerId);
        if (!player) return;
        body.innerHTML = renderPlayerDetails(player, teamsById, positionsById);
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    function close() {
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    modal.addEventListener("click", (e) => {
        if (e.target.matches("[data-close]")) close();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && modal.classList.contains("open")) close();
    });

    return { open, close };
}

function setupPhotoFallbacks(root) {
    root.addEventListener("error", (e) => {
        const img = e.target;
        if (img.tagName !== "IMG") return;
        const fb = img.dataset.fallback;
        if (fb) {
            img.removeAttribute("data-fallback");
            img.src = fb;
        }
    }, true);
}

function setupCollapse(container) {
    container.addEventListener("click", (e) => {
        const toggle = e.target.closest(".team-toggle");
        if (!toggle) return;
        const card = toggle.closest(".team-card");
        const expanded = card.classList.toggle("expanded");
        toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
}

function formatTimeAgo(date) {
    const secs = Math.floor((Date.now() - date.getTime()) / 1000);
    if (secs < 60) return "just now";
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    return date.toISOString().slice(0, 10);
}

async function setupLastRefresh() {
    const el = document.getElementById("last-refresh");
    if (!el) return;
    try {
        const resp = await fetch("data/last_refresh.txt", { cache: "no-store" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const iso = (await resp.text()).trim();
        const d = new Date(iso);
        if (isNaN(d)) throw new Error("bad timestamp");
        el.textContent = `Last refreshed ${formatTimeAgo(d)}`;
        el.title = d.toUTCString();
    } catch {
        el.textContent = "Last refresh unknown";
    }
}

function setupAudio() {
    const audio = document.getElementById("bg-audio");
    const button = document.getElementById("audio-toggle");
    if (!audio || !button) return;

    audio.loop = true;
    // Loop only the first 45 seconds
    audio.addEventListener("timeupdate", () => {
        if (audio.currentTime >= AUDIO_LOOP_SECONDS) audio.currentTime = 0;
    });

    const savedMuted = localStorage.getItem("audio-muted") === "true";
    audio.muted = savedMuted;
    updateButton();

    function updateButton() {
        button.classList.toggle("is-muted", audio.muted);
        button.setAttribute("aria-pressed", audio.muted ? "true" : "false");
    }

    function tryPlay() {
        audio.play().catch(() => {
            // Autoplay blocked — start on first user interaction
            const start = () => {
                audio.play().catch(() => {});
                document.removeEventListener("click", start);
                document.removeEventListener("keydown", start);
            };
            document.addEventListener("click", start, { once: true });
            document.addEventListener("keydown", start, { once: true });
        });
    }
    tryPlay();

    button.addEventListener("click", (e) => {
        e.stopPropagation();
        audio.muted = !audio.muted;
        localStorage.setItem("audio-muted", audio.muted);
        updateButton();
        if (!audio.muted && audio.paused) tryPlay();
    });
}

function computeMedals(gwByEntryId) {
    // Return Map<league_entry_id, "gold"|"silver"|"bronze"> based on current GW points.
    // Only assigned when at least one team has > 0.
    const withPoints = [...gwByEntryId.entries()]
        .filter(([, pts]) => (pts ?? 0) > 0)
        .sort((a, b) => b[1] - a[1]);
    const medals = new Map();
    const tiers = ["gold", "silver", "bronze"];
    for (let i = 0; i < Math.min(3, withPoints.length); i++) {
        medals.set(withPoints[i][0], tiers[i]);
    }
    return medals;
}

async function main() {
    const container = document.getElementById("teams-container");
    try {
        const [details, elementStatus, bootstrap] = await Promise.all([
            loadJSON("data/details.json"),
            loadJSON("data/element_status.json"),
            loadJSON("data/bootstrap.json"),
        ]);
        // Optional: per-team picks for the current gameweek. Absent pre-season.
        const picksData = await loadJSON("data/picks.json").catch(() => null);
        // Optional: shirt numbers sourced from the Premier League Pulse API,
        // keyed by FPL element `code`. FPL's own `squad_number` is always null.
        const jerseys = await loadJSON("data/jersey_numbers.json").catch(() => null);
        if (jerseys) {
            for (const p of bootstrap.elements) {
                const n = jerseys[p.code];
                if (n != null) p.squad_number = n;
            }
        }

        document.getElementById("league-name").textContent = details.league?.name ?? "FPL Draft League";
        const entryCount = details.league_entries?.length ?? 0;
        document.getElementById("league-meta").textContent = `${entryCount} teams · tap a card to expand`;

        const playersById = new Map(bootstrap.elements.map(p => [p.id, p]));
        const teamsById = new Map(bootstrap.teams.map(t => [t.id, t]));
        const positionsById = new Map(bootstrap.element_types.map(t => [t.id, t]));

        const ownedByEntry = new Map();
        for (const entry of details.league_entries) ownedByEntry.set(entry.entry_id, []);
        for (const row of elementStatus.element_status) {
            if (row.owner && ownedByEntry.has(row.owner)) {
                const player = playersById.get(row.element);
                if (player) ownedByEntry.get(row.owner).push(player);
            }
        }

        const standingByEntry = new Map(
            (details.standings ?? []).map(s => [s.league_entry, s])
        );

        // Provisional GW points: sum of starters' event_points from the picks endpoint.
        // The league standings API only publishes event_total after the GW settles, so
        // we compute it live here to avoid the pre-settlement "0 pts" display.
        // Keyed by league_entry.id (the same key standings uses).
        const provisionalGwByEntryId = new Map();
        if (picksData && picksData.picks) {
            for (const entry of details.league_entries) {
                const picks = picksData.picks[String(entry.entry_id)];
                if (!picks) continue;
                let gw = 0;
                for (const pick of picks) {
                    if (pick.position > 11) continue;
                    const p = playersById.get(pick.element);
                    if (p) gw += p.event_points ?? 0;
                }
                provisionalGwByEntryId.set(entry.id, gw);
            }
        }

        // Once the API rolls the GW into standings.total, adding provisional would double-count.
        // The `finished` flag lags behind the roll-up, so use the presence of any non-zero
        // event_total as the settlement signal (a whole-league zero GW is essentially impossible).
        const gwSettled = (details.standings ?? []).some(s => (s.event_total ?? 0) > 0);

        // Unified per-entry GW points for display + medals: prefer API's settled event_total,
        // fall back to our provisional sum while the GW is live.
        const gwPointsByEntryId = new Map();
        if (gwSettled) {
            for (const s of details.standings ?? []) {
                gwPointsByEntryId.set(s.league_entry, s.event_total ?? 0);
            }
        } else {
            for (const [k, v] of provisionalGwByEntryId) gwPointsByEntryId.set(k, v);
        }

        // Season total: when settled, standings.total already includes the GW.
        // While live, add provisional so the number stays current.
        const seasonTotalFor = (entryLeagueId) => {
            const base = standingByEntry.get(entryLeagueId)?.total ?? 0;
            if (gwSettled) return base;
            return base + (provisionalGwByEntryId.get(entryLeagueId) ?? 0);
        };

        // league_entries[].id is the key used by standings; league_entries[].entry_id is used by ownership.
        // Sort by running season total desc, then by team name for stable ties.
        const sortedEntries = [...details.league_entries].sort((a, b) => {
            const ta = seasonTotalFor(a.id);
            const tb = seasonTotalFor(b.id);
            if (tb !== ta) return tb - ta;
            return a.entry_name.localeCompare(b.entry_name);
        });

        // Medals go to the current gameweek's top scorers.
        const medals = computeMedals(gwPointsByEntryId);

        // Standard competition ranking (1224): tied totals share a rank; next rank skips.
        const rankByEntryId = new Map();
        let currentRank = 0;
        let prevTotal = null;
        sortedEntries.forEach((entry, i) => {
            const total = seasonTotalFor(entry.id);
            if (total !== prevTotal) {
                currentRank = i + 1;
                prevTotal = total;
            }
            rankByEntryId.set(entry.id, currentRank);
        });

        container.innerHTML = sortedEntries
            .map(entry => renderTeamCard(
                entry,
                rankByEntryId.get(entry.id),
                medals.get(entry.id),
                ownedByEntry.get(entry.entry_id) ?? [],
                gwPointsByEntryId.get(entry.id),
                seasonTotalFor(entry.id),
                teamsById,
                positionsById,
            ))
            .join("");

        const unpickedPlayers = elementStatus.element_status
            .filter(r => r.owner === null)
            .map(r => playersById.get(r.element))
            .filter(Boolean);
        const ownedPlayers = elementStatus.element_status
            .filter(r => r.owner !== null)
            .map(r => playersById.get(r.element))
            .filter(Boolean);

        // player_id -> owning fantasy team name
        const entryByEntryId = new Map(details.league_entries.map(e => [e.entry_id, e]));
        const ownerNameByPlayerId = new Map();
        for (const row of elementStatus.element_status) {
            if (row.owner && entryByEntryId.has(row.owner)) {
                ownerNameByPlayerId.set(row.element, entryByEntryId.get(row.owner).entry_name);
            }
        }
        const getOwner = p => ownerNameByPlayerId.get(p.id) ?? "";

        setupPanel(
            document.getElementById("panel-scorers"),
            {
                gw: {
                    players: topN(ownedPlayers, p => p.event_points ?? 0),
                    formatMetric: p => `${p.event_points ?? 0}`,
                    getSubtext: getOwner,
                },
                total: {
                    players: topN(ownedPlayers, p => p.total_points ?? 0),
                    formatMetric: p => `${p.total_points ?? 0}`,
                    getSubtext: getOwner,
                },
            },
            "gw",
            teamsById,
            positionsById,
        );

        setupPanel(
            document.getElementById("panel-available"),
            {
                draft: {
                    players: topN(unpickedPlayers, p => p.draft_rank, 10, true),
                    formatMetric: p => `#${p.draft_rank ?? "—"}`,
                },
                points: {
                    players: topN(unpickedPlayers, p => p.total_points ?? 0),
                    formatMetric: p => `${p.total_points ?? 0}`,
                },
            },
            "draft",
            teamsById,
            positionsById,
        );

        const modal = setupModal(playersById, teamsById, positionsById);
        setupPhotoFallbacks(document.body);
        setupCollapse(container);
        setupAudio();
        setupLastRefresh();

        // Delegate player-row clicks across both roster and sidebar.
        document.querySelector(".layout").addEventListener("click", (e) => {
            const row = e.target.closest(".player-row");
            if (!row) return;
            const id = Number(row.dataset.playerId);
            modal.open(id);
        });
    } catch (err) {
        container.innerHTML = `<p class="error">Failed to load data: ${err.message}<br>Run <code>python fetch_data.py</code> first.</p>`;
        console.error(err);
    }
}

main();
