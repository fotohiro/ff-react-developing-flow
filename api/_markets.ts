/**
 * Return-market -> Shopify store config. Files prefixed with "_" are not deployed as routes.
 *
 * The US store reads the original env var names (SHOPIFY_STOREFRONT_TOKEN, SCANS_VARIANT_ID, ...).
 * Other markets read the same names with a prefix (MY_SHOPIFY_STOREFRONT_TOKEN, MY_SCANS_VARIANT_ID, ...).
 * A market is only served once its Storefront token is set; until then requests fall back to US.
 */
export type Market = "us" | "my";

const MARKETS: Record<Market, { envPrefix: string; defaultDomain: string }> = {
  us: { envPrefix: "", defaultDomain: "foto-foto-foto.myshopify.com" },
  my: { envPrefix: "MY_", defaultDomain: "h00fsh-ti.myshopify.com" },
};

export function marketEnv(market: Market, key: string): string | undefined {
  return process.env[`${MARKETS[market].envPrefix}${key}`] || undefined;
}

function isConfigured(market: Market): boolean {
  return !!marketEnv(market, "SHOPIFY_STOREFRONT_TOKEN");
}

/** Requested market if known and configured, else "us". */
export function resolveMarket(requested: unknown): Market {
  const m = typeof requested === "string" ? requested.toLowerCase() : "";
  return m in MARKETS && isConfigured(m as Market) ? (m as Market) : "us";
}

export function storeFor(market: Market) {
  return {
    domain: marketEnv(market, "SHOPIFY_STORE_DOMAIN") || MARKETS[market].defaultDomain,
    storefrontToken: marketEnv(market, "SHOPIFY_STOREFRONT_TOKEN"),
  };
}

/**
 * Country the Storefront cart is priced for. The Malaysia store only sells into Malaysia,
 * so its carts always check out as MY; the US store localizes to the visitor's country.
 */
export function buyerCountryFor(market: Market, visitorCountry: string | undefined): string | undefined {
  return market === "my" ? "MY" : visitorCountry || undefined;
}

/** Canonical camera ID: digits only, 1..999999 (rejects the old "0000" placeholder). */
export function isValidCid(cid: unknown): boolean {
  if (typeof cid !== "string" || !/^\d{1,6}$/.test(cid)) return false;
  return parseInt(cid, 10) > 0;
}
