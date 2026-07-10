/**
 * Quick checks that Firebase roster + auth are reachable from the fishing app.
 */
import { listActiveMembers } from "./memberService.js";
import { getFirebaseAuth } from "../lib/firebase.js";
import { FIREBASE_PROJECT_ID } from "../lib/firebase.js";

/** Probe roster read access. Skips the Firestore read when not signed in (rules require auth). */
export async function checkRosterHealth() {
  var result = {
    projectId: FIREBASE_PROJECT_ID,
    ok: true,
    activeMemberCount: 0,
    signedIn: false,
    message: null,
    error: null,
  };
  var auth = getFirebaseAuth();
  result.signedIn = !!auth.currentUser;
  if (!result.signedIn) {
    return result;
  }
  try {
    var members = await listActiveMembers(200);
    result.activeMemberCount = members.length;
    result.ok = members.length > 0;
    result.message = members.length > 0
      ? members.length + " active roster member(s) in cloud."
      : "Firebase connected but no active roster members found.";
  } catch (e) {
    result.ok = false;
    result.error = e && e.message ? e.message : String(e);
    result.message = "Could not read roster — check Firestore rules.";
  }
  return result;
}
