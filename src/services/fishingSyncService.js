/**
 * Fishing-app profile + catches stored under CRM member doc (cross-device sync).
 * Path: members/{memberId}/fishingProfile/main
 *       members/{memberId}/fishingCatches/{catchId}
 */
import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from "firebase/firestore";
import { getFirebaseDb } from "../lib/firebase.js";
import { listActiveMembers } from "./memberService.js";

function profileRef(memberId) {
  return doc(getFirebaseDb(), "members", memberId, "fishingProfile", "main");
}

function catchesCol(memberId) {
  return collection(getFirebaseDb(), "members", memberId, "fishingCatches");
}

/** Fields synced to cloud (excludes huge blobs if needed later). */
function pickSyncProfile(profile) {
  var p = profile || {};
  return {
    level: p.level || "Beginner",
    favSpecies: Array.isArray(p.favSpecies) ? p.favSpecies : [],
    favSpots: Array.isArray(p.favSpots) ? p.favSpots : [],
    gear: Array.isArray(p.gear) ? p.gear : [],
    privateSpots: Array.isArray(p.privateSpots) ? p.privateSpots : [],
    spotActivityLog: Array.isArray(p.spotActivityLog) ? p.spotActivityLog : [],
    updatedAt: new Date().toISOString(),
  };
}

export async function loadFishingProfileFromCloud(memberId, localProfile) {
  var ref = profileRef(memberId);
  var snap = await getDoc(ref);
  if (!snap.exists()) {
    return localProfile;
  }
  var cloud = snap.data() || {};
  var local = localProfile || {};
  // Cloud wins for synced fields when present; keep local name/email from member record
  var merged = Object.assign({}, local, {
    level: cloud.level || local.level,
    favSpecies: cloud.favSpecies || local.favSpecies,
    favSpots: cloud.favSpots || local.favSpots,
    gear: cloud.gear && cloud.gear.length ? cloud.gear : local.gear,
    privateSpots: cloud.privateSpots && cloud.privateSpots.length ? cloud.privateSpots : local.privateSpots,
    spotActivityLog: cloud.spotActivityLog || local.spotActivityLog,
    memberId: memberId,
    cloudSyncedAt: cloud.updatedAt || new Date().toISOString(),
  });
  return merged;
}

export async function saveFishingProfileToCloud(memberId, profile) {
  if (!memberId) return;
  await setDoc(profileRef(memberId), pickSyncProfile(profile), { merge: true });
}

/** One-time merge: upload local catches not yet in cloud. */
export async function mergeLocalCatchesToCloud(memberId, localCatches) {
  if (!memberId || !Array.isArray(localCatches) || !localCatches.length) return;
  var col = catchesCol(memberId);
  var existing = await getDocs(col);
  var existingIds = {};
  existing.docs.forEach(function(d) { existingIds[d.id] = true; });
  var batch = writeBatch(getFirebaseDb());
  var ops = 0;
  localCatches.forEach(function(c) {
    var id = String(c.id || Date.now());
    if (existingIds[id]) return;
    var ref = doc(col, id);
    batch.set(ref, Object.assign({}, c, { syncedAt: new Date().toISOString() }), { merge: true });
    ops += 1;
  });
  if (ops > 0) {
    await batch.commit();
  }
}

/** Load catches from cloud into local array shape. */
export async function loadCatchesFromCloud(memberId) {
  if (!memberId) return [];
  var snap = await getDocs(catchesCol(memberId));
  return snap.docs.map(function(d) {
    return Object.assign({ id: d.id }, d.data());
  }).sort(function(a, b) {
    return (b.id || 0) - (a.id || 0);
  });
}

/** Sign-in sync: merge local catches up, then load cloud as source of truth. */
export async function syncCatchesForMember(memberId) {
  if (!memberId) return [];
  var local = [];
  try {
    local = JSON.parse(localStorage.getItem("rfc_catches_v1") || "[]");
  } catch (e) { local = []; }
  await mergeLocalCatchesToCloud(memberId, local);
  var cloud = await loadCatchesFromCloud(memberId);
  if (cloud.length) {
    try { localStorage.setItem("rfc_catches_v1", JSON.stringify(cloud)); } catch (e) {}
  }
  return cloud;
}

export async function saveCatchToCloud(memberId, catchEntry) {
  if (!memberId || !catchEntry) return;
  var id = String(catchEntry.id || Date.now());
  var ref = doc(catchesCol(memberId), id);
  await setDoc(ref, Object.assign({}, catchEntry, { syncedAt: new Date().toISOString() }), { merge: true });
}

/** Club-wide feed — catches with visibility club or public_feed from all active members. */
export async function loadClubFeedCatches() {
  var members = await listActiveMembers(120);
  var feed = [];
  var i;
  for (i = 0; i < members.length; i++) {
    var m = members[i];
    try {
      var snap = await getDocs(catchesCol(m.id));
      snap.docs.forEach(function(d) {
        var data = d.data() || {};
        if (data.visibility === "club" || data.visibility === "public_feed") {
          feed.push(Object.assign({}, data, {
            id: d.id,
            memberId: m.id,
            memberName: m.displayName || m.id,
          }));
        }
      });
    } catch (e) { /* skip member if rules block */ }
  }
  return feed.sort(function(a, b) {
    return String(b.date || b.id || "").localeCompare(String(a.date || a.id || ""));
  });
}
