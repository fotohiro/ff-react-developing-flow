export const CAMERA_ROUTER_URL = "https://ff-camera-router.vercel.app/api/route";

/** "05023" / "cid-05023" / "5023" -> "05023"-style digits as given; null if not a real camera ID. */
export function normalizeCid(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.trim().replace(/^cid-/i, "");
  if (!/^\d{1,6}$/.test(digits) || parseInt(digits, 10) === 0) return null;
  return digits;
}

/**
 * When a visitor arrives at lab.fotofoto.io with a `cid` directly (e.g. from a
 * Klaviyo Nudge email link `lab.fotofoto.io/?cid=73010&email=...` or by typing
 * a camera number into CameraIdStep) without having passed through
 * ff-camera-router (`routed=1`, `wbid`, or `prepaid=true`), return the
 * ff-camera-router URL so Firestore is always checked for `weddingBoxID` and
 * `prepaid` before showing pricing/checkout.
 */
export function cameraRouterRedirectUrl(
  search: string,
  hostname: string,
  cidOverride?: string
): string | null {
  if (hostname === "localhost" || hostname === "127.0.0.1") return null;

  const sp = new URLSearchParams(search);
  if (cidOverride) {
    sp.set("cid", cidOverride);
    sp.delete("routed");
  }

  const cid = normalizeCid(sp.get("cid"));
  if (!cid) return null;

  if (
    !cidOverride &&
    (sp.get("wbid") || sp.get("prepaid") === "true" || sp.get("routed") === "1")
  ) {
    return null;
  }

  sp.set("cid", cid);
  return `${CAMERA_ROUTER_URL}?${sp.toString()}`;
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
    routed: sp.get("routed") === "1",            // true once ff-camera-router resolved camera state
  };
}
