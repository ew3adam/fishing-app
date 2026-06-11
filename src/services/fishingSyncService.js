/**
 * Fishing-app profile + catches stored under CRM member doc (cross-device sync).
 * Path: members/{memberId}/fishingProfile/main
 *       members/{memberId}/fishingCatches/{catchId}
 */
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, increment } from "firebase/firestore";
import { getFirebaseDb } from "../lib/firebase.js";
import { listActiveMembers } from "./memberService.js";
import { uploadCatchPhoto, stripPhotoForFirestore, isDataUrlImage } from "./catchPhotoStorage.js";

function profileRef(memberId) {
  return doc(getFirebaseDb(), "members", memberId, "fishingProfile", "main");
}

function catchesCol(memberId) {
  return collection(getFirebaseDb(), "members", memberId, "fishingCatches");
}

/** Fields synced to cloud (excludes huge blobs). */
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

/** Upload photo if needed, then write catch doc without base64. */
async function prepareCatchDoc(memberId, catchEntry) {
  var id = String(catchEntry.id || Date.now());
  var photoUrl = catchEntry.photoUrl || null;
  if (!photoUrl && isDataUrlImage(catchEntry.photo)) {
    photoUrl = await uploadCatchPhoto(memberId, id, catchEntry.photo);
  }
  var docData = stripPhotoForFirestore(catchEntry);
  if (photoUrl) {
    docData.photoUrl = photoUrl;
  }
  if (docData.likeCount == null) {
    docData.likeCount = 0;
  }
  return { id: id, data: docData, photoUrl: photoUrl };
}

/** One-time merge: upload local catches not yet in cloud. */
export async function mergeLocalCatchesToCloud(memberId, localCatches) {
  if (!memberId || !Array.isArray(localCatches) || !localCatches.length) return;
  var existing = await getDocs(catchesCol(memberId));
  var existingIds = {};
  existing.docs.forEach(function(d) { existingIds[d.id] = true; });
  var i;
  for (i = 0; i < localCatches.length; i++) {
    var c = localCatches[i];
    var id = String(c.id || Date.now());
    if (existingIds[id]) continue;
    await saveCatchToCloud(memberId, c);
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

/** Save catch — photo to Storage, metadata to Firestore. */
export async function saveCatchToCloud(memberId, catchEntry) {
  if (!memberId || !catchEntry) return null;
  var prepared = await prepareCatchDoc(memberId, catchEntry);
  var ref = doc(catchesCol(memberId), prepared.id);
  await setDoc(ref, Object.assign({}, prepared.data, { syncedAt: new Date().toISOString() }), { merge: true });
  return { id: prepared.id, photoUrl: prepared.photoUrl };
}

/** Increment or decrement likeCount on a club-visible catch. */
export async function updateCatchLike(catchOwnerId, catchId, delta) {
  if (!catchOwnerId || !catchId || delta === 0) return;
  var ref = doc(getFirebaseDb(), "members", catchOwnerId, "fishingCatches", String(catchId));
  await updateDoc(ref, { likeCount: increment(delta) });
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

/** All members' spots flagged shareClub — for club map. */
export async function loadClubSharedSpots() {
  var members = await listActiveMembers(120);
  var spots = [];
  var i;
  for (i = 0; i < members.length; i++) {
    var m = members[i];
    try {
      var snap = await getDoc(profileRef(m.id));
      if (!snap.exists()) continue;
      var profile = snap.data() || {};
      (profile.privateSpots || []).forEach(function(s) {
        if (!s || !s.shareClub) return;
        spots.push(Object.assign({}, s, {
          memberId: m.id,
          credit: m.displayName || m.id,
        }));
      });
    } catch (e) { /* skip if rules block */ }
  }
  return spots.sort(function(a, b) {
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}
