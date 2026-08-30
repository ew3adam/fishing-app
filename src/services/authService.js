/**
 * Sign-in with roster gate — only emails on Firestore members collection may stay signed in.
 * Primary flow: passwordless email link (sendSignInLink / completeSignInWithLink).
 * Fallback: email + password for members who set up passwords previously.
 */
import {
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { getFirebaseAuth } from "../lib/firebase.js";
import { findMemberByEmail, linkAuthUidToMember, normalizeEmail } from "./memberService.js";
import { loadFishingProfileFromCloud, saveFishingProfileToCloud } from "./fishingSyncService.js";
import { getAuthProviderConfig } from "../config/authProviders.js";

var ROSTER_BLOCK_MSG = "Your email isn't on the club list. Ask the club president to add you first.";
var OAUTH_NOT_CONFIGURED_MSG = "This sign-in option isn't set up yet. Contact the club admin.";
var EMAIL_SIGN_IN_KEY = "rfc_sign_in_email";

// Canonical production URL for the sign-in continue link (BUG-6 in
// docs/BUG-TRIAGE-AND-FEATURE-ROADMAP.md). This app deploys to both GitHub Pages (the actual
// `npm run deploy` target, per CLAUDE.md) and Cloudflare Pages, and Cloudflare also spins up a
// fresh preview subdomain per branch/PR. Deriving the link from window.location at send time
// meant whoever clicked "send me a link" could embed a throwaway preview URL that 404s once the
// PR closes -- or one Firebase's Authorized domains list never had added, which is exactly the
// auth/unauthorized-continue-uri failure noted in docs/dev-session-log.md. GitHub Pages is the
// canonical production URL going forward; every member gets a link to this address regardless
// of which domain they happened to be on when they hit "send link."
var CANONICAL_SIGN_IN_URL = "https://ew3adam.github.io/fishing-app/";

/** window.location only in local dev, so `npm run dev` keeps working with no extra setup. */
function signInLinkUrl() {
  if (import.meta.env.DEV) {
    return window.location.origin + window.location.pathname;
  }
  return CANONICAL_SIGN_IN_URL;
}

/**
 * Send a passwordless sign-in link to the member's club email.
 * The link opens the app and completeSignInWithLink finishes the flow.
 * Stores the email in localStorage so same-device completion works automatically.
 */
export async function sendSignInLink(email) {
  var normalized = normalizeEmail(email);
  if (!normalized) throw new Error("Type a valid email address.");
  var settings = {
    url: signInLinkUrl(),
    handleCodeInApp: true,
  };
  await sendSignInLinkToEmail(getFirebaseAuth(), normalized, settings);
  window.localStorage.setItem(EMAIL_SIGN_IN_KEY, normalized);
}

/** Returns true if the given URL contains a Firebase email sign-in link. */
export function isSignInLink(href) {
  return isSignInWithEmailLink(getFirebaseAuth(), href);
}

/**
 * Complete sign-in from an email link — same device that requested it.
 * Returns { needsEmail: true } when localStorage has no email (different device).
 * Returns { user, member } on success.
 */
export async function completeSignInWithLink(href) {
  var auth = getFirebaseAuth();
  var email = window.localStorage.getItem(EMAIL_SIGN_IN_KEY) || "";
  if (!email) return { needsEmail: true };
  var cred = await signInWithEmailLink(auth, email, href);
  var user = cred.user;
  window.localStorage.removeItem(EMAIL_SIGN_IN_KEY);
  var member = await findMemberByEmail(user.email || email);
  if (!member || !member.isActive || !member.email) {
    await signOut(auth);
    throw new Error(ROSTER_BLOCK_MSG);
  }
  await linkAuthUidToMember(member.id, user.uid);
  return { user: user, member: member };
}

/**
 * Complete sign-in when the email must be confirmed (opened link on a different device).
 */
export async function completeSignInWithLinkAndEmail(email, href) {
  var auth = getFirebaseAuth();
  var normalized = normalizeEmail(email);
  if (!normalized) throw new Error("Type a valid email address.");
  var cred = await signInWithEmailLink(auth, normalized, href);
  var user = cred.user;
  window.localStorage.removeItem(EMAIL_SIGN_IN_KEY);
  var member = await findMemberByEmail(user.email || normalized);
  if (!member || !member.isActive || !member.email) {
    await signOut(auth);
    throw new Error(ROSTER_BLOCK_MSG);
  }
  await linkAuthUidToMember(member.id, user.uid);
  return { user: user, member: member };
}

/** Email/password fallback sign-in; rejects if email not on active roster. */
export async function signInMemberEmail(email, password) {
  var auth = getFirebaseAuth();
  var normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error("Enter a valid email address.");
  }
  if (String(password || "").length < 10) {
    throw new Error("Password must be at least 10 characters.");
  }

  // Auth first — Firestore roster read requires signed-in user per security rules
  var cred = await signInWithEmailAndPassword(auth, normalized, password);
  var user = cred.user;

  var memberAfter = await findMemberByEmail(user.email || normalized);
  if (!memberAfter || !memberAfter.isActive || !memberAfter.email) {
    await signOut(auth);
    throw new Error(ROSTER_BLOCK_MSG);
  }

  await linkAuthUidToMember(memberAfter.id, user.uid);
  return { user: user, member: memberAfter };
}

export async function signOutMember() {
  await signOut(getFirebaseAuth());
}

/**
 * Subscribe to auth state; resolves member from roster when signed in.
 * callback(user, member, errorMessage)
 */
export function subscribeAuthState(callback) {
  var auth = getFirebaseAuth();
  return onAuthStateChanged(auth, async function(user) {
    if (!user) {
      callback(null, null, null);
      return;
    }
    try {
      var member = await findMemberByEmail(user.email || "");
      if (!member || !member.isActive) {
        await signOut(auth);
        callback(null, null, ROSTER_BLOCK_MSG);
        return;
      }
      if (member.authUid !== user.uid) {
        await linkAuthUidToMember(member.id, user.uid);
        member.authUid = user.uid;
      }
      callback(user, member, null);
    } catch (e) {
      callback(user, null, e.message || "Sign-in check failed.");
    }
  });
}

/** Push local fishing profile to Firestore after sign-in. */
export async function syncLocalProfileToCloud(memberId, localProfile) {
  if (!memberId || !localProfile) return;
  await saveFishingProfileToCloud(memberId, localProfile);
}

/** Pull cloud fishing profile and merge with local fields. */
export async function pullCloudProfile(memberId, localProfile) {
  if (!memberId) return localProfile;
  return loadFishingProfileFromCloud(memberId, localProfile);
}

/** Future OAuth — throws until VITE_* client IDs are set and Firebase Console providers enabled. */
export async function signInMemberOAuth(providerId) {
  var cfg = getAuthProviderConfig();
  if (providerId === "google" && cfg.google.enabled) {
    throw new Error("Google sign-in wiring pending — client ID is set; enable in Firebase Console next.");
  }
  if (providerId === "facebook" && cfg.facebook.enabled) {
    throw new Error("Facebook sign-in wiring pending — app ID is set; enable in Firebase Console next.");
  }
  if (providerId === "phone" && cfg.phone.enabled) {
    throw new Error("Phone sign-in wiring pending — enable Phone Auth in Firebase Console next.");
  }
  if (providerId === "apple" && cfg.apple.enabled) {
    throw new Error("Apple sign-in wiring pending — enable in Firebase Console next.");
  }
  throw new Error(OAUTH_NOT_CONFIGURED_MSG);
}

export { ROSTER_BLOCK_MSG, OAUTH_NOT_CONFIGURED_MSG };
