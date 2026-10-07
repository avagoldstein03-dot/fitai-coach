/**
 * The offer a referred user gets.
 *
 * One number in one place. The discount itself is delivered by an App Store
 * promotional offer — Apple processes the payment, so no percentage applied
 * here would reach the charge. What this governs is who is *shown* the offer and
 * what the app says about it, which must match what App Store Connect is
 * configured to give. If you change the offer in App Store Connect, change this
 * to match or the app will promise something the checkout does not deliver.
 *
 * Deliberately one shared offer rather than one per influencer: Apple caps
 * promotional offers per subscription and each is manual setup, whereas
 * Affiliate.code is free and unlimited. The influencer's code does attribution;
 * this unlocks the discount. One Apple offer serves every influencer.
 */
export const REFERRAL_DISCOUNT_PERCENT = 25;

/** Must match the Product ID of the promotional offer in App Store Connect. */
export const REFERRAL_OFFER_IDENTIFIER = "referred_first_month_25";
