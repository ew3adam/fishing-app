/**
 * RFC CRM members collection — roster lookup and club directory.
 * Document ID: firstname_lastname (e.g. adam_bielawski).
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  orderBy,
  limit,
} from "firebase/firestore";
import { getFirebaseDb } from "../lib/firebase.js";

/** Trim and lowercase email for matching. */
export function normalizeEmail(email) {
  return String(email || "").replace(/\s+/g, "").trim().toLowerCase();
}

/** Basic email format check. */
export function isValidEmail(email) {
  var e = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** Digits only for phone storage compare. */
export function normalizePhoneDigits(phone) {
  return String(phone || "").replace(/\D/g, "");
}

/** Display US phone as (###) ###-#### when 10 digits. */
export function formatPhoneUS(phone) {
  var digits = normalizePhoneDigits(phone);
  var core = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (core.length === 10) {
    return "(" + core.slice(0, 3) + ") " + core.slice(3, 6) + "-" + core.slice(6);
  }
  return String(phone || "").trim();
}

/** Map Firestore member doc to app shape. */
export function mapMemberDoc(id, data) {
  var d = data || {};
  return {
    id: id,
    firstName: String(d.firstName || "").trim(),
    lastName: String(d.lastName || "").trim(),
    email: normalizeEmail(d.email),
    phone: String(d.phone || "").trim(),
    isActive: d.isActive !== false,
    membershipType: d.membershipType || "Regular",
    authUid: d.authUid || null,
    role: d.role === "admin" ? "admin" : "member",
    displayName: [d.firstName, d.lastName].filter(Boolean).join(" ").trim(),
  };
}

/** Find roster member by email (case-insensitive). */
export async function findMemberByEmail(email) {
  var normalized = normalizeEmail(email);
  if (!normalized || !isValidEmail(normalized)) {
    return null;
  }
  var db = getFirebaseDb();
  var q = query(collection(db, "members"), where("email", "==", normalized), limit(5));
  var snap = await getDocs(q);
  if (snap.empty) {
    // CRM import may store mixed-case email — try original trimmed if different
    var alt = String(email || "").replace(/\s+/g, "").trim();
    if (alt && alt !== normalized) {
      q = query(collection(db, "members"), where("email", "==", alt), limit(5));
      snap = await getDocs(q);
    }
  }
  if (snap.empty) {
    return null;
  }
  var docSnap = snap.docs[0];
  return mapMemberDoc(docSnap.id, docSnap.data());
}

/** Load member by Firestore document id. */
export async function getMemberById(memberId) {
  var id = String(memberId || "").trim();
  if (!id) return null;
  var ref = doc(getFirebaseDb(), "members", id);
  var snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapMemberDoc(snap.id, snap.data());
}

/** Link Firebase Auth uid to CRM member record after roster-approved sign-in. */
export async function linkAuthUidToMember(memberId, authUid) {
  if (!memberId || !authUid) return;
  var ref = doc(getFirebaseDb(), "members", memberId);
  await updateDoc(ref, { authUid: authUid, lastFishingAppLoginAt: new Date().toISOString() });
}

/** Active club members for directory (requires Firestore read rules). */
export async function listActiveMembers(maxCount) {
  var cap = maxCount != null ? maxCount : 200;
  var db = getFirebaseDb();
  var q = query(
    collection(db, "members"),
    where("isActive", "==", true),
    orderBy("lastName"),
    limit(cap)
  );
  try {
    var snap = await getDocs(q);
    return snap.docs
      .map(function(d) { return mapMemberDoc(d.id, d.data()); })
      .filter(function(m) { return m.email || m.displayName; });
  } catch (e) {
    // Fallback if composite index missing — fetch all active without orderBy
    var q2 = query(collection(db, "members"), where("isActive", "==", true), limit(cap));
    var snap2 = await getDocs(q2);
    return snap2.docs
      .map(function(d) { return mapMemberDoc(d.id, d.data()); })
      .filter(function(m) { return m.email || m.displayName; })
      .sort(function(a, b) { return (a.lastName || "").localeCompare(b.lastName || ""); });
  }
}
