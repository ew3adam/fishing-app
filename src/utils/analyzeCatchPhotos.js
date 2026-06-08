/**
 * Ask AI to scan all catch photos — find ruler shot, species, and length.
 */
export function analyzeCatchPhotos(images) {
  if (!images || !images.length) {
    return Promise.resolve(null);
  }
  var content = [];
  images.forEach(function(img, idx) {
    content.push({ type: "image", source: { type: "base64", media_type: img.type || "image/jpeg", data: img.b64 } });
    content.push({ type: "text", text: "Photo index " + idx + "." });
  });
  content.push({
    type: "text",
    text:
      "These are fishing catch photos. Return ONLY raw JSON (no markdown):\n" +
      '{"photos":[{"photo_index":0,"has_fish":true,"has_ruler":true,"has_plano_box":true,"has_head_visible":false,"species":"Largemouth Bass","confidence":90,"length_inches":14.0,"mouth_pct":8,"tail_pct":72,"ruler_start_pct":38,"ruler_end_pct":94,"ruler_start_inch":1,"ruler_end_inch":15,"ruler_inches_in_view":14,"plano_start_pct":40,"plano_end_pct":88,"head_top_pct":null,"head_bottom_pct":null,"orientation":"horizontal","rotation":0}],"best_measure_index":0,"best_display_index":1,"notes":"brief"}\n\n' +
      "Rules:\n" +
      "- Analyze EVERY photo — each may have ruler, Plano box, fish, and/or angler head\n" +
      "- has_ruler: true if inch-mark ruler visible\n" +
      "- has_plano_box: true if Plano-style tackle box (~10 in long) visible\n" +
      "- has_head_visible: true on selfies if top of head to chin visible\n" +
      "- head_top_pct/head_bottom_pct: vertical % of head span on SAME axis as fish length (0=top)\n" +
      "- length_inches: READ from ruler ticks where fish mouth/tail align (critical — e.g. 14.0 not 3.4)\n" +
      "- mouth_pct/tail_pct: fish span along measurement axis — must span most of fish body (typically 50-80% for bass)\n" +
      "- ruler_start_pct/ruler_end_pct: visible ruler span along SAME axis as fish\n" +
      "- ruler_start_inch/ruler_end_inch: printed inch numbers at ruler edges (e.g. 1 and 15)\n" +
      "- ruler_inches_in_view: ruler_end_inch minus ruler_start_inch\n" +
      "- plano_start_pct/plano_end_pct: 10-inch box length span\n" +
      "- orientation: horizontal for fish+ruler on ground; vertical for held fish selfie\n" +
      "- rotation: always 0\n" +
      "- best_measure_index: photo with ruler for authoritative length\n" +
      "- best_display_index: hero selfie if different",
  });

  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 900, messages: [{ role: "user", content: content }] }),
  })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      var txt = (data.content && data.content[0] && data.content[0].text) || "";
      var m = txt.match(/\{[\s\S]*\}/);
      if (!m) return null;
      try {
        return JSON.parse(m[0]);
      } catch (e) {
        return null;
      }
    })
    .catch(function() { return null; });
}

export function mergePhotoAnalysis(list, analysis) {
  if (!analysis || !Array.isArray(analysis.photos)) return list;
  return list.map(function(p, idx) {
    var row = analysis.photos.find(function(r) { return r.photo_index === idx; }) || analysis.photos[idx] || {};
    var mouth = isFinite(row.mouth_pct) ? Math.max(2, Math.min(98, row.mouth_pct)) : p.markers.mouthPct;
    var tail = isFinite(row.tail_pct) ? Math.max(2, Math.min(98, row.tail_pct)) : p.markers.tailPct;
    var rStartInch = isFinite(row.ruler_start_inch) ? row.ruler_start_inch : null;
    var rEndInch = isFinite(row.ruler_end_inch) ? row.ruler_end_inch : null;
    var inchesInView = isFinite(row.ruler_inches_in_view) ? row.ruler_inches_in_view : null;
    if (inchesInView == null && rStartInch != null && rEndInch != null) {
      inchesInView = Math.abs(rEndInch - rStartInch);
    }
    return Object.assign({}, p, {
      hasRulerInPhoto: !!row.has_ruler,
      hasPlanoBox: !!row.has_plano_box,
      hasHeadVisible: !!row.has_head_visible,
      hasFish: row.has_fish !== false,
      speciesHint: row.species || "",
      aiConfidence: row.confidence || 0,
      aiLengthInches: row.length_inches != null ? Number(row.length_inches) : null,
      aiInitialMouthPct: mouth,
      aiInitialTailPct: tail,
      rulerStartPct: isFinite(row.ruler_start_pct) ? row.ruler_start_pct : p.rulerStartPct,
      rulerEndPct: isFinite(row.ruler_end_pct) ? row.ruler_end_pct : p.rulerEndPct,
      rulerStartInch: isFinite(row.ruler_start_inch) ? row.ruler_start_inch : null,
      rulerEndInch: isFinite(row.ruler_end_inch) ? row.ruler_end_inch : null,
      rulerInchesInView: inchesInView,
      planoStartPct: isFinite(row.plano_start_pct) ? row.plano_start_pct : p.planoStartPct,
      planoEndPct: isFinite(row.plano_end_pct) ? row.plano_end_pct : p.planoEndPct,
      headTopPct: isFinite(row.head_top_pct) ? row.head_top_pct : null,
      headBottomPct: isFinite(row.head_bottom_pct) ? row.head_bottom_pct : null,
      photoOrientation: row.has_ruler ? "horizontal" : (row.orientation === "vertical" ? "vertical" : "horizontal"),
      aiRotation: parseInt(row.rotation, 10) || 0,
      markers: Object.assign({}, p.markers, {
        mouthPct: mouth,
        tailPct: tail,
        refStartPct: isFinite(row.ruler_start_pct) ? row.ruler_start_pct : (isFinite(row.plano_start_pct) ? row.plano_start_pct : p.markers.refStartPct),
        refEndPct: isFinite(row.ruler_end_pct) ? row.ruler_end_pct : (isFinite(row.plano_end_pct) ? row.plano_end_pct : p.markers.refEndPct),
      }),
    });
  });
}
