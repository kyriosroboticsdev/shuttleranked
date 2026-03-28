import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, collection, onSnapshot } from "firebase/firestore";
import { auth, provider, db } from "./firebase";
import { useTheme } from "./context/ThemeContext";
import Leaderboard from "./components/Leaderboard";
import Tournament from "./components/Tournament";
import TournamentHistory from "./components/TournamentHistory";
import AdminPanel from "./components/AdminPanel";
import Profile from "./components/Profile";
import Settings from "./components/Settings";

export default function App() {
  const [user, setUser] = useState(null);
  const [playerDoc, setPlayerDoc] = useState(null);
  const [players, setPlayers] = useState([]);
  const [view, setView] = useState("leaderboard");
  const [activeTournament, setActiveTournament] = useState(null);
  const { dark, setDark } = useTheme();

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
        const fresh = await getDoc(ref);
        setPlayerDoc({ id: u.uid, ...fresh.data() });
      } else {
        setUser(null);
        setPlayerDoc(null);
      }
    });
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "players"), (snap) => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "tournaments", "active"), (snap) => {
      if (snap.exists()) setActiveTournament({ id: snap.id, ...snap.data() });
      else setActiveTournament(null);
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
      <div style={{ textAlign: "center", padding: "4rem 1rem", background: "var(--bg)", minHeight: "100vh" }}>
        <div style={{ fontSize: 48, marginBottom: "1rem" }}>🏸</div>
        <h2 style={{ fontSize: 22, fontWeight: 500, marginBottom: 8, color: "var(--text)" }}>Shuttle Ranked</h2>
        <p style={{ color: "var(--text-secondary)", marginBottom: "2rem" }}>Track your badminton ELO across singles and doubles</p>
        <button onClick={handleLogin} style={{ padding: "10px 24px", fontSize: 14, cursor: "pointer", border: "1px solid var(--border-mid)", borderRadius: 8, background: "var(--bg-card)", color: "var(--text)", display: "inline-flex", alignItems: "center", gap: 10 }}>
          <svg style={{ width: 18, height: 18 }} viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
          </svg>
          Sign in with Google
        </button>
        <div style={{ marginTop: "1rem" }}>
          <button onClick={() => setDark(d => !d)} style={{ fontSize: 12, padding: "6px 12px", border: "1px solid var(--border-mid)", borderRadius: 8, background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>
            {dark ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </div>
    );
  }

  const isAdmin = playerDoc?.isAdmin;
  const tabs = [
    { id: "leaderboard", label: "Leaderboard" },
    { id: "tournament", label: activeTournament ? "🏸 Live" : "Tournament" },
    { id: "history", label: "History" },
    ...(isAdmin ? [{ id: "admin", label: "Record Match" }] : []),
    { id: "profile", label: "My Profile" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "1rem", minHeight: "100vh", background: "var(--bg)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "1.5rem", borderBottom: "1px solid var(--border)", marginBottom: "1.5rem" }}>
        <div style={{ fontSize: 20, fontWeight: 500, color: "var(--text)" }}>
          Shuttle<span style={{ color: "var(--text-hint)", fontWeight: 400 }}>Ranked</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
          <span>{user.displayName?.split(" ")[0]}</span>
          {isAdmin && <span style={{ fontSize: 11, background: "#FAEEDA", color: "#633806", padding: "2px 6px", borderRadius: 10 }}>admin</span>}
          <button onClick={() => setDark(d => !d)} style={{ fontSize: 12, padding: "4px 10px", cursor: "pointer", border: "1px solid var(--border-mid)", borderRadius: 6, background: "transparent", color: "var(--text-secondary)" }}>
            {dark ? "☀️" : "🌙"}
          </button>
          <button onClick={handleLogout} style={{ fontSize: 12, padding: "4px 10px", cursor: "pointer", border: "1px solid var(--border-mid)", borderRadius: 6, background: "transparent", color: "var(--text-secondary)" }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, background: "var(--bg-secondary)", borderRadius: 8, padding: 4, marginBottom: "1.5rem", overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            flex: 1, padding: "8px 6px", fontSize: 13, borderRadius: 6,
            border: view === t.id ? "1px solid var(--border-mid)" : "none",
            background: view === t.id ? "var(--bg-card)" : "transparent",
            fontWeight: view === t.id ? 500 : 400,
            cursor: "pointer", color: "var(--text)", whiteSpace: "nowrap",
          }}>{t.label}</button>
        ))}
      </div>

      {view === "leaderboard" && <Leaderboard players={players} />}
      {view === "tournament" && (
        <Tournament
          players={players}
          currentUid={user.uid}
          isAdmin={isAdmin}
          activeTournament={activeTournament}
        />
      )}
      {view === "history" && <TournamentHistory />}
      {view === "admin" && isAdmin && <AdminPanel players={players} currentUid={user.uid} />}
      {view === "profile" && (
        <Profile
          players={players}
          currentUid={user.uid}
          activeTournament={activeTournament}
        />
      )}
      {view === "settings" && <Settings user={user} onDeleted={() => { setUser(null); setView("leaderboard"); }} />}
    </div>
  );
}