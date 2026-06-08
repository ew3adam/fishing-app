/**
 * Resize and compress photos in the browser before localStorage / Firebase save.
 * Applies EXIF orientation so photos are not upside-down after compress.
 */

import exifr from "exifr";

var DEFAULT_MAX_EDGE = 1280;
var DEFAULT_JPEG_QUALITY = 0.82;

function b64ToApproxBytes(b64) {
  if (!b64) return 0;
  return Math.round((b64.length * 3) / 4);
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function readExifOrientation(file) {
  if (!file) return Promise.resolve(1);
  return exifr.parse(file, { pick: ["Orientation"] })
    .then(function(meta) { return (meta && meta.Orientation) || 1; })
    .catch(function() { return 1; });
}

function orientedCanvasSize(w, h, orientation) {
  if (orientation >= 5 && orientation <= 8) return { width: h, height: w };
  return { width: w, height: h };
}

function applyExifTransform(ctx, w, h, orientation) {
  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, w, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, w, h); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, h); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, h, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, h, w); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, w); break;
    default: break;
  }
}

function drawImageToCanvas(img, orientation) {
  var srcW = img.width;
  var srcH = img.height;
  var size = orientedCanvasSize(srcW, srcH, orientation || 1);
  var canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  var ctx = canvas.getContext("2d");
  applyExifTransform(ctx, srcW, srcH, orientation || 1);
  ctx.drawImage(img, 0, 0);
  return canvas;
}

function canvasToCompressed(canvas, opts) {
  var options = opts || {};
  var maxEdge = options.maxEdge || DEFAULT_MAX_EDGE;
  var quality = options.quality != null ? options.quality : DEFAULT_JPEG_QUALITY;
  var w = canvas.width;
  var h = canvas.height;
  var scale = Math.max(w, h) > maxEdge ? maxEdge / Math.max(w, h) : 1;
  var nw = Math.max(1, Math.round(w * scale));
  var nh = Math.max(1, Math.round(h * scale));
  var out = document.createElement("canvas");
  out.width = nw;
  out.height = nh;
  var ctx = out.getContext("2d");
  ctx.drawImage(canvas, 0, 0, nw, nh);
  var full = out.toDataURL("image/jpeg", quality);
  var b64 = (full && full.split(",")[1]) || "";
  return {
    full: full,
    b64: b64,
    type: "image/jpeg",
    width: nw,
    height: nh,
    bytes: b64ToApproxBytes(b64),
    bytesLabel: formatBytes(b64ToApproxBytes(b64)),
  };
}

/** Compress an existing data URL (e.g. after manual rotate). */
export function compressDataUrl(dataUrl, opts) {
  return new Promise(function(resolve, reject) {
    var img = new Image();
    img.onload = function() {
      try {
        var canvas = drawImageToCanvas(img, 1);
        resolve(canvasToCompressed(canvas, opts));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = function() { reject(new Error("image_load_failed")); };
    img.src = dataUrl;
  });
}

/** Read a File, fix EXIF orientation, resize, return compressed data URL + base64. */
export function compressImageFile(file, opts) {
  return readExifOrientation(file).then(function(orientation) {
    return new Promise(function(resolve, reject) {
      if (!file) {
        reject(new Error("no_file"));
        return;
      }
      var reader = new FileReader();
      reader.onload = function(ev) {
        var img = new Image();
        img.onload = function() {
          try {
            var canvas = drawImageToCanvas(img, orientation);
            resolve(canvasToCompressed(canvas, opts));
          } catch (e) {
            reject(e);
          }
        };
        img.onerror = function() { reject(new Error("image_load_failed")); };
        img.src = ev.target.result;
      };
      reader.onerror = function() { reject(new Error("read_failed")); };
      reader.readAsDataURL(file);
    });
  });
}

export { formatBytes, b64ToApproxBytes };
