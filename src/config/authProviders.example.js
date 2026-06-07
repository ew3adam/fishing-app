/**
 * OAuth / sign-in provider flags — copy values into .env.local when each provider is configured.
 * Facebook app secret stays server-side only (future Cloud Function); never put secrets in the client.
 */
export const AUTH_PROVIDER_CONFIG = {
  emailPassword: { enabled: true },
  google: { clientId: "", enabled: false },
  facebook: { appId: "", enabled: false },
  apple: { clientId: "", enabled: false },
  phone: { enabled: false },
};

// Matching .env.local keys (runtime): VITE_GOOGLE_CLIENT_ID, VITE_FACEBOOK_APP_ID,
// VITE_APPLE_CLIENT_ID, VITE_PHONE_AUTH_ENABLED=true
