import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * POST /api/return-qr
 * Generate a prepaid USPS Label Broker QR via Shippo (customer → BNY lab).
 *
 * Note: USPS does not support qr_code_requested together with is_return.
 * This creates a normal prepaid Ground Advantage label in the return
 * direction and returns qr_code_url for Post Office drop-off.
 *
 * Body: { cid, email, address: { name, street1, street2?, city, state, zip } }
 * Returns: { qrCodeUrl, labelUrl, trackingNumber, trackingUrl }
 */

const LAB = {
  name: "FOTO FOTO",
  company: "FOTO FOTO",
  street1: "63 Flushing Avenue",
  street2: "Building 280, Suite 414",
  city: "Brooklyn",
  state: "NY",
  zip: "11205",
  country: "US",
  phone: "2012927506",
  email: "returns@fotofoto.io",
};

async function shippo<T>(
  token: string,
  path: string,
  body: unknown
): Promise<T> {
  const res = await fetch(`https://api.goshippo.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `ShippoToken ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      typeof data === "object" ? JSON.stringify(data) : String(data)
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { cid, email, address } = req.body ?? {};

  if (!cid || !email) {
    return res.status(400).json({ error: "Missing cid or email" });
  }
  if (
    !address?.name ||
    !address?.street1 ||
    !address?.city ||
    !address?.state ||
    !address?.zip ||
    !address?.phone
  ) {
    return res.status(400).json({ error: "Missing required address fields" });
  }

  const phoneDigits = String(address.phone).replace(/\D/g, "");
  if (phoneDigits.length < 10) {
    return res.status(400).json({ error: "Invalid phone number" });
  }
  // USPS wants a real NANP number; keep last 10 digits.
  const phone = phoneDigits.slice(-10);

  const token = process.env.SHIPPO_API_KEY;
  if (!token) {
    console.log(`[STUB] Return QR for cid=${cid}, email=${email}`);
    return res.status(200).json({
      qrCodeUrl: "https://placehold.co/300x300/f0f0f0/666?text=USPS+Label+Broker%0AQR+(stub)",
      labelUrl: "https://placehold.co/400x200/f0f0f0/666?text=USPS+Label+(stub)",
      trackingNumber: "STUB_QR_" + Date.now(),
      trackingUrl: null,
      stub: true,
    });
  }

  try {
    console.log(`[RETURN_QR] Creating Shippo shipment for cid=${cid}`);

    type Rate = {
      object_id: string;
      amount: string;
      provider?: string;
      servicelevel?: { name?: string };
    };
    type Shipment = {
      object_id: string;
      rates?: Rate[];
      messages?: Array<{ source?: string; text?: string }>;
    };

    const shipment = await shippo<Shipment>(token, "/shipments/", {
      address_from: {
        name: String(address.name).trim(),
        street1: String(address.street1).trim(),
        ...(address.street2?.trim()
          ? { street2: String(address.street2).trim() }
          : {}),
        city: String(address.city).trim(),
        state: String(address.state).trim().toUpperCase(),
        zip: String(address.zip).trim(),
        country: "US",
        email,
        phone,
      },
      address_to: LAB,
      parcels: [
        {
          length: "6",
          width: "4",
          height: "3",
          distance_unit: "in",
          weight: "8",
          mass_unit: "oz",
        },
      ],
      extra: { qr_code_requested: true },
      async: false,
    });

    const usps = (shipment.rates ?? [])
      .filter((r) => (r.provider || "").toUpperCase() === "USPS")
      .sort((a, b) => {
        const aGa = (a.servicelevel?.name || "").includes("Ground Advantage") ? 0 : 1;
        const bGa = (b.servicelevel?.name || "").includes("Ground Advantage") ? 0 : 1;
        if (aGa !== bGa) return aGa - bGa;
        return parseFloat(a.amount) - parseFloat(b.amount);
      });

    if (usps.length === 0) {
      console.error("[RETURN_QR] No USPS rates", shipment.messages);
      return res.status(502).json({
        error: "No USPS rates available",
        detail: shipment.messages ?? null,
      });
    }

    const rate = usps[0];
    console.log(
      `[RETURN_QR] Buying ${rate.servicelevel?.name} @ $${rate.amount}`
    );

    type Tx = {
      status?: string;
      qr_code_url?: string | null;
      label_url?: string | null;
      tracking_number?: string | null;
      tracking_url_provider?: string | null;
      messages?: unknown;
    };

    const tx = await shippo<Tx>(token, "/transactions/", {
      rate: rate.object_id,
      label_file_type: "PNG",
      async: false,
    });

    if (tx.status !== "SUCCESS" || !tx.qr_code_url) {
      console.error("[RETURN_QR] Transaction failed", tx.status, tx.messages);
      const msg = Array.isArray(tx.messages)
        ? (tx.messages as Array<{ text?: string }>)
            .map((m) => m.text)
            .filter(Boolean)
            .join(" ")
        : null;
      return res.status(502).json({
        error: msg || "Failed to purchase QR label",
        detail: tx.messages ?? tx.status,
      });
    }

    console.log(
      `[RETURN_QR] OK tracking=${tx.tracking_number} qr=${tx.qr_code_url}`
    );

    return res.status(200).json({
      qrCodeUrl: tx.qr_code_url,
      labelUrl: tx.label_url ?? null,
      trackingNumber: tx.tracking_number ?? null,
      trackingUrl: tx.tracking_url_provider ?? null,
    });
  } catch (err) {
    console.error("[RETURN_QR] failed:", err);
    return res.status(500).json({
      error: "Internal server error",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
