const POSITION_ORDER = [1, 2, 3, 4];
const POSITION_CLASS = { 1: "gk", 2: "def", 3: "mid", 4: "fwd" };
const PHOTO_BASE_SM = "https://resources.premierleague.com/premierleague/photos/players/110x140";
const PHOTO_BASE_LG = "https://resources.premierleague.com/premierleague/photos/players/250x250";
const SHIRT_BASE = "https://fantasy.premierleague.com/dist/img/shirts/standard";

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

    const imgSrc = bigPhoto || shirtFallback;
    const imgFallback = bigPhoto ? shirtFallback : "";

    return `
        <div class="player-details">
            <img class="player-photo-lg" src="${imgSrc}" alt="" ${imgFallback ? `data-fallback="${imgFallback}"` : ""}>
            <div class="player-details-body">
                <div class="player-full-name">${player.first_name} ${player.second_name}</div>
                <div class="player-details-meta">${team ? team.name : "?"} · ${pos ? pos.singular_name : ""}</div>
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
    return `
        <div class="player-row" data-player-id="${player.id}">
            <img class="player-photo" src="${imgSrc}" alt="" loading="lazy" ${imgFallback ? `data-fallback="${imgFallback}"` : ""}>
            <div class="player-info">
                <span class="player-name">${player.web_name}</span>
                <span class="player-team">${team ? team.short_name : "?"} · ${positionsById.get(player.element_type)?.singular_name_short ?? ""}</span>
            </div>
            <span class="player-points">${player.total_points}</span>
        </div>
    `;
}

function renderTeamCard(entry, ownedPlayers, standing, teamsById, positionsById) {
    const byPosition = new Map();
    for (const pid of POSITION_ORDER) byPosition.set(pid, []);
    for (const p of ownedPlayers) {
        if (byPosition.has(p.element_type)) byPosition.get(p.element_type).push(p);
    }
    for (const [, list] of byPosition) {
        list.sort((a, b) => a.web_name.localeCompare(b.web_name));
    }

    const rankBadge = standing
        ? `<span class="team-rank">#${standing.rank} · ${standing.total} pts</span>`
        : `<span class="team-rank">pre-season</span>`;

    const groups = POSITION_ORDER.map(pid => {
        const players = byPosition.get(pid);
        if (!players.length) return "";
        const label = positionsById.get(pid)?.singular_name ?? "";
        return `
            <div class="position-group">
                <div class="position-label ${POSITION_CLASS[pid]}">${label} (${players.length})</div>
                ${players.map(p => renderPlayer(p, teamsById, positionsById)).join("")}
            </div>
        `;
    }).join("");

    return `
        <article class="team-card">
            <div class="team-header">
                <div>
                    <h2>${entry.entry_name}</h2>
                    <div class="team-manager">${entry.player_first_name} ${entry.player_last_name}</div>
                </div>
                ${rankBadge}
            </div>
            ${groups || `<p class="loading">No players drafted yet.</p>`}
        </article>
    `;
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
    // Delegated handler: on <img> error, swap to data-fallback (once).
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

async function main() {
    const container = document.getElementById("teams-container");
    try {
        const [details, elementStatus, bootstrap] = await Promise.all([
            loadJSON("data/details.json"),
            loadJSON("data/element_status.json"),
            loadJSON("data/bootstrap.json"),
        ]);

        document.getElementById("league-name").textContent = details.league?.name ?? "FPL Draft League";
        const entryCount = details.league_entries?.length ?? 0;
        document.getElementById("league-meta").textContent = `${entryCount} teams · click a player for stats`;

        const playersById = new Map(bootstrap.elements.map(p => [p.id, p]));
        const teamsById = new Map(bootstrap.teams.map(t => [t.id, t]));
        const positionsById = new Map(bootstrap.element_types.map(t => [t.id, t]));

        // element_status.owner matches league_entries[].entry_id, not .id
        const ownedByEntry = new Map();
        for (const entry of details.league_entries) ownedByEntry.set(entry.entry_id, []);
        for (const row of elementStatus.element_status) {
            if (row.owner && ownedByEntry.has(row.owner)) {
                const player = playersById.get(row.element);
                if (player) ownedByEntry.get(row.owner).push(player);
            }
        }

        // standings key on league_entries[].id
        const standingByEntry = new Map(
            (details.standings ?? []).map(s => [s.league_entry, s])
        );

        const sortedEntries = [...details.league_entries].sort((a, b) => {
            const ra = standingByEntry.get(a.id)?.rank ?? 999;
            const rb = standingByEntry.get(b.id)?.rank ?? 999;
            return ra - rb;
        });

        container.innerHTML = sortedEntries
            .map(entry => renderTeamCard(
                entry,
                ownedByEntry.get(entry.entry_id) ?? [],
                standingByEntry.get(entry.id),
                teamsById,
                positionsById,
            ))
            .join("");

        const modal = setupModal(playersById, teamsById, positionsById);
        setupPhotoFallbacks(document.body);

        container.addEventListener("click", (e) => {
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
