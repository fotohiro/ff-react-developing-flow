const API_BASE = "/api";

/** Fire a Klaviyo event (server-side via our API route) */
export async function trackEvent(
  event: string,
  email: string,
  properties: Record<string, unknown>
) {
  try {
    await fetch(`${API_BASE}/klaviyo-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, email, properties }),
    });
  } catch (err) {
    console.warn("Klaviyo event failed:", err);
    // Non-blocking — don't break the flow
  }
}

/** Customer address for return label generation */
export interface CustomerAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
}

/** Request a replacement return label */
export async function requestReplacementLabel(
  cid: string,
  email: string,
  address: CustomerAddress
): Promise<{ labelUrl: string; trackingNumber: string; trackingUrl?: string }> {
  try {
    const res = await fetch(`${API_BASE}/replacement-label`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cid, email, address }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "API returned error");

    // If the API returned a stub response, it still has valid shape
    return data;
  } catch {
    // Dev fallback: simulate API delay + return mock label
    if (import.meta.env.DEV) {
      console.log("[DEV] Mocking replacement label generation...");
      await new Promise((r) => setTimeout(r, 2000)); // Simulate 2s API call
      return {
        labelUrl:
          "https://placehold.co/400x200/f0f0f0/666?text=USPS+Return+Label%0AFOTO+FOTO+%7C+Brooklyn+NY",
        trackingNumber: "DEV_TRACKING_" + Date.now(),
      };
    }
    throw new Error("Failed to generate replacement label");
  }
}

/** Upload a base64 label image to Vercel Blob and get back a permanent CDN URL */
export async function uploadLabelBase64(
  imageData: string,
  cid: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/upload-label`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageData, cid }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to upload label image");
  }
  const data = await res.json();
  return data.url;
}

/** Create a Shopify cart and get back the checkout URL */
export async function createCart(payload: {
  format: "scans" | "prints";
  cid: string;
  email: string;
  labelUrl?: string;
  labelToken?: string;
  discountCode?: string;
}): Promise<string> {
  const res = await fetch(`${API_BASE}/cart-create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create cart");
  return data.checkoutUrl;
}
