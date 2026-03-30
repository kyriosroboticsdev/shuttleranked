import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, setDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import { auth, provider, db } from "../firebase";
import { useTheme } from "../context/ThemeContext";

export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { dark } = useTheme();
  const [invite, setInvite] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | valid | expired | invalid | joining | joined | error
  const [user, setUser] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    async function loadInvite() {
      try {
        const snap = await getDoc(doc(db, "invites", token));
        if (!snap.exists()) return setStatus("invalid");
        const data = snap.data();
        if (data.used) return setStatus("expired");
        const now = Date.now();
        const expires = data.expiresAt?.toMillis?.() ?? 0;
        if (now > expires) return setStatus("expired");
        setInvite({ id: snap.id, ...data });
        setStatus("valid");
      } catch (e) {
        setStatus("error");
        setErrorMsg(e.message);
      }
    }
    loadInvite();
  }, [token]);

  async function handleJoin() {
    if (!user) {
      try {
        await signInWithPopup(auth, provider);
      } catch (e) {
        setErrorMsg("Sign in failed: " + e.message);
        return;
      }
    }
    setStatus("joining");
    try {
      const currentUser = auth.currentUser;
      const groupId = invite.groupId;

      // Check if already a member
      const groupSnap = await getDoc(doc(db, "groups", groupId));
      if (!groupSnap.exists()) { setStatus("error"); setErrorMsg("Group no longer exists."); return; }
      const groupData = groupSnap.data();
      if (groupData.members?.includes(currentUser.uid)) {
        setStatus("joined");
        setTimeout(() => navigate("/"), 2000);
        return;
      }

      // Add to group members
      await updateDoc(doc(db, "groups", groupId), {
        members: arrayUnion(currentUser.uid),
      });

      // Create player doc in group
      await setDoc(doc(db, "groups", groupId, "players", currentUser.uid), {
        name: currentUser.displayName ?? "",
        email: currentUser.email ?? "",
        photoURL: currentUser.photoURL ?? "",
        singlesElo: 1000,
        doublesElo: 1000,
        wins: 0,
        losses: 0,
        isAdmin: false,
      });

      // Ensure globalPlayers doc exists
      const globalRef = doc(db, "globalPlayers", currentUser.uid);
      const globalSnap = await getDoc(globalRef);
      if (!globalSnap.exists()) {
        await setDoc(globalRef, {
          name: currentUser.displayName ?? "",
          email: currentUser.email ?? "",
          photoURL: currentUser.photoURL ?? "",
          globalSinglesElo: 1000,
          globalDoublesElo: 1000,
          verifiedMatches: 0,
          lastMatchAt: null,
        });
      }

      // Mark invite as used
      await updateDoc(doc(db, "invites", token), { used: true });

      setStatus("joined");
      setTimeout(() => navigate("/"), 2500);
    } catch (e) {
      setStatus("error");
      setErrorMsg(e.message);
    }
  }

  const container = {
    minHeight: "100vh", background: "var(--bg)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
  };
  const card = {
    background: "var(--bg-card)", border: "1px solid var(--border)",
    borderRadius: 16, padding: "2rem", maxWidth: 400, width: "100%", textAlign: "center",
  };

  if (status === "loading") return (
    <div style={container}>
      <div style={card}>
        <div style={{ fontSize: 32, marginBottom: "1rem" }}>🏸</div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Loading invite...</div>
      </div>
    </div>
  );

  if (status === "invalid") return (
    <div style={container}>
      <div style={card}>
        <div style={{ fontSize: 32, marginBottom: "1rem" }}>❌</div>
        <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text)", marginBottom: 8 }}>Invalid invite</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: "1.5rem" }}>This invite link doesn't exist or has been revoked.</div>
        <button onClick={() => navigate("/")} style={{ padding: "10px 24px", fontSize: 14, fontWeight: 500, background: "var(--text)", color: "var(--bg)", border: "none", borderRadius: 8, cursor: "pointer" }}>Go to app</button>
      </div>
    </div>
  );

  if (status === "expired") return (
    <div style={container}>
      <div style={card}>
        <div style={{ fontSize: 32, marginBottom: "1rem" }}>⏰</div>
        <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text)", marginBottom: 8 }}>Invite expired</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: "1.5rem" }}>This invite link has expired or already been used. Ask the group admin for a new one.</div>
        <button onClick={() => navigate("/")} style={{ padding: "10px 24px", fontSize: 14, fontWeight: 500, background: "var(--text)", color: "var(--bg)", border: "none", borderRadius: 8, cursor: "pointer" }}>Go to app</button>
      </div>
    </div>
  );

  if (status === "joined") return (
    <div style={container}>
      <div style={card}>
        <div style={{ fontSize: 32, marginBottom: "1rem" }}>🎉</div>
        <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text)", marginBottom: 8 }}>You're in!</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Redirecting you to {invite?.groupName}...</div>
      </div>
    </div>
  );

  if (status === "joining") return (
    <div style={container}>
      <div style={card}>
        <div style={{ fontSize: 32, marginBottom: "1rem" }}>⏳</div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Joining group...</div>
      </div>
    </div>
  );

  if (status === "error") return (
    <div style={container}>
      <div style={card}>
        <div style={{ fontSize: 32, marginBottom: "1rem" }}>⚠️</div>
        <div style={{ fontSize: 17, fontWeight: 500, color: "var(--text)", marginBottom: 8 }}>Something went wrong</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: "1.5rem" }}>{errorMsg}</div>
        <button onClick={() => navigate("/")} style={{ padding: "10px 24px", fontSize: 14, fontWeight: 500, background: "var(--text)", color: "var(--bg)", border: "none", borderRadius: 8, cursor: "pointer" }}>Go to app</button>
      </div>
    </div>
  );

  // ── Valid invite ──
  return (
    <div style={container}>
      <div style={card}>
        <div style={{ fontSize: 40, marginBottom: "1rem" }}>🏸</div>
        <div style={{ fontSize: 11, color: "var(--text-hint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem" }}>You've been invited to</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: "var(--text)", marginBottom: "0.5rem" }}>{invite?.groupName}</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
          on ShuttleRanked — track your badminton ELO with friends
        </div>
        {user ? (
          <div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: "1rem" }}>
              Joining as <strong style={{ color: "var(--text)" }}>{user.displayName}</strong>
            </div>
            <button onClick={handleJoin} style={{ width: "100%", padding: "12px", fontSize: 15, fontWeight: 500, background: "var(--text)", color: "var(--bg)", border: "none", borderRadius: 10, cursor: "pointer", marginBottom: 8 }}>
              Join {invite?.groupName}
            </button>
            <button onClick={() => auth.signOut()} style={{ fontSize: 12, color: "var(--text-hint)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              Sign in with a different account
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: "1rem" }}>
              Sign in with Google to join
            </div>
            <button onClick={handleJoin} style={{ width: "100%", padding: "12px", fontSize: 15, fontWeight: 500, background: "var(--text)", color: "var(--bg)", border: "none", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              <svg style={{ width: 18, height: 18 }} viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
              </svg>
              Sign in with Google
            </button>
          </div>
        )}
        {errorMsg && <div style={{ fontSize: 12, color: "#A32D2D", marginTop: 12 }}>{errorMsg}</div>}
      </div>
    </div>
  );
}