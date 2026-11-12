import { useState, useEffect, useRef } from "react";
import { loadClubFeedCatches, updateCatchLike } from "../services/fishingSyncService.js";
import { resolveCatchPhotoUrl } from "../services/catchPhotoStorage.js";
import { formatFeedSpotName } from "../utils/feedSpotPrivacy.js";
import CatchComments from "./CatchComments.jsx";
import { THEMES } from "../theme.js";


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
  var [openComments, setOpenComments] = useState({});
  var [commentCounts, setCommentCounts] = useState({});

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
            style={{ background:th.green, color:th.onGreen, border:"none", borderRadius:8, padding:"10px 18px", cursor:"pointer", fontSize:13, fontWeight:700 }}>
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

      {posts.map(function(c) {
        var postId = String(c.id || c.memberId + "_" + c.date);
        var liked = !!likes[postId];
        var likeCount = c.likeCount || 0;
        var animating = !!likeAnim[postId];
        var spotLabel = formatFeedSpotName(c.spot, c.spotDisplayName);
        return (
          <article
            key={postId}
            style={{ background:th.card, border:"1px solid " + th.border, borderRadius:12, marginBottom:14, overflow:"hidden", animation:"fadeInUp 0.2s ease-out both" }}
          >
            {/* Header: who, when, where (Facebook-style) */}
            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px" }}>
              <div style={{ width:40, height:40, borderRadius:"50%", background:th.green + "33", border:"1px solid " + th.green, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:800, color:th.green, flexShrink:0 }}>
                {avatarInitial(c.memberName || c.user)}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, color:th.white, fontWeight:700 }}>{c.memberName || c.user || "Member"}</div>
                <div style={{ fontSize:11, color:th.muted }}>{(c.date || "Recent") + (spotLabel ? " \u00b7 \ud83d\udccd " + spotLabel : "")}</div>
              </div>
            </div>
            {/* What was caught */}
            <div style={{ padding:"0 12px 10px" }}>
              <div style={{ fontSize:14, color:th.white, lineHeight:1.45 }}>
                Caught a <b>{c.species || "fish"}</b>{c.length ? <span> {"\u00b7"} <b style={{ color:th.green }}>{c.length}</b></span> : null}{c.estWeight ? <span style={{ color:th.muted }}> (~{c.estWeight})</span> : null}
              </div>
              {c.bait ? <div style={{ fontSize:12, color:th.muted, marginTop:2 }}>{"Bait: " + c.bait}</div> : null}
              {c.notes ? <div style={{ fontSize:13, color:th.white, marginTop:4, lineHeight:1.45 }}>{c.notes}</div> : null}
            </div>
            {/* Photo(s): one full width, or a grid when there are several */}
            {(function() {
              var photos = (Array.isArray(c.photoUrls) && c.photoUrls.length ? c.photoUrls : [resolveCatchPhotoUrl(c)]).filter(Boolean).slice(0, 4);
              if (!photos.length) return null;
              if (photos.length === 1) return <img src={photos[0]} alt={c.species || "catch"} style={{ width:"100%", maxHeight:460, objectFit:"cover", display:"block", background:"#000" }} />;
              return (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:2, background:"#000" }}>
                  {photos.map(function(u, pi) { return <img key={pi} src={u} alt={(c.species || "catch") + " photo " + (pi + 1)} style={{ width:"100%", height:180, objectFit:"cover", display:"block" }} />; })}
                </div>
              );
            })()}
            {/* Counts */}
            {(likeCount > 0 || commentCounts[postId] > 0) ? (
              <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 12px 0", fontSize:12, color:th.muted }}>
                <span>{likeCount > 0 ? "\ud83d\udc4d " + likeCount : ""}</span>
                <button type="button" onClick={function() { setOpenComments(function(o) { return Object.assign({}, o, { [postId]: !o[postId] }); }); }} style={{ background:"none", border:"none", color:th.muted, fontSize:12, cursor:"pointer", padding:0 }}>
                  {commentCounts[postId] > 0 ? commentCounts[postId] + (commentCounts[postId] === 1 ? " comment" : " comments") : ""}
                </button>
              </div>
            ) : null}
            {/* Action bar: Like, Comment (no Share for now) */}
            <div style={{ display:"flex", borderTop:"1px solid " + th.border, margin:"8px 12px 0" }}>
              <button type="button" onClick={function() { toggleLike(c); }} aria-pressed={liked}
                style={{ flex:1, background:"transparent", border:"none", padding:"9px 0", color:liked ? th.green : th.muted, fontSize:13, fontWeight:700, cursor:"pointer", animation: animating ? "likePop 0.3s ease-out" : "none" }}>
                {"\ud83d\udc4d " + (liked ? "Liked" : "Like")}
              </button>
              <button type="button" onClick={function() { setOpenComments(function(o) { return Object.assign({}, o, { [postId]: !o[postId] }); }); }}
                style={{ flex:1, background:"transparent", border:"none", padding:"9px 0", color:openComments[postId] ? th.green : th.muted, fontSize:13, fontWeight:700, cursor:"pointer" }}>
                {"\ud83d\udcac Comment"}
              </button>
            </div>
            <CatchComments post={c} authMember={authMember} th={th} open={!!openComments[postId]}
              onCount={function(n) { setCommentCounts(function(m) { return Object.assign({}, m, { [postId]: n }); }); }} />
          </article>
        );
      })}
    </div>
  );
}
