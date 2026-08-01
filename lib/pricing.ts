// Single one-time unlock. No subscription, no auto-renewal — and the copy
// says so because it's true.
//
// Only list features that actually ship. Advertising undelivered features is
// misleading under EU consumer law (UWG §5).

export const PRODUCT = {
  name: "Full Biometric Analysis",
  price: "4.99",
  currency: "€",
  features: [
    "All biometric measurements unlocked",
    "Symmetry, canthal tilt & jawline in exact figures",
    "Personalized glow-up action plan",
    "AI deep-dive report from your photos",
    "Lifetime access — one-time payment",
  ],
} as const;
