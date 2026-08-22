import type { Product } from "./types";

// The merchant discount code, read OUT OF THE LINKS rather than configured.
//
// WHY IT IS DERIVED AND NOT A SETTING
// -----------------------------------
// The paid tiers advertise that the recommendations come with a discount
// code. That promise is only true while the links actually carry one, and a
// code typed into a config file is a promise that keeps being made after
// somebody pastes a fresh link without the parameter. Reading it back out of
// the catalogue means the displayed code and the delivered code are the same
// fact — they cannot drift apart, because there is only one of them.
//
// ALL OR NOTHING, ON PURPOSE. If even one product link is missing the code,
// null comes back and the UI shows nothing. A code shown next to a list where
// it silently fails on some items is worse than no code at all: the customer
// blames the checkout, not the link.
//
// iHerb calls this parameter `rcode` (its Rewards programme). `pcode` and
// `rsref` are the older spellings of the same thing and still appear on
// links copied from the app, so all three are accepted.

const PARAMS = ["rcode", "pcode", "rsref"] as const;

/** The code on one link, or null when it carries none. */
export function rewardsCodeOf(link: string): string | null {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return null;
  }
  for (const param of PARAMS) {
    const value = url.searchParams.get(param)?.trim();
    // `?rcode` with no value parses as an empty string — that is a link
    // somebody truncated, not a code.
    if (value) return value;
  }
  return null;
}

/**
 * The one code every product shares, or null.
 *
 * Null when the catalogue is empty, when any product has no code, or when
 * two products disagree — in the last case there is no single code to show
 * and guessing which one to print would hand the customer the wrong one.
 */
export function sharedRewardsCode(products: Product[]): string | null {
  if (products.length === 0) return null;

  let shared: string | null = null;
  for (const product of products) {
    const code = rewardsCodeOf(product.affiliateLink);
    if (!code) return null;
    if (shared === null) shared = code;
    else if (shared !== code) return null;
  }
  return shared;
}
