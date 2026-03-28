import { useState } from "react";
import { deleteUser, updateProfile } from "firebase/auth";
import { doc, deleteDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useTheme } from "../context/ThemeContext";

export default function Settings({ user, onDeleted }) {
  const { dark, setDark } = useTheme();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [nameStatus, setNameStatus] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteStatus, setDeleteStatus] = useState("");

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

  const sectionLabel = (title) => (
    <div style={{ fontSize: 11, color: "var(--text-hint)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "1.5rem 0 0.75rem" }}>{title}</div>
  );

  const card = (children) => (
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