import { getLearnedHeadInches, headInchesForMeasure, learnHeadInchesFromRatio } from "./headSizeLearn.js";

function spanPct(a, b) {
  return Math.abs(b - a);
}

function lengthFromRefSpan(fishSpan, refStart, refEnd, refInches) {
  var refSpan = spanPct(refStart, refEnd);
  if (refSpan < 0.5 || fishSpan < 0.2 || !refInches) return null;
  return (fishSpan / refSpan) * refInches;
}

export function findRulerPhotoIndex(photos) {
  if (!photos || !photos.length) return -1;
  for (var i = 0; i < photos.length; i++) {
    if (photos[i].hasRulerInPhoto) return i;
  }
  return -1;
}

/**
 * Length from ruler + plano + head references visible in ONE photo.
 */
export function collectPhotoLengthEstimates(photo, markers, opts) {
  if (!photo || !markers) return [];
  var mouth = markers.mouthPct;
  var tail = markers.tailPct;
  var fishSpan = spanPct(mouth, tail);
  var out = [];
  var orientation = (photo.hasRulerInPhoto ? "horizontal" : (photo.photoOrientation || "horizontal"));
  var isVert = orientation === "vertical" && !photo.hasRulerInPhoto;

  // Selfie / vertical hold — never used for primary length when ruler exists elsewhere.
  if (isVert && fishSpan < 8) {
    return out;
  }

  if (photo.hasRulerInPhoto) {
    var rStart = photo.rulerStartPct != null ? photo.rulerStartPct : markers.refStartPct;
    var rEnd = photo.rulerEndPct != null ? photo.rulerEndPct : markers.refEndPct;
    var inchSpan = photo.rulerInchesInView;
    if (inchSpan == null || inchSpan <= 0) inchSpan = 20;

    var fromScale = lengthFromRefSpan(fishSpan, rStart, rEnd, inchSpan);
    if (fromScale != null && fromScale >= 4) {
      out.push({ source:"ruler_scale", inches:fromScale, weight:10, label:"Ruler scale" });
    }

    if (photo.aiLengthInches != null && photo.aiLengthInches >= 4) {
      out.push({ source:"ruler_ai_read", inches:photo.aiLengthInches, weight:12, label:"Ruler tick read" });
    }

    // Markers too tight vs AI ruler read — trust AI tick read on ruler photo.
    if (fromScale != null && photo.aiLengthInches >= 6) {
      if (fromScale < photo.aiLengthInches * 0.55 || fishSpan < 18) {
        out.push({ source:"ruler_ai_guard", inches:photo.aiLengthInches, weight:16, label:"Ruler (markers too tight — using AI read)" });
      }
    }
    // Fish span under 15% on ruler photo — AI read only.
    if (fishSpan < 15 && photo.aiLengthInches >= 6) {
      out.push({ source:"ruler_ai_guard", inches:photo.aiLengthInches, weight:18, label:"Ruler AI (wide guides needed)" });
    }
  }

  if (photo.hasPlanoBox && !photo.hasRulerInPhoto) {
    var pStart = photo.planoStartPct != null ? photo.planoStartPct : markers.refStartPct;
    var pEnd = photo.planoEndPct != null ? photo.planoEndPct : markers.refEndPct;
    var fromPlano = lengthFromRefSpan(fishSpan, pStart, pEnd, 10);
    if (fromPlano != null && fromPlano >= 4) {
      out.push({ source:"plano", inches:fromPlano, weight:7, label:"Plano box (10 in)" });
    }
  }

  if (photo.hasHeadVisible && photo.headTopPct != null && photo.headBottomPct != null && !photo.hasRulerInPhoto) {
    var headSpan = spanPct(photo.headTopPct, photo.headBottomPct);
    var headIn = headInchesForMeasure();
    if (headSpan >= 3 && fishSpan >= 5) {
      var fromHead = headIn * (fishSpan / headSpan);
      if (fromHead >= 4 && fromHead <= 40) {
        var learned = getLearnedHeadInches();
        out.push({
          source:"head",
          inches:fromHead,
          weight:learned ? 6 : 4,
          label:learned ? ("Your head (~" + learned.toFixed(1) + " in)") : ("Head (~" + headIn + " in default)"),
        });
      }
    }
  }

  if (opts && opts.usesObjectReference && opts.referenceLenInches > 0 && !photo.hasRulerInPhoto) {
    var objLen = lengthFromRefSpan(fishSpan, markers.refStartPct, markers.refEndPct, opts.referenceLenInches);
    if (objLen != null && objLen >= 4) {
      out.push({ source:"object_ref", inches:objLen, weight:5, label:"Reference object" });
    }
  }

  return out;
}

function pickBestEstimate(estimates) {
  if (!estimates || !estimates.length) return null;
  var sorted = estimates.slice().sort(function(a, b) {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return 0;
  });
  var top = sorted[0];
  var rulerReads = estimates.filter(function(e) {
    return e.source === "ruler_ai_guard" || e.source === "ruler_ai_read" || e.source === "ruler_scale";
  });
  if (rulerReads.length >= 2) {
    var nums = rulerReads.map(function(e) { return e.inches; }).sort(function(a, b) { return a - b; });
    var mid = nums[Math.floor(nums.length / 2)];
    top = rulerReads.find(function(e) { return Math.abs(e.inches - mid) < 0.01; }) || top;
  }
  return top;
}

/**
 * Scan photos — when a ruler photo exists, length comes ONLY from that photo.
 */
export function aggregateLengthFromAllPhotos(photos, opts) {
  if (!photos || !photos.length) {
    return { inches:null, breakdown:[], source:"", learnedHead:null, referenceOnly:true };
  }

  var rulerIdx = findRulerPhotoIndex(photos);
  var rulerPhoto = rulerIdx >= 0 ? photos[rulerIdx] : null;
  var rulerMarkers = rulerPhoto ? rulerPhoto.markers : null;
  var learnedHead = null;
  var all = [];

  if (rulerIdx >= 0) {
    // Reference-only rule: ruler photo is the sole length source.
    var rm = (opts && opts.activeIdx === rulerIdx && opts.liveMarkers) ? opts.liveMarkers : rulerMarkers;
    if (!rm && rulerPhoto) rm = rulerPhoto.markers || { mouthPct:10, tailPct:90, refStartPct:20, refEndPct:80 };
    collectPhotoLengthEstimates(rulerPhoto, rm, opts).forEach(function(est) {
      all.push(Object.assign({}, est, { photoIndex:rulerIdx }));
    });

    var rulerLen = pickBestEstimate(all);
    rulerLen = rulerLen && rulerLen.inches;

    // Learn head size from selfies in batch — does not change ruler length.
    if (rulerLen != null && rulerLen >= 6) {
      photos.forEach(function(p, idx) {
        if (idx === rulerIdx || !p.hasHeadVisible) return;
        var m = p.markers;
        if (idx === opts.activeIdx && opts.liveMarkers) m = opts.liveMarkers;
        var headSpan = spanPct(p.headTopPct, p.headBottomPct);
        var fishSpan = spanPct(m.mouthPct, m.tailPct);
        learnedHead = learnHeadInchesFromRatio(rulerLen, fishSpan, headSpan);
      });
    }
  } else {
    photos.forEach(function(photo, idx) {
      var markers = photo.markers || { mouthPct:10, tailPct:90, refStartPct:20, refEndPct:80 };
      if (idx === (opts && opts.activeIdx) && opts.liveMarkers) {
        markers = opts.liveMarkers;
      }
      collectPhotoLengthEstimates(photo, markers, opts).forEach(function(est) {
        all.push(Object.assign({}, est, { photoIndex:idx }));
      });
    });
  }

  var best = pickBestEstimate(all);
  var breakdown = all
    .filter(function(e, i, arr) {
      return arr.findIndex(function(x) { return x.source === e.source && x.photoIndex === e.photoIndex; }) === i;
    })
    .map(function(e) {
      return "Photo " + (e.photoIndex + 1) + " · " + e.label + ": " + e.inches.toFixed(1) + " in";
    });

  return {
    inches: best ? best.inches : null,
    breakdown:breakdown,
    source:best ? best.label : "",
    learnedHead:learnedHead || getLearnedHeadInches(),
    referenceOnly: rulerIdx >= 0,
  };
}

export function measureFromPhotoRuler(photo, mouthPct, tailPct) {
  if (!photo || !photo.hasRulerInPhoto) return null;
  var ests = collectPhotoLengthEstimates(photo, {
    mouthPct:mouthPct,
    tailPct:tailPct,
    refStartPct:photo.rulerStartPct != null ? photo.rulerStartPct : photo.markers.refStartPct,
    refEndPct:photo.rulerEndPct != null ? photo.rulerEndPct : photo.markers.refEndPct,
  }, null);
  var best = pickBestEstimate(ests);
  return best ? best.inches : null;
}

export function measureFishInches(opts) {
  if (opts.measurementOption === "5_none") return null;

  if (opts.allPhotos && opts.allPhotos.length) {
    var agg = aggregateLengthFromAllPhotos(opts.allPhotos, opts);
    if (agg.inches != null) return agg.inches;
  }

  var photo = opts.photo;
  // Never measure from selfie when ruler photo exists in batch.
  if (photo && !photo.hasRulerInPhoto && opts.allPhotos && findRulerPhotoIndex(opts.allPhotos) >= 0) {
    return null;
  }

  var markers = {
    mouthPct:opts.mouthPct,
    tailPct:opts.tailPct,
    refStartPct:opts.refStartPct,
    refEndPct:opts.refEndPct,
  };
  var ests = collectPhotoLengthEstimates(photo, markers, opts);
  var best = pickBestEstimate(ests);
  if (best) return best.inches;

  if (opts.usesObjectReference && opts.referenceLenInches > 0) {
    return lengthFromRefSpan(spanPct(opts.mouthPct, opts.tailPct), opts.refStartPct, opts.refEndPct, opts.referenceLenInches);
  }

  // No ruler — avoid full-photo-height guess on reference shots.
  if (photo && photo.hasRulerInPhoto) {
    return null;
  }

  return (spanPct(opts.mouthPct, opts.tailPct) / 100) * (opts.effectiveRulerInches || 20);
}
