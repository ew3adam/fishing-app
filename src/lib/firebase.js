/**
 * Firebase client bootstrap — shared project rfc-management (RFC CRM + Fishing App).
 */
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

function env(key) {
  return String(import.meta.env[key] ?? "").replace(/\s+/g, "").trim();
}

/** Public web config — env overrides defaults from RFC Firebase repo. */
function buildConfig() {
  return {
    apiKey: env("VITE_FIREBASE_API_KEY") || "AIzaSyCcuCrZISXcroQcYnwaGacRTu2INwXwtO4",
    authDomain: env("VITE_FIREBASE_AUTH_DOMAIN") || "rfc-management.firebaseapp.com",
    projectId: env("VITE_FIREBASE_PROJECT_ID") || "rfc-management",
    storageBucket: env("VITE_FIREBASE_STORAGE_BUCKET") || "rfc-management.firebasestorage.app",
    messagingSenderId: env("VITE_FIREBASE_MESSAGING_SENDER_ID") || "735823982199",
    appId: env("VITE_FIREBASE_APP_ID") || "1:735823982199:web:8cb020909236a108b22072",
  };
}

export function getFirebaseApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  return initializeApp(buildConfig());
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

export function getFirebaseDb() {
  return getFirestore(getFirebaseApp());
}

export function getFirebaseStorage() {
  return getStorage(getFirebaseApp());
}

export const FIREBASE_PROJECT_ID = buildConfig().projectId;
