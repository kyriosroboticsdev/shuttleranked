import { doc, updateDoc, arrayUnion, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useState } from "react";

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

export default function NotificationPopup({ requests, currentUid, players, onClose }) {
  if (!requests.length) return null;

  const req = requests[0]; // show one at a time

  const getName = uid => players.find(p => p.id === uid)?.name ?? "Unknown";
  const isCreator = req.createdBy === currentUid;
  const hasAccepted = req.acceptedBy?.includes(currentUid);
  const hasConfirmed = req.confirmedBy?.includes(currentUid);
  const enteredScore = req.scoreEnteredBy && req.scoreEnteredBy !== currentUid;
  const otherPlayers = req.players.filter(id => id !== req.createdBy);

  async function accept() {
    const newAccepted = [...(req.acceptedBy ?? []), currentUid];
    const allAccepted = req.players.every(id => id === req.createdBy || newAccepted.includes(id));
    await updateDoc(doc(db, "matchRequests", req.id), {
      acceptedBy: arrayUnion(currentUid),
      status: allAccepted ? "accepted" : "pending",
    });
  }

  async function decline() {
    await updateDoc(doc(db, "matchRequests", req.id), { status: "declined" });
  }

  async function enterScore(sets) {
    await updateDoc(doc(db, "matchRequests", req.id), {
      sets,
      scoreEnteredBy: currentUid,
      status: "score_entered",
    });
  }

  async function confirmScore() {
    const newConfirmed = [...(req.confirmedBy ?? []), currentUid];
    const nonEntering = req.players.filter(id => id !== req.scoreEnteredBy);
    const allConfirmed = nonEntering.every(id => newConfirmed.includes(id));

    if (allConfirmed) {
      // Calculate and apply ELO
      const sets = req.sets;
      const type = req.type;
      let winnerIds, loserIds;

      if (type === "singles") {
        // First player in req.players is challenger, second is challenged
        // Winner is whoever scored more in set 1
        const p1wins = sets.filter(s => s.w > s.l).length;
        const p2wins = sets.filter(s => s.l > s.w).length;
        if (p1wins >= p2wins) {
          winnerIds = [req.players[0]];
          loserIds = [req.players[1]];
        } else {
          winnerIds = [req.players[1]];
          loserIds = [req.players[0]];
        }
      } else {
        // doubles — team1 is players[0,1], team2 is players[2,3]
        const p1wins = sets.filter(s => s.w > s.l).length;
        const p2wins = sets.filter(s => s.l > s.w).length;
        if (p1wins >= p2wins) {
          winnerIds = [req.players[0], req.players[1]];
          loserIds = [req.players[2], req.players[3]];
        } else {
          winnerIds = [req.players[2], req.players[3]];
          loserIds = [req.players[0], req.players[1]];
        }
      }

      const winnerPlayers = winnerIds.map(id => players.find(p => p.id === id)).filter(Boolean);
      const loserPlayers = loserIds.map(id => players.find(p => p.id === id)).filter(Boolean);
      const wElo = winnerPlayers.reduce((s, p) => s + (type === "singles" ? p.singlesElo : p.doublesElo), 0) / winnerPlayers.length;
      const lElo = loserPlayers.reduce((s, p) => s + (type === "singles" ? p.singlesElo : p.doublesElo), 0) / loserPlayers.length;
      const change = calcElo(wElo, lElo, sets);

      await Promise.all([
        ...winnerPlayers.map(p => updateDoc(doc(db, "players", p.id), {
          [type === "singles" ? "singlesElo" : "doublesElo"]: (type === "singles" ? p.singlesElo : p.doublesElo) + change,
          wins: (p.wins ?? 0) + 1,
        })),
        ...loserPlayers.map(p => updateDoc(doc(db, "players", p.id), {
          [type === "singles" ? "singlesElo" : "doublesElo"]: Math.max((type === "singles" ? p.singlesElo : p.doublesElo) - change, 800),
          losses: (p.losses ?? 0) + 1,
        })),
      ]);

      await updateDoc(doc(db, "matchRequests", req.id), {
        confirmedBy: newConfirmed,
        status: "confirmed",
      });
    } else {
      await updateDoc(doc(db, "matchRequests", req.id), {
        confirmedBy: arrayUnion(currentUid),
      });
    }
  }

  async function disputeScore() {
    await updateDoc(doc(db, "matchRequests", req.id), {
      status: "accepted",
      sets: null,
      scoreEnteredBy: null,
      confirmedBy: [],
    });
  }

  const overlay = {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.5)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
  };

  const card = {
    background: "var(--bg-card)", borderRadius: 16, padding: "1.5rem",
    width: "100%", maxWidth: 420, border: "1px solid var(--border)",
  };

  const btn = (bg, color, extra = {}) => ({
    flex: 1, padding: "10px 16px", fontSize: 14, fontWeight: 500,
    border: "none", borderRadius: 8, cursor: "pointer", background: bg, color, ...extra,
  });

  // ── Pending: needs acceptance ──
  if (req.status === "pending" && !isCreator && !hasAccepted) {
    return (
      <div style={overlay} onClick={onClose}>
        <div style={card} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 11, color: "var(--text-hint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>Match request</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>
            {getName(req.createdBy)} challenged you
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
            {req.type} match · {req.players.map(getName).join(" vs ")}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={decline} style={btn("var(--bg-secondary)", "var(--text-secondary)")}>Decline</button>
            <button onClick={accept} style={btn("var(--text)", "var(--bg)")}>Accept</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Accepted: waiting for others to accept ──
  if (req.status === "pending" && (isCreator || hasAccepted)) {
    const waiting = otherPlayers.filter(id => !req.acceptedBy?.includes(id)).map(getName);
    return (
      <div style={overlay} onClick={onClose}>
        <div style={card} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 11, color: "var(--text-hint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>Match request</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>Waiting for acceptance</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
            Still waiting for: {waiting.join(", ")}
          </div>
          <button onClick={onClose} style={{ ...btn("var(--bg-secondary)", "var(--text)"), flex: "none", width: "100%" }}>Dismiss</button>
        </div>
      </div>
    );
  }

  // ── Accepted: enter score ──
  if (req.status === "accepted") {
    return <EnterScorePopup req={req} currentUid={currentUid} getName={getName} onEnter={enterScore} onClose={onClose} btn={btn} card={card} overlay={overlay} />;
  }

  // ── Score entered: confirm or dispute ──
  if (req.status === "score_entered" && !hasConfirmed && !isCreator === (req.scoreEnteredBy !== currentUid)) {
    const scoreStr = req.sets?.map((s, i) => `Set ${i+1}: ${s.w}–${s.l}`).join("  ·  ") ?? "";
    return (
      <div style={overlay} onClick={onClose}>
        <div style={card} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 11, color: "var(--text-hint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>Confirm score</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>
            {getName(req.scoreEnteredBy)} entered the score
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
            {req.players.map(getName).join(" vs ")}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", background: "var(--bg-secondary)", padding: "10px 14px", borderRadius: 8, marginBottom: "1.25rem" }}>
            {scoreStr}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={disputeScore} style={btn("var(--bg-secondary)", "#A32D2D")}>Dispute</button>
            <button onClick={confirmScore} style={btn("var(--text)", "var(--bg)")}>Confirm & apply ELO</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Score entered: waiting for other side to confirm ──
  if (req.status === "score_entered" && req.scoreEnteredBy === currentUid) {
    return (
      <div style={overlay} onClick={onClose}>
        <div style={card} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 11, color: "var(--text-hint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>Score submitted</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>Waiting for confirmation</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
            The other player needs to confirm the score before ELO updates.
          </div>
          <button onClick={onClose} style={{ ...btn("var(--bg-secondary)", "var(--text)"), flex: "none", width: "100%" }}>Dismiss</button>
        </div>
      </div>
    );
  }

  return null;
}

function EnterScorePopup({ req, currentUid, getName, onEnter, onClose, btn, card, overlay }) {
  const [sets, setSets] = useState([{ w: "", l: "" }]);

  const valid = sets.every(s => s.w !== "" && s.l !== "") && sets.length > 0;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 11, color: "var(--text-hint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>Enter score</div>
        <div style={{ fontSize: 16, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>
          {req.players.map(getName).join(" vs ")}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: "1rem" }}>
          Enter the score — winner's score on the left
        </div>

        {sets.map((s, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input type="number" placeholder="Winner" value={s.w} onChange={e => { const n = [...sets]; n[i].w = e.target.value; setSets(n); }} style={{ textAlign: "center" }} />
            <span style={{ fontSize: 12, color: "var(--text-hint)", textAlign: "center" }}>Set {i + 1}</span>
            <input type="number" placeholder="Loser" value={s.l} onChange={e => { const n = [...sets]; n[i].l = e.target.value; setSets(n); }} style={{ textAlign: "center" }} />
          </div>
        ))}
        <button onClick={() => setSets([...sets, { w: "", l: "" }])} style={{ fontSize: 12, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", marginBottom: "1rem" }}>
          + Add set
        </button>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={btn("var(--bg-secondary)", "var(--text)")}>Cancel</button>
          <button onClick={() => onEnter(sets.map(s => ({ w: parseInt(s.w), l: parseInt(s.l) })))} disabled={!valid} style={btn(valid ? "var(--text)" : "var(--border-mid)", valid ? "var(--bg)" : "var(--text-hint)")}>
            Submit score
          </button>
        </div>
      </div>
    </div>
  );
}