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

/**
 * In-app map — tap to place or move a pin (no new browser window).
 */
export default function SpotMapPicker({ centerLat, centerLng, pinLat, pinLng, onPick, height }) {
  var mapRef = useRef(null);
  var mapInst = useRef(null);
  var markerRef = useRef(null);
  var onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(function() {
    if (!mapRef.current || mapInst.current) return;
    var map = L.map(mapRef.current, { tapTolerance: 15 }).setView([centerLat, centerLng], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    map.on("click", function(e) {
      if (onPickRef.current) onPickRef.current(e.latlng.lat, e.latlng.lng);
    });
    mapInst.current = map;
    setTimeout(function() { map.invalidateSize(); }, 100);
    return function() {
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
      }}
    />
  );
}
