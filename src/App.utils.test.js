/**
 * Unit-test examples for hardened utility behavior.
 */
import { describe, it, expect } from "vitest";

describe("sanitizeStr", function() {
  it("trims and collapses whitespace", function() {
    var value = "  A   lot   of   spaces  ";
    var cleaned = value.replace(/\s+/g, " ").trim().slice(0, 100);
    expect(cleaned).toBe("A lot of spaces");
  });
});

describe("clampNum", function() {
  function clampNum(value, min, max, fallback) {
    var n = Number(value);
    if (!isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  it("returns fallback for non-numeric values", function() {
    expect(clampNum("bad", -90, 90, 41.84)).toBe(41.84);
  });

  it("clamps above max and below min", function() {
    expect(clampNum(200, -90, 90, 0)).toBe(90);
    expect(clampNum(-200, -90, 90, 0)).toBe(-90);
  });
});

describe("safeParseJsonFromText-style behavior", function() {
  function safeJsonParse(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function safeParseJsonFromText(rawText) {
    var txt = String(rawText || "");
    var m = txt.match(/\{[\s\S]*\}/);
    if (!m) return null;
    return safeJsonParse(m[0], null);
  }

  it("extracts JSON object from AI response text", function() {
    var payload = "Result: {\"species\":\"Bass\",\"confidence\":95}";
    expect(safeParseJsonFromText(payload)).toEqual({ species:"Bass", confidence:95 });
  });

  it("returns null for invalid payload", function() {
    expect(safeParseJsonFromText("no json here")).toBeNull();
  });
});

describe("extractLatLngFromMapsText-like parser", function() {
  function isValidLatLng(lat, lng) {
    return isFinite(lat) && isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  function extractLatLngFromMapsText(raw) {
    if (!raw || typeof raw !== "string") return null;
    var t = raw.trim().slice(0, 8000);
    var plain = t.match(/^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/);
    if (plain) {
      var a = parseFloat(plain[1]);
      var b = parseFloat(plain[2]);
      if (isValidLatLng(a, b)) return { lat:a, lng:b };
    }
    return null;
  }

  it("parses plain lat,lng text", function() {
    expect(extractLatLngFromMapsText("41.826,-87.845")).toEqual({ lat:41.826, lng:-87.845 });
  });

  it("rejects out-of-range coordinates", function() {
    expect(extractLatLngFromMapsText("141.826,-287.845")).toBeNull();
  });
});
