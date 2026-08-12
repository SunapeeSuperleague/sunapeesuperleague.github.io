const POSITION_ORDER = [1, 2, 3, 4];
const POSITION_CLASS = { 1: "gk", 2: "def", 3: "mid", 4: "fwd" };
const PHOTO_BASE = "https://resources.premierleague.com/premierleague/photos/players/110x140";

async function loadJSON(path) {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`${path}: HTTP ${resp.status}`);
    return resp.json();
}

function photoURL(player) {
    if (!player.code) return null;
    return `${PHOTO_BASE}/p${player.code}.png`;
}

function renderPlayer(player, teamsById, positionsById) {
    const team = teamsById.get(player.team);
    const url = photoURL(player);
    return `
        <div class="player">
            ${url ? `<img class="player-photo" src="${url}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : `<div class="player-photo"></div>`}
            <div class="player-info">
                <span class="player-name">${player.web_name}</span>
                <span class="player-team">${team ? team.short_name : "?"} · ${positionsById.get(player.element_type)?.singular_name_short ?? ""}</span>
            </div>
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
        document.getElementById("league-meta").textContent = `${entryCount} teams`;

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
    } catch (err) {
        container.innerHTML = `<p class="error">Failed to load data: ${err.message}<br>Run <code>python fetch_data.py</code> first.</p>`;
        console.error(err);
    }
}

main();
