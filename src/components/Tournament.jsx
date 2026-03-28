import { useState } from "react";

function assignTiers(players) {
  const sorted = [...players].sort((a, b) => b.doublesElo - a.doublesElo);
  const n = sorted.length;
  const base = Math.floor(n / 4);
  const remainder = n % 4;
  const sizes = [
    base + (remainder > 0 ? 1 : 0),
    base + (remainder > 1 ? 1 : 0),
    base + (remainder > 2 ? 1 : 0),
    base,
  ];
  const tierNames = ["S", "A", "B", "C"];
  const result = [];
  let idx = 0;
  tierNames.forEach((tier, ti) => {
    for (let i = 0; i < sizes[ti]; i++) {
      if (sorted[idx]) result.push({ ...sorted[idx], tier, subrank: i + 1 });
      idx++;
    }
  });
  return result;
}

function autoPair(players) {
  const sorted = [...players].sort((a, b) => b.doublesElo - a.doublesElo);
  const teams = [];
  const n = sorted.length;
  for (let i = 0; i < Math.floor(n / 2); i++) {
    teams.push({
      id: i + 1,
      players: [sorted[i], sorted[n - 1 - i]],
      avgElo: Math.round((sorted[i].doublesElo + sorted[n - 1 - i].doublesElo) / 2),
    });
  }
  return teams;
}

function nextPow2(n) { let p = 1; while (p < n) p *= 2; return p; }

function buildBracket(teams) {
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const size = nextPow2(shuffled.length);
  const seeded = [...shuffled];
  while (seeded.length < size) seeded.push(null);
  const rounds = [];
  let current = [];
  for (let i = 0; i < size; i += 2) current.push({ a: seeded[i], b: seeded[i + 1], winner: null });
  rounds.push(current);
  while (current.length > 1) {
    const next = [];
    for (let i = 0; i < current.length; i += 2) next.push({ a: null, b: null, winner: null });
    rounds.push(next);
    current = next;
  }
  rounds[0].forEach(m => {
    if (m.a && !m.b) m.winner = m.a;
    if (m.b && !m.a) m.winner = m.b;
  });
  return rounds;
}

function teamLabel(t) {
  if (!t) return "BYE";
  return `${t.players[0].name.split(" ")[0]} & ${t.players[1].name.split(" ")[0]}`;
}

const chipStyle = {
  S: { background: "#FAEEDA", color: "#633806" },
  A: { background: "#E6F1FB", color: "#0C447C" },
  B: { background: "#EAF3DE", color: "#27500A" },
  C: { background: "#F1EFE8", color: "#5F5E5A" },
};

// ── Manual pairing UI ──
function ManualPairing({ players, onDone, onBack }) {
  const [teams, setTeams] = useState([{ id: 1, players: [null, null] }]);

  const usedIds = new Set(teams.flatMap(t => t.players.filter(Boolean).map(p => p.id)));

  function setSlot(teamIdx, slot, playerId) {
    const player = playerId ? players.find(p => p.id === playerId) : null;
    setTeams(prev => {
      const next = prev.map(t => ({ ...t, players: [...t.players] }));
      // Remove this player from any other slot first
      next.forEach(t => { t.players = t.players.map(p => p?.id === playerId ? null : p); });
      next[teamIdx].players[slot] = player;
      return next;
    });
  }

  function addTeam() {
    setTeams(prev => [...prev, { id: prev.length + 1, players: [null, null] }]);
  }

  function removeTeam(idx) {
    setTeams(prev => prev.filter((_, i) => i !== idx).map((t, i) => ({ ...t, id: i + 1 })));
  }

  const allFilled = teams.length >= 2 && teams.every(t => t.players[0] && t.players[1]);

  const availablePlayers = players.filter(p => !usedIds.has(p.id));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Manual team builder</div>
          <div style={{ fontSize: 12, color: "#999" }}>Assign two players to each team</div>
        </div>
        <button onClick={onBack} style={{ fontSize: 12, padding: "6px 14px", border: "1px solid #ddd", borderRadius: 8, background: "transparent", cursor: "pointer" }}>Back</button>
      </div>

      {availablePlayers.length > 0 && (
        <div style={{ background: "#f9f9f9", border: "1px solid #eee", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
          <div style={{ fontSize: 11, color: "#999", marginBottom: 6 }}>Unassigned players</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {availablePlayers.map(p => (
              <span key={p.id} style={{ fontSize: 12, padding: "3px 10px", background: "#fff", border: "1px solid #ddd", borderRadius: 20 }}>{p.name}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: "1rem" }}>
        {teams.map((team, ti) => (
          <div key={team.id} style={{ background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
              <span style={{ fontSize: 12, color: "#999" }}>Team {team.id}</span>
              {teams.length > 2 && (
                <button onClick={() => removeTeam(ti)} style={{ fontSize: 11, color: "#999", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Remove</button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
              {[0, 1].map((slot, si) => (
                <>
                  <select
                    key={slot}
                    value={team.players[slot]?.id || ""}
                    onChange={e => setSlot(ti, slot, e.target.value)}
                    style={{ width: "100%", fontSize: 13, padding: "7px 8px", borderRadius: 8, border: "1px solid #ddd" }}
                  >
                    <option value="">Select player</option>
                    {players
                      .filter(p => !usedIds.has(p.id) || team.players[slot]?.id === p.id)
                      .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {si === 0 && <span style={{ fontSize: 12, color: "#999", textAlign: "center" }}>&</span>}
                </>
              ))}
            </div>
            {team.players[0] && team.players[1] && (
              <div style={{ fontSize: 11, color: "#999", marginTop: 6, textAlign: "right" }}>
                avg {Math.round((team.players[0].doublesElo + team.players[1].doublesElo) / 2)} ELO
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={addTeam} style={{ padding: "10px 16px", fontSize: 13, border: "1px solid #ddd", borderRadius: 8, background: "transparent", cursor: "pointer" }}>+ Add team</button>
        <button
          onClick={() => onDone(teams.map((t, i) => ({ id: i + 1, players: t.players, avgElo: Math.round((t.players[0].doublesElo + t.players[1].doublesElo) / 2) })))}
          disabled={!allFilled}
          style={{ flex: 1, padding: 10, fontSize: 14, fontWeight: 500, background: allFilled ? "#111" : "#ccc", color: "#fff", border: "none", borderRadius: 8, cursor: allFilled ? "pointer" : "not-allowed" }}
        >
          Confirm teams
        </button>
      </div>
    </div>
  );
}

// ── Main component ──
export default function Tournament({ players }) {
  const [step, setStep] = useState("select");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [pairingMode, setPairingMode] = useState("auto"); // auto | manual
  const [teams, setTeams] = useState([]);
  const [bracket, setBracket] = useState(null);

  const ranked = assignTiers(players);
  const sorted = [...players].sort((a, b) => b.doublesElo - a.doublesElo);
  const n = selectedIds.size;
  const canProceed = n >= 4 && n % 2 === 0;

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleProceed() {
    const sel = players.filter(p => selectedIds.has(p.id));
    if (pairingMode === "auto") {
      setTeams(autoPair(sel));
      setStep("teams");
    } else {
      setStep("manual");
    }
  }

  function advanceTeam(roundIdx, matchIdx, side) {
    setBracket(prev => {
      const rounds = prev.map(r => r.map(m => ({ ...m })));
      const match = rounds[roundIdx][matchIdx];
      if (match.winner) return rounds;
      const team = side === "a" ? match.a : match.b;
      if (!team) return rounds;
      match.winner = team;
      if (roundIdx + 1 < rounds.length) {
        const next = rounds[roundIdx + 1][Math.floor(matchIdx / 2)];
        if (matchIdx % 2 === 0) next.a = team;
        else next.b = team;
      }
      return rounds;
    });
  }

  // ── Step: select players ──
  if (step === "select") {
    return (
      <div style={{ background: "#f9f9f9", borderRadius: 12, padding: "1.25rem", border: "1px solid #eee" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>Doubles tournament</div>
            <div style={{ fontSize: 12, color: "#999" }}>Select available players — need an even number (4+)</div>
          </div>
          <span style={{ fontSize: 13, color: "#999" }}>{n} selected</span>
        </div>

        <div style={{ display: "flex", gap: 4, background: "#efefef", borderRadius: 8, padding: 4, marginBottom: "1rem" }}>
          {[["auto", "Auto pair"], ["manual", "Manual pair"]].map(([val, label]) => (
            <button key={val} onClick={() => setPairingMode(val)} style={{
              flex: 1, padding: "7px 8px", fontSize: 13, borderRadius: 6, cursor: "pointer",
              border: pairingMode === val ? "1px solid #ddd" : "none",
              background: pairingMode === val ? "#fff" : "transparent",
              fontWeight: pairingMode === val ? 500 : 400,
            }}>{label}</button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "#666", background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: "8px 12px", marginBottom: "1rem" }}>
          {pairingMode === "auto"
            ? "Highest + lowest ranked players will be paired automatically for balanced teams."
            : "You'll manually assign players to teams on the next screen."}
        </div>

        {n > 0 && n % 2 !== 0 && (
          <div style={{ fontSize: 12, color: "#b45309", background: "#fefce8", padding: "8px 12px", borderRadius: 8, marginBottom: 10 }}>Select an even number of players.</div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sorted.map((p, i) => {
            const rp = ranked.find(r => r.id === p.id);
            const tier = rp?.tier ?? "C";
            const sub = rp?.subrank ?? "";
            const sel = selectedIds.has(p.id);
            return (
              <div key={p.id} onClick={() => toggleSelect(p.id)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                border: sel ? "1.5px solid #185FA5" : "1px solid #eee",
                borderRadius: 8, background: sel ? "#E6F1FB" : "#fff", cursor: "pointer",
              }}>
                <div style={{ fontSize: 12, color: "#999", width: 20, textAlign: "center" }}>{i + 1}</div>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#eee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500 }}>
                  {p.name?.split(" ").map(w => w[0]).join("")}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "#999" }}>{p.doublesElo} doubles ELO</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, padding: "3px 8px", borderRadius: 20, ...chipStyle[tier] }}>{tier}{sub}</span>
                <div style={{ width: 20, height: 20, borderRadius: "50%", border: sel ? "none" : "1.5px solid #ddd", background: sel ? "#185FA5" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff" }}>{sel ? "✓" : ""}</div>
              </div>
            );
          })}
        </div>

        <button onClick={handleProceed} disabled={!canProceed} style={{
          width: "100%", padding: 10, fontSize: 14, fontWeight: 500,
          background: canProceed ? "#111" : "#ccc", color: "#fff",
          border: "none", borderRadius: 8, cursor: canProceed ? "pointer" : "not-allowed", marginTop: "1rem",
        }}>
          {pairingMode === "auto" ? `Auto pair (${Math.floor(n / 2)} teams)` : `Manually assign teams →`}
        </button>
      </div>
    );
  }

  // ── Step: manual pairing ──
  if (step === "manual") {
    const sel = players.filter(p => selectedIds.has(p.id));
    return (
      <ManualPairing
        players={sel}
        onBack={() => setStep("select")}
        onDone={t => { setTeams(t); setStep("teams"); }}
      />
    );
  }

  // ── Step: review teams ──
  if (step === "teams") return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Teams</div>
          <div style={{ fontSize: 12, color: "#999" }}>{pairingMode === "auto" ? "Auto-paired by rank" : "Manually assigned"}</div>
        </div>
        <button onClick={() => setStep(pairingMode === "manual" ? "manual" : "select")} style={{ fontSize: 12, padding: "6px 14px", border: "1px solid #ddd", borderRadius: 8, background: "transparent", cursor: "pointer" }}>Back</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: "1rem" }}>
        {teams.map(t => (
          <div key={t.id} style={{ background: "#fff", border: "1px solid #eee", borderRadius: 12, padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#999", marginBottom: "0.6rem" }}>
              <span>Team {t.id}</span>
              <span>avg {t.avgElo} ELO</span>
            </div>
            {t.players.map((p, i) => {
              const rp = ranked.find(r => r.id === p.id);
              const tier = rp?.tier ?? "C";
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: i > 0 ? "1px solid #f0f0f0" : "none" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#eee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500 }}>
                    {p.name?.split(" ").map(w => w[0]).join("")}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 6px", borderRadius: 20, ...chipStyle[tier] }}>{tier}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <button onClick={() => { setBracket(buildBracket(teams)); setStep("bracket"); }} style={{ width: "100%", padding: 10, fontSize: 14, fontWeight: 500, background: "#111", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
        Generate bracket
      </button>
    </div>
  );

  // ── Step: bracket ──
  if (step === "bracket" && bracket) {
    const labels = bracket.length === 1 ? ["Final"] : bracket.length === 2 ? ["Semifinal", "Final"] : bracket.length === 3 ? ["Quarterfinal", "Semifinal", "Final"] : bracket.map((_, i) => i === bracket.length - 1 ? "Final" : i === bracket.length - 2 ? "Semifinal" : `Round ${i + 1}`);
    const champion = bracket[bracket.length - 1][0].winner;
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>Tournament bracket</div>
            <div style={{ fontSize: 12, color: "#999" }}>Click a team to advance them</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setBracket(buildBracket(teams))} style={{ fontSize: 12, padding: "6px 14px", border: "1px solid #ddd", borderRadius: 8, background: "transparent", cursor: "pointer" }}>Reset</button>
            <button onClick={() => setStep("teams")} style={{ fontSize: 12, padding: "6px 14px", border: "1px solid #ddd", borderRadius: 8, background: "transparent", cursor: "pointer" }}>Back</button>
          </div>
        </div>
        {champion && (
          <div style={{ textAlign: "center", padding: "1.5rem", background: "#f9f9f9", borderRadius: 12, border: "1px solid #eee", marginBottom: "1rem" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
            <div style={{ fontSize: 17, fontWeight: 500 }}>Champions: {teamLabel(champion)}</div>
            <div style={{ fontSize: 13, color: "#999", marginTop: 4 }}>{champion.players.map(p => p.name).join(" & ")}</div>
          </div>
        )}
        <div style={{ overflowX: "auto", paddingBottom: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "stretch", minWidth: "max-content" }}>
            {bracket.map((matches, ri) => (
              <div key={ri} style={{ display: "flex", alignItems: "stretch" }}>
                <div style={{ minWidth: 190 }}>
                  <div style={{ fontSize: 11, color: "#999", textAlign: "center", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{labels[ri]}</div>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", height: "calc(100% - 24px)" }}>
                    {matches.map((m, mi) => (
                      <div key={mi} style={{ margin: "6px 8px", border: ri === bracket.length - 1 ? "1.5px solid #EF9F27" : "1px solid #eee", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                        {[{ team: m.a, side: "a" }, { team: m.b, side: "b" }].map(({ team, side }, ti) => (
                          <div key={side} onClick={() => !m.winner && team && advanceTeam(ri, mi, side)} style={{
                            padding: "8px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 6,
                            borderTop: ti > 0 ? "1px solid #eee" : "none",
                            background: m.winner === team && team ? "#f5f5f5" : "#fff",
                            fontWeight: m.winner === team && team ? 500 : 400,
                            cursor: !m.winner && team ? "pointer" : "default",
                          }}>
                            <span style={{ fontSize: 10, color: "#999", minWidth: 14 }}>{ri === 0 ? mi * 2 + ti + 1 : ""}</span>
                            <span>{team ? teamLabel(team) : "TBD"}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                {ri < bracket.length - 1 && (
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", width: 16 }}>
                    {matches.filter((_, i) => i % 2 === 0).map((_, i) => (
                      <div key={i} style={{ flex: 1, borderRight: "1px solid #ddd", borderTop: "1px solid #ddd", borderBottom: "1px solid #ddd", borderRadius: "0 4px 4px 0", margin: "18px 0" }} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}