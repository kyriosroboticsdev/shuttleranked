import { useState, useEffect } from "react";
import { deleteUser, updateProfile } from "firebase/auth";
import { doc, deleteDoc, updateDoc, collection, onSnapshot, orderBy, query, getDocs, writeBatch, getDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useTheme } from "../context/ThemeContext";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import emailjs from "@emailjs/browser";

  // ── Invite link generator ──
  function InviteLinkGenerator({ groupId, groupDoc, userId }) {
    const [link, setLink] = useState("");
    const [copied, setCopied] = useState(false);
    const [generating, setGenerating] = useState(false);

    async function generate() {
      setGenerating(true);
      const token = Math.random().toString(36).substring(2, 18);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await addDoc(fbCollection(db, "invites"), {
        token,
        groupId,
        groupName: groupDoc?.name ?? "Badminton Group",
        createdBy: userId,
        createdAt: serverTimestamp(),
        expiresAt,
        used: false,
      });
      // Store token as doc ID instead for easy lookup
      // Actually use setDoc with token as ID:
      const { setDoc, doc: fsDoc } = await import("firebase/firestore");
      await setDoc(fsDoc(db, "invites", token), {
        groupId,
        groupName: groupDoc?.name ?? "Badminton Group",
        createdBy: userId,
        createdAt: serverTimestamp(),
        expiresAt,
        used: false,
      });
      const url = `${window.location.origin}/invite/${token}`;
      setLink(url);
      setGenerating(false);
    }

    function copy() {
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }

    return (
      <div>
        {link ? (
          <div style={{ display: "flex", gap: 6 }}>
            <input readOnly value={link} style={{ flex: 1, fontSize: 12 }} />
            <button onClick={copy} style={{ padding: "8px 12px", fontSize: 12, border: "1px solid var(--border-mid)", borderRadius: 8, background: copied ? "#EAF3DE" : "transparent", color: copied ? "#27500A" : "var(--text)", cursor: "pointer", whiteSpace: "nowrap" }}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        ) : (
          <button onClick={generate} disabled={generating} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 500, background: "var(--text)", color: "var(--bg)", border: "none", borderRadius: 8, cursor: "pointer" }}>
            {generating ? "Generating..." : "Generate invite link"}
          </button>
        )}
        {link && (
          <div style={{ fontSize: 11, color: "var(--text-hint)", marginTop: 6 }}>
            Expires in 7 days · single use
          </div>
        )}
        {link && (
          <button onClick={() => setLink("")} style={{ fontSize: 11, color: "var(--text-hint)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", marginTop: 4 }}>
            Generate new link
          </button>
        )}
      </div>
    );
  }

  // ── Email inviter ──
  function EmailInviter({ groupId, groupDoc, userId, userName }) {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState("");
    const [sending, setSending] = useState(false);

    async function sendInvite() {
      if (!email.trim()) return setStatus("Enter an email.");
      setSending(true);
      try {
        // Generate invite token
        const token = Math.random().toString(36).substring(2, 18);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const { setDoc, doc: fsDoc } = await import("firebase/firestore");
        await setDoc(fsDoc(db, "invites", token), {
          groupId,
          groupName: groupDoc?.name ?? "Badminton Group",
          createdBy: userId,
          createdAt: serverTimestamp(),
          expiresAt,
          used: false,
        });
        const inviteLink = `${window.location.origin}/invite/${token}`;

        // Send email via EmailJS
        await emailjs.send(
          "service_cann3ab",
          "template_gv8acg8",
          {
            to_email: email.trim(),
            from_name: userName ?? "A friend",
            group_name: groupDoc?.name ?? "Badminton Group",
            invite_link: inviteLink,
          },
          "wzi1y9kKiPdnNqeXD"
        );

        setEmail("");
        setStatus(`Invite sent to ${email}!`);
      } catch (e) {
        setStatus("Failed to send: " + e.message);
      }
      setSending(false);
      setTimeout(() => setStatus(""), 5000);
    }

    return (
      <div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="friend@gmail.com"
            onKeyDown={e => e.key === "Enter" && sendInvite()}
            style={{ flex: 1 }}
          />
          <button onClick={sendInvite} disabled={sending} style={{ padding: "8px 12px", fontSize: 13, fontWeight: 500, background: sending ? "var(--border-mid)" : "var(--text)", color: sending ? "var(--text-hint)" : "var(--bg)", border: "none", borderRadius: 8, cursor: sending ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
        {status && (
          <div style={{ fontSize: 12, color: status.includes("sent") ? "#3B6D11" : "#A32D2D", marginTop: 6 }}>
            {status}
          </div>
        )}
      </div>
    );
  }


export default function Settings({ user, players, groupId, onDeleted }) {
  const { dark, setDark } = useTheme();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [nameStatus, setNameStatus] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteStatus, setDeleteStatus] = useState("");
  const [eloHistory, setEloHistory] = useState([]);

  // Admin — ELO editing
  const [adminTarget, setAdminTarget] = useState("");
  const [adminSingles, setAdminSingles] = useState("");
  const [adminDoubles, setAdminDoubles] = useState("");
  const [adminStatus, setAdminStatus] = useState("");

  // Group management
  const [groupDoc, setGroupDoc] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [groupStatus, setGroupStatus] = useState("");
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [showCode, setShowCode] = useState(false);

  const currentPlayer = players.find(p => p.id === user?.uid);
  const isAdmin = currentPlayer?.isAdmin;

  // Load group doc
  useEffect(() => {
    if (!groupId) return;
    const unsub = onSnapshot(doc(db, "groups", groupId), snap => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setGroupDoc(data);
        setGroupName(data.name ?? "");
      }
    });
    return unsub;
  }, [groupId]);

  // Load ELO history
  useEffect(() => {
    if (!user || !groupId) return;
    const q = query(
      collection(db, "groups", groupId, "players", user.uid, "eloHistory"),
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
  }, [user, groupId]);

  async function saveName() {
    if (!displayName.trim()) return;
    await updateProfile(auth.currentUser, { displayName });
    await updateDoc(doc(db, "groups", groupId, "players", user.uid), { name: displayName });
    setNameStatus("Name updated!");
    setTimeout(() => setNameStatus(""), 3000);
  }

  async function handleDelete() {
    if (deleteConfirm !== "DELETE") return setDeleteStatus("Type DELETE to confirm.");
    try {
      await deleteDoc(doc(db, "groups", groupId, "players", user.uid));
      await deleteUser(auth.currentUser);
      onDeleted();
    } catch (e) {
      setDeleteStatus("Error: " + e.message + " — try signing out and back in first.");
    }
  }

  // ── Admin ELO tools ──
  async function applyAdminElo() {
    if (!adminTarget) return setAdminStatus("Select a player.");
    const updates = {};
    if (adminSingles !== "") updates.singlesElo = parseInt(adminSingles);
    if (adminDoubles !== "") updates.doublesElo = parseInt(adminDoubles);
    if (!Object.keys(updates).length) return setAdminStatus("Enter at least one ELO value.");
    await updateDoc(doc(db, "groups", groupId, "players", adminTarget), updates);
    setAdminStatus("ELO updated!");
    setAdminSingles(""); setAdminDoubles(""); setAdminTarget("");
    setTimeout(() => setAdminStatus(""), 3000);
  }

  async function resetPlayerElo() {
    if (!adminTarget) return setAdminStatus("Select a player.");
    if (!window.confirm("Reset this player to 1000 ELO?")) return;
    await updateDoc(doc(db, "groups", groupId, "players", adminTarget), {
      singlesElo: 1000, doublesElo: 1000,
    });
    setAdminStatus("Player reset to 1000 ELO.");
    setTimeout(() => setAdminStatus(""), 3000);
  }

  async function removePlayer() {
    if (!adminTarget) return setAdminStatus("Select a player.");
    if (!window.confirm("Remove this player from the group?")) return;
    // Remove from group players subcollection
    await deleteDoc(doc(db, "groups", groupId, "players", adminTarget));
    // Remove from group members array
    const current = groupDoc?.members ?? [];
    await updateDoc(doc(db, "groups", groupId), {
      members: current.filter(id => id !== adminTarget),
    });
    setAdminStatus("Player removed from group.");
    setAdminTarget("");
    setTimeout(() => setAdminStatus(""), 3000);
  }

  async function resetAllElos() {
    if (!window.confirm("Reset ALL players to 1000 ELO? This cannot be undone.")) return;
    const batch = writeBatch(db);
    players.forEach(p => {
      batch.update(doc(db, "groups", groupId, "players", p.id), {
        singlesElo: 1000, doublesElo: 1000, wins: 0, losses: 0,
      });
    });
    await batch.commit();
    setAdminStatus("All ELOs reset to 1000.");
    setTimeout(() => setAdminStatus(""), 3000);
  }

  // ── Group management ──
  async function renameGroup() {
    if (!groupName.trim()) return setGroupStatus("Enter a name.");
    await updateDoc(doc(db, "groups", groupId), { name: groupName.trim() });
    setGroupStatus("Group renamed!");
    setTimeout(() => setGroupStatus(""), 3000);
  }

  async function generateNewCode() {
    if (!window.confirm("Generate a new join code? The old one will stop working.")) return;
    const newCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    await updateDoc(doc(db, "groups", groupId), { code: newCode });
    setGroupStatus("New code generated!");
    setTimeout(() => setGroupStatus(""), 3000);
  }

  async function promotePlayer(uid) {
    const current = groupDoc?.admins ?? [];
    if (current.includes(uid)) {
      // Demote
      if (!window.confirm("Remove admin from this player?")) return;
      await updateDoc(doc(db, "groups", groupId), {
        admins: current.filter(id => id !== uid),
      });
      await updateDoc(doc(db, "groups", groupId, "players", uid), { isAdmin: false });
    } else {
      // Promote
      if (!window.confirm("Make this player an admin?")) return;
      await updateDoc(doc(db, "groups", groupId), {
        admins: [...current, uid],
      });
      await updateDoc(doc(db, "groups", groupId, "players", uid), { isAdmin: true });
    }
    setGroupStatus("Admin status updated.");
    setTimeout(() => setGroupStatus(""), 3000);
  }

  async function deleteGroup() {
    if (deleteGroupConfirm !== "DELETE GROUP") return setGroupStatus('Type DELETE GROUP to confirm.');
    if (groupDoc?.createdBy !== user.uid) return setGroupStatus("Only the group creator can delete it.");
    try {
      // Delete all subcollections
      const playerSnap = await getDocs(collection(db, "groups", groupId, "players"));
      const batch = writeBatch(db);
      playerSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      await deleteDoc(doc(db, "groups", groupId));
      setGroupStatus("Group deleted.");
    } catch (e) {
      setGroupStatus("Error: " + e.message);
    }
  }

  async function inviteByEmail() {
    if (!inviteEmail.trim()) return setInviteStatus("Enter an email.");
    // Find player in globalPlayers by email
    const snap = await getDocs(collection(db, "globalPlayers"));
    const match = snap.docs.find(d => d.data().email?.toLowerCase() === inviteEmail.trim().toLowerCase());
    if (!match) return setInviteStatus("No account found with that email. They need to sign up first.");
    const uid = match.id;
    if (groupDoc?.members?.includes(uid)) return setInviteStatus("That player is already in this group.");
    // Add to group
    await updateDoc(doc(db, "groups", groupId), {
      members: [...(groupDoc?.members ?? []), uid],
    });
    const globalData = match.data();
    await updateDoc(doc(db, "groups", groupId, "players", uid), {
      name: globalData.name ?? "",
      email: globalData.email ?? "",
      photoURL: globalData.photoURL ?? "",
      singlesElo: 1000,
      doublesElo: 1000,
      wins: 0,
      losses: 0,
      isAdmin: false,
    }).catch(async () => {
      // Player doc doesn't exist yet, create it
      const { setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "groups", groupId, "players", uid), {
        name: globalData.name ?? "",
        email: globalData.email ?? "",
        photoURL: globalData.photoURL ?? "",
        singlesElo: 1000,
        doublesElo: 1000,
        wins: 0,
        losses: 0,
        isAdmin: false,
      });
    });
    setInviteEmail("");
    setInviteStatus(`${globalData.name} added to the group!`);
    setTimeout(() => setInviteStatus(""), 4000);
  }

  // ── UI helpers ──
  const sectionLabel = title => (
    <div style={{ fontSize: 11, color: "var(--text-hint)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "1.5rem 0 0.75rem" }}>{title}</div>
  );

  const card = children => (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "1.25rem" }}>{children}</div>
  );

  const row = (label, control) => (
    <div style={{ marginBottom: "0.75rem" }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{label}</div>
      {control}
    </div>
  );

  const primaryBtn = (label, onClick, disabled = false) => (
    <button onClick={onClick} disabled={disabled} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 500, background: disabled ? "var(--border-mid)" : "var(--text)", color: disabled ? "var(--text-hint)" : "var(--bg)", border: "none", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", marginTop: 8, width: "100%" }}>
      {label}
    </button>
  );

  const dangerBtn = (label, onClick) => (
    <button onClick={onClick} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 500, background: "transparent", color: "#A32D2D", border: "1px solid #A32D2D", borderRadius: 8, cursor: "pointer", marginTop: 8, width: "100%" }}>
      {label}
    </button>
  );

  return (
    <div style={{ paddingBottom: "2rem" }}>

      {/* ── Appearance ── */}
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

      {/* ── Profile ── */}
      {sectionLabel("Profile")}
      {card(<>
        {row("Display name", <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />)}
        {primaryBtn("Save name", saveName)}
        {nameStatus && <div style={{ fontSize: 12, color: "#3B6D11", marginTop: 6 }}>{nameStatus}</div>}
      </>)}

      {/* ── ELO History ── */}
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
              <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "var(--text-secondary)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="singlesElo" stroke="#185FA5" strokeWidth={2} dot={false} name="Singles" />
              <Line type="monotone" dataKey="doublesElo" stroke="#3B6D11" strokeWidth={2} dot={false} name="Doubles" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </>)}

      {/* ── Admin: ELO tools ── */}
      {isAdmin && (<>
        {sectionLabel("Player ELO tools")}
        {card(<>
          {row("Select player", (
            <select value={adminTarget} onChange={e => setAdminTarget(e.target.value)}>
              <option value="">Select player</option>
              {players.filter(p => p.id !== user.uid).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Singles ELO</div>
              <input type="number" placeholder="e.g. 1200" value={adminSingles} onChange={e => setAdminSingles(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>Doubles ELO</div>
              <input type="number" placeholder="e.g. 1100" value={adminDoubles} onChange={e => setAdminDoubles(e.target.value)} />
            </div>
          </div>
          {primaryBtn("Apply ELO", applyAdminElo)}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            <button onClick={resetPlayerElo} style={{ padding: "8px 12px", fontSize: 13, background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-mid)", borderRadius: 8, cursor: "pointer" }}>Reset to 1000</button>
            <button onClick={removePlayer} style={{ padding: "8px 12px", fontSize: 13, background: "transparent", color: "#A32D2D", border: "1px solid #A32D2D", borderRadius: 8, cursor: "pointer" }}>Remove player</button>
          </div>
          {dangerBtn("Reset ALL players to 1000", resetAllElos)}
          {adminStatus && <div style={{ fontSize: 12, color: "#3B6D11", marginTop: 8 }}>{adminStatus}</div>}
        </>)}

        {/* ── Group management ── */}
        {sectionLabel("Group management")}
        {card(<>
          {/* Group code display */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--bg-secondary)", borderRadius: 8, marginBottom: "0.75rem" }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Join code</div>
              <div style={{ fontSize: 18, fontWeight: 500, color: "var(--text)", letterSpacing: 2 }}>
                {showCode ? groupDoc?.code ?? "—" : "••••••"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setShowCode(s => !s)} style={{ fontSize: 12, padding: "6px 12px", border: "1px solid var(--border-mid)", borderRadius: 8, background: "transparent", color: "var(--text)", cursor: "pointer" }}>
                {showCode ? "Hide" : "Show"}
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(groupDoc?.code ?? ""); setGroupStatus("Code copied!"); setTimeout(() => setGroupStatus(""), 2000); }}
                style={{ fontSize: 12, padding: "6px 12px", border: "1px solid var(--border-mid)", borderRadius: 8, background: "transparent", color: "var(--text)", cursor: "pointer" }}
              >
                Copy
              </button>
            </div>
          </div>

          {/* Rename */}
          {row("Group name", <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Group name" />)}
          {primaryBtn("Save name", renameGroup)}

          {/* New code */}
          <div style={{ marginTop: "0.75rem" }}>
            <button onClick={generateNewCode} style={{ fontSize: 13, padding: "8px 14px", border: "1px solid var(--border-mid)", borderRadius: 8, background: "transparent", color: "var(--text)", cursor: "pointer" }}>
              🔄 Generate new join code
            </button>
          </div>

          {groupStatus && <div style={{ fontSize: 12, color: "#3B6D11", marginTop: 8 }}>{groupStatus}</div>}
        </>)}

        {/* ── Invite ── */}
        {sectionLabel("Invite players")}
        {card(<>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: "1rem" }}>
            Generate an invite link to share anywhere, or send directly to an email address.
          </div>

          {/* ── Invite link ── */}
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 500 }}>Invite link</div>
            <InviteLinkGenerator groupId={groupId} groupDoc={groupDoc} userId={user.uid} />
          </div>

          {/* ── Email invite ── */}
          <div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6, fontWeight: 500 }}>Send by email</div>
            <EmailInviter groupId={groupId} groupDoc={groupDoc} userId={user.uid} userName={user.displayName} />
          </div>
        </>)}

        {/* ── Members & admin management ── */}
        {sectionLabel("Members")}
        {card(<>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {players.map(p => {
              const isGroupAdmin = groupDoc?.admins?.includes(p.id);
              const isCreator = groupDoc?.createdBy === p.id;
              const isMe = p.id === user.uid;
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 500, color: "var(--text)", flexShrink: 0 }}>
                    {p.name?.split(" ").map(w => w[0]).join("")}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>
                      {p.name} {isMe && <span style={{ fontSize: 11, color: "var(--text-hint)" }}>· you</span>}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-hint)" }}>
                      {isCreator ? "Creator" : isGroupAdmin ? "Admin" : "Member"}
                    </div>
                  </div>
                  {!isMe && !isCreator && (
                    <button
                      onClick={() => promotePlayer(p.id)}
                      style={{ fontSize: 11, padding: "4px 10px", borderRadius: 20, border: "1px solid var(--border-mid)", background: "transparent", color: isGroupAdmin ? "#A32D2D" : "#185FA5", cursor: "pointer" }}
                    >
                      {isGroupAdmin ? "Demote" : "Make admin"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>)}

        {/* ── Delete group (creator only) ── */}
        {groupDoc?.createdBy === user.uid && (<>
          {sectionLabel("Delete group")}
          {card(<>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: "0.75rem" }}>
              Permanently deletes this group and all its data. Type <strong>DELETE GROUP</strong> to confirm.
            </div>
            <input value={deleteGroupConfirm} onChange={e => setDeleteGroupConfirm(e.target.value)} placeholder="DELETE GROUP" />
            {dangerBtn("Delete group permanently", deleteGroup)}
            {groupStatus && <div style={{ fontSize: 12, color: "#A32D2D", marginTop: 6 }}>{groupStatus}</div>}
          </>)}
        </>)}
      </>)}

      {/* ── Danger zone ── */}
      {sectionLabel("Danger zone")}
      {card(<>
        <div style={{ fontSize: 14, fontWeight: 500, color: "#A32D2D", marginBottom: 4 }}>Delete account</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
          Permanently deletes your account. Type DELETE to confirm.
        </div>
        <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
        {dangerBtn("Delete my account", handleDelete)}
        {deleteStatus && <div style={{ fontSize: 12, color: "#A32D2D", marginTop: 6 }}>{deleteStatus}</div>}
      </>)}
    </div>
  );
}