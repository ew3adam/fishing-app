/** Brief save/sync feedback banner (success, error, info). */
export default function SaveToast({ toast }) {
  if (!toast || !toast.message) return null;
  var bg = toast.type === "error" ? "#5a2020" : toast.type === "info" ? "#2a3a4a" : "#1a3a1a";
  var border = toast.type === "error" ? "#e05050" : toast.type === "info" ? "#5a9fd4" : "#6fcf6f";
  var color = toast.type === "error" ? "#ffb0b0" : toast.type === "info" ? "#c8e0ff" : "#b8f0b8";
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        top: 56,
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 28px)",
        maxWidth: 452,
        zIndex: 200,
        background: bg,
        border: "1px solid " + border,
        borderRadius: 10,
        padding: "10px 14px",
        fontSize: 13,
        lineHeight: 1.45,
        color: color,
        boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
        animation: "fadeInUp 0.2s ease-out both",
      }}
    >
      {toast.message}
    </div>
  );
}
