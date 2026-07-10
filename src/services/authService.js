/**
 * Sign-in with roster gate — only emails on Firestore members collection may stay signed in.
 */
import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { getFirebaseAuth } from "../lib/firebase.js";
import { findMemberByEmail, linkAuthUidToMember, normalizeEmail } from "./memberService.js";
import { loadFishingProfileFromCloud, saveFishingProfileToCloud } from "./fishingSyncService.js";
import { getAuthProviderConfig } from "../config/authProviders.js";

var ROSTER_BLOCK_MSG = "Not an RFC member — contact the club admin.";
var OAUTH_NOT_CONFIGURED_MSG = "This sign-in method is not configured yet. Add API keys in .env.local (see .env.example).";

/** Email/password sign-in; rejects if email not on active roster. */
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

/** Self-serve first-time signup — roster-gated; rolls back Auth account if email not on roster. */
export async function signUpMemberEmail(email, password) {
  var auth = getFirebaseAuth();
  var normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error("Enter a valid email address.");
  }
  if (String(password || "").length < 10) {
    throw new Error("Password must be at least 10 characters.");
  }

  var cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, normalized, password);
  } catch (e) {
    if (e && e.code === "auth/email-already-in-use") {
      throw new Error("An account with this email already exists — use Sign in instead.");
    }
    throw e;
  }

  var user = cred.user;
  var member;
  try {
    member = await findMemberByEmail(user.email || normalized);
  } catch (e) {
    try { await deleteUser(user); } catch (_) {}
    throw e;
  }

  if (!member || !member.isActive || !member.email) {
    await deleteUser(user);
    throw new Error(ROSTER_BLOCK_MSG);
  }

  await linkAuthUidToMember(member.id, user.uid);
  return { user: user, member: member };
}

/** Send Firebase password-reset email; only if email is on the active roster. */
export async function sendMemberPasswordReset(email) {
  var normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error("Enter a valid email address.");
  }
  await sendPasswordResetEmail(getFirebaseAuth(), normalized);
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
