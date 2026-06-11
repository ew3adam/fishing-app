/**
 * Upload catch photos to Firebase Storage — keep Firestore docs small (no base64).
 */
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { getFirebaseStorage } from "../lib/firebase.js";

/** True when value is a data-URL image blob. */
export function isDataUrlImage(value) {
  return typeof value === "string" && value.indexOf("data:image") === 0;
}

/** Resize/compress before upload to stay under Storage limits. */
function compressDataUrl(dataUrl, maxDim, quality) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = function() {
      var w = img.width;
      var h = img.height;
      var scale = Math.min(1, maxDim / Math.max(w, h));
      var cw = Math.round(w * scale);
      var ch = Math.round(h * scale);
      var canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, cw, ch);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = function() { reject(new Error("Could not read photo for upload.")); };
    img.src = dataUrl;
  });
}

/** Upload catch photo; returns HTTPS download URL. */
export async function uploadCatchPhoto(memberId, catchId, photoDataUrl) {
  if (!memberId || !catchId || !isDataUrlImage(photoDataUrl)) {
    return null;
  }
  var compressed = await compressDataUrl(photoDataUrl, 1200, 0.82);
  var path = "members/" + memberId + "/catches/" + catchId + "/photo.jpg";
  var storageRef = ref(getFirebaseStorage(), path);
  await uploadString(storageRef, compressed, "data_url");
  return getDownloadURL(storageRef);
}

/** Display URL for catch cards and feed (Storage URL or legacy base64). */
export function resolveCatchPhotoUrl(catchEntry) {
  if (!catchEntry) return null;
  return catchEntry.photoUrl || catchEntry.photo || null;
}

/** Remove base64 photo field before writing to Firestore. */
export function stripPhotoForFirestore(entry) {
  var copy = Object.assign({}, entry || {});
  if (isDataUrlImage(copy.photo)) {
    delete copy.photo;
  }
  return copy;
}
