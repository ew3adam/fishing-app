/**
 * Critical path unit tests for wizard rules.
 * These mirror guard logic used by CatchTab progression.
 */
import { describe, it, expect } from "vitest";

function canContinueToReview(input) {
  var hasSpecies = !!String(input.species || "").trim();
  var hasLength = !!String(input.length || "").trim();
  var hasSpot = !!String(input.spot || "").trim();
  var hasManualDate = !!String(input.dateISO || "").trim();
  var hasManualTime = !!String(input.catchTime || "").trim();
  var hasRod = !!String(input.rod || "").trim();
  var hasReel = !!String(input.reelType || "").trim();
  var hasLine = !!String(input.lineType || "").trim();
  var hasBait = !!String(input.bait || "").trim();

  var locationReady = input.requiresManualTimeLocation ? hasSpot : (input.locationDecision !== "ask" && hasSpot);
  var manualReqReady = input.requiresManualTimeLocation ? (hasManualDate && hasManualTime && hasSpot) : true;
  var gearReady = input.gearFlowChoice === "yes" ? (hasRod && hasReel && hasLine && hasBait) : input.gearFlowChoice === "no";
  return hasSpecies && hasLength && input.speciesConfirmed && input.lengthConfirmed && locationReady && gearReady && manualReqReady;
}

describe("catch wizard progression", function() {
  it("blocks continue when manual time is missing", function() {
    expect(canContinueToReview({
      species: "Bass",
      length: "12 inches",
      spot: "Salt Creek",
      dateISO: "2026-04-30",
      catchTime: "",
      rod: "",
      reelType: "",
      lineType: "",
      bait: "",
      speciesConfirmed: true,
      lengthConfirmed: true,
      requiresManualTimeLocation: true,
      locationDecision: "edit",
      gearFlowChoice: "no",
    })).toBe(false);
  });

  it("allows continue for minimal manual flow when complete", function() {
    expect(canContinueToReview({
      species: "Bass",
      length: "12 inches",
      spot: "Salt Creek",
      dateISO: "2026-04-30",
      catchTime: "08:15",
      rod: "",
      reelType: "",
      lineType: "",
      bait: "",
      speciesConfirmed: true,
      lengthConfirmed: true,
      requiresManualTimeLocation: true,
      locationDecision: "edit",
      gearFlowChoice: "no",
    })).toBe(true);
  });
});
