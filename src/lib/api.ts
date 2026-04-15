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

const MAX_LABEL_DIMENSION = 1200;
const LABEL_JPEG_QUALITY = 0.8;

/** Resize a base64 data-URL image so the longest side is ≤ maxDim, returned as JPEG */
function compressImage(dataUrl: string, maxDim = MAX_LABEL_DIMENSION, quality = LABEL_JPEG_QUALITY): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Failed to load image for compression"));
    img.src = dataUrl;
  });
}

/** Upload a base64 label image to Vercel Blob and get back a permanent CDN URL */
export async function uploadLabelBase64(
  imageData: string,
  cid: string
): Promise<string> {
  // #region agent log
  console.log(`[DEBUG-e3448b] Upload — original size: ${imageData.length} chars (${(imageData.length/1024/1024).toFixed(2)} MB)`);
  // #endregion

  const compressed = await compressImage(imageData);

  const jsonBody = JSON.stringify({ imageData: compressed, cid });
  // #region agent log
  console.log(`[DEBUG-e3448b] Upload — compressed size: ${compressed.length} chars (${(compressed.length/1024/1024).toFixed(2)} MB), jsonBody: ${(jsonBody.length/1024/1024).toFixed(2)} MB`);
  // #endregion

  const res = await fetch(`${API_BASE}/upload-label`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonBody,
  });
  if (!res.ok) {
    // #region agent log
    const rawText = await res.text();
    console.error(`[DEBUG-e3448b] Upload FAILED — status: ${res.status} ${res.statusText}, body: ${rawText.substring(0,500)}`);
    // #endregion
    let errorMsg = "Failed to upload label image";
    try { const parsed = JSON.parse(rawText); errorMsg = parsed.error || errorMsg; } catch {}
    throw new Error(errorMsg);
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
  weddingBoxId?: string;
  printsQty?: number;
  extraPrintsQty?: number;
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
