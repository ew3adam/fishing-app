import { validateAdapter } from "./serviceContracts";

// Firebase adapter stub for future backend integration.
// Keep business logic in service layer and swap to real Firebase SDK later.
export function createFirebaseAdapter(config) {
  var cfg = config || {};

  function notConfigured(op) {
    return Promise.reject(new Error("Firebase adapter not configured for operation: " + op));
  }

  var adapter = {
    provider: "firebase",
    config: cfg,

    // Contacts
    listContacts: function() { return notConfigured("listContacts"); },
    upsertContact: function() { return notConfigured("upsertContact"); },

    // Spots
    listSpots: function() { return notConfigured("listSpots"); },
    saveSpot: function() { return notConfigured("saveSpot"); },

    // Catches
    listCatches: function() { return notConfigured("listCatches"); },
    saveCatch: function() { return notConfigured("saveCatch"); },
  };

  return validateAdapter(adapter).ok ? adapter : adapter;
}

