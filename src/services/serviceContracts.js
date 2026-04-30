// Shared contract shape for data adapters.
// Each adapter should implement these async methods.

export var ServiceContract = {
  // Contacts
  listContacts: "function",
  upsertContact: "function",

  // Spots
  listSpots: "function",
  saveSpot: "function",

  // Catches
  listCatches: "function",
  saveCatch: "function",
};

export function validateAdapter(adapter) {
  var missing = [];
  var keys = Object.keys(ServiceContract);
  var i;
  for (i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (!adapter || typeof adapter[k] !== "function") missing.push(k);
  }
  return { ok: missing.length === 0, missing: missing };
}

export function validateServiceAdapterShape(adapter) {
  var check = validateAdapter(adapter);
  if (!check.ok) {
    throw new Error("Service adapter missing methods: " + check.missing.join(", "));
  }
  return adapter;
}

