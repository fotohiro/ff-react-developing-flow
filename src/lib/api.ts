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

/** Request a prepaid USPS Label Broker QR via Shippo (customer → lab). */
export async function requestReturnQr(
  cid: string,
  email: string,
  address: CustomerAddress
): Promise<{
  qrCodeUrl: string;
  labelUrl: string | null;
  trackingNumber: string;
  trackingUrl?: string | null;
  stub?: boolean;
}> {
  try {
    const res = await fetch(`${API_BASE}/return-qr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cid, email, address }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "API returned error");
    if (!data.qrCodeUrl) throw new Error("No QR code returned");
    return data;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.log("[DEV] Mocking return QR generation...", err);
      await new Promise((r) => setTimeout(r, 1200));
      return {
        qrCodeUrl:
          "https://placehold.co/300x300/f0f0f0/666?text=USPS+Label+Broker%0AQR+(dev)",
        labelUrl: null,
        trackingNumber: "DEV_QR_" + Date.now(),
        stub: true,
      };
    }
    throw err instanceof Error ? err : new Error("Failed to generate return QR");
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
  const compressed = await compressImage(imageData);
  const res = await fetch(`${API_BASE}/upload-label`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageData: compressed, cid }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to upload label image");
  }
  const data = await res.json();
  return data.url;
}

/** International (EU) return address collected in the flow */
export interface IntlReturnAddress {
  name: string;
  street: string;
  houseNumber: string;
  city: string;
  postalCode: string;
  phone: string;
}

export interface IntlReturnLabel {
  labelUrl: string | null;
  qrCodeUrl: string | null;
  trackingNumber: string | null;
  carrier: string;
  paperless: boolean;
  stub?: boolean;
}

/** Generate an international return label/QR via SendCloud (EU customers) */
export async function createReturnLabel(payload: {
  cid: string;
  email: string;
  country: string;
  address: IntlReturnAddress;
}): Promise<IntlReturnLabel> {
  const res = await fetch(`${API_BASE}/returns-label`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || "Failed to generate return label") as Error & {
      code?: string;
    };
    err.code = data.error;
    throw err;
  }
  return data;
}

/** Create a Shopify cart and get back the checkout URL */
export async function createCart(payload: {
  format: "scans" | "prints";
  cid: string;
  email: string;
  country?: string;
  labelUrl?: string;
  labelToken?: string;
  labelTracking?: string;
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
