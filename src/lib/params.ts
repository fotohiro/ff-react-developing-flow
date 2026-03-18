/** Parse URL search params on mount */
export function getParams() {
  const sp = new URLSearchParams(window.location.search);
  const rawPct = sp.get("discount_pct");
  const rawFmt = sp.get("fmt");
  return {
    cid: sp.get("cid") ?? "0000",
    wbid: sp.get("wbid"),                       // wedding box ID
    atLab: sp.get("at_lab") === "true",          // camera already at lab — skip return label
    lt: sp.get("lt"),                            // label token — null if not present
    discount: sp.get("discount"),                // winback discount code
    discountPct: rawPct ? Number(rawPct) || null : null,
    email: sp.get("email"),                      // pre-fill from Klaviyo link
    fmt: rawFmt === "scans" || rawFmt === "prints" ? rawFmt : null,
  };
}
