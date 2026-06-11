/**
 * Quick checks that Firebase roster + auth are reachable from the fishing app.
 */
import { listActiveMembers } from "./memberService.js";
import { getFirebaseAuth } from "../lib/firebase.js";
import { FIREBASE_PROJECT_ID } from "../lib/firebase.js";

/** Probe roster read access (signed-in or rules-dependent). */
export async function checkRosterHealth() {
  var result = {
    projectId: FIREBASE_PROJECT_ID,
    ok: false,
    activeMemberCount: 0,
    signedIn: false,
    message: "",
    error: null,
  };
  try {
    var auth = getFirebaseAuth();
    result.signedIn = !!auth.currentUser;
    var members = await listActiveMembers(200);
    result.activeMemberCount = members.length;
    result.ok = members.length > 0;
    if (members.length === 0) {
      result.message = "Firebase connected but no active roster members found. Import members in CRM.";
    } else {
      result.message = members.length + " active roster member(s) in cloud.";
    }
  } catch (e) {
    result.error = e && e.message ? e.message : String(e);
    result.message = "Could not read roster — check Firestore rules and sign-in.";
  }
  return result;
}
