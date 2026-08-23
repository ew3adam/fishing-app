import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Read-only overview map for Scout results — lets a member visually confirm a
 * pin actually sits on water (or wherever it claims to be) before trusting the
 * card list, instead of taking a name + lat/lng on faith. Blue dot = you, red
 * pins = results. No click-to-place; this is Scout's overview, not the Spots
 * picker (see SpotMapPicker.jsx for that).
 */
export default function ScoutResultsMap({ center, markers, height, mutedColor }) {
  var mapRef = useRef(null);
  var mapInst = useRef(null);
  var layerGroupRef = useRef(null);
  var cla = center && parseFloat(center.lat);
  var cln = center && parseFloat(center.lng);
  var validCenter = isFinite(cla) && isFinite(cln);
  var list = Array.isArray(markers) ? markers : [];

  useEffect(function() {
    if (!validCenter || !mapRef.current) return;
    if (!mapInst.current) {
      var map = L.map(mapRef.current, { tapTolerance: 15 }).setView([cla, cln], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      mapInst.current = map;
      layerGroupRef.current = L.layerGroup().addTo(map);
      setTimeout(function() { map.invalidateSize(); }, 100);
    }
    var map = mapInst.current;
    var group = layerGroupRef.current;
    group.clearLayers();

    L.circleMarker([cla, cln], {
      radius: 8,
      color: "#fff",
      weight: 2,
      fillColor: "#2a7fd4",
      fillOpacity: 1,
    }).bindPopup("You are here").addTo(group);

    var bounds = L.latLngBounds([[cla, cln]]);
    list.forEach(function(m) {
      var la = parseFloat(m.lat);
      var ln = parseFloat(m.lng);
      if (!isFinite(la) || !isFinite(ln)) return;
      var marker = L.circleMarker([la, ln], {
        radius: 7,
        color: "#7a1a1a",
        weight: 1.5,
        fillColor: "#e05050",
        fillOpacity: 0.9,
      }).addTo(group);
      var label = (m.name || "Spot") + (m.distMi != null ? " — " + m.distMi.toFixed(1) + " mi" : "");
      marker.bindPopup(label);
      bounds.extend([la, ln]);
    });

    if (list.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    } else {
      map.setView([cla, cln], 13);
    }
  }, [cla, cln, validCenter, list]);

  useEffect(function() {
    return function() {
      if (mapInst.current) {
        mapInst.current.remove();
        mapInst.current = null;
        layerGroupRef.current = null;
      }
    };
  }, []);

  if (!validCenter) return null;

  return (
    <div>
      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: height || 240,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.15)",
          overflow: "hidden",
          zIndex: 0,
          // Same fix as SpotMapPicker: force pinch/pan on this interactive map to Leaflet's JS zoom
          // instead of the phone browser's native page-zoom, which otherwise wins the gesture and
          // snaps back to the locked page scale on release.
          touchAction: "none",
        }}
      />
      <div style={{ fontSize: 10, color: mutedColor || "#8a9a7a", marginTop: 6, lineHeight: 1.4 }}>
        🔵 You · 🔴 Results below — tap a pin to check it's actually on water, not a driveway or yard, before you head out.
      </div>
    </div>
  );
}
