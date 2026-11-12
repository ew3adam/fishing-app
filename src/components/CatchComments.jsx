import { useState, useEffect } from "react";
import { loadCatchComments, addCatchComment, deleteCatchComment } from "../services/fishingSyncService.js";
import { getFirebaseAuth } from "../lib/firebase.js";

// Facebook-style comment list + box for one Club Feed post. Loads when the post is shown.
export default function CatchComments({ post, authMember, th, open, onCount }) {
  var [items, setItems] = useState([]);
  var [text, setText] = useState("");
  var [busy, setBusy] = useState(false);
  var [err, setErr] = useState("");
  var me = getFirebaseAuth().currentUser;

  useEffect(function() {
    var cancelled = false;
    loadCatchComments(post.memberId, post.id).then(function(list) {
      if (cancelled) return;
      setItems(list);
      if (onCount) onCount(list.length);
    }).catch(function() { /* rules not deployed yet, or offline */ });
    return function() { cancelled = true; };
  }, [post.memberId, post.id]);

  function send() {
    var t = text.trim();
    if (!t || busy || !me) return;
    setBusy(true); setErr("");
    addCatchComment(post.memberId, post.id, { uid: me.uid, id: authMember && authMember.id, name: (authMember && authMember.displayName) || "Member" }, t).then(function(c) {
      var next = items.concat([c]);
      setItems(next); setText("");
      if (onCount) onCount(next.length);
    }).catch(function() {
      setErr("Could not post your comment. Try again.");
    }).finally(function() { setBusy(false); });
  }

  function remove(c) {
    if (!window.confirm("Delete this comment?")) return;
    deleteCatchComment(post.memberId, post.id, c.id).then(function() {
      var next = items.filter(function(x) { return x.id !== c.id; });
      setItems(next);
      if (onCount) onCount(next.length);
    }).catch(function() { setErr("Could not delete the comment."); });
  }

  if (!open) return null;
  var isPostOwner = authMember && authMember.id === post.memberId;
  return (
    <div style={{ borderTop:"1px solid " + th.border, padding:"8px 12px 12px" }}>
      {items.map(function(c) {
        var mine = me && c.authorUid === me.uid;
        return (
          <div key={c.id} style={{ display:"flex", gap:8, marginBottom:8, alignItems:"flex-start" }}>
            <div style={{ width:28, height:28, borderRadius:"50%", background:th.green + "33", border:"1px solid " + th.green, color:th.green, fontSize:12, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              {String(c.authorName || "M").charAt(0).toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ background:th.border + "55", borderRadius:12, padding:"6px 10px", display:"inline-block", maxWidth:"100%" }}>
                <div style={{ fontSize:12, color:th.white, fontWeight:700 }}>{c.authorName || "Member"}</div>
                <div style={{ fontSize:13, color:th.white, lineHeight:1.4, wordBreak:"break-word" }}>{c.text}</div>
              </div>
              <div style={{ fontSize:10, color:th.muted, marginTop:2, paddingLeft:10 }}>
                {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""}
                {mine || isPostOwner ? <button type="button" onClick={function() { remove(c); }} style={{ background:"none", border:"none", color:th.muted, fontSize:10, cursor:"pointer", textDecoration:"underline", marginLeft:8, padding:0 }}>Delete</button> : null}
              </div>
            </div>
          </div>
        );
      })}
      <div style={{ display:"flex", gap:6, marginTop:4 }}>
        <input value={text} maxLength={500} onChange={function(e) { setText(e.target.value); }} onKeyDown={function(e) { if (e.key === "Enter") send(); }} placeholder="Write a comment..." aria-label="Write a comment"
          style={{ flex:1, minWidth:0, background:th.card, border:"1px solid " + th.border, borderRadius:18, padding:"8px 12px", color:th.white, fontSize:13, outline:"none" }} />
        <button type="button" onClick={send} disabled={busy || !text.trim()} style={{ background:"transparent", border:"none", color:th.green, fontWeight:700, fontSize:13, cursor:text.trim() ? "pointer" : "default", opacity:text.trim() ? 1 : 0.5 }}>Post</button>
      </div>
      {err ? <div style={{ fontSize:11, color:"#c0392b", marginTop:4 }}>{err}</div> : null}
    </div>
  );
}
