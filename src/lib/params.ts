/** "05023" / "cid-05023" / "5023" -> "05023"-style digits as given; null if not a real camera ID. */
export function normalizeCid(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.trim().replace(/^cid-/i, "");
  if (!/^\d{1,6}$/.test(digits) || parseInt(digits, 10) === 0) return null;
  return digits;
}

/** Parse URL search params on mount */
export function getParams() {
  const sp = new URLSearchParams(window.location.search);
  const rawPct = sp.get("discount_pct");
  const rawFmt = sp.get("fmt");
  return {
    cid: normalizeCid(sp.get("cid")),           // null → ask the customer for it

    wbid: sp.get("wbid"),                       // wedding box ID
    prepaid: sp.get("prepaid") === "true",       // prepaid redemption — free scans + optional prints
    atLab: sp.get("at_lab") === "true",          // camera already at lab — skip return label
    lt: sp.get("lt"),                            // label token — null if not present
    discount: sp.get("discount"),                // winback discount code
    discountPct: rawPct ? Number(rawPct) || null : null,
    email: sp.get("email"),                      // pre-fill from Klaviyo link
    fmt: rawFmt === "scans" || rawFmt === "prints" ? rawFmt as "scans" | "prints" : null,
  };
}
