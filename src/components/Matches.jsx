import { useState, useEffect } from "react";
import { collection, addDoc, onSnapshot, query, where, serverTimestamp, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import Avatar from "./Avatar";

export default function Matches({ players, currentUid }) {
  const [doublesSlots, setDoublesSlots] = useState({ teammate: null, opp1: null, opp2: null });
  const [type, setType] = useState("singles");
  const [selectedIds, setSelectedIds] = useState([]);
  const [requests, setRequests] = useState([]);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  const others = players.filter(p => p.id !== currentUid);

  useEffect(() => {
    const q = query(
      collection(db, "matchRequests"),
      where("players", "array-contains", currentUid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [currentUid]);

  function togglePlayer(id) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  const maxSelectable = type === "singles" ? 1 : 3;
  const canSend = type === "singles"
    ? selectedIds.length === 1
    : Object.values(doublesSlots).every(v => v !== null);

  
  async function sendRequest() {
    if (!canSend) return;
    setSending(true);
    const playersList = type === "singles"
        ? [currentUid, ...selectedIds]
        : [currentUid, doublesSlots.teammate, doublesSlots.opp1, doublesSlots.opp2];

    await addDoc(collection(db, "matchRequests"), {
        type,
        status: "pending",
        createdBy: currentUid,
        createdAt: serverTimestamp(),
        players: playersList,
        acceptedBy: [currentUid],
        sets: null,
        scoreEnteredBy: null,
        confirmedBy: [],
    });
    setSelectedIds([]);
    setDoublesSlots({ teammate: null, opp1: null, opp2: null });
    setStatus("Challenge sent!");
    setTimeout(() => setStatus(""), 3000);
    setSending(false);
  }

  const getName = uid => players.find(p => p.id === uid)?.name ?? "Unknown";

  const statusColors = {
    pending: { bg: "#E6F1FB", color: "#0C447C", label: "Pending" },
    accepted: { bg: "#EAF3DE", color: "#27500A", label: "Accepted" },
    score_entered: { bg: "#FAEEDA", color: "#633806", label: "Score entered" },
    confirmed: { bg: "#EAF3DE", color: "#27500A", label: "Confirmed ✓" },
    declined: { bg: "#FCEBEB", color: "#A32D2D", label: "Declined" },
  };

  const active = requests.filter(r => !["confirmed", "declined"].includes(r.status));
  const past = requests.filter(r => ["confirmed", "declined"].includes(r.status));

  return (
    <div>
      <div style={{ background: "var(--bg-secondary)", borderRadius: 12, padding: "1.25rem", border: "1px solid var(--border)", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: "1rem" }}>Send a challenge</div>

        <div style={{ display: "flex", gap: 4, background: "var(--bg)", borderRadius: 8, padding: 4, marginBottom: "1rem" }}>
          {[["singles", "Singles"], ["doubles", "Doubles"]].map(([val, label]) => (
            <button key={val} onClick={() => { setType(val); setSelectedIds([]); }} style={{
              flex: 1, padding: "7px 8px", fontSize: 13, borderRadius: 6, cursor: "pointer",
              border: type === val ? "1px solid var(--border-mid)" : "none",
              background: type === val ? "var(--bg-card)" : "transparent",
              fontWeight: type === val ? 500 : 400, color: "var(--text)",
            }}>{label}</button>
          ))}
        </div>

        {type === "singles" ? (
            <>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: "0.75rem" }}>Select your opponent</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: "1rem" }}>
            {others.map(p => {
                const sel = selectedIds.includes(p.id);
                const disabled = !sel && selectedIds.length >= 1;
                return (
                <div key={p.id} onClick={() => !disabled && togglePlayer(p.id)} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                    border: sel ? "1.5px solid #185FA5" : "1px solid var(--border)",
                    borderRadius: 8, background: sel ? "#1a2e40" : "var(--bg-card)",
                    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
                }}>
                    <Avatar player={p} size={32} fontSize={12} />
                    <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-hint)" }}>{p.singlesElo} singles ELO</div>
                    </div>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", border: sel ? "none" : "1.5px solid var(--border-mid)", background: sel ? "#185FA5" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff" }}>
                    {sel ? "✕" : ""}
                    </div>
                </div>
                );
            })}
            </div>
        </>
        ) : (
        <>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: "0.75rem" }}>Select your teammate and opponents</div>
            {[
            { label: "Your teammate", key: "teammate", max: 1 },
            { label: "Opponent 1", key: "opp1", max: 1 },
            { label: "Opponent 2", key: "opp2", max: 1 },
            ].map(({ label, key }) => {
            const otherKeys = ["teammate", "opp1", "opp2"].filter(k => k !== key);
            const takenIds = otherKeys.flatMap(k => doublesSlots[k] ? [doublesSlots[k]] : []);
            return (
                <div key={key} style={{ marginBottom: "0.75rem" }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{label}</div>
                <select
                    value={doublesSlots[key] ?? ""}
                    onChange={e => setDoublesSlots(prev => ({ ...prev, [key]: e.target.value || null }))}
                >
                    <option value="">Select player</option>
                    {others
                    .filter(p => !takenIds.includes(p.id))
                    .map(p => <option key={p.id} value={p.id}>{p.name} ({p.doublesElo} ELO)</option>)
                    }
                </select>
                </div>
            );
            })}
        </>
        )}

        {(selectedIds.length > 0 || Object.values(doublesSlots).some(v => v !== null)) && (
            <button
                onClick={() => { setSelectedIds([]); setDoublesSlots({ teammate: null, opp1: null, opp2: null }); }}
                style={{ fontSize: 12, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", marginBottom: "0.5rem", display: "block" }}
            >
                Clear selection
            </button>
            )}

            {status && <div style={{ fontSize: 13, color: "#3B6D11", marginBottom: "0.5rem" }}>{status}</div>}

            <button onClick={sendRequest} disabled={!canSend || sending} style={{
            width: "100%", padding: 10, fontSize: 14, fontWeight: 500,
            background: canSend ? "var(--text)" : "var(--border-mid)",
            color: canSend ? "var(--bg)" : "var(--text-hint)",
            border: "none", borderRadius: 8, cursor: canSend ? "pointer" : "not-allowed",
            }}>
            {sending ? "Sending..." : type === "singles"
                ? `Challenge ${selectedIds.length > 0 ? selectedIds.map(id => getName(id).split(" ")[0]).join(", ") : "..."}`
                : canSend
                ? `Challenge ${getName(doublesSlots.opp1).split(" ")[0]} & ${getName(doublesSlots.opp2).split(" ")[0]}`
                : "Select all players..."}
            </button>
      </div>

      {/* ── Active requests ── */}
      {active.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: 11, color: "var(--text-hint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>Active</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {active.map(r => {
              const s = statusColors[r.status] ?? statusColors.pending;
              return (
                <div key={r.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
                      {r.players.map(getName).join(" vs ")}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20, background: s.bg, color: s.color }}>{s.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-hint)" }}>
                    {r.type} · {r.createdBy === currentUid ? "You challenged" : `${getName(r.createdBy)} challenged`}
                  </div>
                  {r.status === "score_entered" && r.sets && (
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                      Score: {r.sets.map((s, i) => `${s.w}–${s.l}`).join(", ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Past matches ── */}
      {past.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "var(--text-hint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.75rem" }}>Past matches</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {past.map(r => {
              const s = statusColors[r.status] ?? statusColors.confirmed;
              return (
                <div key={r.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
                      {r.players.map(getName).join(" vs ")}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20, background: s.bg, color: s.color }}>{s.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-hint)" }}>
                    {r.type}{r.sets ? ` · ${r.sets.map(s => `${s.w}–${s.l}`).join(", ")}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}