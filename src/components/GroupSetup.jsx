import { useState } from "react";
import { collection, addDoc, query, where, getDocs, updateDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

function generateCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

export default function GroupSetup({ user, onDone, onLogout, existingGroups = [] }) {
  const [mode, setMode] = useState("choose");
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function createGroup() {
    if (!groupName.trim()) return setStatus("Enter a group name.");
    setLoading(true);
    const code = generateCode();
    const ref = await addDoc(collection(db, "groups"), {
      name: groupName.trim(),
      code,
      createdBy: user.uid,
      members: [user.uid],
      admins: [user.uid],
      createdAt: serverTimestamp(),
    });
    // Add player to group
    await setDoc(doc(db, "groups", ref.id, "players", user.uid), {
      name: user.displayName ?? "",
      email: user.email ?? "",
      photoURL: user.photoURL ?? "",
      singlesElo: 1000,
      doublesElo: 1000,
      wins: 0,
      losses: 0,
      isAdmin: true,
    });
    setLoading(false);
    onDone(ref.id);
  }

  async function joinGroup() {
    if (!joinCode.trim()) return setStatus("Enter a group code.");
    setLoading(true);
    const q = query(collection(db, "groups"), where("code", "==", joinCode.trim().toUpperCase()));
    const snap = await getDocs(q);
    if (snap.empty) {
      setStatus("No group found with that code.");
      setLoading(false);
      return;
    }
    const groupDoc = snap.docs[0];
    const groupId = groupDoc.id;
    const data = groupDoc.data();
    if (data.members?.includes(user.uid)) {
      setStatus("You're already in this group!");
      setLoading(false);
      return;
    }
    // Add user to group members
    await updateDoc(doc(db, "groups", groupId), {
      members: [...(data.members ?? []), user.uid],
    });
    // Add player doc
    await setDoc(doc(db, "groups", groupId, "players", user.uid), {
      name: user.displayName ?? "",
      email: user.email ?? "",
      photoURL: user.photoURL ?? "",
      singlesElo: 1000,
      doublesElo: 1000,
      wins: 0,
      losses: 0,
      isAdmin: false,
    });
    setLoading(false);
    onDone(groupId);
  }

  const card = { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "1.5rem", marginBottom: "1rem" };

  return (
    // Change the outer div style to:
    <div style={{ maxWidth: 420, margin: "0 auto", padding: "2rem 1rem env(safe-area-inset-bottom)", background: "var(--bg)", minHeight: "100vh" }}>
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div style={{ fontSize: 40, marginBottom: "0.5rem" }}>🏸</div>
        <div style={{ fontSize: 20, fontWeight: 500, color: "var(--text)" }}>ShuttleRanked</div>
        {existingGroups.length === 0 && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>Create or join a group to get started</div>}
      </div>

      {mode === "choose" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={() => setMode("create")} style={{ padding: "14px", fontSize: 14, fontWeight: 500, background: "var(--text)", color: "var(--bg)", border: "none", borderRadius: 10, cursor: "pointer" }}>
            Create a new group
          </button>
          <button onClick={() => setMode("join")} style={{ padding: "14px", fontSize: 14, fontWeight: 500, background: "transparent", color: "var(--text)", border: "1px solid var(--border-mid)", borderRadius: 10, cursor: "pointer" }}>
            Join with a code
          </button>
          {existingGroups.length > 0 && (
            <button onClick={() => onDone(existingGroups[0].id)} style={{ padding: "14px", fontSize: 14, background: "transparent", color: "var(--text-secondary)", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              Back to my groups
            </button>
          )}
          <button onClick={onLogout} style={{ padding: "10px", fontSize: 13, background: "transparent", color: "var(--text-hint)", border: "none", cursor: "pointer", textDecoration: "underline" }}>
            Sign out
          </button>
        </div>
      )}

      {mode === "create" && (
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: "1rem" }}>Create a group</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Group name</div>
          <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="e.g. Friday Badminton" style={{ marginBottom: "0.75rem" }} />
          <div style={{ fontSize: 12, color: "var(--text-hint)", marginBottom: "1rem" }}>A join code will be generated automatically. Share it with your friends.</div>
          {status && <div style={{ fontSize: 12, color: "#A32D2D", marginBottom: "0.5rem" }}>{status}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setMode("choose"); setStatus(""); }} style={{ flex: 1, padding: 10, fontSize: 13, border: "1px solid var(--border-mid)", borderRadius: 8, background: "transparent", color: "var(--text)", cursor: "pointer" }}>Back</button>
            <button onClick={createGroup} disabled={loading} style={{ flex: 1, padding: 10, fontSize: 13, fontWeight: 500, background: "var(--text)", color: "var(--bg)", border: "none", borderRadius: 8, cursor: "pointer" }}>{loading ? "Creating..." : "Create"}</button>
          </div>
        </div>
      )}

      {mode === "join" && (
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: "1rem" }}>Join a group</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Group code</div>
          <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="e.g. XK7F2" style={{ marginBottom: "1rem", textTransform: "uppercase" }} />
          {status && <div style={{ fontSize: 12, color: "#A32D2D", marginBottom: "0.5rem" }}>{status}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setMode("choose"); setStatus(""); }} style={{ flex: 1, padding: 10, fontSize: 13, border: "1px solid var(--border-mid)", borderRadius: 8, background: "transparent", color: "var(--text)", cursor: "pointer" }}>Back</button>
            <button onClick={joinGroup} disabled={loading} style={{ flex: 1, padding: 10, fontSize: 13, fontWeight: 500, background: "var(--text)", color: "var(--bg)", border: "none", borderRadius: 8, cursor: "pointer" }}>{loading ? "Joining..." : "Join"}</button>
          </div>
        </div>
      )}
    </div>
  );
}