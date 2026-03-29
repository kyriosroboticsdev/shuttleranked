import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";
import { db } from "../firebase";

function assignTiers(players) {
  const sorted = [...players].sort((a, b) => b.singlesElo - a.singlesElo);
  const n = sorted.length;
  const base = Math.floor(n / 4);
  const rem = n % 4;
  const sizes = [base+(rem>0?1:0), base+(rem>1?1:0), base+(rem>2?1:0), base];
  const result = [];
  let idx = 0;
  ["S","A","B","C"].forEach((tier, ti) => {
    for (let i = 0; i < sizes[ti]; i++) {
      if (sorted[idx]) result.push({ ...sorted[idx], tier, subrank: i+1 });
      idx++;
    }
  });
  return result;
}

const chipStyle = {
  S: { background: "#FAEEDA", color: "#633806" },
  A: { background: "#E6F1FB", color: "#0C447C" },
  B: { background: "#EAF3DE", color: "#27500A" },
  C: { background: "#F1EFE8", color: "#5F5E5A" },
};

function GroupStats({ players }) {
  const sorted = [...players].sort((a, b) => b.singlesElo - a.singlesElo);
  const byWins = [...players].sort((a, b) => (b.wins??0) - (a.wins??0));
  const byWinRate = [...players]
    .filter(p => (p.wins??0) + (p.losses??0) >= 3)
    .sort((a, b) => {
      const ra = (a.wins??0) / Math.max((a.wins??0)+(a.losses??0),1);
      const rb = (b.wins??0) / Math.max((b.wins??0)+(b.losses??0),1);
      return rb - ra;
    });

  const ranked = assignTiers(players);

  const statRow = (label, value, sub) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--text-hint)" }}>{sub}</div>}
      </div>
    </div>
  );

  const topRanked = ranked[0];
  const mostWins = byWins[0];
  const bestWinRate = byWinRate[0];
  const mostMatches = [...players].sort((a,b) => ((b.wins??0)+(b.losses??0)) - ((a.wins??0)+(a.losses??0)))[0];
  const totalMatches = players.reduce((s,p) => s + (p.wins??0), 0);

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "1rem" }}>
      {topRanked && statRow("Top ranked", topRanked.name, `${topRanked.tier}${topRanked.subrank} · ${topRanked.singlesElo} ELO`)}
      {mostWins && statRow("Most wins", mostWins.name, `${mostWins.wins ?? 0} wins`)}
      {bestWinRate && statRow("Best win rate", bestWinRate.name, `${Math.round((bestWinRate.wins??0)/Math.max((bestWinRate.wins??0)+(bestWinRate.losses??0),1)*100)}% (min 3 matches)`)}
      {mostMatches && statRow("Most active", mostMatches.name, `${(mostMatches.wins??0)+(mostMatches.losses??0)} matches played`)}
      {statRow("Total matches played", totalMatches, "across all players")}
      {statRow("Total players", players.length, "")}
    </div>
  );
}

function HeadToHead({ players, groupId }) {
  const [p1Id, setP1Id] = useState("");
  const [p2Id, setP2Id] = useState("");
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!p1Id || !p2Id) return;
    setLoading(true);
    const q = query(
      collection(db, "groups", groupId, "matchRequests"),
      where("status", "==", "confirmed"),
      where("players", "array-contains", p1Id),
    );
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => m.players.includes(p2Id));
      setMatches(all);
      setLoading(false);
    });
    return unsub;
  }, [p1Id, p2Id]);

  const p1 = players.find(p => p.id === p1Id);
  const p2 = players.find(p => p.id === p2Id);

  let p1wins = 0, p2wins = 0;
  matches.forEach(m => {
    if (!m.sets) return;
    const p1sets = m.sets.filter(s => s.w > s.l).length;
    const p2sets = m.sets.filter(s => s.l > s.w).length;
    // determine which side p1 was on
    const p1idx = m.players.indexOf(p1Id);
    const p1isWinner = (p1idx === 0 && p1sets >= p2sets) || (p1idx !== 0 && p2sets > p1sets);
    if (p1isWinner) p1wins++; else p2wins++;
  });

  const ranked = assignTiers(players);
  const getChip = uid => {
    const e = ranked.find(r => r.id === uid);
    return e ? { tier: e.tier, sub: e.subrank } : null;
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, alignItems: "center", marginBottom: "1rem" }}>
        <select value={p1Id} onChange={e => setP1Id(e.target.value)}>
          <option value="">Player 1</option>
          {players.filter(p => p.id !== p2Id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span style={{ fontSize: 13, color: "var(--text-hint)", textAlign: "center" }}>vs</span>
        <select value={p2Id} onChange={e => setP2Id(e.target.value)}>
          <option value="">Player 2</option>
          {players.filter(p => p.id !== p1Id).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {p1Id && p2Id && (
        <div>
          {/* record bar */}
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "1rem", marginBottom: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginBottom: "0.75rem" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 500, color: "var(--text)" }}>{p1wins}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{p1?.name?.split(" ")[0]}</div>
                {getChip(p1Id) && <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 6px", borderRadius: 20, ...chipStyle[getChip(p1Id).tier] }}>{getChip(p1Id).tier}{getChip(p1Id).sub}</span>}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-hint)", textAlign: "center" }}>
                {matches.length} match{matches.length !== 1 ? "es" : ""}
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 500, color: "var(--text)" }}>{p2wins}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{p2?.name?.split(" ")[0]}</div>
                {getChip(p2Id) && <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 6px", borderRadius: 20, ...chipStyle[getChip(p2Id).tier] }}>{getChip(p2Id).tier}{getChip(p2Id).sub}</span>}
              </div>
            </div>
            {matches.length > 0 && (
              <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ flex: p1wins, background: "#185FA5", transition: "flex 0.3s" }} />
                <div style={{ flex: p2wins, background: "#A32D2D", transition: "flex 0.3s" }} />
              </div>
            )}
          </div>

          {/* ELO gap */}
          {p1 && p2 && (
            <div style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: 13, color: "var(--text-secondary)" }}>
              Singles ELO gap: <strong style={{ color: "var(--text)" }}>{Math.abs(p1.singlesElo - p2.singlesElo)} pts</strong>
              {" · "}Doubles ELO gap: <strong style={{ color: "var(--text)" }}>{Math.abs(p1.doublesElo - p2.doublesElo)} pts</strong>
            </div>
          )}

          {/* match history */}
          {loading && <div style={{ fontSize: 13, color: "var(--text-hint)", textAlign: "center", padding: "1rem" }}>Loading...</div>}
          {!loading && matches.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--text-hint)", textAlign: "center", padding: "1rem" }}>No confirmed matches between these players yet.</div>
          )}
          {!loading && matches.map(m => {
            const scoreStr = m.sets?.map((s, i) => `${s.w}–${s.l}`).join("  ") ?? "";
            const date = m.createdAt?.toDate?.()?.toLocaleDateString("en-US", { month: "short", day: "numeric" }) ?? "";
            return (
              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: "var(--text-secondary)" }}>{date}</span>
                <span style={{ fontWeight: 500, color: "var(--text)" }}>{scoreStr}</span>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>{m.type}</span>
              </div>
            );
          })}
        </div>
      )}

      {(!p1Id || !p2Id) && (
        <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-hint)", fontSize: 13 }}>Select two players to see their head to head record.</div>
      )}
    </div>
  );
}

export default function Stats({ players, groupId }) {
  const [subtab, setSubtab] = useState("group");

  return (
    <div>
      <div style={{ display: "flex", gap: 4, background: "var(--bg-secondary)", borderRadius: 8, padding: 4, marginBottom: "1.25rem" }}>
        {[["group", "Group stats"], ["h2h", "Head to head"]].map(([val, label]) => (
          <button key={val} onClick={() => setSubtab(val)} style={{
            flex: 1, padding: 8, fontSize: 14, borderRadius: 6, cursor: "pointer",
            border: subtab === val ? "1px solid var(--border-mid)" : "none",
            background: subtab === val ? "var(--bg-card)" : "transparent",
            fontWeight: subtab === val ? 500 : 400, color: "var(--text)",
          }}>{label}</button>
        ))}
      </div>
      {subtab === "group" && <GroupStats players={players} />}
      {subtab === "h2h" && <HeadToHead players={players} groupId={groupId} />}
    </div>
  );
}