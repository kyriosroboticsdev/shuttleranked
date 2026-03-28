import { useState } from "react";
import { doc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

function calcElo(wElo, lElo, sets) {
  const exp = 1 / (1 + Math.pow(10, (lElo - wElo) / 400));
  let K = 32, totalSets = sets.length, totalDiff = 0, deuces = 0;
  sets.forEach(s => {
    totalDiff += Math.abs(s.w - s.l);
    if (s.w >= 20 && s.l >= 20) deuces++;
  });
  const dom = Math.min((totalDiff / totalSets) / 10, 1.5);
  const spd = totalSets === 1 ? 1.3 : totalSets === 2 ? 1.1 : 0.9;
  const deuce = Math.max(1 - deuces * 0.1, 0.7);
  K = K * (1 + dom * 0.5) * spd * deuce;
  return Math.max(Math.round(K * (1 - exp)), 4);
}

export default function AdminPanel({ players, currentUid }) {
  const [type, setType] = useState("singles");
  const [winnerId, setWinnerId] = useState("");
  const [loserId, setLoserId] = useState("");
  const [sets, setSets] = useState([{ w: "", l: "" }]);
  const [status, setStatus] = useState("");

  async function submit() {
    if (!winnerId || !loserId || winnerId === loserId) return setStatus("Select two different players.");
    const validSets = sets.filter(s => s.w !== "" && s.l !== "");
    if (!validSets.length) return setStatus("Enter at least one set score.");

    const winner = players.find(p => p.id === winnerId);
    const loser = players.find(p => p.id === loserId);
    const wElo = type === "singles" ? winner.singlesElo : winner.doublesElo;
    const lElo = type === "singles" ? loser.singlesElo : loser.doublesElo;
    const change = calcElo(wElo, lElo, validSets.map(s => ({ w: parseInt(s.w), l: parseInt(s.l) })));

    const wUpdate = type === "singles"
      ? { singlesElo: wElo + change, wins: (winner.wins ?? 0) + 1 }
      : { doublesElo: wElo + change, wins: (winner.wins ?? 0) + 1 };
    const lUpdate = type === "singles"
      ? { singlesElo: Math.max(lElo - change, 800), losses: (loser.losses ?? 0) + 1 }
      : { doublesElo: Math.max(lElo - change, 800), losses: (loser.losses ?? 0) + 1 };

    await updateDoc(doc(db, "players", winnerId), wUpdate);
    await updateDoc(doc(db, "players", loserId), lUpdate);
    await addDoc(collection(db, "matches"), {
      type, winnerId, loserId,
      sets: validSets.map(s => ({ w: parseInt(s.w), l: parseInt(s.l) })),
      eloChange: change,
      timestamp: serverTimestamp(),
    });

    setStatus(`Done! ${winner.name} +${change} ELO · ${loser.name} -${change} ELO`);
    setSets([{ w: "", l: "" }]);
    setWinnerId(""); setLoserId("");
    setTimeout(() => setStatus(""), 5000);
  }

  return (
    <div style={{ background: "var(--bg-secondary)", borderRadius: 12, padding: "1.25rem", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: "1rem", color: "var(--text)" }}>Record match result</div>
      {status && <div style={{ fontSize: 13, marginBottom: "0.75rem", padding: "8px 12px", background: "var(--bg-card)", borderRadius: 8, border: "1px solid var(--border)", color: "var(--text)" }}>{status}</div>}

      <div style={{ marginBottom: "0.75rem" }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Match type</div>
        <select value={type} onChange={e => setType(e.target.value)}>
          <option value="singles">Singles</option>
          <option value="doubles">Doubles</option>
        </select>
      </div>

      <div style={{ marginBottom: "0.75rem" }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Winner</div>
        <select value={winnerId} onChange={e => setWinnerId(e.target.value)}>
          <option value="">Select winner</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: "0.75rem" }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Loser</div>
        <select value={loserId} onChange={e => setLoserId(e.target.value)}>
          <option value="">Select loser</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: "0.75rem" }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Set scores</div>
        {sets.map((s, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, marginBottom: 6, alignItems: "center" }}>
            <input type="number" placeholder="Winner score" value={s.w} onChange={e => { const n = [...sets]; n[i].w = e.target.value; setSets(n); }} style={{ textAlign: "center" }} />
            <span style={{ fontSize: 12, color: "var(--text-hint)", textAlign: "center" }}>Set {i + 1}</span>
            <input type="number" placeholder="Loser score" value={s.l} onChange={e => { const n = [...sets]; n[i].l = e.target.value; setSets(n); }} style={{ textAlign: "center" }} />
          </div>
        ))}
        <button onClick={() => setSets([...sets, { w: "", l: "" }])} style={{ fontSize: 12, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>+ Add set</button>
      </div>

      <button onClick={submit} style={{ width: "100%", padding: 10, fontSize: 14, fontWeight: 500, background: "var(--text)", color: "var(--bg)", border: "none", borderRadius: 8, cursor: "pointer", marginTop: 8 }}>
        Submit result
      </button>
    </div>
  );
}