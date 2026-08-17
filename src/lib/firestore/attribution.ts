const AFFILIATE_KEY = "bamyon:activeAffiliateId";
const REFERRAL_KEY = "bamyon:activeReferralCode";

/** Set when a visitor lands via ?ref=CODE on a product page (see product/[slug]/page.tsx).
 * Read back at checkout so the resulting order carries the right affiliateId. */
export function setActiveAffiliateId(affiliateId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AFFILIATE_KEY, affiliateId);
}

export function getActiveAffiliateId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AFFILIATE_KEY);
}

export function setActiveReferralCode(code: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REFERRAL_KEY, code);
}

export function getActiveReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFERRAL_KEY);
}
