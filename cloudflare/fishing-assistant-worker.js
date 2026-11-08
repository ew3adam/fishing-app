/**
 * RFC Fishing Assistant — Cloudflare Worker.
 *
 * Not part of the app's build (nothing here is imported by src/) — deployed separately, on its
 * own, via the Cloudflare dashboard, same pattern as buoy-proxy-worker.js (see
 * docs/BUOY-PROXY-DEPLOY.md). See docs/FISHING-ASSISTANT-DEPLOY.md for exact steps for this one.
 *
 * Why this exists: the fishing app is a static, client-side-only site (see CLAUDE.md) with no
 * server — a real Anthropic API key can never live in the browser bundle (anyone could read it
 * out of the page source and run up the bill). This Worker holds the key as a Cloudflare secret
 * and is the only thing that ever calls api.anthropic.com for this feature; the app calls this
 * Worker instead.
 *
 * Scope discipline (matches the rest of this app -- see CLAUDE.md's "never fabricate" practice):
 * the assistant is instructed to answer ONLY from the real context the client sends (current
 * weather, buoy report, nearby known spots, species bait tips) plus general fishing knowledge,
 * and to say it doesn't know rather than invent specifics (regs numbers, unverified locations,
 * safety determinations) it wasn't actually given. It is not a general-purpose chatbot.
 *
 * Auth: every request must carry a valid Firebase ID token for a real signed-in user of this
 * app's Firebase project (verified via Firebase's own accounts:lookup REST endpoint below, no
 * service account/admin key needed). This stops anonymous/bot traffic from running up the
 * Anthropic bill against an openly-reachable Worker URL. It is NOT a full active-roster check
 * (that already happens client-side in authService.js) -- a brand-new Firebase account that
 * never completes roster verification could theoretically hold a valid token for a short window.
 * Acceptable for a small club app's realistic threat model (the cost risk is stray/bot traffic
 * finding the URL, not a determined member bypassing their own club's roster gate); tighten this
 * later if it ever actually matters.
 */

var FIREBASE_API_KEY = "AIzaSyCcuCrZISXcroQcYnwaGacRTu2INwXwtO4"; // public web key, safe to embed (see src/lib/firebase.js)
var FIREBASE_PROJECT_ID = "rfc-management";
var ANTHROPIC_MODEL = "claude-haiku-5-5"; // short grounded Q&A -- no reason to pay for a bigger model here
var MAX_TOKENS = 500;
var MAX_HISTORY_TURNS = 6; // caps request size/cost; older turns are dropped client-side too

var SYSTEM_PROMPT = [
  "You are the RFC Fishing Assistant, built into the Riverside Fishing Club's member app for the Chicago/Lake Michigan area.",
  "Answer ONLY using the CONTEXT block provided in each message (current weather, buoy/shore conditions, nearby known spots, species bait tips) plus your general fishing knowledge (techniques, species behavior, gear).",
  "Never invent specific facts you were not given: exact regulations/bag limits/license rules, real-time conditions not in the CONTEXT block, or the existence/location of a fishing spot not in the CONTEXT or general public knowledge you're confident about.",
  "For regulations questions, say you don't have live/current numbers and point to the official state DNR site instead of guessing a figure.",
  "If the CONTEXT doesn't cover something (e.g. conditions at a spot not listed), say so plainly rather than guessing — do not pretend to have live data you weren't given.",
  "If asked something unrelated to fishing, the club, or this app, say that's outside what you can help with here.",
  "Keep answers short and mobile-friendly — a few sentences, plain text, no markdown headers.",
].join(" ");

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, corsHeaders(origin)),
  });
}

/** Verifies a Firebase ID token via Firebase's own REST endpoint -- no admin SDK/service account needed. */
async function verifyFirebaseToken(idToken) {
  if (!idToken) return null;
  var res = await fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + FIREBASE_API_KEY,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: idToken }) }
  );
  if (!res.ok) return null;
  var data = await res.json();
  var user = data && data.users && data.users[0];
  return user || null;
}

export default {
  async fetch(request, env) {
    var origin = request.headers.get("Origin") || "*";
    if (request.method === "OPTIONS") return jsonResponse({}, 204, origin);
    if (request.method !== "POST") return jsonResponse({ error: "POST only" }, 405, origin);

    if (!env.ANTHROPIC_API_KEY) {
      return jsonResponse({ error: "Worker not configured — missing ANTHROPIC_API_KEY secret. See docs/FISHING-ASSISTANT-DEPLOY.md." }, 500, origin);
    }

    var authHeader = request.headers.get("Authorization") || "";
    var idToken = authHeader.indexOf("Bearer ") === 0 ? authHeader.slice(7) : "";
    var user;
    try {
      user = await verifyFirebaseToken(idToken);
    } catch (e) {
      return jsonResponse({ error: "Sign-in check failed. Try again." }, 502, origin);
    }
    if (!user) return jsonResponse({ error: "Sign in to use the fishing assistant." }, 401, origin);

    var body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ error: "Invalid request body." }, 400, origin);
    }
    var message = String((body && body.message) || "").trim().slice(0, 2000);
    if (!message) return jsonResponse({ error: "Empty message." }, 400, origin);
    var context = String((body && body.context) || "").slice(0, 4000);
    var history = Array.isArray(body && body.history) ? body.history.slice(-1 * MAX_HISTORY_TURNS) : [];

    var messages = history
      .filter(function (h) { return h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string"; })
      .map(function (h) { return { role: h.role, content: h.content.slice(0, 2000) }; });
    messages.push({ role: "user", content: "CONTEXT:\n" + (context || "(none available)") + "\n\nQUESTION:\n" + message });

    var anthropicRes;
    try {
      anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          messages: messages,
        }),
      });
    } catch (e) {
      return jsonResponse({ error: "Could not reach the assistant right now. Try again." }, 502, origin);
    }
    if (!anthropicRes.ok) {
      var errText = "";
      try { errText = (await anthropicRes.text()).slice(0, 300); } catch (e2) {}
      return jsonResponse({ error: "Assistant request failed: " + anthropicRes.status + (errText ? " — " + errText : "") }, 502, origin);
    }
    var data = await anthropicRes.json();
    var reply = (data.content && data.content[0] && data.content[0].text) || "";
    if (!reply) return jsonResponse({ error: "No response from the assistant. Try rephrasing." }, 502, origin);

    return jsonResponse({ reply: reply }, 200, origin);
  },
};
