const chipStyle = {
  S: { background: "#FAEEDA", color: "#633806" },
  A: { background: "#E6F1FB", color: "#0C447C" },
  B: { background: "#EAF3DE", color: "#27500A" },
  C: { background: "#F1EFE8", color: "#5F5E5A" },
};

function assignTiers(players, eloKey) {
  const sorted = [...players].sort((a, b) => b[eloKey] - a[eloKey]);
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

function teamLabel(t) {
  if (!t) return "BYE";
  return `${t.players[0].name.split(" ")[0]} & ${t.players[1].name.split(" ")[0]}`;
}

function getNextMatch(activeTournament, currentUid) {
  if (!activeTournament || activeTournament.status === "finished") return null;
  const { bracket, teams } = activeTournament;
  if (!bracket || !teams) return null;

  const myTeam = teams.find(t => t.players.some(p => p.id === currentUid));
  if (!myTeam) return null;

  for (let ri = 0; ri < bracket.length; ri++) {
    for (let mi = 0; mi < bracket[ri].length; mi++) {
      const match = bracket[ri][mi];
      if (match.winner) continue;
      const hasMyTeam = (match.a && teamLabel(match.a) === teamLabel(myTeam)) ||
                        (match.b && teamLabel(match.b) === teamLabel(myTeam));
      if (hasMyTeam) {
        const opponent = teamLabel(match.a) === teamLabel(myTeam) ? match.b : match.a;
        const roundLabels = bracket.length === 1 ? ["Final"]
          : bracket.length === 2 ? ["Semifinal", "Final"]
          : bracket.length === 3 ? ["Quarterfinal", "Semifinal", "Final"]
          : bracket.map((_, i) => i === bracket.length - 1 ? "Final" : i === bracket.length - 2 ? "Semifinal" : `Round ${i + 1}`);
        return { round: roundLabels[ri], opponent, myTeam };
      }
    }
  }
  return null;
}

export default function Profile({ players, currentUid, activeTournament }) {
  const p = players.find(x => x.id === currentUid);
  if (!p) return <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-hint)" }}>Loading profile...</div>;

  const sRanked = assignTiers(players, "singlesElo");
  const dRanked = assignTiers(players, "doublesElo");
  const sEntry = sRanked.find(x => x.id === p.id);
  const dEntry = dRanked.find(x => x.id === p.id);
  const sT = sEntry?.tier ?? "C", sSub = sEntry?.subrank ?? "";
  const dT = dEntry?.tier ?? "C", dSub = dEntry?.subrank ?? "";
  const winRate = Math.round((p.wins ?? 0) / Math.max((p.wins ?? 0) + (p.losses ?? 0), 1) * 100);
  const nextMatch = getNextMatch(activeTournament, currentUid);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1.25rem", border: "1px solid var(--border)", borderRadius: 12, marginBottom: "1.25rem", background: "var(--bg-card)" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 500, color: "var(--text)" }}>
          {p.name?.split(" ").map(w => w[0]).join("")}
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text)" }}>{p.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-hint)" }}>{p.wins ?? 0}W · {p.losses ?? 0}L · {winRate}% win rate</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: "1.25rem" }}>
        {[["Singles", sT, sSub, p.singlesElo], ["Doubles", dT, dSub, p.doublesElo]].map(([label, tier, sub, elo]) => (
          <div key={label} style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: "0.75rem" }}>
            <div style={{ fontSize: 11, color: "var(--text-hint)", marginBottom: 4 }}>{label} rank</div>
            <span style={{ fontSize: 12, fontWeight: 500, padding: "3px 8px", borderRadius: 20, ...chipStyle[tier] }}>{tier}{sub}</span>
            <div style={{ fontSize: 12, color: "var(--text-hint)", marginTop: 6 }}>{elo} ELO</div>
          </div>
        ))}
      </div>

      {nextMatch && (
        <div style={{ background: "var(--bg-card)", border: "1.5px solid #185FA5", borderRadius: 12, padding: "1rem" }}>
          <div style={{ fontSize: 11, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>
            Next match · {nextMatch.round}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>
            {teamLabel(nextMatch.myTeam)}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>vs</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
            {nextMatch.opponent ? teamLabel(nextMatch.opponent) : "TBD"}
          </div>
          {nextMatch.opponent && (
            <div style={{ fontSize: 12, color: "var(--text-hint)", marginTop: 6 }}>
              Opponent avg ELO: {nextMatch.opponent.avgElo}
            </div>
          )}
        </div>
      )}

      {activeTournament && !nextMatch && activeTournament.status !== "finished" && activeTournament.participants?.includes(currentUid) && (
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 12, padding: "1rem", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>You've been eliminated. Better luck next time! 🏸</div>
        </div>
      )}
    </div>
  );
}