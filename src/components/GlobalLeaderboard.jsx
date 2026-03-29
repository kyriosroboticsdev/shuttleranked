import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";
import { db } from "../firebase";
import Avatar from "./Avatar";

export default function GlobalLeaderboard({ currentUid }) {
  const [players, setPlayers] = useState([]);
  const [mode, setMode] = useState("singles");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "globalPlayers"),
      where("verifiedMatches", ">=", 5),
      orderBy("verifiedMatches", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const eloKey = mode === "singles" ? "globalSinglesElo" : "globalDoublesElo";
  const sorted = [...players].sort((a, b) => (b[eloKey] ?? 0) - (a[eloKey] ?? 0));

  return (
    <div>
      <div style={{ display: "flex", gap: 4, background: "var(--bg-secondary)", borderRadius: 8, padding: 4, marginBottom: "1.25rem" }}>
        {["singles", "doubles"].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            flex: 1, padding: 8, fontSize: 14, borderRadius: 6, cursor: "pointer",
            border: mode === m ? "1px solid var(--border-mid)" : "none",
            background: mode === m ? "var(--bg-card)" : "transparent",
            fontWeight: mode === m ? 500 : 400, color: "var(--text)",
          }}>{m.charAt(0).toUpperCase() + m.slice(1)}</button>
        ))}
      </div>

      <div style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: "8px 12px", marginBottom: "1rem", fontSize: 12, color: "var(--text-secondary)" }}>
        Showing players with 5+ verified challenge matches. Tournament results do not count toward global ELO.
      </div>

      {loading && <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-hint)", fontSize: 14 }}>Loading...</div>}

      {!loading && sorted.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
          <div style={{ fontSize: 32, marginBottom: "0.75rem" }}>🌍</div>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>No global rankings yet</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Players need 5 verified challenge matches to appear here.</div>
        </div>
      )}

      {sorted.map((p, i) => {
        const isMe = p.id === currentUid;
        return (
          <div key={p.id} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
            border: isMe ? "1.5px solid #185FA5" : "1px solid var(--border)",
            borderRadius: 8, marginBottom: 6,
            background: isMe ? "#1a2e40" : "var(--bg-card)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: i < 3 ? "#EF9F27" : "var(--text-hint)", width: 24, textAlign: "center" }}>
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
            </div>
            <Avatar player={p} size={34} fontSize={13} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
                {p.name} {isMe && <span style={{ fontSize: 11, color: "#90c4f9" }}>· you</span>}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-hint)" }}>{p.verifiedMatches} verified matches</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", minWidth: 44, textAlign: "right" }}>
              {p[eloKey] ?? 1000}
            </div>
          </div>
        );
      })}
    </div>
  );
}