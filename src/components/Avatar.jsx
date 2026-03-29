export default function Avatar({ player, size = 34, fontSize = 13 }) {
  const initials = player?.name?.split(" ").map(w => w[0]).join("").toUpperCase() ?? "?";

  if (player?.photoURL) {
    return (
      <img
        src={player.photoURL}
        alt={player.name}
        referrerPolicy="no-referrer"
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "var(--bg-secondary)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize, fontWeight: 500, color: "var(--text)", flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}