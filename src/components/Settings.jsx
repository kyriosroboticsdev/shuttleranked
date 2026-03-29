import { useState, useEffect } from "react";
import { deleteUser, updateProfile } from "firebase/auth";
import { doc, deleteDoc, updateDoc, collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useTheme } from "../context/ThemeContext";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function Settings({ user, players, onDeleted }) {
  const { dark, setDark } = useTheme();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [nameStatus, setNameStatus] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteStatus, setDeleteStatus] = useState("");
  const [eloHistory, setEloHistory] = useState([]);
  // Admin
  const [adminTarget, setAdminTarget] = useState("");
  const [adminSingles, setAdminSingles] = useState("");
  const [adminDoubles, setAdminDoubles] = useState("");
  const [adminStatus, setAdminStatus] = useState("");

  const currentPlayer = players.find(p => p.id === user?.uid);
  const isAdmin = currentPlayer?.isAdmin;

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "players", user.uid, "eloHistory"),
      orderBy("timestamp", "asc")
    );
    const unsub = onSnapshot(q, snap => {
      setEloHistory(snap.docs.map(d => {
        const data = d.data();
        const date = data.timestamp?.toDate?.()?.toLocaleDateString("en-US", { month: "short", day: "numeric" }) ?? "";
        return { date, singlesElo: data.singlesElo, doublesElo: data.doublesElo };
      }));
    });
    return unsub;
  }, [user]);

  async function saveName() {
    if (!displayName.trim()) return;
    await updateProfile(auth.currentUser, { displayName });
    await updateDoc(doc(db, "players", user.uid), { name: displayName });
    setNameStatus("Name updated!");
    setTimeout(() => setNameStatus(""), 3000);
  }

  async function handleDelete() {
    if (deleteConfirm !== "DELETE") return setDeleteStatus("Type DELETE to confirm.");
    try {
      await deleteDoc(doc(db, "players", user.uid));
      await deleteUser(auth.currentUser);
      onDeleted();
    } catch (e) {
      setDeleteStatus("Error: " + e.message + " — try signing out and back in first.");
    }
  }

  async function applyAdminElo() {
    if (!adminTarget) return setAdminStatus("Select a player.");
    const updates = {};
    if (adminSingles !== "") updates.singlesElo = parseInt(adminSingles);
    if (adminDoubles !== "") updates.doublesElo = parseInt(adminDoubles);
    if (!Object.keys(updates).length) return setAdminStatus("Enter at least one ELO value.");
    await updateDoc(doc(db, "players", adminTarget), updates);
    setAdminStatus("ELO updated!");
    setAdminSingles(""); setAdminDoubles(""); setAdminTarget("");
    setTimeout(() => setAdminStatus(""), 3000);
  }

  async function resetPlayerElo() {
    if (!adminTarget) return setAdminStatus("Select a player.");
    if (!window.confirm("Reset this player to 1000 ELO?")) return;
    await updateDoc(doc(db, "players", adminTarget), { singlesElo: 1000, doublesElo: 1000 });
    setAdminStatus("Player reset to 1000 ELO.");
    setTimeout(() => setAdminStatus(""), 3000);
  }

  async function removePlayer() {
    if (!adminTarget) return setAdminStatus("Select a player.");
    if (!window.confirm("Remove this player from the roster? This cannot be undone.")) return;
    await deleteDoc(doc(db, "players", adminTarget));
    setAdminStatus("Player removed.");
    setAdminTarget("");
    setTimeout(() => setAdminStatus(""), 3000);
  }

  const sectionLabel = title => (
    <div style={{ fontSize: 11, color: "var(--text-hint)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "1.5rem 0 0.75rem" }}>{title}</div>
  );
  const card = children => (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "1.25rem" }}>{children}</div>
  );

  return (
    <div>
      {sectionLabel("Appearance")}
      {card(
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>Dark mode</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Easier on the eyes</div>
          </div>
          <div onClick={() => setDark(d => !d)} style={{ width: 44, height: 24, borderRadius: 12, cursor: "pointer", position: "relative", background: dark ? "#185FA5" : "var(--border-mid)", transition: "background 0.2s" }}>
            <div style={{ position: "absolute", top: 3, left: dark ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
          </div>
        </div>
      )}

      {sectionLabel("Profile")}
      {card(<>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Display name</div>
        <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
        <button onClick={saveName} style={{ marginTop: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, background: "var(--text)", color: "var(--bg)", border: "none", borderRadius: 8, cursor: "pointer" }}>
          Save name
        </button>
        {nameStatus && <div style={{ fontSize: 12, color: "#3B6D11", marginTop: 6 }}>{nameStatus}</div>}
      </>)}

      {sectionLabel("ELO history")}
      {card(<>
        {eloHistory.length < 2 ? (
          <div style={{ fontSize: 13, color: "var(--text-hint)", textAlign: "center", padding: "1rem 0" }}>
            Play more matches to see your ELO graph.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={eloHistory} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--text-hint)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-hint)" }} />
              <Tooltip
                contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "var(--text-secondary)" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="singlesElo" stroke="#185FA5" strokeWidth={2} dot={false} name="Singles" />
              <Line type="monotone" dataKey="doublesElo" stroke="#3B6D11" strokeWidth={2} dot={false} name="Doubles" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </>)}

      {isAdmin && (<>
        {sectionLabel("Admin tools")}
        {card(<>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: "0.75rem" }}>Select a player to manage</div>
          <select value={adminTarget} onChange={e => setAdminTarget(e.target.value)} style={{ marginBottom: "0.75rem" }}>
            <option value="">Select player</option>
            {players.filter(p => p.id !== user.uid).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Manually set ELO</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: "0.75rem" }}>
            <input type="number" placeholder="Singles ELO" value={adminSingles} onChange={e => setAdminSingles(e.target.value)} />
            <input type="number" placeholder="Doubles ELO" value={adminDoubles} onChange={e => setAdminDoubles(e.target.value)} />
          </div>
          <button onClick={applyAdminElo} style={{ width: "100%", padding: "8px 16px", fontSize: 13, fontWeight: 500, background: "var(--text)", color: "var(--bg)", border: "none", borderRadius: 8, cursor: "pointer", marginBottom: "0.5rem" }}>
            Apply ELO
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: "0.5rem" }}>
            <button onClick={resetPlayerElo} style={{ padding: "8px 12px", fontSize: 12, background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-mid)", borderRadius: 8, cursor: "pointer" }}>
              Reset to 1000
            </button>
            <button onClick={removePlayer} style={{ padding: "8px 12px", fontSize: 12, background: "transparent", color: "#A32D2D", border: "1px solid #A32D2D", borderRadius: 8, cursor: "pointer" }}>
              Remove player
            </button>
          </div>
          {adminStatus && <div style={{ fontSize: 12, color: "#3B6D11", marginTop: 8 }}>{adminStatus}</div>}
        </>)}
      </>)}

      {sectionLabel("Danger zone")}
      {card(<>
        <div style={{ fontSize: 14, fontWeight: 500, color: "#A32D2D", marginBottom: 4 }}>Delete account</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
          Permanently deletes your player data and account. Type DELETE to confirm.
        </div>
        <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
        <button onClick={handleDelete} style={{ marginTop: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, background: "#A32D2D", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>
          Delete my account
        </button>
        {deleteStatus && <div style={{ fontSize: 12, color: "#A32D2D", marginTop: 6 }}>{deleteStatus}</div>}
      </>)}
    </div>
  );
}