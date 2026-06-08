/**
 * Westcott-style ruler drawn ON TOP of the photo (not in a side strip).
 * Shows when the photo has no physical ruler in the shot.
 */
export default function EmbeddedRulerOverlay({ orientation, totalInches, show }) {
  if (!show) return null;
  var inches = totalInches || 20;
  var isVert = orientation === "vertical";

  if (isVert) {
    return (
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "16%",
          pointerEvents: "none",
          background: "linear-gradient(90deg, rgba(0,0,0,0.15) 0%, rgba(196,165,116,0.92) 35%, rgba(154,120,72,0.95) 100%)",
          borderLeft: "2px solid rgba(40,30,15,0.6)",
          zIndex: 4,
        }}
      >
        {Array.from({ length: inches + 1 }).map(function(_, i) {
          var top = (i / inches) * 100;
          var major = i % 5 === 0;
          return (
            <div key={"vt_" + i} style={{ position: "absolute", top: top + "%", left: 0, right: 0, height: major ? 2 : 1, background: major ? "#1a1a1a" : "rgba(20,20,20,0.7)" }}>
              {major ? (
                <span style={{ position: "absolute", left: 4, top: -8, fontSize: 9, fontWeight: 700, color: "#111", fontFamily: "Arial,sans-serif", textShadow: "0 0 2px #fff" }}>{i}</span>
              ) : null}
            </div>
          );
        })}
        <div style={{ position: "absolute", bottom: 4, left: 2, right: 2, fontSize: 8, color: "#3d3020", fontWeight: 700, textAlign: "center", opacity: 0.8 }}>20 IN</div>
      </div>
    );
  }

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: "16%",
        pointerEvents: "none",
        background: "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(196,165,116,0.92) 40%, rgba(154,120,72,0.95) 100%)",
        borderTop: "2px solid rgba(40,30,15,0.6)",
        zIndex: 4,
      }}
    >
      {Array.from({ length: inches + 1 }).map(function(_, i) {
        var left = (i / inches) * 100;
        var major = i % 5 === 0;
        return (
          <div key={"hz_" + i} style={{ position: "absolute", left: left + "%", bottom: 0, width: major ? 2 : 1, height: major ? "55%" : "35%", background: major ? "#1a1a1a" : "rgba(20,20,20,0.7)" }}>
            {major ? (
              <span style={{ position: "absolute", bottom: "100%", left: -4, fontSize: 9, fontWeight: 700, color: "#111", fontFamily: "Arial,sans-serif", textShadow: "0 0 2px #fff" }}>{i}</span>
            ) : null}
          </div>
        );
      })}
      <div style={{ position: "absolute", right: 6, top: 2, fontSize: 8, color: "#3d3020", fontWeight: 700, opacity: 0.8 }}>WESTCOTT 20 IN</div>
    </div>
  );
}
