import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, collection, onSnapshot } from "firebase/firestore";
import { auth, provider, db } from "./firebase";
import Leaderboard from "./components/Leaderboard";
import Tournament from "./components/Tournament";
import AdminPanel from "./components/AdminPanel";
import Profile from "./components/Profile";

export default function App() {
  const [user, setUser] = useState(null);
  const [playerDoc, setPlayerDoc] = useState(null);
  const [players, setPlayers] = useState([]);
  const [view, setView] = useState("leaderboard");

  // Auth listener
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const ref = doc(db, "players", u.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            name: u.displayName,
            email: u.email,
            singlesElo: 1000,
            doublesElo: 1000,
            wins: 0,
            losses: 0,
            isAdmin: false,
          });
        }
        setPlayerDoc({ id: u.uid, ...(snap.data() || {}) });
      } else {
        setUser(null);
        setPlayerDoc(null);
      }
    });
  }, []);

  // Live leaderboard
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "players"), (snap) => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  async function handleLogin() {
    await signInWithPopup(auth, provider);
  }

  async function handleLogout() {
    await signOut(auth);
    setView("leaderboard");
  }

  if (!user) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 1rem" }}>
        <div style={{ fontSize: 48, marginBottom: "1rem" }}>🏸</div>
        <h2 style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>Shuttle Ranked</h2>
        <p style={{ color: "#666", marginBottom: "2rem" }}>Track your badminton ELO across singles and doubles</p>
        <button onClick={handleLogin} style={{ padding: "10px 24px", fontSize: 14, cursor: "pointer", border: "1px solid #ddd", borderRadius: 8, background: "#fff" }}>
          Sign in with Google
        </button>
      </div>
    );
  }

  const isAdmin = playerDoc?.isAdmin;
  const tabs = [
    { id: "leaderboard", label: "Leaderboard" },
    { id: "tournament", label: "Tournament" },
    ...(isAdmin ? [{ id: "admin", label: "Record Match" }] : []),
    { id: "profile", label: "My Profile" },
  ];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "1.5rem", borderBottom: "1px solid #eee", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: 20, fontWeight: 500 }}>Shuttle<span style={{ color: "#999", fontWeight: 400 }}>Ranked</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#666" }}>
          <span>{user.displayName?.split(" ")[0]}</span>
          {isAdmin && <span style={{ fontSize: 11, background: "#FAEEDA", color: "#633806", padding: "2px 6px", borderRadius: 10 }}>admin</span>}
          <button onClick={handleLogout} style={{ fontSize: 12, padding: "4px 10px", cursor: "pointer", border: "1px solid #ddd", borderRadius: 6, background: "transparent" }}>Sign out</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, background: "#f5f5f5", borderRadius: 8, padding: 4, marginBottom: "1.5rem" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            flex: 1, padding: 8, fontSize: 14, borderRadius: 6, border: view === t.id ? "1px solid #ddd" : "none",
            background: view === t.id ? "#fff" : "transparent", fontWeight: view === t.id ? 500 : 400, cursor: "pointer"
          }}>{t.label}</button>
        ))}
      </div>

      {view === "leaderboard" && <Leaderboard players={players} />}
      {view === "tournament" && <Tournament players={players} />}
      {view === "admin" && isAdmin && <AdminPanel players={players} currentUid={user.uid} />}
      {view === "profile" && <Profile players={players} currentUid={user.uid} />}
    </div>
  );
}