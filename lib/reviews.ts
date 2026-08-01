// Customer reviews shown on the landing page.
//
// ⚠️ LEGAL: Fill this ONLY with real, verifiable customer reviews (with
// consent). Fabricated reviews/testimonials are explicitly illegal in the
// EU (UWG Anhang "Schwarze Liste" Nr. 23b/23c, Omnibus-Richtlinie) and a
// classic Abmahnung target. The ReviewsSection component renders nothing
// while this array is empty — the page looks clean without it.

export interface Review {
  quote: string;
  author: string;
  source?: string;
}

export const REVIEWS: Review[] = [];
