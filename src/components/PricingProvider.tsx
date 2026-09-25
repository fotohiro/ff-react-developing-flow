import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FALLBACK_PRICES, PricingContext, type Market, type PriceSet } from "../lib/pricing";

/**
 * Fetches localized prices once on mount (country is geo-detected server-side)
 * and shares them with the wizard. Renders children immediately using USD
 * fallback prices, then updates in place once the real prices arrive.
 *
 * `setCountry` lets the return-country dropdown re-resolve prices for an
 * explicitly chosen country, keeping the displayed currency in sync.
 * `setMarket` re-resolves prices against another return market's store.
 */
export default function PricingProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<PriceSet>(FALLBACK_PRICES);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [country, setCountryState] = useState("US");
  const [market, setMarketState] = useState<Market>("us");
  const [loading, setLoading] = useState(true);
  const countryRef = useRef<string>("");
  const marketRef = useRef<string>(new URLSearchParams(window.location.search).get("market") || "");

  const fetchPrices = useCallback(async (signal?: AbortSignal) => {
    // Explicit choice wins, then ?country= test override, then geo (server-side)
    const countryOverride =
      countryRef.current ||
      new URLSearchParams(window.location.search).get("country") ||
      "";
    const params = new URLSearchParams();
    if (countryOverride) params.set("country", countryOverride);
    if (marketRef.current) params.set("market", marketRef.current);
    const qs = params.toString();
    const url = qs ? `/api/prices?${qs}` : "/api/prices";

    try {
      const res = await fetch(url, signal ? { signal } : undefined);
      if (!res.ok) throw new Error(`prices ${res.status}`);
      const data = await res.json();
      if (signal?.aborted) return;
      if (data?.prices) setPrices({ ...FALLBACK_PRICES, ...data.prices });
      if (data?.currencyCode) setCurrencyCode(data.currencyCode);
      if (data?.country) setCountryState(data.country);
      if (data?.market === "us" || data?.market === "my") setMarketState(data.market);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      console.warn("[pricing] falling back to USD:", err);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchPrices(controller.signal);
    return () => controller.abort();
  }, [fetchPrices]);

  const setCountry = useCallback(
    (next: string) => {
      countryRef.current = next;
      setCountryState(next); // optimistic — dropdown reflects the choice immediately
      fetchPrices();
    },
    [fetchPrices]
  );

  const setMarket = useCallback(
    (next: Market) => {
      marketRef.current = next;
      fetchPrices();
    },
    [fetchPrices]
  );

  const value = useMemo(() => {
    const formatPrice = (amount: number) =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currencyCode,
      }).format(amount);
    return { prices, currencyCode, country, market, loading, formatPrice, setCountry, setMarket };
  }, [prices, currencyCode, country, market, loading, setCountry, setMarket]);

  return (
    <PricingContext.Provider value={value}>{children}</PricingContext.Provider>
  );
}
