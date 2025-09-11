export default function HeaderLogoOnly() {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid #e5e7eb",
        background: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div /> {/* empty left side to visually center the logo if you want */}
      <img
        src="/brand/logo.png" // <-- set to your logo path
        alt="Pacific Bathroom"
        style={{ height: 28, objectFit: "contain" }}
      />
    </header>
  );
}
