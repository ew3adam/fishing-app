import { useState, useEffect } from "react";
import { loadClubFeedCatches } from "../services/fishingSyncService.js";
import { formatFeedSpotName } from "../utils/feedSpotPrivacy.js";

var THEMES = {
  dark: { card: "rgba(255,255,255,0.06)", border: "#2a4a2a", green: "#6fcf6f", gold: "#d4a843", white: "#f0ece0", muted: "#8a9a7a" },
  light: { card: "rgba(255,255,255,0.9)", border: "#c0d4c0", green: "#2a7a2a", gold: "#a07010", white: "#1a2a1a", muted: "#5a7a5a" },
  bluesteel: { card: "rgba(255,255,255,0.06)", border: "#1a3050", green: "#40c0e0", gold: "#e0c040", white: "#e8f0f8", muted: "#6080a0" },
};

function memberFirstName(name) {
  if (!name) return "Member";
  return String(name).trim().split(/\s+/)[0];
}

function avatarInitial(name) {
  var n = memberFirstName(name);
  return n.charAt(0).toUpperCase() || "M";
}

/**
 * Instagram-style vertical club feed.
 */
export default function ClubFeedList({ authMember, T, setTab, onSignInClick }) {
  var th = THEMES[T] || THEMES.dark;
  var [posts, setPosts] = useState([]);
  var [loading, setLoading] = useState(false);
  var [likes, setLikes] = useState(function() {
    try {
      return JSON.parse(localStorage.getItem("rfc_feed_likes_v1") || "{}");
    } catch (e) {
      return {};
    }
  });

  useEffect(function() {
    if (!authMember) return;
    setLoading(true);
    loadClubFeedCatches()
      .then(function(rows) {
        setPosts(rows || []);
      })
      .catch(function() {
        setPosts([]);
      })
      .finally(function() {
        setLoading(false);
      });
  }, [authMember ? authMember.id : null]);

  function toggleLike(postId) {
    setLikes(function(prev) {
      var next = Object.assign({}, prev);
      if (next[postId]) delete next[postId];
      else next[postId] = true;
      try {
        localStorage.setItem("rfc_feed_likes_v1", JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }

  if (!authMember) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center" }}>
        <div style={{ fontSize: 15, color: th.white, fontWeight: 700, marginBottom: 8 }}>Riverside Fishing Club feed</div>
        <div style={{ fontSize: 13, color: th.muted, lineHeight: 1.5, marginBottom: 16 }}>
          Sign in with your roster account to see member catches.
        </div>
        {setTab ? (
          <button
            type="button"
            onClick={function() {
              if (onSignInClick) onSignInClick();
              else setTab("me");
            }}
            style={{ background: th.green, color: "#000", border: "none", borderRadius: 8, padding: "10px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}
          >
            Sign in
          </button>
        ) : null}
      </div>
    );
  }

  if (loading) {
    return <div style={{ fontSize: 13, color: th.muted, padding: "20px 0", textAlign: "center" }}>Loading club feed…</div>;
  }

  if (!posts.length) {
    return (
      <div style={{ padding: "24px 0", textAlign: "center" }}>
        <div style={{ fontSize: 14, color: th.muted, lineHeight: 1.55 }}>
          No club posts yet. Log a catch and choose Share with club.
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 4 }}>
      {posts.map(function(c) {
        var postId = String(c.id || c.memberId + "_" + c.date);
        var liked = !!likes[postId];
        var spotLabel = formatFeedSpotName(c.spot, c.spotDisplayName);
        return (
          <article
            key={postId}
            style={{
              background: th.card,
              border: "1px solid " + th.border,
              borderRadius: 12,
              marginBottom: 14,
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: th.green + "33",
                  border: "1px solid " + th.green,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontWeight: 800,
                  color: th.green,
                }}
              >
                {avatarInitial(c.memberName || c.user)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: th.white, fontWeight: 700 }}>{memberFirstName(c.memberName || c.user)}</div>
                <div style={{ fontSize: 11, color: th.muted }}>{c.date || "Recent"}</div>
              </div>
            </div>
            {c.photo ? (
              <img
                src={c.photo}
                alt={c.species || "catch"}
                style={{ width: "100%", maxHeight: 420, objectFit: "cover", display: "block", background: "#000" }}
              />
            ) : null}
            <div style={{ padding: "10px 12px 12px" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button
                  type="button"
                  onClick={function() { toggleLike(postId); }}
                  style={{
                    background: liked ? th.green + "22" : "transparent",
                    border: "1px solid " + (liked ? th.green : th.border),
                    borderRadius: 16,
                    padding: "5px 12px",
                    color: liked ? th.green : th.muted,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {liked ? "Nice fish ✓" : "Nice fish"}
                </button>
              </div>
              <div style={{ fontSize: 14, color: th.white, fontWeight: 700, marginBottom: 4 }}>
                {c.species}
                {c.length ? <span style={{ color: th.green, fontWeight: 600 }}> · {c.length}</span> : null}
              </div>
              {c.bait ? <div style={{ fontSize: 12, color: th.muted, marginBottom: 4 }}>{c.bait}</div> : null}
              <div style={{ fontSize: 12, color: th.gold }}>{spotLabel}</div>
              {c.notes ? (
                <div style={{ fontSize: 12, color: th.white, marginTop: 6, fontStyle: "italic", lineHeight: 1.45 }}>{c.notes}</div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
