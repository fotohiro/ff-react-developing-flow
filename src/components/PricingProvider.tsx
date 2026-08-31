import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { FALLBACK_PRICES, PricingContext, type PriceSet } from "../lib/pricing";

/**
 * Fetches localized prices once on mount (country is geo-detected server-side)
 * and shares them with the wizard. Renders children immediately using USD
 * fallback prices, then updates in place once the real prices arrive.
 *
 * `setCountry` lets the return-country dropdown re-resolve prices for an
 * explicitly chosen country, keeping the displayed currency in sync.
 */
export default function PricingProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<PriceSet>(FALLBACK_PRICES);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [country, setCountryState] = useState("US");
  const [loading, setLoading] = useState(true);

  const fetchPrices = useCallback(async (overrideCountry?: string, signal?: AbortSignal) => {
    // Explicit choice wins, then ?country= test override, then geo (server-side)
    const urlOverride =
      overrideCountry ||
      new URLSearchParams(window.location.search).get("country") ||
      "";
    const url = urlOverride
      ? `/api/prices?country=${encodeURIComponent(urlOverride)}`
      : "/api/prices";

    try {
      const res = await fetch(url, signal ? { signal } : undefined);
      if (!res.ok) throw new Error(`prices ${res.status}`);
      const data = await res.json();
      if (signal?.aborted) return;
      if (data?.prices) setPrices({ ...FALLBACK_PRICES, ...data.prices });
      if (data?.currencyCode) setCurrencyCode(data.currencyCode);
      if (data?.country) setCountryState(data.country);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      console.warn("[pricing] falling back to USD:", err);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchPrices(undefined, controller.signal);
    return () => controller.abort();
  }, [fetchPrices]);

  const setCountry = useCallback(
    (next: string) => {
      setCountryState(next); // optimistic — dropdown reflects the choice immediately
      fetchPrices(next);
    },
    [fetchPrices]
  );

  const value = useMemo(() => {
    const formatPrice = (amount: number) =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currencyCode,
      }).format(amount);
    return { prices, currencyCode, country, loading, formatPrice, setCountry };
  }, [prices, currencyCode, country, loading, setCountry]);

  return (
    <PricingContext.Provider value={value}>{children}</PricingContext.Provider>
  );
}
