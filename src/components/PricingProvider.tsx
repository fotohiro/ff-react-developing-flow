import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FALLBACK_PRICES, PricingContext, type PriceSet } from "../lib/pricing";

/**
 * Fetches localized prices once on mount (country is geo-detected server-side)
 * and shares them with the wizard. Renders children immediately using USD
 * fallback prices, then updates in place once the real prices arrive.
 */
export default function PricingProvider({ children }: { children: ReactNode }) {
  const [prices, setPrices] = useState<PriceSet>(FALLBACK_PRICES);
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [country, setCountry] = useState("US");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Optional ?country= override lets us preview localized pricing without a VPN
    const override = new URLSearchParams(window.location.search).get("country");
    const url = override
      ? `/api/prices?country=${encodeURIComponent(override)}`
      : "/api/prices";

    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`prices ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (data?.prices) setPrices({ ...FALLBACK_PRICES, ...data.prices });
        if (data?.currencyCode) setCurrencyCode(data.currencyCode);
        if (data?.country) setCountry(data.country);
      } catch (err) {
        console.warn("[pricing] falling back to USD:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => {
    const formatPrice = (amount: number) =>
      new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currencyCode,
      }).format(amount);
    return { prices, currencyCode, country, loading, formatPrice };
  }, [prices, currencyCode, country, loading]);

  return (
    <PricingContext.Provider value={value}>{children}</PricingContext.Provider>
  );
}
