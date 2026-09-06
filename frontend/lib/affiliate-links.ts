// Retailer "shop this" links were sending real traffic with zero commission
// captured. These helpers add the tracking param/wrapper once you have real
// affiliate credentials — until then they fall back to the plain untagged
// URL, so nothing breaks if a var isn't set yet.
//
// Amazon Associates: sign up at affiliate-program.amazon.com (free), then set
// EXPO_PUBLIC_AMAZON_AFFILIATE_TAG to your tracking ID (looks like "yourname-20").
//
// Walmart: their affiliate program runs through Impact (impact.com) — once
// approved, Impact gives you an exact deep-link wrapper URL for your account,
// which varies by publisher/campaign ID. Set
// EXPO_PUBLIC_WALMART_AFFILIATE_URL_TEMPLATE to that wrapper with "{URL}" where
// the destination link should be inserted — don't guess this format, use
// whatever Impact's dashboard gives you.

const AMAZON_TAG = process.env.EXPO_PUBLIC_AMAZON_AFFILIATE_TAG;
const WALMART_TEMPLATE = process.env.EXPO_PUBLIC_WALMART_AFFILIATE_URL_TEMPLATE;

export function buildAmazonSearchUrl(query: string): string {
  const url = new URL("https://www.amazon.com/s");
  url.searchParams.set("k", query);
  if (AMAZON_TAG) url.searchParams.set("tag", AMAZON_TAG);
  return url.toString();
}

export function buildWalmartSearchUrl(query: string): string {
  const plainUrl = `https://www.walmart.com/search?q=${encodeURIComponent(query)}`;
  if (!WALMART_TEMPLATE) return plainUrl;
  return WALMART_TEMPLATE.replace("{URL}", encodeURIComponent(plainUrl));
}
