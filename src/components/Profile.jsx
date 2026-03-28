function assignTiers(players) {
  const sorted = [...players].sort((a, b) => b.singlesElo - a.singlesElo);
  const n = sorted.length;
  const base = Math.floor(n / 4);
  const remainder = n % 4;
  const sizes = [base+(remainder>0?1:0), base+(remainder>1?1:0), base+(remainder>2?1:0), base];
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

export default function Profile({ players, currentUid }) {
  const p = players.find(x => x.id === currentUid);
  if (!p) return <div style={{ textAlign: "center", padding: "2rem", color: "#999" }}>Loading profile...</div>;

  const sRanked = assignTiers(players);
    const dRanked = assignTiers([...players].map(p => ({ ...p, singlesElo: p.doublesElo })));   
    const sEntry = sRanked.find(x => x.id === p.id);
    const dEntry = dRanked.find(x => x.id === p.id);
    const sT = sEntry?.tier ?? "C", sSub = sEntry?.subrank ?? "";
    const dT = dEntry?.tier ?? "C", dSub = dEntry?.subrank ?? "";
  const winRate = Math.round((p.wins ?? 0) / Math.max((p.wins ?? 0) + (p.losses ?? 0), 1) * 100);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1.25rem", border: "1px solid #eee", borderRadius: 12, marginBottom: "1.25rem", background: "#fff" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#eee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 500 }}>
          {p.name?.split(" ").map(w => w[0]).join("")}
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 500 }}>{p.name}</div>
          <div style={{ fontSize: 12, color: "#999" }}>{p.wins ?? 0}W · {p.losses ?? 0}L · {winRate}% win rate</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[["Singles", sT, sSub, p.singlesElo], ["Doubles", dT, dSub, p.doublesElo]].map(([label, tier, sub, elo]) => (
          <div key={label} style={{ background: "#f9f9f9", borderRadius: 8, padding: "0.75rem" }}>
            <div style={{ fontSize: 11, color: "#999", marginBottom: 4 }}>{label} rank</div>
            <span style={{ fontSize: 12, fontWeight: 500, padding: "3px 8px", borderRadius: 20, ...chipStyle[tier] }}>{tier}{sub}</span>
            <div style={{ fontSize: 12, color: "#999", marginTop: 6 }}>{elo} ELO</div>
          </div>
        ))}
      </div>
    </div>
  );
}