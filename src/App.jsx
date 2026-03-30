import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, collection, onSnapshot, query, where, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, provider, db } from "./firebase";
import { useTheme } from "./context/ThemeContext";
import Leaderboard from "./components/Leaderboard";
import Tournament from "./components/Tournament";
import TournamentHistory from "./components/TournamentHistory";
import Matches from "./components/Matches";
import Stats from "./components/Stats";
import Profile from "./components/Profile";
import Settings from "./components/Settings";
import GlobalLeaderboard from "./components/GlobalLeaderboard";
import GroupSetup from "./components/GroupSetup";
import NotificationPopup from "./components/NotificationPopup";
import { Routes, Route } from "react-router-dom";
import InvitePage from "./components/InvitePage";

export default function App() {
  const [user, setUser] = useState(null);
  const [playerDoc, setPlayerDoc] = useState(null);
  const [players, setPlayers] = useState([]);
  const [view, setView] = useState("leaderboard");
  const [activeTournament, setActiveTournament] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [groups, setGroups] = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(() => localStorage.getItem("activeGroupId") ?? null);
  const [activeGroup, setActiveGroup] = useState(null);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const { dark, setDark } = useTheme();

  // ── Auth ──
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        // Ensure globalPlayers doc exists
        const globalRef = doc(db, "globalPlayers", u.uid);
        const globalSnap = await getDoc(globalRef);
        if (!globalSnap.exists()) {
          await setDoc(globalRef, {
            name: u.displayName,
            email: u.email,
            photoURL: u.photoURL ?? null,
            globalSinglesElo: 1000,
            globalDoublesElo: 1000,
            verifiedMatches: 0,
            lastMatchAt: null,
          });
        } else if (u.photoURL && globalSnap.data()?.photoURL !== u.photoURL) {
          await updateDoc(globalRef, { photoURL: u.photoURL });
        }
      } else {
        setUser(null);
        setPlayerDoc(null);
        setGroups([]);
        setActiveGroupId(null);
        setActiveGroup(null);
        setLoadingGroups(false);
      }
    });
  }, []);

  // ── Load groups this user belongs to ──
  useEffect(() => {
    if (!user) return;
    setLoadingGroups(true);
    const q = query(collection(db, "groups"), where("members", "array-contains", user.uid));
    const unsub = onSnapshot(q, snap => {
      const g = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setGroups(g);
      setLoadingGroups(false);
      if (g.length > 0) {
        const stored = localStorage.getItem("activeGroupId");
        const valid = stored && g.find(x => x.id === stored);
        const chosen = valid ? stored : g[0].id;
        setActiveGroupId(chosen);
        localStorage.setItem("activeGroupId", chosen);
      }
    });
    return unsub;
  }, [user]);

  // ── Load active group doc ──
  useEffect(() => {
    if (!user || !activeGroupId) return;
    const unsub = onSnapshot(doc(db, "groups", activeGroupId), snap => {
      if (snap.exists()) setActiveGroup({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [user, activeGroupId]);

  // ── Load players in active group ──
  useEffect(() => {
    if (!user || !activeGroupId) return;
    const unsub = onSnapshot(collection(db, "groups", activeGroupId, "players"), snap => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user, activeGroupId]);

  // ── Load player doc for current user in active group ──
  useEffect(() => {
    if (!user || !activeGroupId) return;
    const unsub = onSnapshot(doc(db, "groups", activeGroupId, "players", user.uid), snap => {
      if (snap.exists()) setPlayerDoc({ id: snap.id, ...snap.data() });
      else setPlayerDoc(null);
    });
    return unsub;
  }, [user, activeGroupId]);

  // ── Live tournament ──
  useEffect(() => {
    if (!user || !activeGroupId) return;
    const unsub = onSnapshot(doc(db, "groups", activeGroupId, "tournaments", "active"), snap => {
      if (snap.exists()) setActiveTournament({ id: snap.id, ...snap.data() });
      else setActiveTournament(null);
    });
    return unsub;
  }, [user, activeGroupId]);

  // ── Pending match requests ──
  useEffect(() => {
    if (!user || !activeGroupId) return;
    const q = query(
      collection(db, "groups", activeGroupId, "matchRequests"),
      where("players", "array-contains", user.uid),
      where("status", "in", ["pending", "accepted", "score_entered"])
    );
    const unsub = onSnapshot(q, snap => {
      const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPendingRequests(reqs);
      if (reqs.length > 0) setShowPopup(true);
    });
    return unsub;
  }, [user, activeGroupId]);

  async function handleLogin() {
    await signInWithPopup(auth, provider);
  }

  async function handleLogout() {
    await signOut(auth);
    setView("leaderboard");
    localStorage.removeItem("activeGroupId");
  }

  function switchGroup(groupId) {
    setActiveGroupId(groupId);
    localStorage.setItem("activeGroupId", groupId);
    setView("leaderboard");
  }

  async function handleGroupCreated(groupId) {
    setActiveGroupId(groupId);
    localStorage.setItem("activeGroupId", groupId);
    setView("leaderboard");
  }

  return (
    <Routes>
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route path="*" element={<MainApp
        user={user}
        playerDoc={playerDoc}
        players={players}
        view={view}
        setView={setView}
        activeTournament={activeTournament}
        pendingRequests={pendingRequests}
        showPopup={showPopup}
        setShowPopup={setShowPopup}
        groups={groups}
        activeGroupId={activeGroupId}
        activeGroup={activeGroup}
        loadingGroups={loadingGroups}
        dark={dark}
        setDark={setDark}
        switchGroup={switchGroup}
        handleGroupCreated={handleGroupCreated}
        handleLogin={handleLogin}
        handleLogout={handleLogout}
      />} />
    </Routes>
  );
}

function MainApp({
  user, playerDoc, players, view, setView, activeTournament,
  pendingRequests, showPopup, setShowPopup, groups, activeGroupId,
  activeGroup, loadingGroups, dark, setDark, switchGroup,
  handleGroupCreated, handleLogin, handleLogout,
}) {
  // ── Login screen ──
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

  // ── Loading groups ──
  if (loadingGroups) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 1rem", background: "var(--bg)", minHeight: "100vh" }}>
        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Loading...</div>
      </div>
    );
  }

  // ── No groups — show setup screen ──
  if (groups.length === 0) {
    return <GroupSetup user={user} onDone={handleGroupCreated} onLogout={handleLogout} />;
  }

  const isAdmin = playerDoc?.isAdmin;
  const tabs = [
    { id: "leaderboard", label: "Ranks" },
    { id: "tournament", label: activeTournament ? "🏸 Live" : "Tournament" },
    { id: "matches", label: pendingRequests.length > 0 ? `⚡ (${pendingRequests.length})` : "Match" },
    { id: "stats", label: "Stats" },
    { id: "global", label: "Global" },
    { id: "history", label: "History" },
    { id: "profile", label: "My Profile" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "1rem", minHeight: "100vh", background: "var(--bg)" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "1rem", borderBottom: "1px solid var(--border)", marginBottom: "1rem" }}>
        <div style={{ fontSize: 20, fontWeight: 500, color: "var(--text)" }}>
          Shuttle<span style={{ color: "var(--text-hint)", fontWeight: 400 }}>Ranked</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{user.displayName?.split(" ")[0]}</span>
          {isAdmin && <span style={{ fontSize: 11, background: "#FAEEDA", color: "#633806", padding: "2px 6px", borderRadius: 10 }}>admin</span>}
          <button onClick={() => setDark(d => !d)} style={{ fontSize: 16, padding: "4px 8px", cursor: "pointer", border: "1px solid var(--border-mid)", borderRadius: 6, background: "transparent", color: "var(--text-secondary)" }}>
            {dark ? "☀️" : "🌙"}
          </button>
          <button onClick={handleLogout} style={{ fontSize: 12, padding: "4px 10px", cursor: "pointer", border: "1px solid var(--border-mid)", borderRadius: 6, background: "transparent", color: "var(--text-secondary)" }}>
            Out
          </button>
        </div>
      </div>

      {/* ── Group switcher — mobile friendly ── */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "var(--text-hint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Group {activeGroup?.code && <span style={{ color: "var(--text)", fontWeight: 500 }}>· {activeGroup.code}</span>}
          </span>
          <button onClick={() => setView("groupsetup")} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, cursor: "pointer", border: "1px dashed var(--border-mid)", background: "transparent", color: "var(--text-hint)" }}>
            + Join / Create
          </button>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
          {groups.map(g => (
            <button key={g.id} onClick={() => switchGroup(g.id)} style={{
              fontSize: 13, padding: "8px 16px", borderRadius: 20, cursor: "pointer", whiteSpace: "nowrap",
              border: activeGroupId === g.id ? "1.5px solid #185FA5" : "1px solid var(--border-mid)",
              background: activeGroupId === g.id ? "#1a2e40" : "var(--bg-card)",
              color: activeGroupId === g.id ? "#90c4f9" : "var(--text-secondary)",
              fontWeight: activeGroupId === g.id ? 500 : 400,
              flexShrink: 0,
            }}>{g.name}</button>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2,
        background: "var(--bg-secondary)", borderRadius: 10, padding: 4, marginBottom: "1.5rem",
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{
            padding: "8px 4px", fontSize: 12, borderRadius: 6,
            border: view === t.id ? "1px solid var(--border-mid)" : "none",
            background: view === t.id ? "var(--bg-card)" : "transparent",
            fontWeight: view === t.id ? 500 : 400,
            cursor: "pointer", color: "var(--text)", whiteSpace: "nowrap",
            textAlign: "center",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Views ── */}
      {view === "groupsetup" && <GroupSetup user={user} onDone={handleGroupCreated} onLogout={handleLogout} existingGroups={groups} />}
      {view === "leaderboard" && <Leaderboard players={players} />}
      {view === "tournament" && <Tournament players={players} currentUid={user.uid} isAdmin={isAdmin} activeTournament={activeTournament} groupId={activeGroupId} />}
      {view === "history" && <TournamentHistory groupId={activeGroupId} />}
      {view === "matches" && <Matches players={players} currentUid={user.uid} groupId={activeGroupId} />}
      {view === "stats" && <Stats players={players} groupId={activeGroupId} />}
      {view === "global" && <GlobalLeaderboard currentUid={user.uid} />}
      {view === "profile" && <Profile players={players} currentUid={user.uid} activeTournament={activeTournament} groupId={activeGroupId} />}
      {view === "settings" && <Settings user={user} players={players} groupId={activeGroupId} onDeleted={() => { setUser(null); setView("leaderboard"); }} />}

      {showPopup && pendingRequests.length > 0 && (
        <NotificationPopup
          requests={pendingRequests}
          currentUid={user.uid}
          players={players}
          groupId={activeGroupId}
          onClose={() => setShowPopup(false)}
        />
      )}
    </div>
  );
}
