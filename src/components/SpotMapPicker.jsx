import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix Leaflet default pin icons when bundled with Vite.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

var LONG_PRESS_MS = 500;
var LONG_PRESS_CANCEL_PX = 10;

/**
 * Press-and-hold (Google Maps convention) to place or move a pin — not a plain tap, so panning or
 * pinch-zooming over the map never accidentally drops/moves the pin mid-gesture.
 */
function attachLongPress(map, onFire) {
  var timer = null;
  var start = null;

  function clear() {
    if (timer) { clearTimeout(timer); timer = null; }
    start = null;
  }

  function pointFromEvent(e) {
    var t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
    return { x: t.clientX, y: t.clientY };
  }

  function onStart(e) {
    if (e.touches && e.touches.length > 1) { clear(); return; } // ignore multi-touch (pinch)
    start = pointFromEvent(e);
    var originEvent = (e.touches && e.touches[0]) || e;
    timer = setTimeout(function() {
      timer = null;
      var containerPoint = map.mouseEventToContainerPoint(originEvent);
      var latlng = map.containerPointToLatLng(containerPoint);
      onFire(latlng.lat, latlng.lng);
    }, LONG_PRESS_MS);
  }

  function onMove(e) {
    if (!start) return;
    var p = pointFromEvent(e);
    var dx = p.x - start.x, dy = p.y - start.y;
    if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_CANCEL_PX) clear();
  }

  function suppressNativeMenu(e) { e.preventDefault(); }

  var container = map.getContainer();
  container.addEventListener("touchstart", onStart, { passive: true });
  container.addEventListener("touchmove", onMove, { passive: true });
  container.addEventListener("touchend", clear, { passive: true });
  container.addEventListener("touchcancel", clear, { passive: true });
  container.addEventListener("mousedown", onStart);
  container.addEventListener("mousemove", onMove);
  container.addEventListener("mouseup", clear);
  container.addEventListener("mouseleave", clear);
  container.addEventListener("contextmenu", suppressNativeMenu); // no native long-press callout mid-gesture

  return function detach() {
    clear();
    container.removeEventListener("touchstart", onStart);
    container.removeEventListener("touchmove", onMove);
    container.removeEventListener("touchend", clear);
    container.removeEventListener("touchcancel", clear);
    container.removeEventListener("mousedown", onStart);
    container.removeEventListener("mousemove", onMove);
    container.removeEventListener("mouseup", clear);
    container.removeEventListener("mouseleave", clear);
    container.removeEventListener("contextmenu", suppressNativeMenu);
  };
}

/**
 * Loosen the page's locked viewport zoom (maximum-scale=1.0, user-scalable=no in index.html) while
 * this map is mounted, then restore it on unmount. Scoped to just this screen, not app-wide: iOS
 * Safari can still engage native pinch-zoom over a touch-action:none element (an accessibility
 * override it won't let sites fully block), and with the page's zoom ceiling locked at 1.0 that
 * shows up as "zooms in, then snaps back to the locked scale the instant you let go."
 */
function useRelaxedViewportZoom() {
  useEffect(function() {
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    var original = meta.getAttribute("content");
    meta.setAttribute("content", "width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes");
    return function() {
      if (original != null) meta.setAttribute("content", original);
    };
  }, []);
}

/**
 * In-app map — press and hold to place or move a pin (no new browser window).
 */
export default function SpotMapPicker({ centerLat, centerLng, pinLat, pinLng, onPick, height }) {
  var mapRef = useRef(null);
  var mapInst = useRef(null);
  var markerRef = useRef(null);
  var onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useRelaxedViewportZoom();

  useEffect(function() {
    if (!mapRef.current || mapInst.current) return;
    var map = L.map(mapRef.current, { tapTolerance: 15 }).setView([centerLat, centerLng], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    var detachLongPress = attachLongPress(map, function(lat, lng) {
      if (onPickRef.current) onPickRef.current(lat, lng);
    });
    mapInst.current = map;
    setTimeout(function() { map.invalidateSize(); }, 100);
    return function() {
      detachLongPress();
      map.remove();
      mapInst.current = null;
      markerRef.current = null;
    };
  }, [centerLat, centerLng]);

  useEffect(function() {
    if (!mapInst.current || pinLat == null || pinLng == null) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([pinLat, pinLng]);
    } else {
      markerRef.current = L.marker([pinLat, pinLng]).addTo(mapInst.current);
    }
  }, [pinLat, pinLng]);

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: height || 340,
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.15)",
        overflow: "hidden",
        zIndex: 0,
        // Belt-and-suspenders on top of Leaflet's own CSS: force pinch/pan gestures over the map to
        // go to Leaflet's JS zoom, not the phone browser's native page-zoom.
        touchAction: "none",
      }}
    />
  );
}
