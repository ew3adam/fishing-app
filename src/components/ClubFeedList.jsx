import { useState, useEffect, useRef } from "react";
import { loadClubFeedCatches, updateCatchLike, loadCatchComments, addCatchComment, deleteCatchComment } from "../services/fishingSyncService.js";
import { resolveCatchPhotoUrl } from "../services/catchPhotoStorage.js";
import { formatFeedSpotName } from "../utils/feedSpotPrivacy.js";

var THEMES = {
  dark:      { card:"rgba(255,255,255,0.06)", border:"#2a4a2a", green:"#6fcf6f", gold:"#d4a843", white:"#f0ece0", muted:"#8a9a7a" },
  light:     { card:"rgba(255,255,255,0.9)",  border:"#c0d4c0", green:"#2a7a2a", gold:"#a07010", white:"#1a2a1a", muted:"#5a7a5a" },
  bluesteel: { card:"rgba(255,255,255,0.06)", border:"#1a3050", green:"#40c0e0", gold:"#e0c040", white:"#e8f0f8", muted:"#6080a0" },
  beige:     { card:"#ffffff", border:"#e3dcc9", green:"#5b7a52", gold:"#a67c3d", white:"#2b2620", muted:"#8a8172" },
};

function memberFirstName(name) {
  if (!name) return "Member";
  return String(name).trim().split(/\s+/)[0];
}

function avatarInitial(name) {
  var n = memberFirstName(name);
  return n.charAt(0).toUpperCase() || "M";
}

export default function ClubFeedList({ authMember, T, setTab, onSignInClick }) {
  var th = THEMES[T] || THEMES.dark;
  var [posts, setPosts] = useState([]);
  var [loading, setLoading] = useState(false);
  var [refreshing, setRefreshing] = useState(false);
  var [pullY, setPullY] = useState(0);
  var [likeAnim, setLikeAnim] = useState({});
  var touchStartY = useRef(0);
  // Local: which posts you liked. Server: likeCount on catch doc (synced when rules allow).
  var [likes, setLikes] = useState(function() {
    try { return JSON.parse(localStorage.getItem("rfc_feed_likes_v1") || "{}"); } catch (e) { return {}; }
  });
  var [likeError, setLikeError] = useState("");
  // Guards toggleLike against a rapid double-tap on the same post: two click events fired back
  // to back both read `likes` from the same pre-update state closure (React hasn't flushed the
  // first tap's setLikes yet), so both would compute the same wasLiked and send the same +1/-1
  // delta twice -- silently double-counting the shared likeCount in Firestore. A ref (mutated
  // immediately, unlike state) is the actual guard; keyed per-post so liking two different posts
  // in quick succession still both go through. Same root cause as the double-submit bug fixed in
  // CatchTab.submitCatch (BUG-1, see docs/BUG-TRIAGE-AND-FEATURE-ROADMAP.md).
  var likeInFlightRef = useRef({});

  // Comments -- loaded lazily per post (only once a member expands that post's thread, not
  // eagerly for the whole feed) since each post's comments live in their own Firestore
  // subcollection read. commentCount on the post itself (bumped server-side by
  // addCatchComment/deleteCatchComment, same increment() pattern as likeCount) is what drives
  // the "N comments" badge before a thread is ever opened.
  var [commentsOpen, setCommentsOpen] = useState({});
  var [commentsByPost, setCommentsByPost] = useState({});
  var [commentsLoading, setCommentsLoading] = useState({});
  var [commentDraft, setCommentDraft] = useState({});
  var [commentSubmitting, setCommentSubmitting] = useState({});
  var [commentError, setCommentError] = useState("");

  function toggleComments(post) {
    var postId = String(post.id || post.memberId + "_" + post.date);
    var opening = !commentsOpen[postId];
    setCommentsOpen(function(prev) { return Object.assign({}, prev, { [postId]: opening }); });
    if (opening && !commentsByPost[postId]) {
      setCommentsLoading(function(prev) { return Object.assign({}, prev, { [postId]: true }); });
      loadCatchComments(post.memberId, post.id).then(function(rows) {
        setCommentsByPost(function(prev) { return Object.assign({}, prev, { [postId]: rows || [] }); });
      }).catch(function() {
        setCommentError("Couldn't load comments — deploy firebase rules for club-wide comments (see CLAUDE.md).");
        setCommentsByPost(function(prev) { return Object.assign({}, prev, { [postId]: [] }); });
      }).finally(function() {
        setCommentsLoading(function(prev) { return Object.assign({}, prev, { [postId]: false }); });
      });
    }
  }

  function submitComment(post) {
    var postId = String(post.id || post.memberId + "_" + post.date);
    var text = (commentDraft[postId] || "").trim();
    if (!text || commentSubmitting[postId] || !authMember) return;
    setCommentSubmitting(function(prev) { return Object.assign({}, prev, { [postId]: true }); });
    setCommentError("");
    var optimistic = { id: "local_" + Date.now(), authorId: authMember.id, authorName: authMember.name, text: text, createdAt: new Date().toISOString(), pending: true };
    setCommentsByPost(function(prev) {
      var existing = prev[postId] || [];
      return Object.assign({}, prev, { [postId]: existing.concat([optimistic]) });
    });
    setCommentDraft(function(prev) { return Object.assign({}, prev, { [postId]: "" }); });
    setPosts(function(prev) {
      return prev.map(function(p) {
        var pid = String(p.id || p.memberId + "_" + p.date);
        return pid === postId ? Object.assign({}, p, { commentCount: (p.commentCount || 0) + 1 }) : p;
      });
    });
    addCatchComment(post.memberId, post.id, authMember.id, authMember.name, text).then(function(saved) {
      setCommentsByPost(function(prev) {
        var existing = prev[postId] || [];
        return Object.assign({}, prev, { [postId]: existing.map(function(c) { return c.id === optimistic.id ? saved : c; }) });
      });
    }).catch(function() {
      setCommentError("Comment didn't save — deploy firebase rules for club-wide comments (see CLAUDE.md).");
      setCommentsByPost(function(prev) {
        var existing = prev[postId] || [];
        return Object.assign({}, prev, { [postId]: existing.filter(function(c) { return c.id !== optimistic.id; }) });
      });
      setPosts(function(prev) {
        return prev.map(function(p) {
          var pid = String(p.id || p.memberId + "_" + p.date);
          return pid === postId ? Object.assign({}, p, { commentCount: Math.max(0, (p.commentCount || 0) - 1) }) : p;
        });
      });
    }).finally(function() {
      setCommentSubmitting(function(prev) { return Object.assign({}, prev, { [postId]: false }); });
    });
  }

  function removeComment(post, comment) {
    var postId = String(post.id || post.memberId + "_" + post.date);
    setCommentsByPost(function(prev) {
      var existing = prev[postId] || [];
      return Object.assign({}, prev, { [postId]: existing.filter(function(c) { return c.id !== comment.id; }) });
    });
    setPosts(function(prev) {
      return prev.map(function(p) {
        var pid = String(p.id || p.memberId + "_" + p.date);
        return pid === postId ? Object.assign({}, p, { commentCount: Math.max(0, (p.commentCount || 0) - 1) }) : p;
      });
    });
    deleteCatchComment(post.memberId, post.id, comment.id).catch(function() {
      setCommentError("Couldn't delete that comment — try again.");
    });
  }

  function doLoad() {
    return loadClubFeedCatches()
      .then(function(rows) { setPosts(rows || []); })
      .catch(function() { setPosts([]); });
  }

  useEffect(function() {
    if (!authMember) return;
    setLoading(true);
    doLoad().finally(function() { setLoading(false); });
  }, [authMember ? authMember.id : null]);

  function onTouchStart(e) {
    touchStartY.current = e.touches[0].clientY;
  }
  function onTouchMove(e) {
    if (!authMember) return;
    var delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0 && window.scrollY === 0) {
      setPullY(Math.min(delta, 72));
    }
  }
  function onTouchEnd() {
    if (pullY >= 60) {
      setRefreshing(true);
      setPullY(0);
      doLoad().finally(function() { setRefreshing(false); });
    } else {
      setPullY(0);
    }
  }

  function toggleLike(post) {
    var postId = String(post.id || post.memberId + "_" + post.date);
    if (likeInFlightRef.current[postId]) return;
    likeInFlightRef.current[postId] = true;

    var wasLiked = !!likes[postId];
    var nextLikes = Object.assign({}, likes);
    if (wasLiked) delete nextLikes[postId];
    else nextLikes[postId] = true;
    setLikes(nextLikes);
    try { localStorage.setItem("rfc_feed_likes_v1", JSON.stringify(nextLikes)); } catch (e) {}

    setLikeAnim(function(prev) { return Object.assign({}, prev, { [postId]: true }); });
    setTimeout(function() {
      setLikeAnim(function(prev) { var n = Object.assign({}, prev); delete n[postId]; return n; });
    }, 350);

    setLikeError("");
    updateCatchLike(post.memberId, post.id, wasLiked ? -1 : 1).catch(function() {
      setLikeError("Like saved on this device only — deploy firebase rules for club-wide counts.");
      var revert = Object.assign({}, nextLikes);
      if (wasLiked) revert[postId] = true;
      else delete revert[postId];
      setLikes(revert);
      try { localStorage.setItem("rfc_feed_likes_v1", JSON.stringify(revert)); } catch (e) {}
      setPosts(function(prev) {
        return prev.map(function(p) {
          var pid = String(p.id || p.memberId + "_" + p.date);
          if (pid !== postId) return p;
          var delta = wasLiked ? 1 : -1;
          return Object.assign({}, p, { likeCount: Math.max(0, (p.likeCount || 0) + delta) });
        });
      });
    }).finally(function() {
      delete likeInFlightRef.current[postId];
    });

    setPosts(function(prev) {
      return prev.map(function(p) {
        var pid = String(p.id || p.memberId + "_" + p.date);
        if (pid !== postId) return p;
        var delta = wasLiked ? -1 : 1;
        return Object.assign({}, p, { likeCount: Math.max(0, (p.likeCount || 0) + delta) });
      });
    });
  }

  if (!authMember) {
    return (
      <div style={{ padding:"24px 0", textAlign:"center" }}>
        <div style={{ fontSize:15, color:th.white, fontWeight:700, marginBottom:8 }}>Riverside Fishing Club feed</div>
        <div style={{ fontSize:13, color:th.muted, lineHeight:1.5, marginBottom:16 }}>Sign in with your roster account to see member catches.</div>
        {setTab ? (
          <button type="button" onClick={function() { if (onSignInClick) onSignInClick(); else setTab("me"); }}
            style={{ background:th.green, color:"#000", border:"none", borderRadius:8, padding:"10px 18px", cursor:"pointer", fontSize:13, fontWeight:700 }}>
            Sign in
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ marginTop:4 }}
    >
      {(pullY > 12 || refreshing) && (
        <div style={{ textAlign:"center", padding:"8px 0", fontSize:22, color:th.green, transition:"opacity 0.2s", userSelect:"none" }}>
          {refreshing ? "🔄" : "🐟"}
        </div>
      )}

      {/* Explicit refresh button, not just the pull gesture above -- Home now stacks this feed
          below the Forecast content (it's no longer the sole/top scrollable view), so "pull
          down from the very top of the page" is an awkward, easy-to-miss way to reach this
          feed's own refresh. */}
      {!refreshing && (
        <div style={{ textAlign:"right", marginBottom:6 }}>
          <button type="button" onClick={function() { setRefreshing(true); doLoad().finally(function() { setRefreshing(false); }); }} style={{ background:"transparent", border:"none", color:th.green, cursor:"pointer", fontSize:11, fontWeight:700, padding:0 }}>
            🔄 Refresh
          </button>
        </div>
      )}

      {(loading && !refreshing) && (
        <div style={{ fontSize:13, color:th.muted, padding:"20px 0", textAlign:"center" }}>Loading club feed…</div>
      )}

      {!loading && posts.length === 0 && (
        <div style={{ padding:"24px 0", textAlign:"center" }}>
          <div style={{ fontSize:14, color:th.muted, lineHeight:1.55 }}>No club posts yet. Log a catch and choose Share with club.</div>
        </div>
      )}

      {likeError ? (
        <div style={{ fontSize:11, color:"#e09030", marginBottom:10, lineHeight:1.45 }}>{likeError}</div>
      ) : null}
      {commentError ? (
        <div style={{ fontSize:11, color:"#e09030", marginBottom:10, lineHeight:1.45 }}>{commentError}</div>
      ) : null}

      {posts.map(function(c) {
        var postId = String(c.id || c.memberId + "_" + c.date);
        var liked = !!likes[postId];
        var likeCount = c.likeCount || 0;
        var animating = !!likeAnim[postId];
        var spotLabel = formatFeedSpotName(c.spot, c.spotDisplayName);
        var commentCount = c.commentCount || 0;
        var threadOpen = !!commentsOpen[postId];
        var threadComments = commentsByPost[postId] || [];
        return (
          <article
            key={postId}
            style={{ background:th.card, border:"1px solid " + th.border, borderRadius:12, marginBottom:14, overflow:"hidden", animation:"fadeInUp 0.2s ease-out both" }}
          >
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px" }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:th.green + "33", border:"1px solid " + th.green, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:th.green, flexShrink:0 }}>
                {avatarInitial(c.memberName || c.user)}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, color:th.white, fontWeight:700 }}>{memberFirstName(c.memberName || c.user)}</div>
                <div style={{ fontSize:11, color:th.muted }}>{c.date || "Recent"}</div>
              </div>
            </div>
            {resolveCatchPhotoUrl(c) ? (
              <img src={resolveCatchPhotoUrl(c)} alt={c.species || "catch"} style={{ width:"100%", maxHeight:420, objectFit:"cover", display:"block", background:"#000" }} />
            ) : null}
            <div style={{ padding:"10px 12px 12px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <button
                  type="button"
                  onClick={function() { toggleLike(c); }}
                  style={{
                    background: liked ? th.green + "22" : "transparent",
                    border: "1px solid " + (liked ? th.green : th.border),
                    borderRadius:16,
                    padding:"5px 12px",
                    color: liked ? th.green : th.muted,
                    fontSize:12,
                    fontWeight:700,
                    cursor:"pointer",
                    display:"flex",
                    alignItems:"center",
                    gap:5,
                    animation: animating ? "likePop 0.3s ease-out" : "none",
                  }}
                >
                  <span>{liked ? "Nice fish ✓" : "Nice fish"}</span>
                  {likeCount > 0 && <span style={{ fontSize:11, opacity:0.8 }}>({likeCount})</span>}
                </button>
                <button
                  type="button"
                  onClick={function() { toggleComments(c); }}
                  style={{ background:threadOpen ? th.green + "22" : "transparent", border:"1px solid " + (threadOpen ? th.green : th.border), borderRadius:16, padding:"5px 12px", color:threadOpen ? th.green : th.muted, fontSize:12, fontWeight:700, cursor:"pointer" }}
                >
                  💬 {commentCount > 0 ? commentCount + (commentCount === 1 ? " comment" : " comments") : "Comment"}
                </button>
              </div>
              <div style={{ fontSize:14, color:th.white, fontWeight:700, marginBottom:4 }}>
                {c.species}
                {c.length ? <span style={{ color:th.green, fontWeight:600 }}> · {c.length}</span> : null}
              </div>
              {c.bait ? <div style={{ fontSize:12, color:th.muted, marginBottom:4 }}>🪱 {c.bait}</div> : null}
              {c.rod ? <div style={{ fontSize:12, color:th.muted, marginBottom:4 }}>🎣 {c.rod}</div> : null}
              <div style={{ fontSize:12, color:th.gold }}>{spotLabel}</div>
              {c.notes ? <div style={{ fontSize:12, color:th.white, marginTop:6, fontStyle:"italic", lineHeight:1.45 }}>{c.notes}</div> : null}
            </div>
            {threadOpen ? (
              <div style={{ borderTop:"1px solid " + th.border, padding:"10px 12px 12px" }}>
                {commentsLoading[postId] ? (
                  <div style={{ fontSize:12, color:th.muted, padding:"6px 0" }}>Loading comments…</div>
                ) : null}
                {!commentsLoading[postId] && threadComments.length === 0 ? (
                  <div style={{ fontSize:12, color:th.muted, padding:"4px 0 8px" }}>No comments yet — be the first.</div>
                ) : null}
                {threadComments.map(function(cm) {
                  var isMine = authMember && cm.authorId === authMember.id;
                  return (
                    <div key={cm.id} style={{ marginBottom:8, opacity:cm.pending ? 0.6 : 1 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:8 }}>
                        <span style={{ fontSize:12, color:th.white, fontWeight:700 }}>{memberFirstName(cm.authorName)}</span>
                        {isMine ? (
                          <button type="button" onClick={function() { removeComment(c, cm); }} style={{ background:"transparent", border:"none", color:th.muted, cursor:"pointer", fontSize:10, padding:0 }}>Delete</button>
                        ) : null}
                      </div>
                      <div style={{ fontSize:13, color:th.white, lineHeight:1.4 }}>{cm.text}</div>
                    </div>
                  );
                })}
                {authMember ? (
                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                    <input
                      value={commentDraft[postId] || ""}
                      onChange={function(e) { var v = e.target.value; setCommentDraft(function(prev) { return Object.assign({}, prev, { [postId]: v }); }); }}
                      onKeyDown={function(e) { if (e.key === "Enter") submitComment(c); }}
                      placeholder="Write a comment…"
                      style={{ flex:1, background:th.card, border:"1px solid " + th.border, borderRadius:16, padding:"7px 12px", color:th.white, fontSize:13, outline:"none" }}
                    />
                    <button
                      type="button"
                      onClick={function() { submitComment(c); }}
                      disabled={!((commentDraft[postId] || "").trim()) || commentSubmitting[postId]}
                      style={{ background:th.green, color:"#000", border:"none", borderRadius:16, padding:"0 16px", cursor:"pointer", fontSize:12, fontWeight:700, opacity:(commentDraft[postId] || "").trim() ? 1 : 0.5 }}
                    >
                      Post
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
