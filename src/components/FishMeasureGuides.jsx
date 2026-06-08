import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";

function measureImageRect(containerEl, imgEl) {
  if (!containerEl || !imgEl) return null;
  var nw = imgEl.naturalWidth;
  var nh = imgEl.naturalHeight;
  if (!nw || !nh) return null;
  var cw = containerEl.clientWidth;
  var ch = containerEl.clientHeight;
  if (!cw || !ch) return null;
  var scale = Math.min(cw / nw, ch / nh);
  var dw = nw * scale;
  var dh = nh * scale;
  return {
    left: (cw - dw) / 2,
    top: (ch - dh) / 2,
    width: dw,
    height: dh,
  };
}

function clampPct(n) {
  return Math.max(1, Math.min(99, n));
}

/**
 * Draggable mouth/tail/reference guides aligned to the visible photo area.
 */
export default function FishMeasureGuides({
  containerRef,
  imgRef,
  orientation,
  mouthPct,
  tailPct,
  onMouthChange,
  onTailChange,
  refStartPct,
  refEndPct,
  onRefStartChange,
  onRefEndChange,
  showRefGuides,
  rulerSpan,
  colors,
  photoKey,
}) {
  var th = colors || { green:"#6fcf6f", orange:"#e09030", gold:"#d4a843" };
  var isHoriz = orientation !== "vertical";
  var [box, setBox] = useState(null);
  var dragging = useRef(null);
  var boxRef = useRef(null);
  var callbacksRef = useRef({});

  callbacksRef.current = {
    onMouthChange: onMouthChange,
    onTailChange: onTailChange,
    onRefStartChange: onRefStartChange,
    onRefEndChange: onRefEndChange,
    mouthPct: mouthPct,
  };

  var remeasure = useCallback(function() {
    var next = measureImageRect(containerRef && containerRef.current, imgRef && imgRef.current);
    boxRef.current = next;
    setBox(next);
  }, [containerRef, imgRef, photoKey, orientation]);

  useLayoutEffect(function() {
    remeasure();
  }, [remeasure]);

  useEffect(function() {
    window.addEventListener("resize", remeasure);
    var img = imgRef && imgRef.current;
    function onImgLoad() {
      remeasure();
      setTimeout(remeasure, 50);
    }
    if (img) {
      img.addEventListener("load", onImgLoad);
      if (img.complete && img.naturalWidth) onImgLoad();
    }
    return function() {
      window.removeEventListener("resize", remeasure);
      if (img) img.removeEventListener("load", onImgLoad);
    };
  }, [remeasure, imgRef, photoKey]);

  function pctFromPointer(clientX, clientY) {
    var b = boxRef.current;
    if (!b || !containerRef || !containerRef.current) return callbacksRef.current.mouthPct || 50;
    var cRect = containerRef.current.getBoundingClientRect();
    if (isHoriz) {
      return clampPct(((clientX - cRect.left - b.left) / b.width) * 100);
    }
    return clampPct(((clientY - cRect.top - b.top) / b.height) * 100);
  }

  function startDrag(marker, e) {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = marker;
    if (e.currentTarget.setPointerCapture) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    }
  }

  useEffect(function() {
    function onMove(e) {
      if (!dragging.current) return;
      e.preventDefault();
      var pct = pctFromPointer(e.clientX, e.clientY);
      var cb = callbacksRef.current;
      if (dragging.current === "mouth") cb.onMouthChange(pct);
      else if (dragging.current === "tail") cb.onTailChange(pct);
      else if (dragging.current === "refStart" && cb.onRefStartChange) cb.onRefStartChange(pct);
      else if (dragging.current === "refEnd" && cb.onRefEndChange) cb.onRefEndChange(pct);
    }
    function onUp() {
      dragging.current = null;
    }
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return function() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isHoriz]);

  if (!box || box.width < 8 || box.height < 8) return null;

  var spanStart = Math.min(mouthPct, tailPct);
  var spanEnd = Math.max(mouthPct, tailPct);

  function guideLine(marker, pct, color, label, cursor, handleLetter) {
    var handleStyle = {
      position:"absolute",
      transform:"translate(-50%, -50%)",
      width:36,
      height:36,
      borderRadius:6,
      background:color,
      border:"2px solid #fff",
      boxShadow:"0 0 0 1px rgba(0,0,0,0.5), 0 2px 10px rgba(0,0,0,0.5)",
      cursor:cursor,
      touchAction:"none",
      pointerEvents:"auto",
      zIndex:12,
      display:"flex",
      alignItems:"center",
      justifyContent:"center",
    };
    var labelStyle = {
      position:"absolute",
      fontSize:9,
      fontWeight:700,
      color:"#fff",
      background:"rgba(0,0,0,0.72)",
      padding:"2px 5px",
      borderRadius:3,
      whiteSpace:"nowrap",
      pointerEvents:"none",
      textShadow:"0 1px 2px #000",
    };
    var lineDragProps = {
      onPointerDown: function(e) { startDrag(marker, e); },
      style: { pointerEvents:"auto", touchAction:"none" },
    };

    if (isHoriz) {
      return (
        <div key={marker} style={{ position:"absolute", left:pct + "%", top:0, bottom:0, width:0, zIndex:10 }}>
          <div
            {...lineDragProps}
            style={{ position:"absolute", left:-12, top:0, bottom:0, width:24, cursor:cursor, zIndex:11, touchAction:"none" }}
          />
          <div style={{ position:"absolute", left:0, top:0, bottom:0, width:2, marginLeft:-1, background:color, boxShadow:"0 0 6px rgba(0,0,0,0.6)", pointerEvents:"none" }} />
          <div
            role="slider"
            aria-label={label + " guide"}
            aria-valuemin={1}
            aria-valuemax={99}
            aria-valuenow={Math.round(pct)}
            onPointerDown={function(e) { startDrag(marker, e); }}
            style={Object.assign({}, handleStyle, { left:0, top:"50%", cursor:cursor })}
          >
            <span style={{ fontSize:9, fontWeight:800, color:"#111" }}>{handleLetter || (marker === "mouth" ? "M" : "T")}</span>
          </div>
          <div style={Object.assign({}, labelStyle, { top:8, left:10, transform:"none" })}>{label}</div>
        </div>
      );
    }

    return (
      <div key={marker} style={{ position:"absolute", top:pct + "%", left:0, right:0, height:0, zIndex:10 }}>
        <div
          {...lineDragProps}
          style={{ position:"absolute", top:-12, left:0, right:0, height:24, cursor:cursor, zIndex:11, touchAction:"none" }}
        />
        <div style={{ position:"absolute", top:0, left:0, right:0, height:2, marginTop:-1, background:color, boxShadow:"0 0 6px rgba(0,0,0,0.6)", pointerEvents:"none" }} />
        <div
          role="slider"
          aria-label={label + " guide"}
          aria-valuemin={1}
          aria-valuemax={99}
          aria-valuenow={Math.round(pct)}
          onPointerDown={function(e) { startDrag(marker, e); }}
          style={Object.assign({}, handleStyle, { top:0, left:"50%", cursor:cursor })}
        >
          <span style={{ fontSize:9, fontWeight:800, color:"#111" }}>{handleLetter || (marker === "mouth" ? "M" : "T")}</span>
        </div>
        <div style={Object.assign({}, labelStyle, { left:10, top:-10, transform:"none" })}>{label}</div>
      </div>
    );
  }

  return (
    <div
      style={{
        position:"absolute",
        left:box.left,
        top:box.top,
        width:box.width,
        height:box.height,
        zIndex:8,
        pointerEvents:"none",
      }}
    >
      {rulerSpan ? (
        <div
          style={
            isHoriz
              ? {
                  position:"absolute",
                  left:Math.min(rulerSpan.start, rulerSpan.end) + "%",
                  width:Math.abs(rulerSpan.end - rulerSpan.start) + "%",
                  top:"58%",
                  bottom:"6%",
                  border:"1px dashed " + th.gold,
                  background:"rgba(212,168,67,0.14)",
                  pointerEvents:"none",
                }
              : {
                  position:"absolute",
                  top:Math.min(rulerSpan.start, rulerSpan.end) + "%",
                  height:Math.abs(rulerSpan.end - rulerSpan.start) + "%",
                  left:"8%",
                  right:"18%",
                  border:"1px dashed " + th.gold,
                  background:"rgba(212,168,67,0.14)",
                  pointerEvents:"none",
                }
          }
        />
      ) : null}
      <div
        style={
          isHoriz
            ? { position:"absolute", left:spanStart + "%", width:(spanEnd - spanStart) + "%", top:0, bottom:0, background:"rgba(111,207,111,0.18)", pointerEvents:"none" }
            : { position:"absolute", top:spanStart + "%", height:(spanEnd - spanStart) + "%", left:0, right:0, background:"rgba(111,207,111,0.18)", pointerEvents:"none" }
        }
      />
      {guideLine("mouth", mouthPct, th.green, "MOUTH", isHoriz ? "ew-resize" : "ns-resize", "M")}
      {guideLine("tail", tailPct, th.orange, "TAIL", isHoriz ? "ew-resize" : "ns-resize", "T")}
      {showRefGuides && refStartPct != null && onRefStartChange ? guideLine("refStart", refStartPct, th.gold || "#d4a843", "REF START", isHoriz ? "ew-resize" : "ns-resize", "R1") : null}
      {showRefGuides && refEndPct != null && onRefEndChange ? guideLine("refEnd", refEndPct, th.gold || "#d4a843", "REF END", isHoriz ? "ew-resize" : "ns-resize", "R2") : null}
    </div>
  );
}
