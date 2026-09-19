/**
 * Top-level render-error catch — without this, any uncaught error thrown during
 * render anywhere in the tree white-screens the whole app with no recovery UI
 * (React unmounts everything below the nearest boundary). Must be a class
 * component; React has no hook equivalent for componentDidCatch.
 */
import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error: error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("Uncaught render error:", error, info && info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    var err = this.state.error;
    return (
      <div style={{ minHeight:"100vh", background:"#0d1a0d", color:"#f0ece0", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, textAlign:"center", fontFamily:"system-ui, sans-serif" }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🎣</div>
        <div style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Something went wrong</div>
        <div style={{ fontSize:13, color:"#8a9a7a", marginBottom:20, maxWidth:320, lineHeight:1.5 }}>
          The app hit an unexpected error. Your catches and spots are still saved on this device — reloading usually fixes this.
        </div>
        <button
          type="button"
          onClick={function() { window.location.reload(); }}
          style={{ background:"#6fcf6f", color:"#000", border:"none", borderRadius:8, padding:"11px 22px", fontSize:14, fontWeight:700, cursor:"pointer", marginBottom:16 }}
        >
          Reload the app
        </button>
        <details style={{ fontSize:11, color:"#8a9a7a", maxWidth:340 }}>
          <summary style={{ cursor:"pointer" }}>Technical details</summary>
          <div style={{ marginTop:8, textAlign:"left", whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{String((err && err.message) || err)}</div>
        </details>
      </div>
    );
  }
}
