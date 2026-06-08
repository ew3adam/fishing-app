/**
 * Queue catches when offline — sync when back online.
 */
import { saveCatchToCloud } from "./fishingSyncService.js";

var OUTBOX_KEY = "rfc_catch_outbox_v1";

function readOutbox() {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]");
  } catch (e) { return []; }
}

function writeOutbox(rows) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(rows || []));
  } catch (e) {}
}

export function enqueueCatch(memberId, catchEntry) {
  if (!memberId || !catchEntry) return;
  var box = readOutbox();
  box.push({
    memberId: memberId,
    catchEntry: catchEntry,
    queuedAt: new Date().toISOString(),
  });
  writeOutbox(box);
}

export function getOutboxCount() {
  return readOutbox().length;
}

export async function flushCatchOutbox() {
  if (!navigator.onLine) return { flushed: 0 };
  var box = readOutbox();
  if (!box.length) return { flushed: 0 };
  var remaining = [];
  var flushed = 0;
  for (var i = 0; i < box.length; i++) {
    var row = box[i];
    try {
      await saveCatchToCloud(row.memberId, row.catchEntry);
      flushed += 1;
    } catch (e) {
      remaining.push(row);
    }
  }
  writeOutbox(remaining);
  return { flushed: flushed, remaining: remaining.length };
}

export function installOutboxSync() {
  function tryFlush() {
    flushCatchOutbox().catch(function() {});
  }
  window.addEventListener("online", tryFlush);
  tryFlush();
}
