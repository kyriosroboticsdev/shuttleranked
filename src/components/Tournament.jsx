import { useState } from "react";
import { doc, setDoc, deleteDoc, addDoc, updateDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

// ── Score entry modal (mirrors the doubles flow in NotificationPopup) ──
function TournamentScoreModal({ matchObj, onSubmit, onClose }) {
  const [sets, setSets] = useState([{ w: "", l: "" }]);
  const valid = sets.length > 0 && sets.every(s => s.w !== "" && s.l !== "");

  const overlay = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.55)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
  };
  const card = {
    background: "var(--bg-card)", borderRadius: 16, padding: "1.5rem",
    width: "100%", maxWidth: 400, border: "1px solid var(--border)",
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 11, color: "var(--text-hint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>Tournament match</div>
        <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>
          {teamLabel(matchObj.a)} vs {teamLabel(matchObj.b)}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: "1rem" }}>
          Enter score — winner's points on the left
        </div>
        {sets.map((s, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input type="number" placeholder="Winner" value={s.w}
              onChange={e => { const n = [...sets]; n[i] = { ...n[i], w: e.target.value }; setSets(n); }}
              style={{ textAlign: "center", padding: "8px", borderRadius: 6, border: "1px solid var(--border-mid)", background: "var(--bg)", color: "var(--text)", fontSize: 14 }} />
            <span style={{ fontSize: 12, color: "var(--text-hint)", textAlign: "center" }}>Set {i + 1}</span>
            <input type="number" placeholder="Loser" value={s.l}
              onChange={e => { const n = [...sets]; n[i] = { ...n[i], l: e.target.value }; setSets(n); }}
              style={{ textAlign: "center", padding: "8px", borderRadius: 6, border: "1px solid var(--border-mid)", background: "var(--bg)", color: "var(--text)", fontSize: 14 }} />
          </div>
        ))}
        <button onClick={() => setSets([...sets, { w: "", l: "" }])}
          style={{ fontSize: 12, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", marginBottom: "1rem" }}>
          + Add set
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: "10px 16px", fontSize: 14, border: "none", borderRadius: 8, cursor: "pointer", background: "var(--bg-secondary)", color: "var(--text)" }}>
            Cancel
          </button>
          <button
            onClick={() => onSubmit(sets.map(s => ({ w: parseInt(s.w), l: parseInt(s.l) })))}
            disabled={!valid}
            style={{ flex: 1, padding: "10px 16px", fontSize: 14, fontWeight: 500, border: "none", borderRadius: 8, cursor: valid ? "pointer" : "not-allowed", background: valid ? "var(--text)" : "var(--border-mid)", color: valid ? "var(--bg)" : "var(--text-hint)" }}>
            Submit & advance
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tier assignment ──
function assignTiers(players) {
  const sorted = [...players].sort((a, b) => b.doublesElo - a.doublesElo);
  const n = sorted.length;
  const base = Math.floor(n / 4);
  const rem = n % 4;
  const sizes = [base + (rem > 0 ? 1 : 0), base + (rem > 1 ? 1 : 0), base + (rem > 2 ? 1 : 0), base];
  const result = [];
  let idx = 0;
  ["S", "A", "B", "C"].forEach((tier, ti) => {
    for (let i = 0; i < sizes[ti]; i++) {
      if (sorted[idx]) result.push({ ...sorted[idx], tier, subrank: i + 1 });
      idx++;
    }
  });
  return result;
}

// ── Auto pairing ──
function autoPair(players) {
  const sorted = [...players].sort((a, b) => b.doublesElo - a.doublesElo);
  const n = sorted.length;
  return Array.from({ length: Math.floor(n / 2) }, (_, i) => ({
    id: i + 1,
    players: [sorted[i], sorted[n - 1 - i]],
    avgElo: Math.round((sorted[i].doublesElo + sorted[n - 1 - i].doublesElo) / 2),
  }));
}

// ── Bracket builder ──
function nextPow2(n) { let p = 1; while (p < n) p *= 2; return p; }

function buildBracket(teams) {
  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const size = nextPow2(shuffled.length);
  const seeded = [...shuffled];
  while (seeded.length < size) seeded.push(null);
  const rounds = [];
  let current = seeded.reduce((acc, _, i, arr) => {
    if (i % 2 === 0) acc.push({ a: arr[i], b: arr[i + 1] ?? null, winner: null });
    return acc;
  }, []);
  rounds.push(current);
  while (current.length > 1) {
    const next = Array.from({ length: Math.floor(current.length / 2) }, () => ({ a: null, b: null, winner: null }));
    rounds.push(next);
    current = next;
  }
  // Only resolve BYEs in round 0 — don't cascade further
  // A BYE match (one team, no opponent) auto-advances that team into round 1
  rounds[0].forEach((m, mi) => {
    if (m.a && !m.b) {
      m.winner = m.a;
      const next = rounds[1]?.[Math.floor(mi / 2)];
      if (next) { if (mi % 2 === 0) next.a = m.a; else next.b = m.a; }
    } else if (m.b && !m.a) {
      m.winner = m.b;
      const next = rounds[1]?.[Math.floor(mi / 2)];
      if (next) { if (mi % 2 === 0) next.a = m.b; else next.b = m.b; }
    }
  });
  return rounds;
}

// ── Firestore serialization (no nested arrays allowed) ──
function serializeBracket(rounds) {
  return rounds.map((matches, ri) => ({
    roundIndex: ri,
    matches: matches.map((m, mi) => ({
      matchIndex: mi,
      a: m.a ?? null,
      b: m.b ?? null,
      winner: m.winner ?? null,
    })),
  }));
}

function deserializeBracket(serialized) {
  if (!serialized) return [];
  return serialized.map(round =>
    round.matches.map(m => ({
      a: m.a ?? null,
      b: m.b ?? null,
      winner: m.winner ?? null,
    }))
  );
}

// ── Helpers ──
function teamLabel(t) {
  if (!t) return "BYE";
  return `${t.players[0].name.split(" ")[0]} & ${t.players[1].name.split(" ")[0]}`;
}

function roundLabels(bracketLength) {
  if (bracketLength === 1) return ["Final"];
  if (bracketLength === 2) return ["Semifinal", "Final"];
  if (bracketLength === 3) return ["Quarterfinal", "Semifinal", "Final"];
  return Array.from({ length: bracketLength }, (_, i) =>
    i === bracketLength - 1 ? "Final" : i === bracketLength - 2 ? "Semifinal" : `Round ${i + 1}`
  );
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

  function setSlot(ti, slot, playerId) {
    const player = playerId ? players.find(p => p.id === playerId) : null;
    setTeams(prev => {
      const next = prev.map(t => ({ ...t, players: [...t.players] }));
      next.forEach(t => { t.players = t.players.map(p => p?.id === playerId ? null : p); });
      next[ti].players[slot] = player;
      return next;
    });
  }

  const allFilled = teams.length >= 2 && teams.every(t => t.players[0] && t.players[1]);
  const available = players.filter(p => !usedIds.has(p.id));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)" }}>Manual team builder</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Assign two players to each team</div>
        </div>
        <button onClick={onBack} style={{ fontSize: 12, padding: "6px 14px", border: "1px solid var(--border-mid)", borderRadius: 8, background: "transparent", color: "var(--text)", cursor: "pointer" }}>Back</button>
      </div>

      {available.length > 0 && (
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
          <div style={{ fontSize: 11, color: "var(--text-hint)", marginBottom: 6 }}>Unassigned</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {available.map(p => (
              <span key={p.id} style={{ fontSize: 12, padding: "3px 10px", background: "var(--bg-card)", border: "1px solid var(--border-mid)", borderRadius: 20, color: "var(--text)" }}>{p.name}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: "1rem" }}>
        {teams.map((team, ti) => (
          <div key={team.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
              <span style={{ fontSize: 12, color: "var(--text-hint)" }}>Team {team.id}</span>
              {teams.length > 2 && (
                <button onClick={() => setTeams(prev => prev.filter((_, i) => i !== ti).map((t, i) => ({ ...t, id: i + 1 })))}
                  style={{ fontSize: 11, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                  Remove
                </button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center" }}>
              {[0, 1].map((slot, si) => (
                <>
                  <select key={slot} value={team.players[slot]?.id || ""} onChange={e => setSlot(ti, slot, e.target.value)}>
                    <option value="">Select player</option>
                    {players.filter(p => !usedIds.has(p.id) || team.players[slot]?.id === p.id).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {si === 0 && <span style={{ fontSize: 12, color: "var(--text-hint)", textAlign: "center" }}>&</span>}
                </>
              ))}
            </div>
            {team.players[0] && team.players[1] && (
              <div style={{ fontSize: 11, color: "var(--text-hint)", marginTop: 6, textAlign: "right" }}>
                avg {Math.round((team.players[0].doublesElo + team.players[1].doublesElo) / 2)} ELO
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setTeams(prev => [...prev, { id: prev.length + 1, players: [null, null] }])}
          style={{ padding: "10px 16px", fontSize: 13, border: "1px solid var(--border-mid)", borderRadius: 8, background: "transparent", color: "var(--text)", cursor: "pointer" }}>
          + Add team
        </button>
        <button
          onClick={() => onDone(teams.map((t, i) => ({ id: i + 1, players: t.players, avgElo: Math.round((t.players[0].doublesElo + t.players[1].doublesElo) / 2) })))}
          disabled={!allFilled}
          style={{ flex: 1, padding: 10, fontSize: 14, fontWeight: 500, border: "none", borderRadius: 8, cursor: allFilled ? "pointer" : "not-allowed", background: allFilled ? "var(--text)" : "var(--border-mid)", color: allFilled ? "var(--bg)" : "var(--text-hint)" }}>
          Confirm teams
        </button>
      </div>
    </div>
  );
}

// ── Live bracket view ──
function LiveBracket({ tournament, canAdvance, onMatchClick, onArchive }) {
  const bracket = deserializeBracket(tournament.bracket);
  const { winner: champion } = tournament;
  if (!bracket?.length) return null;
  const labels = roundLabels(bracket.length);

  return (
    <div>
      {champion && (
        <div style={{ textAlign: "center", padding: "1.5rem", background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border)", marginBottom: "1rem" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
          <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text)" }}>Champions: {teamLabel(champion)}</div>
          <div style={{ fontSize: 13, color: "var(--text-hint)", marginTop: 4 }}>{champion.players.map(p => p.name).join(" & ")}</div>
          {canAdvance && (
            <button onClick={onArchive} style={{ marginTop: "1rem", padding: "8px 20px", fontSize: 13, fontWeight: 500, background: "var(--text)", color: "var(--bg)", border: "none", borderRadius: 8, cursor: "pointer" }}>
              Archive tournament
            </button>
          )}
        </div>
      )}

      <div style={{ overflowX: "auto", paddingBottom: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "stretch", minWidth: "max-content" }}>
          {bracket.map((matches, ri) => (
            <div key={ri} style={{ display: "flex", alignItems: "stretch" }}>
              <div style={{ minWidth: 190 }}>
                <div style={{ fontSize: 11, color: "var(--text-hint)", textAlign: "center", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{labels[ri]}</div>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", height: "calc(100% - 24px)" }}>
                  {matches.map((m, mi) => {
                    const clickable = canAdvance && !m.winner && m.a && m.b;
                    return (
                      <div key={mi}
                        onClick={() => clickable && onMatchClick(ri, mi, m)}
                        style={{
                          margin: "6px 8px",
                          border: ri === bracket.length - 1 ? "1.5px solid #EF9F27" : "1px solid var(--border)",
                          borderRadius: 8, overflow: "hidden", background: "var(--bg-card)",
                          cursor: clickable ? "pointer" : "default",
                          transition: "box-shadow 0.12s",
                          boxShadow: clickable ? undefined : "none",
                        }}
                        onMouseEnter={e => { if (clickable) e.currentTarget.style.boxShadow = "0 0 0 2px #185FA5"; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}
                      >
                        {[{ team: m.a, side: "a" }, { team: m.b, side: "b" }].map(({ team, side }, ti) => {
                          const isWinner = m.winner != null && team != null && m.winner.id === team.id;
                          return (
                          <div key={side} style={{
                            padding: "8px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 6,
                            borderTop: ti > 0 ? "1px solid var(--border)" : "none",
                            background: isWinner ? "var(--bg-secondary)" : "var(--bg-card)",
                            fontWeight: isWinner ? 500 : 400,
                            color: "var(--text)",
                          }}>
                            <span style={{ fontSize: 10, color: "var(--text-hint)", minWidth: 14 }}>{ri === 0 ? mi * 2 + ti + 1 : ""}</span>
                            <span>{team ? teamLabel(team) : "TBD"}</span>
                            {isWinner && <span style={{ marginLeft: "auto", fontSize: 10, color: "#22c55e" }}>✓</span>}
                          </div>
                          );
                        })}
                        {clickable && (
                          <div style={{ padding: "4px 10px", fontSize: 10, color: "var(--text-hint)", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)", textAlign: "center" }}>
                            Tap to enter score
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {ri < bracket.length - 1 && (
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", width: 16 }}>
                  {matches.filter((_, i) => i % 2 === 0).map((_, i) => (
                    <div key={i} style={{ flex: 1, borderRight: "1px solid var(--border-mid)", borderTop: "1px solid var(--border-mid)", borderBottom: "1px solid var(--border-mid)", borderRadius: "0 4px 4px 0", margin: "18px 0" }} />
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

// ── Main Tournament component ──
export default function Tournament({ players, currentUid, isAdmin, activeTournament, groupId }) {
  const [setupStep, setSetupStep] = useState("select");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [pairingMode, setPairingMode] = useState("auto");
  const [teams, setTeams] = useState([]);
  const [saving, setSaving] = useState(false);

  const ranked = assignTiers(players);
  const sorted = [...players].sort((a, b) => b.doublesElo - a.doublesElo);
  const n = selectedIds.size;
  const canProceed = n >= 4 && n % 2 === 0;

  // Tracks which match is open for score entry: { roundIdx, matchIdx, matchObj }
  const [scoringMatch, setScoringMatch] = useState(null);

  async function handleAdvance(roundIdx, matchIdx, sets) {
  if (!activeTournament) return;
  const rounds = deserializeBracket(activeTournament.bracket);
  const match = rounds[roundIdx][matchIdx];
  if (match.winner || !match.a || !match.b) return;

  // Determine winner from sets
  const teamAWins = sets.filter(s => s.w > s.l).length;
  const teamBWins = sets.filter(s => s.l > s.w).length;
  const winner = teamAWins >= teamBWins ? match.a : match.b;
  const loser  = teamAWins >= teamBWins ? match.b : match.a;
  match.winner = winner;

  // Place winner into next round slot
  const nextRoundIdx = roundIdx + 1;
  if (nextRoundIdx < rounds.length) {
    const nextMatch = rounds[nextRoundIdx][Math.floor(matchIdx / 2)];
    if (matchIdx % 2 === 0) nextMatch.a = winner;
    else nextMatch.b = winner;

    // Only cascade a BYE in the very next match — one step only
    // This handles cases like a 6-team bracket where round 2 might have a bye
    if (nextMatch.a && !nextMatch.b) {
      nextMatch.winner = nextMatch.a;
      const nnIdx = nextRoundIdx + 1;
      if (nnIdx < rounds.length) {
        const nnMatch = rounds[nnIdx][Math.floor(Math.floor(matchIdx / 2) / 2)];
        if (Math.floor(matchIdx / 2) % 2 === 0) nnMatch.a = nextMatch.a;
        else nnMatch.b = nextMatch.a;
      }
    } else if (nextMatch.b && !nextMatch.a) {
      nextMatch.winner = nextMatch.b;
      const nnIdx = nextRoundIdx + 1;
      if (nnIdx < rounds.length) {
        const nnMatch = rounds[nnIdx][Math.floor(Math.floor(matchIdx / 2) / 2)];
        if (Math.floor(matchIdx / 2) % 2 === 0) nnMatch.a = nextMatch.b;
        else nnMatch.b = nextMatch.b;
      }
    }
  }

  // Only crown champion if ALL matches in the final round have a winner
  const finalRound = rounds[rounds.length - 1];
  const allFinalsDone = finalRound.every(m => m.winner !== null);
  const champion = allFinalsDone ? finalRound[0].winner : null;
  const isFinal = !!champion;

  // Update bracket in Firestore
  await setDoc(doc(db, "groups", groupId, "tournaments", "active"), {
    ...activeTournament,
    bracket: serializeBracket(rounds),
    ...(isFinal ? { winner: champion, status: "finished" } : {}),
  });

  // ELO updates (best effort)
  try {
    const winnerAvg = winner.players.reduce((s, p) => s + (p.doublesElo ?? 1000), 0) / winner.players.length;
    const loserAvg  = loser.players.reduce((s, p)  => s + (p.doublesElo ?? 1000), 0) / loser.players.length;
    const exp = 1 / (1 + Math.pow(10, (loserAvg - winnerAvg) / 400));
    const change = Math.max(Math.round(32 * (1 - exp)), 4);

    await Promise.all([...winner.players, ...loser.players].map(p =>
      addDoc(collection(db, "groups", groupId, "players", p.id, "eloHistory"), {
        singlesElo: p.singlesElo ?? 1000,
        doublesElo: p.doublesElo ?? 1000,
        timestamp: serverTimestamp(),
      })
    ));

    await Promise.all([
      ...winner.players.map(p =>
        updateDoc(doc(db, "groups", groupId, "players", p.id), {
          doublesElo: (p.doublesElo ?? 1000) + change,
          wins: (p.wins ?? 0) + 1,
        })
      ),
      ...loser.players.map(p =>
        updateDoc(doc(db, "groups", groupId, "players", p.id), {
          doublesElo: Math.max((p.doublesElo ?? 1000) - change, 800),
          losses: (p.losses ?? 0) + 1,
        })
      ),
    ]);
  } catch (e) {
    console.error("Tournament ELO update failed:", e);
  }
}

  async function handleArchive() {
    if (!activeTournament) return;
    setSaving(true);
    try {
      const archiveData = {
        status: "finished",
        createdBy: activeTournament.createdBy ?? null,
        createdAt: activeTournament.createdAt ?? null,
        participants: activeTournament.participants ?? [],
        finishedAt: serverTimestamp(),
        teams: (activeTournament.teams ?? []).map(t => ({
          id: t.id,
          avgElo: t.avgElo ?? 0,
          playerNames: t.players.map(p => p.name),
          playerIds: t.players.map(p => p.id),
        })),
        bracketSummary: (activeTournament.bracket ?? []).map(round => ({
          roundIndex: round.roundIndex,
          matches: round.matches.map(m => ({
            matchIndex: m.matchIndex,
            teamA: m.a ? m.a.players.map(p => p.name).join(" & ") : null,
            teamB: m.b ? m.b.players.map(p => p.name).join(" & ") : null,
            winner: m.winner ? m.winner.players.map(p => p.name).join(" & ") : null,
          })),
        })),
        winner: activeTournament.winner ? {
          playerNames: activeTournament.winner.players.map(p => p.name),
          playerIds: activeTournament.winner.players.map(p => p.id),
          avgElo: activeTournament.winner.avgElo ?? 0,
        } : null,
      };
      await addDoc(collection(db, "groups", groupId, "tournaments", "history", "entries"), archiveData);
      await deleteDoc(doc(db, "groups", groupId, "tournaments", "active"));
    } catch (e) {
      console.error("Archive failed:", e);
      await deleteDoc(doc(db, "groups", groupId, "tournaments", "active"));
    }
    setSaving(false);
  }

  async function handleLaunch(finalTeams) {
    setSaving(true);
    const bracket = buildBracket(finalTeams);
    const participantIds = finalTeams.flatMap(t => t.players.map(p => p.id));
    await setDoc(doc(db, "groups", groupId, "tournaments", "active"), {
      status: "active",
      createdBy: currentUid,
      createdAt: serverTimestamp(),
      participants: participantIds,
      teams: finalTeams,
      bracket: serializeBracket(bracket),
      winner: null,
    });
    setSaving(false);
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Active tournament view ──
  if (activeTournament) {
    const isCreator = activeTournament.createdBy === currentUid || isAdmin;
    const isFinished = activeTournament.status === "finished";

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)" }}>
              {isFinished ? "Tournament finished" : "Live tournament"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {isFinished
                ? "Champion decided — archive to start a new one"
                : isCreator ? "Click a team to advance them" : "Watching live — updates in real time"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {isFinished && isCreator && (
              <button
                onClick={handleArchive}
                disabled={saving}
                style={{ fontSize: 13, padding: "8px 18px", fontWeight: 500, border: "none", borderRadius: 8, background: saving ? "var(--border-mid)" : "var(--text)", color: saving ? "var(--text-hint)" : "var(--bg)", cursor: saving ? "not-allowed" : "pointer" }}>
                {saving ? "Archiving..." : "Archive & continue →"}
              </button>
            )}
            {!isFinished && isCreator && (
              <button
                onClick={async () => {
                  if (window.confirm("Cancel the current tournament?")) {
                    await deleteDoc(doc(db, "groups", groupId, "tournaments", "active"));
                  }
                }}
                style={{ fontSize: 12, padding: "6px 14px", border: "1px solid #A32D2D", borderRadius: 8, background: "transparent", color: "#A32D2D", cursor: "pointer" }}>
                Cancel
              </button>
            )}
          </div>
        </div>

        <LiveBracket
          tournament={activeTournament}
          canAdvance={isCreator && !isFinished}
          onMatchClick={(ri, mi, m) => setScoringMatch({ roundIdx: ri, matchIdx: mi, matchObj: m })}
          onArchive={handleArchive}
        />
        {scoringMatch && (
          <TournamentScoreModal
            matchObj={scoringMatch.matchObj}
            onClose={() => setScoringMatch(null)}
            onSubmit={async sets => {
              setScoringMatch(null);
              await handleAdvance(scoringMatch.roundIdx, scoringMatch.matchIdx, sets);
            }}
          />
        )}
        {saving && (
          <div style={{ textAlign: "center", padding: "1rem", color: "var(--text-secondary)", fontSize: 13 }}>
            Archiving tournament...
          </div>
        )}
      </div>
    );
  }

  // ── Setup flow ──
  if (setupStep === "select") return (
    <div style={{ background: "var(--bg-secondary)", borderRadius: 12, padding: "1.25rem", border: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)" }}>Start a tournament</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Select available players — even number (4+)</div>
        </div>
        <span style={{ fontSize: 13, color: "var(--text-hint)" }}>{n} selected</span>
      </div>

      <div style={{ display: "flex", gap: 4, background: "var(--bg)", borderRadius: 8, padding: 4, marginBottom: "1rem" }}>
        {[["auto", "Auto pair"], ["manual", "Manual pair"]].map(([val, label]) => (
          <button key={val} onClick={() => setPairingMode(val)} style={{
            flex: 1, padding: "7px 8px", fontSize: 13, borderRadius: 6, cursor: "pointer",
            border: pairingMode === val ? "1px solid var(--border-mid)" : "none",
            background: pairingMode === val ? "var(--bg-card)" : "transparent",
            fontWeight: pairingMode === val ? 500 : 400, color: "var(--text)",
          }}>{label}</button>
        ))}
      </div>

      <div style={{ fontSize: 12, color: "var(--text-secondary)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", marginBottom: "1rem" }}>
        {pairingMode === "auto" ? "Highest + lowest ranked players paired automatically." : "You'll assign players to teams on the next screen."}
      </div>

      {n > 0 && n % 2 !== 0 && (
        <div style={{ fontSize: 12, color: "#b45309", background: "#fefce8", padding: "8px 12px", borderRadius: 8, marginBottom: 10 }}>
          Select an even number of players.
        </div>
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
              border: sel ? "1.5px solid #185FA5" : "1px solid var(--border)",
              borderRadius: 8, background: sel ? "#1a2e40" : "var(--bg-card)", cursor: "pointer",
            }}>
              <div style={{ fontSize: 12, color: "var(--text-hint)", width: 20, textAlign: "center" }}>{i + 1}</div>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
                {p.name?.split(" ").map(w => w[0]).join("")}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-hint)" }}>{p.doublesElo} doubles ELO</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, padding: "3px 8px", borderRadius: 20, ...chipStyle[tier] }}>{tier}{sub}</span>
              <div style={{ width: 20, height: 20, borderRadius: "50%", border: sel ? "none" : "1.5px solid var(--border-mid)", background: sel ? "#185FA5" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff" }}>
                {sel ? "✓" : ""}
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={() => {
        if (pairingMode === "auto") {
          setTeams(autoPair(players.filter(p => selectedIds.has(p.id))));
          setSetupStep("teams");
        } else {
          setSetupStep("manual");
        }
      }} disabled={!canProceed} style={{
        width: "100%", padding: 10, fontSize: 14, fontWeight: 500, marginTop: "1rem",
        background: canProceed ? "var(--text)" : "var(--border-mid)",
        color: canProceed ? "var(--bg)" : "var(--text-hint)",
        border: "none", borderRadius: 8, cursor: canProceed ? "pointer" : "not-allowed",
      }}>
        {pairingMode === "auto" ? `Auto pair (${Math.floor(n / 2)} teams)` : "Manually assign teams →"}
      </button>
    </div>
  );

  if (setupStep === "manual") {
    const sel = players.filter(p => selectedIds.has(p.id));
    return (
      <ManualPairing
        players={sel}
        onBack={() => setSetupStep("select")}
        onDone={t => { setTeams(t); setSetupStep("teams"); }}
      />
    );
  }

  if (setupStep === "teams") return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)" }}>Teams</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{pairingMode === "auto" ? "Auto-paired by rank" : "Manually assigned"}</div>
        </div>
        <button onClick={() => setSetupStep(pairingMode === "manual" ? "manual" : "select")} style={{ fontSize: 12, padding: "6px 14px", border: "1px solid var(--border-mid)", borderRadius: 8, background: "transparent", color: "var(--text)", cursor: "pointer" }}>Back</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: "1rem" }}>
        {teams.map(t => (
          <div key={t.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-hint)", marginBottom: "0.6rem" }}>
              <span>Team {t.id}</span><span>avg {t.avgElo} ELO</span>
            </div>
            {t.players.map((p, i) => {
              const rp = ranked.find(r => r.id === p.id);
              const tier = rp?.tier ?? "C";
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500, color: "var(--text)" }}>
                    {p.name?.split(" ").map(w => w[0]).join("")}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{p.name}</div>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 6px", borderRadius: 20, ...chipStyle[tier] }}>{tier}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <button
        onClick={() => handleLaunch(teams)}
        disabled={saving}
        style={{ width: "100%", padding: 10, fontSize: 14, fontWeight: 500, background: saving ? "var(--border-mid)" : "var(--text)", color: saving ? "var(--text-hint)" : "var(--bg)", border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer" }}>
        {saving ? "Launching..." : "Launch tournament 🏸"}
      </button>
    </div>
  );

  return null;
}
