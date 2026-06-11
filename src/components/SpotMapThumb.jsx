import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

/** Read-only mini map — replaces broken staticmap.openstreetmap.de images. */
export default function SpotMapThumb({ lat, lng, zoom, height }) {
  var mapRef = useRef(null);
  var mapInst = useRef(null);
  var markerRef = useRef(null);
  var la = parseFloat(lat);
  var ln = parseFloat(lng);
  var valid = isFinite(la) && isFinite(ln);

  useEffect(function() {
    if (!valid || !mapRef.current || mapInst.current) return;
    var map = L.map(mapRef.current, {
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      scrollWheelZoom: false,
      boxZoom: false,
      keyboard: false,
      zoomControl: false,
      attributionControl: true,
    }).setView([la, ln], zoom != null ? zoom : 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    markerRef.current = L.marker([la, ln]).addTo(map);
    mapInst.current = map;
    setTimeout(function() { map.invalidateSize(); }, 80);
    return function() {
      map.remove();
      mapInst.current = null;
      markerRef.current = null;
    };
  }, [la, ln, valid, zoom]);

  if (!valid) {
    return (
      <div style={{
        width: "100%",
        height: height || 160,
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.15)",
        background: "rgba(255,255,255,0.04)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        color: "#8a9a7a",
      }}>
        Map unavailable — missing coordinates
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: height || 160,
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.15)",
        overflow: "hidden",
        zIndex: 0,
      }}
    />
  );
}
