/**
 * Runtime OAuth provider config — reads VITE_* env vars; falls back to disabled placeholders.
 * Copy authProviders.example.js and .env.example when adding Google / Facebook / Phone later.
 */
function env(key) {
  return String(import.meta.env[key] ?? "").replace(/\s+/g, "").trim();
}

export function getAuthProviderConfig() {
  var googleId = env("VITE_GOOGLE_CLIENT_ID");
  var facebookId = env("VITE_FACEBOOK_APP_ID");
  var appleId = env("VITE_APPLE_CLIENT_ID");
  var phoneEnabled = env("VITE_PHONE_AUTH_ENABLED") === "true";

  return {
    emailPassword: { enabled: true },
    google: { clientId: googleId, enabled: !!googleId },
    facebook: { appId: facebookId, enabled: !!facebookId },
    apple: { clientId: appleId, enabled: !!appleId },
    phone: { enabled: phoneEnabled },
  };
}

/** Labels for disabled OAuth buttons on Profile sign-in. */
export function getOAuthPlaceholderButtons() {
  var c = getAuthProviderConfig();
  return [
    { id: "google", label: "Continue with Google", enabled: c.google.enabled },
    { id: "facebook", label: "Continue with Facebook", enabled: c.facebook.enabled },
    { id: "phone", label: "Continue with Phone", enabled: c.phone.enabled },
    { id: "apple", label: "Continue with Apple", enabled: c.apple.enabled },
  ];
}
