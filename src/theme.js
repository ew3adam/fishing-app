// App color themes, shared by App.jsx and components (one copy, so contrast fixes apply everywhere).
export const THEMES = {
  dark:      { bg:"#0d1a0d", card:"rgba(255,255,255,0.06)", border:"#2a4a2a", green:"#6fcf6f", dim:"#3a6a3a", gold:"#d4a843", white:"#f0ece0", muted:"#8a9a7a", blue:"#5a9fd4", red:"#e05050", orange:"#e09030", teal:"#4ab8a0", indigo:"#5a6fd4", nav:"rgba(13,26,13,0.97)", onGreen:"#000000" },
  light:     { bg:"#f0f4f0", card:"rgba(255,255,255,0.9)", border:"#c0d4c0", green:"#2a7a2a", dim:"#7ab87a", gold:"#8e6410", white:"#1a2a1a", muted:"#547254", blue:"#2a5fa0", red:"#c03030", orange:"#a65a10", teal:"#18786a", indigo:"#3a4fb0", nav:"rgba(240,244,240,0.97)", onGreen:"#ffffff" },
  bluesteel: { bg:"#0d1520", card:"rgba(255,255,255,0.06)", border:"#1a3050", green:"#40c0e0", dim:"#1a5070", gold:"#e0c040", white:"#e8f0f8", muted:"#6584a3", blue:"#60a0e0", red:"#e05050", orange:"#e09030", teal:"#40d0c0", indigo:"#8080e0", nav:"rgba(13,21,32,0.97)", onGreen:"#000000" },
  // Default theme as of 2026-09-19, per direct request: "the neon green is something that I
  // like, but it's not professional so go in a white beige theme." Keeps green as the accent
  // (the user said they like it) but swaps the neon dark-mode green for a muted sage/forest
  // tone against warm ivory/beige surfaces instead of the saturated green-tinted "light"
  // theme above, which is unchanged and still available in the picker.
  beige:     { bg:"#f7f3ec", card:"#ffffff", border:"#e3dcc9", green:"#587650", dim:"#9ab08f", gold:"#8a6831", white:"#2b2620", muted:"#726b60", blue:"#3f6a92", red:"#a8433a", orange:"#95622f", teal:"#38796d", indigo:"#4a5480", nav:"rgba(247,243,236,0.97)", onGreen:"#ffffff" },
};
