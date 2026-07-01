import { createContext, useContext } from "react";

export interface PriceSet {
  scans: number;
  prints: number;
  wbGallery: number;
  wbPrints: number;
  extraPrints: number;
}

/** USD fallback — shown instantly and if the geo/price lookup fails. Keep in sync with Shopify. */
export const FALLBACK_PRICES: PriceSet = {
  scans: 9.99,
  prints: 16.99,
  wbGallery: 79.99,
  wbPrints: 70.0,
  extraPrints: 7.0,
};

export interface PricingValue {
  prices: PriceSet;
  currencyCode: string;
  /** ISO 3166-1 alpha-2 country the prices were resolved for (e.g. "US", "DE") */
  country: string;
  loading: boolean;
  /** Format a numeric amount in the resolved currency (e.g. "$9.99", "9,99 €") */
  formatPrice: (amount: number) => string;
}

export const PricingContext = createContext<PricingValue | null>(null);

export function usePricing(): PricingValue {
  const ctx = useContext(PricingContext);
  if (!ctx) throw new Error("usePricing must be used within a PricingProvider");
  return ctx;
}
