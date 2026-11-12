/**
 * Floating chat bubble on Home — "Ask the Fishing Assistant." Talks to a Cloudflare Worker
 * (cloudflare/rfc-helper/worker.js (/assistant), docs/RFC-HELPER-DEPLOY.md) that holds the real
 * Anthropic API key server-side; this component never sees that key. Scoped to fishing/app
 * questions by the Worker's own system prompt, grounded in the `contextSummary` text HomeTab
 * builds from real current data (weather, buoy report, nearby spots, species tips) — see
 * CLAUDE.md's "never fabricate" practice, which this inherits rather than works around.
 */
import { useState, useRef, useEffect } from "react";
import { helperUrl } from "../lib/rfcHelper.js";
import { getFirebaseAuth } from "../lib/firebase.js";

var THEMES = {
  dark:      { card:"#16241a", border:"#2a4a2a", green:"#6fcf6f", white:"#f0ece0", muted:"#8a9a7a", bubbleUser:"#2a4a2a" },
  light:     { card:"#ffffff", border:"#c0d4c0", green:"#2a7a2a", white:"#1a2a1a", muted:"#5a7a5a", bubbleUser:"#e0ece0" },
  bluesteel: { card:"#101c2c", border:"#1a3050", green:"#40c0e0", white:"#e8f0f8", muted:"#6080a0", bubbleUser:"#163049" },
  beige:     { card:"#ffffff", border:"#e3dcc9", green:"#5b7a52", white:"#2b2620", muted:"#8a8172", bubbleUser:"#eef0e8" },
};

var FISHING_ASSISTANT_URL = helperUrl("/assistant"); // RFC Helper route (cloudflare/rfc-helper/)

export default function FishingAssistant({ T, authMember, contextSummary }) {
  var th = THEMES[T] || THEMES.dark;
  var [open, setOpen] = useState(false);
  var [messages, setMessages] = useState([]); // {role:"user"|"assistant", content}
  var [input, setInput] = useState("");
  var [sending, setSending] = useState(false);
  var [error, setError] = useState("");
  var scrollRef = useRef(null);

  useEffect(function() {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  if (!authMember) return null; // cost control: only ever reachable signed in (see RFC-HELPER-DEPLOY.md)

  function sendMessage() {
    var text = input.trim();
    if (!text || sending) return;
    if (!FISHING_ASSISTANT_URL) {
      setError("The fishing assistant isn't set up yet — see docs/RFC-HELPER-DEPLOY.md.");
      return;
    }
    var history = messages.slice(-6);
    var nextMessages = messages.concat([{ role:"user", content:text }]);
    setMessages(nextMessages);
    setInput("");
    setError("");
    setSending(true);

    var auth = getFirebaseAuth();
    var user = auth.currentUser;
    (user ? user.getIdToken() : Promise.reject(new Error("Not signed in")))
      .then(function(idToken) {
        return fetch(FISHING_ASSISTANT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + idToken },
          body: JSON.stringify({ message: text, context: contextSummary || "", history: history }),
        });
      })
      .then(function(res) {
        return res.json().then(function(data) { return { ok: res.ok, data: data }; });
      })
      .then(function(result) {
        if (!result.ok || !result.data || !result.data.reply) {
          setError((result.data && result.data.error) || "The assistant couldn't answer that. Try again.");
          return;
        }
        setMessages(function(prev) { return prev.concat([{ role:"assistant", content:result.data.reply }]); });
      })
      .catch(function() {
        setError("Couldn't reach the assistant — check your connection and try again.");
      })
      .finally(function() { setSending(false); });
  }

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={function() { setOpen(true); }}
          style={{
            position:"fixed", right:16, bottom:76, zIndex:150,
            background:th.green, color:"#fff", border:"none", borderRadius:28,
            width:56, height:56, fontSize:24, cursor:"pointer",
            boxShadow:"0 4px 14px rgba(0,0,0,0.3)", display:"flex", alignItems:"center", justifyContent:"center",
          }}
          aria-label="Ask the Fishing Assistant"
        >
          🎣
        </button>
      ) : (
        <div style={{
          position:"fixed", inset:0, zIndex:200, background:"rgba(0,0,0,0.5)",
          display:"flex", alignItems:"flex-end",
        }} onClick={function(e) { if (e.target === e.currentTarget) setOpen(false); }}>
          <div style={{
            background:th.card, width:"100%", maxHeight:"75vh", borderTopLeftRadius:16, borderTopRightRadius:16,
            display:"flex", flexDirection:"column", border:"1px solid " + th.border, borderBottom:"none",
          }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderBottom:"1px solid " + th.border }}>
              <div style={{ fontSize:15, fontWeight:700, color:th.white }}>🎣 Fishing Assistant</div>
              <button type="button" onClick={function() { setOpen(false); }} style={{ background:"transparent", border:"none", color:th.muted, fontSize:20, cursor:"pointer", padding:4 }}>✕</button>
            </div>
            <div ref={scrollRef} style={{ flex:1, overflowY:"auto", padding:"12px 16px", minHeight:120 }}>
              {messages.length === 0 ? (
                <div style={{ fontSize:12, color:th.muted, lineHeight:1.5 }}>
                  Ask about conditions, nearby spots, species, or bait — answered from this app's real data where it has it. It won't guess at regs numbers or made-up specifics.
                </div>
              ) : null}
              {messages.map(function(m, i) {
                var isUser = m.role === "user";
                return (
                  <div key={i} style={{ display:"flex", justifyContent:isUser ? "flex-end" : "flex-start", marginBottom:8 }}>
                    <div style={{
                      maxWidth:"82%", padding:"8px 12px", borderRadius:14,
                      background: isUser ? th.bubbleUser : "transparent",
                      border: isUser ? "none" : "1px solid " + th.border,
                      color:th.white, fontSize:13, lineHeight:1.45, whiteSpace:"pre-wrap",
                    }}>
                      {m.content}
                    </div>
                  </div>
                );
              })}
              {sending ? <div style={{ fontSize:12, color:th.muted, fontStyle:"italic" }}>Thinking…</div> : null}
              {error ? <div style={{ fontSize:12, color:"#e05050", marginTop:4 }}>{error}</div> : null}
            </div>
            <div style={{ display:"flex", gap:8, padding:"10px 12px 14px", borderTop:"1px solid " + th.border }}>
              <input
                type="text"
                value={input}
                onChange={function(e) { setInput(e.target.value); }}
                onKeyDown={function(e) { if (e.key === "Enter") sendMessage(); }}
                placeholder="Ask about conditions, spots, bait…"
                style={{ flex:1, background:"transparent", border:"1px solid " + th.border, borderRadius:8, padding:"10px 12px", color:th.white, fontSize:13, outline:"none" }}
              />
              <button type="button" onClick={sendMessage} disabled={sending || !input.trim()} style={{ background:th.green, color:"#fff", border:"none", borderRadius:8, padding:"0 16px", fontSize:13, fontWeight:700, cursor:"pointer", opacity:(sending || !input.trim()) ? 0.5 : 1 }}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
