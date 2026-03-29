import { useState } from "react";
import Avatar from "./Avatar";

const chipStyle = {
  S: { background: "#FAEEDA", color: "#633806" },
  A: { background: "#E6F1FB", color: "#0C447C" },
  B: { background: "#EAF3DE", color: "#27500A" },
  C: { background: "#F1EFE8", color: "#5F5E5A" },
};

function assignTiers(players, eloFn) {
  const ranked = players.filter(p => (p.wins ?? 0) + (p.losses ?? 0) > 0);
  const unranked = players.filter(p => (p.wins ?? 0) + (p.losses ?? 0) === 0);
  const sorted = [...ranked].sort((a, b) => eloFn(b) - eloFn(a));
  const n = sorted.length;
  if (n === 0) return { tiered: [], unranked };
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
  return { tiered: result, unranked };
}

export default function Leaderboard({ players }) {
  const [mode, setMode] = useState("singles");
  const eloFn = p => mode === "singles" ? p.singlesElo : p.doublesElo;

  if (!players.length) return (
    <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-hint)" }}>No players yet.</div>
  );

  const { tiered, unranked } = assignTiers(players, eloFn);
  const tiers = { S: [], A: [], B: [], C: [] };
  tiered.forEach(p => tiers[p.tier].push(p));

  const tierLabels = {
    S: "S Tier · Elite", A: "A Tier · Advanced",
    B: "B Tier · Intermediate", C: "C Tier · Developing",
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 4, background: "var(--bg-secondary)", borderRadius: 8, padding: 4, marginBottom: "1.25rem" }}>
        {["singles","doubles"].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            flex: 1, padding: 8, fontSize: 14, borderRadius: 6, cursor: "pointer",
            border: mode === m ? "1px solid var(--border-mid)" : "none",
            background: mode === m ? "var(--bg-card)" : "transparent",
            fontWeight: mode === m ? 500 : 400, color: "var(--text)",
          }}>{m.charAt(0).toUpperCase() + m.slice(1)}</button>
        ))}
      </div>

      {["S","A","B","C"].map(tier => {
        if (!tiers[tier].length) return null;
        return (
          <div key={tier} style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "0.75rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 500, ...chipStyle[tier] }}>{tier}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{tierLabels[tier]}</div>
                <div style={{ fontSize: 12, color: "var(--text-hint)" }}>{tiers[tier].length} players</div>
              </div>
            </div>
            {tiers[tier].map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 6, background: "var(--bg-card)" }}>
                <div style={{ fontSize: 12, color: "var(--text-hint)", width: 20, textAlign: "center" }}>{tiered.indexOf(p) + 1}</div>
                <Avatar player={p} size={34} fontSize={13} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-hint)" }}>{p.wins ?? 0}W · {p.losses ?? 0}L</div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, padding: "3px 8px", borderRadius: 20, ...chipStyle[tier] }}>{tier}{p.subrank}</span>
                <div style={{ fontSize: 14, fontWeight: 500, minWidth: 44, textAlign: "right", color: "var(--text)" }}>{eloFn(p)}</div>
              </div>
            ))}
          </div>
        );
      })}

      {unranked.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "0.75rem" }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 500, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>?</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>Unranked</div>
              <div style={{ fontSize: 12, color: "var(--text-hint)" }}>Play a match to get ranked</div>
            </div>
          </div>
          {unranked.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 8, marginBottom: 6, background: "var(--bg-card)", opacity: 0.7 }}>
              <div style={{ fontSize: 12, color: "var(--text-hint)", width: 20, textAlign: "center" }}>—</div>
              <Avatar player={p} size={34} fontSize={13} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-hint)" }}>No matches played</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, padding: "3px 8px", borderRadius: 20, background: "var(--bg-secondary)", color: "var(--text-secondary)" }}>Unranked</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}