/** Parse URL search params on mount */
export function getParams() {
  const sp = new URLSearchParams(window.location.search);
  const rawPct = sp.get("discount_pct");
  return {
    cid: sp.get("cid") ?? "0000",
    lt: sp.get("lt"),             // label token — null if not present
    discount: sp.get("discount"), // winback discount code
    discountPct: rawPct ? Number(rawPct) || null : null, // discount percentage (15, 25, 30)
    email: sp.get("email"),       // pre-fill from Klaviyo link
  };
}
