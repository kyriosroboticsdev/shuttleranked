import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";

export default function TournamentHistory({ groupId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "groups", groupId, "tournaments", "history", "entries"), orderBy("finishedAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return (
    <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-hint)", fontSize: 14 }}>Loading...</div>
  );

  if (!history.length) return (
    <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
      <div style={{ fontSize: 32, marginBottom: "0.75rem" }}>📋</div>
      <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>No tournaments yet</div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Finished tournaments will appear here.</div>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-hint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>
        {history.length} tournament{history.length !== 1 ? "s" : ""} played
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {history.map((t, i) => {
          const date = t.finishedAt?.toDate?.()?.toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric"
          }) ?? "Unknown date";

          // winner is now { playerNames: [...], playerIds: [...], avgElo }
          const winnerLabel = t.winner?.playerNames?.join(" & ") ?? null;

          return (
            <div key={t.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
                    Tournament #{history.length - i}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-hint)" }}>{date}</div>
                </div>
                {winnerLabel && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#FAEEDA", padding: "4px 10px", borderRadius: 20 }}>
                    <span style={{ fontSize: 14 }}>🏆</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: "#633806" }}>{winnerLabel}</span>
                  </div>
                )}
              </div>

              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: "0.6rem" }}>
                {t.teams?.length ?? 0} teams · {t.participants?.length ?? 0} players
              </div>

              {t.teams && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {t.teams.map(team => {
                    const label = team.playerNames?.join(" & ") ?? `Team ${team.id}`;
                    const isWinner = t.winner?.playerIds?.some(id => team.playerIds?.includes(id));
                    return (
                      <span key={team.id} style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 20,
                        background: isWinner ? "#FAEEDA" : "var(--bg-secondary)",
                        color: isWinner ? "#633806" : "var(--text-secondary)",
                        border: "1px solid var(--border)",
                      }}>
                        {isWinner ? "🏆 " : ""}{label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}