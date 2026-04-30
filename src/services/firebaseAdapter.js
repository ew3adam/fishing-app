// Firebase adapter stub for future backend integration.
// Keep business logic in service layer and swap to real Firebase SDK later.

export function createFirebaseAdapter(config) {
  var cfg = config || {};

  function notConfigured(op) {
    return Promise.reject(new Error("Firebase adapter not configured for operation: " + op));
  }

  return {
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
}

// Default export used by the current app shell.
export const firebaseAdapter = createFirebaseAdapter({});

